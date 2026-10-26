import { useEffect, useState } from 'react';
import { BACKEND_URL } from '../config.js';

// Pings the backend every `intervalMs` and reports whether FrontFix AI backend is reachable.
export default function useBackendStatus(intervalMs = 6000) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      let ok = false;
      const baseUrl = BACKEND_URL || '';

      try {
        // Primary check: FrontFix health endpoint
        const res = await fetch(`${baseUrl}/api/frontfix/health`, { method: 'GET' });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          ok = Boolean(data && (data.status === 'ok' || data.status === 'online'));
        }
      } catch {
        ok = false;
      }

      if (!ok) {
        try {
          // Secondary fallback: Main unified API health endpoint
          const res = await fetch(`${baseUrl}/api/health`, { method: 'GET' });
          if (res.ok) {
            const data = await res.json().catch(() => null);
            ok = Boolean(data && (data.status === 'ok' || data.status === 'online'));
          }
        } catch {
          ok = false;
        }
      }

      if (!cancelled) setOnline(ok);
    }

    check();
    const id = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return online;
}
