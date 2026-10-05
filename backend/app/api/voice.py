import logging
from fastapi import APIRouter, UploadFile, File, Header, HTTPException
from app.schemas.task import ExtractedTask, TextProcessRequest
from app.services.speech_service import transcribe_audio
from app.services.ai_parser import parse_voice_to_task
from app.core.config import settings

logger = logging.getLogger("voice_api")
router = APIRouter(prefix="/voice", tags=["Voice & AI"])

@router.post("/process", response_model=ExtractedTask)
async def process_voice_audio(
    audio: UploadFile = File(...),
    x_user_timezone: str = Header(default="Asia/Kolkata", alias="X-User-Timezone")
):
    """
    Accepts raw audio recorded from PWA (e.g. .webm, .m4a, .mp4, .wav).
    1. Transcribes audio to multilingual text.
    2. Runs AI task extraction with date/time resolution based on user's timezone.
    3. Returns validated ExtractedTask.
    """
    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file received.")
            
        logger.info(f"Received audio file '{audio.filename}' of size {len(audio_bytes)} bytes.")
        
        # 1. Transcribe
        transcript, lang = await transcribe_audio(audio_bytes, audio.filename or "audio.webm")
        if not transcript:
            raise HTTPException(status_code=422, detail="Speech could not be recognized. Please speak clearly.")
            
        # 2. AI Parse Task
        extracted = await parse_voice_to_task(transcript, timezone_name=x_user_timezone)
        if lang and lang != "auto":
            extracted.language = lang
            
        return extracted
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in process_voice_audio: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process-text", response_model=ExtractedTask)
async def process_text_task(request: TextProcessRequest):
    """
    Accepts raw text (from browser-native Web Speech API or manual text input)
    and extracts structured task details.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
        
    tz = request.user_timezone or settings.DEFAULT_TIMEZONE
    extracted = await parse_voice_to_task(request.text.strip(), timezone_name=tz)
    return extracted
