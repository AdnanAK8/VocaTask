import logging
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form
from app.schemas.task import ExtractedTask, TextProcessRequest
from app.services.ai_parser import parse_voice_to_task
from app.services.speech_service import transcribe_audio_file
from app.core.config import settings

logger = logging.getLogger("voice_api")
router = APIRouter(prefix="/voice", tags=["Voice & AI"])

@router.get("/status")
async def get_voice_status():
    """
    Returns AI model status and configuration so frontend and team members know
    if backend cloud AI is active.
    """
    has_gemini = bool(settings.effective_gemini_key)
    has_openai = bool(settings.effective_openai_key)
    has_groq = bool(settings.effective_groq_key)
    provider = settings.active_ai_provider

    return {
        "backend_ai_configured": bool(has_gemini or has_openai or has_groq),
        "provider": provider,
        "has_gemini": has_gemini,
        "has_openai": has_openai,
        "has_groq": has_groq,
        "message": (
            f"Backend cloud AI is configured with {provider.upper()} from server .env."
            if (has_gemini or has_openai or has_groq)
            else "Backend is running fast built-in multilingual AI parser."
        )
    }

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

@router.post("/process-audio", response_model=ExtractedTask)
async def process_audio_task(
    file: UploadFile = File(...),
    user_timezone: Optional[str] = Form(default=None),
    language: Optional[str] = Form(default=None),
    x_groq_key: Optional[str] = Header(default=None, alias="X-Groq-Key"),
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key"),
    x_openai_key: Optional[str] = Header(default=None, alias="X-OpenAI-Key"),
):
    """
    Accepts uploaded audio blob/file (webm, wav, mp3, m4a), transcribes it via Whisper / Gemini,
    and extracts structured task details.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

        transcript = await transcribe_audio_file(
            file_bytes=content,
            filename=file.filename or "audio.webm",
            groq_api_key=x_groq_key,
            openai_api_key=x_openai_key,
            gemini_api_key=x_gemini_key,
            language=language
        )

        tz = user_timezone or settings.DEFAULT_TIMEZONE
        extracted = await parse_voice_to_task(
            transcript=transcript,
            timezone_name=tz,
            groq_api_key=x_groq_key,
            openai_api_key=x_openai_key,
            gemini_api_key=x_gemini_key
        )
        return extracted
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error processing audio task: {e}")
        raise HTTPException(status_code=500, detail=str(e))
