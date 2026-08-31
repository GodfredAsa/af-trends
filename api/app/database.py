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
    if "products" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("products")}
    if "cost_price" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE products ADD COLUMN cost_price NUMERIC(10, 2) DEFAULT 0 NOT NULL"))
    if "product_images" in inspector.get_table_names():
        image_columns = {column["name"] for column in inspector.get_columns("product_images")}
        if "public_id" not in image_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE product_images ADD COLUMN public_id VARCHAR(255) DEFAULT '' NOT NULL"))
    if "store_settings" in inspector.get_table_names():
        setting_columns = {column["name"] for column in inspector.get_columns("store_settings")}
        if "privilege_matrix" not in setting_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE store_settings ADD COLUMN privilege_matrix TEXT DEFAULT '' NOT NULL"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
