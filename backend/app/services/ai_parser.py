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
SYSTEM_PROMPT = """You are an expert multilingual task extraction AI engine (Siri/ChatGPT quality).
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
- study: assignments, exams, classes, homework, college, dbms, database, studying.
- work: meetings, projects, clients, presentations, office, emails.
- health: gym, workouts, walks, badminton, medicine, doctor, dentist, exercises.
- finance: bills, payments, recharge, bank, money, fees, salary, rent.
- personal: family, friends, mom, dad, parties, dinners, birthdays.
- general: other miscellaneous tasks.

### Few-Shot Demonstrations:

Input: "Kal subah 10 baje database ka assignment submit karna hai"
Output:
{
  "title": "Submit database assignment",
  "description": "Database assignment submission",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "10:00",
  "priority": "medium",
  "category": "study",
  "reminder_required": true,
  "language": "hinglish"
}

Input: "ਕੱਲ੍ਹ ਸ਼ਾਮ 7 ਵਜੇ gym ਜਾਣਾ ਹੈ"
Output:
{
  "title": "Gym",
  "description": "Evening gym session",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "19:00",
  "priority": "medium",
  "category": "health",
  "reminder_required": true,
  "language": "pa"
}

Input: "Remind me to call mom tomorrow evening"
Output:
{
  "title": "Call Mom",
  "description": "Call mom in the evening",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "18:00",
  "priority": "medium",
  "category": "personal",
  "reminder_required": true,
  "language": "en"
}

Input: "कल शाम 6 बजे gym जाना है"
Output:
{
  "title": "Gym Workout",
  "description": "Evening gym workout",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "18:00",
  "priority": "medium",
  "category": "health",
  "reminder_required": true,
  "language": "hi"
}

Input: "Tomorrow at 6 PM I need to call Rahul about the project"
Output:
{
  "title": "Call Rahul about the project",
  "description": "Project discussion with Rahul",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "18:00",
  "priority": "medium",
  "category": "work",
  "reminder_required": true,
  "language": "en"
}

Input: "Mujhe Kal subah paanch baje uthana hai college ke liye"
Output:
{
  "title": "Wake up for college",
  "description": "Wake up early for college",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "05:00",
  "priority": "medium",
  "category": "study",
  "reminder_required": true,
  "language": "hinglish"
}

Input: "Kal subah paanch baje uthna hai"
Output:
{
  "title": "Wake up",
  "description": "Wake up at 5:00 AM",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "05:00",
  "priority": "medium",
  "category": "personal",
  "reminder_required": true,
  "language": "hinglish"
}

Input: "Kal shaam 8 baje DBMS padhna hai"
Output:
{
  "title": "Study DBMS",
  "description": "Study DBMS",
  "scheduled_date": "2026-10-06",
  "scheduled_time": "20:00",
  "priority": "medium",
  "category": "study",
  "reminder_required": true,
  "language": "hinglish"
}

Return ONLY valid JSON matching the schema. No markdown formatting or extra commentary.
"""

WORD_TO_NUMBER = {
    'ek': 1, 'ik': 1, 'one': 1, 'एक': 1, 'ਇੱਕ': 1, 'ਇਕ': 1,
    'do': 2, 'two': 2, 'दो': 2, 'ਦੋ': 2,
    'teen': 3, 'tin': 3, 'three': 3, 'तीन': 3, 'ਤਿੰਨ': 3,
    'chaar': 4, 'char': 4, 'four': 4, 'चार': 4, 'ਚਾਰ': 4,
    'paanch': 5, 'panch': 5, 'panj': 5, 'five': 5, 'पाँच': 5, 'पांच': 5, 'ਪੰਜ': 5,
    'chhe': 6, 'che': 6, 'chey': 6, 'six': 6, 'छह': 6, 'छः': 6, 'ਛੇ': 6,
    'saat': 7, 'sat': 7, 'seven': 7, 'सात': 7, 'ਸੱਤ': 7,
    'aath': 8, 'ath': 8, 'aat': 8, 'eight': 8, 'आठ': 8, 'ਅੱਠ': 8,
    'nau': 9, 'no': 9, 'naun': 9, 'nine': 9, 'नौ': 9, 'ਨੌਂ': 9,
    'das': 10, 'duss': 10, 'ten': 10, 'दस': 10, 'ਦਸ': 10,
    'gyarah': 11, 'gyara': 11, 'giarah': 11, 'eleven': 11, 'ग्यारह': 11, 'ਗਿਆਰਾਂ': 11,
    'barah': 12, 'bara': 12, 'baarah': 12, 'twelve': 12, 'बारह': 12, 'ਬਾਰਾਂ': 12,
}

