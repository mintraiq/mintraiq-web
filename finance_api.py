from urllib.request import HTTPBasicAuthHandler

import pandas as pd
from jose import jwt
import datetime
from pymongo import MongoClient
from config import settings
import httpx
import asyncio
import json
from app.data.data_processor import DataProcessor
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, ConfigDict, Field,EmailStr
from fastapi import FastAPI, Depends, UploadFile, File, Form,Request
import uuid
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta, timezone
import stripe
from typing import Literal,Optional
from pydantic.alias_generators import to_camel
import urllib.request
from fastapi.middleware.cors import CORSMiddleware
from pymongo import ReturnDocument
from app.parsers.universal_parser import UniversalParser
from app.data.finance_ai_dbclient import FinanceDB
from app.ml.categorizer_finetuned import MintraExpenseCategorizer
import logging
from fastapi import BackgroundTasks
from app.security.mintrai_token_encryptor import decrypt_token
from pydantic import BaseModel
import httpx


from fastapi.security import OAuth2AuthorizationCodeBearer
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException
from typing import List, Dict, Any, Optional
from functools import lru_cache
# Logto public keys for verification
# Your Logto settings
LOGTO_ENDPOINT = settings.logto_endpoint
JWKS_URL = settings.jwks_url
AI_FORECAST_URL = settings.ai_forecast_url
API_IDENTIFIER = settings.api_identifier
OCR_API_URL = settings.ocr_api_url
SWAGGER_APP_ID = settings.swagger_app_id
SWAGGER_RESOURCE = settings.swagger_resource
# 1. Point FastAPI to your specific Logto endpoints
# (Replace ufq3nf.logto.app with your actual Logto domain from your early errors)
logto_oauth2_scheme = OAuth2AuthorizationCodeBearer(
    authorizationUrl=f"{LOGTO_ENDPOINT}/oidc/auth?resource={SWAGGER_RESOURCE}",
    tokenUrl=f"{LOGTO_ENDPOINT}/oidc/token",
    scopes={"openid": "Required for Logto login", "profile": "Get user profile"}
)


logger = logging.getLogger(__name__)

finance_api_app =  FastAPI(
    title="MintrAIQ AI Dashboard API",
    description="AI based personal finance assistant using LLM",
    version="1.0.0",
    # This block is what tells Swagger to pre-fill the Client ID
    # and turn on the PKCE flow so it doesn't need a secret!
    swagger_ui_init_oauth={
        "clientId": f"{SWAGGER_APP_ID}",
        "usePkceWithAuthorizationCodeGrant": True,
        "additionalQueryStringParams": {
            "resource": f"{SWAGGER_RESOURCE}"
        }
    }
)
fallback = {404: {"description": "Not Found"}}
# In your FastAPI setup:
import os
from fastapi.middleware.cors import CORSMiddleware

# Read from Environment, fallback to Vercel (3000), Flask legacy (5000), and Expo Mobile (8081)
_cors_raw = os.getenv(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:3000,http://localhost:5000,https://api-dev.mintraiq.com,https://mintraiq.com,http://localhost:8081,http://127.0.0.1:3000"
)

# Clean up the string into a valid Python list
_allow_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]

finance_api_app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Be explicit for security
    allow_headers=["Authorization", "Content-Type"],  # Authorization is now the key
    max_age=600
)
# Internal Promo Code Database (In production, move this to a MongoDB collection)
INTERNAL_PROMOS = {
    "NINJA_VIP_30": {"type": "extended_trial", "days": 30, "tier": "premium"},
    "FOUNDER_LIFE": {"type": "lifetime", "tier": "premium"}
}
#auth_scheme = HTTPBearer()

client = MongoClient(settings.mongo_db_url)


dataprocessor = DataProcessor()

# Initialize singletons
parser      = UniversalParser()
mintra_scan_model  = MintraExpenseCategorizer()
## Univeresal DB Class for all collections
db          = FinanceDB()


# 2. Fetch the JWKS from Logto at server startup
# This runs exactly once when you start main.py, caching the keys in memory.
try:
    jwks_url = f"{LOGTO_ENDPOINT}/oidc/jwks"
    with urllib.request.urlopen(jwks_url) as response:
        # This defines the global 'jwks' variable your validate_token function is looking for!
        jwks = json.loads(response.read().decode())
    print("Successfully loaded Logto JWKS public keys.")
except Exception as e:
    print(f"CRITICAL ERROR: Could not fetch Logto JWKS. Check your internet or Logto URL. Details: {e}")
    jwks = {}


class AkahuExchangeRequest(BaseModel):
    code: str
    redirect_uri: str

class UpgradePayload(BaseModel):
    # This ensures the frontend can ONLY send one of these four exact strings.
    # If they send "super_hacker_tier", FastAPI blocks them automatically!
    tier: Literal["free", "basic", "premium", "pro_trial"]
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True  # Allows you to still use snake_case inside Python logic
    )
class CheckoutRequest(BaseModel):
    tier: Literal["free", "basic", "premium", "pro_trial"]
    promo_code: Optional[str] = None # For internal VIP codes
# 1. Define your strict Pydantic Model
class StatementUploadModel(BaseModel):
    # Literal enforces that ONLY these specific strings are allowed.
    bank: Literal["ASB", "ANZ", "BNZ", "Westpac", "Kiwibank", "Other"] = Field(
        ..., description="The bank the statement belongs to"
    )
    # You can easily add more fields here later!
    # account_type: Literal["checking", "credit"] = "checking"
# --- Profile Models ---
class UserProfileUpdate(BaseModel):
    """What the frontend sends when the user clicks 'Save Changes'"""
    name: str = Field(..., min_length=2, max_length=50)
    mobile_number: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = None
    currency: Literal["NZD", "AUD", "USD", "EUR"]
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=False  # Allows you to still use snake_case inside Python logic
    )


class UserProfileResponse(BaseModel):
    """What the API sends back to the frontend/mobile app"""
    id: str
    email: EmailStr
    name: str
    mobile_number: Optional[str]
    country: Optional[str]
    currency: str
    tier: str
    trial_days_left: int = 0


# --- Tier Config Models ---
class TierConfigResponse(BaseModel):
    """The feature flags sent to the frontends"""
    tier_name: str
    max_receipt_scans: int
    history_months: int
    has_cpi_guru: bool
    has_ai_forecast: bool
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=False  # Allows you to still use snake_case inside Python logic
    )


class FinanceData(BaseModel):
    start_date: str
    end_date: str

    # Tell Pydantic to automatically expect camelCase from the frontend
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True  # Allows you to still use snake_case inside Python logic
    )
# 1. The Updated Payload Model
class TransactionReviewPayload(BaseModel):
    txn_id: str
    category_value: str
    training_required: bool
    updated_by: str
    updated_at: datetime
    update_similar: bool = True # Default to True for the bulk-update experience

class BudgetPlanner(BaseModel):
    start_date : str
    end_date: str
    gentleness : Optional[float] = None
    savings_goal: Optional[float] = None
    
    # Tell Pydantic to automatically expect camelCase from the frontend
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True  # Allows you to still use snake_case inside Python logic
    )
# Model for the Review Endpoint
class TransactionReviewPayload(BaseModel):
    txn_id: str
    category_value: str
    training_required: bool
    updated_by: str
    updated_at: datetime

# Model for the Enquiry Endpoint Request
class EnquiryItem(BaseModel):
    id: str
    query: str

class TransactionEnquiryRequest(BaseModel):
    items: List[EnquiryItem]

# Individual step validation schemas
class ProfileStep(BaseModel):
    display_name: str
    mobile: str
    default_currency: str = "NZD"

class BillingStep(BaseModel):
    billing_tier: str
    billing_cycle: str
    cardholder_name: str
    stripe_payment_status: str

