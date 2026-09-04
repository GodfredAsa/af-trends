from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.catalog import ensure_colors, ensure_sizes, ensure_variant_grid
from app.deps import CatalogDeleter, CatalogEditor, CatalogReader, DbSession, Pagination, PaletteEditor, SuperadminUser
from app.media import MAX_FILES, destroy_upload, save_upload, slugify
from app.models import CartItem, ColorPalette, OrderItem, Product, ProductColor, ProductImage, ProductSize, SIZES, Variant
from app.schemas import ColorCreate, ColorOut, ColorPatch, ImagePatch, ProductCreate, ProductOut, ProductPatch, VariantStockPut
from app.serializers import color_out, page, product_list_item, product_out

router = APIRouter()


def _editor_query():
    return select(Product).where(Product.deleted_at.is_(None)).options(
        selectinload(Product.images),
        selectinload(Product.color_links).selectinload(ProductColor.color),
        selectinload(Product.size_links),
        selectinload(Product.variants).selectinload(Variant.color),
    )


def _get_product(db, product_id) -> Product:
    product = db.scalar(_editor_query().where(Product.id == product_id))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shirt not found.")
    return product


def _unique_slug(db: DbSession, slug: str, ignore_id=None) -> str:
    slug = slugify(slug)
    candidate = slug
    n = 2
    while True:
        stmt = select(Product).where(Product.slug == candidate, Product.deleted_at.is_(None))
        if ignore_id is not None:
            stmt = stmt.where(Product.id != ignore_id)
        if db.scalar(stmt) is None:
            return candidate
        candidate = f"{slug}-{n}"
        n += 1


@router.get("/products")
def list_products(
    _user: CatalogReader,
    db: DbSession,
    pagination: Pagination,
    q: str | None = None,
    is_published: bool | None = None,
):
    page_num, page_size = pagination
    stmt = _editor_query().order_by(Product.created_at.desc())
    if q:
        stmt = stmt.where(or_(Product.name.ilike(f"%{q.strip()}%"), Product.slug.ilike(f"%{q.strip()}%")))
    if is_published is not None:
        stmt = stmt.where(Product.is_published.is_(is_published))
    rows = db.scalars(stmt).all()
    total = len(rows)
    start = (page_num - 1) * page_size
    sliced = rows[start : start + page_size]
    return page([product_list_item(product, db) for product in sliced], page_num, page_size, total)


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, _user: CatalogEditor, db: DbSession) -> ProductOut:
    try:
        slug = _unique_slug(db, payload.slug or payload.name)
        product = Product(
            name=payload.name.strip(),
            slug=slug,
            description=payload.description.strip(),
            base_price=payload.base_price,
            cost_price=payload.cost_price,
            is_published=payload.is_published,
            is_new_arrival=payload.is_new_arrival,
        )
        db.add(product)
        db.flush()
        ensure_colors(db, product, payload.color_ids)
        ensure_sizes(product, payload.sizes)
        stock_map = None
        if payload.variants:
            stock_map = {(row.color_id, row.size.upper()): row.stock for row in payload.variants}
        ensure_variant_grid(db, product, stock_map)
        if payload.variants:
            by_key = {(v.color_id, v.size): v for v in product.variants}
            for row in payload.variants:
                variant = by_key.get((row.color_id, row.size.upper()))
                if variant is None:
                    continue
                if row.sku:
                    variant.sku = row.sku.strip()
                if row.price is not None:
                    variant.price = row.price
        db.commit()
        return product_out(_get_product(db, product.id), db)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: UUID, _user: CatalogReader, db: DbSession) -> ProductOut:
    return product_out(_get_product(db, product_id), db)


@router.patch("/products/{product_id}", response_model=ProductOut)
def patch_product(product_id: UUID, payload: ProductPatch, _user: CatalogEditor, db: DbSession) -> ProductOut:
    product = _get_product(db, product_id)
    if payload.name is not None:
        product.name = payload.name.strip()
    if payload.slug is not None:
        product.slug = _unique_slug(db, payload.slug, ignore_id=product.id)
    if payload.description is not None:
        product.description = payload.description
    if payload.base_price is not None:
        product.base_price = payload.base_price
    if payload.cost_price is not None:
        product.cost_price = payload.cost_price
    if payload.is_published is not None:
        if payload.is_published and not product.images:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload at least one image before publishing.",
            )
        product.is_published = payload.is_published
    if payload.is_new_arrival is not None:
        product.is_new_arrival = payload.is_new_arrival
    try:
        if payload.color_ids is not None:
            _assert_can_drop_variants(db, product, payload.color_ids, None)
            ensure_colors(db, product, payload.color_ids)
        if payload.sizes is not None:
            _assert_can_drop_variants(db, product, None, payload.sizes)
            ensure_sizes(product, payload.sizes)
        ensure_variant_grid(db, product)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.add(product)
    db.commit()
    return product_out(_get_product(db, product.id), db)


