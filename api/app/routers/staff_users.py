from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select

from app.deps import DbSession, Pagination, SuperadminUser
from app.models import User, UserRole
from app.schemas import StaffUserCreate, StaffUserPatch, UserOut
from app.security import hash_password
from app.serializers import user_out

router = APIRouter()


def _out(user: User) -> UserOut:
    return user_out(user)


@router.get("/users")
def list_users(
    _admin: SuperadminUser,
    db: DbSession,
    pagination: Pagination,
    role: str | None = None,
    is_active: bool | None = None,
    q: str | None = None,
):
    page_num, page_size = pagination
    stmt = select(User).order_by(User.created_at.desc())
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(term), User.email.ilike(term), User.phone.ilike(term)))
    rows = db.scalars(stmt).all()
    total = len(rows)
    start = (page_num - 1) * page_size
    sliced = rows[start : start + page_size]
    return {"items": [_out(user) for user in sliced], "page": page_num, "page_size": page_size, "total": total}


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: StaffUserCreate, _admin: SuperadminUser, db: DbSession) -> UserOut:
    email = payload.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip(),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _out(user)


@router.patch("/users/{user_id}", response_model=UserOut)
def patch_user(user_id: UUID, payload: StaffUserPatch, admin: SuperadminUser, db: DbSession) -> UserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    superadmins = db.scalars(select(User).where(User.role == UserRole.superadmin.value, User.is_active.is_(True))).all()
    if payload.is_active is False and user.role == UserRole.superadmin.value and len(superadmins) <= 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot deactivate the last superadmin.")
    if payload.role and user.role == UserRole.superadmin.value and user.id == admin.id and len(superadmins) <= 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot change the last superadmin role.")
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip()
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _out(user)
