import { useEffect, useState } from 'react';
import { BACKEND_URL } from '../config.js';

// Pings the backend every `intervalMs` and reports whether FrontFix AI backend is reachable.
export default function useBackendStatus(intervalMs = 6000) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      let ok = false;
      try {
        const res = await fetch(`${BACKEND_URL}/`, { method: 'GET' });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          ok = Boolean(data && (data.app?.includes('FrontFix') || data.team?.includes('Frontend Support') || data.status === 'online'));
        }
      } catch {
        ok = false;
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