TIME_MODIFIERS = [
    'sadhe', 'saadhe', 'sava', 'sawwa', 'paune', 'pauna', 'dedh', 'dhaai', 'dhayi',
    'साढ़े', 'ਸਾਢੇ', 'सवा', 'ਸਵਾ', 'पौने', 'ਪੌਣੇ', 'डेढ़', 'ਡੇਢ', 'ढाई', 'ਢਾਈ'
]

def polish_task_title(title: str) -> str:
    """
    Transforms colloquial phrases into professional task titles:
    - 'DBMS padhna' -> 'Study DBMS'
    - 'uthana college ke liye' -> 'Wake up for College'
    - 'database ka assignment submit' -> 'Submit database assignment'
    - 'rahul ko call' -> 'Call Rahul'
    - 'call mom' -> 'Call Mom'
    - 'gym jana' -> 'Gym'
    """
    cleaned = title.strip()
    
    # 1. Study patterns:
    # Pattern: [subject] padhna / padhni / padhai / padh / study / read
    m_study1 = re.match(r'^(.*?)\s+(?:padhna|padhni|padhai|padh|study|read|learn|ਪੜ੍ਹਨਾ|ਪੜ੍ਹਾਈ|पढ़ना|पढना)(?:\s+hai)?$', cleaned, re.IGNORECASE)
    if m_study1:
        subj = m_study1.group(1).strip()
        subj_str = subj.upper() if len(subj) <= 4 else subj.capitalize()
        return f"Study {subj_str}"
        
    m_study2 = re.match(r'^(?:padhna|padhni|padhai|padh|study|read|learn|ਪੜ੍ਹਨਾ|ਪੜ੍ਹਾਈ|पढ़ना|पढना)\s+(.*?)(?:\s+hai)?$', cleaned, re.IGNORECASE)
    if m_study2:
        subj = m_study2.group(1).strip()
        subj_str = subj.upper() if len(subj) <= 4 else subj.capitalize()
        return f"Study {subj_str}"

    # 2. Wake up patterns:
    m_wake1 = re.match(r'^(?:uthana|uthna|jagna|utho|wake\s*up|get\s*up|ਉੱਠਣਾ|ਉਠਣਾ|उठना|जागना)\s+(?:hai\s+)?(.+?)\s+(?:ke\s+liye|lai|waste|nu|ko)$', cleaned, re.IGNORECASE)
    if m_wake1:
        target = m_wake1.group(1).strip()
        return f"Wake up for {target.capitalize()}"

    m_wake2 = re.match(r'^(.+?)\s+(?:ke\s+liye|lai|waste)\s+(?:uthana|uthna|jagna|utho|wake\s*up|get\s*up|ਉੱਠਣਾ|ਉਠਣਾ|उठना|जागना)(?:\s+hai)?$', cleaned, re.IGNORECASE)
    if m_wake2:
        target = m_wake2.group(1).strip()
        return f"Wake up for {target.capitalize()}"

    if re.match(r'^(?:uthana|uthna|jagna|utho|wake\s*up|get\s*up|ਉੱਠਣਾ|ਉਠਣਾ|उठना|जागना)(?:\s+hai)?$', cleaned, re.IGNORECASE):
        return "Wake up"

    # 3. Call patterns:
    m_call1 = re.match(r'^(.*?)\s+(?:ko|nu)\s+(?:call|phone|milna)(?:\s+karna)?$', cleaned, re.IGNORECASE)
    if m_call1:
        person = m_call1.group(1).strip()
        return f"Call {person.title()}"

    m_call2 = re.match(r'^(?:call|phone)\s+(?:to\s+)?(.*?)(?:\s+ko|\s+nu)?$', cleaned, re.IGNORECASE)
    if m_call2:
        person = m_call2.group(1).strip()
        return f"Call {person.title()}"

    m_call3 = re.match(r'^(.*?)\s+(?:call|phone)$', cleaned, re.IGNORECASE)
    if m_call3:
        person = m_call3.group(1).strip()
        return f"Call {person.title()}"

    # 4. Pattern: [object] ka/ki/ke [task] submit/complete/finish/dena
    m = re.match(r'^(.*?)\s+(?:ka|ki|ke|da|di|de)\s+(.*?)\s+(submit|complete|finish|karna|check|review|dena)$', cleaned, re.IGNORECASE)
    if m:
        obj, noun, verb = m.groups()
        verb_map = {'submit': 'Submit', 'complete': 'Complete', 'finish': 'Finish', 'karna': 'Do', 'check': 'Check', 'review': 'Review', 'dena': 'Submit'}
        v = verb_map.get(verb.lower(), verb.capitalize())
        return f"{v} {obj} {noun}".strip()
    
    # 5. Pattern: [object] submit/complete/finish/review/pay/bharna
    m_action = re.match(r'^(.*?)\s+(submit|complete|finish|check|review|pay|bharna)$', cleaned, re.IGNORECASE)
    if m_action:
        obj, verb = m_action.groups()
        verb_map = {'submit': 'Submit', 'complete': 'Complete', 'finish': 'Finish', 'check': 'Check', 'review': 'Review', 'pay': 'Pay', 'bharna': 'Pay'}
        v = verb_map.get(verb.lower(), verb.capitalize())
        return f"{v} {obj}".strip()

    # 6. Pattern: gym jana / walk / workout
    m3 = re.match(r'^(gym|walk|workout)\s+(?:jana|jani|jaana|जाना|ਜਾਣਾ)$', cleaned, re.IGNORECASE)
    if m3:
        return m3.group(1).capitalize()

    # 7. Pattern: pay [bill]
    m_pay = re.match(r'^(?:pay|bharna)\s+(.*?)$', cleaned, re.IGNORECASE)
    if m_pay:
        bill = m_pay.group(1).strip()
        return f"Pay {bill.title()}"

    return cleaned

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

    is_afternoon = any(k in text_lower for k in ["dopahar", "afternoon", "ਦੁਪਹਿਰ", "दोपहर"])

    # Convert native Hindi/Punjabi digits if present
    digit_map = {'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','੮':'8','९':'9',
                 '੦':'0','੧':'1','੨':'2','੩':'3','੪':'4','੫':'5','੬':'6','੭':'7','੮':'8','੯':'9'}
    normalized_text = text_lower
    for k, v in digit_map.items():
        normalized_text = normalized_text.replace(k, v)

    # Replace word numbers with digits before time markers or time of day
    for word, num in WORD_TO_NUMBER.items():
        normalized_text = re.sub(rf'(?i)\b{re.escape(word)}\s*(baje|बजे|ਵਜੇ|am|pm|o\'clock)', f'{num} \\1', normalized_text)
        normalized_text = re.sub(rf'(?i)(subah|subh|shaam|sham|raat|morning|evening|night|सवेरे|सुबह|शाम|रात|ਸਵੇਰੇ|ਸ਼ਾਮ|ਰਾਤ)\s+{re.escape(word)}\b', f'\\1 {num}', normalized_text)

    parsed_hour: Optional[int] = None
    parsed_minutes: int = 0

    # Check dedh (1:30) and dhaai (2:30)
    if re.search(r'\b(dedh|ਡੇਢ|डेढ़)\s*(?:baje|बजे|ਵਜੇ)?\b', normalized_text):
        parsed_hour = 1
        parsed_minutes = 30
    elif re.search(r'\b(dhaai|dhayi|ਢਾਈ|ढाई)\s*(?:baje|बजे|ਵਜੇ)?\b', normalized_text):
        parsed_hour = 2
        parsed_minutes = 30
    else:
        # Check saadhe / sava / paune
        m_half = re.search(r'\b(?:sadhe|saadhe|ਸਾਢੇ|साढ़े)\s+(\d{1,2})', normalized_text)
        m_sava = re.search(r'\b(?:sava|sawwa|ਸਵਾ|सवा)\s+(\d{1,2})', normalized_text)
        m_paune = re.search(r'\b(?:paune|pauna|ਪੌਣੇ|पौने)\s+(\d{1,2})', normalized_text)
        
        if m_half:
            parsed_hour = int(m_half.group(1))
            parsed_minutes = 30
        elif m_sava:
            parsed_hour = int(m_sava.group(1))
            parsed_minutes = 15
        elif m_paune:
            h = int(m_paune.group(1))
            parsed_hour = (h - 1) if h > 1 else 12
            parsed_minutes = 45
        else:
            time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(?:baje|बजे|ਵਜੇ|pm|am|o\'clock)?', normalized_text)
            if time_match:
                parsed_hour = int(time_match.group(1))
                parsed_minutes = int(time_match.group(2)) if time_match.group(2) else 0

    if parsed_hour is not None:
        hour = parsed_hour
        minutes = parsed_minutes
        if 1 <= hour <= 12:
            if is_pm and hour < 12:
                hour += 12
            elif is_afternoon and 1 <= hour <= 6:
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
        elif is_afternoon:
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
    wake_keywords = [
        "uthna", "uthana", "jagna", "wake up", "get up", "ਉੱਠਣਾ", "ਉਠਣਾ", "उठना", "जागना"
    ]
    if any(w in text_lower for w in ["dbms", "database", "assignment", "study", "exam", "padhna", "homework", "class", "college", "school", "test", "course", "ਪੜ੍ਹਨਾ", "ਪੜ੍ਹਾਈ", "पढ़ना", "परीक्षा"]):
        category = "study"
    elif any(w in text_lower for w in personal_keywords):
        category = "personal"
    elif any(w in text_lower for w in health_keywords):
        category = "health"
    elif any(w in text_lower for w in ["meeting", "project", "office", "client", "boss", "work", "presentation", "interview", "client call", "email", "report", "standup", "sync", "ਮੀਟਿੰਗ", "ਕੰਮ", "मीटिंग"]):
        category = "work"
    elif any(w in text_lower for w in ["bill", "recharge", "fee", "pay", "bank", "money", "rent", "salary", "loan", "tax", "ਪੈਸੇ", "ਬਿੱਲ", "पैसे", "बिल"]):
        category = "finance"
    elif any(w in text_lower for w in wake_keywords):
        category = "personal"

    # 4. Priority detection
    priority = "medium"
    if any(w in text_lower for w in ["urgent", "zaroori", "jaruri", "important", "asap", "emergency", "crucial", "ਜ਼ਰੂਰੀ", "जरूरी"]):
        priority = "high"
    elif any(w in text_lower for w in ["kabhi bhi", "casual", "whenever", "low priority", "ਹੌਲੀ", "फुर्सत"]):
        priority = "low"

    # 5. Clean Title Extraction
    clean_title = transcript
    latin_phrases = [
        "remind me to", "remind me", "tomorrow at", "tomorrow evening", "tomorrow morning",
        "tomorrow afternoon", "tomorrow night", "tomorrow", "today at", "today evening",
        "today morning", "today afternoon", "today night", "today", "yesterday",
        "day after tomorrow", "i need to", "i have to", "have to", "need to",
        "urgent", "important", "asap", "at", "o'clock", "before",
        "evening", "morning", "afternoon", "night",
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

    # Remove time modifiers (sadhe, sava, paune, etc.)
    for mod in TIME_MODIFIERS:
        clean_title = re.sub(rf'(?i)\b{re.escape(mod)}\b', '', clean_title)

    # Remove number words associated with time markers or time of day
    for word in sorted(WORD_TO_NUMBER.keys(), key=len, reverse=True):
        clean_title = re.sub(rf'(?i)\b{re.escape(word)}\s*(?:baje|बजे|ਵਜੇ|am|pm|o\'clock)\b', '', clean_title)
        clean_title = re.sub(rf'(?i)\b(?:subah|subh|shaam|sham|raat|morning|evening|night|सवेरे|सुबह|शाम|रात|ਸਵੇਰੇ|ਸ਼ਾਮ|ਰਾਤ)\s+{re.escape(word)}\b', '', clean_title)

    # Strip standalone number word if it matched the parsed hour
    for word, num in WORD_TO_NUMBER.items():
        if parsed_hour is not None and num == parsed_hour:
            clean_title = re.sub(rf'(?i)\b{re.escape(word)}\b', '', clean_title)

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
    
    # Apply natural action rephrasing
    clean_title = polish_task_title(clean_title)

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

async def parse_voice_to_task(
    transcript: str,
    timezone_name: str = "Asia/Kolkata",
    groq_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
    gemini_api_key: Optional[str] = None
) -> ExtractedTask:
    """
    Takes raw multilingual transcript and extracts structured task metadata.
    Attempts:
    1. Google Gemini (gemini-2.5-flash / gemini-1.5-flash) with structured JSON
    2. Groq LLM (llama-3.3-70b-versatile) with system demonstrations
    3. OpenAI LLM (gpt-4o-mini)
    4. Refined Heuristic Multilingual Parser with Natural Title Polishing
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

    # 1. Try Gemini if key is provided and valid
    gemini_key = gemini_api_key or settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if gemini_key and len(gemini_key) > 10:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=gemini_key)
            prompt = f"{ref_info}\nUser Voice Transcript: \"{transcript}\""
            
            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=f"{SYSTEM_PROMPT}\n\n{prompt}",
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0
                    )
                )
            except Exception:
                response = client.models.generate_content(
                    model="gemini-1.5-flash",
                    contents=f"{SYSTEM_PROMPT}\n\n{prompt}",
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0
                    )
                )
            if response.text:
                parsed = json.loads(response.text)
                parsed["original_transcript"] = transcript
                logger.info(f"Gemini parsed task successfully: {parsed.get('title')}")
                return ExtractedTask(**parsed)
        except Exception as e:
            logger.warning(f"Gemini task parsing fallback: {e}")

    # 2. Try Groq LLM (Llama 3.3 70B)
    groq_key = groq_api_key or settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
    if groq_key and len(groq_key) > 10:
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
            logger.info(f"Groq parsed task successfully: {parsed.get('title')}")
            return ExtractedTask(**parsed)
        except Exception as e:
            logger.warning(f"Groq task parsing fallback: {e}")

    # 3. Try OpenAI LLM
    openai_key = openai_api_key or settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")
    if openai_key and len(openai_key) > 10:
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
            logger.warning(f"OpenAI task parsing fallback: {e}")

    # 4. Fallback to refined intelligent multilingual heuristic
    logger.info("Using refined intelligent heuristic multilingual parser with natural title polishing.")
    parsed = heuristic_parse_task(transcript, now_user)
    parsed["original_transcript"] = transcript
    return ExtractedTask(**parsed)
