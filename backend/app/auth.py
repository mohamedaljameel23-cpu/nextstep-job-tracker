import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY and ENVIRONMENT in {"production", "prod"}:
    raise RuntimeError("SECRET_KEY must be configured when ENVIRONMENT is production")
SECRET_KEY = SECRET_KEY or "local-development-key-change-before-deploying"
if ENVIRONMENT in {"production", "prod"} and len(SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY must be at least 32 characters when ENVIRONMENT is production")
if ENVIRONMENT in {"production", "prod"} and SECRET_KEY.lower().startswith(("replace-with", "change-me", "set_")):
    raise RuntimeError("Replace the SECRET_KEY placeholder with a randomly generated secret before deploying")
ALGORITHM = "HS256"
password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_access_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode({"sub": str(user_id), "exp": expires}, SECRET_KEY, algorithm=ALGORITHM)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme), db: Session = Depends(get_db)) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please sign in to continue", headers={"WWW-Authenticate": "Bearer"})
    if credentials is None:
        raise unauthorized
    try:
        subject = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM]).get("sub")
        if subject is None:
            raise unauthorized
        user_id = int(subject)
    except JWTError:
        raise unauthorized
    except ValueError:
        raise unauthorized
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user
