# Setup and Testing

## Requirements and configuration

Use Python 3.12+ (verification environment: Python 3.14), Node 22.12+ and PostgreSQL. pgvector is required for duplicate-vector storage. No Docker configuration is required.

Create `backend/.venv`, activate it, and install `pip install -r requirements-dev.txt`. `requirements.txt` contains supported runtime ranges; `requirements-lock.txt` preserves the resolved Windows/Python verification environment, including development packages. It is not a cross-platform hash lock. Render installs runtime requirements on Linux and must be verified separately.

Copy `backend/.env.example` to ignored `backend/.env`; never copy a developer's existing private configuration into the repository. Generate a strong random JWT secret privately and retain it across service restarts. Settings reject weak secrets and insecure production cookie/origin combinations.

| Setting | Use |
| --- | --- |
| `APP_ENV`, `APP_DEBUG` | development/test/production; production debug off |
| `DATABASE_TARGET` | `local` (default) or explicit `supabase` |
| `DATABASE_URL` | Local Psycopg URL; do not overwrite to select hosted target |
| `SUPABASE_DATABASE_URL` | Private direct/session PostgreSQL URL on port 5432, not transaction pooler |
| `SUPABASE_SSLROOTCERT` | Optional private trusted CA file path; default certifi bundle |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT_SECONDS`, `DB_POOL_RECYCLE_SECONDS`, `DB_CONNECT_TIMEOUT_SECONDS` | Bounded connection settings |
| `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `JWT_ISSUER`, `JWT_AUDIENCE` | Signing and token validation; HS256 only |
| `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` | Defaults 15 minutes/seven days |
| `CORS_ORIGINS`, `AUTH_TRUSTED_ORIGINS` | Exact comma-separated origins without paths or wildcards |
| `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_PATH`, optional `AUTH_COOKIE_DOMAIN` | HttpOnly refresh-cookie behavior; omit domain for host-only |
| `DEFAULT_RESOLUTION_DAYS` | Prototype target, not a government SLA |
| `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL` | Backend-only AI credentials/model selection |
| `AI_ENABLED`, `AI_LIVE_REQUESTS_ENABLED` | Both default false; explicit authorization before enabling real usage |
| `AI_EMBEDDING_DIMENSIONS`, `AI_REQUEST_TIMEOUT_SECONDS`, `AI_MAX_RETRIES` | 768 dimensions, 30-second default, zero retries |
| `AI_MAX_INPUT_CHARACTERS`, `AI_MAX_OUTPUT_TOKENS`, `AI_DUPLICATE_CANDIDATE_LIMIT`, `AI_DUPLICATE_SIMILARITY_THRESHOLD`, `AI_REQUESTS_PER_MINUTE`, `AI_CACHE_SECONDS` | Prompt/retrieval/quota bounds; defaults in example |
| `SUPABASE_URL`, `SUPABASE_STORAGE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET` | Optional private Storage adapter; backend credentials only |
| `ATTACHMENT_MAX_SIZE_MB`, `ATTACHMENT_MAX_FILES_PER_GRIEVANCE`, `ATTACHMENT_SIGNED_URL_SECONDS` | Default 5 MB, five files, 60-second links |
| `CONTACT_REQUESTS_PER_HOUR` | Worker-local public enquiry throttle |
| `SEED_CITIZEN_PASSWORD`, `SEED_CMO_PASSWORD`, `SEED_OFFICER_PASSWORD` | Private local-only demonstration provisioning |
| `TEST_DATABASE_URL` | Explicit EMPTY loopback PostgreSQL database ending in `_test`; destructive fixtures |

Optional development runtime/readiness helpers additionally require process variables `EXPECTED_SUPABASE_PROJECT` and `EXPECTED_TARGET_FINGERPRINT`. They are not production startup commands. Both must match the independently reviewed target; the revision guard expects `0008`. No developer-specific project identity is embedded in the submission.

## Database setup

For a **new, explicitly selected local database only**:

```sh
cd backend
alembic heads
alembic upgrade head
alembic current
python -m scripts.seed --reference-only
python -m scripts.seed_public_content
```

If pgvector is unavailable, explicitly target `alembic upgrade 0007`. Head is `0008`, merging optional vector `0006` and supporting features `0007`. Never stamp missing migrations or use `create_all()` as the setup procedure.

For an existing Supabase database, first verify project identity/fingerprint, migration revision and a read-only inventory. `python -m scripts.supabase_db --help` describes guarded inspection/verification. Hosted TLS requires `verify-full`; do not weaken certificate validation. Do not execute provision, migrations or seed writes without reviewed authorization. Render startup deliberately contains no migration command.

Citizens normally use public registration. Privileged users require an authorized operator transaction using the existing User model and Argon2id hashing, with an active department for officers. There is no public role-assignment API. The supplied `scripts.seed` creates three fictional local demo identities only when private seed passwords are configured; it refuses hosted account seeding and preserves existing passwords by default. Do not bypass that safeguard. There are no published account passwords.

Audit records must be retained. Label disposable grievances and keep a private ID manifest. Do not cascade-delete or truncate hosted test data; later operator-reviewed retention or deactivation is preferable to defeating audit protections.

## Run the application

```sh
# Terminal 1, backend virtual environment active
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2
cd frontend
npm ci
# Copy .env.example to ignored .env.local.
npm run dev -- --port 5173 --strictPort
```

