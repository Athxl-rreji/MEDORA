"use client";
import React, { useState, useEffect } from 'react';

// Free reverse geocoding utility with fallback
export async function reverseGeocode(lat, lng) {
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(4500) }
    );
    if (nomRes.ok) {
      const data = await nomRes.json();
      const addr = data.address || {};
      const road = addr.road || addr.pedestrian || addr.street || '';
      const suburb = addr.suburb || addr.neighbourhood || addr.residential || addr.subdistrict || '';
      const city = addr.city || addr.town || addr.county || addr.state_district || 'Mangalore';
      const state = addr.state || 'Karnataka';
      const postcode = addr.postcode || '';
      const displayName = data.display_name || '';

      const area = road ? (suburb ? `${road}, ${suburb}` : road) : (suburb || city);

      return {
        road,
        suburb,
        city,
        state,
        pincode: postcode,
        area: `${area}, ${city}`,
        displayName,
        source: 'nominatim'
      };
    }
  } catch (e) {
    // Fallback to BigDataCloud
  }

  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: AbortSignal.timeout(4500) }
    );
    if (bdcRes.ok) {
      const data = await bdcRes.json();
      const city = data.city || data.locality || 'Mangalore';
      const area = data.locality || data.principalSubdivision || city;
      return {
        road: '',
        suburb: data.locality || '',
        city,
        state: data.principalSubdivision || '',
        pincode: data.postcode || '',
        area: `${area}, ${city}`,
        displayName: `${area}, ${city}, ${data.countryName || 'India'}`,
        source: 'bigdatacloud'
      };
    }
  } catch (e) {
    // Both failed
  }

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

