import unittest
from fastapi.testclient import TestClient
from app.main import app

class TestVoiceEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_process_text_hinglish(self):
        payload = {
            "text": "Kal subah 10 baje database assignment submit karna hai",
            "user_timezone": "Asia/Kolkata"
        }
        res = self.client.post("/api/voice/process-text", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("title", data)
        self.assertEqual(data["category"], "study")
        self.assertEqual(data["scheduled_time"], "10:00")
        self.assertEqual(data["language"], "hinglish")

    def test_process_text_hindi(self):
        payload = {
            "text": "कल शाम 6 बजे gym जाना है",
            "user_timezone": "Asia/Kolkata"
        }
        res = self.client.post("/api/voice/process-text", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["category"], "health")
        self.assertEqual(data["scheduled_time"], "18:00")
        self.assertEqual(data["language"], "hi")

    def test_process_text_punjabi(self):
        payload = {
            "text": "ਕੱਲ੍ਹ ਸ਼ਾਮ 7 ਵਜੇ gym ਜਾਣਾ ਹੈ",
            "user_timezone": "Asia/Kolkata"
        }
        res = self.client.post("/api/voice/process-text", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["category"], "health")
        self.assertEqual(data["scheduled_time"], "19:00")
        self.assertEqual(data["language"], "pa")

    def test_process_text_english(self):
        payload = {
            "text": "Remind me to call mom tomorrow at 6 PM",
            "user_timezone": "Asia/Kolkata"
        }
        res = self.client.post("/api/voice/process-text", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["category"], "personal")
        self.assertEqual(data["scheduled_time"], "18:00")
        self.assertEqual(data["language"], "en")

    def test_process_text_empty(self):
        payload = {
            "text": "   ",
            "user_timezone": "Asia/Kolkata"
        }
        res = self.client.post("/api/voice/process-text", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot be empty", res.json()["detail"])

if __name__ == "__main__":
    unittest.main()
