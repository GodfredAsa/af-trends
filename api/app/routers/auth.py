from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from sqlalchemy import select

from app.cart_hold import merge_guest_cart
from app.deps import CurrentUser, DbSession
from app.models import STAFF_ROLES, User, UserRole
from app.privileges import Priv, has_priv
from app.schemas import LoginRequest, ProfileUpdate, RegisterRequest, TokenResponse, UserOut
from app.security import create_access_token, hash_password, verify_password
from app.serializers import user_out

router = APIRouter()

CartKey = Annotated[str | None, Header(alias="X-Cart-Key")]


def _token(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.email),
        user=user_out(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession, x_cart_key: CartKey = None) -> TokenResponse:
    email = payload.email.lower().strip()
    exists = db.scalar(select(User).where(User.email == email))
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip(),
        role=UserRole.client.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    merge_guest_cart(db, user, x_cart_key)
    db.commit()
    return _token(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession, x_cart_key: CartKey = None) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower().strip()))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if user.role in {role.value for role in STAFF_ROLES} and not has_priv(user.role, Priv.STAFF_LOGIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This role is not allowed to sign in.",
        )
    merge_guest_cart(db, user, x_cart_key)
    db.commit()
    return _token(user)


@router.get("/me", response_model=UserOut)
def read_me(user: CurrentUser) -> UserOut:
    return user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(payload: ProfileUpdate, user: CurrentUser, db: DbSession) -> UserOut:
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip()
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_out(user)
