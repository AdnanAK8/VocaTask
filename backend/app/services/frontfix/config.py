import os
from pathlib import Path
from app.core.config import settings

CURRENT_DIR = Path(__file__).resolve().parent
APP_DIR = CURRENT_DIR.parent.parent
DATA_DIR = APP_DIR / "data"

def is_real_key(value: str | None) -> bool:
    if not value or not isinstance(value, str):
        return False
    val = value.strip().lower()
    placeholders = {
        "changeme",
        "placeholder",
        "your_gemini_api_key_here",
        "your_openai_api_key_here",
        "none",
        "null",
        "test",
        "undefined",
    }
    if val in placeholders:
        return False
    if val.startswith("your_") or val.startswith("paste_") or val.startswith("<"):
        return False
    return len(val) >= 12

class FrontFixConfig:
    env: str = os.getenv("ENV", "development")
    gemini_api_key: str = (os.getenv("GEMINI_API_KEY") or settings.effective_gemini_key or settings.GEMINI_API_KEY or "").strip()
    gemini_model: str = (os.getenv("GEMINI_MODEL") or os.getenv("LLM_MODEL") or "gemini-flash-lite-latest").strip()
    openai_api_key: str = (os.getenv("OPENAI_API_KEY") or settings.effective_openai_key or settings.OPENAI_API_KEY or "").strip()
    openai_base_url: str = (os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")).rstrip("/")
    openai_model: str = (os.getenv("OPENAI_MODEL", "gpt-4o-mini")).strip()
    groq_api_key: str = (os.getenv("GROQ_API_KEY") or settings.effective_groq_key or settings.GROQ_API_KEY or "").strip()
    max_log_file_size: int = 2 * 1024 * 1024  # 2MB
    knowledge_path: Path = DATA_DIR / "knowledge.json"

config = FrontFixConfig()
