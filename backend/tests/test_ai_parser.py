import unittest
import asyncio
from datetime import datetime, timedelta, date
from app.services.ai_parser import (
    polish_task_title,
    heuristic_parse_task,
    parse_voice_to_task
)
from app.schemas.task import ExtractedTask

class TestAiParser(unittest.TestCase):
    def setUp(self):
        # Reference date: Monday, 2026-10-05 14:00:00
        self.ref_dt = datetime(2026, 10, 5, 14, 0, 0)

    def test_polish_task_title(self):
        self.assertEqual(polish_task_title("uthana college ke liye"), "Wake up for College")
        self.assertEqual(polish_task_title("college ke liye uthna"), "Wake up for College")
        self.assertEqual(polish_task_title("uthna hai"), "Wake up")
        self.assertEqual(polish_task_title("database ka assignment submit"), "Submit Database Assignment")
        self.assertEqual(polish_task_title("rahul ko call"), "Call Rahul")
        self.assertEqual(polish_task_title("gym jana"), "Gym")

    def test_heuristic_date_resolution(self):
        # 'kal' should be ref_dt + 1 day
        res_kal = heuristic_parse_task("kal meeting hai", self.ref_dt)
        expected_kal = str((self.ref_dt + timedelta(days=1)).date())
        self.assertEqual(res_kal["scheduled_date"], expected_kal)

        # 'parson' should be ref_dt + 2 days
        res_parson = heuristic_parse_task("parson exam hai", self.ref_dt)
        expected_parson = str((self.ref_dt + timedelta(days=2)).date())
        self.assertEqual(res_parson["scheduled_date"], expected_parson)

        # 'aaj' should be ref_dt date
        res_aaj = heuristic_parse_task("aaj bill pay karna hai", self.ref_dt)
        expected_aaj = str(self.ref_dt.date())
        self.assertEqual(res_aaj["scheduled_date"], expected_aaj)

        # Hindi & Punjabi script dates
        res_hi = heuristic_parse_task("कल डॉक्टर के पास जाना है", self.ref_dt)
        self.assertEqual(res_hi["scheduled_date"], expected_kal)

        res_pa = heuristic_parse_task("ਕੱਲ੍ਹ ਸ਼ਾਮ gym ਜਾਣਾ ਹੈ", self.ref_dt)
        self.assertEqual(res_pa["scheduled_date"], expected_kal)

    def test_heuristic_time_resolution(self):
        # Morning 10 am
        res_morn = heuristic_parse_task("kal subah 10 baje class", self.ref_dt)
        self.assertEqual(res_morn["scheduled_time"], "10:00")

        # Evening 6 pm (shaam 6 baje -> 18:00)
        res_eve = heuristic_parse_task("kal shaam 6 baje gym", self.ref_dt)
        self.assertEqual(res_eve["scheduled_time"], "18:00")

        # Night 9 pm (raat 9 baje -> 21:00)
        res_night = heuristic_parse_task("aaj raat 9 baje dinner", self.ref_dt)
        self.assertEqual(res_night["scheduled_time"], "21:00")

        # Hindi word number (सात बजे शाम -> 19:00)
        res_hi_time = heuristic_parse_task("कल शाम सात बजे gym जाना है", self.ref_dt)
        self.assertEqual(res_hi_time["scheduled_time"], "19:00")

        # Colloquial modifier: dedh baje (1:30)
        res_dedh = heuristic_parse_task("dedh baje call karna", self.ref_dt)
        self.assertEqual(res_dedh["scheduled_time"], "01:30")

    def test_category_detection(self):
        # Study
        self.assertEqual(heuristic_parse_task("database assignment submission", self.ref_dt)["category"], "study")
        self.assertEqual(heuristic_parse_task("dbms test preparation", self.ref_dt)["category"], "study")
        
        # Health
        self.assertEqual(heuristic_parse_task("gym workout session", self.ref_dt)["category"], "health")
        self.assertEqual(heuristic_parse_task("take medicine", self.ref_dt)["category"], "health")

        # Personal
        self.assertEqual(heuristic_parse_task("call mom and dad", self.ref_dt)["category"], "personal")
        self.assertEqual(heuristic_parse_task("rahul ko call karna hai", self.ref_dt)["category"], "personal")

        # Finance
        self.assertEqual(heuristic_parse_task("pay electricity bill", self.ref_dt)["category"], "finance")
        self.assertEqual(heuristic_parse_task("mobile recharge", self.ref_dt)["category"], "finance")

        # Work
        self.assertEqual(heuristic_parse_task("client presentation meeting", self.ref_dt)["category"], "work")

    def test_priority_detection(self):
        self.assertEqual(heuristic_parse_task("urgent client meeting", self.ref_dt)["priority"], "high")
        self.assertEqual(heuristic_parse_task("bohot zaroori kaam hai kal", self.ref_dt)["priority"], "high")
        self.assertEqual(heuristic_parse_task("emergency doctor appointment", self.ref_dt)["priority"], "high")
        self.assertEqual(heuristic_parse_task("kabhi bhi padh lenge", self.ref_dt)["priority"], "low")
        self.assertEqual(heuristic_parse_task("fursat me call karna", self.ref_dt)["priority"], "low")
        self.assertEqual(heuristic_parse_task("regular task to do", self.ref_dt)["priority"], "medium")

    def test_relative_time_and_weekday_resolution(self):
        # Relative minutes
        res_30m = heuristic_parse_task("call rahul in 30 minutes", self.ref_dt)
        self.assertEqual(res_30m["scheduled_time"], "14:30")

        # Relative hours
        res_1h = heuristic_parse_task("submit report 1 ghante baad", self.ref_dt)
        self.assertEqual(res_1h["scheduled_time"], "15:00")

        # Weekday: Friday (self.ref_dt is Monday Oct 5 -> Friday is Oct 9)
        res_fri = heuristic_parse_task("friday ko meeting hai", self.ref_dt)
        self.assertEqual(res_fri["scheduled_date"], "2026-10-09")

        # Weekday Hindi: shukrawar
        res_shukra = heuristic_parse_task("शुक्रवार को टेस्ट है", self.ref_dt)
        self.assertEqual(res_shukra["scheduled_date"], "2026-10-09")

    def test_language_detection(self):
        self.assertEqual(heuristic_parse_task("ਕੱਲ੍ਹ ਸ਼ਾਮ 7 ਵਜੇ gym ਜਾਣਾ ਹੈ", self.ref_dt)["language"], "pa")
        self.assertEqual(heuristic_parse_task("कल शाम 6 बजे gym जाना है", self.ref_dt)["language"], "hi")
        self.assertEqual(heuristic_parse_task("kal subah 10 baje kaam karna hai", self.ref_dt)["language"], "hinglish")
        self.assertEqual(heuristic_parse_task("Call John tomorrow morning", self.ref_dt)["language"], "en")

    def test_async_parse_voice_to_task_fallback(self):
        async def run_test():
            task = await parse_voice_to_task(
                transcript="Kal subah 10 baje database ka assignment submit karna hai",
                timezone_name="Asia/Kolkata"
            )
            self.assertIsInstance(task, ExtractedTask)
            self.assertEqual(task.category, "study")
            self.assertEqual(task.scheduled_time, "10:00")
            self.assertIn("Submit Database Assignment", task.title)
        
        asyncio.run(run_test())

if __name__ == "__main__":
    unittest.main()
