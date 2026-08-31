import json
from enum import StrEnum

from app.models import UserRole


class Priv(StrEnum):
    STAFF_LOGIN = "staff.login"
    ORDERS_READ = "orders.read"
    ORDERS_UPDATE = "orders.update"
    ORDERS_COLLECT = "orders.collect"
    ORDERS_DELETE = "orders.delete"
    CATALOG_READ = "catalog.read"
    CATALOG_WRITE = "catalog.write"
    CATALOG_DELETE = "catalog.delete"
    PALETTE_WRITE = "palette.write"
    USERS_MANAGE = "users.manage"
    SETTINGS_MANAGE = "settings.manage"


STAFF_MATRIX_ROLES = (UserRole.support.value, UserRole.manager.value, UserRole.superadmin.value)

ADMIN_ONLY = frozenset({Priv.USERS_MANAGE, Priv.SETTINGS_MANAGE})

CATALOG: tuple[dict[str, str], ...] = (
    {"id": Priv.STAFF_LOGIN, "label": "Sign in to staff console", "group": "Login"},
    {"id": Priv.ORDERS_READ, "label": "View orders", "group": "Orders"},
    {"id": Priv.ORDERS_UPDATE, "label": "Update order status", "group": "Orders"},
    {"id": Priv.ORDERS_COLLECT, "label": "Collect cash on delivery", "group": "Orders"},
    {"id": Priv.ORDERS_DELETE, "label": "Delete closed orders", "group": "Orders"},
    {"id": Priv.CATALOG_READ, "label": "View shirts and stock", "group": "Catalog"},
    {"id": Priv.CATALOG_WRITE, "label": "Create and edit shirts", "group": "Catalog"},
    {"id": Priv.CATALOG_DELETE, "label": "Delete shirts", "group": "Catalog"},
    {"id": Priv.PALETTE_WRITE, "label": "Add palette colors", "group": "Catalog"},
    {"id": Priv.USERS_MANAGE, "label": "Manage people", "group": "Admin"},
    {"id": Priv.SETTINGS_MANAGE, "label": "Change store settings", "group": "Admin"},
)

SUPPORT: frozenset[Priv] = frozenset(
    {
        Priv.STAFF_LOGIN,
        Priv.ORDERS_READ,
        Priv.ORDERS_UPDATE,
        Priv.CATALOG_READ,
    }
)

MANAGER: frozenset[Priv] = SUPPORT | frozenset(
    {
        Priv.ORDERS_COLLECT,
        Priv.ORDERS_DELETE,
        Priv.CATALOG_WRITE,
        Priv.CATALOG_DELETE,
        Priv.PALETTE_WRITE,
    }
)

SUPERADMIN: frozenset[Priv] = frozenset(Priv)

MATRIX: dict[str, frozenset[Priv]] = {
    UserRole.support.value: SUPPORT,
    UserRole.manager.value: MANAGER,
    UserRole.superadmin.value: SUPERADMIN,
}

_runtime: dict[str, frozenset[Priv]] | None = None


def runtime_matrix() -> dict[str, frozenset[Priv]]:
    return _runtime if _runtime is not None else MATRIX


def set_runtime(matrix: dict[str, frozenset[Priv]] | None) -> None:
    global _runtime
    _runtime = matrix


def privileges_for(role: str) -> list[str]:
    return sorted(priv.value for priv in runtime_matrix().get(role, frozenset()))


def has_priv(role: str, *privs: Priv) -> bool:
    granted = runtime_matrix().get(role, frozenset())
    return all(priv in granted for priv in privs)


def catalog_out() -> list[dict[str, str]]:
    return [{"id": row["id"].value, "label": row["label"], "group": row["group"]} for row in CATALOG]


def locked_privileges() -> dict[str, list[str]]:
    admin = [priv.value for priv in ADMIN_ONLY]
    return {
        UserRole.support.value: admin,
        UserRole.manager.value: admin,
        UserRole.superadmin.value: [priv.value for priv in Priv],
    }


def flags_out(matrix: dict[str, frozenset[Priv]] | None = None) -> dict[str, dict[str, bool]]:
    source = matrix or runtime_matrix()
    return {
        role: {priv.value: priv in source.get(role, frozenset()) for priv in Priv} for role in STAFF_MATRIX_ROLES
    }


def apply_flags(flags: dict | None) -> dict[str, frozenset[Priv]]:
    incoming = flags or {}
    applied: dict[str, frozenset[Priv]] = {}
    for role in STAFF_MATRIX_ROLES:
        role_flags = incoming.get(role) or {}
        enabled: set[Priv] = set()
        for priv in Priv:
            default_on = priv in MATRIX[role]
            on = bool(role_flags.get(priv.value, default_on))
            if role == UserRole.superadmin.value:
                on = True
            if priv in ADMIN_ONLY and role != UserRole.superadmin.value:
                on = False
            if on:
                enabled.add(priv)
        applied[role] = frozenset(enabled)
    return applied


def hydrate(raw: str | None) -> dict[str, frozenset[Priv]]:
    if not raw or not str(raw).strip():
        applied = {role: granted for role, granted in MATRIX.items()}
        set_runtime(applied)
        return applied
    try:
        flags = json.loads(raw)
    except json.JSONDecodeError:
        applied = {role: granted for role, granted in MATRIX.items()}
        set_runtime(applied)
        return applied
    if not isinstance(flags, dict):
        applied = {role: granted for role, granted in MATRIX.items()}
        set_runtime(applied)
        return applied
    applied = apply_flags(flags)
    set_runtime(applied)
    return applied
