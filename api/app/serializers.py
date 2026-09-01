from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import ColorPalette, Order, Product, ProductImage, StoreSettings, User, Variant
from app.money import as_money, money_str
from app.privileges import privileges_for
from app.schemas import (
    CartItemOut,
    CartOut,
    ColorOut,
    CustomerBrief,
    DeliveryAddressOut,
    ImageOut,
    OrderEventOut,
    OrderItemOut,
    OrderNoteOut,
    OrderOut,
    ProductListItem,
    ProductOut,
    StockColorQty,
    StockItemOut,
    UserOut,
    VariantOut,
    ZoneOut,
)


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        privileges=privileges_for(user.role),
    )


def get_settings(db: Session) -> StoreSettings:
    row = db.get(StoreSettings, 1)
    if row is None:
        row = StoreSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def currency(db: Session) -> str:
    return get_settings(db).currency


def variant_price(variant: Variant) -> Decimal:
    if variant.price is not None:
        return as_money(variant.price)
    return as_money(variant.product.base_price)


def color_out(color: ColorPalette, in_use: bool = False) -> ColorOut:
    return ColorOut(id=color.id, name=color.name, hex=color.hex, sort_order=color.sort_order, in_use=in_use)


def image_out(image: ProductImage) -> ImageOut:
    return ImageOut(
        id=image.id,
        url=image.url,
        alt_text=image.alt_text,
        sort_order=image.sort_order,
        is_primary=image.is_primary,
        color_id=image.color_id,
    )


def primary_image(product: Product) -> ProductImage | None:
    images = sorted(product.images, key=lambda img: (not img.is_primary, img.sort_order))
    return images[0] if images else None


def product_colors(product: Product) -> list[ColorPalette]:
    return [link.color for link in product.color_links if link.color]


def product_sizes(product: Product) -> list[str]:
    order = ["XS", "S", "M", "L", "XL", "XXL"]
    sizes = [link.size for link in product.size_links]
    return sorted(sizes, key=lambda size: order.index(size) if size in order else 99)


def variant_out(variant: Variant, db: Session | None = None) -> VariantOut:
    price = variant_price(variant)
    return VariantOut(
        id=variant.id,
        sku=variant.sku,
        color=color_out(variant.color),
        size=variant.size,
        stock=variant.stock,
        price=money_str(price),
    )


def product_list_item(product: Product, db: Session) -> ProductListItem:
    image = primary_image(product)
    total_units = sum(int(variant.stock or 0) for variant in product.variants)
    return ProductListItem(
        id=product.id,
        slug=product.slug,
        name=product.name,
        base_price=money_str(product.base_price),
        cost_price=money_str(getattr(product, "cost_price", 0) or 0),
        currency=currency(db),
        is_published=product.is_published,
        primary_image=image_out(image) if image else None,
        colors=[color_out(color) for color in product_colors(product)],
        sizes=product_sizes(product),
        total_units=total_units,
    )


def product_out(product: Product, db: Session) -> ProductOut:
    variants = sorted(product.variants, key=lambda v: (v.color.name, v.size))
    return ProductOut(
        id=product.id,
        slug=product.slug,
        name=product.name,
        description=product.description,
        base_price=money_str(product.base_price),
        cost_price=money_str(getattr(product, "cost_price", 0) or 0),
        currency=currency(db),
        is_published=product.is_published,
        colors=[color_out(color) for color in product_colors(product)],
        sizes=product_sizes(product),
        images=[image_out(image) for image in sorted(product.images, key=lambda i: i.sort_order)],
        variants=[variant_out(variant) for variant in variants],
    )


def stock_label(total_units: int, threshold: int) -> str:
    if total_units <= 0:
        return "out_of_stock"
    if total_units <= threshold:
        return "low_stock"
    return "in_stock"


def stock_item_out(product: Product, db: Session, threshold: int) -> StockItemOut:
    image = primary_image(product)
    color_units: dict[UUID, int] = {}
    for variant in product.variants:
        color_units[variant.color_id] = color_units.get(variant.color_id, 0) + int(variant.stock or 0)
    total_units = sum(color_units.values())
    colors = product_colors(product)
    return StockItemOut(
        id=product.id,
        slug=product.slug,
        name=product.name,
        cost_price=money_str(getattr(product, "cost_price", 0) or 0),
        selling_price=money_str(product.base_price),
        currency=currency(db),
        total_units=total_units,
        label=stock_label(total_units, threshold),
        is_published=product.is_published,
        primary_image=image_out(image) if image else None,
        colors=[color_out(color) for color in colors],
        color_stocks=[
            StockColorQty(id=color.id, name=color.name, hex=color.hex, units=color_units.get(color.id, 0))
            for color in colors
        ],
    )


