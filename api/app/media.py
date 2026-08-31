import re
import uuid
from pathlib import Path

import cloudinary
import cloudinary.uploader
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


def _cloudinary_ready() -> bool:
    return bool(settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret)


def _configure_cloudinary() -> None:
    if not _cloudinary_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
        )
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )


def save_upload(product_id: uuid.UUID, upload: UploadFile) -> tuple[str, str]:
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
    _configure_cloudinary()
    try:
        result = cloudinary.uploader.upload(
            data,
            folder=f"af-trends/products/{product_id}",
            resource_type="image",
            overwrite=False,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not upload the image to Cloudinary.",
        ) from exc
    url = result.get("secure_url") or result.get("url")
    public_id = result.get("public_id") or ""
    if not url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cloudinary did not return an image URL.",
        )
    return url, public_id


def destroy_upload(public_id: str | None) -> None:
    if not public_id or not _cloudinary_ready():
        return
    _configure_cloudinary()
    try:
        cloudinary.uploader.destroy(public_id, resource_type="image", invalidate=True)
    except Exception:
        pass


def write_bytes(product_id: uuid.UUID, filename: str, data: bytes) -> str:
    dest = product_dir(product_id) / filename
    dest.write_bytes(data)
    return f"/media/products/{product_id}/{filename}"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "shirt"
