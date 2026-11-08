# NextStep — Job application tracker

NextStep is a portfolio-ready job search workspace. The first version includes a React dashboard and a FastAPI backend with account registration, sign-in, and per-user application records.

## Stack

- React + JavaScript + Vite
- FastAPI + SQLAlchemy
- SQLite for local development (PostgreSQL can be selected with `DATABASE_URL`)
- JWT access tokens

## Run locally

### API

```powershell
cd backend
python -m venv .venv
python -m pip --python .venv\Scripts\python.exe install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

For an existing local database created before migrations were added, run
`.\.venv\Scripts\python.exe -m alembic stamp head` once instead of `upgrade head`.
This records the current schema version without changing application records.

The API docs are at http://localhost:8000/docs.

### Web app

```powershell
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to the API. For production, set
`ENVIRONMENT=production`, a strong `SECRET_KEY`, a production `DATABASE_URL`,
and the allowed frontend origin before starting the API. Apply schema changes
with `python -m alembic upgrade head` during deployment. Set `VITE_API_URL` if
the frontend and API use separate origins.

### Run the production stack with Docker

Install Docker with Compose, copy the root `.env.example` to `.env`, then
replace both sample secrets. Generate URL-safe values in PowerShell with
`python -c "import secrets; print(secrets.token_hex(32))"` (run it once for
each secret). Start the app with:

```powershell
docker compose up --build -d
```

Open http://localhost:8080. The web container serves the React app and routes
API requests to FastAPI; the API applies database migrations before serving
traffic. PostgreSQL data stays in a named Docker volume across container
restarts. Before making the site public, set `FRONTEND_ORIGINS` to its HTTPS
origin and put the stack behind a TLS-enabled reverse proxy. Configure regular
database backups and store deployment secrets in the hosting provider's secret
manager. This project does not currently include an email delivery service, so
password reset and verification messages are not enabled.

### Deploy to Vercel

The frontend and API are separate Vercel projects from this repository. Vercel
supports FastAPI on its Python runtime, and the API entry point is
`backend/index.py`.

1. Push this folder to a GitHub repository. The local workspace must be a Git
   repository before Vercel can import it from GitHub.
2. In Vercel, create a Postgres database using a Marketplace integration and
   connect it to the API project. Use its pooled PostgreSQL connection string
   as `DATABASE_URL`.
3. Create the API project from the repository with **Root Directory** set to
   `backend`. Add `ENVIRONMENT=production`, a randomly generated `SECRET_KEY`
   (at least 32 characters), and `DATABASE_URL` for Production. Deploy and
   note the API's `vercel.app` URL.
4. Apply the database schema once from the local `backend` directory, linked to
   the API Vercel project:

   ```powershell
   npm install --global vercel
   vercel login
   vercel link
   vercel env run -e production -- .\.venv\Scripts\python.exe -m alembic upgrade head
   ```

   The API's first registration will fail until this migration has run.
5. Create the frontend project from the same GitHub repository with **Root
   Directory** set to `frontend`. Vercel should detect Vite; set its Production
   environment variable `VITE_API_URL` to the API URL from step 3, then deploy.
6. Copy the frontend's production `vercel.app` URL into the API project's
   `FRONTEND_ORIGINS` Production variable and redeploy the API. This enables
   browser requests from the deployed frontend.

Vercel creates a separate project for each selected monorepo root directory,
and its environment variables apply to new deployments. The deployed API must
use Postgres because serverless local files are not persistent. Keep Preview
and Production database variables separate if you later enable preview signups.

## Current features

Accounts own their application records. The dashboard supports creating, editing, searching, filtering, and deleting applications, plus a Kanban board spanning all six stages with drag-and-drop and keyboard-select moves. Activity shows updates across the whole workspace, while Insights reports application trends, stage distribution, interview progress, offers, and response rate. Application details include a timeline for stage changes and notes, scheduled interview rounds with preparation notes, and recruiter or team contacts.

The first-run dashboard guides new accounts through adding their first application.
Applications can be exported as a complete CSV backup or imported from CSV with a
preview that skips matching company, role, and application-date entries.
The calendar brings scheduled interviews and follow-up reminders into a monthly
view with a day-by-day agenda, and can export the schedule to standard `.ics` format.
Analytics, attachments, and calendar sync are planned follow-on slices.
