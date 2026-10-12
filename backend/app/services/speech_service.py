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
    elevenlabs_api_key: Optional[str] = None,
    language: Optional[str] = None
) -> str:
    """
    Transcribes audio file bytes into text using ElevenLabs Scribe, Google Gemini Multimodal Audio,
    Groq Whisper, or OpenAI Whisper.
    Supports audio formats: webm, wav, mp3, m4a, ogg, etc.
    """
    if not file_bytes or len(file_bytes) == 0:
        raise ValueError("Empty audio payload received.")

    mime_type = detect_audio_mime_type(filename, file_bytes)

    # Resolve keys with smart auto-detection
    raw_elevenlabs = (elevenlabs_api_key or settings.effective_elevenlabs_key or os.environ.get("ELEVEN_LAB_API_KEY", "") or os.environ.get("ELEVENLABS_API_KEY", "")).strip()
    raw_gemini = (gemini_api_key or settings.effective_gemini_key or os.environ.get("GEMINI_API_KEY", "")).strip()
    raw_openai = (openai_api_key or settings.effective_openai_key or os.environ.get("OPENAI_API_KEY", "")).strip()
    raw_groq = (groq_api_key or settings.effective_groq_key or settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY", "")).strip()

    # Smart key detection and cross-aliasing
    if raw_gemini.startswith("sk-") and not raw_openai:
        raw_openai = raw_gemini
        raw_gemini = ""
    elif raw_gemini.startswith("gsk_") and not raw_groq:
        raw_groq = raw_gemini
        raw_gemini = ""

    if raw_openai.startswith("AIzaSy") and not raw_gemini:
        raw_gemini = raw_openai
        raw_openai = ""
    elif raw_openai.startswith("gsk_") and not raw_groq:
        raw_groq = raw_openai
        raw_openai = ""

    provider_errors = []

    # 1. Try ElevenLabs Scribe Cloud STT if configured
    eleven_candidates = [k for k in [raw_elevenlabs, settings.effective_elevenlabs_key] if k and len(k) > 10]
    for el_key in eleven_candidates:
        if not el_key.startswith("sk_"):
            logger.warning(
                f"ElevenLabs key '{el_key[:8]}...' does not start with 'sk_'. Note: ElevenLabs requires the secret API key (starts with sk_), not the API Key ID."
            )
        try:
            # ponytail: direct httpx call to ElevenLabs Scribe STT without extra SDK bloat
            import httpx
            files = {"file": (filename or "audio.webm", file_bytes, mime_type)}
            data = {"model_id": "scribe_v1"}
            if language and language not in ("auto", "hinglish"):
                data["language_code"] = language.split("-")[0]

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.elevenlabs.io/v1/speech-to-text",
                    headers={"xi-api-key": el_key},
                    files=files,
                    data=data
                )
                if resp.status_code == 200:
                    res_data = resp.json()
                    text = (res_data.get("text") or "").strip()
                    if text:
                        logger.info("Successfully transcribed audio using ElevenLabs Scribe STT.")
                        return text
                else:
                    err_msg = f"ElevenLabs HTTP {resp.status_code}: {resp.text}"
                    logger.warning(err_msg)
                    provider_errors.append(f"ElevenLabs: {resp.status_code}")
        except Exception as e:
            logger.warning(f"ElevenLabs STT error: {e}")
            provider_errors.append(f"ElevenLabs: {e}")

    # 2. Try Gemini Multimodal Cloud Audio (Fast and reliable multilingual transcription)
    gemini_candidates = [raw_gemini, settings.effective_gemini_key]
    for gem_key in gemini_candidates:
        if gem_key and len(gem_key) > 10 and not gem_key.startswith("AIzaSyDXYy"):
            try:
                from google import genai
                from google.genai import types
                client = genai.Client(api_key=gem_key)

                prompt = (
                    "You are an expert multilingual audio speech-to-text engine. "
                    "Accurately transcribe every word spoken in this audio recording into text in its original spoken language "
                    "(English, Hindi, Punjabi, Hinglish, Spanish, etc.). "
                    "Preserve spoken dates, times, task names, numbers, and proper nouns. "
                    "Output ONLY the verbatim transcript text with no markdown formatting, explanations, or quotes."
                )

                # Prioritize active, operational Gemini models
                for g_model in ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.5-transcribe"]:
                    try:
                        response = client.models.generate_content(
                            model=g_model,
                            contents=[
                                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                                prompt
                            ]
                        )
                        if response and response.text:
                            text = response.text.strip()
                            # Filter empty audio responses like timecode 00:00
                            if text and text != "00:00":
                                logger.info(f"Successfully transcribed audio using Google Gemini ({g_model}).")
                                return text
                    except Exception as e_m:
                        logger.info(f"Gemini {g_model} audio transcribe attempt: {e_m}")
                        continue
            except Exception as e:
                logger.warning(f"Google Gemini audio transcription failed: {e}")
                provider_errors.append(f"Gemini: {e}")

    # 3. Try Groq Whisper Cloud STT
    groq_candidates = [raw_groq, settings.effective_groq_key]
    for g_key in groq_candidates:
        if g_key and len(g_key) > 10:
            try:
                from groq import Groq
                client = Groq(api_key=g_key, max_retries=1, timeout=8.0)
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
                provider_errors.append(f"Groq: {e}")

    # 4. Try OpenAI Whisper Cloud STT
    openai_candidates = [raw_openai, settings.effective_openai_key]
    for o_key in openai_candidates:
        if o_key and len(o_key) > 10:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=o_key, max_retries=0, timeout=6.0)
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
                logger.warning(f"OpenAI Whisper transcription failed: {e}")
                provider_errors.append(f"OpenAI: {e}")

    if not any((raw_elevenlabs, raw_gemini, raw_openai, raw_groq)):
        raise RuntimeError(
            "Cloud speech transcription is not configured. Add a valid ElevenLabs, Gemini, OpenAI, or Groq key to backend/.env."
        )

    err_summary = "; ".join(provider_errors) if provider_errors else "no speech detected or quota exhausted"
    raise RuntimeError(
        f"Speech transcription could not transcribe this recording ({err_summary}). Please retry or type your task below."
    )
