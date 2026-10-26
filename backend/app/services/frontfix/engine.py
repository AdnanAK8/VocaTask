import re
from pathlib import Path
from .retriever import KnowledgeRetriever
from .sanitizer import SanitizerService
from .history import HistoryService
from .llm import LLMService
from .evidence import EvidenceService
from .state_machine import DiagnosticState, CaseSummary, DiagnosticStateMachine
from .multilingual import MultilingualService
from .evaluator import MatchEvaluator, QuestionGenerator


class DiagnosticEngine:
    MIN_MATCH_SCORE = 12.0

    VAGUE_QUERIES = {
        "help",
        "error",
        "broken",
        "it is broken",
        "not working",
        "page is blank",
        "blank page",
        "page blank",
        "white screen",
        "css broken",
        "fix this",
        "why is this failing",
        "it doesn't work",
        "something is wrong",
        "bug in code",
        "failed",
        "crash",
        "stuck",
        "blank",
        "site down",
        "please help",
        "it broke",
        "code broken",
        "frontend error",
        "bug",
        "frontend bug",
        "mera app crash ho raha hai",
        "page blank ho gaya",
        "kuch kaam nahi kar raha",
        "app crash ho rahi hai",
        "my screen is blank",
        "screen is blank",
        "my screen is blank.",
        "screen is blank.",
        "my screen is showing error 502",
        "error 502",
        "502",
        "502 bad gateway",
        "bad gateway",
        "proxy error",
        "website not working",
        "website down",
        "site not working",
        "javascript or react error",
        "react error",
        "javascript error",
        "api or backend problem",
        "api problem",
        "backend problem",
        "styling or ui issue",
        "styling issue",
        "ui issue",
        "build or deployment failure",
        "build failure",
        "deployment failure",
        "database or connection issue",
        "database issue",
        "connection issue",
        "something else",
        "i don't know how to check",
        "dont know how to check",
        "the website shows a blank screen",
        "the website is loading very slowly",
        "i see an error message",
        "some buttons or features are not working",
        "the website is completely unavailable",
        "immediately when i open the website",
        "after logging in",
        "after clicking a button",
        "after refreshing the page",
        "it happens randomly",
        "yes, i see an error",
        "no errors are visible",
        "api request is failing",
        "api request is failing.",
        "my frontend cannot connect to the backend",
        "my frontend cannot connect to the backend.",
        "i'm getting a 400, 401, 403, 404, or 500 error",
        "i'm getting a 400, 401, 403, 404, or 500 error.",
        "i'm getting a cors error",
        "i'm getting a cors error.",
        "the api returns unexpected data",
        "the api returns unexpected data.",
        "the request keeps loading or times out",
        "the request keeps loading or times out.",
        "i'm not sure",
        "i'm not sure.",
        "react or another frontend application",
        "react or another frontend application (fetch / axios)",
        "node.js, express, or backend service",
        "fastapi or python backend",
        "postman or curl works, but frontend fails",
        "the website shows a blank screen.",
        "the website is loading very slowly.",
        "i see an error message on screen.",
        "some buttons or features are not working.",
        "the website is completely unavailable (network/server down).",
        "div or element refuses to center horizontally or vertically",
        "element renders behind other content (z-index stacking issue)",
        "text or container causes unwanted horizontal scrolling / overflow",
        "layout breaks on mobile viewports (responsive styling issue)",
        "styles / css classes are not applying or being overridden",
    }

    def __init__(self, options: dict | None = None):
        opts = options or {}
        knowledge_path = opts.get("knowledgePath")
        llm_config = opts.get("llmConfig")
        self.retriever = KnowledgeRetriever(knowledge_path)
        self.llm_service = LLMService(llm_config)
        self.knowledge_base = self.retriever.get_all()

    @property
    def knowledgeBase(self):
        return self.knowledge_base

    @property
    def llmService(self):
        return self.llm_service

    def is_insufficient_query(self, query: str) -> bool:
        if not query or not isinstance(query, str):
            return True
        trimmed = query.strip().lower()
        cleaned_simple = re.sub(r"[^a-z0-9\s]", "", trimmed).strip()

        if cleaned_simple in self.VAGUE_QUERIES or trimmed in self.VAGUE_QUERIES:
            return True

        vague_phrases = [
            "app crash", "app is crash", "application is crash", "app crashing", "crashing",
            "page is blank", "blank screen", "screen is blank", "screen blank", "white screen",
            "black screen", "completely black", "screen is black", "page is black",
            "not working", "doesn't work", "kuch kaam nahi", "chal nahi raha", "ruk gaya",
            "crash ho raha", "crash ho rahi", "502", "error 502", "bad gateway", "proxy error",
            "request is failing", "api request", "cannot connect", "keeps loading", "times out",
            "unexpected data", "failing", "not sure", "other problem", "something else",
            "backend service", "postman", "what happened", "what to do", "website open",
            "opened my website", "opened website", "nothing happens", "stopped working",
            "freezing", "app freezes", "screen freezes", "page hangs", "app hangs"
        ]
        has_specific_error = any(kw in trimmed for kw in [
            "typeerror", "referenceerror", "syntaxerror", "uncaught", "cors",
            "nan", "cls", "map", "hook", "useeffect", "usestate",
            "z-index", "flex", "flexbox", "overflow", "ellipsis", "grid", "align", "center",
            "networkerror", "hydration", "re-render", "rerender", "key prop",
            "econnrefused", "connect econ", "controlled", "uncontrolled", "sticky",
            "quota", "mixed content", "csp", "abortcontroller", "wasm", "webassembly"
        ])

        if any(vp in trimmed for vp in vague_phrases) and not has_specific_error:
            return True

        if len(trimmed) < 12 and not has_specific_error:
            return True

        return False

    def generate_context_aware_followup(self, query: str, evidence: dict | None = None, lang: str = "en") -> dict:
        q = query.lower()
        framework = evidence.get("detectedFramework", "Unknown") if evidence else "Unknown"

        if any(w in q for w in ["502", "bad gateway", "proxy", "econnrefused", "503", "504"]):
            return {
                "category": "Network & Proxy Diagnostics",
                "title": "502 Bad Gateway / Backend Connection Diagnostic",
                "problem": f"Your query mentions a 502 Bad Gateway or proxy connection failure: '{query}'.",
                "likely_cause": "A 502 Bad Gateway occurs when the frontend development proxy (Vite) cannot establish a connection to the backend server (FastAPI on port 8000).",
                "fix_steps": [
                    "1. Confirm your FastAPI backend server is running on http://127.0.0.1:8000.",
                    "2. Start backend: .\\backend\\venv\\Scripts\\Activate.ps1 followed by uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload",
                    "3. Check your frontend/vite.config.ts proxy settings for /api.",
                ],
                "extra_tips": "If uvicorn is running on a different port, update the Vite proxy target to match.",
                "follow_up_prompt": "Which scenario describes your backend setup right now?",
                "source": {
                    "title": "MDN Web Docs — 502 Bad Gateway",
                    "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/502",
                },
            }
        elif any(w in q for w in ["css", "style", "align", "layout"]):
            return {
                "category": "CSS & Layout Inquiry",
                "title": "Need More CSS Context to Diagnose",
                "problem": f"Your query '{query}' mentions CSS or layout issues without specific symptoms.",
                "likely_cause": "Different CSS bugs require different solutions (centering, z-index stacking, overflow clipping, or mobile viewport calculation).",
                "fix_steps": [
                    "1. Is the issue about horizontal or vertical centering (e.g. 'div is not centered')?",
                    "2. Is an element rendering behind other content (z-index stacking context)?",
                    "3. Is text refusing to truncate or causing horizontal overflow in flex/grid?",
                    "4. Paste your CSS class rules and the parent container element structure.",
                ],
                "extra_tips": "In Chrome DevTools, inspect the computed properties and the 'Layers' tab to check stacking context.",
                "follow_up_prompt": "You mentioned CSS — is this about element centering, z-index stacking, flexbox overflow, or mobile viewport jumping?",
                "source": {
                    "title": "MDN Web Docs — CSS Layout Overview",
                    "url": "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Introduction",
                },
            }
        elif any(w in q for w in ["react", "hook", "render", "state"]) or framework == "React":
            return {
                "category": "React Diagnostic Inquiry",
                "title": "Need More React Specifics to Diagnose",
                "problem": f"Your query '{query}' refers to a React issue without providing the error message or hook name.",
                "likely_cause": "React issues typically stem from hook dependency cycles, undefined state during async fetches, or SSR hydration mismatches.",
                "fix_steps": [
                    "1. Copy the exact red error message and stack trace from the browser console (F12).",
                    "2. Indicate which hook is involved (e.g., useState, useEffect, useMemo, useRef).",
                    "3. Paste the component code snippet where the state update or render occurs.",
                ],
                "extra_tips": "Check whether you are calling setState directly in the component body or inside an unguarded useEffect.",
                "follow_up_prompt": "Which React hook is involved, and what exact error appears in your browser console?",
                "source": {
                    "title": "React.dev — Handling Errors in React",
                    "url": "https://react.dev/learn/state-a-components-memory",
                },
            }
        else:
            return {
                "category": "Frontend Diagnostic Inquiry",
                "title": "Need More Information to Diagnose",
                "problem": f"Your query '{query}' is too brief or ambiguous to isolate the technical root cause.",
                "likely_cause": "Frontend errors range from JavaScript runtime exceptions to CSS layout defects and network/API failures.",
                "fix_steps": [
                    "1. Share the exact error message or stack trace from the browser console (F12).",
                    "2. Paste the relevant code snippet where the error originates.",
                    "3. Mention your framework (React 19, Next.js, Vite, Vue 3) or runtime environment.",
                ],
                "extra_tips": "Opening browser DevTools (F12 -> Console) reveals the exact file and line number.",
                "follow_up_prompt": "Could you share the red error message from DevTools or the code snippet causing issues?",
                "source": {
                    "title": "MDN Web Docs — Error Handling",
                    "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling",
                },
            }

    async def diagnose(
        self,
        user_input: str,
        enable_privacy: bool = True,
        conversation_history: list | None = None,
        context: dict | None = None,
        state: str | None = None,
        case_summary: dict | None = None,
        language: str | None = None,
        action: str | None = None,
    ) -> dict:
        """Main diagnostic method using state machine, evidence-based deduction, and multilingual support."""
        clean_text = (user_input or "").strip()
        redactions_count = 0
        ctx = context or {}

        if enable_privacy:
            sanitized = SanitizerService.sanitize(clean_text)
            clean_text = sanitized["sanitizedText"]
            redactions_count += sanitized["redactionsCount"]

        # Process & sanitize conversation history
        history_res = HistoryService.process_history(conversation_history, enable_privacy)
        sanitized_history = history_res["sanitizedHistory"]
        redactions_count += history_res["redactionsCount"]

        # Extract confirmed evidence without making assumptions
        evidence = EvidenceService.analyze(clean_text, ctx)

        # Hydrate CaseSummary & determine language
        case = CaseSummary.from_dict(case_summary)
        detected_lang = MultilingualService.detect_language(clean_text)
        active_lang = language or case.language or detected_lang or "en"
        if active_lang == "auto":
            active_lang = detected_lang
        case.language = active_lang

        # Always store fully sanitized problem statement in case_summary to prevent secret leaks
        sanitized_summary_text = SanitizerService.sanitize(clean_text)["sanitizedText"] if clean_text else ""
        if sanitized_summary_text:
            case.problem_statement = sanitized_summary_text

        # ---------------------------------------------------------
        # Handle Action: verify_solved (User confirms solution worked)
        # ---------------------------------------------------------
        if action == "verify_solved":
            case.resolution_status = "resolved"
            ack = MultilingualService.get_resolved_acknowledgment(active_lang)
            return {
                "matched": True,
                "generated_by": "state_machine",
                "model_label": "🎉 Resolution Summary",
                "response_type": "resolved",
                "state": DiagnosticState.RESOLVED.value,
                "case_summary": case.to_dict(),
                "language": active_lang,
                "is_followup_needed": False,
                "is_uncertain": False,
                "confidence_score": 1.0,
                "confidence_level": "verified",
                "category": "Issue Resolved",
                "title": "Troubleshooting Complete: Issue Resolved",
                "problem": case.problem_statement or "The technical issue has been resolved.",
                "likely_cause": case.active_hypothesis or "Fix successfully applied and verified by developer.",
                "fix_steps": [
                    "1. Code modification verified working.",
                    "2. Commit changes to version control (git).",
                    "3. Run automated unit/e2e tests before deployment.",
                ],
                "extra_tips": ack,
                "interactive_options": [],
                "can_skip": False,
                "verification_actions": [],
                "confirmation_prompt": "Glad to help! Let me know if another issue arises.",
                "redactions_count": redactions_count,
            }

        # ---------------------------------------------------------
        # Handle Action: verify_broken (User reports solution failed)
        # ---------------------------------------------------------
        if action == "verify_broken":
            case.resolution_status = "escalated"
            esc_msg = MultilingualService.get_escalation_message(active_lang)
            return {
                "matched": False,
                "generated_by": "state_machine",
                "model_label": "🔬 Deep Troubleshooting",
                "response_type": "fallback",
                "state": DiagnosticState.ESCALATE_OR_FALLBACK.value,
                "case_summary": case.to_dict(),
                "language": active_lang,
                "is_followup_needed": True,
                "is_uncertain": True,
                "confidence_score": 0.5,
                "confidence_level": "investigating",
                "category": "Alternative Hypothesis",
                "title": "Primary Fix Inconclusive — Deep Troubleshooting",
                "problem": f"The initial fix did not resolve: '{case.problem_statement}'.",
                "likely_cause": "The issue may involve secondary factors such as bundler caching, unhandled promise rejections, CORS preflight headers, or parent state synchronization.",
                "fix_steps": [
                    "1. Clear your browser cache and local dev server cache (e.g. restart Vite with `npm run dev -- --force`).",
                    "2. Check the DevTools Network tab for failed 4xx/5xx requests.",
                    "3. Paste the exact stack trace or lines around the failing component.",
                ],
                "extra_tips": esc_msg,
                "interactive_options": [
                    "I restarted Vite/Next.js with clean cache",
                    "Network tab shows 401 Unauthorized or 404",
                    "Network tab shows CORS preflight failure",
                    "Paste full stack trace",
                ],
                "can_skip": True,
                "verification_actions": ["verify_solved", "verify_broken", "verify_partial", "verify_different_error", "verify_need_help"],
                "confirmation_prompt": "Please share what happened after applying the fix.",
                "redactions_count": redactions_count,
            }

        # ---------------------------------------------------------
        # Handle Action: verify_partial (Fix worked partially)
        # ---------------------------------------------------------
        if action == "verify_partial":
            case.resolution_status = "partial"
            return {
                "matched": False,
                "generated_by": "state_machine",
                "model_label": "🔬 Partial Fix Troubleshooting",
                "state": DiagnosticState.COLLECT_CONTEXT.value,
                "case_summary": case.to_dict(),
                "language": active_lang,
                "is_followup_needed": True,
                "is_uncertain": True,
                "confidence_score": 0.7,
                "confidence_level": "investigating",
                "category": "Partial Resolution",
                "title": "Troubleshooting Partial Fix",
                "problem": f"The previous fix resolved part of '{case.problem_statement}', but secondary symptoms persist.",
                "likely_cause": "The primary error is fixed, but a dependent state update, secondary component lifecycle, or subsequent API request is failing.",
                "fix_steps": [
                    "1. Note what is working now (e.g. page renders, no longer white screen).",
                    "2. Check console (F12) for any new warning or network error.",
                    "3. Select the symptom below to isolate the remaining issue.",
                ],
                "extra_tips": "Partial fixes are common when a component depends on multiple asynchronous states.",
                "follow_up_prompt": "Which part of the problem is still occurring?",
                "follow_up_question": "Which part of the problem is still occurring?",
                "interactive_options": [
                    "The page loads now, but buttons/clicks do not work",
                    "The original error is gone, but UI is frozen/blank",
                    "Data is fetching, but not displaying properly in the component",
                    "I see a new error in the browser console",
                ],
                "can_skip": True,
                "verification_actions": [],
                "confirmation_prompt": "Please select what remains broken to continue.",
                "redactions_count": redactions_count,
            }

        # ---------------------------------------------------------
        # Handle Action: verify_different_error (New error appeared)
        # ---------------------------------------------------------
        if action == "verify_different_error":
            case.resolution_status = "investigating"
            return {
                "matched": False,
                "generated_by": "state_machine",
                "model_label": "🔬 Secondary Error Investigation",
                "state": DiagnosticState.COLLECT_CONTEXT.value,
                "case_summary": case.to_dict(),
                "language": active_lang,
                "is_followup_needed": True,
                "is_uncertain": True,
                "confidence_score": 0.6,
                "confidence_level": "investigating",
                "category": "New Error Encountered",
                "title": "Diagnosing New Secondary Error",
                "problem": "A different error appeared after applying the previous code fix.",
                "likely_cause": "Fixing the first barrier allowed execution to reach a subsequent unhandled condition in your application.",
                "fix_steps": [
                    "1. Copy the exact new error text or red trace from F12 Console.",
                    "2. Paste the new error message into the chat below.",
                ],
                "extra_tips": "Encountering a new error is normal progress — it means the previous crash was resolved!",
                "follow_up_prompt": "Please paste the new error message or select the symptom:",
                "follow_up_question": "Please paste the new error message or select the symptom:",
                "interactive_options": [
                    "I have a new red error message (I will paste it below)",
                    "Page became completely blank after the change",
                    "Console shows a 404 or 500 network error",
                ],
                "can_skip": True,
                "verification_actions": [],
                "confirmation_prompt": "Share the new error to continue.",
                "redactions_count": redactions_count,
            }

        # ---------------------------------------------------------
        # Handle Action: verify_need_help (Beginner-friendly help)
        # ---------------------------------------------------------
        if action == "verify_need_help":
            return {
                "matched": True,
                "generated_by": "state_machine",
                "model_label": "📘 Beginner Implementation Guide",
                "state": DiagnosticState.COLLECT_CONTEXT.value,
                "case_summary": case.to_dict(),
                "language": active_lang,
                "is_followup_needed": True,
                "is_uncertain": False,
                "confidence_score": 0.9,
                "confidence_level": "guidance",
                "category": "Code Application Help",
                "title": "Beginner Guide: Applying the Proposed Fix",
                "problem": "Need assistance locating files, adding imports, or applying the code change safely.",
                "likely_cause": "Applying code diffs can be tricky when adapting component names or file structures.",
                "fix_steps": [
                    "1. Locate the file mentioned in your error stack trace (e.g. src/components/...).",
                    "2. Make a backup copy or ensure your git working tree is committed.",
                    "3. Replace the lines marked in red (❌) with the green (✅) guarded block.",
                    "4. Save the file and watch the Vite dev server auto-reload.",
                ],
                "extra_tips": "You can also paste your component snippet into the chat, and I will show you where to place the fix.",
                "follow_up_prompt": "Where are you having trouble applying the fix?",
                "follow_up_question": "Where are you having trouble applying the fix?",
                "interactive_options": [
                    "I don't know which file to put this code in",
                    "I don't know where to import the hook/component",
                    "I get a syntax error after pasting the code",
                    "Show me an even simpler breakdown",
                ],
                "can_skip": True,
                "verification_actions": ["verify_solved", "verify_broken"],
                "confirmation_prompt": "Need more help with this step?",
                "redactions_count": redactions_count,
            }

        # Record answer to active facet from previous question turn
        if case.active_facet and action != "skip_questions":
            case.record_answer(case.active_facet, clean_text)
            case.active_facet = None

        # ---------------------------------------------------------
        # 1. Check for insufficient/vague input (COLLECT_CONTEXT)
        # ---------------------------------------------------------
        has_solid_evidence = bool(
            evidence.get("stack")
            or evidence.get("fileLocation")
            or evidence.get("errorSignature")
            or len(clean_text.split("\n")) > 2
            or any(kw in clean_text.lower() for kw in [
                "502 bad gateway", "econnrefused", "typeerror:", "referenceerror:", "syntaxerror:",
                "404 not found", "500 internal server", "cors policy blocked:", "cannot read properties of undefined (reading 'map')"
            ])
            or (case.data_source and case.reproduction_trigger)
            or case.step_number > case.max_steps
        )

        should_collect_context = (
            not has_solid_evidence
            and (self.is_insufficient_query(clean_text) or bool(case.problem_category))
            and action != "skip_questions"
        )

        if should_collect_context:
            followup_data = self.generate_context_aware_followup(clean_text, evidence, active_lang)
            interactive_q = QuestionGenerator.generate_interactive_followup(clean_text, case, evidence, active_lang)
            options = interactive_q.get("options", [])
            facet = interactive_q.get("facet")
            greeting = interactive_q.get("greeting", "")
            question_text = interactive_q.get("question") or followup_data.get("follow_up_prompt", "")
            response_type = interactive_q.get("response_type", "follow_up_question")

            step_num = min(case.step_number, 3)
            step_label = f"Step {step_num} of 3"

            # Set active facet for next turn answer recording
            if facet:
                case.active_facet = facet

            return {
                "matched": False,
                "generated_by": "state_machine",
                "model_label": "💬 FrontFix Support Assistant",
                "response_type": response_type,
                "state": DiagnosticState.COLLECT_CONTEXT.value,
                "case_summary": case.to_dict(),
                "language": active_lang,
                "is_followup_needed": True,
                "is_uncertain": True,
                "step_number": step_num,
                "step_label": step_label,
                "category": followup_data["category"],
                "title": "FrontFix AI Support",
                "greeting": greeting,
                "message": f"{greeting}\n\n{question_text}" if greeting else question_text,
                "problem": followup_data["problem"],
                "likely_cause": followup_data["likely_cause"],
                "fix_steps": followup_data["fix_steps"],
                "extra_tips": interactive_q.get("explanation") or followup_data["extra_tips"],
                "follow_up_prompt": question_text,
                "follow_up_question": question_text,
                "interactive_options": options,
                "interactive_facet": facet,
                "can_skip": True,
                "allow_text_input": True,
                "verification_actions": [],
                "confirmation_prompt": "Did this guidance help clarify what to share?",
                "source": followup_data["source"],
                "sources": [followup_data["source"]],
                "prevention_checklist": [
                    "Inspect browser console for the exact error message.",
                    "Check network tab for failed API calls.",
                ],
                "redactions_count": redactions_count,
                "evidence_summary": {
                    "input_source": evidence.get("inputSource"),
                    "is_browser_captured": evidence.get("isBrowserCaptured"),
                    "file_location": evidence.get("fileLocation"),
                    "detected_framework": evidence.get("detectedFramework"),
                    "confirmed_observations": evidence.get("observations"),
                },
            }

        # 2. Check for multi-turn conversational follow-up
        search_query = clean_text
        is_multiturn_followup = False
        if sanitized_history:
            resolved = HistoryService.resolve_context_with_history(clean_text, sanitized_history)
            if resolved["isMultiturnFollowup"]:
                search_query = resolved["enrichedQuery"]
                is_multiturn_followup = True

        # 3. Search knowledge base with TF-IDF cosine ranking
        ranked_matches = self.retriever.search(search_query)

        if ranked_matches and ranked_matches[0]["score"] >= self.MIN_MATCH_SCORE:
            top_match = ranked_matches[0]
            top_item = top_match["item"]
            score = top_match["score"]

            # Evaluate reliability of match
            eval_res = MatchEvaluator.evaluate_match(top_match, clean_text, evidence, case)
            is_uncertain = not eval_res["is_reliable"] or score < 20.0
            confidence_level = eval_res["confidence"]

            problem = top_item.get("problem", "")
            likely_cause = top_item.get("likely_cause", "")
            fix_steps = list(top_item.get("fix_steps", []))
            code_before = top_item.get("code_before", "")
            code_after = top_item.get("code_after", "")
            extra_tips = top_item.get("extra_tips", "")
            title = top_item.get("title", "")
            category = top_item.get("category", "")
            generated_by = "knowledge_base"
            model_label = "📚 Verified Knowledge Base"
            code_context_note = "General illustrative example — adapt variable and component names to your codebase."

            # Evidence-based adaptation for TypeError: Cannot read properties of undefined (reading 'map')
            if top_item.get("id") == "typeerror_map":
                file_location_file = evidence.get("fileLocation", {}).get("file", "") if evidence.get("fileLocation") else ""
                has_react_evidence = (
                    evidence.get("detectedFramework") in ("React", "Next.js")
                    or bool(re.search(r"\.(jsx|tsx)$", file_location_file, re.IGNORECASE))
                )

                if not has_react_evidence:
                    category = "JavaScript Runtime"
                    problem = "Attempted to call the '.map()' method on a variable that evaluated to 'undefined' at runtime."
                    likely_cause = (
                        "1. (Most common) Asynchronous state or prop populated asynchronously (e.g. from an API call, async function, or promise) that defaults to undefined on initial evaluation.\n"
                        "2. Unexpected data structure: The API, function, or prop returned an object (e.g. '{ data: [...] }'), null, or an error payload instead of a direct array.\n"
                        "3. The variable was conditionally assigned or an optional property chain resolved to undefined."
                    )
                    fix_steps = [
                        "1. Verify the variable exists and is a valid array before calling .map(), using `Array.isArray(variable)` or optional chaining `variable?.map(...)`.",
                        "2. If populated asynchronously (e.g. from an API call), track distinct `loading`, `error`, and `data` states. Initializing with `useState([])` prevents undefined crashes, but the true fix depends on the data source; an empty array does not keep loading active.",
                        "3. If the array is empty (`items.length === 0`), render an empty state message (e.g. 'No items found') rather than getting trapped in a loading indicator.",
                        "4. Log or inspect the value and type of the variable immediately before calling .map().",
                    ]
                    code_before = "// ❌ Broken: Calling .map() on an undefined or uninitialized variable\nconst data = undefined;\ndata.map(item => item.name);"
                    code_after = "// ✅ Fixed (Standard JavaScript): Guard with Array.isArray\nif (Array.isArray(items)) {\n  items.map(item => item.name);\n}\n\n// ✅ In a React component: Separate loading, error, and empty result states\nconst [items, setItems] = useState([]);\nconst [loading, setLoading] = useState(true);\nconst [error, setError] = useState(null);\n\nif (loading) return <p>Loading items...</p>;\nif (error) return <p>Error: {error}</p>;\nif (items.length === 0) return <p>No items found.</p>;\n\nreturn (\n  <ul>\n    {items.map(item => (\n      <li key={item.id}>{item.name}</li>\n    ))}\n  </ul>\n);"
                    code_context_note = "Framework note: No specific framework was identified from the supplied error. The code above shows standard defensive JavaScript as well as the common React component pattern."
                else:
                    ref_file = file_location_file or "input"
                    code_context_note = f"Evidence detected React in {ref_file}. The fix separates loading, error, and empty result states."

            if is_multiturn_followup:
                title = f"{title} (Follow-up Context)"

            # Step 4: Pass to LLM if available, grounding with evidence & target language
            if self.llm_service.is_available():
                try:
                    llm_res = await self.llm_service.generate_grounded_response(
                        clean_text,
                        top_item,
                        sanitized_history,
                        evidence,
                        target_language=active_lang,
                    )
                    llm_output = llm_res.get("output")
                    provider = llm_res.get("provider", "knowledge_base")
                    if llm_output:
                        problem = llm_output.get("problem") or problem
                        likely_cause = llm_output.get("likely_cause") or likely_cause
                        fix_steps = llm_output.get("fix_steps") or fix_steps
                        code_before = llm_output.get("code_before") or code_before
                        code_after = llm_output.get("code_after") or code_after
                        extra_tips = llm_output.get("extra_tips") or extra_tips
                        generated_by = provider
                        model_label = f"✨ AI Explained ({provider.capitalize()})"
                except Exception:
                    pass

            file_loc = evidence.get("fileLocation")
            file_hint = None
            if file_loc and file_loc.get("file"):
                file_hint = f"{file_loc['file']}:{file_loc['line']}" if file_loc.get("line") else file_loc["file"]

            follow_up_question = evidence.get("focusedFollowUp")
            case.active_hypothesis = likely_cause
            case.suggested_fix = str(code_after)

            return {
                "matched": True,
                "generated_by": generated_by,
                "model_label": model_label,
                "response_type": "solution",
                "state": DiagnosticState.PRESENT_SOLUTION.value,
                "case_summary": case.to_dict(),
                "language": active_lang,
                "is_followup_needed": False,
                "is_uncertain": is_uncertain,
                "confidence_score": round(score, 1),
                "confidence_level": confidence_level,
                "category": category,
                "title": title,
                "problem": problem,
                "likely_cause": likely_cause,
                "fix_steps": fix_steps,
                "file_hint": file_hint,
                "code_before": code_before,
                "code_after": code_after,
                "corrected_code": code_after,
                "code_context_note": code_context_note,
                "extra_tips": extra_tips,
                "follow_up_question": follow_up_question,
                "interactive_options": [],
                "can_skip": False,
                "verification_actions": ["verify_solved", "verify_broken", "verify_partial", "verify_different_error", "verify_need_help"],
                "prevention_checklist": top_item.get("prevention_checklist", [
                    "Always check browser console (F12) for uncaught exceptions.",
                    "Verify component props and default states.",
                ]),
                "related_issues": top_item.get("related_issues", []),
                "source": {
                    "title": top_item.get("source_title", "Official Documentation"),
                    "url": top_item.get("source_url", ""),
                },
                "sources": [
                    {
                        "title": top_item.get("source_title", "Official Documentation"),
                        "url": top_item.get("source_url", ""),
                    }
                ],
                "confirmation_prompt": "Did this resolve your issue? Let us know with thumbs up or down below.",
                "redactions_count": redactions_count,
                "evidence_summary": {
                    "input_source": evidence.get("inputSource"),
                    "is_browser_captured": evidence.get("isBrowserCaptured"),
                    "file_location": evidence.get("fileLocation"),
                    "detected_framework": evidence.get("detectedFramework"),
                    "confirmed_observations": evidence.get("observations"),
                },
            }

        # 4. Try Dynamic AI Diagnosis for arbitrary / uncatalogued errors
        first_line = clean_text.split("\n")[0] if clean_text else "Frontend Exception"
        file_loc = evidence.get("fileLocation")
        file_hint = None
        if file_loc and file_loc.get("file"):
            file_hint = f"{file_loc['file']}:{file_loc['line']}" if file_loc.get("line") else file_loc["file"]

        if self.llm_service.is_available() and (has_solid_evidence or action == "skip_questions" or case.step_number >= case.max_steps):
            try:
                llm_diag = await self.llm_service.diagnose_arbitrary_error(
                    clean_text,
                    sanitized_history,
                    evidence,
                    target_language=active_lang,
                )
                if llm_diag and llm_diag.get("problem") and llm_diag.get("fix_steps"):
                    provider_name = str(llm_diag.get("provider", "ai")).capitalize()
                    source_title = llm_diag.get("source_title", "Official Documentation")
                    source_url = llm_diag.get("source_url", "https://developer.mozilla.org/en-US/docs/Web")
                    case.active_hypothesis = llm_diag.get("likely_cause")
                    case.suggested_fix = str(llm_diag.get("code_after"))

                    return {
                        "matched": False,
                        "generated_by": llm_diag.get("provider", "llm"),
                        "model_label": f"⚡ Dynamic AI Diagnosis ({provider_name})",
                        "response_type": "solution",
                        "state": DiagnosticState.PRESENT_SOLUTION.value,
                        "case_summary": case.to_dict(),
                        "language": active_lang,
                        "is_followup_needed": False,
                        "is_uncertain": False,
                        "confidence_score": 0.95,
                        "confidence_level": "medium",
                        "category": llm_diag.get("category", "Frontend Error Diagnosis"),
                        "title": llm_diag.get("title", f"Diagnosis: {first_line[:60]}"),
                        "problem": llm_diag.get("problem"),
                        "likely_cause": f"Based on error analysis: {llm_diag.get('likely_cause')}",
                        "fix_steps": llm_diag.get("fix_steps"),
                        "file_hint": file_hint,
                        "code_before": llm_diag.get("code_before", "// Offending code snippet"),
                        "code_after": llm_diag.get("code_after", "// Recommended fix"),
                        "corrected_code": llm_diag.get("code_after", "// Recommended fix"),
                        "code_context_note": "Tailored real-time solution generated for your frontend error.",
                        "extra_tips": llm_diag.get("extra_tips", "Inspect browser console and network headers."),
                        "follow_up_question": None,
                        "interactive_options": [],
                        "can_skip": False,
                        "verification_actions": ["verify_solved", "verify_broken", "verify_partial", "verify_different_error", "verify_need_help"],
                        "prevention_checklist": llm_diag.get("prevention_checklist", [
                            "Always catch async promises with try/catch.",
                            "Use React ErrorBoundary around critical component subtrees.",
                        ]),
                        "related_issues": ["typeerror_map", "cors_policy_blocked", "infinite_rerender"],
                        "source": {"title": source_title, "url": source_url},
                        "sources": [{"title": source_title, "url": source_url}],
                        "confirmation_prompt": "Did this tailored diagnosis resolve your issue? Let us know below.",
                        "redactions_count": redactions_count,
                        "evidence_summary": {
                            "input_source": evidence.get("inputSource"),
                            "is_browser_captured": evidence.get("isBrowserCaptured"),
                            "file_location": evidence.get("fileLocation"),
                            "detected_framework": evidence.get("detectedFramework"),
                            "confirmed_observations": evidence.get("observations"),
                        },
                    }
            except Exception:
                pass

        # 5. Low-confidence fallback (Never invent files or facts)
        return {
            "matched": False,
            "generated_by": "knowledge_base",
            "model_label": "📚 General Diagnostics",
            "response_type": "fallback",
            "state": DiagnosticState.ESCALATE_OR_FALLBACK.value,
            "case_summary": case.to_dict(),
            "language": active_lang,
            "is_followup_needed": False,
            "is_uncertain": True,
            "confidence_score": 0.0,
            "confidence_level": "low",
            "category": "Frontend Runtime & Troubleshooting",
            "title": "Uncatalogued Frontend Issue (General Diagnostics)",
            "problem": f"Encountered an uncatalogued issue or custom runtime state: '{first_line[:90]}...'.",
            "likely_cause": (
                "I am not completely certain about this specific error scenario, but based on your description, "
                "this error does not match our catalogued frontend issues. It typically stems from an unhandled async "
                "promise rejection, undefined state access, or missing try/catch error boundary."
            ),
            "fix_steps": [
                "1. Inspect the browser console (F12) for the full stack trace to identify the file and line number.",
                "2. Wrap the failing asynchronous call or component in a try/catch block or React ErrorBoundary.",
                "3. Check the DevTools Network tab to verify that all API responses return valid 200 JSON with expected headers.",
                "4. Consult the official documentation linked below for reference specifications.",
            ],
            "file_hint": file_hint,
            "code_before": "// ❌ Unhandled failure:\nconst result = executeOperation();",
            "code_after": "// ✅ Fixed: Wrap with ErrorBoundary or try/catch guard\ntry {\n  const result = executeOperation();\n} catch (error) {\n  console.error('Safely captured error:', error);\n}",
            "corrected_code": "// ✅ Fixed: Wrap with ErrorBoundary or try/catch guard\ntry {\n  const result = executeOperation();\n} catch (error) {\n  console.error('Safely captured error:', error);\n}",
            "code_context_note": "General fallback illustration — adapt to your codebase.",
            "extra_tips": "To get a more specific diagnosis, please provide the complete stack trace and specify the framework (e.g. React 19, Next.js, Vue 3).",
            "follow_up_question": evidence.get("focusedFollowUp") or "Can you share the full stack trace or the code where this error occurs?",
            "interactive_options": [
                "The error happens in an async API call",
                "The error happens during component render",
                "I see a 404 / 500 network error",
            ],
            "can_skip": False,
            "verification_actions": ["verify_solved", "verify_broken", "verify_partial", "verify_different_error", "verify_need_help"],
            "prevention_checklist": [
                "Catch all async promises with try/catch.",
                "Add top-level React ErrorBoundaries to prevent white screens.",
                "Verify API payload structures against schemas.",
            ],
            "related_issues": ["typeerror_map", "cors_policy_blocked", "infinite_rerender"],
            "source": {
                "title": "MDN Web Docs — Error Handling",
                "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling",
            },
            "sources": [
                {
                    "title": "MDN Web Docs — Error Handling",
                    "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling",
                }
            ],
            "confirmation_prompt": "Did this general guidance help isolate the problem?",
            "redactions_count": redactions_count,
            "evidence_summary": {
                "input_source": evidence.get("inputSource"),
                "is_browser_captured": evidence.get("isBrowserCaptured"),
                "file_location": evidence.get("fileLocation"),
                "detected_framework": evidence.get("detectedFramework"),
                "confirmed_observations": evidence.get("observations"),
            },
        }

    async def analyze_log_file(self, content: str) -> dict:
        """Parse uploaded frontend log file or browser console dump.
        Sanitizes 100% of raw content first, then extracts errors and diagnoses top issues.
        """
        sanitized = SanitizerService.sanitize(content or "")
        sanitized_text = sanitized["sanitizedText"]
        redactions_count = sanitized["redactionsCount"]

        lines = re.split(r"\r?\n", sanitized_text)
        extracted_errors = []

        error_pattern = re.compile(
            r"(error|exception|uncaught|failed|typeerror|syntaxerror|warning|fatal|cors|blocked|status of (4\d\d|5\d\d)|rejected)",
            re.IGNORECASE,
        )

        for idx, line in enumerate(lines):
            line_str = line.strip()
            if not line_str:
                continue
            if error_pattern.search(line_str):
                context_start = max(0, idx - 1)
                context_end = min(len(lines), idx + 4)
                snippet = "\n".join(lines[context_start:context_end])
                extracted_errors.append({
                    "line_number": idx + 1,
                    "snippet": line_str,
                    "full_context": snippet,
                })

        diagnosed_issues = []
        seen_categories = set()

        for err in extracted_errors:
            res = await self.diagnose(
                err["snippet"],
                enable_privacy=True,
                conversation_history=None,
                context={
                    "stack": err["full_context"],
                    "errorMessage": err["snippet"],
                    "source": "log_file_upload",
                },
            )
            cat = res.get("category", "")
            if res.get("matched") and cat not in seen_categories:
                seen_categories.add(cat)
                diagnosed_issues.append({
                    "line_number": err["line_number"],
                    "symptom": err["snippet"][:120],
                    "diagnosis": res,
                })

        sanitized_snippets = [e["snippet"] for e in extracted_errors[:10]]

        return {
            "total_lines_analyzed": len(lines),
            "total_error_lines_detected": len(extracted_errors),
            "unique_issues_identified": len(diagnosed_issues),
            "redactions_in_log": redactions_count,
            "top_issues": diagnosed_issues[:5],
            "sanitized_error_samples": sanitized_snippets,
            "raw_error_samples": sanitized_snippets,
        }

    def list_presets(self) -> list[dict]:
        top_ids = [
            "typeerror_map",
            "cors_policy_blocked",
            "div_not_centered",
            "infinite_rerender",
            "hydration_mismatch",
            "zindex_stacking_trap",
            "flexbox_overflow_ellipsis",
            "react_missing_key",
            "form_button_refresh",
            "api_404_not_found",
        ]
        presets = []
        for item_id in top_ids:
            k = self.retriever.get_by_id(item_id)
            if k:
                sample = k["trigger_patterns"][0] if k.get("trigger_patterns") else k.get("title", "")
                presets.append({
                    "id": k.get("id"),
                    "title": k.get("title"),
                    "category": k.get("category"),
                    "sample": sample,
                    "code_before": k.get("code_before", ""),
                })
        return presets
