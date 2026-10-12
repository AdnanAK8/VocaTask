# 🎙️ VoiceTasks AI

> **A voice-first, multilingual AI task manager built as an installable Progressive Web App (PWA) with a Python FastAPI backend.**

Speak naturally in **any language** (English, Hindi, Punjabi, Hinglish, Spanish, etc.), and the AI pipeline will transcribe, understand dates & times (*"kal shaam 6 baje"*, *"tomorrow at 10 AM"*, *"ਕੱਲ੍ਹ ਸ਼ਾਮ gym ਜਾਣਾ"*), and automatically create structured, prioritized tasks.

---

## 🌟 Key Features

* **📱 Universal Installable PWA:**
  * **Android:** Native "Install App" browser prompt via Web App Manifest & Service Worker.
  * **iOS (iPhone/iPad):** Zero-friction "Add to Home Screen" support (no App Store fees or Mac required).
* **🎙️ Voice Capture in Any Language:**
  * Real-time browser-native Web Speech API with soundwave visualizer & live transcription.
  * Zero latency, zero cloud upload fees, and works natively across Chrome, Safari, and Edge.
* **🧠 Context-Aware AI Task Extraction:**
  * Automatically resolves relative dates (*"kal"*, *"parson"*, *"today"*, *"next Monday"*) based on user timezone.
  * Resolves colloquial times (*"subah"* $\rightarrow$ 09:00, *"shaam"* $\rightarrow$ 18:00, *"raat"* $\rightarrow$ 21:00).
  * Auto-tags category (*study, work, health, finance, personal*) and priority (*low, medium, high*).
* **✅ Pre-Save AI Confirmation Sheet:**
  * Clean review modal allowing users to edit the parsed title, pick dates, or adjust categories before saving.
  * Celebratory confetti animation upon task creation.
* **⚡ Fast, with Local Development Caching:**
  * SQLite storage for local development, with successful task responses cached in browser storage.
  * Production task reads and writes require a reachable backend; browser cache is not a substitute for durable backend storage.

* **🔐 Multi-Method Authentication Gate:**
  * **Interactive Gate Before Entry:** Users are greeted and required to provide their name and authenticate before accessing the live task manager.
  * **Email & Password:** Registration and login with PBKDF2-HMAC-SHA256 password security and JWT tokens.
  * **Mobile Phone Number:** International phone support with 6-digit SMS OTP verification (with developer test OTP mode).
  * **Google Sign-In:** One-click Google OAuth 2.0 and Google Identity Services API verification.
  * **Facebook Login:** OAuth integration verified with Facebook Graph API.
  * **Live Redirection:** Authenticated users are smoothly transitioned into their personalized dashboard with user-isolated tasks.

> **Authentication & Multi-Tenant Support:** The backend API verifies tokens via signed HMAC-SHA256 JWTs (`Authorization: Bearer <token>`) and isolates tasks by authenticated user (`user_id`). Provider credentials for Google and Facebook can be set via `.env` or passed via frontend.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Device (iOS / Android / Desktop)"]
        UI["VoiceTasks PWA UI (React + Tailwind)"]
        MIC["Browser Native Web Speech API"]
        MODAL["AI Confirmation Sheet"]
    end

    subgraph Backend ["FastAPI Server (Python)"]
        API["POST /api/voice/process-text"]
        LLM["AI Parser & Multilingual Date Normalizer"]
        DB[(SQLite Persistent Storage)]
    end

    MIC -->|Live Transcribed Text| API
    API --> LLM
    LLM -->|Structured Task JSON| MODAL
    MODAL -->|Confirm & Save| DB
    DB --> UI
```

---

## 🚀 Quick Start (Running Locally)

### Prerequisites

* **Node.js** (`^20.19.0` or `>=22.12.0`, required by Vite 8)
* **Python** (3.11+)

---

### 2. Backend Setup (FastAPI)

```bash
# Navigate to backend
cd backend

# Create virtual environment (if not already created)
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### 🔐 Environment Variables & Team Collaboration (GitHub)

Every team member works with their own local environment file:

```bash
# Copy the example template into backend/.env
# Windows:
copy .env.example .env
# Mac / Linux:
cp .env.example .env
```

