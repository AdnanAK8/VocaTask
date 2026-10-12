import logging
from fastapi import FastAPI
from mangum import Mangum
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.api import tasks
from app.api import voice
from app.api import auth


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multilingual Voice-to-Task AI Assistant API with PWA support"
)

# CORS is intentionally limited to explicitly configured frontend origins.
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=settings.API_RATE_LIMIT_PER_MINUTE,
    voice_requests_per_minute=settings.VOICE_RATE_LIMIT_PER_MINUTE,
    audio_requests_per_minute=settings.AUDIO_RATE_LIMIT_PER_MINUTE,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(voice.router, prefix=settings.API_V1_STR)
app.include_router(tasks.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "gemini_configured": bool(settings.effective_gemini_key),
        "elevenlabs_configured": bool(settings.effective_elevenlabs_key),
        "groq_configured": bool(settings.GROQ_API_KEY),
        "openai_configured": bool(settings.effective_openai_key)
    }

@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to VoiceTasks AI API",
        "docs": "/docs",
        "health": "/health"
    }

handler = Mangum(app)
