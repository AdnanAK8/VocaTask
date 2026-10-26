"""
Match Evaluator & Interactive Question Generator for FrontFix AI
Evaluates candidate knowledge items for reliability and generates targeted follow-up questions with clickable options.
"""

import re
from typing import Dict, Any, List, Optional, Tuple
from .multilingual import MultilingualService
from .state_machine import CaseSummary


class MatchEvaluator:
    """Evaluates whether a candidate knowledge base item is reliable or contradictory."""

    @staticmethod
    def evaluate_match(
        candidate: Dict[str, Any],
        query: str,
        evidence: Dict[str, Any],
        case_summary: Optional[CaseSummary] = None,
    ) -> Dict[str, Any]:
        score = candidate.get("score", 0.0)
        item = candidate.get("item", {})
        item_id = item.get("id", "")
        item_title = item.get("title", "").lower()
        item_category = item.get("category", "").lower()

        detected_framework = (evidence.get("detectedFramework") or "").lower()
        if case_summary and case_summary.framework:
            detected_framework = case_summary.framework.lower()

        # Check for direct contradiction (e.g. Angular query matching React item)
        is_contradictory = False
        reasons = []

        if "react" in item_category or "react" in item_title:
            if detected_framework in ("angular", "vue", "svelte") and "react" not in query.lower():
                is_contradictory = True
                reasons.append(f"Contradictory framework: Expected React, detected {detected_framework}")

        # Check symptom alignment
        trigger_patterns = [p.lower() for p in item.get("trigger_patterns", [])]
        q_lower = query.lower()
        matches_trigger = any(tp in q_lower for tp in trigger_patterns)

        # Confidence rubric
        confidence = "low"
        is_reliable = False

        if not is_contradictory:
            if score >= 35.0 or (score >= 20.0 and matches_trigger):
                confidence = "high"
                is_reliable = True
            elif score >= 14.0 or matches_trigger:
                confidence = "medium"
                is_reliable = True

        return {
            "is_reliable": is_reliable,
            "confidence": confidence,
            "score": round(score, 1),
            "is_contradictory": is_contradictory,
            "reasons": reasons,
        }


