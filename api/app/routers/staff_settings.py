from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import DbSession, SettingsAdmin
from app.models import DeliveryZone
from app.money import money_str
from app.schemas import SettingsOut, SettingsPatch, ZoneCreate, ZoneOut, ZonePatch
from app.serializers import get_settings

router = APIRouter()


@router.get("/settings", response_model=SettingsOut)
def read_settings(_admin: SettingsAdmin, db: DbSession) -> SettingsOut:
    row = get_settings(db)
    return SettingsOut(
        store_name=row.store_name,
        support_email=row.support_email,
        support_phone=row.support_phone,
        currency=row.currency,
        cod_instructions=row.cod_instructions,
        low_stock_threshold=row.low_stock_threshold,
    )


@router.patch("/settings", response_model=SettingsOut)
def patch_settings(payload: SettingsPatch, _admin: SettingsAdmin, db: DbSession) -> SettingsOut:
    row = get_settings(db)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    db.refresh(row)
    return SettingsOut(
        store_name=row.store_name,
        support_email=row.support_email,
        support_phone=row.support_phone,
        currency=row.currency,
        cod_instructions=row.cod_instructions,
        low_stock_threshold=row.low_stock_threshold,
    )


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
