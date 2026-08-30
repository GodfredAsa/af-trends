import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_BYTES = 5 * 1024 * 1024
MAX_FILES = 12


def product_dir(product_id: uuid.UUID) -> Path:
    path = settings.media_path / "products" / str(product_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_upload(product_id: uuid.UUID, upload: UploadFile) -> str:
    content_type = (upload.content_type or "").lower()
    suffix = ALLOWED_TYPES.get(content_type)
    if suffix is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Images must be JPEG, PNG, or WebP.",
        )
    data = upload.file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Each image must be 5 MB or smaller.",
        )
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file.")
    filename = f"{uuid.uuid4().hex}{suffix}"
    dest = product_dir(product_id) / filename
    dest.write_bytes(data)
    return f"/media/products/{product_id}/{filename}"


def write_bytes(product_id: uuid.UUID, filename: str, data: bytes) -> str:
    dest = product_dir(product_id) / filename
    dest.write_bytes(data)
    return f"/media/products/{product_id}/{filename}"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "shirt"
