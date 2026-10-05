import os
import re
import json
import logging
from datetime import datetime, timedelta, date, time
from typing import Dict, Any, Optional
import zoneinfo
from app.core.config import settings
from app.schemas.task import ExtractedTask, PriorityType, CategoryType

logger = logging.getLogger("ai_parser")

SYSTEM_PROMPT = """You are an expert multilingual task extraction AI.
The user speaks in any language (English, Hindi, Punjabi, Hinglish, Spanish, French, etc.).
Your job is to extract a structured task actionable JSON object from the speech.

You are given:
- The transcribed speech text.
- The reference date & time and user's timezone.

Strictly return a JSON object with these keys:
{
  "title": "<clean, concise title of the task>",
  "description": "<detailed context or null>",
  "scheduled_date": "<YYYY-MM-DD or null>",
  "scheduled_time": "<HH:MM in 24-hour format or null>",
  "priority": "<'low' | 'medium' | 'high'>",
  "category": "<'work' | 'study' | 'personal' | 'health' | 'finance' | 'general'>",
  "reminder_required": true,
  "language": "<detected language, e.g. hi, en, pa, hinglish>"
}

Rules for time resolution:
- 'aaj' / 'today' -> today's date.
- 'kal' / 'tomorrow' -> reference date + 1 day.
- 'parson' / 'day after tomorrow' -> reference date + 2 days.
- 'subah' / 'morning' -> default 09:00 if no specific hour mentioned.
- 'dopahar' / 'afternoon' -> default 13:00 if no specific hour mentioned.
- 'shaam' / 'evening' -> default 18:00 if no specific hour mentioned.
- 'raat' / 'night' -> default 21:00 if no specific hour mentioned.
- '6 baje shaam' / '6 PM' -> 18:00.
- Translate title to clear concise phrasing (English or standardized language).
- Return ONLY valid JSON, no surrounding markdown.
"""

def heuristic_parse_task(transcript: str, ref_dt: datetime) -> Dict[str, Any]:
    """
    Intelligent heuristic fallback parser for Hindi, Hinglish, Punjabi, and English
    when no LLM API key is provided.
    """
    text_lower = transcript.lower()
    
    # 1. Date resolution
    task_date: Optional[date] = None
    if any(k in text_lower for k in ["parson", "day after tomorrow", "day after"]):
        task_date = (ref_dt + timedelta(days=2)).date()
    elif any(k in text_lower for k in ["kal", "tomorrow", "ਕੱਲ੍ਹ", "कल"]):
        task_date = (ref_dt + timedelta(days=1)).date()
    elif any(k in text_lower for k in ["aaj", "today", "ਅੱਜ", "आज"]):
        task_date = ref_dt.date()
    else:
        # Default to tomorrow if not specified
        task_date = (ref_dt + timedelta(days=1)).date()

    # 2. Time resolution
    task_time: Optional[str] = None
    # Check for "X baje" or "X pm/am"
    time_match = re.search(r'(\d{1,2})\s*(?:baje|बजे|pm|am|:00)?', text_lower)
    is_pm = any(k in text_lower for k in ["shaam", "sham", "raat", "evening", "night", "pm", "शाम", "रात"])
    is_am = any(k in text_lower for k in ["subah", "morning", "am", "सुबह", "ਸਵੇਰੇ"])

    if time_match:
        hour = int(time_match.group(1))
        if 1 <= hour <= 12:
            if is_pm and hour < 12:
                hour += 12
            elif is_am and hour == 12:
                hour = 0
            task_time = f"{hour:02d}:00"
    
    if not task_time:
        if is_pm:
            task_time = "18:00"
        elif is_am:
            task_time = "09:00"
        elif "dopahar" in text_lower or "afternoon" in text_lower:
            task_time = "14:00"
        else:
            task_time = "10:00"

    # 3. Category detection
    category = "general"
    if any(w in text_lower for w in ["gym", "workout", "exercise", "walk", "medicine", "doctor", "health"]):
        category = "health"
    elif any(w in text_lower for w in ["dbms", "assignment", "study", "exam", "padhna", "homework", "class", "college", "test"]):
        category = "study"
    elif any(w in text_lower for w in ["meeting", "project", "office", "client", "boss", "work", "presentation"]):
        category = "work"
    elif any(w in text_lower for w in ["bill", "recharge", "fee", "pay", "bank", "money", "rent"]):
        category = "finance"
    elif any(w in text_lower for w in ["mom", "dad", "friend", "rahul", "party", "dinner", "call"]):
        category = "personal"

    # 4. Priority detection
    priority = "medium"
    if any(w in text_lower for w in ["urgent", "zaroori", "jaruri", "important", "asap", "emergency"]):
        priority = "high"
    elif any(w in text_lower for w in ["kabhi bhi", "casual", "whenever"]):
        priority = "low"

    # 5. Title cleanup
    clean_title = transcript
    for phrase in ["kal shaam", "kal subah", "kal", "aaj", "parson", "tomorrow at", "tomorrow", "today", "remind me to", "remind me", "mujhe", "karna hai", "karna", "hai", "ko", "at"]:
        clean_title = re.sub(rf'\b{phrase}\b', '', clean_title, flags=re.IGNORECASE)
    # Remove time mentions like '6 baje', '10 am', '6:00', '7 pm'
    clean_title = re.sub(r'\b\d{1,2}(?::\d{2})?\s*(?:baje|am|pm|o\'clock)?\b', '', clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r'\s+', ' ', clean_title).strip()
    if not clean_title or len(clean_title) < 3:
        clean_title = transcript.strip()
    clean_title = clean_title[0].upper() + clean_title[1:] if clean_title else "New Task"

    # Language guess
    detected_lang = "en"
    if any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in transcript):
        detected_lang = "hi"
    elif any(ord(c) >= 0x0A00 and ord(c) <= 0x0A7F for c in transcript):
        detected_lang = "pa"
    elif any(w in text_lower for w in ["karna", "hai", "subah", "shaam", "baje", "mera"]):
        detected_lang = "hinglish"

    return {
        "title": clean_title,
        "description": f"Created via voice input: '{transcript}'",
        "scheduled_date": str(task_date),
        "scheduled_time": task_time,
        "priority": priority,
        "category": category,
        "reminder_required": True,
        "language": detected_lang
    }

