import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import CartItem, User, UserRole, Variant, utcnow

CART_HOLD_HOURS = 4
_CART_KEY_RE = re.compile(r"^[0-9a-fA-F-]{8,64}$")


@dataclass(frozen=True)
class CartOwner:
    owner_key: str
    user_id: UUID | None
    guest_key: str | None


def hold_until() -> datetime:
    return utcnow() + timedelta(hours=CART_HOLD_HOURS)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def normalize_cart_key(raw: str | None) -> str | None:
    if raw is None:
        return None
    key = raw.strip()
    if not key:
        return None
    if not _CART_KEY_RE.fullmatch(key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cart key.")
    return key


def resolve_owner(user: User | None, cart_key: str | None) -> CartOwner | None:
    if user is not None and user.role == UserRole.client.value:
        return CartOwner(owner_key=f"user:{user.id}", user_id=user.id, guest_key=None)
    key = normalize_cart_key(cart_key)
    if key:
        return CartOwner(owner_key=f"guest:{key}", user_id=None, guest_key=key)
    return None


def release_expired_carts(db: Session) -> None:
    now = utcnow()
    rows = db.scalars(
        select(CartItem)
        .where(CartItem.holds_stock.is_(True), CartItem.expires_at.is_not(None))
        .options(selectinload(CartItem.variant))
    ).all()
    released = False
    for item in rows:
        expires = as_utc(item.expires_at)
        if expires is None or expires > now:
            continue
        restore_cart_line(db, item)
        db.delete(item)
        released = True
    if released:
        db.commit()


def restore_cart_line(db: Session, item: CartItem) -> None:
    if not item.holds_stock:
        return
    variant = item.variant if item.variant is not None else db.get(Variant, item.variant_id)
    if variant is not None:
        variant.stock += item.quantity
        db.add(variant)
    item.holds_stock = False


def take_stock(db: Session, variant: Variant, quantity: int) -> None:
    if quantity <= 0:
        return
    if variant.stock < quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Not enough stock for that color and size.",
        )
    variant.stock -= quantity
    db.add(variant)


def give_stock(db: Session, variant: Variant, quantity: int) -> None:
    if quantity <= 0:
        return
    variant.stock += quantity
    db.add(variant)


def restore_order_items(db: Session, order) -> None:
    for item in order.items:
        variant = db.get(Variant, item.variant_id)
        if variant is not None:
            variant.stock += item.quantity
            db.add(variant)


def merge_guest_cart(db: Session, user: User, cart_key: str | None) -> None:
    if user.role != UserRole.client.value:
        return
    key = normalize_cart_key(cart_key)
    if not key:
        return
    release_expired_carts(db)
    guest_owner = f"guest:{key}"
    user_owner = f"user:{user.id}"
    guest_items = list(db.scalars(select(CartItem).where(CartItem.owner_key == guest_owner)).all())
    for item in guest_items:
        existing = db.scalar(
            select(CartItem).where(CartItem.owner_key == user_owner, CartItem.variant_id == item.variant_id)
        )
        if existing is None:
            item.owner_key = user_owner
            item.user_id = user.id
            item.guest_key = None
            item.expires_at = hold_until()
            db.add(item)
            continue
        existing.quantity += item.quantity
        existing.holds_stock = bool(existing.holds_stock or item.holds_stock)
        existing.expires_at = hold_until()
        item.holds_stock = False
        db.delete(item)
        db.add(existing)
    db.flush()
