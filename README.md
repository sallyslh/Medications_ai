# Medications_ai (MedAI) — Hospital Decision Support System

Clinical decision-support system for drug prediction, adverse drug reaction (ADR) /
drug-interaction checking, and patient management.
Django REST Framework backend · React + TypeScript frontend · PostgreSQL · SimpleJWT auth.

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Project Structure](#2-project-structure)
3. [Backend Setup](#3-backend-setup)
4. [Database Setup](#4-database-setup)
5. [Run Migrations](#5-run-migrations)
6. [Create Accounts & Load Patient Data](#6-create-accounts--load-patient-data)
7. [Start the Dev Server](#7-start-the-dev-server)
8. [Frontend Setup](#8-frontend-setup)
9. [API Endpoint Reference](#9-api-endpoint-reference)
10. [The ML Drug-Prediction Model](#10-the-ml-drug-prediction-model)
11. [Production Deployment](#11-production-deployment)

---

## 1. Prerequisites

| Tool | Version used in development |
|------|------------------------------|
| Python | 3.12 (see note in [§10](#10-the-ml-drug-prediction-model) about version pinning) |
| PostgreSQL | 15+ |
| Node.js (frontend) | 18+ |

---

## 2. Project Structure

```
medai/
├── manage.py
├── requirements.txt
├── .env.example                     ← copy to .env and fill in values
├── ER_data_chronic_only.csv         ← baseline patient dataset (see §6)
│
├── drugbank_model/                  ← self-contained ML inference package
│   ├── complete_drug_model_system.pkl   ← trained model (TF-IDF + SVD ensemble)
│   ├── loader.py                    ← loads the model (handles the Colab
│   │                                   pickle-compatibility shim)
│   ├── predictor.py                 ← public prediction API Django calls
│   ├── interactions.py              ← drug-drug interaction lookups
│   ├── adverse.py                   ← optional transformers/torch ADR model
│   └── ...
│
└── core/                            ← Django project package
    ├── settings.py
    ├── urls.py                      ← root URL dispatcher
    │
    └── apps/
        ├── accounts/                ← User model, JWT auth, profile/settings
        ├── patients/                ← Patient CRUD + CSV bulk-import command
        ├── predictions/             ← drug prediction pipeline + interaction checking
        ├── adr/                     ← standalone ADR / interaction safety checks
        ├── dashboard/                ← aggregated dashboard data
        └── support/                  ← FAQ + support tickets

medai_frontend/                      ← React + TypeScript (Vite) frontend
├── src/
│   ├── components/                  ← page components (Dashboard, Patients, etc.)
│   ├── services/                    ← Axios API client + per-domain services
│   └── auth/                        ← AuthProvider, ProtectedRoute
└── vite.config.ts                   ← dev server proxies /api → Django
```

---

## 3. Backend Setup

```bash
cd medai

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy the environment template
cp .env.example .env
# Open .env and fill in your PostgreSQL credentials and a new SECRET_KEY
```

Generate a Django secret key:
```bash
python -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(50)))"
```

> **Note on `requirements.txt`:** the ML stack (`scikit-learn`, `numpy`, `scipy`,
> `pandas`, `joblib`) is pinned to the exact versions the `.pkl` model was
> trained with, to avoid subtle numerical drift in predictions. On a very new
> Python version, these exact pins may not have prebuilt wheels yet and pip
> will try to compile from source (slow). If that happens, install the latest
> versions of those five packages instead — predictions still work correctly,
> you'll just see a harmless `InconsistentVersionWarning` at startup.

---

## 4. Database Setup

```sql
-- Run in psql as a superuser
CREATE DATABASE medai_db;
CREATE USER medai_user WITH PASSWORD 'your-password-here';
GRANT ALL PRIVILEGES ON DATABASE medai_db TO medai_user;

-- PostgreSQL 15+ only: grant schema privileges too, or `migrate` will fail
-- with "permission denied for schema public"
\c medai_db
GRANT ALL PRIVILEGES ON SCHEMA public TO medai_user;
ALTER SCHEMA public OWNER TO medai_user;
```

Match these values in your `.env`:
```
DB_NAME=medai_db
DB_USER=medai_user
DB_PASSWORD=your-password-here
DB_HOST=localhost
DB_PORT=5432
```

---

## 5. Run Migrations

```bash
python manage.py migrate
```

---

## 6. Create Accounts & Load Patient Data

There is no `seed_demo` command — accounts are created directly via the Django shell:

```bash
python manage.py shell -c "
from core.apps.accounts.models import User
User.objects.create_user(username='drsmith', email='drsmith@medai.local', password='doctor123', role='Doctor', first_name='John', last_name='Smith', department='Cardiology')
User.objects.create_user(username='admin', email='admin@medai.local', password='admin123', role='Admin', first_name='Site', last_name='Admin', department='Administration')
User.objects.create_superuser(username='siteadmin', email='siteadmin@medai.local', password='SiteAdmin123!')
"
```

| Username | Password | Role | Purpose |
|----------|----------|------|---------|
| `drsmith` | `doctor123` | Doctor | App login (React frontend) |
| `admin` | `admin123` | Admin | App login (React frontend) |
| `siteadmin` | `SiteAdmin123!` | Superuser | Django `/admin/` site |

To load the baseline patient roster from `ER_data_chronic_only.csv` (normalizes
gender to `Male`/`Female` and splits conditions/medications into lists; safe
to re-run, skips existing name+age duplicates):

```bash
python manage.py import_patients ER_data_chronic_only.csv
```

---

## 7. Start the Dev Server

```bash
python manage.py runserver 8000
```

The API is now live at `http://localhost:8000/api/`.

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "drsmith", "password": "doctor123"}'
```

---

## 8. Frontend Setup

```bash
cd medai_frontend
npm install
npm run dev
```

Vite's dev server (`vite.config.ts`) already proxies `/api/*` to
`http://localhost:8000` by default — no `.env` needed for local development.
If your backend runs on a different port, override it:

```bash
VITE_API_BASE_URL=http://localhost:8001 npm run dev
```

Open `http://localhost:5173`, log in with `drsmith` / `doctor123`.

---

## 9. API Endpoint Reference

All routes require `Authorization: Bearer <access_token>` unless marked **Public**.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register/` | Register a new clinician account (**Public**) |
| POST | `/api/auth/login/` | Login — returns JWT pair + user (**Public**) |
| POST | `/api/auth/logout/` | Blacklist refresh token |
| POST | `/api/auth/refresh/` | Rotate access + refresh tokens (**Public**) |
| GET | `/api/profile/` | Authenticated user profile |
| GET/PUT | `/api/settings/` | User profile + preferences |
| PUT | `/api/change-password/` | Change password |
| GET, POST | `/api/patients/` | List (`?search=`) / create patients |
| GET, PUT, DELETE | `/api/patients/<id>/` | Retrieve / update / delete a patient |
| GET | `/api/predictions/queue/` | All predictions for the current doctor |
| POST | `/api/predictions/` | Create a prediction job (drug recommendation + interaction check) |
| GET | `/api/predictions/<id>/` | Prediction detail (poll for status) |
| POST | `/api/predictions/<id>/retry/` | Retry a failed prediction |
| POST | `/api/predict/<id>/select/` | Clinician selects a recommended drug |
| POST | `/api/adr/check/` | Run a standalone drug-interaction / contraindication safety check |
| GET | `/api/adr/history/` | List ADR checks run by the current doctor |
| GET | `/api/dashboard/` | Dashboard aggregated data |
| GET | `/api/system/status/` | System/service health status |
| GET | `/api/help/faq/` | FAQ list |
| POST, GET | `/api/help/ticket/`, `/api/help/tickets/` | Submit / list support tickets |
| GET | `/api/help/ticket/<id>/` | Single ticket detail |

---

## 10. The ML Drug-Prediction Model

`drugbank_model/` is a self-contained package (not part of `core/`) that loads
`complete_drug_model_system.pkl` — a TF-IDF + TruncatedSVD ensemble trained in
a Colab notebook — and serves predictions to Django via
`drugbank_model.predictor.predict_drugs_for_condition()`.

Key points:
- The `.pkl` was saved with `joblib.dump` using classes that lived in Colab's
  `__main__` namespace. `drugbank_model/loader.py` handles this compatibility
  gap so it loads correctly outside a notebook — **do not** load the pickle
  with a raw `pickle.load()`, it will fail with
  `AttributeError: Can't get attribute 'StreamlinedConfig'`.
- Only the patient's **current symptoms** are sent to the model — stored
  chronic conditions are deliberately *not* mixed into the prediction query
  (they're used for interaction checking instead), otherwise an old chronic
  condition can dominate the query text and produce recommendations for the
  wrong thing.
- If the model file is missing or fails to load, `ml_engine.py` falls back to
  a small keyword-based rule table so the system stays functional in dev
  without the trained model.
- The optional ADR transformer (`adverse.py`, `transformers`/`torch`) degrades
  gracefully if those packages aren't installed or fail to load — it is not
  required for drug prediction or interaction checking.

---

## 11. Production Deployment

This project has been deployed to a single AWS EC2 instance (Ubuntu, Postgres +
gunicorn + nginx all on one box — appropriate for a small/low-traffic
deployment; use RDS instead of local Postgres for a more production-grade
setup).

```bash
# .env on the server
DEBUG=False
DJANGO_SECRET_KEY=<50-char random string>
ALLOWED_HOSTS=<your IP or domain>
DB_HOST=localhost
CORS_ALLOWED_ORIGINS=http://<your IP or domain>

# If serving plain HTTP with no TLS cert (e.g. a bare IP), also set:
SECURE_SSL_REDIRECT=False
# Django forces HTTPS redirects whenever DEBUG=False by default — leave
# SECURE_SSL_REDIRECT unset (defaults to True) once a real domain + cert
# are in front of the app.
```

```bash
# Collect static files (for /admin/)
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate

# Run with gunicorn behind nginx (see below), e.g. as a systemd service
gunicorn core.wsgi:application --workers 2 --bind 127.0.0.1:8000 --timeout 120
```

### nginx config

```nginx
server {
    listen 80;
    server_name <your IP or domain>;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
    }

    location /static/ {
        alias /opt/medai/staticfiles/;
    }

    location / {
        root /opt/medai/medai_frontend/dist;
        try_files $uri /index.html;
    }
}
```

The React frontend is built once (`npm run build` → `medai_frontend/dist/`)
and served as static files by nginx — it is not run with `npm run dev` in
production.

### Replacing the background thread with Celery (future work)

The prediction engine currently uses a `threading.Thread` to simulate async
execution. For a real production deployment, replace it with Celery + Redis
and convert `_run_prediction_in_background` in `predictions/views.py` into a
`@app.task`, called with `.delay(str(prediction.id))`.
