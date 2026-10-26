import json
import logging
import requests
from .config import config, is_real_key
from .evidence import EvidenceService

logger = logging.getLogger("frontfix_llm")

MASTER_SYSTEM_PROMPT = """You are FrontFix AI, an experienced software troubleshooting assistant specializing in frontend development, JavaScript, TypeScript, React, Vite, web APIs, browser errors, and related development problems.

Your job is to identify the most likely cause of a technical issue and guide the user toward a safe, practical resolution.

First, understand the problem and review the evidence collected during the conversation. If important information is missing, ask a small number of relevant follow-up questions. Do not ask questions whose answers are already available.

Use retrieved knowledge-base results when they are relevant and sufficiently reliable. If no suitable match exists, analyze the issue using your own capabilities and the provided evidence.

Never fabricate a retrieved result, source, test result, file path, or successful verification. Do not claim that code has been executed or tested unless the system actually performed that action.

Separate confirmed facts from assumptions and hypotheses. If several causes are possible, rank the most plausible ones and explain what evidence would distinguish them.

Respond in the user's preferred language ({target_language}). Preserve programming syntax, error messages, commands, filenames, and technical identifiers.
CRITICAL SAFETY RULE: Never translate code syntax, HTML tags, variable names, CLI commands (e.g. npm run dev), or file paths. They must remain in pure English/ASCII.

Give the simplest safe fix first. Explain why it works, show the relevant code changes, and provide verification steps.

If the problem remains unclear, continue troubleshooting instead of presenting speculation as certainty.

Do not request passwords, private keys, access tokens, or other secrets. Recommend redacting sensitive information from logs and code.

Your goal is not merely to produce an answer. Your goal is to help the user understand the problem, apply a suitable fix, and confirm whether the issue has been resolved."""


