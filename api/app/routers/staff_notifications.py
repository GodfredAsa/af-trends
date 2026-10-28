from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.deps import DbSession, NotificationAdmin, NotificationReader, Pagination
from app.models import Notification
from app.schemas import NotificationOut
from app.serializers import page

router = APIRouter()


def _out(row: Notification) -> NotificationOut:
    return NotificationOut(
        id=row.id,
        kind=row.kind,
        order_id=row.order_id,
        order_number=row.order_number or "",
        title=row.title,
        customer_name=getattr(row, "customer_name", "") or "",
        body=row.body,
        recipients=row.recipients,
        sender=row.sender,
        status=row.status,
        is_read=row.is_read,
        created_at=row.created_at,
        read_at=row.read_at,
    )


def _search(stmt, q: str | None):
    term = (q or "").strip()
    if not term:
        return stmt
    like = f"%{term}%"
    return stmt.where(
        or_(
            Notification.customer_name.ilike(like),
            Notification.body.ilike(like),
            Notification.recipients.ilike(like),
            Notification.order_number.ilike(like),
            Notification.title.ilike(like),
            Notification.status.ilike(like),
            Notification.sender.ilike(like),
        )
    )


@router.get("/notifications")
def list_notifications(
    _staff: NotificationReader,
    db: DbSession,
    pagination: Pagination,
    q: str | None = Query(default=None),
):
    page_num, page_size = pagination
    rows = list(db.scalars(_search(select(Notification), q).order_by(Notification.created_at.desc())).all())
    total = len(rows)
    start = (page_num - 1) * page_size
    sliced = rows[start : start + page_size]
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.is_read.is_(False))) or 0
    payload = page([_out(row) for row in sliced], page_num, page_size, total)
    payload["unread"] = unread
    return payload


@router.patch("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: UUID, _staff: NotificationReader, db: DbSession) -> NotificationOut:
    row = db.get(Notification, notification_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    if not row.is_read:
        row.is_read = True
        row.read_at = datetime.now(timezone.utc)
        db.add(row)
        db.commit()
        db.refresh(row)
    return _out(row)


@router.delete("/notifications/read")
def delete_read(_admin: NotificationAdmin, db: DbSession):
    rows = db.scalars(select(Notification).where(Notification.is_read.is_(True))).all()
    count = len(rows)
    for row in rows:
        db.delete(row)
    db.commit()
    return {"deleted": count}


@router.delete("/notifications/{notification_id}")
def delete_one(notification_id: UUID, _admin: NotificationAdmin, db: DbSession):
    row = db.get(Notification, notification_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    db.delete(row)
    db.commit()
    return {"deleted": 1}
