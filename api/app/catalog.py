from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.media import slugify
from app.models import ColorPalette, Product, ProductColor, ProductSize, SIZES, Variant


def ensure_colors(db: Session, product: Product, color_ids: list[UUID]) -> None:
    wanted = list(dict.fromkeys(color_ids))
    existing = {link.color_id: link for link in product.color_links}
    for color_id in wanted:
        color = db.get(ColorPalette, color_id)
        if color is None:
            raise ValueError("Unknown color.")
        if color_id not in existing:
            product.color_links.append(ProductColor(color_id=color_id))
    for color_id, link in list(existing.items()):
        if color_id not in wanted:
            db.delete(link)


def ensure_sizes(product: Product, sizes: list[str]) -> None:
    wanted = []
    for size in sizes:
        size = size.upper()
        if size not in SIZES:
            raise ValueError(f"Invalid size {size}.")
        if size not in wanted:
            wanted.append(size)
    existing = {link.size: link for link in product.size_links}
    for size in wanted:
        if size not in existing:
            product.size_links.append(ProductSize(size=size))
    for size, link in list(existing.items()):
        if size not in wanted:
            from sqlalchemy.orm import object_session

            session = object_session(product)
            if session:
                session.delete(link)


def sku_for(product: Product, color: ColorPalette, size: str) -> str:
    prefix = "".join(part[0] for part in slugify(product.name).split("-") if part)[:3].upper() or "AFT"
    color_code = color.name[:3].upper()
    return f"{prefix}-{color_code}-{size}"


def ensure_variant_grid(db: Session, product: Product, stock_map: dict[tuple[UUID, str], int] | None = None) -> None:
    db.flush()
    color_ids = [link.color_id for link in product.color_links]
    sizes = [link.size for link in product.size_links]
    existing = {(v.color_id, v.size): v for v in product.variants}
    wanted = {(color_id, size) for color_id in color_ids for size in sizes}

    used_skus = {v.sku for v in db.scalars(select(Variant)).all()}

    for key in wanted:
        if key not in existing:
            color = db.get(ColorPalette, key[0])
            sku = sku_for(product, color, key[1])
            base = sku
            n = 2
            while sku in used_skus:
                sku = f"{base}-{n}"
                n += 1
            used_skus.add(sku)
            stock = 0
            if stock_map is not None:
                stock = stock_map.get(key, 0)
            variant = Variant(
                product_id=product.id,
                color_id=key[0],
                size=key[1],
                sku=sku,
                stock=stock,
            )
            product.variants.append(variant)

    for key, variant in existing.items():
        if key not in wanted:
            db.delete(variant)