class LLMService:
    def __init__(self, custom_config: dict | None = None):
        cfg = custom_config or {}
        self.gemini_api_key = cfg.get("geminiApiKey", config.gemini_api_key)
        self.gemini_model = cfg.get("geminiModel", config.gemini_model)
        self.openai_api_key = cfg.get("openaiApiKey", config.openai_api_key)
        self.openai_base_url = (cfg.get("openaiBaseUrl", config.openai_base_url)).rstrip("/")
        self.openai_model = cfg.get("openaiModel", config.openai_model)
        self.groq_api_key = cfg.get("groqApiKey", getattr(config, "groq_api_key", ""))

        self._genai_model = None

    def _get_genai_model(self):
        if self._genai_model is None and is_real_key(self.gemini_api_key):
            try:
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    import google.generativeai as genai

                genai.configure(api_key=self.gemini_api_key)
                self._genai_model = genai.GenerativeModel(
                    model_name=self.gemini_model,
                    generation_config={
                        "temperature": 0.2,
                        "response_mime_type": "application/json",
                    },
                )
            except Exception:
                self._genai_model = None
        return self._genai_model

    def is_available(self) -> bool:
        return (
            is_real_key(self.gemini_api_key)
            or is_real_key(self.openai_api_key)
            or is_real_key(self.groq_api_key)
        )

    async def generate_grounded_response(
        self,
        user_query: str,
        retrieved_item: dict,
        conversation_history: list | None = None,
        evidence: dict | None = None,
        target_language: str = "en",
    ) -> dict:
        """Generates a grounded RAG response based on canonical knowledge item and evidence."""
        if not self.is_available():
            return {"output": None, "provider": "knowledge_base"}

        canonical_context = "\n".join([
            f"Title: {retrieved_item.get('title', '')}",
            f"Category: {retrieved_item.get('category', '')}",
            f"Canonical Problem: {retrieved_item.get('problem', '')}",
            f"Canonical Cause: {retrieved_item.get('likely_cause', '')}",
            "Canonical Fix Steps:\n" + "\n".join(f"- {s}" for s in retrieved_item.get("fix_steps", [])),
            f"Code Before:\n{retrieved_item.get('code_before', '')}",
            f"Code After:\n{retrieved_item.get('code_after', '')}",
            f"Extra Tips: {retrieved_item.get('extra_tips', '')}",
            f"Canonical Source: {retrieved_item.get('source_url', '')}",
        ])

        history_context = ""
        if conversation_history:
            history_context = (
                "Prior Conversation Turns (Sanitized):\n"
                + "\n".join(
                    f"- {'Assistant' if m.get('role') == 'assistant' else 'User'}: {m.get('content', '')}"
                    for m in conversation_history[-4:]
                )
                + "\n\n"
            )

        evidence_context = ""
        if evidence:
            file_loc_str = "None provided in input"
            if evidence.get("fileLocation"):
                f = evidence["fileLocation"].get("file", "")
                ln = evidence["fileLocation"].get("line", "")
                file_loc_str = f"{f}:{ln}" if ln else f

            evidence_context = (
                "CONFIRMED EVIDENCE & CONTEXT:\n"
                f"- Input Source: {evidence.get('inputSource', 'User query')}\n"
                f"- File Location: {file_loc_str}\n"
                f"- Detected Framework: {evidence.get('detectedFramework', 'Unknown / Generic JavaScript')}\n"
                f"- Observations: {'; '.join(evidence.get('observations', []))}\n\n"
            )

        system_instruction = MASTER_SYSTEM_PROMPT.format(target_language=target_language)

        prompt = (
            f"{system_instruction}\n\n"
            "TASK INSTRUCTIONS:\n"
            "1. NEVER make unsupported assumptions. If no framework was detected, do NOT assume React. Treat as standard JavaScript / Web platform unless evidence indicates otherwise.\n"
            "2. NEVER invent file names, line numbers, or API responses. Only reference files and lines if present in the confirmed evidence.\n"
            "3. Separate confirmed observations from likely causes. Rank likely causes instead of stating guesses as fact.\n"
            "4. If a proposed fix is a general pattern, explicitly explain that it is an illustrative example.\n"
            "5. Output clean, unescaped literal code (no HTML entities like &lt; or &gt;).\n"
            "6. Ground your answer in the CANONICAL KNOWLEDGE BASE ARTICLE below.\n"
            "7. Return ONLY a valid raw JSON object:\n"
            "{\n"
            '  "problem": "Clear 1-2 sentence description of confirmed problem",\n'
            '  "likely_cause": "Ranked explanation of most likely causes based on evidence",\n'
            '  "fix_steps": ["1. First actionable step...", "2. Second actionable step..."],\n'
            '  "code_before": "// Illustrative snippet of the broken code",\n'
            '  "code_after": "// Corrected code example",\n'
            '  "extra_tips": "Performance, prevention, or framework specific tips",\n'
            '  "follow_up_question": "One focused question if code/context is missing, or null if complete"\n'
            "}\n\n"
            f"CANONICAL KNOWLEDGE BASE ARTICLE:\n{canonical_context}\n\n"
            f"{evidence_context}"
            f"{history_context}"
            f"LATEST DEVELOPER QUERY:\n{user_query}\n\n"
            "JSON Response:"
        )

        # 1. Try Gemini
        if is_real_key(self.gemini_api_key):
            try:
                text = self._call_gemini(prompt)
                if text:
                    parsed = self._parse_json_response(text)
                    validated = self._validate_schema(parsed, retrieved_item)
                    if validated:
                        return {"output": validated, "provider": "gemini"}
            except Exception as err:
                logger.warning("Gemini generation failed: %s", err)

        # 2. Try Groq
        if is_real_key(self.groq_api_key):
            try:
                text = self._call_groq(prompt)
                if text:
                    parsed = self._parse_json_response(text)
                    validated = self._validate_schema(parsed, retrieved_item)
                    if validated:
                        return {"output": validated, "provider": "groq"}
            except Exception as err:
                logger.warning("Groq generation failed: %s", err)

        # 3. Try OpenAI
        if is_real_key(self.openai_api_key):
            try:
                text = self._call_openai(prompt)
                if text:
                    parsed = self._parse_json_response(text)
                    validated = self._validate_schema(parsed, retrieved_item)
                    if validated:
                        return {"output": validated, "provider": "openai"}
            except Exception as err:
                logger.warning("OpenAI generation failed: %s", err)

        return {"output": None, "provider": "knowledge_base"}

    async def diagnose_arbitrary_error(
        self,
        user_query: str,
        conversation_history: list | None = None,
        evidence: dict | None = None,
        target_language: str = "en",
    ) -> dict | None:
        """
        Dynamically diagnoses ANY arbitrary uncatalogued frontend error using available LLMs.
        Returns a rich structured diagnostic response.
        """
        if not self.is_available():
            return None

        framework = evidence.get("detectedFramework", "Frontend JavaScript") if evidence else "Frontend JavaScript"
        file_loc = "Not specified"
        if evidence and evidence.get("fileLocation"):
            f = evidence["fileLocation"].get("file", "")
            ln = evidence["fileLocation"].get("line", "")
            file_loc = f"{f}:{ln}" if ln else f

        system_instruction = MASTER_SYSTEM_PROMPT.format(target_language=target_language)

        prompt = (
            f"{system_instruction}\n\n"
            "TASK INSTRUCTIONS:\n"
            "A developer encountered a real frontend runtime error, exception, or UI issue.\n"
            "Analyze the error query, stack trace, and context, then return a comprehensive fix in JSON format.\n"
            f"Detected Framework/Runtime: {framework}\n"
            f"Detected File Location: {file_loc}\n\n"
            "JSON SCHEMA REQUIREMENT:\n"
            "{\n"
            '  "category": "High-level Category (e.g. React 19 Runtime, Vite ESM Module, Network/CORS, CSS Stacking, Web Audio API)",\n'
            '  "title": "Clear, informative title for the specific error",\n'
            '  "problem": "Precise 1-2 sentence description of what failed and why",\n'
            '  "likely_cause": "Detailed technical root cause analysis based on the error output",\n'
            '  "fix_steps": ["1. First actionable step", "2. Second actionable step", "3. Third actionable step"],\n'
            '  "code_before": "// Offending code or typical broken pattern",\n'
            '  "code_after": "// Exact corrected code solution",\n'
            '  "extra_tips": "Performance, security, or framework best practices to avoid recurrence",\n'
            '  "prevention_checklist": ["Precaution 1", "Precaution 2", "Precaution 3"],\n'
            '  "source_title": "Official Documentation or MDN",\n'
            '  "source_url": "https://developer.mozilla.org/ or official docs link"\n'
            "}\n\n"
            f"DEVELOPER ERROR QUERY:\n{user_query}\n\n"
            "Return ONLY the raw JSON object:"
        )

        # 1. Try Gemini
        if is_real_key(self.gemini_api_key):
            try:
                text = self._call_gemini(prompt)
                if text:
                    parsed = self._parse_json_response(text)
                    if parsed and parsed.get("problem") and parsed.get("fix_steps"):
                        parsed["provider"] = "gemini"
                        return parsed
            except Exception as err:
                logger.warning("Gemini arbitrary error diagnosis failed: %s", err)

        # 2. Try Groq
        if is_real_key(self.groq_api_key):
            try:
                text = self._call_groq(prompt)
                if text:
                    parsed = self._parse_json_response(text)
                    if parsed and parsed.get("problem") and parsed.get("fix_steps"):
                        parsed["provider"] = "groq"
                        return parsed
            except Exception as err:
                logger.warning("Groq arbitrary error diagnosis failed: %s", err)

        # 3. Try OpenAI
        if is_real_key(self.openai_api_key):
            try:
                text = self._call_openai(prompt)
                if text:
                    parsed = self._parse_json_response(text)
                    if parsed and parsed.get("problem") and parsed.get("fix_steps"):
                        parsed["provider"] = "openai"
                        return parsed
            except Exception as err:
                logger.warning("OpenAI arbitrary error diagnosis failed: %s", err)

        return None

    def _call_gemini(self, prompt: str) -> str | None:
        # Try modern google.genai client if installed
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=self.gemini_api_key)
            for g_model in [self.gemini_model, "gemini-flash-lite-latest", "gemini-2.0-flash"]:
                try:
                    resp = client.models.generate_content(
                        model=g_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.1,
                        ),
                    )
                    if resp and resp.text:
                        return resp.text
                except Exception:
                    continue
        except Exception:
            pass

        # Fallback to legacy google.generativeai
        model = self._get_genai_model()
        if not model:
            return None
        response = model.generate_content(prompt)
        return response.text if response else None

    def _call_groq(self, prompt: str) -> str | None:
        try:
            from groq import Groq
            client = Groq(api_key=self.groq_api_key)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are FrontFix AI, an expert frontend technical support engineer. Always return strictly valid JSON conforming to the requested schema."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            return response.choices[0].message.content
        except Exception as exc:
            logger.warning("Groq client call error: %s", exc)
            return None

    def _call_openai(self, prompt: str) -> str | None:
        url = f"{self.openai_base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.openai_model,
            "messages": [
                {"role": "system", "content": "You are FrontFix AI, an expert frontend technical support engineer. Always return strictly valid JSON conforming to the requested schema."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        resp = requests.post(url, headers=headers, json=body, timeout=8)
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
        return None

    def _parse_json_response(self, text: str) -> dict | None:
        if not text:
            return None
        try:
            return json.loads(text.strip())
        except Exception:
            import re
            m = re.search(r"\{.*\}", text, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0))
                except Exception:
                    pass
        return None

    def _validate_schema(self, parsed: dict | None, retrieved_item: dict | None = None) -> dict | None:
        if not parsed or not isinstance(parsed, dict):
            return None
        if not parsed.get("problem") or not parsed.get("likely_cause") or not parsed.get("fix_steps"):
            return None
        raw_steps = parsed.get("fix_steps")
        if isinstance(raw_steps, str):
            steps_list = [s.strip() for s in raw_steps.split("\n") if s.strip()]
        elif isinstance(raw_steps, list):
            steps_list = [str(s) for s in raw_steps if str(s).strip()]
        else:
            return None

        if not steps_list:
            return None

        item = retrieved_item or {}
        return {
            "problem": str(parsed.get("problem")),
            "likely_cause": str(parsed.get("likely_cause")),
            "fix_steps": steps_list,
            "code_before": str(parsed.get("code_before", item.get("code_before", ""))),
            "code_after": str(parsed.get("code_after", item.get("code_after", ""))),
            "extra_tips": str(parsed.get("extra_tips", item.get("extra_tips", ""))),
            "follow_up_question": parsed.get("follow_up_question"),
        }
