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
SYSTEM_PROMPT = """You are an expert multilingual task extraction AI engine (Siri/ChatGPT/Google Assistant quality).
The user speaks in any language or mix (English, Hindi, Punjabi, Hinglish, Spanish, French, etc.).
Your goal is to parse the voice transcript, extract the core actionable task, resolve relative dates/times against the user's reference time and timezone, detect priority, categorize accurately, and return a clean structured JSON object.

### Reference Time
Reference timestamp, day of week, and timezone are provided in the user prompt.

### Output JSON Schema:
{
  "title": "<Concise, professional title of the task in clear English or standard script, Title Cased>",
  "description": "<Detailed context, notes, or original context>",
  "scheduled_date": "<YYYY-MM-DD or null>",
  "scheduled_time": "<HH:MM in 24-hour format or null>",
  "priority": "<'low' | 'medium' | 'high'>",
  "category": "<'work' | 'study' | 'personal' | 'health' | 'finance' | 'general'>",
  "reminder_required": true,
  "language": "<detected language, e.g. en, hi, pa, hinglish, es>"
}

### Metric 1: Title Detection & Cleaning Rules:
- The title MUST be a clean, concise, action-oriented verb or noun phrase in Title Case (e.g. "Submit Database Assignment", "Visit Doctor", "Wake Up for College", "Gym Workout", "Call Rahul About Project", "Pay Electricity Bill", "Buy Groceries", "Study Physics", "Take Medicine", "Attend Team Standup").
- STRICTLY EXCLUDE relative date and time words from the title:
  Do NOT include "tomorrow", "today", "yesterday", "kal", "aaj", "parson", "subah", "shaam", "raat", "dopahar", "10 am", "6 pm", "7 baje", "baje", "at 5", "next week", "tonight".
- STRICTLY REMOVE conversational voice prefixes and fillers:
  Exclude "remind me to", "please remind me to", "can you remind me to", "i need to", "i have to", "make sure to", "don't forget to", "note down", "add task", "schedule", "set reminder for", "mujhe", "mera task banao", "likh lo", "yaad dilana", "karna hai", "karni hai", "jana hai", "ਮੈਨੂੰ ਯਾਦ ਕਰਵਾਓ".
- Translate colloquial Hindi/Hinglish/Punjabi verb phrases to professional English action titles while preserving proper nouns, subjects, and company names (e.g. "DBMS ka assignment submit karna" -> "Submit DBMS Assignment", "Mummy se baat karni hai" -> "Call Mom", "Bijli ka bill bharna hai" -> "Pay Electricity Bill").

### Metric 2: Date Resolution Rules:
- "today" / "aaj" / "tonight" / "aaj raat" / "ਅੱਜ" / "आज" -> Exactly reference date (YYYY-MM-DD).
- "tomorrow" / "kal" / "ਕੱਲ੍ਹ" / "कल" -> Reference date + 1 day.
- "day after tomorrow" / "parson" / "ਪਰਸੋਂ" / "परसों" -> Reference date + 2 days.
- "in 3 days" / "teen din baad" -> Reference date + 3 days.
- "next week" / "agle hafte" -> Reference date + 7 days.
- Named weekdays (e.g., "this Friday", "next Monday", "somwar", "shukrawar", "ਸੋਮਵਾਰ") -> Upcoming calendar date of that day.
- If no date is spoken:
  - If a specific time is mentioned that is later today, use today's date.
  - Otherwise, default to tomorrow's date or today depending on urgency.

### Metric 3: Time Resolution Rules (24-Hour Format HH:MM):
- Explicit hour + AM/PM or time-of-day:
  - "10 am" / "10:00 am" -> "10:00"
  - "6 pm" / "6:00 pm" -> "18:00"
  - "subah 8 baje" / "8 am" -> "08:00"
  - "dopahar 2 baje" / "2 pm" -> "14:00"
  - "shaam 6 baje" / "6 pm" -> "18:00"
  - "shaam 7 baje" / "7 pm" -> "19:00" (NOT "07:00")
  - "raat 9 baje" / "9 pm" -> "21:00"
  - "raat 10 baje" / "10 pm" -> "22:00"
- Colloquial Hindi/Punjabi terms:
  - "dedh baje" / "ਡੇਢ ਵਜੇ" -> "13:30" (or "01:30" if morning)
  - "dhaai baje" / "ਢਾਈ ਵਜੇ" -> "14:30" (or "02:30" if morning)
  - "sadhe saat" -> "19:30" (if evening/shaam) or "07:30" (if morning/subah)
  - "paune aath" -> "19:45" (if evening/shaam) or "07:45"
  - "sawwa che" -> "18:15" (if evening/shaam) or "06:15"
- Relative offsets:
  - "in 30 minutes" / "aadhe ghante baad" -> reference time + 30 minutes.
  - "in 1 hour" / "ek ghante baad" -> reference time + 1 hour.
- Contextual defaults when AM/PM is omitted:
  - Morning activities (wake up, college, school, breakfast, jog) at 6, 7, 8, 9, 10 -> AM (06:00, 07:00, 08:00, 09:00, 10:00).
  - Evening activities (gym, dinner, walk, drinks, party) at 6, 7, 8, 9, 10 -> PM (18:00, 19:00, 20:00, 21:00, 22:00).

### Metric 4: Priority Detection Rules:
- "high":
  - Explicit urgency words: "urgent", "emergency", "asap", "critical", "important", "bohot zaroori", "bahut jaruri", "zaroori", "jaruri", "turant", "abhi ke abhi", "immediately", "highest priority", "must do", "deadline", "crucial", "essential", "pakka", "vital", "ਜ਼ਰੂਰੀ", "ਤੁਰੰਤ", "जरूरी", "अति आवश्यक".
  - High stakes commitments: "exam tomorrow", "doctor appointment", "hospital", "dentist", "interview", "flight", "deadline tonight", "bill due today".
- "low":
  - Non-urgent words: "low priority", "not urgent", "whenever", "kabhi bhi", "fursat me", "free time", "casual", "chill", "optional", "jab time mile", "no rush", "ਕਦੇ ਵੀ", "ਫੁਰਸਤ", "फुर्सत", "कभी भी".
- "medium":
  - Standard day-to-day tasks with no special urgency markers.

### Category Mapping:
- study: assignments, exams, classes, homework, college, university, dbms, database, studying, school, test, syllabus, lecture.
- work: meetings, projects, clients, presentations, office, emails, sync, standup, reports, sprint.
- health: gym, workouts, walks, medicine, tablets, doctor, dentist, clinic, exercises, yoga, running, hospital.
- finance: bills, electricity bill, recharge, bank, money, fees, salary, rent, tax, payment, credit card.
- personal: family, friends, mom, dad, parents, party, dinner, lunch, birthday, wake up, groceries, car wash, cleaning room.
- general: other tasks.

### Few-Shot Demonstrations:

Input: "Kal subah 10 baje database ka assignment submit karna hai bohot zaroori hai"
Output:
{
  "title": "Submit Database Assignment",
  "description": "Database assignment submission (urgent)",
  "scheduled_date": "2026-10-09",
  "scheduled_time": "10:00",
  "priority": "high",
  "category": "study",
  "reminder_required": true,
  "language": "hinglish"
}

Input: "ਕੱਲ੍ਹ ਸ਼ਾਮ 7 ਵਜੇ gym ਜਾਣਾ ਹੈ"
Output:
{
  "title": "Gym Workout",
  "description": "Evening gym workout",
  "scheduled_date": "2026-10-09",
  "scheduled_time": "19:00",
  "priority": "medium",
  "category": "health",
  "reminder_required": true,
  "language": "pa"
}

Input: "Remind me to call mom tomorrow evening whenever free"
Output:
{
  "title": "Call Mom",
  "description": "Call mom in the evening",
  "scheduled_date": "2026-10-09",
  "scheduled_time": "18:00",
  "priority": "low",
  "category": "personal",
  "reminder_required": true,
  "language": "en"
}

Input: "Emergency doctor appointment tomorrow at 11 AM"
Output:
{
  "title": "Visit Doctor",
  "description": "Emergency doctor appointment",
  "scheduled_date": "2026-10-09",
  "scheduled_time": "11:00",
  "priority": "high",
  "category": "health",
  "reminder_required": true,
  "language": "en"
}

Input: "Bijli ka bill pay karna hai parson shaam 6 baje"
Output:
{
  "title": "Pay Electricity Bill",
  "description": "Electricity bill payment",
  "scheduled_date": "2026-10-10",
  "scheduled_time": "18:00",
  "priority": "medium",
  "category": "finance",
  "reminder_required": true,
  "language": "hinglish"
}

Input: "Kal subah 7 baje college ke liye uthna hai"
Output:
{
  "title": "Wake Up for College",
  "description": "Wake up for college",
  "scheduled_date": "2026-10-09",
  "scheduled_time": "07:00",
  "priority": "medium",
  "category": "personal",
  "reminder_required": true,
  "language": "hinglish"
}

Return ONLY valid JSON matching the schema. No markdown backticks, no explanations.
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

def to_title_case(phrase: str) -> str:
    """Helper to convert string to clean Title Case."""
    if not phrase:
        return phrase
    # Lowercase small words unless first word
    small_words = {'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'of', 'on', 'or', 'the', 'to', 'v', 'via', 'with', 'ka', 'ki', 'ke', 'da', 'di', 'de'}
    words = phrase.strip().split()
    title_cased = []
    for i, w in enumerate(words):
        lw = w.lower()
        if i == 0 or lw not in small_words or lw in ('dbms', 'sql', 'ui', 'ux', 'api'):
            if lw in ('dbms', 'sql', 'ui', 'ux', 'api', 'ai', 'pdf', 'hr', 'it'):
                title_cased.append(lw.upper())
            else:
                title_cased.append(w.capitalize())
        else:
            title_cased.append(lw)
    return " ".join(title_cased)

def polish_task_title(title: str) -> str:
    """
    Transforms colloquial phrases into professional, title-cased task titles:
    - 'DBMS padhna' -> 'Study DBMS'
    - 'uthana college ke liye' -> 'Wake up for College'
    - 'database ka assignment submit' -> 'Submit Database Assignment'
    - 'rahul ko call' -> 'Call Rahul'
    - 'doctor ke paas jana' -> 'Visit Doctor'
    - 'gym jana' -> 'Gym'
    """
    cleaned = title.strip()
    if not cleaned:
        return ""

    # 1. Study patterns:
    m_study1 = re.match(r'^(.*?)\s+(?:padhna|padhni|padhai|padh|study|read|learn|ਪੜ੍ਹਨਾ|ਪੜ੍ਹਾਈ|पढ़ना|पढना)(?:\s+hai)?$', cleaned, re.IGNORECASE)
    if m_study1:
        subj = m_study1.group(1).strip()
        subj_str = subj.upper() if len(subj) <= 4 else to_title_case(subj)
        return f"Study {subj_str}"
        
    m_study2 = re.match(r'^(?:padhna|padhni|padhai|padh|study|read|learn|ਪੜ੍ਹਨਾ|ਪੜ੍ਹਾਈ|पढ़ना|पढना)\s+(.*?)(?:\s+hai)?$', cleaned, re.IGNORECASE)
    if m_study2:
        subj = m_study2.group(1).strip()
        subj_str = subj.upper() if len(subj) <= 4 else to_title_case(subj)
        return f"Study {subj_str}"

    # 2. Doctor / Medical patterns:
    m_doc = re.match(r'^(?:doctor|dr|dr\.|dentist|clinic)\s*(?:ke\s+paas|ke\s+kool|pete)?\s*(?:jana|jani|jaana|appointment|visit)?$', cleaned, re.IGNORECASE)
    if m_doc or re.search(r'\b(doctor|dr\.|dentist|clinic)\b', cleaned, re.IGNORECASE):
        if re.search(r'\b(doctor|dr\.|dentist|clinic)\b', cleaned, re.IGNORECASE):
            doc_name = re.sub(r'\s*(?:ke\s+paas|jana|jani|jaana|hai|appointment|visit)\s*', ' ', cleaned, flags=re.IGNORECASE).strip()
            return f"Visit {to_title_case(doc_name)}" if doc_name else "Visit Doctor"

    # 3. Wake up patterns:
    m_wake1 = re.match(r'^(?:uthana|uthna|jagna|utho|wake\s*up|get\s*up|ਉੱਠਣਾ|ਉਠਣਾ|उठना|जागना)\s+(?:hai\s+)?(.+?)\s+(?:ke\s+liye|lai|waste|nu|ko)$', cleaned, re.IGNORECASE)
    if m_wake1:
        target = m_wake1.group(1).strip()
        return f"Wake up for {to_title_case(target)}"

    m_wake2 = re.match(r'^(.+?)\s+(?:ke\s+liye|lai|waste)\s+(?:uthana|uthna|jagna|utho|wake\s*up|get\s*up|ਉੱਠਣਾ|ਉਠਣਾ|उठना|जागना)(?:\s+hai)?$', cleaned, re.IGNORECASE)
    if m_wake2:
        target = m_wake2.group(1).strip()
        return f"Wake up for {to_title_case(target)}"

    if re.match(r'^(?:uthana|uthna|jagna|utho|wake\s*up|get\s*up|ਉੱਠਣਾ|ਉਠਣਾ|उठना|जागना)(?:\s+hai)?$', cleaned, re.IGNORECASE):
        return "Wake up"

    # 4. Call patterns:
    m_call1 = re.match(r'^(.*?)\s+(?:ko|nu)\s+(?:call|phone|milna)(?:\s+karna)?$', cleaned, re.IGNORECASE)
    if m_call1:
        person = m_call1.group(1).strip()
        return f"Call {to_title_case(person)}"

    m_call2 = re.match(r'^(?:call|phone)\s+(?:to\s+)?(.*?)(?:\s+ko|\s+nu)?$', cleaned, re.IGNORECASE)
    if m_call2:
        person = m_call2.group(1).strip()
        return f"Call {to_title_case(person)}"

    m_call3 = re.match(r'^(.*?)\s+(?:call|phone)$', cleaned, re.IGNORECASE)
    if m_call3:
        person = m_call3.group(1).strip()
        return f"Call {to_title_case(person)}"

    # 5. Pattern: [object] ka/ki/ke [task] submit/complete/finish/dena
    m = re.match(r'^(.*?)\s+(?:ka|ki|ke|da|di|de)\s+(.*?)\s+(submit|complete|finish|karna|check|review|dena)$', cleaned, re.IGNORECASE)
    if m:
        obj, noun, verb = m.groups()
        verb_map = {'submit': 'Submit', 'complete': 'Complete', 'finish': 'Finish', 'karna': 'Do', 'check': 'Check', 'review': 'Review', 'dena': 'Submit'}
        v = verb_map.get(verb.lower(), verb.capitalize())
        return to_title_case(f"{v} {obj} {noun}")

    # 6. Pattern: [object] submit/complete/finish/review/pay/bharna
    m_action = re.match(r'^(.*?)\s+(submit|complete|finish|check|review|pay|bharna)$', cleaned, re.IGNORECASE)
    if m_action:
        obj, verb = m_action.groups()
        verb_map = {'submit': 'Submit', 'complete': 'Complete', 'finish': 'Finish', 'check': 'Check', 'review': 'Review', 'pay': 'Pay', 'bharna': 'Pay'}
        v = verb_map.get(verb.lower(), verb.capitalize())
        return to_title_case(f"{v} {obj}")

    # 7. Pattern: gym / workout / walk
    if cleaned.lower() in ('gym', 'gym jana'):
        return "Gym"
    if cleaned.lower() in ('gym workout',):
        return "Gym Workout"
    m3 = re.match(r'^(gym|walk|workout)(?:\s+(?:jana|jani|jaana|जाना|ਜਾਣਾ))?$', cleaned, re.IGNORECASE)
    if m3:
        word = m3.group(1).lower()
        if word == 'gym': return "Gym"
        return to_title_case(word)

    # 8. Pattern: pay [bill]
    m_pay = re.match(r'^(?:pay|bharna)\s+(.*?)$', cleaned, re.IGNORECASE)
    if m_pay:
        bill = m_pay.group(1).strip()
        return f"Pay {to_title_case(bill)}"

    # 9. Pattern: seminar / webinar / workshop / conference / presentation
    m_event = re.match(r'^(?:attend|join|participate\s+in)?\s*(?:a\s+)?(seminar|webinar|workshop|conference|presentation|demo|symposium)(?:\s+(?:hai|attend|karna))?$', cleaned, re.IGNORECASE)
    if m_event:
        event_type = m_event.group(1).lower()
        return f"Attend {event_type.capitalize()}"
    if cleaned.lower() in ('seminar', 'webinar', 'workshop', 'conference', 'presentation', 'demo'):
        return f"Attend {cleaned.capitalize()}"

    m_event_topic = re.match(r'^(?:attend\s+)?(.*?)\s+(seminar|webinar|workshop|conference|presentation)(?:\s+(?:hai|attend|karna))?$', cleaned, re.IGNORECASE)
    if m_event_topic:
        topic = m_event_topic.group(1).strip()
        event_word = m_event_topic.group(2).strip().capitalize()
        if topic.lower() not in ('i have a', 'i have an', 'have a', 'have an', 'a', 'an', 'the', 'my', 'mera', 'meri', 'ek'):
            return to_title_case(f"Attend {topic} {event_word}")
        return f"Attend {event_word}"

    return to_title_case(cleaned)

MONTH_NAME_TO_NUM = {
    'january': 1, 'jan': 1, 'जनवरी': 1, 'ਜਨਵਰੀ': 1, 'janvari': 1,
    'february': 2, 'feb': 2, 'फ़रवरी': 2, 'फरवरी': 2, 'ਫ਼ਰਵਰੀ': 2, 'ਫਰਵਰੀ': 2, 'farvari': 2,
    'march': 3, 'mar': 3, 'मार्च': 3, 'ਮਾਰਚ': 3,
    'april': 4, 'apr': 4, 'अप्रैल': 4, 'ਅਪ੍ਰੈਲ': 4,
    'may': 5, 'मई': 5, 'ਮਈ': 5, 'mai': 5,
    'june': 6, 'jun': 6, 'जून': 6, 'ਜੂਨ': 6,
    'july': 7, 'jul': 7, 'जुलाई': 7, 'ਜੁਲਾਈ': 7,
    'august': 8, 'aug': 8, 'अगस्त': 8, 'ਅਗਸਤ': 8, 'agast': 8,
    'september': 9, 'sep': 9, 'sept': 9, 'सितंबर': 9, 'ਸਤੰਬਰ': 9, 'sitambar': 9,
    'october': 10, 'oct': 10, 'अक्टूबर': 10, 'अक्तूबर': 10, 'ਅਕਤੂਬਰ': 10, 'aktubar': 10,
    'november': 11, 'nov': 11, 'नवंबर': 11, 'ਨਵੰਬਰ': 11, 'navambar': 11,
    'december': 12, 'dec': 12, 'दिसंबर': 12, 'ਦਸੰਬਰ': 12, 'disambar': 12
}

_MONTH_KEYS = sorted(MONTH_NAME_TO_NUM.keys(), key=len, reverse=True)
_MONTH_REGEX_STR = '|'.join(re.escape(k) for k in _MONTH_KEYS)

RE_DAY_MONTH = re.compile(
    rf'\b(?P<day>\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?(?P<month>{_MONTH_REGEX_STR})(?:\s+(?P<year>\d{{4}}))?\b',
    re.IGNORECASE
)
RE_MONTH_DAY = re.compile(
    rf'\b(?P<month>{_MONTH_REGEX_STR})\s+(?P<day>\d{{1,2}})(?:st|nd|rd|th)?(?:\s*,?\s*(?P<year>\d{{4}}))?\b',
    re.IGNORECASE
)
RE_NUMERIC_DATE = re.compile(
    r'\b(?P<day>\d{1,2})[/-](?P<month>\d{1,2})(?:[/-](?P<year>\d{2,4}))?\b'
)

def heuristic_parse_task(transcript: str, ref_dt: datetime) -> Dict[str, Any]:
    """
    Intelligent heuristic fallback parser for Hindi, Hinglish, Punjabi, and English.
    Refined with comprehensive multi-script regex, calendar dates, and relative time normalization.
    """
    text_lower = transcript.lower()
    
    # 1. Date resolution
    task_date: Optional[date] = None
    matched_date_str = ""

    # 1a. Explicit calendar dates (e.g. "21st October", "October 21st", "21 Oct", "21/10/2026")
    m_cal = RE_DAY_MONTH.search(text_lower) or RE_MONTH_DAY.search(text_lower)
    if m_cal:
        try:
            d_val = int(m_cal.group('day'))
            m_name = m_cal.group('month').lower()
            mon_val = MONTH_NAME_TO_NUM.get(m_name, 10)
            y_group = m_cal.groupdict().get('year')
            y_val = int(y_group) if y_group else ref_dt.year
            if 1 <= d_val <= 31 and 1 <= mon_val <= 12:
                candidate = date(y_val, mon_val, d_val)
                # If date is in past (>30 days ago) and no year was specified, assume next year
                if not y_group and candidate < (ref_dt.date() - timedelta(days=30)):
                    candidate = date(y_val + 1, mon_val, d_val)
                task_date = candidate
                matched_date_str = m_cal.group(0)
        except (ValueError, TypeError):
            pass

    if not task_date:
        m_num = RE_NUMERIC_DATE.search(text_lower)
        if m_num:
            try:
                d_val = int(m_num.group('day'))
                mon_val = int(m_num.group('month'))
                y_group = m_num.groupdict().get('year')
                y_val = int(y_group) if y_group else ref_dt.year
                if y_val < 100:
                    y_val += 2000
                if 1 <= d_val <= 31 and 1 <= mon_val <= 12:
                    task_date = date(y_val, mon_val, d_val)
                    matched_date_str = m_num.group(0)
            except (ValueError, TypeError):
                pass

    # 1b. Relative date keywords if no calendar date matched
    if not task_date:
        weekday_map = {
            'monday': 0, 'somwar': 0, 'ਸੋਮਵਾਰ': 0, 'सोमवार': 0,
            'tuesday': 1, 'mangalwar': 1, 'ਮੰਗਲਵਾਰ': 1, 'मंगलवार': 1,
            'wednesday': 2, 'budhwar': 2, 'ਬੁੱਧਵਾਰ': 2, 'बुधवार': 2,
            'thursday': 3, 'guruwar': 3, 'veervar': 3, 'ਵੀਰਵਾਰ': 3, 'गुरुवार': 3,
            'friday': 4, 'shukrawar': 4, 'ਸ਼ੁੱਕਰਵਾਰ': 4, 'शुक्रवार': 4,
            'saturday': 5, 'shaniwar': 5, 'ਸ਼ਨਿੱਚਰਵਾਰ': 5, 'शनिवार': 5,
            'sunday': 6, 'ravivar': 6, 'aitwar': 6, 'ਐਤਵਾਰ': 6, 'रविवार': 6
        }
        
        matched_weekday = None
        for day_name, day_idx in weekday_map.items():
            if re.search(rf'\b{re.escape(day_name)}\b', text_lower):
                matched_weekday = day_idx
                break

        if any(k in text_lower for k in ["parson", "day after tomorrow", "day after", "ਪਰਸੋਂ", "परसों"]):
            task_date = (ref_dt + timedelta(days=2)).date()
        elif any(k in text_lower for k in ["kal", "tomorrow", "ਕੱਲ੍ਹ", "कल"]):
            task_date = (ref_dt + timedelta(days=1)).date()
        elif any(k in text_lower for k in ["aaj", "today", "tonight", "aaj raat", "ਅੱਜ", "आज"]):
            task_date = ref_dt.date()
        elif any(k in text_lower for k in ["agle hafte", "next week", "ਅਗਲੇ ਹਫ਼ਤੇ"]):
            task_date = (ref_dt + timedelta(days=7)).date()
        elif matched_weekday is not None:
            days_ahead = (matched_weekday - ref_dt.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7
            task_date = (ref_dt + timedelta(days=days_ahead)).date()
        else:
            task_date = (ref_dt + timedelta(days=1)).date()

    # 2. Time resolution (with Hindi & Punjabi scripts)
    task_time: Optional[str] = None
    
    pm_keywords = [
        "shaam", "sham", "raat", "evening", "night", "pm", "p.m.",
        "शाम", "रात", "ਸ਼ਾਮ", "ਰਾਤ"
    ]
    is_pm = any(k in text_lower for k in pm_keywords)

    am_keywords = [
        "subah", "subh", "morning", "am", "a.m.",
        "सुबह", "सवेरे", "ਸਵੇਰੇ", "ਸਵੇਰ"
    ]
    is_am = any(k in text_lower for k in am_keywords)

    is_afternoon = any(k in text_lower for k in ["dopahar", "afternoon", "ਦੁਪਹਿਰ", "दोपहर"])

    digit_map = {'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','੮':'8','९':'9',
                 '੦':'0','੧':'1','੨':'2','੩':'3','੪':'4','੫':'5','੬':'6','੭':'7','੮':'8','੯':'9'}
    normalized_text = text_lower
    for k, v in digit_map.items():
        normalized_text = normalized_text.replace(k, v)

    for word, num in WORD_TO_NUMBER.items():
        normalized_text = re.sub(rf'(?i)\b{re.escape(word)}\s*(baje|बजे|ਵਜੇ|am|pm|o\'clock)', f'{num} \\1', normalized_text)
        normalized_text = re.sub(rf'(?i)(subah|subh|shaam|sham|raat|morning|evening|night|सवेरे|सुबह|शाम|रात|ਸਵੇਰੇ|ਸ਼ਾਮ|ਰਾਤ)\s+{re.escape(word)}\b', f'\\1 {num}', normalized_text)

    # Clean calendar date and ordinal words from text_for_time so date numbers (e.g. 21 in 21st October) are NEVER parsed as hour!
    text_for_time = normalized_text
    if matched_date_str:
        text_for_time = re.sub(rf'(?i)(?:\b(?:on|at|for)\s+)?{re.escape(matched_date_str)}', ' ', text_for_time)
    text_for_time = re.sub(r'\b\d{1,2}(?:st|nd|rd|th)\b', ' ', text_for_time, flags=re.IGNORECASE)
    text_for_time = re.sub(r'\b(?:in\s+)?\d{1,2}\s+(?:days?|din|hafte|weeks?)\b', ' ', text_for_time, flags=re.IGNORECASE)

    # Relative time offsets ("in 30 minutes", "aadhe ghante baad", "1 ghante baad")
    m_rel_min = re.search(r'\b(?:in\s+)?(\d{1,2})\s*(?:min|mins|minutes|minute)\b|\b(\d{1,2})\s*minute\s+baad\b', text_for_time)
    m_rel_hour = re.search(r'\b(?:in\s+)?(\d{1,2})\s*(?:hr|hrs|hour|hours)\b|\b(\d{1,2})\s*ghante?\s+baad\b', text_for_time)
    if "aadhe ghante" in text_for_time or "half an hour" in text_for_time:
        target_dt = ref_dt + timedelta(minutes=30)
        task_time = target_dt.strftime("%H:%M")
        task_date = target_dt.date()
    elif m_rel_min:
        mins = int(m_rel_min.group(1) or m_rel_min.group(2))
        target_dt = ref_dt + timedelta(minutes=mins)
        task_time = target_dt.strftime("%H:%M")
        task_date = target_dt.date()
    elif m_rel_hour:
        hrs = int(m_rel_hour.group(1) or m_rel_hour.group(2))
        target_dt = ref_dt + timedelta(hours=hrs)
        task_time = target_dt.strftime("%H:%M")
        task_date = target_dt.date()
    elif re.search(r'\b(dedh|ਡੇਢ|डेढ़)\s*(?:baje|बजे|ਵਜੇ)?\b', text_for_time):
        parsed_hour = 1
        parsed_minutes = 30
        h = 13 if (is_afternoon or is_pm) else 1
        task_time = f"{h:02d}:30"
    elif re.search(r'\b(dhaai|dhayi|ਢਾਈ|ढाई)\s*(?:baje|बजे|ਵਜੇ)?\b', text_for_time):
        parsed_hour = 2
        parsed_minutes = 30
        h = 14 if (is_afternoon or is_pm) else 2
        task_time = f"{h:02d}:30"
    else:
        m_half = re.search(r'\b(?:sadhe|saadhe|ਸਾਢੇ|साढ़े)\s+(\d{1,2})', text_for_time)
        m_sava = re.search(r'\b(?:sava|sawwa|ਸਵਾ|सवा)\s+(\d{1,2})', text_for_time)
        m_paune = re.search(r'\b(?:paune|pauna|ਪੌਣੇ|पौने)\s+(\d{1,2})', text_for_time)
        
        parsed_hour: Optional[int] = None
        parsed_minutes: int = 0
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
            # Match time with explicit colon HH:MM
            m_colon = re.search(r'\b(\d{1,2}):(\d{2})\s*(?:pm|am|p\.m\.|a\.m\.)?', text_for_time, re.IGNORECASE)
            # Match time with explicit marker (baje, am, pm, o'clock)
            m_marker = re.search(r'\b(\d{1,2})(?::(\d{2}))?\s*(?:baje|बजे|ਵਜੇ|pm|am|p\.m\.|a\.m\.|o\'clock)\b', text_for_time, re.IGNORECASE)
            # Match time with explicit preposition (at 6, around 7, subah 8, shaam 6)
            m_prep = re.search(r'\b(?:at|around|sharply\s+at|subah|subh|shaam|sham|raat|morning|evening|night|सवेरे|सुबह|शाम|रात|ਸਵੇਰੇ|ਸ਼ਾਮ|ਰਾਤ)\s+(\d{1,2})(?::(\d{2}))?\b', text_for_time, re.IGNORECASE)

            if m_colon:
                parsed_hour = int(m_colon.group(1))
                parsed_minutes = int(m_colon.group(2))
            elif m_marker:
                parsed_hour = int(m_marker.group(1))
                parsed_minutes = int(m_marker.group(2)) if m_marker.group(2) else 0
            elif m_prep:
                parsed_hour = int(m_prep.group(1))
                parsed_minutes = int(m_prep.group(2)) if m_prep.group(2) else 0

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
                elif not is_am and not is_pm and not is_afternoon:
                    # Contextual time-of-day inference
                    if any(w in text_lower for w in ["gym", "workout", "dinner", "evening walk", "party", "club"]) and 5 <= hour <= 11:
                        hour += 12
                    elif any(w in text_lower for w in ["college", "school", "wake", "uthna", "breakfast", "exam", "class"]) and 6 <= hour <= 11:
                        pass # keep morning AM
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
        "yoga", "swimming", "cycling", "run", "running", "jogging", "medicine", "tablets", "doctor",
        "dentist", "health", "hospital", "clinic", "ਦਵਾਈ", "ਡਾਕਟਰ", "ਦੌੜ", "दवा", "डॉक्टर", "व्यायाम"
    ]
    personal_keywords = [
        "mom", "dad", "mother", "father", "friend", "rahul", "party", "dinner", "lunch",
        "birthday", "gift", "family", "relative", "sister", "brother", "groceries", "car wash", "doodh",
        "ਮੰਮੀ", "ਡੈਡੀ", "ਦੋਸਤ", "मम्मी", "पापा", "दोस्त"
    ]
    wake_keywords = [
        "uthna", "uthana", "jagna", "wake up", "get up", "ਉੱਠਣਾ", "ਉਠਣਾ", "उठना", "जागना"
    ]
    study_keywords = [
        "dbms", "database", "assignment", "study", "exam", "padhna", "homework", "class",
        "college", "school", "test", "course", "lecture", "seminar", "webinar", "workshop",
        "ਪੜ੍ਹਨਾ", "ਪੜ੍ਹਾਈ", "पढ़ना", "परीक्षा"
    ]
    work_keywords = [
        "meeting", "project", "office", "client", "boss", "work", "presentation", "interview",
        "conference", "client call", "email", "report", "standup", "sync", "ਮੀਟਿੰਗ", "ਕੰਮ", "मीटिंग"
    ]

    if any(w in text_lower for w in study_keywords):
        category = "study"
    elif any(w in text_lower for w in health_keywords):
        category = "health"
    elif any(w in text_lower for w in work_keywords):
        category = "work"
    elif any(w in text_lower for w in ["bill", "recharge", "fee", "pay", "bank", "money", "rent", "salary", "loan", "tax", "credit card", "ਪੈਸੇ", "ਬਿੱਲ", "पैसे", "बिल"]):
        category = "finance"
    elif any(w in text_lower for w in personal_keywords) or any(w in text_lower for w in wake_keywords):
        category = "personal"

    # 4. Priority detection
    priority = "medium"
    high_urgency_keywords = [
        "urgent", "bohot zaroori", "bahut jaruri", "bahut zaroori", "zaroori", "jaruri",
        "important", "asap", "emergency", "crucial", "critical", "turant", "abhi ke abhi",
        "immediately", "highest priority", "high priority", "must do", "pakka",
        "deadline", "vital", "ਜ਼ਰੂਰੀ", "ਤੁਰੰਤ", "जरूरी", "अति आवश्यक"
    ]
    low_priority_keywords = [
        "kabhi bhi", "casual", "whenever", "low priority", "not urgent", "fursat me",
        "free time", "jab time mile", "chill", "optional", "no rush", "ਕਦੇ ਵੀ", "ਫੁਰਸਤ", "फुर्सਤ", "कभी भी"
    ]
    if any(w in text_lower for w in high_urgency_keywords):
        priority = "high"
    elif any(w in text_lower for w in ["exam", "doctor", "dentist", "hospital", "interview", "flight"]):
        priority = "high"
    elif any(w in text_lower for w in low_priority_keywords):
        priority = "low"

    # 5. Clean Title Extraction
    clean_title = transcript

    # Strip matched calendar date from title
    if matched_date_str:
        clean_title = re.sub(rf'(?i)(?:\b(?:on|at|for)\s+)?{re.escape(matched_date_str)}', ' ', clean_title)
    clean_title = RE_DAY_MONTH.sub(' ', clean_title)
    clean_title = RE_MONTH_DAY.sub(' ', clean_title)
    clean_title = RE_NUMERIC_DATE.sub(' ', clean_title)

    conversational_phrases = [
        "i have a", "i have an", "i have", "there is a", "there is an", "we have a",
        "mera ek", "meri ek", "ek", "mujhko",
        "remind me to", "remind me", "please remind me to", "can you remind me to",
        "tomorrow at", "tomorrow evening", "tomorrow morning",
        "tomorrow afternoon", "tomorrow night", "tomorrow", "today at", "today evening",
        "today morning", "today afternoon", "today night", "today", "yesterday",
        "day after tomorrow", "i need to", "i have to", "have to", "need to",
        "make sure to", "don't forget to", "note down", "add task", "schedule",
        "urgent", "important", "asap", "emergency", "bohot zaroori", "bahut jaruri", "bahut zaroori",
        "zaroori", "jaruri", "turant", "abhi ke abhi", "at", "o'clock", "before",
        "whenever free", "whenever", "casual", "free time", "fursat me",
        "evening", "morning", "afternoon", "night",
        "kal shaam", "kal subah", "kal raat", "kal dopahar", "kal",
        "aaj shaam", "aaj subah", "aaj raat", "aaj", "parson",
        "mujhe", "mera task banao", "likh lo", "karna hai", "karni hai", "jana hai", "jani hai",
        "dena hai", "deni hai", "karna", "jana", "hai", "ko", "me", "mein", "nu", "baje"
    ]
    indic_phrases = [
        "कल सुबह", "कल शाम", "कल रात", "कल दोपहर", "कल", "आज सुबह", "आज शाम", "आज रात", "आज", "परसों",
        "मुझे", "करना है", "जाना है", "देना है", "है", "को", "में", "बजे", "सुबह", "शाम", "दोपहर", "रात", "जरूरी",
        "कੱਲ੍ਹ ਸ਼ਾਮ", "ਕੱਲ੍ਹ ਸਵੇਰੇ", "ਕੱਲ੍ਹ ਰਾਤ", "ਕੱਲ੍ਹ ਦੁਪਹਿਰ", "ਕੱਲ੍ਹ", "ਅੱਜ ਸ਼ਾਮ", "ਅੱਜ ਸਵੇਰੇ", "ਅੱਜ ਰਾਤ", "ਅੱਜ",
        "ਪਰਸੋਂ", "ਮੈਨੂੰ", "ਕਰਨਾ ਹੈ", "ਜਾਣਾ ਹੈ", "ਦੇਣਾ ਹੈ", "ਹੈ", "ਨੂੰ", "ਵਿੱਚ", "ਵਜੇ", "ਸਵੇਰੇ", "ਸ਼ਾਮ", "ਰਾਤ", "ਜ਼ਰੂਰੀ"
    ]

    for mod in TIME_MODIFIERS:
        clean_title = re.sub(rf'(?i)\b{re.escape(mod)}\b', ' ', clean_title)

    for word in sorted(WORD_TO_NUMBER.keys(), key=len, reverse=True):
        clean_title = re.sub(rf'(?i)\b{re.escape(word)}\s*(?:baje|बजे|ਵਜੇ|am|pm|o\'clock)\b', ' ', clean_title)
        clean_title = re.sub(rf'(?i)\b(?:subah|subh|shaam|sham|raat|morning|evening|night|सवेरे|सुबह|शाम|रात|ਸਵੇਰੇ|ਸ਼ਾਮ|ਰਾਤ)\s+{re.escape(word)}\b', ' ', clean_title)

    for phrase in sorted(conversational_phrases, key=len, reverse=True):
        clean_title = re.sub(rf'(?i)\b{re.escape(phrase)}\b', ' ', clean_title)

    for phrase in sorted(indic_phrases, key=len, reverse=True):
        clean_title = clean_title.replace(phrase, ' ')

    # Clean stray ordinal indicators (e.g. "st", "nd", "rd", "th" left over from dates)
    clean_title = re.sub(r'\b(?:st|nd|rd|th)\b', ' ', clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r'\b\d{1,2}(?::\d{2})?\s*(?:baje|बजे|ਵਜੇ|pm|am|o\'clock)?\b', ' ', clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r'[\d\u0966-\u096f\u0a66-\u0a6f]+', ' ', clean_title)
    
    clean_title = re.sub(r'[,\.\-–—:!?]+', ' ', clean_title)
    clean_title = re.sub(r'\s+', ' ', clean_title).strip()
    
    clean_title = polish_task_title(clean_title)

    if not clean_title or len(clean_title) < 2:
        clean_title = transcript.strip()
    else:
        clean_title = to_title_case(clean_title)

    detected_lang = "en"
    if any(ord(c) >= 0x0A00 and ord(c) <= 0x0A7F for c in transcript):
        detected_lang = "pa"
    elif any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in transcript):
        detected_lang = "hi"
    elif any(w in text_lower for w in ["karna", "hai", "subah", "shaam", "baje", "mera", "kal", "zaroori"]):
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
    1. Google Gemini (gemini-2.0-flash / gemini-1.5-flash) with structured JSON
    2. OpenAI LLM (gpt-4o-mini)
    3. Groq LLM (llama-3.3-70b-versatile)
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

    # Resolve keys with auto-detection
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

    # 1. Try Google Gemini (gemini-3.5-flash / gemini-flash-lite-latest / gemini-2.0-flash)
    if raw_gemini and len(raw_gemini) > 10 and not raw_gemini.startswith("AIzaSyDXYy"):
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=raw_gemini)
            prompt = f"{ref_info}\nUser Voice Transcript: \"{transcript}\""
            
            gemini_models_to_try = [
                "gemini-3.5-flash",
                "gemini-flash-lite-latest",
                "gemini-3.5-flash-lite",
                "gemini-2.0-flash",
                "gemini-1.5-flash"
            ]
            response = None
            for g_model in gemini_models_to_try:
                try:
                    response = client.models.generate_content(
                        model=g_model,
                        contents=f"{SYSTEM_PROMPT}\n\n{prompt}",
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.0
                        )
                    )
                    if response and response.text:
                        break
                except Exception as g_err:
                    logger.info(f"Gemini model {g_model} fallback: {g_err}")
                    continue

            if response and response.text:
                cleaned_text = response.text.strip()
                if cleaned_text.startswith("```json"):
                    cleaned_text = cleaned_text[7:]
                if cleaned_text.startswith("```"):
                    cleaned_text = cleaned_text[3:]
                if cleaned_text.endswith("```"):
                    cleaned_text = cleaned_text[:-3]
                parsed = json.loads(cleaned_text.strip())
                parsed["original_transcript"] = transcript
                logger.info(f"Google Gemini parsed task successfully: {parsed.get('title')}")
                return ExtractedTask(**parsed)
        except Exception as e:
            logger.warning(f"Google Gemini task parsing fallback: {e}")

    # 2. Try OpenAI LLM (gpt-4o-mini)
    if raw_openai and len(raw_openai) > 10:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=raw_openai, max_retries=0, timeout=6.0)
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
            logger.info(f"OpenAI parsed task successfully: {parsed.get('title')}")
            return ExtractedTask(**parsed)
        except Exception as e:
            logger.warning(f"OpenAI task parsing fallback: {e}")

    # 3. Try Groq LLM (OpenAI-compatible / Qwen / Llama on Groq)
    if raw_groq and len(raw_groq) > 10:
        try:
            from groq import Groq
            client = Groq(api_key=raw_groq, max_retries=0, timeout=6.0)
            prompt = f"{ref_info}\nUser Voice Transcript: \"{transcript}\""
            
            groq_models_to_try = [
                "openai/gpt-oss-120b",
                "qwen/qwen3.8-27b",
                "llama-3.3-70b-versatile",
                "llama3-70b-8192"
            ]
            completion = None
            for groq_model in groq_models_to_try:
                try:
                    completion = client.chat.completions.create(
                        model=groq_model,
                        messages=[
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.0
                    )
                    if completion and completion.choices:
                        break
                except Exception as groq_err:
                    logger.info(f"Groq model {groq_model} fallback: {groq_err}")
                    continue

            if completion and completion.choices:
                raw_json = completion.choices[0].message.content
                parsed = json.loads(raw_json)
                parsed["original_transcript"] = transcript
                logger.info(f"Groq parsed task successfully: {parsed.get('title')}")
                return ExtractedTask(**parsed)
        except Exception as e:
            logger.warning(f"Groq task parsing fallback: {e}")

    # 4. Fallback to refined intelligent multilingual heuristic
    logger.info("Using refined intelligent heuristic multilingual parser with natural title polishing.")
    parsed = heuristic_parse_task(transcript, now_user)
    parsed["original_transcript"] = transcript
    return ExtractedTask(**parsed)