def _assert_can_drop_variants(db, product: Product, color_ids, sizes) -> None:
    keep_colors = set(color_ids) if color_ids is not None else {link.color_id for link in product.color_links}
    keep_sizes = {s.upper() for s in sizes} if sizes is not None else {link.size for link in product.size_links}
    dropping = [v for v in product.variants if v.color_id not in keep_colors or v.size not in keep_sizes]
    if not dropping:
        return
    ids = [v.id for v in dropping]
    used = db.scalar(
        select(OrderItem.id).where(OrderItem.variant_id.in_(ids)).limit(1)
    )
    if used:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That color or size is on an order. Set stock to 0 instead of removing it.",
        )


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: UUID, _user: CatalogDeleter, db: DbSession) -> None:
    product = _get_product(db, product_id)
    for image in list(product.images):
        destroy_upload(getattr(image, "public_id", "") or "")
    product.is_published = False
    product.deleted_at = datetime.now(timezone.utc)
    db.add(product)
    db.commit()


@router.post("/products/{product_id}/images", response_model=ProductOut)
def upload_images(
    product_id: UUID,
    _user: CatalogEditor,
    db: DbSession,
    files: list[UploadFile] = File(...),
    color_id: str = Form(...),
    alt_text: str = Form(default=""),
) -> ProductOut:
    product = _get_product(db, product_id)
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose at least one image.")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload 12 images or fewer per request.")
    if not color_id.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select a color for these photos.")
    try:
        parsed_color = UUID(color_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid color.") from exc
    product_color_ids = {link.color_id for link in product.color_links}
    if parsed_color not in product_color_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pick a color that belongs to this shirt.")
    start = max((image.sort_order for image in product.images), default=-1) + 1
    make_primary = len(product.images) == 0
    for index, upload in enumerate(files):
        url, public_id = save_upload(product.id, upload)
        product.images.append(
            ProductImage(
                url=url,
                public_id=public_id,
                alt_text=alt_text or upload.filename or product.name,
                sort_order=start + index,
                is_primary=make_primary and index == 0,
                color_id=parsed_color,
            )
        )
    db.add(product)
    db.commit()
    return product_out(_get_product(db, product.id), db)


@router.patch("/products/{product_id}/images/{image_id}", response_model=ProductOut)
def patch_image(product_id: UUID, image_id: UUID, payload: ImagePatch, _user: CatalogEditor, db: DbSession) -> ProductOut:
    product = _get_product(db, product_id)
    image = next((row for row in product.images if row.id == image_id), None)
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")
    if payload.alt_text is not None:
        image.alt_text = payload.alt_text
    if payload.sort_order is not None:
        image.sort_order = payload.sort_order
    if payload.color_id is not None or "color_id" in payload.model_fields_set:
        if payload.color_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Each photo needs a color.")
        product_color_ids = {link.color_id for link in product.color_links}
        if payload.color_id not in product_color_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pick a color that belongs to this shirt.")
        image.color_id = payload.color_id
    if payload.is_primary:
        for row in product.images:
            row.is_primary = row.id == image.id
    db.add(product)
    db.commit()
    return product_out(_get_product(db, product.id), db)


@router.delete("/products/{product_id}/images/{image_id}", response_model=ProductOut)
def delete_image(product_id: UUID, image_id: UUID, _user: CatalogEditor, db: DbSession) -> ProductOut:
    product = _get_product(db, product_id)
    image = next((row for row in product.images if row.id == image_id), None)
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")
    if product.is_published and len(product.images) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unpublish the shirt before removing the last image.",
        )
    was_primary = image.is_primary
    destroy_upload(getattr(image, "public_id", "") or "")
    db.delete(image)
    db.flush()
    if was_primary:
        remaining = sorted(product.images, key=lambda row: row.sort_order)
        if remaining:
            remaining[0].is_primary = True
    db.commit()
    return product_out(_get_product(db, product.id), db)