def image_for_variant(product: Product, color_id: UUID | None) -> str:
    tagged = [img for img in product.images if color_id and img.color_id == color_id]
    if tagged:
        tagged.sort(key=lambda img: (not img.is_primary, img.sort_order))
        return tagged[0].url
    image = primary_image(product)
    return image.url if image else ""


def cart_item_out(item, db: Session) -> CartItemOut:
    variant = item.variant
    product = variant.product
    return CartItemOut(
        id=item.id,
        product_id=product.id,
        variant_id=variant.id,
        quantity=item.quantity,
        unit_price=money_str(item.unit_price),
        product_name=product.name,
        color_name=variant.color.name,
        color_hex=variant.color.hex,
        size=variant.size,
        image_url=image_for_variant(product, variant.color_id),
        slug=product.slug,
    )


def cart_out(items, db: Session) -> CartOut:
    mapped = [cart_item_out(item, db) for item in items]
    subtotal = sum((as_money(row.unit_price) * row.quantity for row in items), start=as_money(0))
    return CartOut(items=mapped, subtotal=money_str(subtotal), currency=currency(db))


PURGE_STATUSES = {"delivered", "cancelled"}
PURGE_AFTER = timedelta(days=2)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def order_purge_at(order: Order) -> datetime | None:
    if order.status not in PURGE_STATUSES:
        return None
    when = None
    for event in order.events or []:
        if event.to_status == order.status:
            created = _aware(event.created_at)
            if created is not None and (when is None or created > when):
                when = created
    when = when or _aware(order.updated_at) or _aware(order.created_at)
    return when + PURGE_AFTER if when else None


def can_purge_order(order: Order) -> bool:
    after = order_purge_at(order)
    return bool(after and datetime.now(timezone.utc) >= after)


def order_out(order: Order, include_staff: bool = False) -> OrderOut:
    notes: list[OrderNoteOut] = []
    events: list[OrderEventOut] = []
    if include_staff:
        notes = [
            OrderNoteOut(
                id=note.id,
                body=note.body,
                author_name=note.author.full_name if note.author else "",
                created_at=note.created_at,
            )
            for note in sorted(order.notes, key=lambda n: n.created_at)
        ]
        events = [
            OrderEventOut(
                id=event.id,
                from_status=event.from_status,
                to_status=event.to_status,
                note=event.note,
                created_at=event.created_at,
            )
            for event in sorted(order.events, key=lambda e: e.created_at)
        ]

    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
        subtotal=money_str(order.subtotal),
        delivery_fee=money_str(order.delivery_fee),
        total=money_str(order.total),
        currency=order.currency,
        customer=CustomerBrief(
            id=order.customer.id,
            full_name=order.customer.full_name,
            phone=order.customer.phone,
            email=order.customer.email,
        ),
        delivery_address=DeliveryAddressOut(
            label=order.address_label,
            line1=order.address_line1,
            line2=order.address_line2,
            city=order.address_city,
            region=order.address_region,
            notes=order.address_notes,
        ),
        delivery_zone=ZoneOut(
            id=order.delivery_zone_id,
            name=order.zone_name,
            fee=money_str(order.delivery_fee),
            is_active=True,
        ),
        items=[
            OrderItemOut(
                id=item.id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                product_name=item.product_name,
                color_name=item.color_name,
                color_hex=item.color_hex,
                size=item.size,
                sku=item.sku,
                quantity=item.quantity,
                unit_price=money_str(item.unit_price),
                image_url=item.image_url,
            )
            for item in order.items
        ],
        notes=notes,
        events=events,
        customer_note=order.customer_note,
        created_at=order.created_at,
        updated_at=order.updated_at,
        can_delete=can_purge_order(order) if include_staff else False,
        deletable_after=order_purge_at(order) if include_staff else None,
    )


def page(items: list, page_num: int, page_size: int, total: int) -> dict:
    return {"items": items, "page": page_num, "page_size": page_size, "total": total}
