from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import logging
import secrets
from datetime import datetime, timedelta  # Añadida importación para timedelta
from fastapi.responses import RedirectResponse

from app.auth import schemas, service, oauth_service
from app.auth.models import User
from app.database import get_db
from app.security import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

# Almacén mejorado para estados de OAuth con tiempo de expiración más largo
oauth_states = {}

# Tiempo de expiración para estados OAuth (30 minutos)
OAUTH_STATE_EXPIRY = 30  # minutos

# Función para limpiar estados expirados
def cleanup_expired_states():
    """Elimina estados OAuth expirados del almacén temporal"""
    now = datetime.utcnow()
    expired_states = []
    
    for state, data in oauth_states.items():
        created_at = datetime.fromisoformat(data["created_at"])
        if now - created_at > timedelta(minutes=OAUTH_STATE_EXPIRY):
            expired_states.append(state)
    
    for state in expired_states:
        del oauth_states[state]
    
    if expired_states:
        logger.info(f"Limpiados {len(expired_states)} estados OAuth expirados")

# OPTIONS handler for CORS preflight requests
@router.options("/{path:path}")
async def auth_options_handler():
    return {}

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        return service.create_user(db, user_data)
    except ValueError as e:
        logger.warning(f"Registration validation error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Registration error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during registration"
        )

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 compatible token login"""
    try:
        user = service.authenticate_user(db, form_data.username, form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return service.create_user_token(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token login error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )

@router.post("/login", response_model=schemas.Token)
async def login(request: Request, db: Session = Depends(get_db)):
    """Login user and return access token"""
    try:
        # Get request content based on content type
        content_type = request.headers.get('Content-Type', '')
        
        try:
            if "application/json" in content_type:
                login_data = await request.json()
                email = login_data.get("email", "")
                password = login_data.get("password", "")
            else:
                form_data = await request.form()
                email = form_data.get("email", "") or form_data.get("username", "")
                password = form_data.get("password", "")
        except Exception:
            logger.error("Failed to parse request body", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request format"
            )
        
        # Validate required fields
        if not email or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Email and password are required"
            )
            
        # Authenticate the user
        user = service.authenticate_user(db, email, password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create and return the token
        return service.create_user_token(user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected login error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@router.patch("/me", response_model=schemas.UserResponse)
def update_user_me(
    user_data: schemas.UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user information"""
    try:
        return service.update_user(db, current_user.id, user_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Update user error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error while updating user"
        )

@router.post("/change-password", response_model=schemas.UserResponse)
def change_password(
    password_data: schemas.UserUpdatePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user password"""
    try:
        return service.update_user_password(
            db, current_user.id, password_data.current_password, password_data.new_password
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Change password error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error while changing password"
        )

# --- OAuth Routes ---

# Update router.py Google login path

@router.get("/google/login")
async def google_login(request: Request, response: Response):
    """Iniciar flujo de autenticación con Google"""
    try:
        # Limpiar estados expirados periódicamente
        cleanup_expired_states()
        
        # Generar estado único para prevenir CSRF
        state = secrets.token_urlsafe(32)
        
        # Guardar estado en memoria con tiempo de expiración
        oauth_states[state] = {
            "created_at": datetime.utcnow().isoformat(),
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent", ""),
            "origin": request.headers.get("origin", ""),
            "host": request.headers.get("host", "")
        }
        
        logger.info(f"Generado nuevo estado OAuth: {state[:10]}... desde {request.headers.get('host', 'unknown')}")
        
        # Obtener URL de autenticación de Google
        auth_url = await oauth_service.generate_google_auth_url(state, request)
        
        # Redirigir al usuario a Google
        return {"auth_url": auth_url}
        
    except Exception as e:
        logger.error(f"Error iniciando OAuth con Google: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al iniciar autenticación con Google"
        )

@router.get("/google/callback")
async def google_callback(
    code: str,
    state: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Manejar callback de Google OAuth"""
    try:
        # Verificar si el estado existe
        state_valid = state in oauth_states
        
        # Intento de obtener información del estado
        state_info = "N/A"
        if state_valid:
            state_info = oauth_states[state]
            # Eliminar el estado después de usarlo
            del oauth_states[state]
            logger.info(f"Estado OAuth eliminado después de verificación: {state[:10]}...")
        else:
            logger.warning(f"Estado OAuth no encontrado o inválido: {state[:10]}...")
            # Si el estado no es válido, rechazamos la autenticación
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OAuth state"
            )
        
        # Registrar información para diagnóstico
        logger.info(f"Callback OAuth recibido - Estado: {'válido' if state_valid else 'inválido'}, Code: {code[:10]}...")
        logger.info(f"Información de request: IP={request.client.host if request.client else 'unknown'}, UA={request.headers.get('user-agent', '')[:50]}...")
        
        try:
            # Intentar autenticar el usuario
            token_data = await oauth_service.authenticate_google_user(db, code)
            return token_data
        except Exception as e:
            logger.error(f"Google authentication error: {str(e)}", exc_info=True)
            raise
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google OAuth callback error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing Google authentication"
        )