class SecurityStep(BaseModel):
    mfa_required: bool
    mfa_method: str
    session_timeout_mins: int

# Main Save Request
class WorkflowSaveRequest(BaseModel):
    data: Dict[str, Any]
    mark_complete: bool = True

def get_current_date_range(user_id: str, range_type: str = "month") -> BudgetPlanner:
    """
    Returns a BudgetPlanner object with start and end dates for the current month or week.
    range_type: "month" or "week"
    """
    today = datetime.now()
    if range_type == "week":
        # Start of week (Monday)
        start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(days=6)
        interval = "weekly"
    else:
        # Start of month
        start_date = today.replace(day=1)
        # End of month
        if today.month == 12:
            next_month = today.replace(year=today.year + 1, month=1, day=1)
        else:
            next_month = today.replace(month=today.month + 1, day=1)
        end_date = next_month - timedelta(days=1)
        interval = "monthly"

    # Fetch savings goal from DB
    savings_goal = db.get_savings_goal(user_id, interval)

    return BudgetPlanner(
        start_date=start_date.strftime("%Y-%m-%d"),
        end_date=end_date.strftime("%Y-%m-%d"),
        savings_goal=savings_goal
    )


# Add your Stripe keys (Put these in your environment variables in production!)
stripe.api_key = "sk_test_your_secret_stripe_key"
STRIPE_WEBHOOK_SECRET = "whsec_your_webhook_secret"

#@finance_api_app.route('/api/v1/users/me', methods=['GET'])
#def get_current_user():
#    user_data = get_user_from_db()
    # Now Flutter, Kotlin, AND your Web Dashboard can all use this!
#    return jsonify(user_data)


from pydantic import BaseModel, EmailStr
import uuid
from datetime import datetime


class BootstrapPayload(BaseModel):
    name: str
    email: EmailStr



# 3. Protect your routes
@finance_api_app.get("/secure-data")
def swagger_logto_auth(token: str = Depends(logto_oauth2_scheme)):
    return {"message": "You are authenticated via Logto!", "token": token}

#    user_id : str
def get_userid(identity_id):
    provider = "logto"
    provider_subject = identity_id

    user = db.get_user(provider,provider_subject)
    userid = user["_id"]
    return userid


# CRITICAL CHANGE: auto_error=False
# This tells Swagger to show the padlock, but stops FastAPI from crashing
# if a Web Dashboard user logs in with ONLY a cookie!
token_auth_scheme = HTTPBearer(auto_error=False)

async def validate_token(request: Request ,swagger_auth: HTTPAuthorizationCredentials = Depends(token_auth_scheme)):
    token = None

    # 1. Check for Mobile App Token (Bearer Header)
    auth_header = request.headers.get('Authorization')
    # 1. Check for Mobile App or Swagger UI Token (Captured safely by HTTPBearer)
    if swagger_auth:
        token = swagger_auth.credentials
        logger.debug(f"Received token from Mobile/Swagger: {token[:10]}...")

    # 1.5. Safety net for manual Mobile Headers (just in case they bypass HTTPBearer)
    elif auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        logger.debug(f"Received token from Mobile Header{token}")
    # 2. Fallback to Web Dashboard (HttpOnly Cookie)
    if not token:
        token = request.cookies.get('ninja_access_token')

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized: No secure token found.")

    try:
        # 2. Pass the raw string directly into jwt.decode
        payload = jwt.decode(
            token,  # <--- REMOVED .credentials HERE
            jwks,
            algorithms=['RS256', 'ES384'],
            audience=API_IDENTIFIER,
            issuer=f"{LOGTO_ENDPOINT}/oidc"
        )
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Ninja token: {str(e)}")
# Assuming validate_token is your unified dependency we built earlier
@finance_api_app.get("/auth")
async def test_authentication(user_jwt: dict = Depends(validate_token)):
    """Secure endpoint to verify Logto JWTs are decoding correctly."""
    return {
        "status": "success",
        "message": "Authentication successful. Your token is valid!",
        # This will spit back the exact data Logto put inside your token (like your user ID)
        "decoded_payload": user_jwt
    }

@finance_api_app.post("/bootstrap")
async def bootstrap_user_session(
        payload: BootstrapPayload,
        # YES: Only use validate_token here.
        # It handles the Swagger UI text box AND the decoding all at once!
        user_jwt: dict = Depends(validate_token)
):
    """
    This replaces the old Flask /callback business logic.
    Web and Mobile call this immediately after logging into Logto.
    """
    provider = "logto"
    provider_subject = user_jwt.get("sub")  # The secure Logto User ID
    now = datetime.utcnow()

    # 1. Check for existing Identity Link
    link = db.identity_links.find_one({
        "provider": provider,
        "provider_subject": provider_subject
    })

    if link:
        # EXISTING USER
        user_id = link["user_id"]
        db_user = db.user_data.find_one({"_id": user_id})
        is_new_user = False
    else:
        # 2. BRAND NEW USER: Create User & Identity Link
        user_id = str(uuid.uuid4())

        # Insert User
        db_user = {
            "_id": user_id,
            "name": payload.name,
            "email": payload.email,
            "tier": "free",
            "created_at": now,
            "has_agreed_to_tos" : False
        }
        db.user_data.insert_one(db_user)

        # Insert Identity Link
        db.identity_links.insert_one({
            "_id": str(uuid.uuid4()),
            "provider": provider,
            "provider_subject": provider_subject,
            "user_id": user_id,
            "created_at": now
        })
        is_new_user = True

    # 3. Handle Dashboard Logic (Lite vs Full)
    transaction_count = db.transactions.count_documents({"user_id": user_id})

    if transaction_count == 0:
        target_dashboard = "landing"  # Brand new, needs onboarding
    elif transaction_count < 100:
        target_dashboard = "lite"  # Has some data, but not enough for full ML
    else:
        target_dashboard = "full"  # Standard dashboard

    # 4. Handle Tier / License Routing
    current_tier = db_user.get("tier", "free")
    requires_license_page = False

    if current_tier == "free" and transaction_count > 100:
        # Example logic: Force them to upgrade page if they hit limits
        requires_license_page = True

        # 5. Return the "Flight Plan" to the Frontend
    return {
        "status": "success",
        "is_new_user": is_new_user,
        "routing": {
            "dashboard_type": target_dashboard,
            "redirect_to_license": requires_license_page
        },
        "profile": {
            "name": db_user["name"],
            "tier": current_tier
        }
    }


@finance_api_app.post('/generate')
def generate_dashboard(financedata : FinanceData, user: dict = Depends(validate_token)):


        user_id = get_userid(user.get("sub"))
        if not user_id:
           raise HTTPException(status_code=500, detail="Could not retrieve user details , Please contact administrator")
        #user_name = g.user.get("name")
        #user = g.user
        #print(financedata.start_date)
        start_date = financedata.start_date
        # Use provided dates from payload
        startDate = datetime.strptime(financedata.start_date, "%Y-%m-%d")
        end_date = financedata.end_date
        endDate = datetime.strptime(financedata.end_date, "%Y-%m-%d")
        prev_date, prev_end_date = dataprocessor.previous_month_range(startDate)
        forecast_month_date = prev_date.strftime("%Y-%m-%d")
        ### Move this financeai db class
        #forecast_json = forecast_collections.find_one({"user_id": user_id,"forecast_date":forecast_month_date})
        forecast_json = db.get_forecast_data(user_id,forecast_month_date)

        #Add Auth header here

        if not forecast_json:
            async def call_fastapi():
                payload = {
                    "start_date": startDate.strftime("%Y-%m-%d"),
                    "end_date": endDate.strftime("%Y-%m-%d"),
                    "user_id": user_id
                }
                try :
                    async with httpx.AsyncClient(timeout=60) as client:
                        response = await client.post(AI_FORECAST_URL+"/ai/forecast/recommendations", json=payload)
                        return response.json()
                except Exception as e:
                    logger.error(f"AI Service Error: {e}")
                    return None  # Return None so we can use compensation logic

            forecast_json = asyncio.run(call_fastapi())

        if forecast_json is None:
            forecast_json={

             "ai_status" : "Offline",  # Add a flag for the frontend
             "recommendations" :
                 [{ "title": "AI is off-line",
                    "description": "AI Advisor is currently meditating. Please try again later.",
                    "icon": "fa-coffee"}]
            }
            # Pass the data missing state straight through
        elif forecast_json.get("ai_status") == "DATA_MISSING":
            return JSONResponse(content=forecast_json, status_code=200)  # Or 404, depending on your fetch logic

        resultJSON = dataprocessor.generate_dashboard_data(forecast_json, startDate, endDate, user,user_id)
        # 1. Convert complex data into standard JSON-compatible Python types
        safe_data = jsonable_encoder(resultJSON)
        return JSONResponse(content=safe_data, status_code=200)