@router.put("/products/{product_id}/variants", response_model=ProductOut)
def put_variants(product_id: UUID, payload: VariantStockPut, _user: CatalogEditor, db: DbSession) -> ProductOut:
    product = _get_product(db, product_id)
    by_id = {variant.id: variant for variant in product.variants}
    for row in payload.variants:
        variant = by_id.get(row.id)
        if variant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found.")
        variant.stock = row.stock
        if row.sku:
            variant.sku = row.sku.strip()
        if row.price is not None:
            variant.price = row.price
    db.add(product)
    db.commit()
    return product_out(_get_product(db, product.id), db)


@router.get("/palette/colors")
def list_palette(_user: CatalogReader, db: DbSession):
    rows = db.scalars(select(ColorPalette).order_by(ColorPalette.sort_order, ColorPalette.name)).all()
    selected = set(db.scalars(select(ProductColor.color_id)).all())
    return {"items": [color_out(row, in_use=row.id in selected) for row in rows]}


def _normalize_hex(value: str) -> str:
    raw = value.strip().upper()
    if not raw.startswith("#"):
        raw = f"#{raw}"
    if len(raw) == 4:
        raw = "#" + "".join(ch * 2 for ch in raw[1:])
    if len(raw) != 7 or any(ch not in "0123456789ABCDEF" for ch in raw[1:]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Use a hex color like #1B2A4A.")
    return raw


@router.post("/palette/colors", response_model=ColorOut, status_code=status.HTTP_201_CREATED)
def add_color(payload: ColorCreate, _user: PaletteEditor, db: DbSession) -> ColorOut:
    name = payload.name.strip()
    hex_value = _normalize_hex(payload.hex)
    exists = db.scalar(select(ColorPalette.id).where(ColorPalette.name.ilike(name)))
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'"{name}" is already in the palette.',
        )
    max_order = db.scalar(select(ColorPalette.sort_order).order_by(ColorPalette.sort_order.desc()).limit(1)) or 0
    color = ColorPalette(name=name, hex=hex_value, sort_order=max_order + 1)
    db.add(color)
    db.commit()
    db.refresh(color)
    return color_out(color)


def _get_color(db: DbSession, color_id: UUID) -> ColorPalette:
    color = db.get(ColorPalette, color_id)
    if color is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Colour not found.")
    return color


@router.patch("/palette/colors/{color_id}", response_model=ColorOut)
def patch_color(color_id: UUID, payload: ColorPatch, _user: SuperadminUser, db: DbSession) -> ColorOut:
    color = _get_color(db, color_id)
    if payload.name is not None:
        name = payload.name.strip()
        clash = db.scalar(
            select(ColorPalette.id).where(ColorPalette.name.ilike(name), ColorPalette.id != color.id)
        )
        if clash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'"{name}" is already in the palette.',
            )
        color.name = name
    if payload.hex is not None:
        color.hex = _normalize_hex(payload.hex)
    db.add(color)
    db.commit()
    db.refresh(color)
    return color_out(color)


@router.delete("/palette/colors/{color_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_color(color_id: UUID, _user: SuperadminUser, db: DbSession) -> None:
    color = _get_color(db, color_id)
    selected = db.scalar(select(ProductColor.id).where(ProductColor.color_id == color.id).limit(1))
    if selected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This colour is selected on a shirt. Turn it off on those shirts, then delete it.",
        )
    variant_ids = list(db.scalars(select(Variant.id).where(Variant.color_id == color.id)))
    if variant_ids:
        on_order = db.scalar(select(OrderItem.id).where(OrderItem.variant_id.in_(variant_ids)).limit(1))
        if on_order:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This colour is on an order, so it cannot be deleted.",
            )
        for item in db.scalars(select(CartItem).where(CartItem.variant_id.in_(variant_ids))).all():
            db.delete(item)
        for variant in db.scalars(select(Variant).where(Variant.id.in_(variant_ids))).all():
            db.delete(variant)
    for image in db.scalars(select(ProductImage).where(ProductImage.color_id == color.id)).all():
        image.color_id = None
    db.delete(color)
    db.commit()


@router.get("/palette/sizes")
def list_sizes(_user: CatalogReader):
    return {"items": SIZES}
