import io
import os
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("speech_service")

def detect_audio_mime_type(filename: str, file_bytes: bytes) -> str:
    """Detects clean audio MIME type without parameters."""
    fn = (filename or "").lower()
    if fn.endswith(".wav"): return "audio/wav"
    if fn.endswith(".mp3"): return "audio/mp3"
    if fn.endswith(".m4a") or fn.endswith(".mp4"): return "audio/mp4"
    if fn.endswith(".ogg") or fn.endswith(".opus"): return "audio/ogg"
    if fn.endswith(".webm"): return "audio/webm"

    # Header-based detection fallback
    if file_bytes.startswith(b"RIFF") and b"WAVE" in file_bytes[:16]:
        return "audio/wav"
    if file_bytes.startswith(b"\x1a\x45\xdf\xa3"):
        return "audio/webm"
    if file_bytes.startswith(b"OggS"):
        return "audio/ogg"
    if file_bytes.startswith(b"ID3") or file_bytes[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "audio/mp3"

    return "audio/webm"

async def transcribe_audio_file(
    file_bytes: bytes,
    filename: str,
    groq_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
    gemini_api_key: Optional[str] = None,
    language: Optional[str] = None
) -> str:
    """
    Transcribes audio file bytes into text using Google Gemini Multimodal Audio,
    OpenAI Whisper, or Groq Whisper.
    Supports audio formats: webm, wav, mp3, m4a, ogg, etc.
    """
    if not file_bytes or len(file_bytes) == 0:
        raise ValueError("Empty audio payload received.")

    mime_type = detect_audio_mime_type(filename, file_bytes)

    # Resolve keys with smart auto-detection
    raw_gemini = (gemini_api_key or settings.effective_gemini_key or os.environ.get("GEMINI_API_KEY", "")).strip()
    raw_openai = (openai_api_key or settings.effective_openai_key or os.environ.get("OPENAI_API_KEY", "")).strip()
    raw_groq = (groq_api_key or settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY", "")).strip()

    # If an OpenAI key was provided in the Gemini field, alias it
    if raw_gemini.startswith("sk-") and not raw_openai:
        raw_openai = raw_gemini
        raw_gemini = ""

    # 1. Try Gemini Multimodal Cloud Audio (Primary Cloud STT when Gemini key is configured)
    if raw_gemini and len(raw_gemini) > 10 and not raw_gemini.startswith("AIzaSyDXYy"):
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=raw_gemini)

            prompt = (
                "You are an expert multilingual audio speech-to-text engine. "
                "Accurately transcribe every word spoken in this audio recording into text in its original spoken language "
                "(English, Hindi, Punjabi, Hinglish, Spanish, etc.). "
                "Preserve spoken dates, times, task names, numbers, and proper nouns. "
                "Output ONLY the verbatim transcript text with no markdown formatting, explanations, or quotes."
            )

            # Try gemini-2.0-flash first, fallback to gemini-1.5-flash
            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[
                        types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                        prompt
                    ]
                )
            except Exception as e_20:
                logger.info(f"Gemini 2.0 Flash audio transcribe retry with 1.5-flash: {e_20}")
                response = client.models.generate_content(
                    model="gemini-1.5-flash",
                    contents=[
                        types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                        prompt
                    ]
                )

            text = response.text.strip() if response and response.text else ""
            if text:
                logger.info("Successfully transcribed audio using Google Gemini Multimodal Cloud STT.")
                return text
        except Exception as e:
            logger.warning(f"Google Gemini audio transcription failed, attempting fallback: {e}")

    # 2. Try OpenAI Whisper Cloud STT
    if raw_openai and len(raw_openai) > 10:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=raw_openai)
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
                logger.info("Successfully transcribed audio using OpenAI Whisper Cloud STT.")
                return text
        except Exception as e:
            logger.warning(f"OpenAI Whisper transcription failed, attempting fallback: {e}")

    # 3. Try Groq Whisper Cloud STT
    if raw_groq and len(raw_groq) > 10:
        try:
            from groq import Groq
            client = Groq(api_key=raw_groq)
            audio_file = (filename or "audio.webm", file_bytes)

            kwargs = {
                "file": audio_file,
                "model": "whisper-large-v3-turbo",
                "response_format": "json",
                "temperature": 0.0,
            }
            if language and language not in ("auto", "hinglish"):
                clean_lang = language.split("-")[0]
                kwargs["language"] = clean_lang

            transcription = client.audio.transcriptions.create(**kwargs)
            text = getattr(transcription, "text", str(transcription)).strip()
            if text:
                logger.info("Successfully transcribed audio using Groq Whisper Cloud STT.")
                return text
        except Exception as e:
            logger.warning(f"Groq Whisper transcription failed: {e}")

    raise RuntimeError(
        "Cloud Speech-to-Text requires a valid AI API key (Google Gemini, OpenAI, or Groq). "
        "Please provide a key in Settings or add GEMINI_API_KEY to backend/.env."
    )
