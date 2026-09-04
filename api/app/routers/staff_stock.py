from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.catalog import ensure_colors, ensure_sizes, ensure_variant_grid
from app.deps import CatalogEditor, CatalogReader, DbSession
from app.media import slugify
from app.models import Product, ProductColor, Variant
from app.schemas import StockCreate, StockItemOut
from app.serializers import get_settings, page, stock_item_out

router = APIRouter()

PAGE_SIZES = {5, 15, 25}


def _query():
    return (
        select(Product)
        .where(Product.deleted_at.is_(None))
        .options(
            selectinload(Product.images),
            selectinload(Product.color_links).selectinload(ProductColor.color),
            selectinload(Product.size_links),
            selectinload(Product.variants).selectinload(Variant.color),
        )
    )


def _unique_slug(db: DbSession, name: str) -> str:
    slug = slugify(name)
    candidate = slug
    n = 2
    while db.scalar(select(Product).where(Product.slug == candidate, Product.deleted_at.is_(None))):
        candidate = f"{slug}-{n}"
        n += 1
    return candidate


@router.get("/stock")
def list_stock(
    _user: CatalogReader,
    db: DbSession,
    page_num: int = Query(1, ge=1, alias="page"),
    page_size: int = Query(15, alias="page_size"),
):
    if page_size not in PAGE_SIZES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="page_size must be 5, 15, or 25.",
        )
    threshold = get_settings(db).low_stock_threshold
    rows = list(db.scalars(_query().order_by(Product.created_at.desc())).all())
    total = len(rows)
    start = (page_num - 1) * page_size
    sliced = rows[start : start + page_size]
    return page([stock_item_out(product, db, threshold) for product in sliced], page_num, page_size, total)


@router.post("/stock", response_model=StockItemOut, status_code=status.HTTP_201_CREATED)
def create_stock(payload: StockCreate, _user: CatalogEditor, db: DbSession) -> StockItemOut:
    if payload.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add images on Shirts before publishing. Leave unpublished here.",
        )
    try:
        product = Product(
            name=payload.name.strip(),
            slug=_unique_slug(db, payload.name),
            description=payload.description.strip(),
            base_price=payload.selling_price,
            cost_price=payload.cost_price,
            is_published=False,
            is_new_arrival=payload.is_new_arrival,
        )
        db.add(product)
        db.flush()
        ensure_colors(db, product, payload.color_ids)
        ensure_sizes(product, payload.sizes)
        stock_map = {(row.color_id, row.size.upper()): row.stock for row in payload.variants}
        ensure_variant_grid(db, product, stock_map)
        db.commit()
        loaded = db.scalar(_query().where(Product.id == product.id))
        return stock_item_out(loaded, db, get_settings(db).low_stock_threshold)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
