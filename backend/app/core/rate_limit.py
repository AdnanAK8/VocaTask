from collections import deque
from time import monotonic

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        requests_per_minute: int = 120,
        voice_requests_per_minute: int = 20,
        audio_requests_per_minute: int = 5,
        window_seconds: int = 60,
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.voice_requests_per_minute = voice_requests_per_minute
        self.audio_requests_per_minute = audio_requests_per_minute
        self.window_seconds = window_seconds
        self.requests: dict[tuple[str, str], deque[float]] = {}
        self.request_count = 0

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not path.startswith("/api/") or request.method == "OPTIONS":
            return await call_next(request)

        if path == "/api/voice/process-audio":
            bucket, limit = "audio", self.audio_requests_per_minute
        elif path.startswith("/api/voice/"):
            bucket, limit = "voice", self.voice_requests_per_minute
        else:
            bucket, limit = "api", self.requests_per_minute

        client_ip = request.client.host if request.client else "unknown"
        key = (client_ip, bucket)
        now = monotonic()
        timestamps = self.requests.setdefault(key, deque())
        while timestamps and now - timestamps[0] >= self.window_seconds:
            timestamps.popleft()

        if len(timestamps) >= limit:
            retry_after = max(
                1,
                int(self.window_seconds - (now - timestamps[0])),
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please retry later."},
                headers={"Retry-After": str(retry_after)},
            )

        timestamps.append(now)
        self.request_count += 1
        if self.request_count % 256 == 0:
            expired_keys = [
                request_key
                for request_key, values in self.requests.items()
                if not values or now - values[-1] >= self.window_seconds
            ]
            for request_key in expired_keys:
                del self.requests[request_key]

        return await call_next(request)
