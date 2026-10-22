const PROD_API_URL = window.__FRONTFIX_API_URL__ || 'https://frontfix-api.onrender.com';
const LOCAL_API_URL = window.__FRONTFIX_API_URL__ || 'http://127.0.0.1:8001';

export function resolveBackendUrl() {
  if (window.__FRONTFIX_API_URL__) return window.__FRONTFIX_API_URL__;

  const { hostname, protocol, port, origin } = window.location;

  // Local dev (Vite runs on 5173, FrontFix backend on 8001)
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'file:') {
    if (port === '8001') return origin;
    return LOCAL_API_URL;
  }

  // Static hosts have no backend of their own -> use the production API
  const isStaticHost = ['github.io', 'netlify.app', 'vercel.app'].some((h) => origin.includes(h));
  if (isStaticHost) return PROD_API_URL;

  return origin;
}

export const BACKEND_URL = resolveBackendUrl();
