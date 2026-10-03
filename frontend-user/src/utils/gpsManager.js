// MEDORA Universal GPS & Multi-Device Navigation Engine
// Supports:
// 1. Mobile browsers (iOS Safari, Android Chrome, WebView)
// 2. Desktop & laptop browsers (Wi-Fi positioning, fallback without satellite chip)
// 3. Local LAN / HTTP development (auto-switches to IP geolocation when navigator.geolocation is restricted)
// 4. Cloud HTTPS environments (Vercel)

export const DEFAULT_MANGALORE_HUB = {
  lat: 12.9298,
  lng: 74.8967,
  area: "Airport Road, Vamanjoor",
  city: "Mangalore",
  state: "Karnataka",
  pincode: "575028",
  accuracy: 15
};

export const PHARMACY_DIRECTORY = {
  "PHARM_001": {
    id: "PHARM_001",
    name: "Vamanjoor Express Pharmacy",
    address: "Airport Road, Vamanjoor, Mangalore, Karnataka 575028",
    lat: 12.9298,
    lng: 74.8967,
    phone: "+91 824 228 1111"
  },
  "PHARM_002": {
    id: "PHARM_002",
    name: "Kadri Health Mart & 24x7 Chemist",
    address: "Kadri Temple Road, Kadri Hills, Mangalore, Karnataka 575002",
    lat: 12.8900,
    lng: 74.8600,
    phone: "+91 824 221 2222"
  },
  "PHARM_003": {
    id: "PHARM_003",
    name: "City Central Apex Pharmacy",
    address: "Hampankatta Apex Circle, MG Road, Mangalore, Karnataka 575001",
    lat: 12.8700,
    lng: 74.8400,
    phone: "+91 824 244 3333"
  }
};

/**
 * Resolves a pharmacy identifier or name to exact street address and coordinates.
 */
export function resolvePharmacyDetails(pharmacyIdOrName) {
  if (!pharmacyIdOrName) return PHARMACY_DIRECTORY["PHARM_001"];

  const idMatch = Object.keys(PHARMACY_DIRECTORY).find(k => k.toLowerCase() === String(pharmacyIdOrName).trim().toLowerCase());
  if (idMatch) return PHARMACY_DIRECTORY[idMatch];

  const nameLower = String(pharmacyIdOrName).toLowerCase();
  if (nameLower.includes("kadri")) return PHARMACY_DIRECTORY["PHARM_002"];
  if (nameLower.includes("hampankatta") || nameLower.includes("central") || nameLower.includes("apex")) return PHARMACY_DIRECTORY["PHARM_003"];

  return {
    id: "PHARM_CUSTOM",
    name: pharmacyIdOrName,
    address: `${pharmacyIdOrName}, Mangalore, Karnataka`,
    lat: 12.9298,
    lng: 74.8967,
    phone: "+91 824 228 1111"
  };
}

/**
 * Universal Device Location Detector
 * 1. Tries Browser Geolocation (adaptive timeout, relaxed accuracy for instant response)
 * 2. If blocked, non-secure HTTP, or times out, seamlessly falls back to IP Geolocation
 * 3. Never throws an uncaught error or leaves the user stuck.
 */
export async function detectDeviceLocation(options = {}) {
  const { timeoutMs = 6000, highAccuracy = false } = options;

  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) {
    return { ...DEFAULT_MANGALORE_HUB, source: 'ssr_default', success: true };
  }

  const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // 1. Try Browser Geolocation API if available and in secure context
  if (isSecure && navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("GEOLOCATION_TIMEOUT"));
        }, timeoutMs);

        navigator.geolocation.getCurrentPosition(
          (p) => {
            clearTimeout(timer);
            resolve(p);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: timeoutMs,
            maximumAge: 120000 // Cache up to 2 mins for instant retrieval
          }
        );
      });

      if (pos?.coords) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 15);
        return {
          lat,
          lng,
          accuracy,
          source: 'device_gps',
          isSecure: true,
          success: true
        };
      }
    } catch (geoErr) {
      // Browser GPS denied, timed out, or unavailable -> seamlessly fallback to IP
      console.info("Hardware GPS unavailable or timed out. Transitioning to Network Geolocation...", geoErr?.message || geoErr);
    }
  }

  // 2. IP-Based Geolocation Fallback (Works on mobile Wi-Fi, HTTP, and desktops without GPS)
  try {
    const ipRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4500) });
    if (ipRes.ok) {
      const data = await ipRes.json();
      if (data.latitude && data.longitude) {
        return {
          lat: parseFloat(data.latitude),
          lng: parseFloat(data.longitude),
          accuracy: 150,
          city: data.city || 'Mangalore',
          state: data.region || 'Karnataka',
          source: 'network_ip',
          isSecure,
          success: true
        };
      }
    }
  } catch (ipErr) {
    // Second IP provider attempt
    try {
      const bdcRes = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client', { signal: AbortSignal.timeout(4000) });
      if (bdcRes.ok) {
        const data = await bdcRes.json();
        if (data.latitude && data.longitude) {
          return {
            lat: parseFloat(data.latitude),
            lng: parseFloat(data.longitude),
            accuracy: 250,
            city: data.city || data.locality || 'Mangalore',
            state: data.principalSubdivision || 'Karnataka',
            source: 'network_ip',
            isSecure,
            success: true
          };
        }
      }
    } catch (e) {}
  }

  // 3. Fallback Hub (Guaranteed coordinates)
  return {
    ...DEFAULT_MANGALORE_HUB,
    source: 'hub_fallback',
    isSecure,
    success: true
  };
}

