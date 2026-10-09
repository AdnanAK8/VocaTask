import unittest
from datetime import datetime
import zoneinfo
from app.services.ai_parser import heuristic_parse_task

class TestUserVoiceExamples(unittest.TestCase):
    def setUp(self):
        self.tz = zoneinfo.ZoneInfo("Asia/Kolkata")
        self.ref_dt = datetime(2026, 10, 6, 9, 0, 0, tzinfo=self.tz)

    def test_database_assignment_hinglish(self):
        # "Kal subah 10 baje database ka assignment submit karna hai."
        res = heuristic_parse_task("Kal subah 10 baje database ka assignment submit karna hai.", self.ref_dt)
        self.assertEqual(res["title"], "Submit Database Assignment")
        self.assertEqual(res["scheduled_date"], "2026-10-07")
        self.assertEqual(res["scheduled_time"], "10:00")
        self.assertEqual(res["category"], "study")

    def test_call_mom_english(self):
        # "Remind me to call mom tomorrow evening."
        res = heuristic_parse_task("Remind me to call mom tomorrow evening.", self.ref_dt)
        self.assertEqual(res["title"], "Call Mom")
        self.assertEqual(res["scheduled_date"], "2026-10-07")
        self.assertEqual(res["scheduled_time"], "18:00")
        self.assertEqual(res["category"], "personal")

    def test_gym_hindi(self):
        # "कल शाम 6 बजे gym जाना है"
        res = heuristic_parse_task("कल शाम 6 बजे gym जाना है", self.ref_dt)
        self.assertEqual(res["title"], "Gym")
        self.assertEqual(res["scheduled_date"], "2026-10-07")
        self.assertEqual(res["scheduled_time"], "18:00")
        self.assertEqual(res["category"], "health")

    def test_gym_punjabi(self):
        # "ਕੱਲ੍ਹ ਸ਼ਾਮ 7 ਵਜੇ gym ਜਾਣਾ ਹੈ"
        res = heuristic_parse_task("ਕੱਲ੍ਹ ਸ਼ਾਮ 7 ਵਜੇ gym ਜਾਣਾ ਹੈ", self.ref_dt)
        self.assertEqual(res["title"], "Gym")
        self.assertEqual(res["scheduled_date"], "2026-10-07")
        self.assertEqual(res["scheduled_time"], "19:00")
        self.assertEqual(res["category"], "health")

    def test_dbms_study_hinglish(self):
        # "Kal shaam 8 baje DBMS padhna hai"
        res = heuristic_parse_task("Kal shaam 8 baje DBMS padhna hai", self.ref_dt)
        self.assertEqual(res["title"], "Study DBMS")
        self.assertEqual(res["scheduled_date"], "2026-10-07")
        self.assertEqual(res["scheduled_time"], "20:00")
        self.assertEqual(res["category"], "study")

    def test_call_rahul(self):
        # "Call Rahul at 6 PM"
        res = heuristic_parse_task("Call Rahul at 6 PM", self.ref_dt)
        self.assertEqual(res["title"], "Call Rahul")
        self.assertEqual(res["scheduled_time"], "18:00")

    def test_gym_at_7pm(self):
        # "Gym at 7 PM"
        res = heuristic_parse_task("Gym at 7 PM", self.ref_dt)
        self.assertEqual(res["title"], "Gym")
        self.assertEqual(res["scheduled_time"], "19:00")
        self.assertEqual(res["category"], "health")

    def test_seminar_october_21st(self):
        # "21st October I have a seminar."
        res = heuristic_parse_task("21st October I have a seminar.", self.ref_dt)
        self.assertEqual(res["title"], "Attend Seminar")
        self.assertEqual(res["scheduled_date"], "2026-10-21")
        self.assertNotEqual(res["scheduled_time"], "21:00")
        self.assertEqual(res["category"], "study")

    def test_workshop_november(self):
        # "15th November workshop"
        res = heuristic_parse_task("15th November workshop", self.ref_dt)
        self.assertEqual(res["title"], "Attend Workshop")
        self.assertEqual(res["scheduled_date"], "2026-11-15")
        self.assertEqual(res["category"], "study")

if __name__ == '__main__':
    unittest.main()