# ==========================================
# 4. THE API ENDPOINT (Instant JSON Response)
# ==========================================
@finance_api_app.get("/ai-reserves")
#@requires_tier(['premium', 'promo'])
async def get_upcoming_reserves( user: dict = Depends(validate_token)):


    user_id = get_userid(user.get("sub"))
    """
    Since the ML model ran overnight, this endpoint has zero computation latency.
    It just fetches the pre-calculated rows and returns pure JSON to the dashboard.
    """

    # In a real app, extract user_id from the Logto JWT token here.
    # For demonstration, we hardcode the target user.
    current_user_id = "user_123"

    rec_list = list(db.get_recurring_reminders(user_id))

    # 2. Extract using Dictionary Bracket Notation instead of Dot Notation
    alerts_json = []
    for rec in rec_list:
        # Safely handle the date formatting just in case MongoDB stored it as a string instead of a datetime object
        raw_date = rec.get("expected_next_date")
        formatted_date = raw_date.strftime("%Y-%m-%d") if hasattr(raw_date, 'strftime') else raw_date

        alerts_json.append({
            "merchant": rec.get("merchant", "Unknown Merchant"),
            "frequency": rec.get("frequency", "Unknown"),
            "expected_next_date": formatted_date,
            "recommended_reserve_amount": round(rec.get("recommended_reserve_amount", 0.0), 2)
        })



    return {"alerts": alerts_json}


from fastapi import APIRouter, Depends, HTTPException
from pymongo import DESCENDING


# Assuming your MongoDB instance is imported as 'db'
# and your auth middleware is imported as 'validate_token'

from pymongo import DESCENDING

@finance_api_app.get("/transactions")
async def get_user_transactions(user_data: dict = Depends(validate_token)):
    user_id = get_userid(user_data.get("sub"))
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user token.")


    #cursor = db.daily_expenses.find({"user_id": user_id}).sort("date", DESCENDING)
    # 1. THE FIX: Query the new 'transactions' collection directly!
    cursor = db.transactions.find({"user_id": user_id}).sort("date", DESCENDING)

    transactions_list = []
    for doc in cursor:
        raw_date = doc.get("date")
        formatted_date = raw_date.strftime("%Y-%m-%d") if hasattr(raw_date, 'strftime') else str(raw_date)[:10]

        # 2. Map your new schema fields (Title Case) to the frontend expected keys (lowercase)
        desc = doc.get("Description") or doc.get("description") or doc.get("merchant") or "Unknown"
        cat = doc.get("Category") or doc.get("category") or "Uncategorized"

        # Amount is now stored as "expenses" in your DB
        amt = float(doc.get("expenses") or doc.get("amount") or 0.0)

        # 3. Calculate the UI flag dynamically from your ml_confidence field!
        conf = float(doc.get("ml_confidence", 1.0))
        flag = "✅" if conf >= 0.9 else "⚠️" if conf >= 0.75 else "❌"

        transactions_list.append({
            "id": str(doc.get("_id")),
            "date": formatted_date,
            "amount": amt,
            "description": desc,
            "category": cat,
            "needs_review": doc.get("needs_review", False),
            "flag": flag,
            "type": doc.get("transaction_type", "debit")
        })

    return {"transactions": transactions_list}




# --- 2. The Tier Enforcer Dependency ---
def require_tier(allowed_tiers: list):
    """The FastAPI equivalent of your old Flask decorator."""

    def tier_checker(user: dict = Depends(validate_token)):
        # 1. Check MongoDB (The absolute source of truth)
        user_id = get_userid(user.get("sub"))
        #user = db.user_data.find_one({"_id": user_id})

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        current_tier = user.get("tier", "free")

        # 2. Handle Trial Logic just like you did in Flask
        if current_tier == "pro_trial":
            # Add your expiration logic here...
            effective_tier = "premium"
        else:
            effective_tier = current_tier

        # 3. Reject if they don't have access
        if effective_tier not in allowed_tiers:
            raise HTTPException(status_code=403, detail="Upgrade Required")

        return user_id  # Pass the ID to the route if it succeeds

    return tier_checker





# (Assuming you still have the get_current_user_id dependency from the previous step)

# --- Route 1: Update User Profile ---
@finance_api_app.put("/users/me", response_model=dict)
def update_profile(
        payload: UserProfileUpdate,
        user: dict = Depends(validate_token)
):
    user_id = get_userid(user.get("sub"))
    # payload.model_dump() converts the Pydantic model into a secure dictionary.
    # exclude_unset=True ensures we only update fields the user actually sent.
    update_data = payload.model_dump(exclude_unset=True)

    # Update MongoDB and return the updated document
    updated_user = db.update_user(user_id,update_data)


    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {"status": "success", "message": "Profile updated successfully"}



# Both Web and Mobile call this when the app loads to populate the UI.

# --- 2. GET USER PROFILE (Calculates Expirations Dynamically) ---
@finance_api_app.get("/users/me", response_model=UserProfileResponse)
def get_my_profile(user: dict = Depends(validate_token)):
    user_id = get_userid(user.get("sub"))
    db_user = db.get_user_details(user_id)

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    current_tier = db_user.get("tier", "free")
    trial_days_left = 0
    tier_expires_at = db_user.get("tier_expires_at")

    # 1. Trial Calculation
    if current_tier == "pro_trial":
        expires = db_user.get("trial_expires_at")
        if expires:
            if datetime.utcnow() > expires:
                # Trial expired! Downgrade them silently.
                db.update_user_tier(user_id, "free")
                #db.user_data.update_one({"_id": user_id}, {"$set": {"tier": "free"}})
                current_tier = "free"
            else:
                delta = expires - datetime.utcnow()
                trial_days_left = max(0, delta.days)

    # 2. Subscription Expiration Calculation (If they cancelled)
    if current_tier in ["basic", "premium"] and tier_expires_at:
        if datetime.utcnow() > tier_expires_at:
            #db.user_data.update_one({"_id": user_id}, {"$set": {"tier": "free"}})
            db.update_user_tier(user_id, "free")
            current_tier = "free"

    return {
        "id": db_user["_id"],
        "email": db_user["email"],
        "name": db_user.get("name", "Ninja"),
        "mobile_number": db_user.get("mobile_number"),
        "country": db_user.get("country"),
        "currency": db_user.get("currency", "NZD"),
        "joined_date": db_user.get("created_at").strftime("%b %Y") if db_user.get("created_at") else "Recently",
        "tier": current_tier,
        "trial_days_left": trial_days_left
    }


