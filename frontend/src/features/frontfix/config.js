const PROD_API_URL = window.__FRONTFIX_API_URL__ || '';
const LOCAL_API_URL = window.__FRONTFIX_API_URL__ || '';

export function resolveBackendUrl() {
  if (window.__FRONTFIX_API_URL__) return window.__FRONTFIX_API_URL__;

  const { hostname, protocol, port, origin } = window.location;

  // Local dev: Vite proxies /api to FastAPI backend on port 8000
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'file:') {
    return LOCAL_API_URL;
  }

  // Static external hosts without local backend
  const isStaticHost = ['github.io', 'netlify.app', 'vercel.app'].some((h) => origin?.includes(h));
  if (isStaticHost) return 'https://frontfix-api.onrender.com';

  return origin || '';
}

export const BACKEND_URL = resolveBackendUrl();
