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

# Master system prompt with Few-Shot Demonstrations and Strict Output Formatting
SYSTEM_PROMPT = """You are an expert multilingual task extraction AI engine.
The user speaks in any language (English, Hindi, Punjabi, Hinglish, Spanish, French, etc.).
Your goal is to parse the voice transcript, extract the core actionable task, resolve relative dates/times against the user's current reference time, and return a clean structured JSON object.

### Reference Time
Reference timestamp and timezone will be provided in the user prompt.

### Output JSON Schema:
{
  "title": "<Concise, professional title of the task in clear English or standard script>",
  "description": "<Detailed context, notes, or original context>",
  "scheduled_date": "<YYYY-MM-DD or null>",
  "scheduled_time": "<HH:MM in 24-hour format or null>",
  "priority": "<'low' | 'medium' | 'high'>",
  "category": "<'work' | 'study' | 'personal' | 'health' | 'finance' | 'general'>",
  "reminder_required": true,
  "language": "<detected language, e.g. en, hi, pa, hinglish, es>"
}

### Date Resolution Rules:
- "today" / "aaj" / "ਅੱਜ" / "hoy" -> Reference date.
- "tomorrow" / "kal" / "ਕੱਲ੍ਹ" / "mañana" -> Reference date + 1 day.
- "day after tomorrow" / "parson" / "ਪਰਸੋਂ" / "pasado mañana" -> Reference date + 2 days.
- Named days (e.g., "this Friday", "next Monday") -> Next occurrence of that day.

### Time Resolution Rules (24-Hour Format):
- "subah" / "morning" / "ਸਵੇਰੇ" / "am" -> If hour given (e.g., 10), then "10:00". Default is "09:00".
- "dopahar" / "afternoon" / "ਦੁਪਹਿਰ" -> If hour given (e.g., 2), then "14:00". Default is "14:00".
- "shaam" / "evening" / "ਸ਼ਾਮ" / "pm" -> If hour given (e.g., 6 or 7), add 12 (6 PM -> "18:00", 7 PM -> "19:00"). Default is "18:00".
- "raat" / "night" / "ਰਾਤ" -> If hour given (e.g., 8 or 9), add 12 (8 PM -> "20:00", 9 PM -> "21:00"). Default is "21:00".
- "7 baje" with "shaam" -> "19:00", NOT "07:00".

### Category Mapping:
- study: assignments, exams, classes, homework, college, dbms, studying.
- work: meetings, projects, clients, presentations, office, emails.
- health: gym, workouts, walks, medicine, doctor, dentist, exercises.
- finance: bills, payments, recharge, bank, money, fees, salary, rent.
- personal: family, friends, mom, dad, parties, dinners, birthdays.
- general: other miscellaneous tasks.

### Few-Shot Demonstrations:

Input: "Kal shaam 6 baje DBMS project submit karna hai"
Output:
{
  "title": "Submit DBMS Project",
  "description": "DBMS project submission",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "18:00",
  "priority": "high",
  "category": "study",
  "reminder_required": true,
  "language": "hinglish"
}

Input: "ਕੱਲ੍ਹ ਸ਼ਾਮ 7 ਵਜੇ gym ਜਾਣਾ ਹੈ"
Output:
{
  "title": "Gym Workout",
  "description": "Evening gym session",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "19:00",
  "priority": "medium",
  "category": "health",
  "reminder_required": true,
  "language": "pa"
}

Input: "कल सुबह 10 बजे डॉक्टर के पास जाना है"
Output:
{
  "title": "Doctor Appointment",
  "description": "Visit doctor in the morning",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "10:00",
  "priority": "high",
  "category": "health",
  "reminder_required": true,
  "language": "hi"
}

Input: "Remind me to call Mom tomorrow at 8 PM"
Output:
{
  "title": "Call Mom",
  "description": "Catch up with mom",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "20:00",
  "priority": "medium",
  "category": "personal",
  "reminder_required": true,
  "language": "en"
}

Return ONLY valid JSON matching the schema. No markdown formatting or extra commentary.
"""