# --- 3. THE UNIFIED CHECKOUT ROUTE ---
@finance_api_app.post('/create-checkout-session')
def create_checkout_session(payload: CheckoutRequest, user: dict = Depends(validate_token)):
    user_id = get_userid(user.get("sub"))
    tier_name = payload.tier
    promo = payload.promo_code

    # --- A. Handle Internal Promo Codes (Bypasses Stripe completely) ---
    if promo and promo in INTERNAL_PROMOS:
        promo_details = INTERNAL_PROMOS[promo]

        if promo_details["type"] == "extended_trial":
            expiry = datetime.utcnow() + timedelta(days=promo_details["days"])
            db.update_user_tier(user_id, promo_details["type"],promo)
            #db.user_data.update_one(
            #    {"_id": user_id},
            #    {"$set": {"tier": "pro_trial", "trial_expires_at": expiry, "promo_used": promo}}
            #)
            return {"status": "success", "message": f"Promo applied! Enjoy {promo_details['days']} days free."}

        elif promo_details["type"] == "lifetime":
            db.update_user_tier(user_id, promo_details["type"], promo)
            #db.user_data.update_one(
            #    {"_id": user_id},
            #    {"$set": {"tier": promo_details["tier"], "promo_used": promo}}
            #)
            return {"status": "success", "message": "Lifetime Promo applied!"}

    # --- B. Handle Standard Free Trials ---
    if tier_name == "pro_trial":
        expiry = datetime.utcnow() + timedelta(days=7)
        db.update_trial_details(user_id,"pro_trial", expiry)
        #db.user_data.update_one(
        #    {"_id": user_id},
        #    {"$set": {"tier": "pro_trial", "trial_expires_at": expiry}}
        #)
        return {"status": "success", "message": "7-Day Trial Started!"}

    # --- C. Handle Paid Subscriptions (Stripe / Mock) ---
    price_map = {"premium": "price_1xxxxx", "basic": "price_2xxxxx"}

    if settings.environment == 'Dev':
        # MOCK FLOW
        mock_url = f"http://localhost:5000/mock-payment?tier={tier_name}"
        return {"url": mock_url}
    else:
        # STRIPE FLOW
        try:
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{'price': price_map.get(tier_name), 'quantity': 1}],
                mode='subscription',
                client_reference_id=user_id,
                allow_promotion_codes=True,  # <--- Lets Stripe handle % off discounts!
                success_url="https://yourdomain.com/profile?success=true",
                cancel_url="https://yourdomain.com/profile?canceled=true",
            )
            return {"url": checkout_session.url}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


##### update user data upto this point

# --- 4. MOCK PAYMENT PROCESSOR (For Local Dev) ---
@finance_api_app.post('/process-mock-payment')
def process_mock_payment(payload: CheckoutRequest, user: dict = Depends(validate_token)):
    user_id = get_userid(user.get("sub"))
    tier_name = payload.tier

    # Simulate a 1-month subscription
    renewal_date = datetime.utcnow() + timedelta(days=30)

    payload = {
            "tier": tier_name,
            "billing.payment_status": "active",
            "tier_expires_at": renewal_date,  # When they lose access if they cancel
            "billing.next_billing_date": renewal_date
        }
    set_parameters = payload.model_dump(exclude_unset=True)

    #db.user_data.update_one(
    #    {"_id": user_id},
    #    {"$set": {
    #        "tier": tier_name,
    #3        "billing.payment_status": "active",
    #       "tier_expires_at": renewal_date,  # When they lose access if they cancel
    #        "billing.next_billing_date": renewal_date
    #    },
    #        "$unset": {"trial_expires_at": ""}}  # Wipe out old trial data
    #)
    rows_changed = db.update_renewal_details(user_id, tier_name, renewal_date)
    if rows_changed > 0:
        return {"status": "success", "message": "Mock payment processed."}
    return {"status": "failure", "message": "Mock payment failed."}


# --- 5. STRIPE WEBHOOK (Production) ---
@finance_api_app.post('/stripe-webhook')
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('Stripe-Signature')

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Webhook Error")

    # 1. When they first buy...
    if event['type'] == 'checkout.session.completed':
        session_data = event['data']['object']
        user_id = session_data.get('client_reference_id')
        sub_id = session_data.get('subscription')
        customer_id = session_data.get('customer')

        if user_id:
            # We must fetch the subscription from Stripe to get the renewal date
            subscription = stripe.Subscription.retrieve(sub_id)
            renewal_timestamp = subscription['current_period_end']
            renewal_date = datetime.utcfromtimestamp(renewal_timestamp)



    # 2. When their monthly renewal hits...
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        sub_id = invoice.get('subscription')

        # Extend their access by another month
        subscription = stripe.Subscription.retrieve(sub_id)
        renewal_date = datetime.utcfromtimestamp(subscription['current_period_end'])

        rows_changed = db.update_billing_status(sub_id, renewal_date)

    # 3. If their card declines or they cancel...
    elif event['type'] == 'customer.subscription.deleted':
        sub_id = event['data']['object']['id']
        rows_changed = db.cancel_billing(sub_id)


    return JSONResponse(content={"status": "success"})

# --- Route 3: Get Tier Limits ---
# Mobile and Web call this to know which buttons to lock/unlock in the UI.
@finance_api_app.get("/tiers/{tier_name}", response_model=TierConfigResponse)
def get_tier_config(tier_name: str, user_id: str = Depends(validate_token)):
    config = db.get_tier_configs(user_id)

    if not config:
        # Fallback to safe defaults if the DB document is missing
        return {
            "tier_name": tier_name,
            "max_receipt_scans": 0,
            "history_months": 1,
            "has_cpi_guru": False,
            "has_ai_forecast": False
        }

    return {
        "tier_name": config["_id"],
        "max_receipt_scans": config.get("max_receipt_scans", 0),
        "history_months": config.get("history_months", 1),
        "has_cpi_guru": config.get("has_cpi_guru", False),
        "has_ai_forecast": config.get("has_ai_forecast", False)
    }

def validate_complex_form(payload: str = Form(...)):
    return StatementUploadModel.model_validate_json(payload)


@finance_api_app.post("/upload-statement")
async def upload_bank_statement(
        file: UploadFile = File(...),
        payload: StatementUploadModel = Depends(validate_complex_form),
        user: dict = Depends(validate_token)
):
    user_id = get_userid(user.get("sub"))
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user.")

    # 1. Read the file content
    contents = await file.read()

    bank_hint = payload.bank
    filename = file.filename.lower()
    format_type = filename.split('.')[-1] if '.' in filename else "unknown"

    try:
        bank_info = parser.detect_bank_from_pdf(contents)
        print(f"Bank Detected : {bank_info['bank_key']}")
        print(f"Detected By   : {bank_info['detected_by']}")
        # ── STEP 1: Parse ──────────────────────────────
        parse_result = parser.parse(
            file_contents=contents,
            filename=filename,
            user_hint=bank_hint
        )
        transactions = parse_result["transactions"]

        # ── STEP 2: Normalize + Categorize via ML Model ─────────────
        # Use the shared method!
        enriched, review_count = enrich_transactions_with_ml(transactions, mintra_scan_model)

        # ── STEP 3: Encrypt + Store ─────────────────────
        store_result = db.store_statement(
            user_id=user_id,
            bank=parse_result["bank"],
            transactions=enriched
        )
        logger.info(f"Stored {store_result['count']} transactions for user {user_id}")

        # ── STEP 4: Generate the "Aha!" Insight ─────────
        # Convert the enriched list to a DataFrame for quick math
        df_enriched = pd.DataFrame(enriched)

        # Standardize column names for the insight engine
        if 'category' in df_enriched.columns:
            df_enriched.rename(columns={'category': 'Category'}, inplace=True)
        if 'amount' in df_enriched.columns:
            df_enriched.rename(columns={'amount': 'Amount', 'amount': 'expenses'}, inplace=True)

        insight_data = generate_quick_insight(df_enriched)

        # ── STEP 5: Return Unified Payload ──────────────
        return {
            "success": True,
            "bank": parse_result["bank"],
            "format": parse_result["format"],
            "statement_id": store_result["statement_id"],
            "count": store_result["count"],
            "message": f"Successfully processed {store_result['count']} transactions.",
            "quick_insight": insight_data
        }

    except Exception as e:
        logger.error(f"Upload Statement Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process statement: {str(e)}")


