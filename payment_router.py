# app/api/payment_router.py
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.api.finance_api import get_userid, validate_token
from app.data.finance_ai_dbclient import FinanceDB

logger = logging.getLogger(__name__)
db = FinanceDB()

router = APIRouter(prefix="/payments", tags=["Billing"])

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

# Portal page to route users back after Stripe.
PORTAL_BASE_URL = os.getenv("PORTAL_BASE_URL", "https://mintraiq.com/portal").rstrip("/")

# Stripe Price IDs configured via env.
STRIPE_PRICE_BASIC = os.getenv("STRIPE_PRICE_BASIC", "").strip()
STRIPE_PRICE_ADVANCED = os.getenv("STRIPE_PRICE_ADVANCED", "").strip()

# Trial policy requested for billing page.
TRIAL_DAYS_BASIC = int(os.getenv("TRIAL_DAYS_BASIC", "7"))
TRIAL_DAYS_ADVANCED = int(os.getenv("TRIAL_DAYS_ADVANCED", "14"))

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


class WebCheckoutRequest(BaseModel):
    tier: str
    promo_code: Optional[str] = None


class MobileIntentRequest(BaseModel):
    amount_cents: int = 1099
    currency: str = "nzd"


def _normalize_tier(raw: str) -> tuple[str, str]:
    """Return (requested_tier, billing_tier)."""
    t = str(raw or "").strip().lower()
    if t in {"advanced", "premium", "pro", "business", "pro_trial"}:
        return t, "premium"
    if t == "basic":
        return t, "basic"
    if t == "free":
        return t, "free"
    raise HTTPException(status_code=400, detail=f"Unsupported tier: {raw!r}")


def _trial_days_for_tier(requested_tier: str, billing_tier: str) -> int:
    if requested_tier == "basic" or billing_tier == "basic":
        return max(0, TRIAL_DAYS_BASIC)
    if requested_tier in {"advanced", "premium", "pro", "business", "pro_trial"} or billing_tier == "premium":
        return max(0, TRIAL_DAYS_ADVANCED)
    return 0


def _price_id_for_tier(billing_tier: str) -> str:
    if billing_tier == "basic":
        return STRIPE_PRICE_BASIC
    if billing_tier == "premium":
        return STRIPE_PRICE_ADVANCED
    return ""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(dt):
    """Normalize DB datetime values to tz-aware UTC."""
    if not isinstance(dt, datetime):
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _portal_base_from_request(request: Request) -> str:
    origin = (request.headers.get("origin") or "").strip().rstrip("/")
    if origin:
        return f"{origin}/portal"
    return PORTAL_BASE_URL


def _unix_to_datetime(unix_timestamp: Optional[int]):
    if not unix_timestamp:
        return None
    return datetime.fromtimestamp(unix_timestamp, tz=timezone.utc)


