from datetime import datetime, timezone

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import ClientUser, DbSession, Pagination
from app.models import (
    Address,
    CartItem,
    DeliveryZone,
    Order,
    OrderEvent,
    OrderItem,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Product,
    Variant,
)
from app.money import as_money
from app.order_machine import assert_transition
from app.schemas import CheckoutIn, OrderOut
from app.serializers import image_for_variant, order_out

router = APIRouter()


def _order_query():
    return select(Order).options(
        selectinload(Order.customer),
        selectinload(Order.items),
        selectinload(Order.notes),
        selectinload(Order.events),
    )


def _next_order_number(db) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"AFT-{today}-"
    count = db.scalar(select(func.count()).select_from(Order).where(Order.order_number.like(f"{prefix}%"))) or 0
    return f"{prefix}{count + 1:04d}"


@router.post("/orders", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def checkout(payload: CheckoutIn, user: ClientUser, db: DbSession) -> OrderOut:
    items = db.scalars(
        select(CartItem)
        .where(CartItem.user_id == user.id)
        .options(
            selectinload(CartItem.variant).selectinload(Variant.color),
            selectinload(CartItem.variant).selectinload(Variant.product).selectinload(Product.images),
        )
    ).all()
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your cart is empty.")

    address = db.get(Address, payload.address_id)
    if address is None or address.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found.")
    zone = db.get(DeliveryZone, payload.delivery_zone_id)
    if zone is None or not zone.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery zone not found.")

    for item in items:
        if item.quantity > item.variant.stock or not item.variant.product.is_published:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{item.variant.product.name} in {item.variant.color.name} / {item.variant.size} is no longer available.",
            )

    subtotal = sum((as_money(item.unit_price) * item.quantity for item in items), start=as_money(0))
    fee = as_money(zone.fee)
    order = Order(
        order_number=_next_order_number(db),
        customer_id=user.id,
        status=OrderStatus.pending.value,
        payment_method=PaymentMethod.cash_on_delivery.value,
        payment_status=PaymentStatus.unpaid.value,
        subtotal=subtotal,
        delivery_fee=fee,
        total=subtotal + fee,
        currency="GHS",
        customer_note=payload.customer_note.strip(),
        delivery_zone_id=zone.id,
        zone_name=zone.name,
        address_label=address.label,
        address_line1=address.line1,
        address_line2=address.line2,
        address_city=address.city,
        address_region=address.region,
        address_notes=address.notes,
    )
    db.add(order)
    db.flush()
    for item in items:
        variant = item.variant
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=variant.product_id,
                variant_id=variant.id,
                product_name=variant.product.name,
                color_name=variant.color.name,
                color_hex=variant.color.hex,
                size=variant.size,
                sku=variant.sku,
                quantity=item.quantity,
                unit_price=item.unit_price,
                image_url=image_for_variant(variant.product, variant.color_id),
            )
        )
        db.delete(item)
    db.add(
        OrderEvent(
            order_id=order.id,
            actor_id=user.id,
            from_status="",
            to_status=OrderStatus.pending.value,
            note="Order placed. Payment due on delivery.",
        )
    )
    db.commit()
    order = db.scalar(_order_query().where(Order.id == order.id))
    return order_out(order, include_staff=False)


@router.get("/orders")
def list_orders(
    user: ClientUser,
    db: DbSession,
    pagination: Pagination,
    status_filter: str | None = Query(default=None, alias="status"),
):
    page_num, page_size = pagination
    stmt = _order_query().where(Order.customer_id == user.id).order_by(Order.created_at.desc())
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    rows = db.scalars(stmt).all()
    total = len(rows)
    start = (page_num - 1) * page_size
    sliced = rows[start : start + page_size]
    return {
        "items": [order_out(order) for order in sliced],
        "page": page_num,
        "page_size": page_size,
        "total": total,
    }


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: UUID, user: ClientUser, db: DbSession) -> OrderOut:
    order = db.scalar(_order_query().where(Order.id == order_id, Order.customer_id == user.id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    return order_out(order)


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel_order(order_id: UUID, user: ClientUser, db: DbSession) -> OrderOut:
    order = db.scalar(_order_query().where(Order.id == order_id, Order.customer_id == user.id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    assert_transition(user.role, order.status, OrderStatus.cancelled.value)
    db.add(
        OrderEvent(
            order_id=order.id,
            actor_id=user.id,
            from_status=order.status,
            to_status=OrderStatus.cancelled.value,
            note="Cancelled by customer.",
        )
    )
    order.status = OrderStatus.cancelled.value
    db.add(order)
    db.commit()
    db.refresh(order)
    return order_out(order)
