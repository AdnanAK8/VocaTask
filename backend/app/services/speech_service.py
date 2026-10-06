import io
import os
import logging
from typing import Optional

logger = logging.getLogger("speech_service")

async def transcribe_audio_file(
    file_bytes: bytes,
    filename: str,
    groq_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
    gemini_api_key: Optional[str] = None,
    language: Optional[str] = None
) -> str:
    """
    Transcribes audio file bytes into text using Groq Whisper, OpenAI Whisper, or Gemini Multimodal.
    Supports audio formats: webm, wav, mp3, m4a, ogg, etc.
    """
    if not file_bytes or len(file_bytes) == 0:
        raise ValueError("Empty audio payload received.")

    # 1. Try Groq Whisper (Fastest & highly accurate)
    groq_key = groq_api_key or os.environ.get("GROQ_API_KEY")
    if groq_key and len(groq_key) > 10:
        try:
            from groq import Groq
            client = Groq(api_key=groq_key)
            audio_file = (filename or "audio.webm", file_bytes)
            
            kwargs = {
                "file": audio_file,
                "model": "whisper-large-v3-turbo",
                "response_format": "json",
                "temperature": 0.0,
            }
            if language and language not in ("auto", "hinglish"):
                # Clean language code (e.g., 'hi-IN' -> 'hi', 'pa-IN' -> 'pa')
                clean_lang = language.split("-")[0]
                kwargs["language"] = clean_lang

            transcription = client.audio.transcriptions.create(**kwargs)
            text = getattr(transcription, "text", str(transcription)).strip()
            if text:
                logger.info("Successfully transcribed audio using Groq Whisper.")
                return text
        except Exception as e:
            logger.warning(f"Groq Whisper transcription failed, falling back: {e}")

    # 2. Try OpenAI Whisper
    openai_key = openai_api_key or os.environ.get("OPENAI_API_KEY")
    if openai_key and len(openai_key) > 10:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            audio_file = (filename or "audio.webm", file_bytes)
            
            kwargs = {
                "file": audio_file,
                "model": "whisper-1",
            }
            if language and language not in ("auto", "hinglish"):
                clean_lang = language.split("-")[0]
                kwargs["language"] = clean_lang

            transcription = client.audio.transcriptions.create(**kwargs)
            text = getattr(transcription, "text", str(transcription)).strip()
            if text:
                logger.info("Successfully transcribed audio using OpenAI Whisper.")
                return text
        except Exception as e:
            logger.warning(f"OpenAI Whisper transcription failed, falling back: {e}")

    # 3. Try Gemini Multimodal Audio
    gemini_key = gemini_api_key or os.environ.get("GEMINI_API_KEY")
    if gemini_key and len(gemini_key) > 10 and not gemini_key.startswith("AIzaSyDXYy"): # ensure key isn't test dummy
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=gemini_key)
            
            # Infer mime type
            mime_type = "audio/webm"
            if filename.endswith(".wav"): mime_type = "audio/wav"
            elif filename.endswith(".mp3"): mime_type = "audio/mp3"
            elif filename.endswith(".m4a"): mime_type = "audio/m4a"
            elif filename.endswith(".ogg"): mime_type = "audio/ogg"

            prompt = "Transcribe the audio speech accurately word for word. Output ONLY the raw transcript text with no extra comments or labels."
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    prompt
                ]
            )
            text = response.text.strip() if response.text else ""
            if text:
                logger.info("Successfully transcribed audio using Gemini Multimodal.")
                return text
        except Exception as e:
            logger.warning(f"Gemini Audio transcription failed: {e}")

    raise RuntimeError(
        "Audio transcription requires a valid AI API key (Groq, OpenAI, or Gemini). "
        "Please add a key in Settings or use browser Web Speech / text entry."
    )