def enrich_transactions_with_ml(raw_transactions: list, ml_model) -> tuple[list, int]:
    """
    Shared categorization engine used by both /upload-statement and /akahu/sync.
    Takes raw transactions, runs the ML model, applies guardrails, and returns enriched data.
    """
    if not raw_transactions:
        return [], 0

    # 1. Extract raw descriptions
    raw_descriptions = [
        txn.get("raw_description", txn.get("description", "Unknown"))
        for txn in raw_transactions
    ]

    # 2. Batch predict
    ml_results = ml_model.predict_batch(raw_descriptions)

    enriched = []
    review_count = 0

    for i, txn in enumerate(raw_transactions):
        ml_data = ml_results[i]
        conf = ml_data.get("confidence", 0.0)
        category = ml_data.get("category", "Uncategorized")

        # A. Strict Threshold
        needs_review = True if conf < 0.85 else False

        # B. Detect if it's a Credit (Income)
        # - PDF Parser sets "transaction_type": "credit"
        # - Akahu uses amount > 0 for income
        is_credit = False
        if txn.get("transaction_type") == "credit":
            is_credit = True
        elif "transaction_type" not in txn and float(txn.get("amount", 0.0)) > 0:
            is_credit = True

        # C. Income Guardrail
        if is_credit and category not in ["Income", "Refund", "Transfer"]:
            category = "Income"
            conf = 0.50
            needs_review = True

        # D. Emoji Flag
        flag = "✅" if conf >= 0.9 else "⚠️" if conf >= 0.75 else "❌"

        if needs_review:
            review_count += 1
        # E. DATE NORMALIZATION (The Fix!)
        # Akahu sends "2026-04-27T00:30:17Z". We only want the first 10 characters "2026-04-27".
        raw_date = str(txn.get("date", ""))
        clean_date = raw_date[:10] if len(raw_date) >= 10 else None

        # Format the final dictionary
        enriched_txn = {
            **txn,  # Keeps existing keys
            "date": clean_date,  # <--- Overwrite the raw Akahu date with our clean YYYY-MM-DD string
            "amount": abs(float(txn.get("amount", 0.0))),  # Ensure DB amount is always positive
            "clean_merchant": txn.get("description", "Unknown"),
            "category": category,
            "ml_confidence": conf,
            "confidence_flag": flag,
            "needs_review": needs_review,
            "transaction_type": "credit" if is_credit else "debit",
            "is_subscription": False,
            "emoji": "🧾"
        }

        # If it came from Akahu, properly map the _id to akahu_id to prevent duplicates
        if "_id" in txn:
            enriched_txn["akahu_id"] = txn["_id"]

        enriched.append(enriched_txn)

    return enriched, review_count

@finance_api_app.post("/receipt-scanner")
async def scan_and_upload_receipts(request:Request, user: dict = Depends(validate_token)):
    file = request.files["file"]

    user_id = get_userid(user.get("sub"))
    auth_header = request.cookies.get('ninja_access_token')

    async def call_fastapi():
        async with httpx.AsyncClient(timeout=60) as client:
            files = {"file": (file.filename, file.stream, file.mimetype)}

            forwarded_headers = {}
            if auth_header:
                # CRITICAL FIX: Format it as a Bearer token!
                forwarded_headers["Authorization"] = f"Bearer {auth_header}"
            response = await client.post(OCR_API_URL, files=files, headers=forwarded_headers)
            return response.json()

    result = asyncio.run(call_fastapi())
    logger.info(result)
    # return jsonify(result)
    receipt_data = {"user_id": user_id, **result}
    key = 'id'
    doc = dataprocessor.normalize(receipt_data)
    db.receipt_collections.insert_one(doc)

# --- Add this to your Pydantic Models section ---
class SecurityUpdateRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )


# --- Add this to your API Routes section ---
@finance_api_app.put("/users/security", response_model=dict)
async def update_security_settings(
        payload: SecurityUpdateRequest,
        user: dict = Depends(validate_token)
):
    # 1. Extract the Logto Subject ID (e.g., 'logto://user_xyz')
    logto_user_id = user.get("sub")

    if not logto_user_id:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    # 2. Call the Logto Management API to change the password
    # NOTE: You will need a Machine-to-Machine (M2M) token from Logto
    # to authenticate this backend-to-backend request.

    try:
        # Example of how you would proxy this to Logto:
        """
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{LOGTO_ENDPOINT}/api/users/{logto_user_id}/password",
                headers={"Authorization": f"Bearer {LOGTO_MANAGEMENT_TOKEN}"},
                json={
                    "oldPassword": payload.current_password,
                    "newPassword": payload.new_password
                }
            )

            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Incorrect current password")
        """

        # For now, we simulate a successful update
        print(f"Simulating password update for {logto_user_id} via Logto API")

        return {"status": "success", "message": "Password updated successfully via Identity Provider"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with Identity Provider: {str(e)}")


class SavingsGoalRequest(BaseModel):
    goal_amount: float
    interval: Literal["monthly", "weekly"]

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

@finance_api_app.post("/users/savings-goal")
async def update_savings_goal(
    payload: SavingsGoalRequest,
    user: dict = Depends(validate_token)
):
    user_id = get_userid(user.get("sub"))
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user.")
    
    result = db.upsert_savings_goal(user_id, payload.goal_amount, payload.interval)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update savings goal.")
    
    return {"status": "success", "message": f"{payload.interval.capitalize()} savings goal updated."}

# --- Planning & AI Endpoints (Refactored from Flask) ---

@finance_api_app.get("/budget-planner")
async def get_budget_plan(request:Request,user: dict = Depends(validate_token)):
    user_id = get_userid(user.get("sub"))
    #auth_header = request.cookies.get('ninja_access_token')
    # 1. Check for Mobile App Token (Bearer Header)
    auth_header = request.headers.get('Authorization')
    try:
        async def call_fastapi():
            async with httpx.AsyncClient(timeout=60) as client:


                forwarded_headers = {}
                if auth_header:
                    # CRITICAL FIX: Format it as a Bearer token!
                    forwarded_headers = {"Authorization": auth_header} if auth_header else {}
                
                # Get current month range
                date_payload = get_current_date_range(user_id, "month")
                response = await client.post(
                    f"{AI_FORECAST_URL}/plan/budget-planner",
                    json=date_payload.model_dump(),
                    headers=forwarded_headers
                )
                return response.json()

        result = await call_fastapi()
        logger.info(result)
        return result
    except Exception as e:
        logger.error(f"AI Service Error: {e}")
        return {"error": "AI Service Unavailable"}


@finance_api_app.get("/weekly-planner")
async def get_weekly_plan(request: Request,user: dict = Depends(validate_token)):
    user_id = get_userid(user.get("sub"))
    #auth_header = request.cookies.get('ninja_access_token')
    # 1. Check for Mobile App Token (Bearer Header)
    auth_header = request.headers.get('Authorization')
    try:
        async def call_fastapi():
            async with httpx.AsyncClient(timeout=60) as client:
                forwarded_headers = {}

                forwarded_headers = {"Authorization": auth_header} if auth_header else {}
                
                # Get current week range
                date_payload = get_current_date_range(user_id, "week")
                response = await client.post(
                    f"{AI_FORECAST_URL}/plan/weekly",
                    json=date_payload.model_dump(),
                    headers=forwarded_headers
                )
                return response.json()

        result = await call_fastapi()
        logger.info(result)
        return result
    except Exception as e:
        logger.error(f"AI Service Error: {e}")
        return {"error": "AI Service Unavailable"}


@finance_api_app.post("/financial-score")
async def get_financial_discipline(request: Request, payload: Optional[BudgetPlanner] = None,
                                   user: dict = Depends(validate_token)):
    auth_header = request.headers.get("Authorization")
    headers = {"Authorization": auth_header} if auth_header else {}

    user_id = get_userid(user.get("sub"))
    if payload is None:
        payload = get_current_date_range(user_id, "month")
    elif payload.savings_goal is None:
        # Even if payload is provided, if savings_goal is missing, fetch it from DB
        payload.savings_goal = db.get_savings_goal(user_id, "monthly")

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            response = await client.post(
                f"{AI_FORECAST_URL}/plan/discipline",
                json=payload.model_dump(by_alias=True),
                headers=headers
            )

            # --- NEW: Catch 404s from the AI Engine ---
            if response.status_code == 404:
                # Return 200 to the frontend so JS processes the empty state cleanly
                return {
                    "status": "DATA_MISSING",
                    "transactionCount": 0,
                    "message": "AI Needs More Fuel. No transactions found."
                }

            # Parse the JSON if it's not a 404
            ai_data = response.json()

            # --- NEW: Catch 200s that contain the missing data flag ---
            # Normalizing both "ai_status" and "status" so the frontend JS definitely catches it
            if ai_data.get("ai_status") == "DATA_MISSING" or ai_data.get("status") == "DATA_MISSING":
                return {
                    "status": "DATA_MISSING",
                    "transactionCount": 0,
                    "message": "AI Needs More Fuel. No transactions found."
                }

            # Throw an exception if it's a real server error (like a 500)
            response.raise_for_status()

            # If everything is awesome, return the actual AI numbers!
            return ai_data

        except httpx.HTTPStatusError as e:
            logger.error(f"AI Service HTTP Error {e.response.status_code}: {e}")
            return {"status": "Offline", "error": "AI Service Unavailable"}
        except Exception as e:
            logger.error(f"AI Service Error: {e}")
            return {"status": "Offline", "error": "AI Service Unavailable"}

@finance_api_app.get("/cpi-forecast")
async def get_cpi_forecast(request: Request, user: dict = Depends(validate_token)):
    auth_header = request.headers.get("Authorization")
    headers = {"Authorization": auth_header} if auth_header else {}

    user_id = get_userid(user.get("sub"))
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            # Get current month range
            date_payload = get_current_date_range(user_id, "month")
            response = await client.post(
                f"{AI_FORECAST_URL}/plan/cpi-forecast", 
                json=date_payload.model_dump(by_alias=True),
                headers=headers
            )
            return response.json()
        except Exception as e:
            logger.error(f"AI Service Error: {e}")
            return {"error": "AI Service Unavailable"}


def generate_quick_insight(categorized_transactions):
    # Standardize our dataframe reference
    df = categorized_transactions

    # Safety check: If there's no data, return a generic message
    if df.empty or 'expenses' not in df.columns:
        return {
            "insightTarget": "Data Scanned",
            "insightValue": "0",
            "insightAction": "No valid expenses found in this statement."
        }

    # 1. Look for Bank Fees / Overdrafts (Highest emotional trigger)
    fees = df[df['Category'] == 'Fees']
    if not fees.empty and fees['expenses'].sum() > 0:
        return {
            "insightTarget": "Bank Fees",
            "insightValue": f"${fees['expenses'].sum():,.2f}",
            "insightAction": "Lost to ATM and overdraft fees. We can help you avoid these."
        }

    # 2. Look for Subscriptions
    subs = df[df['Category'] == 'Subscriptions']
    if not subs.empty and subs['expenses'].sum() > 50:
        return {
            "insightTarget": "Subscriptions",
            "insightValue": f"${subs['expenses'].sum():,.2f}",
            "insightAction": "Identified in recurring bills. Are you actually using all of these?"
        }

    # 3. Look for High Dining/Takeout (Slightly lower threshold to trigger more often)
    dining = df[df['Category'].isin(['EATERY', 'Dining'])]
    if not dining.empty and dining['expenses'].sum() > 200:
        return {
            "insightTarget": "Dining & Takeout",
            "insightValue": f"${dining['expenses'].sum():,.2f}",
            "insightAction": "Spent on food. Cooking two extra meals a week could save you hundreds."
        }

    # 4. NEW: The "Single Largest Expense" Trigger
    # Find the row with the highest expense
    max_expense_idx = df['expenses'].idxmax()
    largest_txn = df.loc[max_expense_idx]

    # Only trigger if it's a significant purchase (e.g., over $500) and not a generic transfer
    if largest_txn['expenses'] > 500 and largest_txn['Category'] not in ['Misc', 'Income']:
        merchant_name = largest_txn.get('clean_merchant', 'an unknown merchant')
        return {
            "insightTarget": "Largest Single Purchase",
            "insightValue": f"${largest_txn['expenses']:,.2f}",
            "insightAction": f"Spent in one go at {merchant_name}. Was this in the budget?"
        }

    # 5. NEW: Dynamic Top Category Trigger
    # Group by category to find out where they spent the most money overall
    cat_totals = df.groupby('Category')['expenses'].sum().sort_values(ascending=False)

    # Filter out boring categories that don't make good insights
    valid_cats = cat_totals[~cat_totals.index.isin(['Misc', 'Transfers', 'Income', 'Uncategorized'])]

    if not valid_cats.empty:
        top_cat = valid_cats.index[0]
        top_amt = valid_cats.iloc[0]

        # Only trigger if they spent a decent amount there
        if top_amt > 150:
            return {
                "insightTarget": f"Top Expense: {top_cat}",
                "insightValue": f"${top_amt:,.2f}",
                "insightAction": f"This was your heaviest spending category this period."
            }

    # 6. The Final Fallback
    total_spent = df['expenses'].sum()
    return {
        "insightTarget": "Total Processed",
        "insightValue": f"${total_spent:,.2f}",
        "insightAction": "Successfully categorized. Let's look at your trend lines."
    }



@finance_api_app.post("/akahu/exchange")
async def exchange_akahu_code(payload: AkahuExchangeRequest, user: dict = Depends(validate_token)):
    user_id = get_userid(user.get("sub"))

    AKAHU_APP_ID = settings.akahu_app_id
    AKAHU_APP_SECRET = settings.akahu_app_secret  # Keep this secret!

    try:
        # 1. Trade the temporary code for a permanent User Token
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.akahu.io/v1/token",
                data={
                    "grant_type": "authorization_code",
                    "code": payload.code,
                    "redirect_uri": payload.redirect_uri,
                    "client_id": AKAHU_APP_ID,
                    "client_secret": AKAHU_APP_SECRET
                }
            )
            resp.raise_for_status()
            token_data = resp.json()

        # 2. Extract the permanent token
        permanent_user_token = token_data.get("access_token")

        # 3. Save it to MongoDB so your 2:00 AM Cron Job can use it!
        # Note: In a production app, you should encrypt this token before saving it to Mongo
        db.update_user(user_id, {"akahu_token": permanent_user_token, "bank_sync_enabled": True})

        return {"status": "success", "message": "Bank connected securely."}

    except Exception as e:
        logger.error(f"Akahu Token Exchange Failed: {e}")
        raise HTTPException(status_code=400, detail="Failed to verify bank connection.")


