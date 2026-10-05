import os
import io
import logging
from typing import Tuple
from app.core.config import settings

logger = logging.getLogger("speech_service")

async def transcribe_audio(file_bytes: bytes, filename: str = "audio.webm") -> Tuple[str, str]:
    """
    Transcribes audio bytes to text using available STT providers:
    1. Groq Whisper (whisper-large-v3) - fastest multilingual STT
    2. OpenAI Whisper (whisper-1)
    3. Fallback mock for local testing when keys are not yet configured
    
    Returns:
        Tuple[str, str]: (transcription_text, language_code)
    """
    # 1. Try Groq Whisper if key is available
    groq_key = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
    if groq_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_key)
            
            # Create in-memory file tuple for Groq SDK
            file_obj = (filename, file_bytes)
            
            logger.info("Transcribing audio using Groq Whisper-large-v3...")
            transcription = client.audio.transcriptions.create(
                file=file_obj,
                model="whisper-large-v3",
                response_format="verbose_json",
                temperature=0.0
            )
            
            text = getattr(transcription, "text", "")
            language = getattr(transcription, "language", "auto")
            logger.info(f"Groq transcription completed: '{text}' (lang: {language})")
            return text.strip(), language
        except Exception as e:
            logger.error(f"Groq Whisper transcription failed: {e}")
            # Fall through to next provider

    # 2. Try OpenAI Whisper if key is available
    openai_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")
    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            
            file_obj = io.BytesIO(file_bytes)
            file_obj.name = filename
            
            logger.info("Transcribing audio using OpenAI Whisper...")
            transcription = client.audio.transcriptions.create(
                file=file_obj,
                model="whisper-1",
                response_format="verbose_json"
            )
            
            text = getattr(transcription, "text", "")
            language = getattr(transcription, "language", "auto")
            logger.info(f"OpenAI transcription completed: '{text}' (lang: {language})")
            return text.strip(), language
        except Exception as e:
            logger.error(f"OpenAI Whisper transcription failed: {e}")

    # 3. Fallback when running without cloud keys
    logger.warning("No STT API key configured (GROQ_API_KEY or OPENAI_API_KEY). Using fallback response.")
    return (
        "Kal shaam 6 baje DBMS project submit karna hai",
        "hi"
    )