Open `backend/.env` and add any provider keys you want to use:

```env
# Google Gemini (Recommended - free tier via Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key_here

# ElevenLabs (for Speech-to-Text Scribe STT - use the secret key starting with sk_)
ELEVEN_LAB_API_KEY=sk_your_elevenlabs_secret_key_here

# Groq (Alternative for ultra-fast Llama-3.3 / Whisper)
GROQ_API_KEY=your_groq_api_key_here

# OpenAI (Alternative for GPT-4o-mini / Whisper)
OPENAI_API_KEY=your_openai_api_key_here
```

**Security note:** `backend/.env` is ignored by Git and must never be committed. Use your own provider keys or share them only through an approved secret manager, never through GitHub, chat, or a committed file.

`backend/.env.example` is a template only. Put real provider credentials in `backend/.env` locally or in the backend host's secret/environment-variable settings. Never put provider keys in `VITE_*` variables or frontend source. Keys entered in app Settings are stored in that browser's local storage and are visible to that browser's owner.

The backend looks for environment configuration in this order:

1. Custom path in `VOICETASKS_ENV_FILE`, if set
2. `backend/.env`
3. Repository-root `.env`
4. `~/.voicetasks.env` (for example, `C:\Users\<username>\.voicetasks.env`)
5. Operating system or container environment variables

#### API configuration and limits

The backend uses these defaults; override them in the backend environment when needed:

| Variable | Default | Purpose |
| -------- | ------: | ------- |
| `CORS_ORIGINS` | Local development origins | Exact JSON array of allowed browser origins |
| `API_RATE_LIMIT_PER_MINUTE` | `120` | General API requests per IP per minute |
| `VOICE_RATE_LIMIT_PER_MINUTE` | `20` | Voice API requests per IP per minute |
| `AUDIO_RATE_LIMIT_PER_MINUTE` | `5` | Audio transcription requests per IP per minute |
| `MAX_AUDIO_UPLOAD_BYTES` | `15728640` | Maximum uploaded audio size (15 MiB) |

The in-process limits are per backend instance and are not authentication. Add gateway/WAF throttling for a shared deployment-wide limit. The application currently has no user authentication or per-user task ownership.

```bash
# Start the FastAPI server
python run.py
```

* Backend will be running at: `http://127.0.0.1:8000`
* Interactive API Docs (Swagger): `http://127.0.0.1:8000/docs`

> **Note:** Even without any API keys, the server runs a built-in **Intelligent Multilingual Heuristic Parser** that understands Hindi, Hinglish, Punjabi, and English dates and categories!

---

### 3. Frontend Setup (React PWA)

```bash
# In a new terminal, navigate to frontend
cd frontend

# Install locked dependencies
npm ci

# Option A: Start Vite for Laptop/Desktop browser
npm run dev
# (Accessible at http://localhost:5173)

# Option B: Start Vite with HTTPS for Mobile (Android / iOS / Phone) Testing
npm run dev:https
# (Accessible at https://<your-lan-ip>:5173 - enables microphone permissions on Android and iOS!)
```

---

### 🧪 Running Tests

#### Backend Test Suite

```bash
cd backend
# Windows:
.\venv\Scripts\python.exe -m unittest discover -s tests -v
# Mac/Linux:
python -m unittest discover -s tests -v
```

#### Frontend Linter & Build Verification

```bash
cd frontend
npm ci
npm test
```

---

## 📲 How to Install as an App on Mobile

### On Android

1. Open Chrome and go to your app URL (or local network IP e.g. `http://192.168.x.x:5173`).

2. An **"Install VoiceTasks App"** banner will automatically appear at the bottom.
3. Tap **Install** $\rightarrow$ VoiceTasks AI will appear directly on your home screen and app drawer just like a native app.

### On iOS (iPhone / iPad)

1. Open Safari and navigate to your app URL.
2. Tap the **Share icon** (`⬆`) at the bottom navigation bar.
3. Scroll down and tap **"Add to Home Screen"** (`➕`).
4. Tap **Add** $\rightarrow$ VoiceTasks AI will open in fullscreen mode without Safari URL bars.

---

## ☁️ Production Setup

### AWS Amplify + App Runner

