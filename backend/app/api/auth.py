import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status
from app.core.database import DatabaseUnavailableError

from app.core.config import settings
from app.schemas.auth import (
    User,
    RegisterRequest,
    LoginRequest,
    PhoneOtpRequest,
    PhoneVerifyRequest,
    SocialAuthRequest,
    AuthResponse,
    OtpResponse,
    AuthConfigResponse
)
from app.services import auth_store

logger = logging.getLogger("auth_api")
router = APIRouter(prefix="/auth", tags=["Authentication"])

def get_current_user_from_header(authorization: Optional[str] = Header(None)) -> Optional[User]:
    """Helper to extract user from Authorization header if present."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ", 1)[1].strip()
    payload = auth_store.decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return auth_store.get_user_by_id(user_id)

@router.get("/config", response_model=AuthConfigResponse)
async def get_auth_config():
    """Return public OAuth configuration so frontend can initialize Google and Facebook SDKs."""
    return AuthConfigResponse(
        google_client_id=settings.GOOGLE_CLIENT_ID,
        facebook_app_id=settings.FACEBOOK_APP_ID,
        is_development=True
    )

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest):
    """Register a new user with Name, Email, and Password."""
    try:
        user, token = auth_store.register_email_user(
            name=body.name,
            email=body.email,
            password=body.password
        )
        return AuthResponse(
            success=True,
            user=user,
            token=token,
            message="Registration successful! Welcome to VocaTask AI."
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DatabaseUnavailableError:
        raise
    except Exception as e:
        logger.error("Error during registration (%s)", type(e).__name__)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Registration failed.")

@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    """Authenticate an existing user with Email and Password."""
    try:
        user, token = auth_store.login_email_user(
            email=body.email,
            password=body.password
        )
        return AuthResponse(
            success=True,
            user=user,
            token=token,
            message=f"Welcome back, {user.name}!"
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except DatabaseUnavailableError:
        raise
    except Exception as e:
        logger.error("Error during login (%s)", type(e).__name__)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed.")

@router.post("/phone/send-otp", response_model=OtpResponse)
def send_phone_otp(body: PhoneOtpRequest):
    """Generate and dispatch a 6-digit OTP code to the user's mobile number."""
    try:
        otp_code, expires_in = auth_store.generate_phone_otp(
            phone=body.phone,
            name=body.name
        )
        return OtpResponse(
            success=True,
            message=f"OTP sent successfully to {body.phone}. Valid for 10 minutes.",
            phone=body.phone,
            test_otp=otp_code,  # Provided in dev/testing mode so user can test seamlessly
            expires_in_seconds=expires_in
        )
    except DatabaseUnavailableError:
        raise
    except Exception as e:
        logger.error("Error generating OTP (%s)", type(e).__name__)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send OTP.")

@router.post("/phone/verify", response_model=AuthResponse)
def verify_phone(body: PhoneVerifyRequest):
    """Verify phone OTP and authenticate or provision user account."""
    try:
        user, token = auth_store.verify_phone_otp(
            phone=body.phone,
            code=body.otp,
            name=body.name
        )
        return AuthResponse(
            success=True,
            user=user,
            token=token,
            message=f"Phone verified! Welcome, {user.name}."
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DatabaseUnavailableError:
        raise
    except Exception as e:
        logger.error("Error verifying phone OTP (%s)", type(e).__name__)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Phone verification failed.")

@router.post("/google", response_model=AuthResponse)
async def google_auth(body: SocialAuthRequest):
    """Authenticate via Google Sign-In / Google Identity Services API."""
    try:
        user, token = await auth_store.authenticate_google(
            token=body.token,
            name_hint=body.name,
            email_hint=body.email,
            avatar_hint=body.avatar_url
        )
        return AuthResponse(
            success=True,
            user=user,
            token=token,
            message=f"Google authentication successful! Welcome, {user.name}."
        )
    except DatabaseUnavailableError:
        raise
    except Exception as e:
        logger.error(f"Error in Google authentication: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Google authentication failed.")

@router.post("/facebook", response_model=AuthResponse)
async def facebook_auth(body: SocialAuthRequest):
    """Authenticate via Facebook Login SDK & Graph API."""
    try:
        user, token = await auth_store.authenticate_facebook(
            token=body.token,
            name_hint=body.name,
            email_hint=body.email,
            avatar_hint=body.avatar_url
        )
        return AuthResponse(
            success=True,
            user=user,
            token=token,
            message=f"Facebook authentication successful! Welcome, {user.name}."
        )
    except DatabaseUnavailableError:
        raise
    except Exception as e:
        logger.error(f"Error in Facebook authentication: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Facebook authentication failed.")

@router.get("/me", response_model=User)
def get_current_user_profile(authorization: Optional[str] = Header(None)):
    """Retrieve current logged in user profile."""
    user = get_current_user_from_header(authorization)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired authentication session.")
    return user

@router.post("/logout")
async def logout():
    """Logout endpoint."""
    return {"success": True, "message": "Successfully logged out."}
