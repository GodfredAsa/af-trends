from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.media import write_bytes
from app.models import (
    Address,
    ColorPalette,
    DeliveryZone,
    Product,
    ProductColor,
    ProductImage,
    ProductSize,
    StoreSettings,
    User,
    UserRole,
    Variant,
)
from app.security import hash_password

DEFAULT_COLORS = [
    ("White", "#FFFFFF", 1),
    ("Black", "#111111", 2),
    ("Dark Gray", "#4B4F54", 3),
    ("Navy", "#1B2A4A", 4),
    ("Red", "#B42318", 5),
    ("Olive", "#3F5C3A", 6),
]

ZONES = [
    ("Accra Metro", Decimal("20.00")),
    ("Tema", Decimal("25.00")),
    ("Kumasi", Decimal("35.00")),
    ("Other regions", Decimal("45.00")),
]


def _shirt_svg(fill: str, label: str, subtitle: str) -> bytes:
    safe_label = label.replace("&", "&amp;")
    safe_sub = subtitle.replace("&", "&amp;")
    ink = "#111213" if fill.upper() in {"#FFFFFF", "#F4F4F5"} else "#FFFFFF"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 800" width="640" height="800">
  <rect width="640" height="800" fill="#1A1C1E"/>
  <path d="M170 210 L230 180 L270 250 L370 250 L410 180 L470 210 L500 300 L450 330 L450 680 L190 680 L190 330 L140 300 Z" fill="{fill}" stroke="#111213" stroke-width="6"/>
  <path d="M270 250 Q320 290 370 250" fill="none" stroke="#111213" stroke-width="5"/>
  <text x="320" y="470" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="{ink}">{safe_label}</text>
  <text x="320" y="510" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" letter-spacing="4" fill="{ink}">{safe_sub}</text>
