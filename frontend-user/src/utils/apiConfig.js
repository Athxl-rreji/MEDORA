// MEDORA Unified API Resolver
// Handles 3 environments seamlessly:
// 1. Cloud Production (Render Backend) -> connects to https://medora-backend-4q9x.onrender.com
// 2. Local Wi-Fi / Hotspot LAN (Mac/Phone connecting to host PC IP) -> connects to http://<PC-IP>:8000
// 3. Localhost Development (PC browser) -> connects to http://localhost:8000

export const CLOUD_BACKEND_URL = 'https://medora-backend-4q9x.onrender.com';

export const getApiUrl = () => {
  const envApi = process.env.NEXT_PUBLIC_API_URL;
  const isEnvLocal = !envApi || envApi.includes('localhost') || envApi.includes('127.0.0.1');

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;

    // Check if hostname is an IPv4 address (e.g. 172.20.10.2, 192.168.1.5)
    const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isMdns = host.endsWith('.local');

    // 1. If running on Vercel or any public domain name (e.g. *.vercel.app, *.app, etc.)
    if (host.includes('vercel.app') || (!isLocalhost && !isIpv4 && !isMdns)) {
      return (!isEnvLocal && envApi) ? envApi.replace(/\/+$/, '') : CLOUD_BACKEND_URL;
    }

    // 2. Wi-Fi / Hotspot LAN access from Mac / mobile device (e.g., 172.20.10.2:3000 -> 172.20.10.2:8000)
    if ((isIpv4 && !isLocalhost) || isMdns) {
      return `${window.location.protocol}//${host}:8000`;
    }

    // 3. Local laptop browser (localhost / 127.0.0.1)
    return (!isEnvLocal && envApi) ? envApi.replace(/\/+$/, '') : 'http://localhost:8000';
  }

  // Server-side rendering (SSR in Next.js / Vercel build time)
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return (!isEnvLocal && envApi) ? envApi.replace(/\/+$/, '') : CLOUD_BACKEND_URL;
  }

  return (envApi || 'http://localhost:8000').replace(/\/+$/, '');
};

export const API = getApiUrl();
export default getApiUrl;
