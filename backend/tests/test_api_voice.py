import unittest
from unittest.mock import patch, AsyncMock
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

    def test_cors_allows_configured_origin(self):
        test_origin = "http://localhost:5173"
        res = self.client.options(
            "/api/voice/process-text",
            headers={
                "Origin": test_origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,"
                "x-user-timezone",
            },
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            res.headers.get("access-control-allow-origin"),
            test_origin,
        )

    @patch("app.api.voice.transcribe_audio_file", new_callable=AsyncMock)
    def test_process_audio_success(self, mock_transcribe):
        mock_transcribe.return_value = "Kal subah 10 baje database ka assignment submit karna hai"
        
        dummy_audio = b"RIFF....WAVEfmt ....data...."
        files = {"file": ("recording.webm", dummy_audio, "audio/webm")}
        data = {"user_timezone": "Asia/Kolkata", "language": "en-IN"}

        res = self.client.post("/api/voice/process-audio", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        json_data = res.json()
        self.assertEqual(json_data["category"], "study")
        self.assertEqual(json_data["scheduled_time"], "10:00")
        self.assertIn("Submit Database Assignment", json_data["title"])

    @patch("app.api.voice.transcribe_audio_file", new_callable=AsyncMock)
    @patch("google.genai.Client")
    def test_process_audio_with_gemini_cloud_stt(self, mock_genai_cls, mock_transcribe):
        # Simulate Cloud Speech-to-Text producing transcribed text from spoken audio
        mock_transcribe.return_value = "Kal shaam 7 baje gym jana hai bohot zaroori hai"

        # Mock Gemini structured JSON response
        mock_client = mock_genai_cls.return_value
        mock_response = unittest.mock.MagicMock()
        mock_response.text = '{"title": "Gym Workout", "description": "Going to gym", "scheduled_date": "2026-10-09", "scheduled_time": "19:00", "priority": "high", "category": "health", "reminder_required": true, "language": "hinglish"}'
        mock_client.models.generate_content.return_value = mock_response

        dummy_audio = b"\x1a\x45\xdf\xa3webm-test-audio-bytes"
        files = {"file": ("voice_recording.webm", dummy_audio, "audio/webm")}
        data = {"user_timezone": "Asia/Kolkata", "language": "hinglish"}
        headers = {"X-Gemini-Key": "AIzaSyTestGeminiValidKeyMock12345678"}

        res = self.client.post("/api/voice/process-audio", files=files, data=data, headers=headers)
        self.assertEqual(res.status_code, 200)
        json_data = res.json()
        # Verifies audio -> cloud transcribed text -> AI structured task
        self.assertEqual(json_data["original_transcript"], "Kal shaam 7 baje gym jana hai bohot zaroori hai")
        self.assertEqual(json_data["category"], "health")
        self.assertEqual(json_data["scheduled_time"], "19:00")
        self.assertEqual(json_data["priority"], "high")
        self.assertIn("Gym", json_data["title"])

    def test_improved_metrics_priority_and_time(self):
        # Test urgent task priority detection
        res1 = self.client.post("/api/voice/process-text", json={
            "text": "Emergency doctor appointment tomorrow at 11 AM",
            "user_timezone": "Asia/Kolkata"
        })
        self.assertEqual(res1.status_code, 200)
        d1 = res1.json()
        self.assertEqual(d1["priority"], "high")
        self.assertEqual(d1["category"], "health")
        self.assertEqual(d1["scheduled_time"], "11:00")
        self.assertEqual(d1["title"], "Visit Doctor")

        # Test low priority casual task
        res2 = self.client.post("/api/voice/process-text", json={
            "text": "Call mom tomorrow evening whenever free casual",
            "user_timezone": "Asia/Kolkata"
        })
        self.assertEqual(res2.status_code, 200)
        d2 = res2.json()
        self.assertEqual(d2["priority"], "low")
        self.assertEqual(d2["title"], "Call Mom")

        # Test finance bill payment
        res3 = self.client.post("/api/voice/process-text", json={
            "text": "Bijli ka bill pay karna hai kal shaam 6 baje",
            "user_timezone": "Asia/Kolkata"
        })
        self.assertEqual(res3.status_code, 200)
        d3 = res3.json()
        self.assertEqual(d3["category"], "finance")
        self.assertEqual(d3["scheduled_time"], "18:00")
        self.assertIn("Pay", d3["title"])

if __name__ == "__main__":
    unittest.main()
