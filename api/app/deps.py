from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import STAFF_ROLES, User, UserRole
from app.privileges import Priv, has_priv
from app.security import get_current_user, get_optional_user

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


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


def require_priv(*privs: Priv) -> Callable[[User], User]:
    needed = tuple(privs)

    def dependency(user: CurrentUser) -> User:
        if not has_priv(user.role, *needed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to do this.",
            )
        return user

    return dependency


ClientUser = Annotated[User, Depends(require_roles(UserRole.client))]
StaffUser = Annotated[User, Depends(require_roles(*STAFF_ROLES))]
CatalogReader = Annotated[User, Depends(require_priv(Priv.CATALOG_READ))]
CatalogEditor = Annotated[User, Depends(require_priv(Priv.CATALOG_WRITE))]
CatalogDeleter = Annotated[User, Depends(require_priv(Priv.CATALOG_DELETE))]
PaletteEditor = Annotated[User, Depends(require_priv(Priv.PALETTE_WRITE))]
OrderCollector = Annotated[User, Depends(require_priv(Priv.ORDERS_COLLECT))]
OrderDeleter = Annotated[User, Depends(require_priv(Priv.ORDERS_DELETE))]
SuperadminUser = Annotated[User, Depends(require_priv(Priv.USERS_MANAGE))]
SettingsAdmin = Annotated[User, Depends(require_priv(Priv.SETTINGS_MANAGE))]
ManagerPlus = OrderCollector


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
