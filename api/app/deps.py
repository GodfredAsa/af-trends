from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CATALOG_EDITOR_ROLES, STAFF_ROLES, User, UserRole
from app.security import get_current_user

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    allowed = {role.value for role in roles}

    def dependency(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to do this.",
            )
        return user

    return dependency


ClientUser = Annotated[User, Depends(require_roles(UserRole.client))]
StaffUser = Annotated[User, Depends(require_roles(*STAFF_ROLES))]
CatalogEditor = Annotated[User, Depends(require_roles(*CATALOG_EDITOR_ROLES))]
SuperadminUser = Annotated[User, Depends(require_roles(UserRole.superadmin))]
ManagerPlus = Annotated[User, Depends(require_roles(UserRole.manager, UserRole.superadmin))]


def pagination(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> tuple[int, int]:
    return page, page_size


Pagination = Annotated[tuple[int, int], Depends(pagination)]


def as_uuid(value: str, label: str = "id") -> UUID:
    try:
        return UUID(str(value))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {label}.") from exc
