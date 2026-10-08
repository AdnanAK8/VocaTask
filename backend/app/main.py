import logging
from fastapi import FastAPI
from mangum import Mangum
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import tasks
from app.api import voice


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

# Enable CORS for cross-origin requests from PWA running locally or in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(voice.router, prefix=settings.API_V1_STR)
app.include_router(tasks.router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "gemini_configured": bool(settings.effective_gemini_key),
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