1. Deploy the FastAPI service from the `backend` directory using `backend/apprunner.yaml`, or configure App Runner with build command `pip install -r requirements.txt`, start command `uvicorn app.main:app --host 0.0.0.0 --port 8000`, and port `8000`.
1. In the App Runner environment, add only the provider keys you intend to use (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, and/or `ELEVEN_LAB_API_KEY`). Set `DEFAULT_TIMEZONE=Asia/Kolkata`. Set `CORS_ORIGINS` to a JSON array containing the exact frontend origin, such as `["https://main.example.amplifyapp.com"]`; do not use `*` in production.
1. The backend defaults to `API_RATE_LIMIT_PER_MINUTE=120`, `VOICE_RATE_LIMIT_PER_MINUTE=20`, and `AUDIO_RATE_LIMIT_PER_MINUTE=5`. Configure API Gateway/WAF throttling too if traffic passes through those services; in-process limits are per instance.
1. In AWS Amplify, connect the repository and use the root `amplify.yml`. Set `VITE_API_URL` to the backend HTTPS base URL with no trailing slash. For example, use `https://api.example.com`, not a URL ending in `/api`; the frontend adds `/api` automatically. For API Gateway, include a named stage in the base URL, such as `https://<api-id>.execute-api.<region>.amazonaws.com/<stage>`.
1. Redeploy the frontend after setting `VITE_API_URL`. Set backend `CORS_ORIGINS` to the exact Amplify or CloudFront origin, including `https://` and excluding any path.
1. Verify `GET <backend-url>/health`, `GET <backend-url>/api/voice/status`, and voice/task requests in the browser Network tab. A `404` usually means an API route or gateway stage is missing/not deployed; a CORS error means the origin or gateway CORS configuration does not match.

If deploying the backend behind API Gateway and Lambda, configure a Lambda proxy integration for the root and `/{proxy+}` routes, deploy the stage, and allow the required methods and headers at the gateway. The screenshot's `execute-api` URL indicates this API Gateway path rather than an App Runner hostname. See [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md) for detailed AWS steps.

### Docker Compose

From the repository root, optionally create a root `.env` file for backend provider keys (do not commit it), then run:

```bash
docker compose up --build
```

Open `http://localhost`. The frontend container uses the same-origin `/api` path and Nginx proxies it to the backend container. The API is also available directly at `http://localhost:8000`. The compose configuration stores SQLite data in a Docker volume; production AWS deployments need a durable database/storage configuration because container-local SQLite files may not survive replacement or scale-out.

### Production Security Checklist

* Keep provider credentials in the backend host's secret store/environment variables; never put them in frontend build variables or source.
* Configure exact CORS origins and gateway-level rate limits. CORS does not prevent direct API clients from calling a public endpoint.
* Add authentication (for example, Cognito/JWT validation) and enforce per-user ownership on every task operation before using real personal data.
* Use durable shared storage for production tasks; local SQLite is suitable for development/single-instance use, not horizontally scaled deployments.
* HTTPS is required for browser microphone access.

---

## 📂 Project Structure

```text
react js learning/
├── backend/
│   ├── app/
│   │   ├── api/             # Voice & Tasks endpoints
│   │   ├── core/            # Config, middleware, and environment settings
│   │   ├── schemas/         # Pydantic validation models
│   │   ├── services/        # STT, AI LLM Parser, Task Store
│   │   └── main.py          # FastAPI app entrypoint
│   ├── run.py               # Local server runner
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment variables template (Committed)
│   └── .env                 # Local secrets file (Gitignored)
├── frontend/
│   ├── public/
│   │   ├── favicon.svg      # App icon
│   │   └── icons/           # PWA 192x192 and 512x512 icons
│   ├── src/
│   │   ├── components/      # VoiceRecorder, TaskConfirmModal, TaskList, etc.
│   │   ├── services/        # API client & local cache
│   │   ├── types/           # TypeScript interfaces
│   │   ├── App.tsx          # Root UI layout
│   │   └── index.css        # Tailwind styling & animations
│   ├── vite.config.ts       # Vite configuration with PWA plugin
│   └── tailwind.config.js   # Tailwind theme
└── README.md
```