Frontend `VITE_API_BASE_URL` includes `/api/v1`; default `http://localhost:8000/api/v1`. Keep `VITE_ENABLE_AI_REQUESTS=false` until live usage is authorized. VITE variables are public build-time values, never secrets. Use a consistent browser hostname and the configured origin.

## Automated verification

Create a dedicated empty local database named, for example, `cm_kerala_test`. Set `DATABASE_TARGET=local`, `APP_ENV=test`, both AI gates false and `TEST_DATABASE_URL` privately for that database. Pytest rejects non-loopback hosts and non-`_test` names. Fixtures migrate and tear down only this disposable database; never use Supabase here.

```sh
cd backend
python -m pytest -q --tb=short
python -m ruff check app scripts tests alembic
python -m compileall -q app scripts tests alembic
python -m pip check
alembic heads

cd ../frontend
npm test
npm run build
# Set VITE_ENABLE_AI_REQUESTS=true for a separate build only, not runtime requests.
npm run build
```

If passing `--basetemp`, create its parent first and use a fresh ignored directory. Tests block external sockets and real Gemini SDK transmissions. Storage is mocked. Frontend tests cover reload/restoration, focus/expiry, concurrent refresh, Web Locks fallback, transient failures, logout/revocation, routing, role guards and AI category application.

Clean-copy results on 18 November 2026: backend **486 passed, 3 skipped, 20 upstream warnings** (219.80 seconds); frontend **195 passed across 15 files** (14.62 seconds). Ruff, source compilation, `pip check`, offline health/auth guards and registration of **60 API operations** passed. Alembic has one graph head, `0008`. The local integration fixtures exercised incremental migrations, rollback and ORM metadata consistency on the vector-less branch.

Default production build passed (5.14 seconds); the AI-enabled build passed (4.22 seconds). The first backend attempt had 13 temporary-directory setup errors because the requested basetemp parent was absent; after creating that parent, the complete suite passed without application changes. An initial AI-build invocation failed because PowerShell/npm forwarded the output-directory argument as a Vite entry path; running Vite directly with the correct arguments passed. These setup failures are not hidden as successful runs.

An offline scan of source and both build outputs found no known private values or unreviewed credential-pattern matches. Placeholder database URLs and synthetic database-target fixtures were reviewed separately. `backend/scripts/scan_submission.py` supports repeatable working-tree and staged-blob checks; it is a bounded local scanner, not a guarantee against every secret format or personal-data pattern. Builds, dependencies, caches and private artifacts are Git-ignored and excluded from the submission snapshot.

The local PostgreSQL server lacks pgvector, so three real-vector tests skip. Historical authorized Supabase verification exercised vector SQL/ORM at revision `0008`; that is not a new clean-copy hosted check. Upstream Python 3.14/LangSmith deprecation warnings are not application failures.

## Render deployment

Use the new private GitHub repository, native Python web service, root `backend/`, free plan only unless separately authorized. The included root `render.yaml` uses runtime requirements, Python 3.14.0, `uvicorn app.main:app --host 0.0.0.0 --port $PORT` and `/api/v1/health`. `/api/v1/health/db` is the separate connectivity check.

Privately supply `SUPABASE_DATABASE_URL`, exact HTTPS `CORS_ORIGINS` and `AUTH_TRUSTED_ORIGINS`. Generate a new cloud JWT secret; never import a local one without authorized secret transfer. Set `APP_ENV=production`, `AUTH_COOKIE_SECURE=true`, and `AUTH_COOKIE_SAMESITE=none` for cross-site hosting. Supply a trusted CA as a platform secret file if the default bundle does not validate the database certificate. Do not commit certificates. Keep AI gates false and Storage credentials absent until separately authorized.

The existing database must already be compatible with revision `0008`; inspect before deployment, never reset it. A successful liveness check alone does not prove database/schema compatibility.

## Vercel deployment and hosted acceptance

Create one project from the same new repository, root `frontend/`, Vite preset, install `npm ci`, build `npm run build`, output `dist`. `frontend/vercel.json` rewrites deep links to `/index.html`. Set `VITE_API_BASE_URL` to the actual Render HTTPS URL plus `/api/v1`; retain AI flag false initially. Rebuild after changing public build-time values. Configure Render's exact origins to the final Vercel production URL; do not admit arbitrary preview domains.

After deployment, check health/DB, active departments, published pages and FAQ, CORS preflight and disallowed origins, homepage and role-route deep links. With authorized accounts, check all three role logins, cookie flags, refresh after reload/expiry, tab coordination, cross-role rejection and logout revocation. Any grievance/registration writes require separately authorized synthetic records. Do not run paid AI or Storage checks implicitly.

Separate `vercel.app` and `onrender.com` sites may block third-party cookies despite correct SameSite settings. Verify in a real browser; if unreliable, use same-site custom domains or a reviewed reverse proxy rather than weakening authentication. Check desktop/tablet/mobile navigation, forms, validation and dashboard layout. Browser acceptance and actual hosted URLs remain unverified until executed.

Deployment references: [Render FastAPI](https://render.com/docs/deploy-fastapi), [Render Blueprint fields](https://render.com/docs/blueprint-spec), [Vercel rewrites](https://vercel.com/docs/routing/rewrites).
