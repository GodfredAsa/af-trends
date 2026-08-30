from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import ClientUser, DbSession
from app.models import CartItem, Product, Variant
from app.schemas import CartItemIn, CartItemPatch, CartOut
from app.serializers import cart_out, variant_price

router = APIRouter()


def _load_cart(db, user_id):
    return db.scalars(
        select(CartItem)
        .where(CartItem.user_id == user_id)
        .options(
            selectinload(CartItem.variant).selectinload(Variant.color),
            selectinload(CartItem.variant).selectinload(Variant.product).selectinload(Product.images),
        )
    ).all()


@router.get("/cart", response_model=CartOut)
def get_cart(user: ClientUser, db: DbSession) -> CartOut:
    return cart_out(_load_cart(db, user.id), db)


@router.post("/cart/items", response_model=CartOut)
def add_item(payload: CartItemIn, user: ClientUser, db: DbSession) -> CartOut:
    variant = db.get(Variant, payload.variant_id)
    if variant is None or variant.product.deleted_at or not variant.product.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That shirt is not available.")
    existing = db.scalar(
        select(CartItem).where(CartItem.user_id == user.id, CartItem.variant_id == variant.id)
    )
    quantity = payload.quantity + (existing.quantity if existing else 0)
    if quantity > variant.stock:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Not enough stock for that color and size.",
        )
    if existing:
        existing.quantity = quantity
        existing.unit_price = variant_price(variant)
        db.add(existing)
    else:
        db.add(
            CartItem(
                user_id=user.id,
                variant_id=variant.id,
                quantity=payload.quantity,
                unit_price=variant_price(variant),
            )
        )
    db.commit()
    return cart_out(_load_cart(db, user.id), db)


@router.patch("/cart/items/{item_id}", response_model=CartOut)
def update_item(item_id: UUID, payload: CartItemPatch, user: ClientUser, db: DbSession) -> CartOut:
    item = db.get(CartItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found.")
    if payload.quantity > item.variant.stock:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Not enough stock for that color and size.")
    item.quantity = payload.quantity
    item.unit_price = variant_price(item.variant)
    db.add(item)
    db.commit()
    return cart_out(_load_cart(db, user.id), db)


@router.delete("/cart/items/{item_id}", response_model=CartOut)
def delete_item(item_id: UUID, user: ClientUser, db: DbSession) -> CartOut:
    item = db.get(CartItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found.")
    db.delete(item)
    db.commit()
    return cart_out(_load_cart(db, user.id), db)


@router.delete("/cart", response_model=CartOut)
def clear_cart(user: ClientUser, db: DbSession) -> CartOut:
    for item in db.scalars(select(CartItem).where(CartItem.user_id == user.id)).all():
        db.delete(item)
    db.commit()
    return cart_out([], db)