class QuestionGenerator:
    """Generates 1 to 3 targeted follow-up questions with clickable quick-select options."""

    @classmethod
    def generate_interactive_followup(
        cls,
        query: str,
        case: CaseSummary,
        evidence: Dict[str, Any],
        lang: str = "en",
    ) -> Dict[str, Any]:
        q_lower = query.lower()

        # Determine missing facet
        # 1. Did the user say the app is crashing / blank / freezing?
        if any(w in q_lower for w in ["crash", "blank", "freeze", "white screen", "broken", "not working", "nhi chal raha", "ruk gaya"]):
            if "symptom" not in case.answered_facets:
                return cls._create_symptom_question(lang)

        # 2. Did they provide an error like .map() or null property without data source?
        if "map" in q_lower or "cannot read" in q_lower or "undefined" in q_lower or "null" in q_lower:
            if "data_source" not in case.answered_facets:
                return cls._create_datasource_question(lang)
            if "reproduction_trigger" not in case.answered_facets:
                return cls._create_timing_question(lang)

        # 3. CSS / Layout issues
        if any(w in q_lower for w in ["css", "style", "align", "center", "flex", "grid", "overflow"]):
            if "css_facet" not in case.answered_facets:
                return cls._create_css_question(lang)

        # 4. General fallback question
        return cls._create_general_question(lang, query)

    @classmethod
    def _create_symptom_question(cls, lang: str) -> Dict[str, Any]:
        if lang == "hi":
            return {
                "facet": "symptom",
                "question": "एप्लिकेशन क्रैश होने पर वास्तव में क्या दिखाई देता है?",
                "options": [
                    "स्क्रीन पूरी तरह से सफेद/ब्लैंक (Blank Page) हो जाती है",
                    "ब्राउज़र कंसोल (F12) में लाल रंग का एरर दिखाई देता है",
                    "पेज फ्रीज हो जाता है और क्लिक काम नहीं करता",
                    "कोई विशेष कंपोनेंट गायब हो जाता है",
                ],
                "explanation": "विशिष्ट लक्षण जानने से हम सही समाधान तक तुरंत पहुँच सकते हैं।",
            }
        elif lang == "pa":
            return {
                "facet": "symptom",
                "question": "ਜਦੋਂ ਐਪ ਕ੍ਰੈਸ਼ ਹੁੰਦੀ ਹੈ ਤਾਂ ਸਕ੍ਰੀਨ 'ਤੇ ਕੀ ਹੁੰਦਾ ਹੈ?",
                "options": [
                    "ਸਕ੍ਰੀਨ ਪੂਰੀ ਤਰ੍ਹਾਂ ਖ਼ਾਲੀ/ਸਫ਼ੈਦ (Blank Screen) ਹੋ ਜਾਂਦੀ ਹੈ",
                    "ਕੰਸੋਲ ਵਿੱਚ ਲਾਲ ਰੰਗ ਦਾ ਐਰਰ ਮੈਸੇਜ ਦਿਖਾਈ ਦਿੰਦਾ ਹੈ",
                    "ਐਪ ਫ੍ਰੀਜ਼ ਹੋ ਜਾਂਦੀ ਹੈ ਤੇ ਕਲਿੱਕ ਨਹੀਂ ਚੱਲਦੇ",
                    "ਕੋਈ ਖ਼ਾਸ ਕੰਪੋਨੈਂਟ ਲੋਡ ਨਹੀਂ ਹੁੰਦਾ",
                ],
                "explanation": "ਸਹੀ ਲੱਛਣ ਜਾਣਨ ਨਾਲ ਸਹੀ ਹੱਲ ਲੱਭਣਾ ਆਸਾਨ ਹੋ ਜਾਂਦਾ ਹੈ।",
            }
        elif lang == "hinglish":
            return {
                "facet": "symptom",
                "question": "Jab app crash hoti hai toh exactly screen pe kya show hota hai?",
                "options": [
                    "Page bilkul blank / white screen ho jata hai",
                    "Console (F12) mein red error message aata hai",
                    "Application freeze ho jati hai, click kaam nahi karta",
                    "Koi specific component render nahi ho raha",
                ],
                "explanation": "Exact symptom janne se root cause jaldi identify ho jata hai.",
            }
        else:
            return {
                "facet": "symptom",
                "question": "What happens when the application crashes?",
                "options": [
                    "The page becomes completely blank (White Screen)",
                    "I see a red error message in the browser console",
                    "The application freezes or stops responding",
                    "A specific component fails to render",
                ],
                "explanation": "Knowing the symptom helps distinguish state crashes from syntax or network failures.",
            }

    @classmethod
    def _create_datasource_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "data_source",
                "question": "जिस डेटा पर .map() या प्रॉपर्टी कॉल हो रही है, वह कहाँ से आ रहा है?",
                "options": [
                    "Backend API / fetch / axios कॉल से आ रहा है",
                    "Local component state (useState) से आ रहा है",
                    "Parent component से Props के रूप में आ रहा है",
                    "Hardcoded static array या JSON फाइल से",
                ],
                "explanation": "API data render se pehle undefined hota hai, isliye source janna zaroori hai.",
            }
        elif lang == "pa":
            return {
                "facet": "data_source",
                "question": "ਜਿਸ ਡੇਟਾ 'ਤੇ .map() ਚੱਲ ਰਿਹਾ ਹੈ, ਉਹ ਕਿੱਥੋਂ ਆ ਰਿਹਾ ਹੈ?",
                "options": [
                    "ਬੈਕਐਂਡ API / fetch / axios ਕਾਲ ਤੋਂ ਆ ਰਿਹਾ ਹੈ",
                    "ਲੋਕਲ ਸਟੇਟ (useState) ਤੋਂ ਆ ਰਿਹਾ ਹੈ",
                    "ਪੇਰੈਂਟ ਕੰਪੋਨੈਂਟ ਤੋਂ Props ਰਾਹੀਂ ਆ ਰਿਹਾ ਹੈ",
                    "ਹਾਰਡਕੋਡਿਡ ਐਰੇ ਜਾਂ JSON ਫ਼ਾਈਲ ਤੋਂ",
                ],
                "explanation": "API ਡੇਟਾ ਲੋਡ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ undefined ਹੋ ਸਕਦਾ ਹੈ।",
            }
        else:
            return {
                "facet": "data_source",
                "question": "Where does the data being mapped or accessed originate from?",
                "options": [
                    "Asynchronous Backend API / fetch / axios call",
                    "Local component state (e.g. useState)",
                    "Passed as Props from a parent component",
                    "Hardcoded local array or static JSON file",
                ],
                "explanation": "Async API responses are undefined during the initial render, requiring defensive guards.",
            }

    @classmethod
    def _create_timing_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "reproduction_trigger",
                "question": "यह एरर कब आता है?",
                "options": [
                    "Page load hote hi turant (Immediately on initial mount)",
                    "Kisi button ya link par click karne ke baad",
                    "Form submit karte waqt",
                    "Filter ya search input type karne par",
                ],
                "explanation": "Timing se pata chalta hai ki problem initial render ki hai ya event handler ki.",
            }
        else:
            return {
                "facet": "reproduction_trigger",
                "question": "When does this error trigger?",
                "options": [
                    "Immediately when the page loads (Initial Mount)",
                    "After clicking a specific button or interactive action",
                    "When submitting a form",
                    "When typing into a search or filter input",
                ],
                "explanation": "Identifies whether the failure happens during initial component mounting or an event handler.",
            }

    @classmethod
    def _create_css_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "css_facet",
                "question": "CSS / Layout mein kis cheez mein dikkat aa rahi hai?",
                "options": [
                    "Element horizontally ya vertically center nahi ho raha",
                    "Element kisi doosre content ke peeche chhip raha hai (z-index issue)",
                    "Text ya card screen se bahar nikal raha hai (overflow issue)",
                    "Mobile screen par layout tut raha hai (Responsive issue)",
                ],
                "explanation": "Har CSS issue ke liye alag flexbox/grid/z-index property use hoti hai.",
            }
        else:
            return {
                "facet": "css_facet",
                "question": "Which specific CSS layout problem are you encountering?",
                "options": [
                    "Div or element refuses to center horizontally or vertically",
                    "Element renders behind other content (z-index stacking issue)",
                    "Text or container causes unwanted horizontal scrolling / overflow",
                    "Layout breaks on mobile viewports (Responsive styling issue)",
                ],
                "explanation": "Different layout bugs require distinct flexbox, grid, or stacking context fixes.",
            }

    @classmethod
    def _create_general_question(cls, lang: str, query: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "general_context",
                "question": "Behtar diagnosis ke liye ek detail share karein:",
                "options": [
                    "Browser Console ka exact red error message paste karein",
                    "Bataiye kaunsa framework use kar rahe hain (React, Vite, Next.js, etc.)",
                    "Component ka code snippet paste karein jahan issue hai",
                ],
                "explanation": "In details se hum exact line of code par fix provide kar sakte hain.",
            }
        else:
            return {
                "facet": "general_context",
                "question": "To give you an exact code fix, please specify:",
                "options": [
                    "Paste the exact red error message or stack trace from F12 Console",
                    "Specify your framework (React 19, Vite, Next.js, or Vanilla JS)",
                    "Share the component code snippet around the issue",
                ],
                "explanation": "Stack traces or code snippets allow us to generate an exact copy-paste code diff.",
            }
