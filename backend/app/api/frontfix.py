import platform
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import JSONResponse

from app.services.frontfix.engine import DiagnosticEngine
from app.services.frontfix.formatter import format_diagnostic_response

router = APIRouter()

# Singletons for diagnostic engine and feedback store
engine = DiagnosticEngine()

class FeedbackStore:
    def __init__(self):
        self.feedback_log = []
        self._db_initialized = False

    def _ensure_db(self):
        if self._db_initialized:
            return
        try:
            from app.core.database import get_db_connection
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS frontfix_feedback (
                            id SERIAL PRIMARY KEY,
                            issue_title TEXT,
                            is_helpful BOOLEAN,
                            query_text TEXT,
                            comment TEXT,
                            created_at TEXT NOT NULL
                        )
                    """)
            self._db_initialized = True
        except Exception:
            pass

    def submit_feedback(self, data: dict) -> dict:
        record = {
            "issue_title": data.get("issue_title", "General"),
            "is_helpful": data.get("is_helpful"),
            "query_text": data.get("query_text", ""),
            "comment": data.get("comment", ""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.feedback_log.append(record)
        try:
            self._ensure_db()
            from app.core.database import get_db_connection
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO frontfix_feedback (issue_title, is_helpful, query_text, comment, created_at)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (record["issue_title"], record["is_helpful"], record["query_text"], record["comment"], record["timestamp"])
                    )
        except Exception:
            pass

        return {
            "success": True,
            "message": "Thank you for your feedback! It helps improve FrontFix AI.",
            "total_feedback_count": len(self.feedback_log),
        }

    def get_stats(self) -> dict:
        total = len(self.feedback_log)
        positive = sum(1 for f in self.feedback_log if f.get("is_helpful") is True)
        negative = total - positive
        ratio = round((positive / total) * 100, 1) if total > 0 else 0.0

        return {
            "total_feedback": total,
            "helpful_count": positive,
            "unhelpful_count": negative,
            "satisfaction_rate_percent": ratio,
            "recent_feedback": self.feedback_log[-10:],
        }

feedback_store = FeedbackStore()


async def _handle_diagnose(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"detail": "Invalid request body."})

    if not isinstance(body, dict):
        return JSONResponse(status_code=400, content={"detail": "Invalid request body."})

    query = body.get("query")
    action = body.get("action")
    if (not query or not isinstance(query, str) or not query.strip()) and not action:
        return JSONResponse(status_code=400, content={"detail": "Query cannot be empty."})
    if not query:
        query = action or ""

    conversation_history = body.get("conversation_history")
    if conversation_history is not None and not isinstance(conversation_history, list):
        return JSONResponse(
            status_code=400,
            content={"detail": "conversation_history must be an array of messages."},
        )

    enable_privacy = body.get("enable_privacy", True)
    stack = body.get("stack", "")
    framework = body.get("framework")
    source = body.get("source", "user_pasted")
    state = body.get("state")
    case_summary = body.get("case_summary")
    language = body.get("language")

    context = {
        "stack": stack,
        "detectedFramework": framework,
        "source": source,
    }

    diagnosis = await engine.diagnose(
        user_input=query,
        enable_privacy=enable_privacy,
        conversation_history=conversation_history,
        context=context,
        state=state,
        case_summary=case_summary,
        language=language,
        action=action,
    )
    formatted = format_diagnostic_response(diagnosis)

    return {
        "success": True,
        "data": formatted,
    }


async def _handle_upload_log(file: UploadFile = File(None)):
    if not file:
        return JSONResponse(status_code=400, content={"detail": "No file uploaded."})

    contents = await file.read()
    if not contents or len(contents) == 0:
        return JSONResponse(status_code=400, content={"detail": "Uploaded file is empty."})

    if len(contents) > 2 * 1024 * 1024:
        return JSONResponse(
            status_code=413,
            content={"detail": "File exceeds maximum allowed size of 2MB."},
        )

    preview = contents[: min(len(contents), 1024)]
    if b"\x00" in preview:
        return JSONResponse(
            status_code=400,
            content={"detail": "Binary or executable file detected. Please upload a plain text (.log, .txt, .json) file."},
        )

    try:
        content_text = contents.decode("utf-8")
    except UnicodeDecodeError:
        content_text = contents.decode("utf-8", errors="replace")

    analysis = await engine.analyze_log_file(content_text)

    return {
        "success": True,
        "filename": file.filename or "uploaded.log",
        "analysis": analysis,
    }


async def _handle_presets():
    presets = engine.list_presets()
    return {"presets": presets}


async def _handle_knowledge():
    issues = [
        {
            "id": k.get("id"),
            "category": k.get("category"),
            "title": k.get("title"),
            "problem": k.get("problem"),
        }
        for k in engine.knowledge_base
    ]
    return {
        "total_issues": len(issues),
        "issues": issues,
    }


async def _handle_feedback(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"detail": "Invalid request body."})

    if not isinstance(body, dict):
        return JSONResponse(status_code=400, content={"detail": "Invalid request body."})

    if not isinstance(body.get("is_helpful"), bool):
        return JSONResponse(status_code=400, content={"detail": 'Field "is_helpful" must be a boolean.'})

    res = feedback_store.submit_feedback(body)
    return res


async def _handle_extension_diagnose(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"detail": "Invalid request body."})

    if not isinstance(body, dict):
        return JSONResponse(status_code=400, content={"detail": "Invalid request body."})

    error_text = body.get("error") or body.get("message") or body.get("query")
    if not error_text or not isinstance(error_text, str) or not error_text.strip():
        return JSONResponse(status_code=400, content={"detail": 'Field "error" or "message" is required.'})

    stack = body.get("stack", "")
    page_url = body.get("url", "")
    framework = body.get("framework")

    context = {
        "stack": stack,
        "detectedFramework": framework,
        "source": "browser_extension",
        "pageUrl": page_url,
    }

    diagnosis = await engine.diagnose(error_text, True, None, context)
    formatted = format_diagnostic_response(diagnosis)

    return {
        "success": True,
        "extension_mode": True,
        "data": formatted,
    }


# Route bindings: Direct (/diagnose) and Namespace (/frontfix/diagnose)
@router.post("/diagnose")
@router.post("/frontfix/diagnose")
async def diagnose_route(request: Request):
    return await _handle_diagnose(request)


@router.post("/upload-log")
@router.post("/frontfix/upload-log")
async def upload_log_route(file: UploadFile = File(None)):
    return await _handle_upload_log(file)


@router.get("/presets")
@router.get("/frontfix/presets")
async def presets_route():
    return await _handle_presets()


@router.get("/knowledge")
@router.get("/frontfix/knowledge")
async def knowledge_route():
    return await _handle_knowledge()


@router.post("/feedback")
@router.post("/frontfix/feedback")
async def feedback_route(request: Request):
    return await _handle_feedback(request)


@router.get("/feedback/stats")
@router.get("/frontfix/feedback/stats")
async def feedback_stats_route():
    return feedback_store.get_stats()


@router.post("/extension/diagnose")
@router.post("/frontfix/extension/diagnose")
async def extension_diagnose_route(request: Request):
    return await _handle_extension_diagnose(request)


@router.get("/frontfix/health")
@router.get("/frontfix/status")
async def frontfix_health_route():
    return {
        "app": "FrontFix AI Diagnostic Engine",
        "status": "online",
        "version": "3.0.0",
        "runtime": f"Python {platform.python_version()}",
        "knowledge_base_size": len(engine.knowledge_base),
        "llm_grounding_available": engine.llm_service.is_available(),
    }
