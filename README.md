# SkillProof Backend

SkillProof is a Conversational AI system designed for internship certificate verification and candidate skill assessment. It parses certificate documents, validates issuer metadata, classifies issuer tiers, and conducts turn-by-turn interactive technical interviews via WebSockets powered by Groq LLM to verify claimed skills.

## Features
1. **Lifespan Manager**: Seamless async startup/shutdown of PostgreSQL connections and Redis cache.
2. **Metadata Verification**: Simulates document OCR, extraction, external URL checks, and issuer classification.
3. **Conversational AI Assessment**: Interactive turn-based WebSocket testing driven by custom prompts, tracking history, and scoring performance.
4. **Clean Domain Repositories**: Follows the Repository pattern to isolate database queries.
5. **Modern Configuration**: Loaded via Pydantic v2 settings using local `.env` values.

## Project Structure
```
skillproof/
├── app/
│   ├── main.py                  # Entrypoint, lifespan, CORS, routers inclusion
│   ├── config.py                # Pydantic v2 configuration
│   ├── database.py              # Async SQLAlchemy and Redis connections
│   ├── models/                  # ORM models (VerificationSession, Document, Interview, Score)
│   ├── schemas/                 # Pydantic validations (requests/responses)
│   ├── repositories/            # Database CRUD queries
│   ├── services/                # Orchestration & business logic
│   ├── controllers/             # FastAPI HTTP & WebSocket routers
│   ├── ai_engine/               # Skills vocab, verification engine, LLM clients, interview flow
│   └── security/                # Auth placeholder
├── alembic/                     # Migrations configuration
├── tests/                       # Unit and integration tests
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Setup Instructions

### Local Setup
1. **Create Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Settings**:
   Copy `.env.example` to `.env` and fill in necessary configurations.
   ```bash
   cp .env.example .env
   ```

4. **Run DB Migrations**:
   ```bash
   alembic upgrade head
   ```

5. **Start Dev Server**:
   ```bash
   uvicorn app.main:app --reload
   ```

### Docker Compose Setup
Run the complete stack (Postgres, Redis, FastAPI App):
```bash
docker-compose up --build
```
The server will run on [http://localhost:8000](http://localhost:8000).

## API Endpoints

- **Ingest Certificate**: `POST /ingest` (Accepts multipart file upload)
- **Verify Session**: `POST /verify/{session_id}`
- **Retrieve Skill Scores**: `GET /score/{session_id}`
- **Interactive Interview WebSocket**: `WS /interview/{session_id}`
