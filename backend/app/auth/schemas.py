from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field, HttpUrl


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    language_preference: str = "en"
    dark_mode: bool = False


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    language_preference: Optional[str] = None
    dark_mode: Optional[bool] = None


class UserUpdatePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    is_oauth_account: Optional[bool] = False

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OAuthAccountBase(BaseModel):
    provider: str
    provider_user_id: str


class OAuthAccountCreate(OAuthAccountBase):
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None


class OAuthAccountResponse(OAuthAccountBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Esquema para iniciar el flujo OAuth
class OAuthStartRequest(BaseModel):
    redirect_uri: Optional[str] = None


# Esquema para completar el flujo OAuth
class OAuthCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None