import os, sys
sys.path.insert(0, os.path.abspath('backend'))
from app.services.frontfix.evidence import EvidenceService

ev = EvidenceService.analyze("ok i opened my website and it is completely black so what happened", {})
print("EVIDENCE:")
import json
print(json.dumps(ev, indent=2))
