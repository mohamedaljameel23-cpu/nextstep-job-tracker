from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Status = Literal["Wishlist", "Applied", "Interview", "Offer", "Rejected", "Withdrawn"]


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    model_config = ConfigDict(from_attributes=True)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ApplicationInput(BaseModel):
    company: str = Field(min_length=1, max_length=140)
    role: str = Field(min_length=1, max_length=160)
    location: str = Field(default="", max_length=160)
    work_mode: str = Field(default="", max_length=40)
    status: Status = "Wishlist"
    source: str = Field(default="", max_length=100)
    job_url: str = Field(default="", max_length=500)
    salary: str = Field(default="", max_length=100)
    applied_on: date | None = None
    follow_up: date | None = None
    notes: str = Field(default="", max_length=10000)


class ApplicationOut(ApplicationInput):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class NoteCreate(BaseModel):
    note: str = Field(min_length=1, max_length=10000)


class EventOut(BaseModel):
    id: int
    event_type: str
    title: str
    description: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class InterviewCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    interview_type: str = Field(default="Interview", max_length=60)
    scheduled_at: datetime | None = None
    interviewer: str = Field(default="", max_length=140)
    notes: str = Field(default="", max_length=10000)


class InterviewOut(InterviewCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=140)
    role: str = Field(default="", max_length=120)
    email: EmailStr | None = None
    profile_url: str = Field(default="", max_length=500)


class ContactOut(BaseModel):
    id: int
    name: str
    role: str
    email: str
    profile_url: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ApplicationDetail(BaseModel):
    application: ApplicationOut
    events: list[EventOut]
    interviews: list[InterviewOut]
    contacts: list[ContactOut]


class ActivityOut(BaseModel):
    id: int
    application_id: int
    company: str
    role: str
    status: Status
    event_type: str
    title: str
    description: str
    created_at: datetime


class WeeklyPoint(BaseModel):
    week_start: date
    label: str
    count: int


class AnalyticsOut(BaseModel):
    applications_total: int
    active_total: int
    interviewing_total: int
    interview_rounds_total: int
    offers_total: int
    applications_this_month: int
    response_rate: float
    weekly_applications: list[WeeklyPoint]
