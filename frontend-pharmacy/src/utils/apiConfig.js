// Dynamic API resolver: automatically routes API requests to the host machine's IP (for Mac/mobile on WiFi)
// or uses the production cloud URL when deployed.
export const getApiUrl = () => {
  const envApi = process.env.NEXT_PUBLIC_API_URL;
  const isLocalEnv = !envApi || envApi.includes('localhost') || envApi.includes('127.0.0.1');
  
  if (!isLocalEnv) {
    return envApi.replace(/\/+$/, '');
  }
  
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${window.location.protocol}//${host}:8000`;
    }
  }
  
  return (envApi || 'http://localhost:8000').replace(/\/+$/, '');
};

export const API = getApiUrl();
export default getApiUrl;
