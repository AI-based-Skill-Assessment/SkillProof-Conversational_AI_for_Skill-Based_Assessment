# SkillProof — Conversational AI for Skill-Based Assessment

> An AI-powered platform for verifying professional skills through conversational interviews, biometric identity verification, and certificate document analysis.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Setup Guide](#setup-guide)
  - [Step 1 — Clone the Repository](#step-1--clone-the-repository)
  - [Step 2 — Start Infrastructure Services (Docker)](#step-2--start-infrastructure-services-docker)
  - [Step 3 — Google OAuth Setup](#step-3--google-oauth-setup)
  - [Step 4 — Groq API Key](#step-4--groq-api-key)
  - [Step 5 — Backend Setup](#step-5--backend-setup)
  - [Step 6 — Frontend Setup](#step-6--frontend-setup)
  - [Step 7 — Initialize the Database & Seed Admin](#step-7--initialize-the-database--seed-admin)
  - [Step 8 — Run the Application](#step-8--run-the-application)
- [Default Credentials](#default-credentials)
- [Portal Access URLs](#portal-access-urls)
- [Authentication Flows](#authentication-flows)
- [API Documentation](#api-documentation)
- [Environment Variables Reference](#environment-variables-reference)
- [Docker Deployment (Full Stack)](#docker-deployment-full-stack)
- [Troubleshooting](#troubleshooting)

---

## Overview

SkillProof enables organisations (colleges, companies, placement cells) to verify candidate skills through:

1. **Certificate Document Analysis** — Upload certificates, OCR extracts data, AI verifies authenticity via web scraping.
2. **Conversational AI Interviews** — Real-time voice/text interviews powered by Groq LLM that probe technical depth.
3. **Biometric Identity Verification** — Face registration (DeepFace ArcFace) and voice registration (SpeechBrain ECAPA-TDNN) to prevent impersonation.
4. **Multi-Portal System** — Separate portals for Candidates, Organisations, and System Admin, each with role-based access control.

---

## Architecture

```
┌─────────────────┐    HTTP/REST    ┌──────────────────┐
│                 │ ──────────────► │                  │
│  React Frontend │                 │  FastAPI Backend  │
│  (Vite + SPA)   │ ◄────────────── │  (Async Python)   │
│  Port: 5173     │    JSON         │  Port: 8000       │
└─────────────────┘                 └────────┬─────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         ▼                   ▼                   ▼
                   ┌──────────┐       ┌──────────┐       ┌──────────┐
                   │PostgreSQL│       │  Redis   │       │ Groq API │
                   │ Port 5432│       │ Port 6379│       │ (LLM)    │
                   └──────────┘       └──────────┘       └──────────┘
```

---

## Tech Stack

| Layer      | Technology                                                  |
| ---------- | ----------------------------------------------------------- |
| Frontend   | React 18, Vite, React Router v6, Axios, Vanilla CSS        |
| Backend    | Python 3.10+, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 |
| Database   | PostgreSQL 15 (via asyncpg)                                 |
| Cache      | Redis 7                                                     |
| AI/ML      | Groq (LLM), DeepFace (face), SpeechBrain (voice), MediaPipe |
| Auth       | JWT (python-jose), bcrypt (passlib), Google OAuth, TOTP 2FA |
| Infra      | Docker, Docker Compose                                      |

---

## Prerequisites

Make sure the following are installed on your machine before proceeding:

| Tool             | Version   | Download Link                                       |
| ---------------- | --------- | --------------------------------------------------- |
| **Python**       | 3.10+     | https://www.python.org/downloads/                   |
| **Node.js**      | 18+       | https://nodejs.org/                                 |
| **Docker**       | Latest    | https://www.docker.com/products/docker-desktop/     |
| **Git**          | Latest    | https://git-scm.com/downloads                       |

> **Note:** Docker is required only for PostgreSQL and Redis. You can also install them natively if preferred.

---

## Project Structure

```
skillproof/
├── backend/                      # FastAPI Backend
│   ├── app/
│   │   ├── ai_engine/            # LLM integration (Groq)
│   │   ├── controllers/          # API route handlers
│   │   │   ├── auth.py           # User/Org/Admin authentication
│   │   │   ├── admin_mgmt.py     # Admin management endpoints
│   │   │   ├── biometric.py      # Face & voice verification
│   │   │   ├── ingest.py         # Certificate upload & OCR
│   │   │   ├── interview.py      # Interview session management
│   │   │   ├── verify.py         # Document verification engine
│   │   │   └── voice_interview.py# Voice interview WebSocket
│   │   ├── models/               # SQLAlchemy ORM models
│   │   │   ├── user.py           # Candidate model
│   │   │   ├── organisation.py   # Organisation model
│   │   │   ├── admin.py          # Admin model
│   │   │   ├── session.py        # Verification session models
│   │   │   └── links.py          # User-Org link model
│   │   ├── repositories/         # Database CRUD operations
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── security/             # JWT, Google OAuth, TOTP, RBAC
│   │   ├── services/             # Business logic layer
│   │   ├── config.py             # Settings (reads .env)
│   │   ├── database.py           # Async DB engine & session factory
│   │   └── main.py               # FastAPI application entry point
│   ├── scripts/db/               # DB migration & seed scripts
│   ├── requirements.txt          # Python dependencies
│   ├── Dockerfile                # Backend container build
│   ├── .env.example              # ← Copy to .env and fill values
│   └── .env.docker               # Docker-specific env overrides
│
├── frontend/                     # React SPA Frontend
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   │   └── common/           # Button, Input, Select, Toast, GoogleButton
│   │   ├── core/
│   │   │   ├── api/client.js     # Axios instance + interceptors
│   │   │   ├── auth/             # AuthContext, ProtectedRoute
│   │   │   ├── endpoints.js      # API endpoint constants
│   │   │   └── routes.js         # Route path constants
│   │   ├── layouts/              # PublicLayout, UserLayout, OrgLayout, AdminLayout
│   │   ├── pages/
│   │   │   ├── public/           # Landing page, How It Works, Security
│   │   │   ├── user/             # Candidate portal pages
│   │   │   ├── org/              # Organisation portal pages
│   │   │   └── admin/            # System admin portal pages
│   │   ├── styles/               # Vanilla CSS design system
│   │   ├── App.jsx               # Root router
│   │   └── main.jsx              # React entry point
│   ├── package.json              # Node dependencies
│   ├── vite.config.js            # Vite configuration
│   ├── .env.example              # ← Copy to .env and fill values
│   └── index.html                # HTML entry point
│
├── docker-compose.yml            # PostgreSQL + Redis + Backend
├── .gitignore
└── README.md                     # ← You are here
```

---

## Setup Guide

### Step 1 — Clone the Repository

```bash
git clone https://github.com/AI-based-Skill-Assessment/SkillProof-Conversational_AI_for_Skill-Based_Assessment.git
cd SkillProof-Conversational_AI_for_Skill-Based_Assessment
```

---

### Step 2 — Start Infrastructure Services (Docker)

Start PostgreSQL and Redis using Docker Compose:

```bash
docker compose up -d db redis
```

This creates:
- **PostgreSQL** on `localhost:5432` (user: `postgres`, password: `postgres123`, database: `skillproof`)
- **Redis** on `localhost:6379`

Verify both are running:

```bash
docker compose ps
```

> **Without Docker:** Install PostgreSQL 15 and Redis 7 natively. Create a database named `skillproof` and update the connection URLs in the `.env` file accordingly.

---

### Step 3 — Google OAuth Setup

Google OAuth is required for the "Sign in/up with Google" feature on both the Candidate and Organisation portals.

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Select Application Type: **Web application**
4. Set the name (e.g., `SkillProof Dev`)
5. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:5173
   ```
6. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:5173
   ```
7. Click **Create** and copy the **Client ID** (looks like `847...apps.googleusercontent.com`)

You will paste this Client ID into **both** the backend and frontend `.env` files in the next steps.

> **Important:** Make sure the OAuth Consent Screen is configured with your project name and the `email` and `profile` scopes are enabled.

---

### Step 4 — Groq API Key

Groq powers the AI conversational interview engine.

1. Go to [Groq Console](https://console.groq.com/keys)
2. Sign up or log in
3. Click **Create API Key**
4. Copy the key (starts with `gsk_...`)

---

### Step 5 — Backend Setup

```bash
cd backend
```

#### 5a. Create a Python virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

#### 5b. Install Python dependencies

```bash
pip install -r requirements.txt
```

> **Note:** Some packages (DeepFace, MediaPipe, SpeechBrain) download ML models on first use (~500MB total). This is expected behaviour.

#### 5c. Configure environment variables

```bash
# Copy the example env file
cp .env.example .env        # Linux/macOS
copy .env.example .env       # Windows
```

Open `backend/.env` and fill in the required values:

```env
# REQUIRED — Paste your Groq API key
GROQ_API_KEY=gsk_your_actual_key_here

# REQUIRED — Paste your Google OAuth Client ID
GOOGLE_CLIENT_ID=847...apps.googleusercontent.com

# Database (default matches Docker Compose, change if using custom setup)
DATABASE_URL=postgresql+asyncpg://postgres:postgres123@localhost:5432/skillproof

# Redis (default matches Docker Compose)
REDIS_URL=redis://localhost:6379/0
```

#### 5d. Install Playwright browser (optional, for JS-rendered document verification)

```bash
playwright install chromium
```

---

### Step 6 — Frontend Setup

Open a **new terminal** and navigate to the frontend:

```bash
cd frontend
```

#### 6a. Install Node dependencies

```bash
npm install
```

#### 6b. Configure environment variables

```bash
# Copy the example env file
cp .env.example .env        # Linux/macOS
copy .env.example .env       # Windows
```

Open `frontend/.env` and paste the **same** Google Client ID:

```env
VITE_GOOGLE_CLIENT_ID=847...apps.googleusercontent.com
```

> **Critical:** The `GOOGLE_CLIENT_ID` in the backend `.env` and `VITE_GOOGLE_CLIENT_ID` in the frontend `.env` **must be identical**. The backend verifies the token against this same Client ID.

---

### Step 7 — Initialize the Database & Seed Admin

Go back to the **backend terminal** (with venv activated):

```bash
cd backend

# Create all database tables
python scripts/db/recreate_noninteractive.py

# Seed the default admin account
python scratch/seed_admin.py
```

You should see:
```
Done!
Default admin seeded successfully: admin@skillproof.ai
```

---

### Step 8 — Run the Application

#### Terminal 1 — Backend (port 8000)

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

#### Terminal 2 — Frontend (port 5173)

```bash
cd frontend
npm run dev
```

Open your browser and go to: **http://localhost:5173**

---

## Default Credentials

### System Admin Portal

| Field       | Value                       |
| ----------- | --------------------------- |
| **URL**     | http://localhost:5173/admin  |
| **Email**   | `admin@skillproof.ai`       |
| **Password**| `SkillProof@Admin2024`      |

On first login, you will be prompted to scan a **QR code with Google Authenticator** to set up 2FA. After the first successful 2FA verification, subsequent logins will only ask for the 6-digit code.

### Candidate Portal

- Register at http://localhost:5173/user/signup (email/password or Google)
- Registration flow: Sign Up → Account Type → Face Registration → Voice Registration → Dashboard

### Organisation Portal

- Register at http://localhost:5173/org/signup (email/password or Google)
- After registration, the account is in **pending** status until the System Admin approves it from the Admin Panel.

---

## Portal Access URLs

| Portal         | URL                                    |
| -------------- | -------------------------------------- |
| Landing Page   | http://localhost:5173/                  |
| Candidate      | http://localhost:5173/user/signin       |
| Organisation   | http://localhost:5173/org/signin        |
| System Admin   | http://localhost:5173/admin             |
| API Docs       | http://localhost:8000/docs              |

---

## Authentication Flows

### Candidate (User)

| Method          | Sign Up                                                         | Sign In                    |
| --------------- | --------------------------------------------------------------- | -------------------------- |
| Email/Password  | Register → Account Type → Face Reg → Voice Reg → Dashboard     | Email + Password → Dashboard |
| Google OAuth    | Google → Account Type → Face Reg → Voice Reg → Dashboard       | Google → Dashboard          |

### Organisation

| Method          | Sign Up                                                                 | Sign In                     |
| --------------- | ----------------------------------------------------------------------- | --------------------------- |
| Email/Password  | Fill all details → Pending Admin Approval                               | Email + Password → Dashboard (if approved) |
| Google OAuth    | Google → Onboarding Form (institution details) → Pending Admin Approval | Google → Dashboard (if approved) |

### System Admin

| Method          | Login                                         |
| --------------- | --------------------------------------------- |
| Email + 2FA     | Email/Password → TOTP Code (Google Authenticator) → Dashboard |

---

## API Documentation

Once the backend is running, interactive API docs are available at:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

Key API endpoint groups:

| Prefix            | Description                                    |
| ----------------- | ---------------------------------------------- |
| `/api/v1/auth`    | User, Org, Admin authentication & profiles     |
| `/api/v1/ingest`  | Certificate upload & OCR extraction             |
| `/api/v1/verify`  | Document verification engine                    |
| `/api/v1/interview`| Interview session management                   |
| `/api/v1/biometric`| Face & voice registration and verification     |
| `/api/v1/admin`   | Organisation approval & user management         |

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable                       | Required | Description                                              | Example                                                                 |
| ------------------------------ | -------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`                 | ✅       | PostgreSQL connection string (asyncpg driver)             | `postgresql+asyncpg://postgres:postgres123@localhost:5432/skillproof`    |
| `REDIS_URL`                    | ✅       | Redis connection string                                   | `redis://localhost:6379/0`                                               |
| `GROQ_API_KEY`                 | ✅       | Groq LLM API key for AI interviews                        | `gsk_...`                                                                |
| `GOOGLE_CLIENT_ID`             | ✅       | Google OAuth 2.0 Client ID                                | `847...apps.googleusercontent.com`                                       |
| `JWT_SECRET_KEY`               | ⚠️ Prod  | Secret for signing JWT tokens                             | Random 32+ char string                                                   |
| `ADMIN_EMAIL`                  | Optional | Default admin email                                       | `admin@skillproof.ai`                                                    |
| `ADMIN_PASSWORD`               | Optional | Default admin password                                    | `SkillProof@Admin2024`                                                   |
| `ADMIN_TOTP_SECRET`            | Optional | Default TOTP secret for admin 2FA                         | `JBSWY3DPEHPK3PXP`                                                      |

### Frontend (`frontend/.env`)

| Variable                | Required | Description                                | Example                              |
| ----------------------- | -------- | ------------------------------------------ | ------------------------------------ |
| `VITE_GOOGLE_CLIENT_ID` | ✅       | Same Google OAuth Client ID as backend      | `847...apps.googleusercontent.com`   |

---

## Docker Deployment (Full Stack)

To deploy the entire stack via Docker Compose:

```bash
# Build and start all services (DB + Redis + Backend)
docker compose up -d --build

# View logs
docker compose logs -f api
```

The `docker-compose.yml` spins up PostgreSQL, Redis, and the FastAPI backend. The frontend can be served via any static hosting or by adding an Nginx service.

---

## Troubleshooting

### "relation does not exist" errors

The database tables haven't been created. Run:
```bash
cd backend
python scripts/db/recreate_noninteractive.py
python scratch/seed_admin.py
```

### Google Sign-In button doesn't appear

1. Verify `VITE_GOOGLE_CLIENT_ID` is set in `frontend/.env`
2. Verify `http://localhost:5173` is in the Google OAuth **Authorized JavaScript origins**
3. Restart the frontend dev server after changing `.env`

### "Invalid refresh token" after page reload

Clear browser localStorage and sign in again. This typically happens during development when the JWT secret changes.

### Admin 2FA not working

Ensure your device time is synced (TOTP codes are time-sensitive). The admin TOTP secret is `JBSWY3DPEHPK3PXP` in development — enter it manually in Google Authenticator if the QR code scan fails.

### ML model download issues

DeepFace and SpeechBrain download pre-trained models on first use. Ensure you have internet access and ~1GB free disk space. Models are cached in `~/.deepface/` and `~/.cache/huggingface/`.

### Port conflicts

Default ports: PostgreSQL (5432), Redis (6379), Backend (8000), Frontend (5173). Change in `.env` and `docker-compose.yml` if these are occupied.

---

## License

This project is developed as a final year academic project.

---

**Built with ❤️ by the SkillProof Team**
