import json

from fastapi import APIRouter

from app.deps import DbSession, SettingsAdmin, StaffUser
from app.privileges import (
    STAFF_MATRIX_ROLES,
    Priv,
    apply_flags,
    catalog_out,
    flags_out,
    has_priv,
    hydrate,
    locked_privileges,
    set_runtime,
)
from app.schemas import PrivilegeMatrixOut, PrivilegeMatrixPatch
from app.serializers import get_settings

router = APIRouter()


def _matrix_out(user, matrix) -> PrivilegeMatrixOut:
    return PrivilegeMatrixOut(
        roles=list(STAFF_MATRIX_ROLES),
        privileges=catalog_out(),
        matrix=flags_out(matrix),
        locked=locked_privileges(),
        can_edit=has_priv(user.role, Priv.SETTINGS_MANAGE),
    )


def _load(db) -> dict:
    return hydrate(getattr(get_settings(db), "privilege_matrix", "") or "")


@router.get("/privileges", response_model=PrivilegeMatrixOut)
def read_privileges(user: StaffUser, db: DbSession) -> PrivilegeMatrixOut:
    return _matrix_out(user, _load(db))


@router.patch("/privileges", response_model=PrivilegeMatrixOut)
def patch_privileges(payload: PrivilegeMatrixPatch, user: SettingsAdmin, db: DbSession) -> PrivilegeMatrixOut:
    applied = apply_flags(payload.matrix)
    row = get_settings(db)
    row.privilege_matrix = json.dumps(flags_out(applied))
    db.add(row)
    db.commit()
    set_runtime(applied)
    return _matrix_out(user, applied)
