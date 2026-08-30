from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import ClientUser, DbSession
from app.models import Address, DeliveryZone
from app.money import money_str
from app.schemas import AddressIn, AddressOut, AddressPatch, ZoneOut

router = APIRouter()


@router.get("/delivery-zones")
def list_zones(db: DbSession):
    rows = db.scalars(select(DeliveryZone).where(DeliveryZone.is_active.is_(True)).order_by(DeliveryZone.name)).all()
    return {
        "items": [
            ZoneOut(id=zone.id, name=zone.name, fee=money_str(zone.fee), is_active=zone.is_active)
            for zone in rows
        ]
    }


@router.get("/addresses", response_model=list[AddressOut])
def list_addresses(user: ClientUser, db: DbSession) -> list[AddressOut]:
    rows = db.scalars(
        select(Address).where(Address.user_id == user.id).order_by(Address.is_default.desc(), Address.created_at)
    ).all()
    return [AddressOut.model_validate(row) for row in rows]


@router.post("/addresses", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
def create_address(payload: AddressIn, user: ClientUser, db: DbSession) -> AddressOut:
    if payload.is_default:
        for row in db.scalars(select(Address).where(Address.user_id == user.id)).all():
            row.is_default = False
    address = Address(user_id=user.id, **payload.model_dump())
    db.add(address)
    db.commit()
    db.refresh(address)
    return AddressOut.model_validate(address)


def _owned(user: ClientUser, db: DbSession, address_id) -> Address:
    address = db.get(Address, address_id)
    if address is None or address.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found.")
    return address


@router.patch("/addresses/{address_id}", response_model=AddressOut)
def update_address(address_id: UUID, payload: AddressPatch, user: ClientUser, db: DbSession) -> AddressOut:
    address = _owned(user, db, address_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_default"):
        for row in db.scalars(select(Address).where(Address.user_id == user.id)).all():
            row.is_default = False
    for key, value in data.items():
        setattr(address, key, value)
    db.add(address)
    db.commit()
    db.refresh(address)
    return AddressOut.model_validate(address)


@router.delete("/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(address_id: UUID, user: ClientUser, db: DbSession) -> None:
    address = _owned(user, db, address_id)
    db.delete(address)
    db.commit()