/**
 * Resilient Multi-Provider Reverse Geocoding
 * Translates [lat, lng] into road, suburb, city, and formatted area name.
 */
export async function reverseGeocode(lat, lng) {
  if (!lat || !lng) return DEFAULT_MANGALORE_HUB;

  // 1. BigDataCloud Client Reverse Geocode (free, high-speed, CORS-friendly)
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (bdcRes.ok) {
      const data = await bdcRes.json();
      const city = data.city || data.locality || 'Mangalore';
      const locality = data.locality || data.neighbourhood || '';
      const state = data.principalSubdivision || 'Karnataka';
      const postcode = data.postcode || '';
      const area = locality ? (city && !locality.toLowerCase().includes(city.toLowerCase()) ? `${locality}, ${city}` : locality) : city;

      return {
        road: '',
        suburb: locality,
        city,
        state,
        pincode: postcode || '575028',
        area: area || 'Airport Road, Vamanjoor',
        displayName: `${area}, ${city}, ${data.countryName || 'India'}`,
        source: 'bigdatacloud'
      };
    }
  } catch (e) {}

  // 2. OpenStreetMap Nominatim
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(4000) }
    );
    if (nomRes.ok) {
      const data = await nomRes.json();
      const addr = data.address || {};
      const road = addr.road || addr.pedestrian || addr.street || '';
      const suburb = addr.suburb || addr.neighbourhood || addr.residential || addr.subdistrict || '';
      const city = addr.city || addr.town || addr.county || addr.state_district || 'Mangalore';
      const state = addr.state || 'Karnataka';
      const postcode = addr.postcode || '';
      const area = road ? (suburb ? `${road}, ${suburb}` : road) : (suburb || city);

      return {
        road,
        suburb,
        city,
        state,
        pincode: postcode || '575028',
        area: `${area}, ${city}`,
        displayName: data.display_name || `${area}, ${city}`,
        source: 'nominatim'
      };
    }
  } catch (e) {}

  // 3. Coordinate-based Local Interpolation (Mangalore coastal hub)
  const isMangaloreRegion = lat >= 12.7 && lat <= 13.2 && lng >= 74.7 && lng <= 75.1;
  if (isMangaloreRegion) {
    let localArea = "Airport Road, Vamanjoor";
    if (lat > 12.92) localArea = "Vamanjoor - SJEC Junction";
    else if (lat > 12.89) localArea = "Kadri Hills / Mallikatte";
    else if (lat > 12.87) localArea = "Hampankatta / KS Rao Road";
    else localArea = "Kankanady / Pumpwell Circle";

    return {
      road: "Airport Road",
      suburb: localArea,
      city: "Mangalore",
      state: "Karnataka",
      pincode: "575028",
      area: `${localArea}, Mangalore`,
      displayName: `${localArea}, Mangalore, Karnataka`,
      source: 'regional_classifier'
    };
  }

  // 4. Default return
  return {
    road: '',
    suburb: 'Local Area',
    city: 'Mangalore',
    state: 'Karnataka',
    pincode: '575028',
    area: 'Airport Road, Vamanjoor',
    displayName: 'Airport Road, Vamanjoor, Mangalore',
    source: 'offline_fallback'
  };
}

/**
 * Builds reliable, turn-by-turn multi-app navigation URLs
 * Compatible with Android, iOS, Windows, Mac (Google Maps, Apple Maps, Waze)
 */
export function buildNavigationLinks(pickupInfo, dropoffInfo) {
  const pickup = typeof pickupInfo === 'string' ? resolvePharmacyDetails(pickupInfo) : (pickupInfo || PHARMACY_DIRECTORY["PHARM_001"]);
  const dropoff = dropoffInfo || {};

  // Formulate Origin
  let originParam = "";
  if (pickup.lat && pickup.lng) {
    originParam = `${pickup.lat},${pickup.lng}`;
  } else if (pickup.address) {
    originParam = encodeURIComponent(pickup.address);
  } else {
    originParam = "12.9298,74.8967";
  }

  // Formulate Destination
  let destParam = "";
  if (dropoff.latitude && dropoff.longitude) {
    destParam = `${dropoff.latitude},${dropoff.longitude}`;
  } else if (dropoff.houseNo || dropoff.area || dropoff.city) {
    const cleanParts = [dropoff.houseNo, dropoff.area, dropoff.city, "Mangalore"].filter(Boolean);
    destParam = encodeURIComponent(cleanParts.join(", "));
  } else {
    destParam = "12.9141,74.8560";
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=driving`;
  const appleMapsUrl = `https://maps.apple.com/?saddr=${originParam}&daddr=${destParam}&dirflg=d`;
  const wazeUrl = dropoff.latitude && dropoff.longitude 
    ? `https://waze.com/ul?ll=${dropoff.latitude},${dropoff.longitude}&navigate=yes`
    : `https://waze.com/ul?q=${destParam}&navigate=yes`;

  return {
    googleMapsUrl,
    appleMapsUrl,
    wazeUrl,
    originLabel: pickup.name || pickup.address || "Fulfilling Pharmacy",
    destLabel: dropoff.area ? `${dropoff.area}, ${dropoff.city || 'Mangalore'}` : (dropoff.houseNo || "Customer Drop-off Location")
  };
}
