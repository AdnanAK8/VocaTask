import sys, asyncio
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, "backend")
from app.services.frontfix.engine import DiagnosticEngine

async def run():
    e = DiagnosticEngine()
    context = {"stack": "", "detectedFramework": None, "source": "user_pasted"}
    res = await e.diagnose(
        user_input="Website not working",
        enable_privacy=True,
        conversation_history=[{"role": "user", "content": "Website not working"}],
        context=context,
        state="UNDERSTAND_PROBLEM",
        case_summary=None,
        language="auto",
        action=None
    )
    print("res state:", res.get("state"))
    print("res response_type:", res.get("response_type"))
    print("res title:", res.get("title"))
    print("res generated_by:", res.get("generated_by"))

asyncio.run(run())
