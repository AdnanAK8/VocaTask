"""
FrontFix AI Evaluator & Targeted Follow-Up Question Generator
Evaluates retrieved knowledge matches and generates guided step-by-step
troubleshooting questions (Airtel/Amazon support style) with clickable options,
beginner DevTools guidance, and multilingual support.
"""

from typing import Dict, Any, List, Optional
import re
from .state_machine import CaseSummary


class MatchEvaluator:
    """Evaluates whether a retrieved knowledge base item reliably matches user evidence."""

    CONFIDENCE_HIGH_THRESHOLD = 35.0
    CONFIDENCE_MED_THRESHOLD = 20.0

    @classmethod
    def evaluate_match(
        cls,
        top_match: Dict[str, Any],
        query: str,
        evidence: Dict[str, Any],
        case: Optional[CaseSummary] = None,
    ) -> Dict[str, Any]:
        """
        Calculates confidence and flags contradictions.
        Criteria:
        1. Retrieval score from TF-IDF
        2. Technology/Framework alignment
        3. Contradiction checks (e.g., claiming backend issue for pure CSS question)
        """
        score = float(top_match.get("score", 0.0))
        item = top_match.get("item", {})
        item_category = item.get("category", "").lower()
        q_lower = query.lower()

        reasons = []
        is_contradictory = False

        # Framework check
        detected_fw = evidence.get("detectedFramework")
        if detected_fw and detected_fw.lower() not in item.get("problem", "").lower() and "react" in item_category:
            if detected_fw.lower() in ["vue", "angular", "svelte"]:
                is_contradictory = True
                reasons.append(f"Retrieved React solution contradicts user's detected framework: {detected_fw}")

        # Check for CSS vs Runtime contradiction
        if any(w in q_lower for w in ["css", "flex", "align", "color", "overflow", "margin", "padding"]):
            if "runtime" in item_category or "api" in item_category or "async" in item_category:
                is_contradictory = True
                reasons.append("Retrieved runtime/API solution contradicts CSS layout question")

        is_reliable = False
        confidence = "low"

        if not is_contradictory:
            if score >= cls.CONFIDENCE_HIGH_THRESHOLD:
                confidence = "high"
                is_reliable = True
            elif score >= cls.CONFIDENCE_MED_THRESHOLD:
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
    """Generates friendly step-by-step follow-up questions with clickable quick-select options."""

    @classmethod
    def generate_interactive_followup(
        cls,
        query: str,
        case: CaseSummary,
        evidence: Dict[str, Any],
        lang: str = "en",
    ) -> Dict[str, Any]:
        q_lower = query.lower().strip()

        # Check if user asked how to check developer tools
        if any(w in q_lower for w in ["i don't know how to check", "dont know how to check", "kaise check karein", "how to check"]):
            return cls._create_devtools_guidance(lang)

        # Flow A1: Website not working (Starter Category)
        if any(w in q_lower for w in ["website not working", "website down", "site not working", "website kaam nahi kar rahi"]):
            case.problem_category = "website_down"
            return cls._create_website_status_question(lang)

        # Flow A2: Blank screen follow-up -> Timing
        if any(w in q_lower for w in ["blank screen", "white screen", "shows a blank screen", "page is blank"]):
            if "reproduction_trigger" not in case.answered_facets:
                return cls._create_timing_question(lang)
            if "console_checked" not in case.answered_facets:
                return cls._create_console_check_question(lang)

        # Flow A3: Timing answer follow-up -> Console error check
        if any(w in q_lower for w in ["immediately when i open", "after logging in", "after clicking a button", "after refreshing", "happens randomly"]):
            if "console_checked" not in case.answered_facets:
                return cls._create_console_check_question(lang)

        # Flow B: API / Backend problem
        if any(w in q_lower for w in ["api or backend", "api issue", "backend problem", "502", "bad gateway", "proxy", "econnrefused", "connect econ", "503", "504", "failed to fetch"]):
            case.problem_category = "api_backend"
            if "network_status" not in case.answered_facets:
                return cls._create_network_502_question(lang)

        # Flow C: Styling / UI issue
        if any(w in q_lower for w in ["styling or ui", "css", "style", "align", "center", "flex", "grid", "overflow", "layout"]):
            case.problem_category = "styling_ui"
            if "css_facet" not in case.answered_facets:
                return cls._create_css_question(lang)

        # Flow D: Build / Deployment failure
        if any(w in q_lower for w in ["build or deployment", "build failure", "deployment failure", "vite build", "npm run build"]):
            case.problem_category = "build_deploy"
            if "build_facet" not in case.answered_facets:
                return cls._create_build_question(lang)

        # Flow E: Database / connection issue
        if any(w in q_lower for w in ["database or connection", "database error", "postgres", "sqlite", "prisma", "alembic"]):
            case.problem_category = "database"
            if "db_facet" not in case.answered_facets:
                return cls._create_database_question(lang)

        # Flow F: Map / Null / Undefined error details
        if "map" in q_lower or "cannot read" in q_lower or "undefined" in q_lower or "null" in q_lower:
            if "data_source" not in case.answered_facets:
                return cls._create_datasource_question(lang)
            if "reproduction_trigger" not in case.answered_facets:
                return cls._create_timing_question(lang)

        # Flow G: General crashing / freezing
        if any(w in q_lower for w in ["crash", "blank", "freeze", "broken", "not working", "nhi chal raha", "ruk gaya"]):
            if "symptom" not in case.answered_facets:
                return cls._create_symptom_question(lang)

        # Fallback question
        return cls._create_general_question(lang, query)

    @classmethod
    def _create_website_status_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "symptom",
                "question": "Website open karne par exactly kya problem aa rahi hai?",
                "options": [
                    "Website par poori blank screen aati hai",
                    "Website bahut slow load ho rahi hai",
                    "Screen par red error message dikhta hai",
                    "Kuch buttons ya features kaam nahi kar rahe",
                    "Website bilkul open nahi ho rahi (Server down)",
                    "Kuch aur problem hai",
                ],
                "explanation": "Exact symptom janne se root cause identify karne mein madad milti hai.",
            }
        elif lang == "pa":
            return {
                "facet": "symptom",
                "question": "ਵੈੱਬਸਾਈਟ ਖੋਲ੍ਹਣ 'ਤੇ ਅਸਲ ਵਿੱਚ ਕੀ ਸਮੱਸਿਆ ਆ ਰਹੀ ਹੈ?",
                "options": [
                    "ਵੈੱਬਸਾਈਟ 'ਤੇ ਖ਼ਾਲੀ/ਸਫ਼ੈਦ ਸਕ੍ਰੀਨ (Blank Screen) ਆਉਂਦੀ ਹੈ",
                    "ਵੈੱਬਸਾਈਟ ਬਹੁਤ ਹੌਲੀ ਲੋਡ ਹੋ ਰਹੀ ਹੈ",
                    "ਸਕ੍ਰੀਨ 'ਤੇ ਐਰਰ ਮੈਸੇਜ ਦਿਖਾਈ ਦਿੰਦਾ ਹੈ",
                    "ਕੁਝ ਬਟਨ ਜਾਂ ਫੀਚਰ ਕੰਮ ਨਹੀਂ ਕਰ ਰਹੇ",
                    "ਵੈੱਬਸਾਈਟ ਬਿਲਕੁਲ ਨਹੀਂ ਖੁੱਲ੍ਹ ਰਹੀ",
                    "ਕੋਈ ਹੋਰ ਸਮੱਸਿਆ ਹੈ",
                ],
                "explanation": "ਸਹੀ ਲੱਛਣ ਦੱਸਣ ਨਾਲ ਸਹੀ ਹੱਲ ਜਲਦੀ ਲੱਭਿਆ ਜਾ ਸਕਦਾ ਹੈ।",
            }
        else:
            return {
                "facet": "symptom",
                "question": "What exactly is happening with your website?",
                "options": [
                    "The website shows a blank screen",
                    "The website is loading very slowly",
                    "I see an error message on screen",
                    "Some buttons or features are not working",
                    "The website is completely unavailable (Network/Server down)",
                    "Something else",
                ],
                "explanation": "Pinpointing the symptom helps separate network, rendering, and logic errors.",
            }

    @classmethod
    def _create_console_check_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "console_checked",
                "question": "Kya browser console (F12) mein koi red error message dikh raha hai?",
                "options": [
                    "Haan, console mein red error message hai (paste karein)",
                    "Nahi, console bilkul clear hai / koi error nahi",
                    "Mujhe nahi pata console kaise check karein",
                ],
                "explanation": "Browser console client-side runtime errors ko capture karta hai.",
            }
        else:
            return {
                "facet": "console_checked",
                "question": "Can you see any errors in your browser console?",
                "options": [
                    "Yes, I see an error message",
                    "No errors are visible",
                    "I don't know how to check",
                ],
                "explanation": "Browser console logs reveal uncaught exceptions and broken component trees.",
            }

    @classmethod
    def _create_devtools_guidance(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "devtools_guide",
                "question": "Browser Console check karne ke 3 simple steps:\n1. Keyboard par F12 dabayein (ya right-click karke 'Inspect' chunein).\n2. Upar 'Console' tab par click karein.\n3. Koi red text ya uncaught error dikh raha hai?\n\nAapko wahan kya dikh raha hai?",
                "options": [
                    "Mujhe red error mila hai (main paste karta hoon)",
                    "Console bilkul clean hai / koi red error nahi",
                    "Network tab mein 404 ya 500 error dikh raha hai",
                ],
                "explanation": "F12 Console developer tools ka primary error log hota hai.",
            }
        else:
            return {
                "facet": "devtools_guide",
                "question": "Here is how to check your browser console in 3 simple steps:\n1. Press F12 (or right-click anywhere on the page and select 'Inspect').\n2. Click on the 'Console' tab at the top of the developer panel.\n3. Look for any red text or uncaught exceptions.\n\nWhat do you see there?",
                "options": [
                    "I found red error text (I will paste it below)",
                    "No red errors visible in console",
                    "I see a 404 or 500 error in the Network tab",
                ],
                "explanation": "Inspecting the console is the fastest way to pinpoint frontend crashes.",
            }

    @classmethod
    def _create_network_502_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "network_status",
                "question": "API / Backend connection mein kya problem aa rahi hai?",
                "options": [
                    "Backend server port 8000 par start nahi hai (ECONNREFUSED)",
                    "502 Bad Gateway / Vite proxy error",
                    "CORS policy blocked (Access-Control-Allow-Origin)",
                    "404 Not Found (API URL path galat hai)",
                    "500 Internal Server Error backend se aa raha hai",
                ],
                "explanation": "Backend server connection verify karke proxy issue solve ho jata hai.",
            }
        else:
            return {
                "facet": "network_status",
                "question": "Which of the following describes your API or backend problem?",
                "options": [
                    "Backend server is not running (uvicorn port 8000 offline)",
                    "502 Bad Gateway / Vite proxy connect ECONNREFUSED",
                    "CORS policy blocked: No 'Access-Control-Allow-Origin' header",
                    "404 Not Found on API endpoint route",
                    "500 Internal Server Error returned by backend API",
                ],
                "explanation": "Checking server processes and proxy configurations isolates routing from server crashes.",
            }

    @classmethod
    def _create_symptom_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "symptom",
                "question": "Jab screen blank ya crash hoti hai toh exactly kya show hota hai?",
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
                "question": "What happens when your application crashes or goes blank?",
                "options": [
                    "The page becomes completely blank (White Screen)",
                    "I see a red error message in the browser console (F12)",
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
                    "It happens randomly",
                ],
                "explanation": "Timing se pata chalta hai ki problem initial render ki hai ya event handler ki.",
            }
        else:
            return {
                "facet": "reproduction_trigger",
                "question": "When does this problem occur?",
                "options": [
                    "Immediately when I open the website (Initial Mount)",
                    "After clicking a button or link",
                    "After submitting a form or logging in",
                    "After refreshing the page",
                    "It happens randomly",
                ],
                "explanation": "Identifies whether the failure happens during initial mounting or an event handler.",
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
                "question": "You mentioned CSS — is this about element centering, z-index stacking, flexbox overflow, or mobile viewport jumping?",
                "options": [
                    "Div or element refuses to center horizontally or vertically",
                    "Element renders behind other content (z-index stacking issue)",
                    "Text or container causes unwanted horizontal scrolling / overflow",
                    "Layout breaks on mobile viewports (Responsive styling issue)",
                ],
                "explanation": "Different layout bugs require distinct flexbox, grid, or stacking context fixes.",
            }

    @classmethod
    def _create_build_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "build_facet",
                "question": "Build ya deployment mein kya dikkat aa rahi hai?",
                "options": [
                    "Vite / Next.js build command fail ho rahi hai (npm run build)",
                    "Module not found: Dependency install nahi hai",
                    "TypeScript type check error (tsc -b)",
                    "Vercel / Render / Docker par deploy fail ho raha hai",
                ],
                "explanation": "Build errors syntax, dependencies ya bundler configuration se related hote hain.",
            }
        else:
            return {
                "facet": "build_facet",
                "question": "What is failing in your build or deployment?",
                "options": [
                    "Vite / Next.js build failed (npm run build)",
                    "Module not found: Cannot resolve package or dependency",
                    "TypeScript compilation error (tsc -b)",
                    "Deployment container failed on Vercel / Render / Docker",
                ],
                "explanation": "Build failures typically stem from missing packages, type errors, or bundle configs.",
            }

    @classmethod
    def _create_database_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "db_facet",
                "question": "Database ya connection mein kya dikkat hai?",
                "options": [
                    "PostgreSQL connection refused / password authentication failed",
                    "Database migration error (Alembic / Prisma)",
                    "SQLite / local database locked ya missing hai",
                    "Query timeout ya connection pool full ho gaya hai",
                ],
                "explanation": "Database errors credentials, network binding ya schema migrations se hote hain.",
            }
        else:
            return {
                "facet": "db_facet",
                "question": "What issue are you experiencing with your database?",
                "options": [
                    "PostgreSQL connection refused / authentication failed",
                    "Database migration error (Alembic / Prisma)",
                    "SQLite / local database locked or missing",
                    "Query timeout or database connection pool exhausted",
                ],
                "explanation": "Database issues usually stem from credentials, service status, or schema locks.",
            }

    @classmethod
    def _create_general_question(cls, lang: str, query: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "general_context",
                "question": "Behtar diagnosis ke liye ek detail share karein:",
                "options": [
                    "Browser Console (F12) ka exact red error message paste karein",
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
