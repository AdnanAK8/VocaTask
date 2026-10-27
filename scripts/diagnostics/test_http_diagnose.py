import sys, requests
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

url = "http://127.0.0.1:8000/api/diagnose"

for q in [
    "Website not working",
    "ok i opened my website and it is completely black so what happened",
    "API or backend problem"
]:
    try:
        r = requests.post(url, json={"query": q}, timeout=5)
        d = r.json()["data"]
        print(f"\nQUERY: {q}")
        print("  state:", d.get("state"))
        print("  response_type:", d.get("response_type"))
        print("  greeting:", d.get("greeting"))
        print("  question:", d.get("follow_up_question"))
        print("  options count:", len(d.get("interactive_options", [])))
        print("  has code_after:", bool(d.get("code_after")))
    except requests.exceptions.RequestException as e:
        print(f"\nQUERY: {q} -> Server connection failed: {e}")
