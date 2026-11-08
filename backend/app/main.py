import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import create_access_token, current_user, hash_password, verify_password
from .database import get_db

is_production = os.getenv("ENVIRONMENT", "development").lower() in {"production", "prod"}
app = FastAPI(title="NextStep API", version="0.1.0", description="A personal workspace for every step in your job search.", docs_url=None if is_production else "/docs", redoc_url=None if is_production else "/redoc", openapi_url=None if is_production else "/openapi.json")
origins = [value.strip() for value in os.getenv("FRONTEND_ORIGINS", os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")).split(",") if value.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])


def owned_application(application_id: int, user: models.User, db: Session) -> models.Application:
    item = db.scalar(select(models.Application).where(models.Application.id == application_id, models.Application.owner_id == user.id))
    if item is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return item


def add_event(db: Session, application_id: int, event_type: str, title: str, description: str = ""):
    db.add(models.ApplicationEvent(application_id=application_id, event_type=event_type, title=title, description=description))


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "service": "nextstep-api"}


@app.post("/api/auth/register", response_model=schemas.TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.scalar(select(models.User).where(models.User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = models.User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    db.refresh(user)
    return {"access_token": create_access_token(user.id), "user": user}


@app.post("/api/auth/login", response_model=schemas.TokenOut)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.scalar(select(models.User).where(models.User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return {"access_token": create_access_token(user.id), "user": user}


@app.get("/api/auth/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(current_user)):
    return user


@app.get("/api/applications", response_model=list[schemas.ApplicationOut])
def list_applications(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(models.Application).where(models.Application.owner_id == user.id).order_by(models.Application.updated_at.desc())).all()


@app.get("/api/calendar")
def list_calendar_events(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    applications = db.scalars(select(models.Application).where(models.Application.owner_id == user.id, models.Application.follow_up.is_not(None))).all()
    events = [{"id": f"follow-up-{item.id}", "application_id": item.id, "kind": "follow-up", "title": "Follow-up reminder", "company": item.company, "role": item.role, "date": item.follow_up.isoformat(), "scheduled_at": None} for item in applications]
    interviews = db.execute(select(models.Interview, models.Application).join(models.Application, models.Interview.application_id == models.Application.id).where(models.Application.owner_id == user.id, models.Interview.scheduled_at.is_not(None))).all()
    events.extend({"id": f"interview-{interview.id}", "application_id": item.id, "kind": "interview", "title": interview.title, "company": item.company, "role": item.role, "date": interview.scheduled_at.date().isoformat(), "scheduled_at": interview.scheduled_at.isoformat(), "interview_type": interview.interview_type} for interview, item in interviews)
    return sorted(events, key=lambda event: event["scheduled_at"] or event["date"])


@app.post("/api/applications", response_model=schemas.ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(payload: schemas.ApplicationInput, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    item = models.Application(**payload.model_dump(), owner_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    add_event(db, item.id, "created", "Application added", f"Added {item.role} at {item.company}.")
    if item.notes.strip():
        add_event(db, item.id, "note", "Note added", item.notes.strip())
    db.commit()
    return item


@app.patch("/api/applications/{application_id}", response_model=schemas.ApplicationOut)
def update_application(application_id: int, payload: schemas.ApplicationInput, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned_application(application_id, user, db)
    previous_status = item.status
    previous_notes = item.notes
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    if previous_status != item.status:
        add_event(db, item.id, "status", f"Moved to {item.status}", f"{previous_status} → {item.status}")
    if previous_notes != item.notes:
        add_event(db, item.id, "note", "Application note updated" if item.notes.strip() else "Application note cleared", item.notes.strip())
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned_application(application_id, user, db)
    db.delete(item)
    db.commit()


@app.get("/api/applications/{application_id}/details", response_model=schemas.ApplicationDetail)
def application_details(application_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned_application(application_id, user, db)
    events = db.scalars(select(models.ApplicationEvent).where(models.ApplicationEvent.application_id == item.id).order_by(models.ApplicationEvent.created_at.desc(), models.ApplicationEvent.id.desc())).all()
    if not events:
        legacy_event = models.ApplicationEvent(application_id=item.id, event_type="created", title="Application added", description=f"Added {item.role} at {item.company}.", created_at=item.created_at)
        db.add(legacy_event)
        db.commit()
        events = [legacy_event]
    interviews = db.scalars(select(models.Interview).where(models.Interview.application_id == item.id).order_by(models.Interview.scheduled_at.asc().nullslast(), models.Interview.id.desc())).all()
    contacts = db.scalars(select(models.Contact).where(models.Contact.application_id == item.id).order_by(models.Contact.created_at.desc())).all()
    return {"application": item, "events": events, "interviews": interviews, "contacts": contacts}


@app.post("/api/applications/{application_id}/notes", response_model=schemas.EventOut, status_code=status.HTTP_201_CREATED)
def add_application_note(application_id: int, payload: schemas.NoteCreate, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned_application(application_id, user, db)
    event = models.ApplicationEvent(application_id=item.id, event_type="note", title="Note added", description=payload.note.strip())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@app.post("/api/applications/{application_id}/interviews", response_model=schemas.InterviewOut, status_code=status.HTTP_201_CREATED)
def add_interview(application_id: int, payload: schemas.InterviewCreate, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned_application(application_id, user, db)
    interview = models.Interview(application_id=item.id, **payload.model_dump())
    db.add(interview)
    description = f"{payload.interview_type} round scheduled"
    if payload.scheduled_at:
        description += f" for {payload.scheduled_at.isoformat()}"
    if payload.interviewer:
        description += f" with {payload.interviewer}"
    add_event(db, item.id, "interview", payload.title, description)
    db.commit()
    db.refresh(interview)
    return interview


@app.delete("/api/applications/{application_id}/interviews/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview(application_id: int, interview_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned_application(application_id, user, db)
    interview = db.scalar(select(models.Interview).where(models.Interview.id == interview_id, models.Interview.application_id == item.id))
    if interview is None:
        raise HTTPException(status_code=404, detail="Interview not found")
    add_event(db, item.id, "update", "Interview round removed", interview.title)
    db.delete(interview)
    db.commit()


@app.post("/api/applications/{application_id}/contacts", response_model=schemas.ContactOut, status_code=status.HTTP_201_CREATED)
def add_contact(application_id: int, payload: schemas.ContactCreate, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned_application(application_id, user, db)
    data = payload.model_dump()
    data["email"] = data["email"] or ""
    contact = models.Contact(application_id=item.id, **data)
    db.add(contact)
    add_event(db, item.id, "contact", "Contact added", f"Added {contact.name}" + (f" · {contact.role}" if contact.role else ""))
    db.commit()
    db.refresh(contact)
    return contact


@app.delete("/api/applications/{application_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(application_id: int, contact_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    item = owned_application(application_id, user, db)
    contact = db.scalar(select(models.Contact).where(models.Contact.id == contact_id, models.Contact.application_id == item.id))
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    add_event(db, item.id, "update", "Contact removed", contact.name)
    db.delete(contact)
    db.commit()


@app.get("/api/activity", response_model=list[schemas.ActivityOut])
def list_activity(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    applications = db.scalars(select(models.Application).where(models.Application.owner_id == user.id)).all()
    for application in applications:
        has_events = db.scalar(select(models.ApplicationEvent.id).where(models.ApplicationEvent.application_id == application.id).limit(1))
        if not has_events:
            db.add(models.ApplicationEvent(application_id=application.id, event_type="created", title="Application added", description=f"Added {application.role} at {application.company}.", created_at=application.created_at))
            if application.notes.strip():
                db.add(models.ApplicationEvent(application_id=application.id, event_type="note", title="Note added", description=application.notes.strip(), created_at=application.created_at))
    db.commit()
    rows = db.execute(
        select(models.ApplicationEvent, models.Application)
        .join(models.Application, models.ApplicationEvent.application_id == models.Application.id)
        .where(models.Application.owner_id == user.id)
        .order_by(models.ApplicationEvent.created_at.desc(), models.ApplicationEvent.id.desc())
        .limit(60)
    ).all()
    return [
        {
            "id": event.id,
            "application_id": application.id,
            "company": application.company,
            "role": application.role,
            "status": application.status,
            "event_type": event.event_type,
            "title": event.title,
            "description": event.description,
            "created_at": event.created_at,
        }
        for event, application in rows
    ]


@app.get("/api/analytics", response_model=schemas.AnalyticsOut)
def get_analytics(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    applications = db.scalars(select(models.Application).where(models.Application.owner_id == user.id)).all()
    interviews = db.scalars(
        select(models.Interview)
        .join(models.Application, models.Interview.application_id == models.Application.id)
        .where(models.Application.owner_id == user.id)
    ).all()
    now = datetime.now(timezone.utc)
    this_month = sum(1 for item in applications if item.created_at and item.created_at.year == now.year and item.created_at.month == now.month)
    applied = [item for item in applications if item.applied_on is not None]
    responded = sum(1 for item in applied if item.status in {"Interview", "Offer", "Rejected"})
    response_rate = round(responded / len(applied) * 100, 1) if applied else 0.0
    current_week = now.date() - timedelta(days=now.weekday())
    week_starts = [current_week - timedelta(weeks=offset) for offset in range(5, -1, -1)]
    week_counts = {start: 0 for start in week_starts}
    for item in applications:
        if item.created_at:
            created_date = item.created_at.date()
            start = created_date - timedelta(days=created_date.weekday())
            if start in week_counts:
                week_counts[start] += 1
    weekly = [
        {"week_start": start, "label": f"{start.strftime('%b')} {start.day}", "count": week_counts[start]}
        for start in week_starts
    ]
    return {
        "applications_total": len(applications),
        "active_total": sum(1 for item in applications if item.status in {"Wishlist", "Applied", "Interview"}),
        "interviewing_total": sum(1 for item in applications if item.status == "Interview"),
        "interview_rounds_total": len(interviews),
        "offers_total": sum(1 for item in applications if item.status == "Offer"),
        "applications_this_month": this_month,
        "response_rate": response_rate,
        "weekly_applications": weekly,
    }
