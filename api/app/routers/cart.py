from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.cart_hold import (
    hold_until,
    release_expired_carts,
    resolve_owner,
    restore_cart_line,
    take_stock,
    give_stock,
)
from app.deps import DbSession, OptionalUser
from app.models import CartItem, Product, Variant
from app.schemas import CartItemIn, CartItemPatch, CartOut
from app.serializers import cart_out, variant_price

router = APIRouter()

CartKey = Annotated[str | None, Header(alias="X-Cart-Key")]


def _load_cart(db, owner_key: str):
    return db.scalars(
        select(CartItem)
        .where(CartItem.owner_key == owner_key)
        .options(
            selectinload(CartItem.variant).selectinload(Variant.color),
            selectinload(CartItem.variant).selectinload(Variant.product).selectinload(Product.images),
        )
    ).all()


def _require_owner(user, cart_key: str | None):
    owner = resolve_owner(user, cart_key)
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add items as a guest or sign in to use the cart.",
        )
    return owner


@router.get("/cart", response_model=CartOut)
def get_cart(db: DbSession, user: OptionalUser, x_cart_key: CartKey = None) -> CartOut:
    release_expired_carts(db)
    owner = resolve_owner(user, x_cart_key)
    if owner is None:
        db.commit()
        return cart_out([], db)
    db.commit()
    return cart_out(_load_cart(db, owner.owner_key), db)


@router.post("/cart/items", response_model=CartOut)
def add_item(payload: CartItemIn, db: DbSession, user: OptionalUser, x_cart_key: CartKey = None) -> CartOut:
    release_expired_carts(db)
    owner = _require_owner(user, x_cart_key)
    variant = db.get(Variant, payload.variant_id)
    if variant is None or variant.product.deleted_at or not variant.product.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That shirt is not available.")
    existing = db.scalar(
        select(CartItem).where(CartItem.owner_key == owner.owner_key, CartItem.variant_id == variant.id)
    )
    take_stock(db, variant, payload.quantity)
    if existing:
        existing.quantity += payload.quantity
        existing.unit_price = variant_price(variant)
        existing.expires_at = hold_until()
        existing.holds_stock = True
        db.add(existing)
    else:
        db.add(
            CartItem(
                owner_key=owner.owner_key,
                user_id=owner.user_id,
                guest_key=owner.guest_key,
                variant_id=variant.id,
                quantity=payload.quantity,
                unit_price=variant_price(variant),
                expires_at=hold_until(),
                holds_stock=True,
            )
        )
    db.commit()
    return cart_out(_load_cart(db, owner.owner_key), db)


@router.patch("/cart/items/{item_id}", response_model=CartOut)
def update_item(
    item_id: UUID,
    payload: CartItemPatch,
    db: DbSession,
    user: OptionalUser,
    x_cart_key: CartKey = None,
) -> CartOut:
    release_expired_carts(db)
    owner = _require_owner(user, x_cart_key)
    item = db.get(CartItem, item_id)
    if item is None or item.owner_key != owner.owner_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found.")
    delta = payload.quantity - item.quantity
    if delta > 0:
        take_stock(db, item.variant, delta)
    elif delta < 0:
        give_stock(db, item.variant, -delta)
    item.quantity = payload.quantity
    item.unit_price = variant_price(item.variant)
    item.expires_at = hold_until()
    item.holds_stock = True
    db.add(item)
    db.commit()
    return cart_out(_load_cart(db, owner.owner_key), db)


@router.delete("/cart/items/{item_id}", response_model=CartOut)
def delete_item(item_id: UUID, db: DbSession, user: OptionalUser, x_cart_key: CartKey = None) -> CartOut:
    release_expired_carts(db)
    owner = _require_owner(user, x_cart_key)
    item = db.get(CartItem, item_id)
    if item is None or item.owner_key != owner.owner_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found.")
    restore_cart_line(db, item)
    db.delete(item)
    db.commit()
    return cart_out(_load_cart(db, owner.owner_key), db)


@router.delete("/cart", response_model=CartOut)
def clear_cart(db: DbSession, user: OptionalUser, x_cart_key: CartKey = None) -> CartOut:
    release_expired_carts(db)
    owner = _require_owner(user, x_cart_key)
    for item in db.scalars(select(CartItem).where(CartItem.owner_key == owner.owner_key)).all():
        restore_cart_line(db, item)
        db.delete(item)
    db.commit()
    return cart_out([], db)