async def parse_voice_to_task(transcript: str, timezone_name: str = "Asia/Kolkata") -> ExtractedTask:
    """
    Takes raw multilingual transcript and extracts structured task metadata.
    Attempts:
    1. Groq LLM (llama-3.3-70b-versatile)
    2. OpenAI LLM (gpt-4o-mini)
    3. Intelligent Rule-Based Multilingual Fallback
    """
    try:
        tz = zoneinfo.ZoneInfo(timezone_name)
    except Exception:
        try:
            tz = zoneinfo.ZoneInfo("Asia/Kolkata")
        except Exception:
            tz = datetime.now().astimezone().tzinfo
    
    now_user = datetime.now(tz)
    ref_info = f"Current timestamp: {now_user.strftime('%Y-%m-%d %H:%M:%S')}, Day: {now_user.strftime('%A')}, Timezone: {timezone_name}"

    groq_key = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
    openai_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")

    # 1. Try Groq LLM
    if groq_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_key)
            prompt = f"{ref_info}\nUser Voice Transcript: \"{transcript}\""
            
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            raw_json = completion.choices[0].message.content
            parsed = json.loads(raw_json)
            parsed["original_transcript"] = transcript
            return ExtractedTask(**parsed)
        except Exception as e:
            logger.error(f"Groq task parsing error: {e}")

    # 2. Try OpenAI LLM
    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            prompt = f"{ref_info}\nUser Voice Transcript: \"{transcript}\""
            
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            raw_json = completion.choices[0].message.content
            parsed = json.loads(raw_json)
            parsed["original_transcript"] = transcript
            return ExtractedTask(**parsed)
        except Exception as e:
            logger.error(f"OpenAI task parsing error: {e}")

    # 3. Fallback to intelligent multilingual heuristic
    logger.info("Using intelligent heuristic multilingual parser.")
    parsed = heuristic_parse_task(transcript, now_user)
    parsed["original_transcript"] = transcript
    return ExtractedTask(**parsed)