@router.post("/web/checkout")
async def create_web_checkout_session(
    payload: WebCheckoutRequest,
    request: Request,
    user: dict = Depends(validate_token),
):
    """
    Create Stripe Checkout session for Basic/Advanced billing with trial days.
    Returns Stripe hosted URL; caller redirects browser to `url`.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured on server.")

    user_id = get_userid(user.get("sub"))
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user.")

    requested_tier, billing_tier = _normalize_tier(payload.tier)
    if billing_tier == "free":
        raise HTTPException(status_code=400, detail="Free tier does not require checkout.")

    price_id = _price_id_for_tier(billing_tier)
    if not price_id:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe price is not configured for tier '{billing_tier}'.",
        )

    trial_days = _trial_days_for_tier(requested_tier, billing_tier)
    portal_base = _portal_base_from_request(request)
    success_url = (
        f"{portal_base}/settings-billing.html?payment=success"
        f"&tier={requested_tier}&session_id={{CHECKOUT_SESSION_ID}}"
    )
    cancel_url = f"{portal_base}/settings-billing.html?payment=cancelled&tier={requested_tier}"

    customer_email = (user.get("email") or "").strip() or None
    customer_id = None
    user_doc = None
    try:
        user_doc = db.user_data.find_one({"_id": user_id})
        customer_id = ((user_doc or {}).get("billing") or {}).get("stripe_customer_id")
    except Exception:
        # Keep checkout usable even if read fails.
        customer_id = None
        user_doc = None

    # App-managed trial: start trial in user profile first; do NOT send to Stripe checkout yet.
    # Checkout becomes available only after trial is used/ended.
    if trial_days > 0:
        now = _utcnow()
        trial_expires_at = _to_utc((user_doc or {}).get("trial_expires_at"))
        trial_tier = str((user_doc or {}).get("trial_tier") or "").lower().strip()
        trial_used_key = f"trial_used_{billing_tier}"
        trial_used = bool((user_doc or {}).get(trial_used_key))

        if trial_expires_at and trial_tier == billing_tier and trial_expires_at > now:
            days_left = max(0, int((trial_expires_at - now).total_seconds() // 86400))
            return {
                "status": "trial_active",
                "tier": billing_tier,
                "trial_days_left": days_left,
                "trial_expires_at": trial_expires_at.isoformat(),
                "checkout_enabled": False,
                "message": "Trial is already active."
            }

        if not trial_used:
            expiry = now + timedelta(days=trial_days)
            db.user_data.update_one(
                {"_id": user_id},
                {
                    "$set": {
                        "tier": billing_tier,
                        "billing_tier": billing_tier,
                        "trial_tier": billing_tier,
                        "trial_started_at": now,
                        "trial_expires_at": expiry,
                        "stripe_payment_status": "trialing",
                        "billing.payment_status": "trialing",
                        "billing.access_status": "active",
                        trial_used_key: True,
                    }
                },
                upsert=False,
            )
            return {
                "status": "trial_started",
                "tier": billing_tier,
                "trial_days": trial_days,
                "trial_expires_at": expiry.isoformat(),
                "checkout_enabled": False,
                "message": f"{trial_days}-day trial started."
            }

    subscription_data = {
        "metadata": {
            "user_id": str(user_id),
            "tier_requested": requested_tier,
            "billing_tier": billing_tier,
            "promo_code": payload.promo_code or "",
        }
    }
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            allow_promotion_codes=True,
            client_reference_id=str(user_id),
            success_url=success_url,
            cancel_url=cancel_url,
            customer=customer_id or None,
            customer_email=None if customer_id else customer_email,
            metadata={
                "user_id": str(user_id),
                "tier_requested": requested_tier,
                "billing_tier": billing_tier,
            },
            subscription_data=subscription_data,
        )
    except Exception as exc:
        logger.error("Stripe checkout session creation failed: %s", exc)
        raise HTTPException(status_code=400, detail="Could not create checkout session.")

    return {
        "url": session.url,
        "session_id": session.id,
        "tier": billing_tier,
        "requested_tier": requested_tier,
        "trial_days": trial_days,
        "checkout_enabled": True,
    }


# Backwards-compatible path.
@router.post("/web")
async def create_checkout_session_compat(
    payload: WebCheckoutRequest,
    request: Request,
    user: dict = Depends(validate_token),
):
    return await create_web_checkout_session(payload, request, user)


@router.post("/mobile")
async def create_payment_intent(
    payload: MobileIntentRequest,
    user: dict = Depends(validate_token),
):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured on server.")
    try:
        customer = stripe.Customer.create(
            metadata={"user_sub": str(user.get("sub") or "")},
        )
        ephemeral_key = stripe.EphemeralKey.create(
            customer=customer.id,
            stripe_version="2023-10-16",
        )
        payment_intent = stripe.PaymentIntent.create(
            amount=max(1, int(payload.amount_cents)),
            currency=(payload.currency or "nzd").lower(),
            customer=customer.id,
            automatic_payment_methods={"enabled": True},
            metadata={"user_sub": str(user.get("sub") or "")},
        )
        return {
            "paymentIntent": payment_intent.client_secret,
            "ephemeralKey": ephemeral_key.secret,
            "customer": customer.id,
            "publishableKey": STRIPE_PUBLISHABLE_KEY,
        }
    except Exception as exc:
        logger.error("Stripe mobile payment intent creation failed: %s", exc)
        raise HTTPException(status_code=400, detail="Could not create payment intent.")


@router.get("/status")
async def payment_status():
    return {"status": "active"}


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(default=None, alias="Stripe-Signature"),
):
    payload = await request.body()
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Stripe webhook secret not configured.")
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, STRIPE_WEBHOOK_SECRET)
    except Exception as exc:
        logger.error("Webhook signature verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid payload or signature")

    event_type = event.get("type", "")
    data_object = ((event.get("data") or {}).get("object")) or {}
    logger.info("Processing Stripe webhook: %s", event_type)

    try:
        if event_type == "checkout.session.completed":
            user_id = data_object.get("client_reference_id")
            customer_id = data_object.get("customer")
            sub_id = data_object.get("subscription")

            billing_tier = (
                ((data_object.get("metadata") or {}).get("billing_tier"))
                or "premium"
            )

            patch = {
                "tier": billing_tier,
                "billing_tier": billing_tier,
                "stripe_payment_status": "active",
                "billing.payment_status": "active",
                "billing.access_status": "active",
                "billing.stripe_customer_id": customer_id,
                "billing.stripe_subscription_id": sub_id,
                "billing.last_checkout_session_id": data_object.get("id"),
                "trial_tier": None,
                "trial_expires_at": None,
            }
            if user_id:
                db.user_data.update_one({"_id": user_id}, {"$set": patch})

        elif event_type in {"invoice.payment_succeeded", "invoice.payment_failed"}:
            customer_id = data_object.get("customer")
            status = "active" if event_type == "invoice.payment_succeeded" else "past_due"
            renewal = _unix_to_datetime(data_object.get("created"))
            db.user_data.update_one(
                {"billing.stripe_customer_id": customer_id},
                {"$set": {"billing.access_status": status, "billing.next_billing_date": renewal}},
            )

    except Exception as exc:
        logger.error("Error processing Stripe webhook event %s: %s", event_type, exc)
        # Return 200 so Stripe retries do not hammer transient DB errors.
        return {"status": "error-processing", "event_type": event_type}

    return {"status": "success", "event_type": event_type}