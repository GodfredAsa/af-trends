from fastapi import HTTPException, status

from app.models import OrderStatus, STOCK_RESERVED_STATUSES, UserRole

ALLOWED: dict[str, dict[str, set[str]]] = {
    UserRole.client.value: {
        OrderStatus.pending.value: {OrderStatus.cancelled.value},
    },
    UserRole.support.value: {
        OrderStatus.pending.value: {OrderStatus.cancelled.value},
        OrderStatus.packed.value: {OrderStatus.out_for_delivery.value},
        OrderStatus.out_for_delivery.value: {OrderStatus.failed_delivery.value},
    },
    UserRole.manager.value: {},
    UserRole.superadmin.value: {},
}

MANAGER_TRANSITIONS: dict[str, set[str]] = {
    OrderStatus.pending.value: {OrderStatus.confirmed.value, OrderStatus.cancelled.value},
    OrderStatus.confirmed.value: {OrderStatus.packed.value, OrderStatus.cancelled.value},
    OrderStatus.packed.value: {OrderStatus.out_for_delivery.value, OrderStatus.cancelled.value},
    OrderStatus.out_for_delivery.value: {
        OrderStatus.delivered.value,
        OrderStatus.failed_delivery.value,
        OrderStatus.cancelled.value,
    },
    OrderStatus.failed_delivery.value: {
        OrderStatus.out_for_delivery.value,
        OrderStatus.cancelled.value,
    },
}

ALLOWED[UserRole.manager.value] = MANAGER_TRANSITIONS
ALLOWED[UserRole.superadmin.value] = MANAGER_TRANSITIONS


def assert_transition(role: str, current: str, nxt: str) -> None:
    allowed = ALLOWED.get(role, {}).get(current, set())
    if nxt not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot move order from {current} to {nxt}.",
        )


def should_deduct(current: str, nxt: str, stock_held: bool = False) -> bool:
    if stock_held:
        return False
    return current == OrderStatus.pending.value and nxt == OrderStatus.confirmed.value


def should_restore(current: str, nxt: str, stock_held: bool = False) -> bool:
    if nxt != OrderStatus.cancelled.value:
        return False
    if stock_held:
        return True
    return current in {s.value for s in STOCK_RESERVED_STATUSES}
