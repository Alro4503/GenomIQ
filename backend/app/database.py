from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

# Create SQLAlchemy engine
engine = create_engine(settings.DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for ORM models
Base = declarative_base()


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Function to initialize database (create tables)
from sqlalchemy import text
import os

# Function to initialize database (create tables)
def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Ejecutar el script SQL para insertar el proveedor de IA
    db = SessionLocal()
    try:
        # Verificar si ya existe el proveedor para evitar duplicados
        from sqlalchemy import text
        result = db.execute(
            text("SELECT COUNT(*) FROM ai_providers WHERE name = 'openrouter'")
        ).scalar()
        
        # Solo insertar si no existe
        if result == 0:
            sql_script_path = os.path.join(os.path.dirname(__file__), "../ai_provider.sql")
            with open(sql_script_path, "r") as f:
                sql_script = f.read()
            
            db.execute(text(sql_script))
            db.commit()
            print("Proveedor de IA insertado correctamente")
        else:
            print("Proveedor de IA ya existe, saltando inserción")
            
    except Exception as e:
        print(f"Error al ejecutar script SQL: {e}")
    finally:
        db.close()