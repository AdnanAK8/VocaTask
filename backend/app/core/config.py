import os
from typing import List
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Search for environment variables and secrets in hierarchical order:
# 1. Custom explicit path: VOICETASKS_ENV_FILE
# 2. Secure user-profile location outside repository: ~/.voicetasks.env
# 3. Local backend/.env (standard local dev fallback)
# 4. Project root .env
_possible_env_paths = [
    os.environ.get("VOICETASKS_ENV_FILE", ""),
    os.path.expanduser("~/.voicetasks.env"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env"),
]

_env_loaded = False
for _path in _possible_env_paths:
    if _path and os.path.isfile(_path):
        load_dotenv(_path, override=True)
        _env_loaded = True
        break

if not _env_loaded:
    load_dotenv(override=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "VoiceTasks AI API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # API Keys
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    
    # Default Timezone for resolving relative words (e.g. "kal", "tomorrow")
    DEFAULT_TIMEZONE: str = "Asia/Kolkata"
    
    # Allowed CORS Origins (set via CORS_ORIGINS environment variable for production AWS/CloudFront origins)
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]
    
    # SQLite Database for lightweight local persistent storage
    DATABASE_PATH: str = "tasks.db"

    @property
    def effective_gemini_key(self) -> str:
        """Returns the Gemini API key if configured and valid, filtering out placeholder dummies and OpenAI keys."""
        candidates = [self.GEMINI_API_KEY, os.environ.get("GEMINI_API_KEY", ""), self.OPENAI_API_KEY]
        for key in candidates:
            k = (key or "").strip(" \t\r\n\"'")
            if (k.startswith("AIzaSy") or k.startswith("AQ.")) and not k.startswith("AIzaSyDXYy") and len(k) > 20:
                return k
        return ""

    @property
    def effective_openai_key(self) -> str:
        """Returns the OpenAI API key if configured or if an sk- key was entered in GEMINI_API_KEY."""
        candidates = [self.OPENAI_API_KEY, os.environ.get("OPENAI_API_KEY", ""), self.GEMINI_API_KEY, os.environ.get("GEMINI_API_KEY", "")]
        for key in candidates:
            k = (key or "").strip()
            if k.startswith("sk-") and not k.startswith("sk-placeholder") and len(k) > 20:
                return k
        return ""

    @property
    def effective_groq_key(self) -> str:
        """Returns the Groq API key if configured or if a gsk_ key was entered."""
        candidates = [self.GROQ_API_KEY, os.environ.get("GROQ_API_KEY", ""), self.GEMINI_API_KEY, os.environ.get("GEMINI_API_KEY", "")]
        for key in candidates:
            k = (key or "").strip()
            if k.startswith("gsk_") and not k.startswith("gsk_placeholder") and len(k) > 20:
                return k
        return ""

    @property
    def active_ai_provider(self) -> str:
        """Returns the name of the active AI provider configured in the backend."""
        if self.effective_gemini_key:
            return "gemini"
        if self.effective_groq_key:
            return "groq"
        if self.effective_openai_key:
            return "openai"
        return "builtin"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

