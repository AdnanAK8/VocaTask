import os
import io
import logging
from typing import Tuple, Optional
from app.core.config import settings

logger = logging.getLogger("speech_service")

async def transcribe_audio(
    file_bytes: bytes,
    filename: str = "audio.webm",
    groq_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
    gemini_api_key: Optional[str] = None
) -> Tuple[str, str]:
    """
    Transcribes audio bytes to text using available STT providers:
    1. Groq Whisper (whisper-large-v3) - fastest and highest accuracy
    2. OpenAI Whisper (whisper-1)
    3. Google Gemini Multimodal Audio
    """
    # 1. Try Groq Whisper
    groq_key = groq_api_key or settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
    if groq_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_key)
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
            if text.strip():
                return text.strip(), language
        except Exception as e:
            logger.error(f"Groq Whisper transcription failed: {e}")

    # 2. Try OpenAI Whisper
    openai_key = openai_api_key or settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")
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
            if text.strip():
                return text.strip(), language
        except Exception as e:
            logger.error(f"OpenAI Whisper transcription failed: {e}")

    # 3. Try Google Gemini Audio
    gemini_key = gemini_api_key or settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=gemini_key)
            mime_type = "audio/webm" if "webm" in filename.lower() else "audio/mp4"
            
            logger.info("Transcribing audio using Google Gemini multimodal...")
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    "Transcribe this audio verbatim in the original spoken language. Return only the exact transcription text."
                ]
            )
            if response.text and response.text.strip():
                logger.info(f"Gemini transcription completed: '{response.text.strip()}'")
                return response.text.strip(), "auto"
        except Exception as e:
            logger.error(f"Gemini transcription failed: {e}")

    # If no keys worked, provide an actionable and clear message
    raise ValueError(
        "Audio transcription requires an API key for Groq Whisper, OpenAI, or Gemini. "
        "Please enter a free Groq API key in Settings, or use Chrome/Safari live browser recognition."
    )