# ==========================================
# BACKGROUND TASKS
# ==========================================
def background_akahu_sync(user_id: str, raw_akahu_transactions: list):
    """
    Runs in the background using your trained LinearSVC ML Model!
    """
    logger.info(f"MintraScan starting background sync for user {user_id}.")

    # Let the shared method do ALL the heavy lifting!
    final_db_records, review_count = enrich_transactions_with_ml(raw_akahu_transactions, mintra_scan_model)

    # Save securely to DB
    db.store_statement(user_id=user_id, bank="Akahu Sync", transactions=final_db_records)
    logger.info(f"✅ MintraScan finished syncing {len(final_db_records)} items. {review_count} flagged for review.")


# ==========================================
# API ENDPOINTS
# ==========================================
# ==========================================
# FEATURE TOGGLE
# Set to False to use your manual Personal Token for now.
# Change to True when you are ready to use the encrypted OAuth flow!
# ==========================================
USE_SECURE_OAUTH = False

@finance_api_app.post("/akahu/sync")
async def sync_akahu_transactions(background_tasks: BackgroundTasks, user: dict = Depends(validate_token)):
    user_id = get_userid(user.get("sub"))
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user.")

    # Fetch user document once
    db_user = db.user_data.find_one({"_id": user_id})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found in database.")

    active_token = None

    # --- THE FEATURE TOGGLE LOGIC ---
    if USE_SECURE_OAUTH:
        # Production Mode: Use the secure, encrypted Fernet token
        encrypted_token = db_user.get("akahu_connection", {}).get("encrypted_token")
        if encrypted_token:
            from app.security.mintrai_token_encryptor import decrypt_token
            active_token = decrypt_token(encrypted_token)
    else:
        # Interim Mode: Use the raw Personal Token you manually saved in MongoDB
        active_token = db_user.get("akahu_token")

    # Final guardrail
    if not active_token:
        raise HTTPException(status_code=400, detail="Akahu account not connected. Please link your bank.")

    try:
        # ==========================================
        # THE DATE RANGE LOGIC (Industry Standard)
        # ==========================================
        # End date is right now.
        end_date = datetime.now(timezone.utc)

        # Start date is exactly 30 days ago.
        start_date = end_date - timedelta(days=30)

        # Format them to the exact string Akahu requires: "YYYY-MM-DDTHH:MM:SSZ"
        akahu_start = start_date.strftime("%Y-%m-%dT%H:%M:%SZ")
        akahu_end = end_date.strftime("%Y-%m-%dT%H:%M:%SZ")

        logger.info(f"Syncing Akahu data from {akahu_start} to {akahu_end}")

        # 1. Fetch instantly from Akahu with Date Params!
        headers = {
            "Authorization": f"Bearer {active_token}",
            "X-Akahu-ID": settings.akahu_app_token
        }

        # Create the params dictionary
        query_params = {
            "start": akahu_start,
            "end": akahu_end
        }

        async with httpx.AsyncClient() as client:
            # Pass the params into the get request
            resp = await client.get(
                "https://api.akahu.io/v1/transactions",
                headers=headers,
                params=query_params  # <--- HTTPX safely injects them into the URL!
            )
            resp.raise_for_status()
            akahu_data = resp.json()

        raw_transactions = akahu_data.get("items", [])

        if not raw_transactions:
            return {
                "success": True,
                "count": 0,
                "message": f"No new transactions found in the last 30 days."
            }

        # 2. Pass the data to the shared Machine Learning categorization engine
        background_tasks.add_task(background_akahu_sync, user_id, raw_transactions)

        return {
            "success": True,
            "count": len(raw_transactions),
            "message": f"Syncing {len(raw_transactions)} transactions from the last 30 days."
        }

    except Exception as e:
        logger.exception(f"Akahu Sync Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to pull data from bank. Please check your token.")


# ---------------------------------------------------------
# METHOD 1: Review Transaction & Flag for AI Training
# ---------------------------------------------------------
@finance_api_app.post("/transactions/review")
async def review_transaction(
        payload: TransactionReviewPayload,
        user_jwt: dict = Depends(validate_token),

):
    """
    Updates the transaction category. If update_similar is True, it updates
    all transactions matching the same description. Flags for AI training if requested.
    """
    #user_id = user_jwt.get("sub")
    user_id = get_userid(user_jwt.get("sub"))
    # Step 1: Fetch the original transaction
    original_txn = await db.get_transaction_by_id(user_id, payload.txn_id)
    if not original_txn:
        raise HTTPException(status_code=404, detail="Transaction not found or unauthorized.")

    # Step 2: Extract the description (Change "description" to whatever field holds "EROAD")
    description_to_match = original_txn.get("Description")

    if not description_to_match:
        raise HTTPException(status_code=422, detail="Transaction has no description to match against.")

    # Step 3: Perform the update (Bulk or Single)
    updated_count = 0
    if payload.update_similar:
        updated_count = await db.update_similar_transactions(
            user_id=user_id,
            description=description_to_match,
            new_category=payload.category_value
        )
    else:
        # Fallback if the user only wants to update a single transaction
        result = await db.transactions.update_one(
            {"_id": original_txn["_id"]},
            {"$set": {"category_value": payload.category_value, "updated_at": datetime.utcnow()}}
        )
        updated_count = result.modified_count

    # Step 4: Handle the AI Training Flag
    if payload.training_required:
        training_data = {
            "user_id": user_id,
            "raw_description": description_to_match,
            "corrected_category": payload.category_value,
            "updated_by": payload.updated_by,
            "flagged_at": datetime.utcnow()
        }
        await db.flag_for_ai_training(training_data)

    return {
        "status": "success",
        "message": f"Successfully updated {updated_count} transaction(s).",
        "data": {
            "description_matched": description_to_match,
            "transactions_updated": updated_count,
            "new_category": payload.category_value,
            "training_flagged": payload.training_required
        }
    }


# ---------------------------------------------------------
# METHOD 2: Transaction Enquiry / Enrichment
# ---------------------------------------------------------
@finance_api_app.post("/transactions/enquiry")
async def transaction_enquiry(
        request_data: TransactionEnquiryRequest,
        user_jwt: dict = Depends(validate_token)
):
    """
    Simulates sending raw transaction strings to an AI/Enrichment engine
    and returning formatted merchant, category, and location data.
    """
    user_id = get_userid(user_jwt.get("sub"))
    # --- YOUR ENRICHMENT LOGIC GOES HERE ---
    # In production, you would pass request_data.items to your AI or Akahu API.
    # For now, we are returning the exact mocked JSON response you provided.

    return {
        "success": True,
        "items": [
            {
                "id": "1",
                "query": "CJ PALMERSTON NTH - 203PALM NTH",
                "results": [
                    {
                        "confidence": 0.99,
                        "category": {
                            "_id": "nzfcc_ckouvvywi004508mlacrd41wf",
                            "name": "Fast food stores",
                            "groups": {
                                "personal_finance": {
                                    "_id": "group_clasr0ysw0011hk4m6hlk9fq0",
                                    "name": "Lifestyle"
                                }
                            }
                        },
                        "merchant": {
                            "_id": "merchant_cjjwm2gy5004bguzydvu4dttf",
                            "name": "Carl's Jr.",
                            "logo": "https://cdn.akahu.nz/logos/merchants/merchant_cjjwm2gy5004bguzydvu4dttf",
                            "website": "https://www.carlsjr.co.nz",
                            "tags": []
                        },
                        "outlet": {
                            "_id": "outlet_cm0lyuatv000008jy9kwr2t8f",
                            "name": "Carl's Jr. Palmerston North",
                            "phone": "06 358 5075",
                            "location": {
                                "accuracy": "establishment",
                                "formatted": "415 Ferguson Street, Palmerston North Central, Palmerston North 4410, New Zealand",
                                "address": {
                                    "street": "415 Ferguson Street",
                                    "suburb": "Palmerston North Central",
                                    "city": "Palmerston North",
                                    "region": "Manawatū-Whanganui",
                                    "country": "New Zealand",
                                    "postal_code": "4410"
                                },
                                "coordinates": {
                                    "lat": -40.3575,
                                    "lon": 175.6175
                                }
                            },
                            "tags": []
                        }
                    }
                ]
            },
            {
                "id": "2",
                "query": "CARD 2293 WHOLEMEAL TRAD CO LTDTAKAKA",
                "results": [
                    {
                        "confidence": 0.99,
                        "category": {
                            "_id": "nzfcc_ckouvvyw1004408mlhy158i7j",
                            "name": "Cafes and restaurants",
                            "groups": {
                                "personal_finance": {
                                    "_id": "group_clasr0ysw0011hk4m6hlk9fq0",
                                    "name": "Lifestyle"
                                }
                            }
                        },
                        "merchant": {
                            "_id": "merchant_cksxp1au3001g09mp3ilt01tz",
                            "name": "The Wholemeal Cafe",
                            "logo": "https://cdn.akahu.nz/logos/merchants/merchant_cksxp1au3001g09mp3ilt01tz",
                            "website": "http://www.wholemealcafe.co.nz/",
                            "phone": "03 525 9426",
                            "location": {
                                "accuracy": "establishment",
                                "formatted": "7110/60 Commercial Street, Tākaka 7110, New Zealand",
                                "address": {
                                    "street": "7110/60 Commercial Street",
                                    "city": "Tākaka",
                                    "region": "Tasman",
                                    "country": "New Zealand",
                                    "postal_code": "7110"
                                },
                                "coordinates": {
                                    "lat": -40.8586533,
                                    "lon": 172.8063369
                                }
                            },
                            "tags": []
                        }
                    }
                ]
            }
        ]
    }


