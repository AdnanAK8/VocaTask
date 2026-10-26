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

        # Starter Category 1: API or backend problem
        if any(w in q_lower for w in ["api or backend", "api problem", "backend problem"]) or (
            case.problem_category == "api_backend" and not any(kw in q_lower for kw in ["502", "bad gateway", "proxy", "cors", "404", "500", "syntaxerror", "typeerror"])
        ):
            case.problem_category = "api_backend"
            if "api_symptom" not in case.answered_facets and any(w in q_lower for w in ["api or backend", "api problem", "backend problem", "backend issue"]):
                return cls._create_api_backend_starter_question(lang)

            if any(w in q_lower for w in ["api request is failing", "cannot connect to the backend", "connection is breaking", "failing"]):
                if "api_origin" not in case.answered_facets:
                    return cls._create_api_origin_question(lang)
                if "network_status" not in case.answered_facets:
                    return cls._create_network_502_question(lang)

            if any(w in q_lower for w in ["400", "401", "403", "404", "500 error", "status code"]):
                return cls._create_http_status_question(lang)

            if any(w in q_lower for w in ["cors", "cross-origin", "access-control"]):
                return cls._create_cors_question(lang)

            if any(w in q_lower for w in ["loading", "times out", "timeout", "hanging"]):
                return cls._create_timeout_question(lang)

            if any(w in q_lower for w in ["unexpected data", "unexpected format", "empty response"]):
                return cls._create_unexpected_data_question(lang)

            if any(w in q_lower for w in ["react", "frontend", "postman", "node"]):
                return cls._create_http_status_question(lang)

            return cls._create_api_backend_starter_question(lang)

        # Starter Category 2: Website not working
        if any(w in q_lower for w in ["website not working", "website down", "site not working", "website kaam nahi kar rahi", "website broken"]):
            case.problem_category = "website_down"
            return cls._create_website_status_question(lang)

        # Blank screen / Black screen follow-up -> Timing -> Console check
        if any(w in q_lower for w in ["blank screen", "white screen", "shows a blank screen", "page is blank", "blank", "black screen", "completely black", "screen is black", "is black", "black"]):
            case.problem_category = "website_down"
            if "reproduction_trigger" not in case.answered_facets:
                return cls._create_timing_question(lang)
            if "console_checked" not in case.answered_facets:
                return cls._create_console_check_question(lang)

        # Timing answer follow-up -> Console error check
        if any(w in q_lower for w in ["immediately when i open", "after logging in", "after clicking a button", "after refreshing", "happens randomly"]):
            if "console_checked" not in case.answered_facets:
                return cls._create_console_check_question(lang)

        # Starter Category 3: JavaScript or React error
        if any(w in q_lower for w in ["javascript or react error", "react error", "javascript error", "js error"]):
            case.problem_category = "react_error"
            if "js_error_type" not in case.answered_facets:
                return cls._create_js_react_starter_question(lang)

        # Starter Category 4: Styling or UI issue (Prioritized for CSS assertions)
        if any(w in q_lower for w in ["styling or ui", "css", "style", "align", "center", "flex", "grid", "overflow", "layout"]):
            case.problem_category = "styling_ui"
            if "css_facet" not in case.answered_facets:
                return cls._create_css_question(lang)

        # Starter Category 5: Build or deployment failure
        if any(w in q_lower for w in ["build or deployment", "build failure", "deployment failure", "vite build", "npm run build"]):
            case.problem_category = "build_deploy"
            if "build_facet" not in case.answered_facets:
                return cls._create_build_question(lang)

        # Starter Category 6: Database or connection issue
        if any(w in q_lower for w in ["database or connection", "database error", "postgres", "sqlite", "prisma", "alembic"]):
            case.problem_category = "database"
            if "db_facet" not in case.answered_facets:
                return cls._create_database_question(lang)

        # Starter Category 7: Something else
        if any(w in q_lower for w in ["something else", "other problem", "kuch aur"]):
            case.problem_category = "other"
            return cls._create_something_else_question(lang)

        # Specific: Map / Null / Undefined error details
        if "map" in q_lower or "cannot read" in q_lower or "undefined" in q_lower or "null" in q_lower:
            if "data_source" not in case.answered_facets:
                return cls._create_datasource_question(lang)
            if "reproduction_trigger" not in case.answered_facets:
                return cls._create_timing_question(lang)

        # General crashing / freezing
        if any(w in q_lower for w in ["crash", "blank", "freeze", "broken", "not working", "nhi chal raha", "ruk gaya"]):
            if "symptom" not in case.answered_facets:
                return cls._create_symptom_question(lang)

        # Fallback question
        return cls._create_general_question(lang, query)

    @classmethod
    def _create_api_backend_starter_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "api_symptom",
                "response_type": "follow_up_question",
                "greeting": "Bilkul! Main aapke API ya backend issue ko troubleshoot karne mein madad karunga. Pehle samajhte hain ki kya ho raha hai.",
                "question": "Aapko kya problem aa rahi hai?",
                "options": [
                    "API request fail ho rahi hai.",
                    "Mujhe 400, 401, 403, 404, ya 500 error mil raha hai.",
                    "Frontend backend se connect nahi ho pa raha.",
                    "Mujhe CORS error aa raha hai.",
                    "API unexpected data return kar rahi hai.",
                    "Request continuously load ho rahi hai ya timeout ho rahi hai.",
                    "Kuch aur problem hai.",
                    "Mujhe nahi pata.",
                ],
                "explanation": "Problem category specify karne se correct network ya server layer troubleshoot hoti hai.",
            }
        elif lang == "pa":
            return {
                "facet": "api_symptom",
                "response_type": "follow_up_question",
                "greeting": "ਬਿਲਕੁਲ! ਮੈਂ ਤੁਹਾਡੀ API ਜਾਂ ਬੈਕਐਂਡ ਸਮੱਸਿਆ ਦਾ ਹੱਲ ਲੱਭਣ ਵਿੱਚ ਮਦਦ ਕਰਾਂਗਾ। ਪਹਿਲਾਂ ਸਮਝਦੇ ਹਾਂ ਕਿ ਕੀ ਹੋ ਰਿਹਾ ਹੈ।",
                "question": "ਤੁਹਾਨੂੰ ਕੀ ਸਮੱਸਿਆ ਆ ਰਹੀ ਹੈ?",
                "options": [
                    "API ਰਿਕਵੈਸਟ ਫੇਲ ਹੋ ਰਹੀ ਹੈ।",
                    "ਮੈਨੂੰ 400, 401, 403, 404, ਜਾਂ 500 ਐਰਰ ਆ ਰਿਹਾ ਹੈ।",
                    "ਫਰੰਟਐਂਡ ਬੈਕਐਂਡ ਨਾਲ ਕਨੈਕਟ ਨਹੀਂ ਹੋ ਪਾ ਰਿਹਾ।",
                    "ਮੈਨੂੰ CORS ਐਰਰ ਆ ਰਿਹਾ ਹੈ।",
                    "API ਅਣਕਿਆਸਿਆ ਡਾਟਾ ਵਾਪਸ ਕਰ ਰਹੀ ਹੈ।",
                    "ਰਿਕਵੈਸਟ ਲੋਡ ਹੁੰਦੀ ਰਹਿੰਦੀ ਹੈ ਜਾਂ ਟਾਈਮਆਊਟ ਹੋ ਜਾਂਦੀ ਹੈ।",
                    "ਕੋਈ ਹੋਰ ਸਮੱਸਿਆ ਹੈ।",
                    "ਮੈਨੂੰ ਨਹੀਂ ਪਤਾ।",
                ],
                "explanation": "ਸਹੀ ਸਮੱਸਿਆ ਦੱਸਣ ਨਾਲ ਸਹੀ ਹੱਲ ਜਲਦੀ ਲੱਭਿਆ ਜਾ ਸਕਦਾ ਹੈ।",
            }
        else:
            return {
                "facet": "api_symptom",
                "response_type": "follow_up_question",
                "greeting": "Sure! I'll help you troubleshoot your API or backend issue. Let's understand what's happening first.",
                "question": "What problem are you experiencing?",
                "options": [
                    "API request is failing.",
                    "I'm getting a 400, 401, 403, 404, or 500 error.",
                    "My frontend cannot connect to the backend.",
                    "I'm getting a CORS error.",
                    "The API returns unexpected data.",
                    "The request keeps loading or times out.",
                    "Something else.",
                    "I'm not sure.",
                ],
                "explanation": "Narrowing down the network symptom isolates whether the failure is in frontend fetching, proxy routing, or backend execution.",
            }

    @classmethod
    def _create_api_origin_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "api_origin",
                "response_type": "follow_up_question",
                "greeting": "Samajh gaya. Chaliye dekhte hain request kahan se originate ho rahi hai.",
                "question": "Aap API request kahan se call kar rahe hain?",
                "options": [
                    "React ya kisi doosre frontend app se (fetch / axios)",
                    "Next.js API route ya Server Action se",
                    "Postman ya cURL se chal raha hai, lekin browser mein fail ho raha hai",
                    "FastAPI ya Python backend service se",
                    "Mujhe nahi pata",
                ],
                "explanation": "Client-side browser requests par CORS aur proxy rules lagu hote hain, jabki server-side requests direct hoti hain.",
            }
        else:
            return {
                "facet": "api_origin",
                "response_type": "follow_up_question",
                "greeting": "Understood. Let's find out where the request is originating from.",
                "question": "Where are you making the API request from?",
                "options": [
                    "React or another frontend application (fetch / axios)",
                    "Next.js API route or Server Action",
                    "Postman or cURL works, but frontend browser fails",
                    "FastAPI or Python backend service",
                    "I'm not sure",
                ],
                "explanation": "Browser client requests are subject to CORS and Vite proxy rules, whereas server-to-server calls connect directly.",
            }

    @classmethod
    def _create_http_status_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "http_status_code",
                "response_type": "request_error_details",
                "greeting": "Got it. Status code se exact failure point pata chalta hai.",
                "question": "DevTools Network tab mein API kaunsa status code return kar rahi hai?",
                "options": [
                    "400 Bad Request (invalid JSON body ya parameters)",
                    "401 Unauthorized ya 403 Forbidden (missing token / auth)",
                    "404 Not Found (endpoint URL path galat hai)",
                    "500 Internal Server Error (backend crash)",
                    "502 Bad Gateway / 504 Gateway Timeout (backend offline)",
                    "Mujhe nahi pata Network tab kaise check karein",
                ],
                "explanation": "4xx status codes request syntax ya auth issues indicate karte hain, 5xx server failures ko.",
            }
        else:
            return {
                "facet": "http_status_code",
                "response_type": "request_error_details",
                "greeting": "Got it. The HTTP status code directly identifies the point of failure.",
                "question": "Which HTTP status code is the API returning in DevTools Network tab?",
                "options": [
                    "400 Bad Request (invalid JSON payload or parameters)",
                    "401 Unauthorized or 403 Forbidden (missing token or credentials)",
                    "404 Not Found (endpoint route URL is incorrect)",
                    "500 Internal Server Error (exception thrown inside backend)",
                    "502 Bad Gateway / 504 Gateway Timeout (backend offline or unreachable)",
                    "I don't know how to check the Network tab",
                ],
                "explanation": "4xx status codes point to payload or authorization errors, while 5xx codes indicate server crashes.",
            }

    @classmethod
    def _create_cors_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "cors_domain",
                "response_type": "follow_up_question",
                "greeting": "CORS error tab aata hai jab browser cross-origin requests ko restrict karta hai.",
                "question": "Kya aap alag domain ya port par run ho rahi API ko call kar rahe hain?",
                "options": [
                    "Haan, frontend port 5173 par hai aur backend port 8000 par",
                    "Haan, browser se external third-party API call kar rahe hain",
                    "Nahi, frontend aur backend same domain / port share karte hain",
                    "Mujhe nahi pata",
                ],
                "explanation": "Port mismatch hone par FastAPI CORSMiddleware ya Vite proxy configure karna hota hai.",
            }
        else:
            return {
                "facet": "cors_domain",
                "response_type": "follow_up_question",
                "greeting": "CORS errors occur when the browser blocks network requests between different origins for security.",
                "question": "Are you calling an API hosted on a different port or domain?",
                "options": [
                    "Yes, frontend is on port 5173 and FastAPI backend is on port 8000",
                    "Yes, calling an external third-party API from the browser",
                    "No, frontend and backend share the same domain and port",
                    "I'm not sure",
                ],
                "explanation": "Different ports (e.g. 5173 and 8000) count as different origins requiring CORSMiddleware or a proxy.",
            }

    @classmethod
    def _create_timeout_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "backend_process_status",
                "response_type": "follow_up_question",
                "greeting": "Request hang hona aam taur par backend server ke band hone ya port na milne ki wajah se hota hai.",
                "question": "Kya aapka backend server aapki machine par chal raha hai?",
                "options": [
                    "Haan, backend http://127.0.0.1:8000 par running hai",
                    "Nahi, backend server start nahi kiya ya stop ho gaya",
                    "Request 30+ seconds tak load hoti rehti hai fir fail hoti hai",
                    "Mujhe nahi pata kaise check karein",
                ],
                "explanation": "Backend uvicorn process verify karne se timeout issues turant pakad mein aate hain.",
            }
        else:
            return {
                "facet": "backend_process_status",
                "response_type": "follow_up_question",
                "greeting": "A hanging request usually means the backend server is offline or not responding on the configured port.",
                "question": "Is your backend server currently running on your machine?",
                "options": [
                    "Yes, backend is running on http://127.0.0.1:8000",
                    "No, backend server is not running or stopped",
                    "Request loads for 30+ seconds then times out",
                    "I don't know how to check",
                ],
                "explanation": "Verifying the uvicorn backend process ensures the proxy has an active target.",
            }

    @classmethod
    def _create_unexpected_data_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "payload_format",
                "response_type": "follow_up_question",
                "greeting": "Chaliye API response format aur aapke code ki expectations ko compare karte hain.",
                "question": "API ka response kaisa dikhta hai?",
                "options": [
                    "Array [] expect kiya tha, lekin null ya object mila",
                    "Response empty / undefined aa raha hai",
                    "Data { data: [...] } ya { result: ... } mein wrap hai",
                    "Main console log ya response JSON chat mein paste karta hoon",
                ],
                "explanation": "Response schema mismatch hone se .map() ya object destructuring crash ho jati hai.",
            }
        else:
            return {
                "facet": "payload_format",
                "response_type": "follow_up_question",
                "greeting": "Let's compare the data format you received with what your code expects.",
                "question": "What does the response look like compared to what your code expects?",
                "options": [
                    "Expected an array [], but received null or an object",
                    "Response payload is empty or undefined",
                    "Data is wrapped inside { data: [...] } or { result: ... }",
                    "I will paste the response JSON or console log below",
                ],
                "explanation": "Response schema mismatches are the leading cause of '.map is not a function' crashes.",
            }

    @classmethod
    def _create_js_react_starter_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "js_error_type",
                "response_type": "follow_up_question",
                "greeting": "Samajh gaya! Chaliye is JavaScript ya React error ko track karke fix karte hain.",
                "question": "Aapko kis tarah ka error dikh raha hai?",
                "options": [
                    "TypeError: Cannot read properties of undefined (reading 'map')",
                    "React Hook error (Invalid hook call, too many re-renders)",
                    "Component crash ho gaya ya render nahi ho raha",
                    "State ya prop update nahi ho raha",
                    "Hydration ya SSR mismatch error",
                    "Browser console (F12) mein red error text hai",
                    "Kuch aur problem hai",
                    "Mujhe nahi pata",
                ],
                "explanation": "Exact runtime error identify karne se targeted component pattern apply hota hai.",
            }
        else:
            return {
                "facet": "js_error_type",
                "response_type": "follow_up_question",
                "greeting": "Got it! Let's track down and fix this JavaScript or React error.",
                "question": "What kind of error are you seeing?",
                "options": [
                    "TypeError: Cannot read properties of undefined (reading 'map')",
                    "React Hook error (e.g. Invalid hook call, too many re-renders)",
                    "Component crashed or fails to render",
                    "State or prop is not updating",
                    "Hydration or SSR mismatch error",
                    "Red error in browser console (F12)",
                    "Something else",
                    "I'm not sure",
                ],
                "explanation": "Pinpointing the runtime exception isolates whether state initialization, hook lifecycles, or prop passing failed.",
            }

    @classmethod
    def _create_something_else_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "other_facet",
                "response_type": "follow_up_question",
                "greeting": "Koi baat nahi! Mujhe thoda detail mein bataiye kya problem aa rahi hai.",
                "question": "Aapki problem ko sabse behtar kya describe karta hai?",
                "options": [
                    "Code crash ho raha hai aur error message aa raha hai",
                    "Kuch visually ya behavior-wise unexpected lag raha hai",
                    "Mujhe setup ya configuration mein help chahiye",
                    "Performance ya memory issue hai",
                    "Mujhe samajh nahi aa raha kahan se start karun",
                ],
                "explanation": "Aap error message ya code snippet chat mein seedhe paste kar sakte hain.",
            }
        else:
            return {
                "facet": "other_facet",
                "response_type": "follow_up_question",
                "greeting": "No problem! Tell me a bit about what's going wrong.",
                "question": "How would you describe the problem you're trying to solve?",
                "options": [
                    "My code crashes with an error message",
                    "Something looks or behaves unexpectedly",
                    "I need help setting up or configuring something",
                    "Performance or memory issue",
                    "I don't know where to start",
                ],
                "explanation": "You can paste error logs or code snippets directly into the chat at any time.",
            }

    @classmethod
    def _create_website_status_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "symptom",
                "response_type": "follow_up_question",
                "greeting": "Bilkul! Main aapki website troubleshoot karne mein madad karunga. Pehle batayein kya dekh rahe hain.",
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
                "response_type": "follow_up_question",
                "greeting": "ਬਿਲਕੁਲ! ਮੈਂ ਤੁਹਾਡੀ ਵੈੱਬਸਾਈਟ ਦੀ ਸਮੱਸਿਆ ਹੱਲ ਕਰਨ ਵਿੱਚ ਮਦਦ ਕਰਾਂਗਾ।",
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
                "response_type": "follow_up_question",
                "greeting": "Sure! I'll help you find out why your website isn't working. Let's start with what you're seeing.",
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
                "response_type": "request_error_details",
                "greeting": "Browser console client-side runtime errors capture karti hai.",
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
                "response_type": "request_error_details",
                "greeting": "Checking the console reveals whether an unhandled JavaScript exception broke rendering.",
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
                "response_type": "follow_up_question",
                "greeting": "Browser Console check karne ke 3 simple steps:",
                "question": "1. Keyboard par F12 dabayein (ya right-click karke 'Inspect' chunein).\n2. Upar 'Console' ya 'Network' tab par click karein.\n3. Koi red text ya status code dikh raha hai?\n\nAapko wahan kya dikh raha hai?",
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
                "response_type": "follow_up_question",
                "greeting": "Here is how to check your browser developer tools in 3 simple steps:",
                "question": "1. Press F12 (or right-click anywhere on the page and select 'Inspect').\n2. Click on the 'Console' or 'Network' tab at the top.\n3. Look for any red text or status codes (like 502, 404, or 500).\n\nWhat do you see there?",
                "options": [
                    "I found red error text in the Console (I will paste it below)",
                    "Network tab shows a 502, 404, or 500 error",
                    "Console and Network tabs are clean (no red errors)",
                    "I will paste the error message or code below",
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
                "response_type": "follow_up_question",
                "greeting": "Main troubleshoot karne mein madad karunga. Pehle samajhte hain ki kya ho raha hai.",
                "question": "Jab screen blank ya crash hoti hai toh exactly kya show hota hai?",
                "options": [
                    "Page bilkul blank / white screen ho jata hai",
                    "Console (F12) mein red error message aata hai",
                    "Application freeze ho jati hai, click kaam nahi karta",
                    "Koi specific component render nahi ho raha",
                    "Kuch aur hota hai",
                ],
                "explanation": "Exact symptom janne se root cause jaldi identify ho jata hai.",
            }
        else:
            return {
                "facet": "symptom",
                "response_type": "follow_up_question",
                "greeting": "I can help you troubleshoot this. What happens when the application crashes or goes blank?",
                "question": "What happens when your application crashes or goes blank?",
                "options": [
                    "The page becomes completely blank (White / Black Screen)",
                    "I see a red error message in the browser console (F12)",
                    "The application freezes or stops responding",
                    "A specific component fails to render",
                    "Something else happens",
                ],
                "explanation": "Knowing the symptom helps distinguish state crashes from syntax or network failures.",
            }

    @classmethod
    def _create_datasource_question(cls, lang: str) -> Dict[str, Any]:
        if lang in ("hi", "hinglish"):
            return {
                "facet": "data_source",
                "response_type": "follow_up_question",
                "greeting": "A few details will help me identify the correct fix for your data structure.",
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
                "response_type": "follow_up_question",
                "greeting": "A few details will help me identify the correct fix for your data structure.",
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
                "response_type": "follow_up_question",
                "greeting": "Samajh gaya. Chaliye dekhte hain screen blank ya black kyun ho rahi hai.",
                "question": "Yeh problem kab aati hai?",
                "options": [
                    "Page load hote hi turant (Immediately on initial mount)",
                    "Kisi button ya link par click karne ke baad",
                    "Form submit karte waqt ya login karne ke baad",
                    "Page refresh karne ke baad",
                    "It happens randomly",
                ],
                "explanation": "Timing se pata chalta hai ki problem initial render ki hai ya event handler ki.",
            }
        else:
            return {
                "facet": "reproduction_trigger",
                "response_type": "follow_up_question",
                "greeting": "I see. Let's find out why the screen is going blank or black. A few quick questions will help isolate the cause.",
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
                "response_type": "follow_up_question",
                "greeting": "Main aapki CSS layout problem fix karne mein madad karunga. Pehle issue identify karte hain.",
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
                "response_type": "follow_up_question",
                "greeting": "I'll help you fix your layout and styling problem. Let's narrow down the issue.",
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
                "response_type": "follow_up_question",
                "greeting": "Chaliye build ya deployment error ko solve karte hain.",
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
                "response_type": "follow_up_question",
                "greeting": "Let's get your build or deployment passing. What stage is failing?",
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
                "response_type": "follow_up_question",
                "greeting": "Main aapke database aur connection issue ko troubleshoot karunga.",
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
                "response_type": "follow_up_question",
                "greeting": "I'll help you troubleshoot your database and data connection. Let's identify the issue.",
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
