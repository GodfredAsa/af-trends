from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.deps import ManagerPlus, StaffUser, DbSession, Pagination
from app.models import Order, OrderEvent, OrderNote, OrderStatus, PaymentStatus, User, Variant
from app.order_machine import assert_transition, should_deduct, should_restore
from app.schemas import NoteIn, OrderOut, PaymentPatch, StatusPatch
from app.serializers import order_out

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


@router.get("/orders")
def list_orders(
    _user: StaffUser,
    db: DbSession,
    pagination: Pagination,
    status_filter: str | None = Query(default=None, alias="status"),
    payment_status: str | None = None,
    q: str | None = None,
):
    page_num, page_size = pagination
    stmt = _staff_query().order_by(Order.created_at.desc())
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if payment_status:
        stmt = stmt.where(Order.payment_status == payment_status)
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.join(Order.customer).where(
            or_(Order.order_number.ilike(term), User.full_name.ilike(term), User.phone.ilike(term), User.email.ilike(term))
        )
    rows = list(db.scalars(stmt).unique().all())
    total = len(rows)
    start = (page_num - 1) * page_size
    sliced = rows[start : start + page_size]
    return {
        "items": [order_out(order, include_staff=True) for order in sliced],
        "page": page_num,
        "page_size": page_size,
        "total": total,
    }


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: UUID, _user: StaffUser, db: DbSession) -> OrderOut:
    return order_out(_get(db, order_id), include_staff=True)


@router.patch("/orders/{order_id}/status", response_model=OrderOut)
def patch_status(order_id: UUID, payload: StatusPatch, user: StaffUser, db: DbSession) -> OrderOut:
    order = _get(db, order_id)
    nxt = payload.status
    assert_transition(user.role, order.status, nxt)
    if should_deduct(order.status, nxt):
        for item in order.items:
            variant = db.get(Variant, item.variant_id)
            if variant is None or variant.stock < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Not enough stock to confirm {item.product_name} ({item.color_name} / {item.size}).",
                )
            variant.stock -= item.quantity
            db.add(variant)
    if should_restore(order.status, nxt):
        for item in order.items:
            variant = db.get(Variant, item.variant_id)
            if variant is not None:
                variant.stock += item.quantity
                db.add(variant)
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
    return order_out(_get(db, order.id), include_staff=True)


@router.patch("/orders/{order_id}/payment", response_model=OrderOut)
def patch_payment(order_id: UUID, payload: PaymentPatch, _user: ManagerPlus, db: DbSession) -> OrderOut:
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
    return order_out(_get(db, order.id), include_staff=True)


@router.post("/orders/{order_id}/notes", response_model=OrderOut)
def add_note(order_id: UUID, payload: NoteIn, user: StaffUser, db: DbSession) -> OrderOut:
    order = _get(db, order_id)
    db.add(OrderNote(order_id=order.id, author_id=user.id, body=payload.body.strip()))
    db.commit()
    return order_out(_get(db, order.id), include_staff=True)
