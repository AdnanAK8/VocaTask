from typing import Optional, Literal
from pydantic import BaseModel, Field

AuthProvider = Literal["email", "phone", "google", "facebook"]

class User(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    provider: AuthProvider
    avatar_url: Optional[str] = None
    created_at: str
    last_login_at: Optional[str] = None

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Full name of user")
    email: str = Field(..., min_length=3, max_length=120, description="Email address")
    password: str = Field(..., min_length=6, max_length=100, description="Password")

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=120)
    password: str = Field(..., min_length=1)

class PhoneOtpRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=25, description="Mobile number with country code")
    name: Optional[str] = Field(default=None, max_length=100, description="User's name")

class PhoneVerifyRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=25)
    otp: str = Field(..., min_length=4, max_length=10)
    name: Optional[str] = Field(default=None, max_length=100)

class SocialAuthRequest(BaseModel):
    token: str = Field(..., description="OAuth Token, ID token, or access credential")
    name: Optional[str] = Field(default=None, description="User full name")
    email: Optional[str] = Field(default=None, description="User email")
    avatar_url: Optional[str] = Field(default=None, description="Profile avatar picture URL")

class AuthResponse(BaseModel):
    success: bool = True
    user: User
    token: str
    message: str = "Authentication successful"

class OtpResponse(BaseModel):
    success: bool = True
    message: str
    phone: str
    test_otp: Optional[str] = None
    expires_in_seconds: int = 600

class AuthConfigResponse(BaseModel):
    google_client_id: str
    facebook_app_id: str
    is_development: bool
