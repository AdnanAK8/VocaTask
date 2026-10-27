import sys, asyncio
sys.path.insert(0, "backend")
from app.services.frontfix.engine import DiagnosticEngine

async def run():
    e = DiagnosticEngine()
    res = await e.diagnose("Website not working")
    print("res keys:", list(res.keys()))
    print("state:", res.get("state"))
    print("response_type:", res.get("response_type"))
    print("title:", res.get("title"))
    print("code_before:", bool(res.get("code_before")))

asyncio.run(run())
