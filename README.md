# CM Kerala — Public Grievance Redressal Portal

A full-stack recruitment demonstration for WhiteMatrix Software Solutions. Citizens submit and track grievances; CMO administrators coordinate assignments and review reports; department officers investigate assigned cases. Gemini assistance is advisory, not an official decision-maker.

This is an independent prototype, not an official Government of Kerala service. Use fictional data only.

## Features

- Public information pages, departments, FAQ and contact enquiries.
- Citizen registration, dashboard, grievance submission, authenticated tracking, history, evidence interfaces and resolution feedback.
- CMO register, assignments, priorities, escalation, analytics, report approval and reopening.
- Department-scoped officer workspace, investigation updates and Action Taken Reports.
- JWT sessions, rotating HttpOnly refresh cookies, CSRF checks, revocation and three-role authorization.
- Gemini/LangChain classification and report review; PostgreSQL/pgvector duplicate shortlisting.
- Private Supabase Storage adapter with authorization before signed downloads.

## Stack and structure

React 19, Vite, Tailwind CSS, React Router and Axios communicate with a synchronous FastAPI modular monolith. SQLAlchemy 2 and Alembic manage PostgreSQL; Supabase provides managed PostgreSQL and optional private object storage. Application authentication is independent of Supabase Auth.

```text
backend/        API, ORM, migrations, guarded utilities and tests
frontend/       Public, Citizen, CMO and Officer interfaces
DOCUMENTATION/  Seven assignment documents
render.yaml     Native Python backend deployment blueprint
```

## Run locally

See [Setup and Testing](DOCUMENTATION/06_Setup_and_Testing.md) for environment preparation and database safeguards. Python 3.12+ and Node 22.12+ are required.

```sh
cd backend
python -m venv .venv
# Activate the virtual environment for your shell.
pip install -r requirements-dev.txt
# Copy .env.example to .env and privately configure database/JWT values.
# Only on a new, explicitly selected local database:
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On a PostgreSQL server without pgvector, explicitly use revision `0007` instead of `head`. Existing hosted databases must be inspected, not reinitialized.

In a second terminal:

```sh
cd frontend
npm ci
# Copy .env.example to .env.local.
npm run dev -- --port 5173 --strictPort
```

OpenAPI is available at backend `/docs` and `/openapi.json`. Never put backend secrets in `VITE_*` variables.

## Verification and deployment

Backend tests require an empty loopback PostgreSQL database ending in `_test`; never use a hosted application database. Gemini and Storage are mocked. Clean-copy verification: **486 backend tests passed, 3 pgvector tests skipped; 195 frontend tests passed**. Both default and AI-enabled builds, Ruff, compilation and dependency checks passed. Details and limitations are recorded in [Setup and Testing](DOCUMENTATION/06_Setup_and_Testing.md).

Render runs `backend/` natively with Uvicorn. Vercel uses `frontend/`, Vite and the included SPA rewrite. Exact HTTPS CORS/CSRF origins and secure cookie settings are required. Separate Render/Vercel domains may encounter third-party cookie restrictions; use same-site custom domains or a reviewed proxy if needed.

Hosted frontend, backend and GitHub URLs: not yet provisioned or verified. No placeholder deployment is represented as live.

## Documentation

1. [Project Overview](DOCUMENTATION/01_Project_Overview.md)
2. [System Architecture](DOCUMENTATION/02_System_Architecture.md)
3. [Database Design](DOCUMENTATION/03_Database_Design.md)
4. [API Documentation](DOCUMENTATION/04_API_Documentation.md)
5. [AI Integration](DOCUMENTATION/05_AI_Integration.md)
6. [Setup and Testing](DOCUMENTATION/06_Setup_and_Testing.md)
7. [User Guide](DOCUMENTATION/07_User_Guide.md)
