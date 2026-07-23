# MedAI — Django REST Framework Backend

Production-ready, HIPAA-conscious clinical AI support system.
Python 3.11+ · Django 4.2+ · PostgreSQL · DRF · SimpleJWT

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Project Structure](#2-project-structure)
3. [Initial Setup](#3-initial-setup)
4. [Database Setup](#4-database-setup)
5. [Run Migrations](#5-run-migrations)
6. [Seed Data](#6-seed-data)
7. [Start the Dev Server](#7-start-the-dev-server)
8. [API Endpoint Reference](#8-api-endpoint-reference)
9. [Connecting the React Frontend](#9-connecting-the-react-frontend)
10. [Production Deployment Checklist](#10-production-deployment-checklist)

---

## 1. Prerequisites

| Tool | Minimum Version |
|------|-----------------|
| Python | 3.11 |
| pip | 23+ |
| PostgreSQL | 14+ |
| Node.js (frontend) | 18+ |

---

## 2. Project Structure

```
medai_backend/
├── manage.py
├── requirements.txt
├── .env.example                    ← copy to .env and fill in values
│
├── models_ml/
│   └── complete_drug_model_system.pkl   ← place your trained ML model here
│
└── core/
    ├── settings.py                 ← central Django settings
    ├── urls.py                     ← root URL dispatcher
    ├── wsgi.py
    ├── utils.py                    ← custom exception handler
    │
    └── apps/
        ├── accounts/               ← User, UserSettings, JWT auth, settings
        ├── patients/               ← Patient CRUD
        ├── predictions/            ← AI drug prediction pipeline (DrugBank model)
        ├── dashboard/              ← aggregated dashboard data
        └── support/                ← FAQ + SupportTicket
```

> **Note:** The ADR (Adverse Drug Reaction) module has been removed from the
> backend — it is not ready yet. The frontend still contains its pages,
> routes, and UI components unchanged, but they currently have no backend
> to call. The DrugBank AI model that will eventually power both drug
> prediction and ADR checks lives under `core/apps/predictions` and is
> unaffected by this removal.

---

## 3. Initial Setup

```bash
# Clone / copy the backend folder
cd medai_backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install all dependencies
pip install -r requirements.txt

# Copy the environment template
cp .env.example .env
# Open .env and fill in your PostgreSQL credentials and a new SECRET_KEY
```

Generate a Django secret key quickly:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## 4. Database Setup

```sql
-- Run in psql as a superuser
CREATE DATABASE medai_db;
CREATE USER medai_user WITH PASSWORD 'medai_pass';
ALTER ROLE medai_user SET client_encoding TO 'utf8';
ALTER ROLE medai_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE medai_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE medai_db TO medai_user;
```

Match these values in your `.env`:
```
DB_NAME=medai_db
DB_USER=medai_user
DB_PASSWORD=medai_pass
DB_HOST=localhost
DB_PORT=5432
```

---

## 5. Run Migrations

```bash
# Apply all migrations (creates all tables)
python manage.py migrate
```

Expected output:
```
Applying accounts.0001_initial...           OK
Applying patients.0001_initial...           OK
Applying predictions.0001_initial...        OK
Applying support.0001_initial...            OK
Applying token_blacklist.0001_initial...    OK
```

---

## 6. Seed Data

```bash
# Seed demo users and sample patients (development only)
python manage.py seed_demo
```

After `seed_demo`, these accounts are available:

| Username     | Password      | Role   | Notes         |
|--------------|---------------|--------|---------------|
| `dr_sarah`   | MedAI@2024!   | Doctor | Superuser     |
| `dr_james`   | MedAI@2024!   | Doctor |               |
| `nurse_liu`  | MedAI@2024!   | Nurse  |               |
| `admin_user` | MedAI@2024!   | Admin  | Staff         |

---

## 7. Start the Dev Server

```bash
python manage.py runserver 8000
```

The API is now live at `http://localhost:8000/api/`

Test the login endpoint:
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "dr_sarah", "password": "MedAI@2024!"}'
```

Expected response:
```json
{
  "access": "<JWT access token>",
  "refresh": "<JWT refresh token>",
  "user": {
    "id": "...",
    "username": "dr_sarah",
    "email": "sarah.chen@medai.dev",
    "role": "Doctor",
    "department": "Cardiology",
    ...
  }
}
```

---

## 8. API Endpoint Reference

All routes require `Authorization: Bearer <access_token>` unless marked **Public**.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login/` | Login — returns JWT pair + user (**Public**) |
| POST | `/api/auth/logout/` | Blacklist refresh token |
| POST | `/api/auth/refresh/` | Rotate access + refresh tokens (**Public**) |
| GET | `/api/profile/` | Authenticated user profile |
| GET | `/api/patients/` | List patients (supports `?search=`, `?condition=`, `?name=`) |
| POST | `/api/patients/` | Create patient |
| GET | `/api/patients/<id>/` | Patient detail + prediction history |
| PUT | `/api/patients/<id>/` | Update patient |
| DELETE | `/api/patients/<id>/` | Delete patient |
| GET | `/api/predictions/queue/` | All predictions for current doctor |
| POST | `/api/predictions/` | Create prediction job |
| GET | `/api/predictions/<id>/` | Prediction detail |
| POST | `/api/predictions/<id>/retry/` | Retry a failed prediction |
| POST | `/api/predict/<id>/select/` | Clinician selects a drug |
| GET | `/api/dashboard/` | Dashboard aggregated data |
| GET | `/api/settings/` | User profile + preferences |
| PUT | `/api/settings/` | Update profile / preferences |
| PUT | `/api/change-password/` | Change password |
| GET | `/api/help/faq/` | FAQ list |
| POST | `/api/help/ticket/` | Submit support ticket |
| GET | `/api/help/tickets/` | List current user's tickets |
| GET | `/api/help/ticket/<id>/` | Single ticket detail |

---

## 9. Connecting the React Frontend

### Step 1 — Set the API base URL

In the React project root, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

```dotenv
# Points Vite's Axios base URL at the Django dev server
VITE_API_BASE_URL=http://localhost:8000
```

> **Important:** Vite only exposes variables prefixed with `VITE_` to the browser bundle.
> Never put secrets (DB passwords, private keys) here.

### Step 2 — How the Axios interceptor attaches JWT tokens

Your existing `/src/services/api.ts` already contains an Axios instance.
Ensure it reads `VITE_API_BASE_URL` and attaches the stored token:

```typescript
// src/services/api.ts  (reference implementation — adjust to match your file)
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor — attach access token ─────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — auto-refresh on 401 ───────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("refresh_token");
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh/`,
          { refresh }
        );
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
        original.headers["Authorization"] = `Bearer ${data.access}`;
        return api(original);          // retry the original request
      } catch {
        // Refresh failed — clear tokens and redirect to login
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Step 3 — Allow the React dev origin in Django CORS

Open your `.env` file in the **backend** and set:

```dotenv
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
```

Django reads this list at startup via `python-decouple` in `settings.py`.
`django-cors-headers` then automatically adds the correct
`Access-Control-Allow-Origin` header to every API response, preventing
the browser from blocking cross-origin AJAX requests.

> If your React dev server runs on a different port (e.g. 4173 for
> `vite preview`), add it to the comma-separated list.

### Step 4 — Verify the full round-trip

1. Start Django: `python manage.py runserver 8000`
2. Start React: `npm run dev` (typically `http://localhost:5173`)
3. Open the React login page, enter `dr_sarah` / `MedAI@2024!`
4. Check the Network tab — the `POST /api/auth/login/` call should return
   `200 OK` with tokens and the user object.
5. Navigate to any protected page — watch the
   `Authorization: Bearer <token>` header on subsequent requests.

---

## 10. Production Deployment Checklist

```bash
# 1. Set environment variables on your server / container
DEBUG=False
DJANGO_SECRET_KEY=<50-char random string>
ALLOWED_HOSTS=api.yourdomain.com
DB_HOST=<RDS or production DB host>
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com

# 2. Collect static files (for admin)
python manage.py collectstatic --noinput

# 3. Run migrations on the production database
python manage.py migrate

# 4. Start with Gunicorn behind Nginx
gunicorn core.wsgi:application \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --log-level info
```

### Nginx config snippet
```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### Replacing the background thread with Celery (production)

The prediction engine currently uses a `threading.Thread` to simulate
async execution. In production replace it with Celery + Redis:

```bash
pip install celery redis django-celery-results
```

```python
# core/celery.py
from celery import Celery
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
app = Celery("medai")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

Then convert `_run_prediction_in_background` in `predictions/views.py`
to a `@app.task` and call it with `.delay(str(prediction.id))`.

---

## ML Model

Place `complete_drug_model_system.pkl` in the `models_ml/` directory.
The engine (`core/apps/predictions/ml_engine.py`) lazy-loads it on first
request. If the file is absent, a built-in keyword-based rule table is
used as a fallback so the system remains functional during development
without the trained model.
