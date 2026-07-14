# SkillProof — Conversational AI Skill Verification & Biometric Anti-Proxy System

SkillProof is a secure, Conversational AI-powered skill assessment platform. It helps organizations verify candidate credentials and conduct automated, live technical interviews. 

To prevent proxy hiring and cheating, it incorporates **in-browser biometric registration** (face embeddings + voice fingerprints) and **real-time interview monitoring** (continuous face checking, head-pose gaze detection, and camera state monitoring).

---

## 🌟 Key Features

1. **Biometric Enrollment (`/enroll`)**: 
   * Captures a 128-dimensional face descriptor using `face-api.js` (TensorFlow.js).
   * Extracts a voice fingerprint (spectral energy bands) from microphone input.
   * **Anti-Proxy Cross-Session Check**: Automatically scans database records to ensure the face/voice isn't already registered under a different email/name.

2. **Automated Live Interview Room (`/interview-room`)**:
   * Conducts WebSocket-based voice interviews where AI questions are spoken via Text-to-Speech (TTS) and candidate answers are captured via Speech-to-Text (STT).
   * **Continuous Identity Check**: Compares live camera frames and voice samples against registered biometrics every few seconds.
   * **Attention & Gaze Tracking**: Raises a flag if the user looks away (head turned > 42% off-center) or if the face leaves the screen.
   * **Interrupt Detection**: Warns the user and increments fraud flags if they minimize the tab, switch windows, or pause the camera feed.

3. **Detailed Scorecard**: Evaluates candidate responses for specificity, depth, and consistency, pairing them with an integrity scorecard listing fraud flags and biometric matches.

---

## 📁 Project Structure

```
skillproof/
├── backend/                     # Python Backend Service (FastAPI)
│   ├── app/
│   │   ├── main.py              # Application entrypoint & HTTP/WS routes
│   │   ├── controllers/         # Routers (ingest, verify, score, biometric)
│   │   ├── models/              # DB schemas (VerificationSession, BiometricProfile, etc.)
│   │   ├── repositories/        # Database CRUD queries & similarity helpers
│   │   ├── schemas/             # Pydantic validation schemas
│   │   ├── services/            # Ingestion & report generation logic
│   │   └── ai_engine/           # Groq LLM integration & interview manager
│   ├── create_tables.py         # Table setup helper
│   ├── recreate_all.py          # Drop-all and recreate table migration script
│   ├── requirements.txt         # Backend python dependencies
│   └── Dockerfile               # Backend Docker build instructions
├── biometric_enroll.html        # Biometric enrollment web interface
├── interview_room.html          # Camera/mic AI interview room interface
├── docker-compose.yml           # Runs postgres + redis + backend services
└── README.md
```

---

## 🚀 Setup & Execution

### 1. Configure the Environment
Create a `.env` file inside the `skillproof/` directory:
```env
APP_NAME=SkillProof
APP_ENV=development
HOST=0.0.0.0
PORT=8000

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql+asyncpg://postgres:postgres123@localhost:5432/skillproof_db

# Cache Configuration (Redis)
REDIS_URL=redis://localhost:6379/0

# AI Services Configuration
GROQ_API_KEY=your_groq_api_key_here
```

### 2. Install Dependencies & Start the Backend
1. Create and activate a python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Initialize/recreate DB tables:
   ```bash
   python backend/recreate_all.py
   ```
4. Run the dev server:
   ```bash
   uvicorn backend.app.main:app --reload
   ```

---

## 🖥️ Using the Application

Open your browser (Chrome or Edge recommended for native STT/TTS API support):

1. **Biometric Registration**: [http://127.0.0.1:8000/enroll](http://127.0.0.1:8000/enroll)
   * Enter your session UUID.
   * Start your camera to capture and register your face descriptor.
   * Record your voice passphrase to register your voice fingerprint.
2. **Launch Interview**: Click **Start Interview** or navigate directly to:
   [http://127.0.0.1:8000/interview-room?session=YOUR_SESSION_UUID](http://127.0.0.1:8000/interview-room?session=YOUR_SESSION_UUID)
   * Complete the interview. If you turn your head, pause the feed, or if a different face enters the screen, the system will flag the session and prompt warning messages.
