import logging
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from app.schemas.task import ExtractedTask, TextProcessRequest
from app.services.ai_parser import parse_voice_to_task
from app.core.config import settings

logger = logging.getLogger("voice_api")
router = APIRouter(prefix="/voice", tags=["Voice & AI"])

@router.post("/process-text", response_model=ExtractedTask)
async def process_text_task(
    request: TextProcessRequest,
    x_groq_key: Optional[str] = Header(default=None, alias="X-Groq-Key"),
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key"),
    x_openai_key: Optional[str] = Header(default=None, alias="X-OpenAI-Key"),
):
    """
    Accepts speech-transcribed text (from browser-native Web Speech API or manual text input)
    and extracts structured task details (title, dates, times, priority, category).
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
        
    tz = request.user_timezone or settings.DEFAULT_TIMEZONE
    extracted = await parse_voice_to_task(
        transcript=request.text.strip(),
        timezone_name=tz,
        groq_api_key=x_groq_key,
        openai_api_key=x_openai_key,
        gemini_api_key=x_gemini_key
    )
    return extracted
