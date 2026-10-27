import os, sys, asyncio
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.abspath('backend'))
from app.services.frontfix.engine import DiagnosticEngine

async def run():
    e = DiagnosticEngine()
    q = "ok i opened my website and it is completely black so what happened"
    res = await e.diagnose(q)
    print("Direct diagnose:")
    print("  state:", res.get("state"))
    print("  generated_by:", res.get("generated_by"))
    print("  model_label:", res.get("model_label"))
    print("  likely_cause:", res.get("likely_cause"))

asyncio.run(run())
