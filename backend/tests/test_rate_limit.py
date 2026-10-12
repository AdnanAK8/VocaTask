import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.middleware.cors import CORSMiddleware

from app.core.rate_limit import RateLimitMiddleware


class TestRateLimitMiddleware(unittest.TestCase):
    def test_voice_limit_returns_429_and_retry_after(self):
        app = FastAPI()
        app.add_middleware(
            RateLimitMiddleware,
            requests_per_minute=10,
            voice_requests_per_minute=1,
            audio_requests_per_minute=1,
        )
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["https://frontend.example"],
            allow_methods=["GET"],
            allow_headers=["*"],
        )

        @app.get("/api/voice/status")
        async def voice_status():
            return {"status": "ok"}

        client = TestClient(app)
        self.assertEqual(client.get("/api/voice/status").status_code, 200)

        limited_response = client.get(
            "/api/voice/status",
            headers={"Origin": "https://frontend.example"},
        )
        self.assertEqual(limited_response.status_code, 429)
        self.assertIn("retry-after", limited_response.headers)
        self.assertEqual(
            limited_response.headers.get("access-control-allow-origin"),
            "https://frontend.example",
        )


if __name__ == "__main__":
    unittest.main()