</svg>
""".encode("utf-8")


PRODUCTS = [
    {
        "name": "Kente Crest Tee",
        "slug": "kente-crest-tee",
        "description": "A heavyweight cotton tee with a crest drawn from kente geometry. Cut for a clean drape, printed on the chest.",
        "price": Decimal("120.00"),
        "colors": ["Black", "White", "Navy"],
        "sizes": ["S", "M", "L", "XL"],
        "stock": 12,
        "marks": [("KENTE", "CREST"), ("BACK", "PRINT")],
    },
    {
        "name": "Adinkra Wisdom Tee",
        "slug": "adinkra-wisdom-tee",
        "description": "Sankofa mark at the chest. Soft midweight cotton, made to be worn hard and washed often.",
        "price": Decimal("110.00"),
        "colors": ["Olive", "Black", "White"],
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "stock": 10,
        "marks": [("SANKOFA", "MARK"), ("ADINKRA", "LINE")],
    },
    {
        "name": "Accra Nights Tee",
        "slug": "accra-nights-tee",
        "description": "City lights as type. A night-shift shirt for evenings that start late and end later.",
        "price": Decimal("95.00"),
        "colors": ["Black", "Dark Gray", "Navy"],
        "sizes": ["XS", "S", "M", "L", "XL"],
        "stock": 14,
        "marks": [("ACCRA", "NIGHTS"), ("25° W", "CITY")],
    },
    {
        "name": "Sahara Line Tee",
        "slug": "sahara-line-tee",
        "description": "A single horizontal line across the chest. Quiet, long, and built for heat.",
        "price": Decimal("90.00"),
        "colors": ["White", "Olive", "Red"],
        "sizes": ["S", "M", "L", "XL"],
        "stock": 8,
        "marks": [("SAHARA", "LINE"), ("DRY", "SEASON")],
    },
    {
        "name": "Coastline Script Tee",
        "slug": "coastline-script-tee",
        "description": "Hand-lettered Gulf of Guinea script. Salt-air cotton, slightly cropped sleeves.",
        "price": Decimal("130.00"),
        "colors": ["Navy", "White", "Dark Gray"],
        "sizes": ["S", "M", "L", "XL"],
        "stock": 9,
        "marks": [("COAST", "LINE"), ("GULF", "SCRIPT")],
    },
    {
        "name": "Market Square Tee",
        "slug": "market-square-tee",
        "description": "Block type inspired by stall signage. Loud in the print, quiet in the cut.",
        "price": Decimal("100.00"),
        "colors": ["Red", "Black", "White"],
        "sizes": ["M", "L", "XL", "XXL"],
        "stock": 11,
        "marks": [("MARKET", "SQUARE"), ("STALL", "NO. 12")],
    },
]

PRODUCT_PHOTOS = {
    "kente-crest-tee": ["tee-print.jpg", "hang-1.jpg", "tee-white.jpg"],
    "adinkra-wisdom-tee": ["tee-white.jpg", "hang-2.jpg", "tee-fold.jpg"],
    "accra-nights-tee": ["tee-black.jpg", "hang-3.jpg", "lifestyle-3.jpg"],
    "sahara-line-tee": ["tee-fold.jpg", "hang-4.jpg", "tee-wear.jpg"],
    "coastline-script-tee": ["tee-wear.jpg", "hang-1.jpg", "rack.jpg"],
    "market-square-tee": ["hang-2.jpg", "hang-3.jpg", "tee-print.jpg"],
}


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(User).limit(1)):
        return

    password = hash_password(settings.seed_password)
    users = [
        User(
            email="superadmin@aftrends.com",
            full_name="Ama Boateng",
            phone="0240000001",
            role=UserRole.superadmin.value,
            password_hash=password,
        ),
        User(
            email="manager@aftrends.com",
            full_name="Kojo Mensah",
            phone="0240000002",
            role=UserRole.manager.value,
            password_hash=password,
        ),
        User(
            email="support@aftrends.com",
            full_name="Efua Owusu",
            phone="0240000003",
            role=UserRole.support.value,
            password_hash=password,
        ),
        User(
            email="client@aftrends.com",
            full_name="Nana Asare",
            phone="0240000004",
            role=UserRole.client.value,
            password_hash=password,
        ),
    ]
    db.add_all(users)
    db.flush()

    client = users[3]
    db.add(
        Address(
            user_id=client.id,
            label="Home",
            line1="12 Oxford Street",
            city="Accra",
            region="Greater Accra",
            notes="Blue gate",
            is_default=True,
        )
    )

    db.add(
        StoreSettings(
            id=1,
            store_name="AF Trends",
            support_email="support@aftrends.com",
            support_phone="0240000100",
            currency="GHS",
            cod_instructions="Please have the exact amount ready. Payment is collected on delivery.",
            low_stock_threshold=5,
        )
    )

    colors = []
    for name, hex_value, order in DEFAULT_COLORS:
        color = ColorPalette(name=name, hex=hex_value, sort_order=order)
        colors.append(color)
        db.add(color)
    db.flush()
    by_name = {color.name: color for color in colors}

    for name, fee in ZONES:
        db.add(DeliveryZone(name=name, fee=fee, is_active=True))

    for spec in PRODUCTS:
        product = Product(
            name=spec["name"],
            slug=spec["slug"],
            description=spec["description"],
            base_price=spec["price"],
            cost_price=spec["price"] * Decimal("0.55"),
            is_published=True,
        )
        db.add(product)
        db.flush()

        chosen = [by_name[name] for name in spec["colors"] if name in by_name]
        for color in chosen:
            db.add(ProductColor(product_id=product.id, color_id=color.id))
        for size in spec["sizes"]:
            db.add(ProductSize(product_id=product.id, size=size))
        db.flush()

        for color in chosen:
            for size in spec["sizes"]:
                prefix = "".join(part[0] for part in spec["slug"].split("-") if part)[:3].upper()
                sku = f"{prefix}-{color.name[:3].upper()}-{size}"
                db.add(
                    Variant(
                        product_id=product.id,
                        color_id=color.id,
                        size=size,
                        sku=sku,
                        stock=spec["stock"],
                    )
                )

        attached = 0
        for index, filename in enumerate(PRODUCT_PHOTOS.get(spec["slug"], [])):
            catalog_file = settings.media_path / "catalog" / filename
            if not catalog_file.exists():
                continue
            db.add(
                ProductImage(
                    product_id=product.id,
                    url=f"/media/catalog/{filename}",
                    alt_text=product.name,
                    sort_order=index,
                    is_primary=index == 0,
                    color_id=None,
                )
            )
            attached += 1
        if attached:
            continue

        for index, color in enumerate(chosen):
            mark = spec["marks"][0] if index == 0 else spec["marks"][min(1, len(spec["marks"]) - 1)]
            url = write_bytes(
                product.id,
                f"{color.name.lower().replace(' ', '-')}.svg",
                _shirt_svg(color.hex, mark[0], mark[1]),
            )
            db.add(
                ProductImage(
                    product_id=product.id,
                    url=url,
                    alt_text=f"{product.name} in {color.name}",
                    sort_order=index,
                    is_primary=index == 0,
                    color_id=color.id,
                )
            )
        extra = write_bytes(
            product.id,
            "flat-lay.svg",
            _shirt_svg("#2A2D31", spec["marks"][0][0], "FLAT LAY"),
        )
        db.add(
            ProductImage(
                product_id=product.id,
                url=extra,
                alt_text=f"{product.name} flat lay",
                sort_order=len(chosen),
                is_primary=False,
                color_id=None,
            )
        )

    db.commit()
