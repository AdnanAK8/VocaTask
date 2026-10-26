"""
Multilingual Service for FrontFix AI
Supports English, Hindi, Punjabi, and Hinglish while strictly preserving code integrity.
"""

import re
from typing import Dict, Any, List, Optional, Tuple


class MultilingualService:
    # Unicode script ranges
    DEVANAGARI_REGEX = re.compile(r"[\u0900-\u097F]")
    GURMUKHI_REGEX = re.compile(r"[\u0A00-\u0A7F]")

    # Hinglish common markers
    HINGLISH_WORDS = {
        "mera", "meri", "mere", "kya", "kyu", "kyun", "kaise", "karna", "kare",
        "nahi", "nhi", "raha", "rahi", "rahe", "hai", "hain", "ho", "tha", "the",
        "thi", "batao", "madad", "samajh", "aaj", "kal", "parson", "subah", "shaam",
        "dikkat", "chal", "chala", "ruk", "gaya", "gayi", "lag", "kaam", "karo", "pe"
    }

    # Punjabi Romanized markers
    PUNJABI_ROMAN_WORDS = {
        "mera", "meri", "mere", "kida", "kive", "kiven", "kyu", "kyun", "kar",
        "karna", "kariye", "nahi", "nhi", "reha", "rehi", "rehe", "hai", "han",
        "hunda", "hundi", "si", "san", "daso", "dasso", "madad", "samajh", "ajj",
        "kal", "kam", "chalda", "ruk", "te", "vich"
    }

    @classmethod
    def detect_language(cls, text: str) -> str:
        """Detects whether text is in English, Hindi, Punjabi, or Hinglish."""
        if not text or not isinstance(text, str):
            return "en"

        trimmed = text.strip()

        # Check native scripts first
        devanagari_chars = len(cls.DEVANAGARI_REGEX.findall(trimmed))
        gurmukhi_chars = len(cls.GURMUKHI_REGEX.findall(trimmed))

        if devanagari_chars >= 2:
            return "hi"
        if gurmukhi_chars >= 2:
            return "pa"

        # Check tokenized romanized text
        words = re.findall(r"\b[a-zA-Z]+\b", trimmed.lower())
        if not words:
            return "en"

        total_words = len(words)
        hinglish_count = sum(1 for w in words if w in cls.HINGLISH_WORDS)
        punjabi_count = sum(1 for w in words if w in cls.PUNJABI_ROMAN_WORDS)

        if punjabi_count >= 2 and punjabi_count >= hinglish_count:
            return "pa"
        if hinglish_count >= 2 or (total_words <= 5 and hinglish_count >= 1):
            return "hinglish"

        return "en"

    @classmethod
    def get_ui_labels(cls, lang: str = "en") -> Dict[str, str]:
        """Provides localized UI label strings."""
        labels = {
            "en": {
                "problem": "Problem",
                "likely_cause": "Likely Cause",
                "evidence": "Evidence",
                "fix_steps": "Fix Steps",
                "verification": "Verification",
                "solved_btn": "✅ This solved my problem",
                "broken_btn": "❌ Still not working — troubleshoot further",
                "skip_btn": "Skip questions & show best guess",
                "verified_badge": "📚 Verified Knowledge Base",
                "ai_badge": "✨ AI Diagnostic Hypothesis",
            },
            "hi": {
                "problem": "समस्या (Problem)",
                "likely_cause": "संभावित कारण (Likely Cause)",
                "evidence": "उपलब्ध प्रमाण (Evidence)",
                "fix_steps": "समाधान के चरण (Fix Steps)",
                "verification": "जाँच (Verification)",
                "solved_btn": "✅ समस्या हल हो गई (Solved)",
                "broken_btn": "❌ अभी भी काम नहीं कर रहा (Still Broken)",
                "skip_btn": "प्रश्न छोड़ें और समाधान देखें (Skip & Fix)",
                "verified_badge": "📚 सत्यापित समाधान (Verified KB)",
                "ai_badge": "✨ AI नैदानिक अनुमान (AI Hypothesis)",
            },
            "pa": {
                "problem": "ਮਸਲਾ (Problem)",
                "likely_cause": "ਸੰਭਾਵੀ ਕਾਰਨ (Likely Cause)",
                "evidence": "ਸਬੂਤ (Evidence)",
                "fix_steps": "ਠੀਕ ਕਰਨ ਦੇ ਕਦਮ (Fix Steps)",
                "verification": "ਪੜਤਾਲ (Verification)",
                "solved_btn": "✅ ਮੇਰਾ ਮਸਲਾ ਹੱਲ ਹੋ ਗਿਆ (Solved)",
                "broken_btn": "❌ ਹਾਲੇ ਵੀ ਕੰਮ ਨਹੀਂ ਕਰ ਰਿਹਾ (Still Broken)",
                "skip_btn": "ਸਵਾਲ ਛੱਡੋ ਤੇ ਹੱਲ ਦੇਖੋ (Skip & Fix)",
                "verified_badge": "📚 ਪ੍ਰਮਾਣਿਤ ਹੱਲ (Verified KB)",
                "ai_badge": "✨ AI ਅਨੁਮਾਨ (AI Hypothesis)",
            },
            "hinglish": {
                "problem": "Problem",
                "likely_cause": "Likely Root Cause (Karan)",
                "evidence": "Detected Evidence",
                "fix_steps": "Fix Steps (Kaise Solve Karein)",
                "verification": "Verification Step",
                "solved_btn": "✅ Yeh solve ho gaya (Solved)",
                "broken_btn": "❌ Abhi bhi error aa raha hai (Still Broken)",
                "skip_btn": "Questions skip karke solution dikhao",
                "verified_badge": "📚 Verified Knowledge Base",
                "ai_badge": "✨ AI Generated Diagnosis",
            },
        }
        return labels.get(lang, labels["en"])

    @classmethod
    def get_greeting(cls, lang: str = "en") -> str:
        greetings = {
            "en": "I'm FrontFix AI, your frontend technical support engineer. How can I help resolve your issue?",
            "hi": "नमस्ते! मैं FrontFix AI हूँ, आपका फ्रंटएंड टेक्निकल सपोर्ट असिस्टेंट। बताइए कोड में क्या समस्या आ रही है?",
            "pa": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ FrontFix AI ਹਾਂ, ਤੁਹਾਡਾ ਤਕਨੀਕੀ ਸਹਾਇਕ। ਦੱਸੋ ਤੁਹਾਡੇ ਕੋਡ ਜਾਂ ਐਪ ਵਿੱਚ ਕੀ ਦਿੱਕਤ ਆ ਰਹੀ ਹੈ?",
            "hinglish": "Hey! Main FrontFix AI hoon, aapka frontend support engineer. Aapke code ya app mein kya issue aa raha hai?",
        }
        return greetings.get(lang, greetings["en"])

    @classmethod
    def get_resolved_acknowledgment(cls, lang: str = "en") -> str:
        acknowledgments = {
            "en": "Great to hear that solved it! 🎉 The issue has been marked resolved. Let me know if you run into any other errors.",
            "hi": "बहुत बढ़िया! यह जानकर खुशी हुई कि समस्या हल हो गई। 🎉 यदि कोई अन्य त्रुटि आए तो अवश्य बताएं।",
            "pa": "ਬਹੁਤ ਵਧੀਆ! ਖੁਸ਼ੀ ਹੋਈ ਕਿ ਤੁਹਾਡਾ ਮਸਲਾ ਹੱਲ ਹੋ ਗਿਆ। 🎉 ਜੇਕਰ ਕੋਈ ਹੋਰ ਦਿੱਕਤ ਆਵੇ ਤਾਂ ਜ਼ਰੂਰ ਦੱਸਣਾ।",
            "hinglish": "Awesome! Khushi hui ki issue solve ho gaya. 🎉 Agar koi aur error aaye toh share kar sakte hain.",
        }
        return acknowledgments.get(lang, acknowledgments["en"])

    @classmethod
    def get_escalation_message(cls, lang: str = "en") -> str:
        messages = {
            "en": "Let's dig deeper. Please share your browser console logs, the component code around the error, or check Network tab responses.",
            "hi": "कोई बात नहीं, इसे और गहराई से देखते हैं। कृपया ब्राउज़र कंसोल का पूरा एरर लॉग या संबंधित कंपोनेंट का कोड यहाँ पेस्ट करें।",
            "pa": "ਕੋਈ ਗੱਲ ਨਹੀਂ, ਆਓ ਇਸਨੂੰ ਹੋਰ ਧਿਆਨ ਨਾਲ ਵੇਖੀਏ। ਕਿਰਪਾ ਕਰਕੇ ਬ੍ਰਾਊਜ਼ਰ ਕੰਸੋਲ ਦਾ ਪੂਰਾ ਐਰਰ ਲੌਗ ਜਾਂ ਕੋਡ ਸਾਂਝਾ ਕਰੋ।",
            "hinglish": "Koi baat nahi, isko aur deeply check karte hain. Please browser console ka exact error log ya component code yahan paste karein.",
        }
        return messages.get(lang, messages["en"])
