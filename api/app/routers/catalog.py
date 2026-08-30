from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DbSession, Pagination
from app.models import ColorPalette, Product, ProductColor, ProductSize, SIZES, Variant
from app.schemas import ProductOut, SizeListOut
from app.serializers import color_out, page, product_list_item, product_out

router = APIRouter()


def _published_query():
    return (
        select(Product)
        .where(Product.is_published.is_(True), Product.deleted_at.is_(None))
        .options(
            selectinload(Product.images),
            selectinload(Product.color_links).selectinload(ProductColor.color),
            selectinload(Product.size_links),
            selectinload(Product.variants).selectinload(Variant.color),
        )
    )


@router.get("/catalog/products")
def list_products(
    db: DbSession,
    pagination: Pagination,
    q: str | None = None,
    color_id: str | None = None,
    size: str | None = None,
    sort: str = Query("newest"),
):
    page_num, page_size = pagination
    stmt = _published_query()
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q.strip()}%"))
    if color_id:
        stmt = stmt.join(Product.color_links).where(ProductColor.color_id == color_id)
    if size:
        stmt = stmt.join(Product.size_links).where(ProductSize.size == size.upper())
    if sort == "price_asc":
        stmt = stmt.order_by(Product.base_price.asc())
    elif sort == "price_desc":
        stmt = stmt.order_by(Product.base_price.desc())
    else:
        stmt = stmt.order_by(Product.created_at.desc())

    rows = list(db.scalars(stmt.distinct()).unique().all())
    total = len(rows)
    start = (page_num - 1) * page_size
    sliced = rows[start : start + page_size]
    return page([product_list_item(product, db) for product in sliced], page_num, page_size, total)


@router.get("/catalog/products/{slug}", response_model=ProductOut)
def get_product(slug: str, db: DbSession) -> ProductOut:
    product = db.scalar(_published_query().where(Product.slug == slug))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shirt not found.")
    return product_out(product, db)


@router.get("/catalog/colors")
def list_colors(db: DbSession):
    rows = db.scalars(select(ColorPalette).order_by(ColorPalette.sort_order, ColorPalette.name)).all()
    return {"items": [color_out(row) for row in rows]}


@router.get("/catalog/sizes", response_model=SizeListOut)
def list_sizes() -> SizeListOut:
    return SizeListOut(items=SIZES)
