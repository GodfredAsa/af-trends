from collections.abc import Generator

from sqlalchemy import inspect, text, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def ensure_schema() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "products" in tables:
        columns = {column["name"] for column in inspector.get_columns("products")}
        if "cost_price" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE products ADD COLUMN cost_price NUMERIC(10, 2) DEFAULT 0 NOT NULL"))
        if "is_new_arrival" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE products ADD COLUMN is_new_arrival BOOLEAN DEFAULT 0 NOT NULL"))
                conn.execute(
                    text(
                        """
                        UPDATE products SET is_new_arrival = 1
                        WHERE id IN (
                            SELECT id FROM products
                            WHERE is_published = 1 AND deleted_at IS NULL
                            ORDER BY created_at DESC
                            LIMIT 3
                        )
                        """
                    )
                )
    if "product_images" in tables:
        image_columns = {column["name"] for column in inspector.get_columns("product_images")}
        if "public_id" not in image_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE product_images ADD COLUMN public_id VARCHAR(255) DEFAULT '' NOT NULL"))
    if "store_settings" in tables:
        setting_columns = {column["name"] for column in inspector.get_columns("store_settings")}
        if "privilege_matrix" not in setting_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE store_settings ADD COLUMN privilege_matrix TEXT DEFAULT '' NOT NULL"))
    if "orders" in tables:
        order_columns = {column["name"] for column in inspector.get_columns("orders")}
        if "stock_held" not in order_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE orders ADD COLUMN stock_held BOOLEAN DEFAULT 0 NOT NULL"))
    if "cart_items" in tables:
        cart_columns = {column["name"] for column in inspector.get_columns("cart_items")}
        if "owner_key" not in cart_columns:
            with engine.begin() as conn:
                conn.execute(text("DROP TABLE IF EXISTS cart_items"))
            from app.models import CartItem

            CartItem.__table__.create(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
