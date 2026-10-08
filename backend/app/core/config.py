import os
from typing import List
from pydantic_settings import BaseSettings

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
        """Returns the Gemini API key if configured and not an OpenAI sk- key."""
        if self.GEMINI_API_KEY and not self.GEMINI_API_KEY.startswith("sk-"):
            return self.GEMINI_API_KEY.strip()
        if self.OPENAI_API_KEY and self.OPENAI_API_KEY.startswith("AIzaSy"):
            return self.OPENAI_API_KEY.strip()
        return ""

    @property
    def effective_openai_key(self) -> str:
        """Returns the OpenAI API key if configured or if an sk- key was entered in GEMINI_API_KEY."""
        if self.OPENAI_API_KEY and (self.OPENAI_API_KEY.startswith("sk-") or len(self.OPENAI_API_KEY) > 20):
            return self.OPENAI_API_KEY.strip()
        if self.GEMINI_API_KEY and self.GEMINI_API_KEY.startswith("sk-"):
            return self.GEMINI_API_KEY.strip()
        return ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
