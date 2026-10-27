import os, sys, asyncio
sys.path.insert(0, os.path.abspath('backend'))
from app.api.frontfix import engine, _handle_diagnose
from starlette.requests import Request

async def run():
    q = "ok i opened my website and it is completely black so what happened"
    res = await engine.diagnose(user_input=q)
    print("res state:", res.get("state"))
    print("res response_type:", res.get("response_type"))
    print("res likely_cause:", res.get("likely_cause")[:60] if res.get("likely_cause") else None)
    print("res is_uncertain:", res.get("is_uncertain"))

asyncio.run(run())
