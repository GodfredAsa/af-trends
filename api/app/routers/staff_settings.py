from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import select, text

from app.deps import DbSession, SettingsAdmin, SuperadminUser
from app.media import destroy_upload, save_upload
from app.models import DeliveryZone, StorefrontAsset, UserRole
from app.money import money_str
from app.schemas import SettingsOut, SettingsPatch, StorefrontAssetOut, ZoneCreate, ZoneOut, ZonePatch
from app.seed import enable_demo_catalog, generate_sample_data
from app.serializers import get_settings
from app.sms import local_msisdn
from app.storefront import STOREFRONT_SLOTS, slot_map

router = APIRouter()


def _settings_out(row) -> SettingsOut:
    return SettingsOut(
        store_name=row.store_name,
        support_email=row.support_email,
        support_phone=row.support_phone,
        currency=row.currency,
        cod_instructions=row.cod_instructions,
        low_stock_threshold=row.low_stock_threshold,
        payment_account=getattr(row, "payment_account", None) or "024 903 9110",
        payment_network=getattr(row, "payment_network", None) or "MTN MoMo",
        sms_admin_number=getattr(row, "sms_admin_number", None) or "",
        sms_sender=getattr(row, "sms_sender", None) or "",
        vynfy_api_url=getattr(row, "vynfy_api_url", None) or "",
        vynfy_api_key_set=bool((getattr(row, "vynfy_api_key", None) or "").strip()),
        test_mode=bool(getattr(row, "test_mode", False)),
    )


def _asset_out(slot: dict, row: StorefrontAsset | None) -> StorefrontAssetOut:
    return StorefrontAssetOut(
        key=slot["key"],
        label=slot["label"],
        hint=slot["hint"],
        url=(row.url if row and row.url else slot["fallback"]),
        fallback=slot["fallback"],
    )


@router.get("/settings", response_model=SettingsOut)
def read_settings(_admin: SettingsAdmin, db: DbSession) -> SettingsOut:
    row = get_settings(db)
    return _settings_out(row)


@router.patch("/settings", response_model=SettingsOut)
def patch_settings(payload: SettingsPatch, _admin: SettingsAdmin, db: DbSession) -> SettingsOut:
    row = get_settings(db)
    data = payload.model_dump(exclude_unset=True)
    api_key = data.pop("vynfy_api_key", None)
    if "sms_admin_number" in data and data["sms_admin_number"] is not None:
        data["sms_admin_number"] = local_msisdn(data["sms_admin_number"])
    if "sms_sender" in data and data["sms_sender"] is not None:
        data["sms_sender"] = data["sms_sender"].strip()
    if "vynfy_api_url" in data and data["vynfy_api_url"] is not None:
        data["vynfy_api_url"] = data["vynfy_api_url"].strip()
    for key, value in data.items():
        setattr(row, key, value)
    if api_key is not None and str(api_key).strip():
        row.vynfy_api_key = str(api_key).strip()
    db.add(row)
    db.commit()
    db.refresh(row)
    if row.test_mode:
        enable_demo_catalog(db)
        db.refresh(row)
    return _settings_out(row)


CLEAR_TABLES = (
    "payment_proof_images",
    "payment_proofs",
    "order_notes",
    "order_events",
    "order_items",
    "notifications",
    "orders",
    "cart_items",
    "product_images",
    "product_colors",
    "product_sizes",
    "variants",
    "products",
    "storefront_assets",
    "delivery_zones",
    "addresses",
    "color_palette",
)


@router.post("/settings/clear-data")
def clear_operational_data(admin: SuperadminUser, db: DbSession):
    if admin.role != UserRole.superadmin.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a superadmin can clear store data.")
    db.execute(text("PRAGMA foreign_keys = OFF"))
    for table in CLEAR_TABLES:
        db.execute(text(f"DELETE FROM {table}"))
    db.execute(text("PRAGMA foreign_keys = ON"))
    db.commit()
    return {"cleared": True, "kept": ["users", "store_settings"]}


@router.post("/settings/sample-data")
def create_sample_data(admin: SuperadminUser, db: DbSession):
    if admin.role != UserRole.superadmin.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a superadmin can generate sample data.")
    summary = generate_sample_data(db)
    return {"generated": True, **summary}


@router.get("/delivery-zones")
def list_zones(_admin: SettingsAdmin, db: DbSession):
    rows = db.scalars(select(DeliveryZone).order_by(DeliveryZone.name)).all()
    return {
        "items": [
            ZoneOut(id=zone.id, name=zone.name, fee=money_str(zone.fee), is_active=zone.is_active)
            for zone in rows
        ]
    }


@router.post("/delivery-zones", response_model=ZoneOut, status_code=status.HTTP_201_CREATED)
def create_zone(payload: ZoneCreate, _admin: SettingsAdmin, db: DbSession) -> ZoneOut:
    zone = DeliveryZone(name=payload.name.strip(), fee=payload.fee, is_active=payload.is_active)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return ZoneOut(id=zone.id, name=zone.name, fee=money_str(zone.fee), is_active=zone.is_active)


@router.patch("/delivery-zones/{zone_id}", response_model=ZoneOut)
def patch_zone(zone_id: UUID, payload: ZonePatch, _admin: SettingsAdmin, db: DbSession) -> ZoneOut:
    zone = db.get(DeliveryZone, zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found.")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(zone, key, value)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return ZoneOut(id=zone.id, name=zone.name, fee=money_str(zone.fee), is_active=zone.is_active)


@router.get("/storefront")
def list_storefront(_admin: SettingsAdmin, db: DbSession):
    rows = {row.key: row for row in db.scalars(select(StorefrontAsset)).all()}
    return {"items": [_asset_out(slot, rows.get(slot["key"])) for slot in STOREFRONT_SLOTS]}


@router.post("/storefront/{key}", response_model=StorefrontAssetOut)
def upload_storefront(key: str, _admin: SettingsAdmin, db: DbSession, file: UploadFile = File(...)) -> StorefrontAssetOut:
    slot = slot_map().get(key)
    if slot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown storefront photo.")
    row = db.get(StorefrontAsset, key)
    url, public_id = save_upload(key, file, folder=f"storefront/{key}")
    if row is None:
        row = StorefrontAsset(key=key, label=slot["label"], url=url, public_id=public_id)
    else:
        destroy_upload(row.public_id or "")
        row.url = url
        row.public_id = public_id
        row.label = slot["label"]
    db.add(row)
    db.commit()
    db.refresh(row)
    return _asset_out(slot, row)