def heuristic_parse_task(transcript: str, ref_dt: datetime) -> Dict[str, Any]:
    """
    Intelligent heuristic fallback parser for Hindi, Hinglish, Punjabi, and English.
    Refined with comprehensive multi-script regex and relative time normalization.
    """
    text_lower = transcript.lower()
    
    # 1. Date resolution
    task_date: Optional[date] = None
    if any(k in text_lower for k in ["parson", "day after tomorrow", "day after", "ਪਰਸੋਂ", "परसों"]):
        task_date = (ref_dt + timedelta(days=2)).date()
    elif any(k in text_lower for k in ["kal", "tomorrow", "ਕੱਲ੍ਹ", "कल"]):
        task_date = (ref_dt + timedelta(days=1)).date()
    elif any(k in text_lower for k in ["aaj", "today", "ਅੱਜ", "आज"]):
        task_date = ref_dt.date()
    else:
        # Default to tomorrow if not specified
        task_date = (ref_dt + timedelta(days=1)).date()

    # 2. Time resolution (with Hindi & Punjabi scripts)
    task_time: Optional[str] = None
    
    # PM keywords (English, Hindi, Punjabi)
    pm_keywords = [
        "shaam", "sham", "raat", "evening", "night", "pm", "p.m.",
        "शाम", "रात",
        "ਸ਼ਾਮ", "ਰਾਤ"
    ]
    is_pm = any(k in text_lower for k in pm_keywords)

    # AM keywords (English, Hindi, Punjabi)
    am_keywords = [
        "subah", "subh", "morning", "am", "a.m.",
        "सुबह", "सवेरे",
        "ਸਵੇਰੇ", "ਸਵੇਰ"
    ]
    is_am = any(k in text_lower for k in am_keywords)

    # Convert native Hindi/Punjabi digits if present
    digit_map = {'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','੮':'8','९':'9',
                 '੦':'0','੧':'1','੨':'2','੩':'3','੪':'4','੫':'5','੬':'6','੭':'7','੮':'8','੯':'9'}
    normalized_text = text_lower
    for k, v in digit_map.items():
        normalized_text = normalized_text.replace(k, v)

    # Regex for hours with various separators and markers: "7 baje", "7 ਵਜੇ", "7 बजे", "7 PM", "7:00"
    time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(?:baje|बजे|ਵਜੇ|pm|am|o\'clock)?', normalized_text)
    
    if time_match:
        hour = int(time_match.group(1))
        minutes = int(time_match.group(2)) if time_match.group(2) else 0
        if 1 <= hour <= 12:
            if is_pm and hour < 12:
                hour += 12
            elif is_am and hour == 12:
                hour = 0
            task_time = f"{hour:02d}:{minutes:02d}"
        elif 0 <= hour <= 23:
            task_time = f"{hour:02d}:{minutes:02d}"
    
    if not task_time:
        if is_pm:
            task_time = "18:00"
        elif is_am:
            task_time = "09:00"
        elif any(k in text_lower for k in ["dopahar", "afternoon", "ਦੁਪਹਿਰ", "दोपहर"]):
            task_time = "14:00"
        else:
            task_time = "10:00"

    # 3. Category detection
    category = "general"
    health_keywords = [
        "gym", "workout", "exercise", "walk", "badminton", "cricket", "football", "tennis",
        "yoga", "swimming", "cycling", "run", "running", "jogging", "medicine", "doctor",
        "dentist", "health", "ਦਵਾਈ", "ਡਾਕਟਰ", "ਦੌੜ", "दवा", "डॉक्टर", "व्यायाम"
    ]
    personal_keywords = [
        "mom", "dad", "mother", "father", "friend", "rahul", "party", "dinner", "lunch",
        "birthday", "gift", "family", "relative", "sister", "brother", "ਮੰਮੀ", "ਡੈਡੀ", "ਦੋਸਤ", "मम्मी", "पापा", "दोस्त"
    ]
    if any(w in text_lower for w in personal_keywords):
        category = "personal"
    elif any(w in text_lower for w in health_keywords):
        category = "health"
    elif any(w in text_lower for w in ["dbms", "assignment", "study", "exam", "padhna", "homework", "class", "college", "test", "course", "ਪੜ੍ਹਨਾ", "ਪੜ੍ਹਾਈ", "पढ़ना", "परीक्षा"]):
        category = "study"
    elif any(w in text_lower for w in ["meeting", "project", "office", "client", "boss", "work", "presentation", "interview", "client call", "email", "report", "standup", "sync", "ਮੀਟਿੰਗ", "ਕੰਮ", "मीटिंग"]):
        category = "work"
    elif any(w in text_lower for w in ["bill", "recharge", "fee", "pay", "bank", "money", "rent", "salary", "loan", "tax", "ਪੈਸੇ", "ਬਿੱਲ", "पैसे", "बिल"]):
        category = "finance"

    # 4. Priority detection
    priority = "medium"
    if any(w in text_lower for w in ["urgent", "zaroori", "jaruri", "important", "asap", "emergency", "crucial", "ਜ਼ਰੂਰੀ", "जरूरी"]):
        priority = "high"
    elif any(w in text_lower for w in ["kabhi bhi", "casual", "whenever", "low priority", "ਹੌਲੀ", "फुर्सत"]):
        priority = "low"

    # 5. Clean Title Extraction
    clean_title = transcript
    latin_phrases = [
        "remind me to", "remind me", "tomorrow at", "tomorrow", "today at", "today",
        "yesterday", "day after tomorrow", "i need to", "i have to", "have to", "need to",
        "urgent", "important", "asap", "at", "o'clock", "before",
        "kal shaam", "kal subah", "kal raat", "kal dopahar", "kal",
        "aaj shaam", "aaj subah", "aaj raat", "aaj", "parson",
        "mujhe", "karna hai", "karni hai", "jana hai", "jani hai", "dena hai", "deni hai",
        "karna", "jana", "hai", "ko", "me", "mein", "baje"
    ]
    indic_phrases = [
        # Hindi Devanagari
        "कल सुबह", "कल शाम", "कल रात", "कल दोपहर", "कल", "आज सुबह", "आज शाम", "आज रात", "आज", "परसों",
        "मुझे", "करना है", "जाना है", "देना है", "है", "को", "में", "बजे", "सुबह", "शाम", "दोपहर", "रात", "जरूरी",
        # Punjabi Gurmukhi
        "ਕੱਲ੍ਹ ਸ਼ਾਮ", "ਕੱਲ੍ਹ ਸਵੇਰੇ", "ਕੱਲ੍ਹ ਰਾਤ", "ਕੱਲ੍ਹ ਦੁਪਹਿਰ", "ਕੱਲ੍ਹ", "ਅੱਜ ਸ਼ਾਮ", "ਅੱਜ ਸਵੇਰੇ", "ਅੱਜ ਰਾਤ", "ਅੱਜ",
        "ਪਰਸੋਂ", "ਮੈਨੂੰ", "ਕਰਨਾ ਹੈ", "ਜਾਣਾ ਹੈ", "ਦੇਣਾ ਹੈ", "ਹੈ", "ਨੂੰ", "ਵਿੱਚ", "ਵਜੇ", "ਸਵੇਰੇ", "ਸ਼ਾਮ", "ਰਾਤ", "ਜ਼ਰੂਰੀ"
    ]

    # Clean Latin phrases with strict word boundary
    for phrase in sorted(latin_phrases, key=len, reverse=True):
        clean_title = re.sub(rf'(?i)\b{re.escape(phrase)}\b', '', clean_title)

    # Clean Indic non-ASCII phrases
    for phrase in sorted(indic_phrases, key=len, reverse=True):
        clean_title = clean_title.replace(phrase, '')
        
    # Remove digits and time fragments (e.g. "6 baje", "10 am", "7", "10:00")
    clean_title = re.sub(r'\b\d{1,2}(?::\d{2})?\s*(?:baje|बजे|ਵਜੇ|pm|am|o\'clock)?\b', '', clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r'[\d०-९੦-੯]+', '', clean_title)
    
    # Strip residual punctuation and whitespace
    clean_title = re.sub(r'[,\.\-–—:!?]+', ' ', clean_title)
    clean_title = re.sub(r'\s+', ' ', clean_title).strip()
    
    if not clean_title or len(clean_title) < 2:
        clean_title = transcript.strip()
    else:
        clean_title = clean_title[0].upper() + clean_title[1:]

    # Language guess
    detected_lang = "en"
    if any(ord(c) >= 0x0A00 and ord(c) <= 0x0A7F for c in transcript):
        detected_lang = "pa"
    elif any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in transcript):
        detected_lang = "hi"
    elif any(w in text_lower for w in ["karna", "hai", "subah", "shaam", "baje", "mera", "kal"]):
        detected_lang = "hinglish"

    return {
        "title": clean_title,
        "description": f"Voice input ({detected_lang.upper()}): '{transcript}'",
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
    1. Groq LLM (llama-3.3-70b-versatile) with system demonstrations
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
                temperature=0.0
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
                temperature=0.0
            )
            raw_json = completion.choices[0].message.content
            parsed = json.loads(raw_json)
            parsed["original_transcript"] = transcript
            return ExtractedTask(**parsed)
        except Exception as e:
            logger.error(f"OpenAI task parsing error: {e}")

    # 3. Fallback to refined intelligent multilingual heuristic
    logger.info("Using refined intelligent heuristic multilingual parser.")
    parsed = heuristic_parse_task(transcript, now_user)
    parsed["original_transcript"] = transcript
    return ExtractedTask(**parsed)
