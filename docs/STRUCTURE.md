# STRUCTURE

## Backend (FastAPI + PostgreSQL)
- Modular structure, separating API, models, services and schemas.
- Relational database with SQLAlchemy to handle migrations.
- Integration with AI in a separate module.
- Bioinformatics services organized in the biotools folder.

## Frontend (React + Tailwind)
- Standalone web client that consumes the backend API.

## Infrastructure
- Use of Docker for containerization.
- PostgreSQL database in a separate service.
- Authentication with JWT in the backend.