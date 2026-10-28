import json
import logging
import shutil
import subprocess
import urllib.error
import urllib.request
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.database import SessionLocal
from app.models import Notification, StoreSettings
from app.money import money_str

log = logging.getLogger(__name__)

SMS_API_HEADER = "X-API-Key"
SMS_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def _vynfy_headers(api_key: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://sms.vynfy.com",
        "Referer": "https://sms.vynfy.com/",
        "User-Agent": SMS_USER_AGENT,
        SMS_API_HEADER: api_key,
    }


def _post_vynfy(url: str, api_key: str, payload: dict) -> tuple[int, str]:
    body = json.dumps(payload)
    headers = _vynfy_headers(api_key)
    curl = shutil.which("curl")
    if curl:
        command = [curl, "-sS", "-X", "POST", url, "--max-time", "20", "-w", "\n%{http_code}"]
        for key, value in headers.items():
            command.extend(["-H", f"{key}: {value}"])
        command.extend(["--data-binary", body])
        completed = subprocess.run(command, capture_output=True, text=True, check=False)
        if completed.returncode != 0 and not completed.stdout.strip():
            raise RuntimeError(completed.stderr.strip() or "curl could not reach Vynfy.")
        output = completed.stdout.rsplit("\n", 1)
        detail = output[0] if len(output) == 2 else completed.stdout
        try:
            status_code = int((output[-1] if output else "0").strip() or "0")
        except ValueError:
            status_code = 0
            detail = completed.stdout
        return status_code, detail

    request = urllib.request.Request(url, data=body.encode("utf-8"), method="POST", headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def _item_lines(order) -> str:
    lines = []
    for item in order.items or []:
        lines.append(f"- {item.product_name} x{item.quantity} {item.color_name} {item.size}")
    return "\n".join(lines) or "- (no items)"


def staff_order_message(order) -> str:
    customer = order.customer
    name = customer.full_name if customer else "Customer"
    phone = customer.phone if customer else ""
    email = customer.email if customer else ""
    return (
        f"AF Trends order {order.order_number}\n"
        f"Placed by: {name}\n"
        f"Customer phone: {phone or 'n/a'}\n"
        f"Customer email: {email or 'n/a'}\n"
        f"Items:\n{_item_lines(order)}\n"
        f"Total: GHS {money_str(order.total)}"
    )


def local_msisdn(number: str) -> str:
    digits = "".join(ch for ch in (number or "") if ch.isdigit())
    if digits.startswith("233") and len(digits) >= 12:
        return "0" + digits[3:]
    if digits.startswith("0") and len(digits) == 10:
        return digits
    if len(digits) == 9:
        return "0" + digits
    return digits


def admin_sms_number(db) -> str:
    row = db.get(StoreSettings, 1) if db is not None else None
    raw = (row.sms_admin_number if row else "") or settings.sms_admin_number
    return local_msisdn(raw)


def _recipients(admin_number: str, customer_phone: str | None) -> list[str]:
    numbers = []
    seen: set[str] = set()
    for raw in (admin_number, customer_phone):
        local = local_msisdn(raw or "")
        if local and local not in seen:
            seen.add(local)
            numbers.append(local)
    return numbers


def order_sms_payload(order) -> dict:
    customer = order.customer
    return {
        "idempotency_key": f"sms:order:{order.order_number}",
        "order_id": str(order.id),
        "order_number": order.order_number,
        "message": staff_order_message(order),
        "customer_name": customer.full_name if customer else "",
        "customer_phone": customer.phone if customer else "",
        "metadata": {
            "campaign_id": settings.sms_campaign_id,
            "customer_segment": settings.sms_customer_segment,
            "order_id": order.order_number,
        },
        "recipients": [],
        "sender": settings.sms_sender,
    }


def _provider_payload(payload: dict) -> dict:
    return {
        "message": payload["message"],
        "metadata": payload["metadata"],
        "recipients": payload["recipients"],
        "sender": payload["sender"],
    }


def _console_sms(status: str, payload: dict, extra: str = "") -> None:
    order_number = payload.get("order_number") or payload.get("metadata", {}).get("order_id") or "unknown"
    recipients = ", ".join(payload.get("recipients") or []) or "n/a"
    sender = payload.get("sender") or settings.sms_sender
    message = (payload.get("message") or "").strip() or "(no message)"
    lines = [
        "",
        "========== ORDER SMS ==========",
        f"Status:     {status}",
        f"Order:      {order_number}",
        f"Sender:     {sender}",
        f"Recipients: {recipients}",
        f"Payload:    {json.dumps(_provider_payload(payload), ensure_ascii=False)}",
    ]
    if extra:
        lines.append(f"Detail:     {extra}")
    lines.append("Order details:")
    lines.extend(f"  {line}" if line else "  " for line in message.splitlines())
    lines.append("================================")
    text = "\n".join(lines)
    print(text, flush=True)
    if status == "SENT":
        log.info(text)
    else:
        log.warning(text)


def send_order_sms(payload: dict) -> None:
    if not payload:
        return
    key = payload.get("idempotency_key") or f"sms:order:{payload.get('order_number')}"
    db = SessionLocal()
    try:
        payload["recipients"] = _recipients(admin_sms_number(db), payload.get("customer_phone"))
        existing = db.scalar(select(Notification).where(Notification.idempotency_key == key))
        if existing and existing.status == "sent":
            _console_sms("SKIPPED (already sent)", payload)
            return
        if existing is None:
            order_id = payload.get("order_id")
            existing = Notification(
                kind="sms",
                idempotency_key=key,
                order_id=UUID(order_id) if order_id else None,
                order_number=payload.get("order_number") or "",
                title=f"Order {payload.get('order_number')}",
                customer_name=payload.get("customer_name") or "",
                body=payload.get("message") or "",
                recipients=",".join(payload.get("recipients") or []),
                sender=payload.get("sender") or settings.sms_sender,
                status="queued",
            )
            db.add(existing)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                existing = db.scalar(select(Notification).where(Notification.idempotency_key == key))
                if existing and existing.status == "sent":
                    _console_sms("SKIPPED (already sent)", payload)
                    return
                if existing is None:
                    return
            else:
                db.refresh(existing)
        elif existing.status == "sent":
            _console_sms("SKIPPED (already sent)", payload)
            return

        api_key = (settings.vynfy_api_key or "").strip()
        api_url = (settings.vynfy_api_url or "https://sms.vynfy.com/api/v1/send").strip()
        if not api_key:
            existing.status = "failed"
            existing.provider_response = "Missing VYNFY_API_KEY."
            db.add(existing)
            db.commit()
            _console_sms("FAILED", payload, "Missing VYNFY_API_KEY.")
            return

        try:
            status_code, detail = _post_vynfy(api_url, api_key, _provider_payload(payload))
            existing.provider_response = f"HTTP {status_code}: {detail[:1500]}"
            if 200 <= status_code < 300:
                existing.status = "sent"
                db.add(existing)
                db.commit()
                _console_sms("SENT", payload, f"HTTP {status_code}")
            else:
                existing.status = "failed"
                db.add(existing)
                db.commit()
                _console_sms("FAILED", payload, f"HTTP {status_code}: {detail[:500]}")
        except Exception as exc:
            existing.status = "failed"
            existing.provider_response = str(exc)[:1500]
            db.add(existing)
            db.commit()
            _console_sms("FAILED", payload, str(exc))
    finally:
        db.close()
