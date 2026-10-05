# 🎙️ VoiceTasks AI

> **A voice-first, multilingual AI task manager built as an installable Progressive Web App (PWA) with a Python FastAPI backend.**

Speak naturally in **any language** (English, Hindi, Punjabi, Hinglish, Spanish, etc.), and the AI pipeline will transcribe, understand dates & times (*"kal shaam 6 baje"*, *"tomorrow at 10 AM"*, *"ਕੱਲ੍ਹ ਸ਼ਾਮ gym ਜਾਣਾ"*), and automatically create structured, prioritized tasks.

---

## 🌟 Key Features

* **📱 Universal Installable PWA:**
  * **Android:** Native "Install App" browser prompt via Web App Manifest & Service Worker.
  * **iOS (iPhone/iPad):** Zero-friction "Add to Home Screen" support (no App Store fees or Mac required).
* **🎙️ Voice Capture in Any Language:**
  * High-fidelity Web Audio API recording with soundwave visualizer & recording timer.
  * Real-time multilingual Speech-to-Text (Groq Whisper-large-v3 / OpenAI Whisper).
* **🧠 Context-Aware AI Task Extraction:**
  * Automatically resolves relative dates (*"kal"*, *"parson"*, *"today"*, *"next Monday"*) based on user timezone.
  * Resolves colloquial times (*"subah"* $\rightarrow$ 09:00, *"shaam"* $\rightarrow$ 18:00, *"raat"* $\rightarrow$ 21:00).
  * Auto-tags category (*study, work, health, finance, personal*) and priority (*low, medium, high*).
* **✅ Pre-Save AI Confirmation Sheet:**
  * Clean review modal allowing users to edit the parsed title, pick dates, or adjust categories before saving.
  * Celebratory confetti animation upon task creation.
* **⚡ Offline-Resilient & Fast:**
  * SQLite persistent database on FastAPI backend.
  * Automatic `localStorage` caching in the PWA so tasks are always accessible even when offline.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Device (iOS / Android / Desktop)"]
        UI["VoiceTasks PWA UI (React + Tailwind)"]
        MIC["Microphone Recorder (MediaRecorder API)"]
        MODAL["AI Confirmation Sheet"]
    end

    subgraph Backend ["FastAPI Server (Python)"]
        API["POST /api/voice/process"]
        STT["Multilingual STT (Groq Whisper / OpenAI)"]
        LLM["AI Parser & Date Normalizer"]
        DB[(SQLite / Supabase Postgres)]
    end

    MIC -->|Audio Blob| API
    API --> STT
    STT -->|Transcript| LLM
    LLM -->|Structured Task JSON| MODAL
    MODAL -->|Confirm & Save| DB
    DB --> UI
```

---

## 🚀 Quick Start (Running Locally)

### 1. Prerequisites
* **Node.js** (v18+)
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

# (Optional) Add your API keys in backend/.env:
# GROQ_API_KEY=your_groq_api_key_here
# OPENAI_API_KEY=your_openai_api_key_here

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

# Install packages
npm install

# Start Vite development server
npm run dev
```
* Frontend will be running at: `http://localhost:5173`

---

## 📲 How to Install as an App on Mobile

### On Android:
1. Open Chrome and go to your app URL (or local network IP e.g. `http://192.168.x.x:5173`).
2. An **"Install VoiceTasks App"** banner will automatically appear at the bottom.
3. Tap **Install** $\rightarrow$ VoiceTasks AI will appear directly on your home screen and app drawer just like a native app.

### On iOS (iPhone / iPad):
1. Open Safari and navigate to your app URL.
2. Tap the **Share icon** (`⬆`) at the bottom navigation bar.
3. Scroll down and tap **"Add to Home Screen"** (`➕`).
4. Tap **Add** $\rightarrow$ VoiceTasks AI will open in fullscreen mode without Safari URL bars.

---

## ☁️ Production Deployment Guide

### Deploying the Backend (Render or Railway)
1. Push your repository to **GitHub**.
2. Go to [render.com](https://render.com) and create a **New Web Service**.
3. Connect your GitHub repository and set:
   * **Root Directory:** `backend`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. In **Environment Variables**, add:
   * `GROQ_API_KEY` = your Groq API key
   * `OPENAI_API_KEY` = your OpenAI key (optional)
   * `DEFAULT_TIMEZONE` = `Asia/Kolkata`
5. Render will provide a live HTTPS URL (e.g., `https://voicetasks-api.onrender.com`).

### Deploying the Frontend (Vercel)
1. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
2. Select your repository and set:
   * **Root Directory:** `frontend`
   * **Framework Preset:** `Vite`
3. In **Environment Variables**, set:
   * `VITE_API_URL` = `https://voicetasks-api.onrender.com`
4. Click **Deploy**. Vercel will automatically provision HTTPS SSL (required for PWA installation and microphone permissions).

---

## 📂 Project Structure

```
react js learning/
├── backend/
│   ├── app/
│   │   ├── api/             # Voice & Tasks endpoints
│   │   ├── core/            # Config & environment settings
│   │   ├── schemas/         # Pydantic validation models
│   │   ├── services/        # STT, AI LLM Parser, Task Store
│   │   └── main.py          # FastAPI app entrypoint
│   ├── run.py               # Local server runner
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Environment variables
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
