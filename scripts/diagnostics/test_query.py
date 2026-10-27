import sys
sys.path.insert(0, "backend")
from app.services.frontfix.engine import DiagnosticEngine

e = DiagnosticEngine()
print("Website not working ->", e.is_insufficient_query("Website not working"))
print("ok i opened my website and it is completely black so what happened ->", e.is_insufficient_query("ok i opened my website and it is completely black so what happened"))
