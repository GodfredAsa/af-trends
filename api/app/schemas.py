from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def _money(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return f"{Decimal(value):.2f}"


class UserOut(OrmModel):
    id: UUID
    email: EmailStr
    full_name: str
    phone: str
    role: str
    is_active: bool = True
    created_at: datetime | None = None
    privileges: list[str] = Field(default_factory=list)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=160)
    phone: str = Field(min_length=7, max_length=32)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    phone: str | None = Field(default=None, min_length=7, max_length=32)
    password: str | None = Field(default=None, min_length=8)


class ColorOut(OrmModel):
    id: UUID
    name: str
    hex: str
    sort_order: int = 0
    in_use: bool = False


class ColorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    hex: str = Field(min_length=4, max_length=7)


class ColorPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    hex: str | None = Field(default=None, min_length=4, max_length=7)


class SizeListOut(BaseModel):
    items: list[str]


class ImageOut(OrmModel):
    id: UUID
    url: str
    alt_text: str
    sort_order: int
    is_primary: bool
    color_id: UUID | None = None


class ImagePatch(BaseModel):
    alt_text: str | None = None
    sort_order: int | None = None
    is_primary: bool | None = None
    color_id: UUID | None = None


class VariantIn(BaseModel):
    color_id: UUID
    size: str
    stock: int = Field(ge=0)
    sku: str | None = None
    price: Decimal | None = None


class VariantStockIn(BaseModel):
    id: UUID
    stock: int = Field(ge=0)
    sku: str | None = None
    price: Decimal | None = None


class VariantStockPut(BaseModel):
    variants: list[VariantStockIn]


class VariantOut(OrmModel):
    id: UUID
    sku: str
    color: ColorOut
    size: str
    stock: int
    price: str

    @field_serializer("price")
    def serialize_price(self, value: Any) -> str:
        if isinstance(value, str):
            return value
        return _money(value) or "0.00"


class ProductListItem(BaseModel):
    id: UUID
    slug: str
    name: str
    base_price: str
    cost_price: str = "0.00"
    currency: str = "GHS"
    is_published: bool = True
    primary_image: ImageOut | None = None
    colors: list[ColorOut]
    sizes: list[str] = []
    total_units: int = 0