class TosAgreementPayload(BaseModel):
    version: str

# Path to your JSON file
# 1. Get the directory where finance_api.py lives (e.g., .../app/api)
current_dir = os.path.dirname(__file__)
legal_dir = os.path.abspath(
os.path.join(current_dir, "../..", "legal"))



# 2. Go up one level to the 'app' folder, then down into 'data'
LEGAL_FILE_PATH =  os.path.join(legal_dir,"nz", "legal_contents.json")

# Optional: Print this once during startup to verify
print(f"LEGAL_FILE_PATH is: {LEGAL_FILE_PATH}")

@lru_cache()
def load_legal_json():
    """Reads the JSON file from disk once and caches it in memory."""
    try:
        with open(LEGAL_FILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        # Fallback in case the file is missing or corrupted
        return {
            "version": "0.0",
            "disclaimer": "Legal content temporarily unavailable.",
            "tos": "Error loading terms.",
            "insights_footer": ""
        }


@finance_api_app.get("/legal/content")
async def get_legal_content(
        user_jwt: dict = Depends(validate_token)
):
    user_id = get_userid(user_jwt.get("sub"))
    user_record = await db.get_user_profile(user_id)

    # Load the static content from our JSON utility
    legal_data = load_legal_json()

    # Determine if the user has already agreed to the CURRENT version
    current_version = legal_data.get("version")
    user_agreed_version = user_record.get("tos_version") if user_record else None

    # Logic: They are "agreed" ONLY if they have ticked the box AND the version matches
    has_agreed = (
            user_record.get("has_agreed_to_tos", False) and
            user_agreed_version == current_version
    )

    return {
        "user_status": {
            "has_agreed": has_agreed,
            "agreed_version": user_agreed_version,
            "current_version": current_version
        },
        "content": legal_data
    }


@finance_api_app.post("/legal/agree")
async def accept_tos(payload: TosAgreementPayload, user_jwt: dict = Depends(validate_token)):
    """Call this when the user ticks the box and clicks 'Continue'."""
    user_id = get_userid(user_jwt.get("sub"))
    await db.update_user_tos_agreement(user_id, payload.version)
    return {"status": "success", "message": "Agreement recorded."}


@finance_api_app.post("/bootstrap")
async def bootstrap(user_jwt: dict = Depends(validate_token)):
    user_id = user_jwt.get("sub")
    state = await db.get_onboarding_state(user_id)
    user_profile = await db.get_user_profile(user_id)  # Logto data + MongoDB profile

    # Required steps constant
    # Billing/plan is optional during onboarding; users can upgrade anytime in Settings.
    REQUIRED = ["profile", "security", "banks", "goals", "categories", "ai", "notifications"]

    completed = state.get("completed_steps", ["legal"]) if state else ["legal"]
    # Logic to find the first required step that isn't in completed_steps
    current = next((s for s in REQUIRED if s not in completed), "complete")

    return {
        "status": "success",
        "is_new_user": state is None,
        "onboarding_complete": state.get("onboarding_complete", False) if state else False,
        "onboarding": {
            "current_step": current,
            "completed_steps": completed,
            "required_steps": REQUIRED
        },
        "profile": {
            "user_id": user_id,
            "name": user_profile.get("name", "New User"),
            "email": user_profile.get("email"),
            "tier": user_profile.get("tier", "free"),
            "default_currency": user_profile.get("default_currency", "NZD")
        },
        "routing": {
            "dashboard_type": "full" if state and state.get("onboarding_complete") else "onboarding",
            "redirect_to_license": False
        }
    }


@finance_api_app.get("/settings/workflow/{step}")
async def get_workflow_step(step: str, user_jwt: dict = Depends(validate_token)):
    state = await db.get_onboarding_state(user_jwt.get("sub"))
    if not state or step not in state.get("step_data", {}):
        raise HTTPException(status_code=404, detail="Step data not found")

    return {
        "step": step,
        "version": state.get("version", 1),
        "updated_at": state.get("updated_at"),
        "data": state["step_data"].get(step)
    }


@finance_api_app.get("/settings/workflow")
async def get_full_workflow(user_jwt: dict = Depends(validate_token)):
    state = await db.get_onboarding_state(user_jwt.get("sub"))
    return {
        "onboarding_complete": state.get("onboarding_complete", False) if state else False,
        "current_step": state.get("current_step", "profile") if state else "profile",
        "steps": state.get("step_data", {}) if state else {}
    }


@finance_api_app.put("/settings/workflow/{step}")
async def save_workflow_step(
        step: str,
        payload: WorkflowSaveRequest,
        user_jwt: dict = Depends(validate_token)\
):
    # Optional: Add Pydantic validation per step here
    # if step == "profile": ProfileStep(**payload.data)

    user_id = user_jwt.get("sub")
    new_state = await db.save_onboarding_step(user_id, step, payload.data, payload.mark_complete)

    completed = new_state.get("completed_steps", [])
    # Billing/plan is optional during onboarding; users can upgrade anytime in Settings.
    REQUIRED = ["profile", "security", "banks", "goals", "categories", "ai", "notifications"]
    next_step = next((s for s in REQUIRED if s not in completed), "complete")

    return {
        "ok": True,
        "step": step,
        "completed_steps": completed,
        "next_step": next_step,
        "onboarding_complete": next_step == "complete"
    }


@finance_api_app.post("/onboarding/complete")
async def complete_onboarding(
        user_jwt: dict = Depends(validate_token)
):
    user_id = user_jwt.get("sub")

    # 1. Fetch the full final state to return to the user
    final_state = await db.get_onboarding_state(user_id)

    # 2. Mark the onboarding as complete in the DB
    await db.db["user_onboarding_state"].update_one(
        {"user_id": user_id},
        {"$set": {
            "onboarding_complete": True,
            "completed_at": datetime.utcnow()
        }}
    )

    return {
        "ok": True,
        "message": "Onboarding successful",
        "redirect_target": "/transactions",  # Hint for the frontend
        "onboarding_summary": {
            "user_id": user_id,
            "completed_at": datetime.utcnow().isoformat(),
            "config_snapshot": final_state.get("step_data", {}),
            "version": final_state.get("version", 1)
        }
    }