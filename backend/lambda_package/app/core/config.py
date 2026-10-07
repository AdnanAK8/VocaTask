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
    
    # Allowed CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # SQLite Database for lightweight local persistent storage
    DATABASE_PATH: str = "tasks.db"
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
