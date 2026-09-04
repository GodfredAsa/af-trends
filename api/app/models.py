import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    manager = "manager"
    support = "support"
    client = "client"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    packed = "packed"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    failed_delivery = "failed_delivery"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    unpaid = "unpaid"
    paid = "paid"
    refunded = "refunded"


class PaymentMethod(str, enum.Enum):
    cash_on_delivery = "cash_on_delivery"


STAFF_ROLES = {UserRole.support, UserRole.manager, UserRole.superadmin}
CATALOG_READER_ROLES = STAFF_ROLES
CATALOG_EDITOR_ROLES = {UserRole.manager, UserRole.superadmin}
STOCK_RESERVED_STATUSES = {
    OrderStatus.confirmed,
    OrderStatus.packed,
    OrderStatus.out_for_delivery,
    OrderStatus.failed_delivery,
}

SIZES = ["XS", "S", "M", "L", "XL", "XXL"]


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(32), default="")
    role: Mapped[str] = mapped_column(String(32), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    addresses: Mapped[list["Address"]] = relationship(back_populates="user")
    cart_items: Mapped[list["CartItem"]] = relationship(back_populates="user")
    orders: Mapped[list["Order"]] = relationship(back_populates="customer", foreign_keys="Order.customer_id")


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    label: Mapped[str] = mapped_column(String(64), default="Home")
    line1: Mapped[str] = mapped_column(String(255))
    line2: Mapped[str] = mapped_column(String(255), default="")
    city: Mapped[str] = mapped_column(String(128))
    region: Mapped[str] = mapped_column(String(128))
    notes: Mapped[str] = mapped_column(String(255), default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="addresses")


class ColorPalette(Base):
    __tablename__ = "color_palette"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    hex: Mapped[str] = mapped_column(String(7))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class StoreSettings(Base):
    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    store_name: Mapped[str] = mapped_column(String(128), default="AF Trends")
    support_email: Mapped[str] = mapped_column(String(255), default="support@aftrends.com")
    support_phone: Mapped[str] = mapped_column(String(32), default="")
    currency: Mapped[str] = mapped_column(String(8), default="GHS")
    cod_instructions: Mapped[str] = mapped_column(
        Text,
        default="Please have the exact amount ready. Payment is collected on delivery.",
    )
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=5)
    privilege_matrix: Mapped[str] = mapped_column(Text, default="")


class DeliveryZone(Base):
    __tablename__ = "delivery_zones"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    fee: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_new_arrival: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.sort_order",
    )
    color_links: Mapped[list["ProductColor"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )
    size_links: Mapped[list["ProductSize"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )
    variants: Mapped[list["Variant"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )


class ProductColor(Base):
    __tablename__ = "product_colors"
    __table_args__ = (UniqueConstraint("product_id", "color_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), index=True)
    color_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("color_palette.id"), index=True)

    product: Mapped[Product] = relationship(back_populates="color_links")
    color: Mapped[ColorPalette] = relationship()


class ProductSize(Base):
    __tablename__ = "product_sizes"
    __table_args__ = (UniqueConstraint("product_id", "size"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), index=True)
    size: Mapped[str] = mapped_column(String(8))

    product: Mapped[Product] = relationship(back_populates="size_links")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), index=True)
    url: Mapped[str] = mapped_column(String(512))
    public_id: Mapped[str] = mapped_column(String(255), default="")
    alt_text: Mapped[str] = mapped_column(String(160), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    color_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("color_palette.id"), nullable=True)

    product: Mapped[Product] = relationship(back_populates="images")
    color: Mapped[ColorPalette | None] = relationship()


class Variant(Base):
    __tablename__ = "variants"
    __table_args__ = (UniqueConstraint("product_id", "color_id", "size"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), index=True)
    color_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("color_palette.id"), index=True)
    size: Mapped[str] = mapped_column(String(8))
    sku: Mapped[str] = mapped_column(String(64), unique=True)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    product: Mapped[Product] = relationship(back_populates="variants")
    color: Mapped[ColorPalette] = relationship()


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("owner_key", "variant_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    owner_key: Mapped[str] = mapped_column(String(80), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    guest_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    variant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("variants.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    holds_stock: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User | None] = relationship(back_populates="cart_items")
    variant: Mapped[Variant] = relationship()


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    order_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default=OrderStatus.pending.value, index=True)
    payment_method: Mapped[str] = mapped_column(String(32), default=PaymentMethod.cash_on_delivery.value)
    payment_status: Mapped[str] = mapped_column(String(32), default=PaymentStatus.unpaid.value)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    delivery_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(8), default="GHS")
    customer_note: Mapped[str] = mapped_column(Text, default="")
    delivery_zone_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("delivery_zones.id"), nullable=True)
    zone_name: Mapped[str] = mapped_column(String(128))
    address_label: Mapped[str] = mapped_column(String(64))
    address_line1: Mapped[str] = mapped_column(String(255))
    address_line2: Mapped[str] = mapped_column(String(255), default="")
    address_city: Mapped[str] = mapped_column(String(128))
    address_region: Mapped[str] = mapped_column(String(128))
    address_notes: Mapped[str] = mapped_column(String(255), default="")
    stock_held: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    customer: Mapped[User] = relationship(back_populates="orders", foreign_keys=[customer_id])
    delivery_zone: Mapped[DeliveryZone | None] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    notes: Mapped[list["OrderNote"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    events: Mapped[list["OrderEvent"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"))
    variant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("variants.id"))
    product_name: Mapped[str] = mapped_column(String(160))
    color_name: Mapped[str] = mapped_column(String(64))
    color_hex: Mapped[str] = mapped_column(String(7), default="#111111")
    size: Mapped[str] = mapped_column(String(8))
    sku: Mapped[str] = mapped_column(String(64))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    image_url: Mapped[str] = mapped_column(String(512), default="")

    order: Mapped[Order] = relationship(back_populates="items")
    variant: Mapped[Variant] = relationship()


class OrderNote(Base):
    __tablename__ = "order_notes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    order: Mapped[Order] = relationship(back_populates="notes")
    author: Mapped[User] = relationship()


class OrderEvent(Base):
    __tablename__ = "order_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    from_status: Mapped[str] = mapped_column(String(32), default="")
    to_status: Mapped[str] = mapped_column(String(32))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    order: Mapped[Order] = relationship(back_populates="events")
    actor: Mapped[User | None] = relationship()
