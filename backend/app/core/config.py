import os
from typing import List
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from psycopg.conninfo import make_conninfo

# Search for environment variables and secrets in hierarchical order:
# 1. Custom explicit path: VOICETASKS_ENV_FILE
# 2. Local backend/.env (Standard team location when cloning repo)
# 3. Project root .env
# 4. User-profile location: ~/.voicetasks.env
_possible_env_paths = [
    os.environ.get("VOICETASKS_ENV_FILE", ""),
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env"),
    os.path.expanduser("~/.voicetasks.env"),
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
    ELEVEN_LAB_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""

    # Default Timezone for resolving relative words (e.g. "kal", "tomorrow")
    DEFAULT_TIMEZONE: str = "Asia/Kolkata"

    # Allowed CORS Origins (set via CORS_ORIGINS environment variable for production AWS/CloudFront origins)
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]

    API_RATE_LIMIT_PER_MINUTE: int = 120
    VOICE_RATE_LIMIT_PER_MINUTE: int = 20
    AUDIO_RATE_LIMIT_PER_MINUTE: int = 5
    MAX_AUDIO_UPLOAD_BYTES: int = 15 * 1024 * 1024

    # PostgreSQL. Set DATABASE_URL or provide the PG* values below.
    DATABASE_URL: str = ""
    PGHOST: str = "localhost"
    PGPORT: int = 5433
    PGDATABASE: str = "vocatask"
    PGUSER: str = "vocatask_user"
    PGPASSWORD: str = ""
    DATABASE_POOL_MAX_SIZE: int = 5
    DATABASE_POOL_TIMEOUT: float = 10.0

    # Authentication & OAuth Settings
    JWT_SECRET_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    FACEBOOK_APP_ID: str = ""
    FACEBOOK_APP_SECRET: str = ""

    @property
    def database_connection_string(self) -> str:
        if self.DATABASE_URL.strip():
            return self.DATABASE_URL.strip()
        if not self.PGPASSWORD:
            raise ValueError("Set DATABASE_URL or PGPASSWORD to configure PostgreSQL.")
        return make_conninfo(
            host=self.PGHOST,
            port=self.PGPORT,
            dbname=self.PGDATABASE,
            user=self.PGUSER,
            password=self.PGPASSWORD,
        )

    @property
    def effective_elevenlabs_key(self) -> str:
        """Returns the ElevenLabs API key if configured."""
        candidates = [
            self.ELEVEN_LAB_API_KEY,
            self.ELEVENLABS_API_KEY,
            os.environ.get("ELEVEN_LAB_API_KEY", ""),
            os.environ.get("ELEVENLABS_API_KEY", ""),
        ]
        for key in candidates:
            k = (key or "").strip(" \t\r\n\"'")
            if len(k) > 10:
                return k
        return ""

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
        if self.effective_elevenlabs_key:
            return "elevenlabs"
        if self.effective_groq_key:
            return "groq"
        if self.effective_openai_key:
            return "openai"
        return "builtin"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