class ProductOut(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str
    base_price: str
    cost_price: str = "0.00"
    currency: str = "GHS"
    is_published: bool
    colors: list[ColorOut]
    sizes: list[str]
    images: list[ImageOut]
    variants: list[VariantOut]


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str | None = Field(default=None, max_length=160)
    description: str = ""
    base_price: Decimal = Field(gt=0)
    cost_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    color_ids: list[UUID] = Field(min_length=1)
    sizes: list[str] = Field(min_length=1)
    variants: list[VariantIn] | None = None
    is_published: bool = False


class ProductPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    slug: str | None = Field(default=None, max_length=160)
    description: str | None = None
    base_price: Decimal | None = Field(default=None, gt=0)
    cost_price: Decimal | None = Field(default=None, ge=0)
    color_ids: list[UUID] | None = None
    sizes: list[str] | None = None
    is_published: bool | None = None


class StockColorQty(BaseModel):
    id: UUID
    name: str
    hex: str
    units: int


class StockItemOut(BaseModel):
    id: UUID
    slug: str
    name: str
    cost_price: str
    selling_price: str
    currency: str = "GHS"
    total_units: int
    label: str
    is_published: bool
    primary_image: ImageOut | None = None
    colors: list[ColorOut]
    color_stocks: list[StockColorQty]


class StockCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    cost_price: Decimal = Field(ge=0)
    selling_price: Decimal = Field(gt=0)
    color_ids: list[UUID] = Field(min_length=1)
    sizes: list[str] = Field(min_length=1)
    variants: list[VariantIn]
    is_published: bool = False


class Page(BaseModel):
    items: list[Any]
    page: int
    page_size: int
    total: int


class AddressIn(BaseModel):
    label: str = Field(default="Home", max_length=64)
    line1: str = Field(min_length=1, max_length=255)
    line2: str = ""
    city: str = Field(min_length=1, max_length=128)
    region: str = Field(min_length=1, max_length=128)
    notes: str = ""
    is_default: bool = False


class AddressPatch(BaseModel):
    label: str | None = None
    line1: str | None = None
    line2: str | None = None
    city: str | None = None
    region: str | None = None
    notes: str | None = None
    is_default: bool | None = None


class AddressOut(OrmModel):
    id: UUID
    label: str
    line1: str
    line2: str
    city: str
    region: str
    notes: str
    is_default: bool


class ZoneOut(OrmModel):
    id: UUID
    name: str
    fee: str
    is_active: bool = True

    @field_serializer("fee")
    def serialize_fee(self, value: Any) -> str:
        if isinstance(value, str):
            return value
        return _money(value) or "0.00"


class ZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    fee: Decimal = Field(ge=0)
    is_active: bool = True


class ZonePatch(BaseModel):
    name: str | None = None
    fee: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None


class CartItemIn(BaseModel):
    variant_id: UUID
    quantity: int = Field(ge=1, le=20)


class CartItemPatch(BaseModel):
    quantity: int = Field(ge=1, le=20)


class CartItemOut(BaseModel):
    id: UUID
    product_id: UUID
    variant_id: UUID
    quantity: int
    unit_price: str
    product_name: str
    color_name: str
    color_hex: str = "#111111"
    size: str
    image_url: str
    slug: str = ""


class CartOut(BaseModel):
    items: list[CartItemOut]
    subtotal: str
    currency: str = "GHS"


class CheckoutIn(BaseModel):
    address_id: UUID
    delivery_zone_id: UUID
    customer_note: str = ""


class OrderItemOut(BaseModel):
    id: UUID
    product_id: UUID
    variant_id: UUID
    product_name: str
    color_name: str
    color_hex: str
    size: str
    sku: str
    quantity: int
    unit_price: str
    image_url: str


class CustomerBrief(BaseModel):
    id: UUID
    full_name: str
    phone: str
    email: EmailStr


class DeliveryAddressOut(BaseModel):
    label: str
    line1: str
    line2: str
    city: str
    region: str
    notes: str


class OrderNoteOut(OrmModel):
    id: UUID
    body: str
    author_name: str = ""
    created_at: datetime


class OrderEventOut(OrmModel):
    id: UUID
    from_status: str
    to_status: str
    note: str
    created_at: datetime


class OrderOut(BaseModel):
    id: UUID
    order_number: str
    status: str
    payment_method: str
    payment_status: str
    subtotal: str
    delivery_fee: str
    total: str
    currency: str
    customer: CustomerBrief
    delivery_address: DeliveryAddressOut
    delivery_zone: ZoneOut
    items: list[OrderItemOut]
    notes: list[OrderNoteOut] = []
    events: list[OrderEventOut] = []
    customer_note: str = ""
    created_at: datetime
    updated_at: datetime
    can_delete: bool = False
    deletable_after: datetime | None = None


class StatusPatch(BaseModel):
    status: str
    note: str = ""


class PaymentPatch(BaseModel):
    payment_status: Literal["paid"]


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class StaffUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=160)
    phone: str = Field(default="", max_length=32)
    role: Literal["manager", "support", "client"]


class StaffUserPatch(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    role: Literal["manager", "support"] | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)


class SettingsOut(BaseModel):
    store_name: str
    support_email: str
    support_phone: str
    currency: str
    cod_instructions: str
    low_stock_threshold: int


class SettingsPatch(BaseModel):
    store_name: str | None = None
    support_email: EmailStr | None = None
    support_phone: str | None = None
    currency: str | None = None
    cod_instructions: str | None = None
    low_stock_threshold: int | None = Field(default=None, ge=0)


class PrivilegeItem(BaseModel):
    id: str
    label: str
    group: str


class PrivilegeMatrixOut(BaseModel):
    roles: list[str]
    privileges: list[PrivilegeItem]
    matrix: dict[str, dict[str, bool]]
    locked: dict[str, list[str]]
    can_edit: bool


class PrivilegeMatrixPatch(BaseModel):
    matrix: dict[str, dict[str, bool]]
