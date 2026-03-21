# app/auth/oauth_service.py

import json
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple

import httpx
from fastapi import HTTPException, status, Request
from sqlalchemy.orm import Session

from app.auth.models import User, OAuthAccount
from app.auth.service import create_user_token
from app.config import settings

logger = logging.getLogger(__name__)

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# Keep track of recently used codes to prevent reuse
# Structure: {code: timestamp}
recently_used_codes = {}
# How long to keep codes in memory (in seconds)
CODE_EXPIRY = 300  # 5 minutes

async def cleanup_used_codes():
    """Remove expired codes from memory"""
    now = datetime.utcnow()
    expired_codes = []
    
    for code, timestamp in recently_used_codes.items():
        if (now - timestamp).total_seconds() > CODE_EXPIRY:
            expired_codes.append(code)
    
    for code in expired_codes:
        del recently_used_codes[code]
    
    if expired_codes:
        logger.info(f"Cleaned up {len(expired_codes)} expired OAuth codes")

async def generate_google_auth_url(state: Optional[str] = None, request: Optional[Request] = None) -> str:
    """Generate Google OAuth authorization URL with appropriate redirect URI"""
    if not state:
        state = secrets.token_urlsafe(32)
    
    # Determine the appropriate redirect URI
    redirect_uri = settings.GOOGLE_REDIRECT_URI
    
    # Log the selected URI for debugging
    logger.info(f"Using Google OAuth redirect URI: {redirect_uri}")
    logger.info(f"Current environment: {settings.ENVIRONMENT}")
    
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "email profile",
        "state": state,
        "prompt": "select_account",
        # Add access_type=offline to get a refresh token
        "access_type": "offline"
    }
    
    # Construir URL con parámetros
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    auth_url = f"{GOOGLE_AUTH_URL}?{query_string}"
    
    return auth_url

async def get_google_token(code: str) -> Dict[str, Any]:
    """Exchange authorization code for access token"""
    # Check if code was recently used to prevent duplicate calls
    if code in recently_used_codes:
        logger.warning(f"Attempted to reuse OAuth code: {code[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code has already been used"
        )
    
    # Mark this code as used
    recently_used_codes[code] = datetime.utcnow()
    
    # Clean up expired codes periodically
    await cleanup_used_codes()
    
    # Get the appropriate redirect URI
    redirect_uri = settings.GOOGLE_REDIRECT_URI
    
    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri
    }
    
    # Log the token exchange attempt
    logger.info(f"Attempting token exchange with redirect_uri: {redirect_uri}")
    logger.info(f"Current environment is: {settings.ENVIRONMENT}")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(GOOGLE_TOKEN_URL, data=data)
            
        if response.status_code != 200:
            logger.error(f"Google token error: {response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to retrieve Google token"
            )
            
        return response.json()
    
    except httpx.TimeoutException:
        logger.error("Google token request timed out")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Google authentication timed out"
        )
    except Exception as e:
        logger.error(f"Unexpected error in get_google_token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing Google authentication"
        )

async def get_google_user_info(access_token: str) -> Dict[str, Any]:
    """Get user info using access token"""
    headers = {"Authorization": f"Bearer {access_token}"}
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(GOOGLE_USER_INFO_URL, headers=headers)
            
        if response.status_code != 200:
            logger.error(f"Google user info error: {response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to retrieve user information"
            )
            
        return response.json()
    
    except httpx.TimeoutException:
        logger.error("Google user info request timed out")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Google user info request timed out"
        )
    except Exception as e:
        logger.error(f"Unexpected error in get_google_user_info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing Google user information"
        )

async def authenticate_google_user(db: Session, code: str) -> Dict[str, str]:
    """Authenticate user with Google OAuth"""
    try:
        logger.info(f"Starting Google authentication process with code: {code[:10]}...")
        
        # Get tokens from Google
        token_data = await get_google_token(code)
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        
        logger.info("Google token obtained successfully")
        
        # Calculate expiration time if available
        expires_at = None
        if "expires_in" in token_data:
            expires_in = token_data.get("expires_in")
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        # Get user info from Google
        user_info = await get_google_user_info(access_token)
        
        # Extract Google user ID and email
        google_id = user_info.get("sub")
        email = user_info.get("email")
        name = user_info.get("name")
        
        logger.info(f"Retrieved user info from Google: {email}")
        
        if not google_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user information from Google"
            )
        
        # Check if OAuth account exists
        oauth_account = db.query(OAuthAccount).filter(
            OAuthAccount.provider == "google",
            OAuthAccount.provider_user_id == google_id
        ).first()
        
        if oauth_account:
            logger.info(f"Found existing OAuth account for user: {email}")
            # Update access token
            oauth_account.access_token = access_token
            if refresh_token:
                oauth_account.refresh_token = refresh_token
            if expires_at:
                oauth_account.expires_at = expires_at
                
            db.commit()
            db.refresh(oauth_account)
            
            user = oauth_account.user
        else:
            # Check if user with this email exists
            user = db.query(User).filter(User.email == email).first()
            
            if user:
                logger.info(f"Linking existing user account with OAuth: {email}")
                # Link existing user with OAuth account
                oauth_account = OAuthAccount(
                    user_id=user.id,
                    provider="google",
                    provider_user_id=google_id,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_at=expires_at
                )
                
                # Mark as OAuth account
                user.is_oauth_account = True
                
                db.add(oauth_account)
                db.commit()
                db.refresh(user)
            else:
                logger.info(f"Creating new user account from OAuth: {email}")
                # Create new user with OAuth account
                user = User(
                    email=email,
                    full_name=name,
                    is_oauth_account=True
                )
                
                db.add(user)
                db.commit()
                db.refresh(user)
                
                # Create OAuth account
                oauth_account = OAuthAccount(
                    user_id=user.id,
                    provider="google",
                    provider_user_id=google_id,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_at=expires_at
                )
                
                db.add(oauth_account)
                db.commit()
        
        logger.info(f"Authentication successful, generating JWT token for: {email}")
        # Generate JWT token
        return create_user_token(user)
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in authenticate_google_user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error during Google authentication"
        )