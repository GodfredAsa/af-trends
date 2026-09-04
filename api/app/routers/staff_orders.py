from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.cart_hold import restore_order_items, take_stock
from app.deps import OrderCollector, OrderDeleter, StaffUser, DbSession, Pagination
from app.models import STOCK_RESERVED_STATUSES, Order, OrderEvent, OrderNote, OrderStatus, PaymentStatus, User, UserRole, Variant
from app.order_machine import assert_transition, should_deduct, should_restore
from app.schemas import NoteIn, OrderOut, PaymentPatch, StatusPatch
from app.serializers import can_purge_order, order_out, order_purge_at

router = APIRouter()


def _staff_query():
    return select(Order).options(
        selectinload(Order.customer),
        selectinload(Order.items),
        selectinload(Order.notes).selectinload(OrderNote.author),
        selectinload(Order.events),
    )


def _get(db, order_id) -> Order:
    order = db.scalar(_staff_query().where(Order.id == order_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    return order


def _apply_search(stmt, q: str | None, payment_status: str | None):
    if payment_status:
        stmt = stmt.where(Order.payment_status == payment_status)
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.join(Order.customer).where(
            or_(Order.order_number.ilike(term), User.full_name.ilike(term), User.phone.ilike(term), User.email.ilike(term))
        )
    return stmt


def _tab_counts(db, q: str | None, payment_status: str | None) -> dict[str, int]:
    stmt = _apply_search(select(Order.status, func.count(Order.id)), q, payment_status).group_by(Order.status)
    by_status = {status: count for status, count in db.execute(stmt).all()}
    counts = {status.value: int(by_status.get(status.value, 0)) for status in OrderStatus}
    counts[""] = sum(counts.values())
    return counts


def _restore_if_held(db, order: Order) -> None:
    if order.status in {OrderStatus.delivered.value, OrderStatus.cancelled.value}:
        return
    held = bool(getattr(order, "stock_held", False))
    reserved = order.status in {item.value for item in STOCK_RESERVED_STATUSES}
    if held or reserved:
        restore_order_items(db, order)
        order.stock_held = False


@router.get("/orders")
def list_orders(
    user: StaffUser,
    db: DbSession,
    pagination: Pagination,
    status_filter: str | None = Query(default=None, alias="status"),
    payment_status: str | None = None,
    q: str | None = None,
):
    page_num, page_size = pagination
    stmt = _apply_search(_staff_query(), q, payment_status).order_by(Order.created_at.desc())
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    rows = list(db.scalars(stmt).unique().all())
    total = len(rows)
    start = (page_num - 1) * page_size
    sliced = rows[start : start + page_size]
    return {
        "items": [order_out(order, include_staff=True, actor=user) for order in sliced],
        "page": page_num,
        "page_size": page_size,
        "total": total,
        "counts": _tab_counts(db, q, payment_status),
    }


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: UUID, user: StaffUser, db: DbSession) -> OrderOut:
    return order_out(_get(db, order_id), include_staff=True, actor=user)


@router.patch("/orders/{order_id}/status", response_model=OrderOut)
def patch_status(order_id: UUID, payload: StatusPatch, user: StaffUser, db: DbSession) -> OrderOut:
    order = _get(db, order_id)
    nxt = payload.status
    assert_transition(user.role, order.status, nxt)
    held = bool(getattr(order, "stock_held", False))
    if should_deduct(order.status, nxt, held):
        for item in order.items:
            variant = db.get(Variant, item.variant_id)
            if variant is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Not enough stock to confirm {item.product_name} ({item.color_name} / {item.size}).",
                )
            take_stock(db, variant, item.quantity)
        order.stock_held = True
    if should_restore(order.status, nxt, held):
        restore_order_items(db, order)
        order.stock_held = False
    db.add(
        OrderEvent(
            order_id=order.id,
            actor_id=user.id,
            from_status=order.status,
            to_status=nxt,
            note=payload.note.strip(),
        )
    )
    order.status = nxt
    db.add(order)
    db.commit()
    return order_out(_get(db, order.id), include_staff=True, actor=user)


@router.patch("/orders/{order_id}/payment", response_model=OrderOut)
def patch_payment(order_id: UUID, payload: PaymentPatch, _user: OrderCollector, db: DbSession) -> OrderOut:
    order = _get(db, order_id)
    if order.status != OrderStatus.delivered.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mark the order delivered before recording cash on delivery.",
        )
    order.payment_status = PaymentStatus.paid.value
    db.add(order)
    db.add(
        OrderEvent(
            order_id=order.id,
            actor_id=_user.id,
            from_status=order.status,
            to_status=order.status,
            note="Cash collected on delivery.",
        )
    )
    db.commit()
    return order_out(_get(db, order.id), include_staff=True, actor=_user)


@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: UUID, user: OrderDeleter, db: DbSession) -> None:
    order = _get(db, order_id)
    if user.role != UserRole.superadmin.value:
        if order.status not in {"delivered", "cancelled"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only delivered or cancelled orders can be deleted.",
            )
        if not can_purge_order(order):
            after = order_purge_at(order)
            when = after.isoformat() if after else "two days after completion"
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"This order can be deleted after {when}.",
            )
    _restore_if_held(db, order)
    db.delete(order)
    db.commit()


@router.post("/orders/{order_id}/notes", response_model=OrderOut)
def add_note(order_id: UUID, payload: NoteIn, user: StaffUser, db: DbSession) -> OrderOut:
    order = _get(db, order_id)
    db.add(OrderNote(order_id=order.id, author_id=user.id, body=payload.body.strip()))
    db.commit()
    return order_out(_get(db, order.id), include_staff=True, actor=user)
