import sys, urllib.request, json
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

payload = {
    "query": "Website not working",
    "enable_privacy": True,
    "conversation_history": [{"role": "user", "content": "Website not working"}],
    "state": "UNDERSTAND_PROBLEM",
    "case_summary": None,
    "language": "auto",
    "action": None
}

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/diagnose",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print("SUCCESS:")
        print("keys:", list(data.get("data", {}).keys()))
        print("title:", data.get("data", {}).get("title"))
        print("state:", data.get("data", {}).get("state"))
        print("response_type:", data.get("data", {}).get("response_type"))
        print("problem:", data.get("data", {}).get("problem"))
        print("code_before:", data.get("data", {}).get("code_before"))
        print("fix_steps:", data.get("data", {}).get("fix_steps"))
except Exception as e:
    print("ERROR:", e)