export default function LivePerimeterRadar({
  userCoords,
  onUpdateCoords,
  selectedAddress,
  onUpdateAddress,
  pharmacies = [],
  perimeterKm = 3.5,
  onChangePerimeter,
  filterInsideOnly = false,
  onToggleFilterInsideOnly,
  onBack,
  isStandalonePage = false
}) {
  const [isLocating, setIsLocating] = useState(false);
  const [isLiveWatchActive, setIsLiveWatchActive] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [detectedLocationName, setDetectedLocationName] = useState(selectedAddress?.area || 'Airport Road, Vamanjoor');
  const [activeHoveredPharm, setActiveHoveredPharm] = useState(null);
  const [radarAngle, setRadarAngle] = useState(0);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Radar continuous sweep animation
  useEffect(() => {
    const interval = setInterval(() => {
      setRadarAngle(prev => (prev + 3) % 360);
    }, 35);
    return () => clearInterval(interval);
  }, []);

  // One-time manual GPS trigger
  const handleDetectGPS = (autoSetAddress = true) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      showToast("⚠️ Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));

        const coords = { lat: latitude, lng: longitude, accuracy: Math.round(accuracy) };
        if (onUpdateCoords) onUpdateCoords(coords);

        const geo = await reverseGeocode(latitude, longitude);
        setDetectedLocationName(geo.area);

        if (autoSetAddress && onUpdateAddress) {
          const liveAddr = {
            id: `addr_gps_${Date.now()}`,
            tag: "Live GPS Location",
            icon: "🎯",
            houseNo: geo.road ? `Near ${geo.road}` : "Current GPS Location",
            area: geo.area,
            city: geo.city,
            pincode: geo.pincode || "575001",
            landmark: `GPS Accuracy ±${Math.round(accuracy)}m`,
            receiverName: selectedAddress?.receiverName || "Customer",
            receiverPhone: selectedAddress?.receiverPhone || "+91 99999 99999",
            latitude,
            longitude,
            isDefault: true
          };
          onUpdateAddress(liveAddr);
          showToast(`📍 Locked: ${geo.area} (±${Math.round(accuracy)}m)`);
        }

        setIsLocating(false);
      },
      (err) => {
        console.warn("GPS error:", err);
        setIsLocating(false);
        if (onUpdateCoords) onUpdateCoords({ lat: 12.9141, lng: 74.8560, accuracy: 15 });
        setDetectedLocationName("Vamanjoor, Mangalore (Default Hub)");
        showToast("⚠️ GPS signal timeout. Loaded default hub location.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Toggle continuous watchPosition for live tracking
  const toggleLiveWatch = () => {
    if (isLiveWatchActive) {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      setIsLiveWatchActive(false);
      setWatchId(null);
      showToast("⚪ Stopped live GPS sync.");
    } else {
      if (typeof window === 'undefined' || !navigator.geolocation) return;
      setIsLiveWatchActive(true);
      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          setGpsAccuracy(Math.round(accuracy));
          const coords = { lat: latitude, lng: longitude, accuracy: Math.round(accuracy) };
          if (onUpdateCoords) onUpdateCoords(coords);

          const geo = await reverseGeocode(latitude, longitude);
          setDetectedLocationName(geo.area);
        },
        (err) => console.warn("Watch position error:", err),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
      setWatchId(id);
      showToast("🟢 Live GPS Sync active!");
    }
  };

  useEffect(() => {
    return () => {
      if (watchId !== null && typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // Count pharmacies within active perimeter
  const pharmaciesInside = pharmacies.filter(p => p.distance_km <= perimeterKm);
  const pharmaciesOutside = pharmacies.filter(p => p.distance_km > perimeterKm);

  // Radar visual dimensions
  const radarRadiusPx = 135;
  const maxDisplayKm = Math.max(perimeterKm * 1.5, 6.0);

  const getPharmRadarPos = (distKm, index, total) => {
    const angleRad = (index / Math.max(total, 1)) * (2 * Math.PI) - (Math.PI / 4);
    const r = Math.min((distKm / maxDisplayKm) * radarRadiusPx, radarRadiusPx - 18);
    const x = 150 + r * Math.cos(angleRad);
    const y = 150 + r * Math.sin(angleRad);
    return { x, y };
  };

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border-color)',
      borderRadius: '24px',
      padding: isStandalonePage ? '2.5rem' : '2rem',
      maxWidth: isStandalonePage ? '1100px' : '100%',
      margin: '0 auto',
      boxShadow: '0 20px 45px -10px rgba(13, 148, 136, 0.08), 0 4px 12px rgba(0, 0, 0, 0.03)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#0f172a',
          color: '#ffffff',
          padding: '8px 18px',
          borderRadius: '99px',
          fontSize: '0.82rem',
          fontWeight: '700',
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          {toastMsg}
        </div>
      )}

      {/* Decorative Mint Ambient Glow */}
      <div style={{
        position: 'absolute',
        top: '-70px',
        right: '-70px',
        width: '280px',
        height: '280px',
        background: 'radial-gradient(circle, rgba(184, 247, 228, 0.5) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Top Header / Back Button */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '8px 14px',
                color: '#0f172a',
                fontSize: '0.88rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              ← Back to Catalog
            </button>
          )}

          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #ccfbf1 0%, #b8f7e4 100%)',
            border: '1px solid #99f6e4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            🛰️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: '#0f172a' }}>
                Delivery Radar & GPS Zone
              </h2>
              <span style={{
                background: isLiveWatchActive ? '#dcfce7' : '#f0fdfa',
                color: isLiveWatchActive ? '#15803d' : '#0f766e',
                border: isLiveWatchActive ? '1px solid #bbf7d0' : '1px solid #99f6e4',
                fontSize: '0.72rem',
                fontWeight: '800',
                padding: '3px 10px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isLiveWatchActive ? '#16a34a' : '#0d9488',
                  animation: 'pulse 1.5s infinite'
                }} />
                {isLiveWatchActive ? 'CONTINUOUS GPS SYNC' : 'LIVE GPS READY'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '0.84rem', color: '#64748b' }}>
                📍 {detectedLocationName || 'Detecting street location...'}
              </span>
              {gpsAccuracy && (
                <span style={{ fontSize: '0.75rem', color: '#0d9488', fontWeight: '700', background: '#f0fdfa', padding: '1px 6px', borderRadius: '6px' }}>
                  ±{gpsAccuracy}m precision
                </span>
              )}
            </div>
          </div>
        </div>

        {/* GPS Control Actions */}
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleDetectGPS(true)}
            disabled={isLocating}
            style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: isLocating ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{isLocating ? '⏳' : '🎯'}</span>
            {isLocating ? 'Acquiring GPS...' : 'Calibrate Live GPS'}
          </button>

          <button
            type="button"
            onClick={toggleLiveWatch}
            style={{
              background: isLiveWatchActive ? '#ecfdf5' : '#ffffff',
              color: isLiveWatchActive ? '#059669' : '#475569',
              border: isLiveWatchActive ? '1.5px solid #10b981' : '1.5px solid #cbd5e1',
              borderRadius: '12px',
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{isLiveWatchActive ? '🟢' : '⚪'}</span>
            {isLiveWatchActive ? 'Live Tracking' : 'Track Move'}
          </button>
        </div>
      </div>

      {/* Main Radar & Perimeter Controller Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 320px) 1fr',
        gap: '2rem',
        alignItems: 'center'
      }}>
        
        {/* Interactive Light-Theme Radar Canvas / SVG */}
        <div style={{
          position: 'relative',
          width: '300px',
          height: '300px',
          margin: '0 auto',
          background: 'radial-gradient(circle, #f0fdfa 0%, #e2e8f0 100%)',
          borderRadius: '50%',
          border: '2px solid rgba(45, 212, 191, 0.4)',
          boxShadow: 'inset 0 0 30px rgba(13, 148, 136, 0.08), 0 10px 30px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden'
        }}>
          <svg width="300" height="300" style={{ position: 'absolute', top: 0, left: 0 }}>
            {/* Concentric distance rings */}
            <circle cx="150" cy="150" r="45" fill="none" stroke="rgba(148, 163, 184, 0.35)" strokeDasharray="3 3" />
            <circle cx="150" cy="150" r="90" fill="none" stroke="rgba(148, 163, 184, 0.35)" strokeDasharray="3 3" />
            <circle cx="150" cy="150" r="130" fill="none" stroke="rgba(148, 163, 184, 0.35)" strokeDasharray="3 3" />

            {/* Crosshairs */}
            <line x1="150" y1="12" x2="150" y2="288" stroke="rgba(148, 163, 184, 0.25)" />
            <line x1="12" y1="150" x2="288" y2="150" stroke="rgba(148, 163, 184, 0.25)" />

            {/* Dynamic Active Perimeter Ring */}
            {(() => {
              const ringR = Math.min((perimeterKm / maxDisplayKm) * radarRadiusPx, radarRadiusPx - 4);
              return (
                <>
                  <circle
                    cx="150"
                    cy="150"
                    r={ringR}
                    fill="rgba(45, 212, 191, 0.15)"
                    stroke="#0d9488"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                  />
                  <text
                    x="152"
                    y={150 - ringR + 13}
                    fill="#0f766e"
                    fontSize="9.5"
                    fontWeight="800"
                    letterSpacing="0.5px"
                  >
                    {perimeterKm} KM BOUNDARY
                  </text>
                </>
              );
            })()}

            {/* Rotating Radar Sweep Line */}
            {(() => {
              const rad = (radarAngle * Math.PI) / 180;
              const x2 = 150 + radarRadiusPx * Math.cos(rad);
              const y2 = 150 + radarRadiusPx * Math.sin(rad);
              return (
                <line
                  x1="150"
                  y1="150"
                  x2={x2}
                  y2={y2}
                  stroke="rgba(13, 148, 136, 0.65)"
                  strokeWidth="2.5"
                />
              );
            })()}

            {/* Center User Location Pin */}
            <circle cx="150" cy="150" r="12" fill="#0d9488" />
            <circle cx="150" cy="150" r="20" fill="none" stroke="#0d9488" strokeWidth="2" opacity="0.4" />
            <text x="150" y="154" textAnchor="middle" fontSize="12" fill="#ffffff" fontWeight="bold">👤</text>
          </svg>

          {/* Connected Pharmacy Nodes on Radar */}
          {pharmacies.map((pharm, idx) => {
            const pos = getPharmRadarPos(pharm.distance_km, idx, pharmacies.length);
            const inRange = pharm.distance_km <= perimeterKm;
            return (
              <div
                key={pharm.id}
                onMouseEnter={() => setActiveHoveredPharm(pharm)}
                onMouseLeave={() => setActiveHoveredPharm(null)}
                style={{
                  position: 'absolute',
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 20,
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: inRange ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#94a3b8',
                  border: '2px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  boxShadow: inRange ? '0 0 14px rgba(16, 185, 129, 0.7)' : '0 2px 6px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s ease',
                }}>
                  🏥
                </div>
                <div style={{
                  position: 'absolute',
                  top: '30px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  fontSize: '0.65rem',
                  color: inRange ? '#0f766e' : '#64748b',
                  fontWeight: '800',
                  pointerEvents: 'none'
                }}>
                  {pharm.distance_km} km
                </div>
              </div>
            );
          })}

          {/* Hovered Pharmacy Card */}
          {activeHoveredPharm && (
            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#ffffff',
              border: '1.5px solid #0d9488',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              color: '#0f172a',
              zIndex: 30,
              whiteSpace: 'nowrap',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
            }}>
              <div style={{ fontWeight: '800', color: '#0d9488' }}>
                {activeHoveredPharm.name}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: '2px' }}>
                Distance: {activeHoveredPharm.distance_km} km • ETA: {activeHoveredPharm.delivery_time}
              </div>
            </div>
          )}
        </div>

        {/* Perimeter Telemetry and Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* Active Perimeter Status Summary */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--border-color)',
            borderRadius: '18px',
            padding: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '800' }}>
                ACTIVE DELIVERY PERIMETER
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: '900', color: '#0d9488', fontFamily: 'Outfit, sans-serif' }}>
                  {perimeterKm}
                </span>
                <span style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: '800' }}>KILOMETERS</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{
                background: pharmaciesInside.length > 0 ? '#ecfdf5' : '#fef2f2',
                border: pharmaciesInside.length > 0 ? '1px solid #a7f3d0' : '1px solid #fecaca',
                borderRadius: '14px',
                padding: '8px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: pharmaciesInside.length > 0 ? '#059669' : '#dc2626' }}>
                  {pharmaciesInside.length} / {pharmacies.length}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '800' }}>
                  HUBS IN RANGE
                </div>
              </div>

              <div style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: '14px',
                padding: '8px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#ea580c' }}>
                  ⚡ 10-15m
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '800' }}>
                  SPEED ETA
                </div>
              </div>
            </div>
          </div>

          {/* Preset Buttons */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '8px', fontWeight: '800' }}>
              SELECT PRESET DELIVERY ZONE:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
              {[
                { km: 2.0, label: '⚡ Ultra-Fast', sub: '10-12 Min Zone' },
                { km: 3.5, label: '🛵 Neighborhood', sub: '12-15 Min Zone' },
                { km: 5.0, label: '🏙️ Express City', sub: '15-20 Min Zone' },
                { km: 8.0, label: '🌐 Extended Hub', sub: '20-30 Min Zone' }
              ].map(preset => {
                const active = perimeterKm === preset.km;
                return (
                  <button
                    type="button"
                    key={preset.km}
                    onClick={() => {
                      if (onChangePerimeter) onChangePerimeter(preset.km);
                      showToast(`Perimeter set to ${preset.km} km (${preset.label})`);
                    }}
                    style={{
                      background: active ? '#f0fdfa' : '#ffffff',
                      border: active ? '2px solid #0d9488' : '1.5px solid #cbd5e1',
                      borderRadius: '14px',
                      padding: '10px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: active ? '0 4px 12px rgba(13, 148, 136, 0.15)' : 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ fontWeight: '800', fontSize: '0.85rem', color: active ? '#0d9488' : '#0f172a' }}>
                      {preset.label} ({preset.km} km)
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                      {preset.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Range Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: '800' }}>
                FINE-TUNE PERIMETER RADIUS:
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0d9488' }}>
                {perimeterKm} km
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.5"
              value={perimeterKm}
              onChange={e => onChangePerimeter && onChangePerimeter(parseFloat(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#0d9488',
                cursor: 'pointer'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
              <span>1.0 km (Hyper-local)</span>
              <span>5.0 km (Standard)</span>
              <span>10.0 km (Max Radius)</span>
            </div>
          </div>

          {/* Bottom Filter Toggle and Apply Action */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.8rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-color)'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#0f172a', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={filterInsideOnly}
                onChange={e => onToggleFilterInsideOnly && onToggleFilterInsideOnly(e.target.checked)}
                style={{ width: '17px', height: '17px', accentColor: '#0d9488', cursor: 'pointer' }}
              />
              <span>Only display medicines available inside perimeter</span>
            </label>

            <button
              type="button"
              onClick={() => {
                handleDetectGPS(true);
                showToast("📍 Perimeter synced to Home Screen address!");
              }}
              style={{
                background: '#fff7ed',
                border: '1.5px solid #fed7aa',
                color: '#ea580c',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <span>📍</span> Set Perimeter as Home Address
            </button>
          </div>

        </div>

      </div>

      {/* Connected Dark-Stores Detail List */}
      <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🏥</span> Connected Partner Pharmacy Dark-Stores ({pharmacies.length})
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {pharmacies.map(pharm => {
            const inRange = pharm.distance_km <= perimeterKm;
            return (
              <div
                key={pharm.id}
                style={{
                  background: inRange ? '#ffffff' : '#f8fafc',
                  border: inRange ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '1.1rem',
                  boxShadow: inRange ? '0 4px 16px rgba(13, 148, 136, 0.08)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.8rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                      {pharm.name}
                    </h4>
                    <span style={{
                      background: inRange ? '#ecfdf5' : '#f1f5f9',
                      color: inRange ? '#059669' : '#64748b',
                      fontSize: '0.68rem',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '8px'
                    }}>
                      {inRange ? '● IN PERIMETER' : '○ BEYOND PERIMETER'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    {pharm.address}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid rgba(0,0,0,0.05)'
                }}>
                  <span style={{ color: '#0d9488', fontWeight: '800' }}>
                    ⚡ {pharm.delivery_time} ({pharm.distance_km} km)
                  </span>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>
                    ⭐ {pharm.rating} rating
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
