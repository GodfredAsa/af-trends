from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, SessionLocal, engine, ensure_schema
from app.privileges import hydrate
from app.routers import (
    addresses,
    auth,
    cart,
    catalog,
    orders,
    staff_orders,
    staff_privileges,
    staff_products,
    staff_settings,
    staff_stock,
    staff_users,
)
from app.seed import seed_if_empty
from app.serializers import get_settings

settings.media_path.mkdir(parents=True, exist_ok=True)
(settings.media_path / "products").mkdir(parents=True, exist_ok=True)
(settings.media_path / "catalog").mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)
ensure_schema()
with SessionLocal() as db:
    seed_if_empty(db)
    hydrate(getattr(get_settings(db), "privilege_matrix", "") or "")

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="AF Trends — custom t-shirt store API.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=str(settings.media_path)), name="media")

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(catalog.router, prefix="/api/v1", tags=["catalog"])
app.include_router(addresses.router, prefix="/api/v1", tags=["addresses"])
app.include_router(cart.router, prefix="/api/v1", tags=["cart"])
app.include_router(orders.router, prefix="/api/v1", tags=["orders"])
app.include_router(staff_products.router, prefix="/api/v1/staff", tags=["staff-products"])
app.include_router(staff_stock.router, prefix="/api/v1/staff", tags=["staff-stock"])
app.include_router(staff_orders.router, prefix="/api/v1/staff", tags=["staff-orders"])
app.include_router(staff_users.router, prefix="/api/v1/staff", tags=["staff-users"])
app.include_router(staff_settings.router, prefix="/api/v1/staff", tags=["staff-settings"])
app.include_router(staff_privileges.router, prefix="/api/v1/staff", tags=["staff-privileges"])


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "af-trends", "cart_hold": "4h", "orders": "paged"}

