"use client";
import React, { useState, useEffect } from 'react';
import { detectDeviceLocation, reverseGeocode } from '../utils/gpsManager';

// Default initial addresses inspired by Swiggy Instamart format
const DEFAULT_SAVED_ADDRESSES = [
  {
    id: "addr_home_1",
    tag: "Home",
    icon: "🏠",
    houseNo: "Flat 402, 4th Floor, Tower 2",
    area: "Sunshine Heights, Airport Road, Vamanjoor",
    city: "Mangalore",
    pincode: "575028",
    landmark: "Opposite St. Joseph Engineering College",
    receiverName: "Adhwaith",
    receiverPhone: "+91 99999 99999",
    latitude: 19.0760,
    longitude: 72.8777,
    isDefault: true
  },
  {
    id: "addr_work_1",
    tag: "Work",
    icon: "💼",
    houseNo: "Suite 305, Tech Park Annex",
    area: "Kadri Temple Road, Kadri Hills",
    city: "Mangalore",
    pincode: "575002",
    landmark: "Near Kadri Manjunatha Temple",
    receiverName: "Adhwaith",
    receiverPhone: "+91 99999 99999",
    latitude: 19.1000,
    longitude: 72.9000,
    isDefault: false
  }
];

export default function SwiggyAddressDrawer({
  isOpen,
  onClose,
  currentAddress,
  onSelectAddress,
  activeUser
}) {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'add'
  const [savedAddresses, setSavedAddresses] = useState(DEFAULT_SAVED_ADDRESSES);
  const [searchAreaQuery, setSearchAreaQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');

  // New Address Form State
  const [tag, setTag] = useState('Home');
  const [houseNo, setHouseNo] = useState('');
  const [area, setArea] = useState('Airport Road, Vamanjoor');
  const [city, setCity] = useState('Mangalore');
  const [pincode, setPincode] = useState('575028');
  const [landmark, setLandmark] = useState('');
  const [receiverName, setReceiverName] = useState(activeUser?.name || 'Adhwaith');
  const [receiverPhone, setReceiverPhone] = useState(activeUser?.phone || '+91 99999 99999');
  const [detectedCoords, setDetectedCoords] = useState({ lat: 19.0760, lng: 72.8777, accuracy: null });

  // Load saved addresses from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('medora_saved_addresses');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedAddresses(parsed);
        }
      }
    } catch (e) {}
  }, []);

  const saveAddressesToStorage = (list) => {
    setSavedAddresses(list);
    try {
      localStorage.setItem('medora_saved_addresses', JSON.stringify(list));
    } catch (e) {}
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setGpsStatus('Acquiring GPS / Network Location...');
    try {
      const loc = await detectDeviceLocation({ timeoutMs: 5000, highAccuracy: false });
      const lat = loc.lat;
      const lng = loc.lng;
      const accuracy = loc.accuracy || 25;
      setDetectedCoords({ lat, lng, accuracy });
      setGpsStatus(`Location Locked: ${lat.toFixed(4)}°, ${lng.toFixed(4)}° (${loc.source === 'device_gps' ? 'GPS' : 'Network'} ±${accuracy}m)`);

      const geo = await reverseGeocode(lat, lng);
      const liveAddr = {
        id: `addr_live_${Date.now()}`,
        tag: "Live Location",
        icon: "🎯",
        houseNo: geo.road ? `Near ${geo.road}` : "Current Location",
        area: geo.area || "Airport Road, Vamanjoor",
        city: geo.city || "Mangalore",
        pincode: geo.pincode || "575028",
        landmark: `${loc.source === 'device_gps' ? 'GPS' : 'Network'} Precision ±${accuracy}m`,
        receiverName: activeUser?.name || "Customer",
        receiverPhone: activeUser?.phone || "+91 99999 99999",
        latitude: lat,
        longitude: lng,
        isDefault: true
      };

      const updated = [liveAddr, ...savedAddresses.filter(a => !a.id.startsWith('addr_live_'))];
      saveAddressesToStorage(updated);
      onSelectAddress(liveAddr);
      setIsLocating(false);
      onClose();
    } catch (e) {
      console.warn("Location detection fallback:", e);
      const fallback = {
        id: "addr_vamanjoor_quick",
        tag: "Vamanjoor Hub",
        icon: "🎯",
        houseNo: "Vamanjoor Main Junction",
        area: "Airport Road, Vamanjoor",
        city: "Mangalore",
        pincode: "575028",
        landmark: "Near St. Joseph College",
        receiverName: activeUser?.name || "Customer",
        receiverPhone: activeUser?.phone || "+91 99999 99999",
        latitude: 12.9298,
        longitude: 74.8967,
        isDefault: true
      };
      onSelectAddress(fallback);
      setIsLocating(false);
      onClose();
    }
  };

  const handleDetectGpsForForm = async () => {
    setIsLocating(true);
    setGpsStatus('Detecting device location...');
    try {
      const loc = await detectDeviceLocation({ timeoutMs: 5000, highAccuracy: false });
      const lat = loc.lat;
      const lng = loc.lng;
      const accuracy = loc.accuracy || 25;
      setDetectedCoords({ lat, lng, accuracy });

      const geo = await reverseGeocode(lat, lng);
      if (geo.road) setHouseNo(prev => prev || `Near ${geo.road}`);
      if (geo.area) setArea(geo.area);
      if (geo.city) setCity(geo.city);
      if (geo.pincode) setPincode(geo.pincode);
      setGpsStatus(`📍 Calibrated: ${geo.area} (±${accuracy}m)`);
    } catch (e) {
      setGpsStatus('📍 Set to default Mangalore Hub coordinates');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSaveNewAddress = (e) => {
    e.preventDefault();
    if (!houseNo.trim() || !area.trim()) return;

    const iconMap = {
      'Home': '🏠',
      'Work': '💼',
      'Friends & Family': '👥',
      'Other': '📍'
    };

    const newAddr = {
      id: `addr_${Date.now()}`,
      tag: tag,
      icon: iconMap[tag] || '📍',
      houseNo: houseNo.trim(),
      area: area.trim(),
      city: city.trim() || "Mangalore",
      pincode: pincode.trim() || "575001",
      landmark: landmark.trim() || (detectedCoords.accuracy ? `GPS Precision ±${detectedCoords.accuracy}m` : ''),
      receiverName: receiverName.trim() || "Customer",
      receiverPhone: receiverPhone.trim() || "+91 99999 99999",
      latitude: detectedCoords.lat,
      longitude: detectedCoords.lng,
      isDefault: false
    };

    const updated = [newAddr, ...savedAddresses];
    saveAddressesToStorage(updated);
    onSelectAddress(newAddr);
    setViewMode('list');
    onClose();
  };

  const handleDeleteAddress = (id, e) => {
    e.stopPropagation();
    const updated = savedAddresses.filter(a => a.id !== id);
    saveAddressesToStorage(updated);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(8px)',
      zIndex: 2500,
      display: 'flex',
      justifyContent: 'flex-start',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      {/* Background click to close */}
      <div 
        onClick={onClose} 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} 
      />

      {/* Drawer Container - Light Theme */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '460px',
        height: '100%',
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '12px 0 45px rgba(0, 0, 0, 0.12)',
        zIndex: 2510,
        overflowY: 'auto',
        color: '#0f172a'
      }}>
        
        {/* Drawer Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {viewMode === 'add' && (
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#0d9488',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                ←
              </button>
            )}
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                {viewMode === 'list' ? 'Delivery Location' : 'Save Delivery Address'}
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {viewMode === 'list' ? 'Instant 10-15 min delivery address' : 'Swiggy Instamart Standard Address'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#475569',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', flex: 1 }}>

          {viewMode === 'list' && (
            <>
              {/* Swiggy Style Search Box */}
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '12px', fontSize: '1rem', color: '#94a3b8' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search for area, street name, pincode..."
                  value={searchAreaQuery}
                  onChange={e => setSearchAreaQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.6rem',
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '12px',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Quick Area Chips */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {['Vamanjoor', 'Kadri Hills', 'Bejai', 'Hampankatta', 'Derebail'].map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setArea(`${loc}, Mangalore`);
                      setViewMode('add');
                    }}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      color: '#475569',
                      borderRadius: '16px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    📍 {loc}
                  </button>
                ))}
              </div>

              {/* GPS Current Location Bar */}
              <div
                onClick={handleUseCurrentLocation}
                style={{
                  background: '#f0fdfa',
                  border: '1.5px dashed #0d9488',
                  borderRadius: '14px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ccfbf1 0%, #b8f7e4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  color: '#0d9488'
                }}>
                  🎯
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '800', color: '#0d9488', fontSize: '0.95rem' }}>
                    {isLocating ? 'Detecting high-accuracy GPS...' : 'Use Current Device Location'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Real-time reverse geocoding • Instant 10-15 Min dispatch
                  </div>
                </div>
                <span style={{ color: '#0d9488', fontSize: '1rem', fontWeight: 'bold' }}>➔</span>
              </div>

              {/* Add New Address Button */}
              <button
                type="button"
                onClick={() => setViewMode('add')}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '12px',
                  color: '#0f172a',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <span style={{ color: '#0d9488', fontSize: '1.2rem' }}>+</span> Add New Address
              </button>

              {/* Saved Addresses Section */}
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  color: '#64748b',
                  marginBottom: '0.8rem',
                  textTransform: 'uppercase'
                }}>
                  Saved Addresses ({savedAddresses.length})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {savedAddresses.map(addr => {
                    const isSelected = currentAddress?.id === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => {
                          onSelectAddress(addr);
                          onClose();
                        }}
                        style={{
                          background: isSelected ? '#f0fdfa' : '#ffffff',
                          border: isSelected ? '2px solid #0d9488' : '1px solid #e2e8f0',
                          borderRadius: '16px',
                          padding: '1.1rem',
                          cursor: 'pointer',
                          position: 'relative',
                          boxShadow: isSelected ? '0 4px 16px rgba(13, 148, 136, 0.12)' : 'var(--shadow-sm)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>{addr.icon || '📍'}</span>
                            <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a' }}>
                              {addr.tag}
                            </span>
                            {isSelected && (
                              <span style={{
                                background: '#0d9488',
                                color: '#ffffff',
                                fontSize: '0.65rem',
                                fontWeight: '800',
                                padding: '2px 8px',
                                borderRadius: '12px'
                              }}>
                                DELIVERING HERE
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAddress(addr.id, e)}
                            title="Delete Address"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              fontSize: '0.95rem'
                            }}
                          >
                            🗑️
                          </button>
                        </div>

                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#334155', lineHeight: '1.4' }}>
                          <div style={{ fontWeight: '700' }}>{addr.houseNo}</div>
                          <div>{addr.area}, {addr.city} {addr.pincode}</div>
                          {addr.landmark && (
                            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>
                              Landmark: {addr.landmark}
                            </div>
                          )}
                        </div>

                        <div style={{
                          marginTop: '0.75rem',
                          paddingTop: '0.6rem',
                          borderTop: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                          color: '#64748b'
                        }}>
                          <span>👤 {addr.receiverName} • {addr.receiverPhone}</span>
                          <span style={{ color: '#0d9488', fontWeight: '800' }}>
                            {isSelected ? '✓ Selected' : 'Deliver Here ➔'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {viewMode === 'add' && (
            <form onSubmit={handleSaveNewAddress} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Simulated Pin Map Box with Live GPS Detection */}
              <div style={{
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #f0fdfa 0%, #e2e8f0 100%)',
                border: '1.5px solid #99f6e4',
                position: 'relative',
                overflow: 'hidden',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{
                  fontSize: '2rem',
                  zIndex: 2,
                  animation: 'bounce 1s infinite alternate'
                }}>
                  📍
                </div>
                
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #0d9488',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  color: '#0d9488',
                  fontWeight: '800',
                  zIndex: 2,
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  📍 Pin: {detectedCoords.lat.toFixed(4)}° N, {detectedCoords.lng.toFixed(4)}° E {detectedCoords.accuracy ? `(±${detectedCoords.accuracy}m)` : ''}
                </div>

                <button
                  type="button"
                  onClick={handleDetectGpsForForm}
                  disabled={isLocating}
                  style={{
                    background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '20px',
                    padding: '6px 16px',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    cursor: isLocating ? 'wait' : 'pointer',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)'
                  }}
                >
                  <span>{isLocating ? '⏳' : '🎯'}</span>
                  {isLocating ? 'Locating...' : 'Center Pin on My Live GPS'}
                </button>

                {gpsStatus && (
                  <span style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: '700', zIndex: 2, textAlign: 'center' }}>
                    {gpsStatus}
                  </span>
                )}
              </div>

              {/* Save Address As Chips */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '6px', fontWeight: '800' }}>
                  SAVE ADDRESS AS:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { key: 'Home', label: 'Home', icon: '🏠' },
                    { key: 'Work', label: 'Work', icon: '💼' },
                    { key: 'Friends & Family', label: 'Friends & Family', icon: '👥' },
                    { key: 'Other', label: 'Other', icon: '📍' }
                  ].map(item => {
                    const active = tag === item.key;
                    return (
                      <button
                        type="button"
                        key={item.key}
                        onClick={() => setTag(item.key)}
                        style={{
                          background: active ? '#0d9488' : '#f8fafc',
                          color: active ? '#ffffff' : '#334155',
                          border: active ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                          borderRadius: '10px',
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <span>{item.icon}</span> {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* House / Flat / Floor */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '4px', fontWeight: '800' }}>
                  HOUSE / FLAT / FLOOR NO. *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 402, 4th Floor, Block B"
                  value={houseNo}
                  onChange={e => setHouseNo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Apartment / Road / Area */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '4px', fontWeight: '800' }}>
                  APARTMENT / ROAD / AREA *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunshine Heights, Airport Road, Vamanjoor"
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* City and Pincode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '4px', fontWeight: '800' }}>
                    CITY *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Mangalore"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#ffffff',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      color: '#0f172a',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '4px', fontWeight: '800' }}>
                    PINCODE *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="575001"
                    value={pincode}
                    onChange={e => setPincode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#ffffff',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      color: '#0f172a',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Landmark */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '4px', fontWeight: '800' }}>
                  LANDMARK (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Opposite St. Joseph Engineering College"
                  value={landmark}
                  onChange={e => setLandmark(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Receiver Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '4px', fontWeight: '800' }}>
                    RECEIVER NAME
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Adhwaith"
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#ffffff',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      color: '#0f172a',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#475569', marginBottom: '4px', fontWeight: '800' }}>
                    PHONE NUMBER
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+91 99999 99999"
                    value={receiverPhone}
                    onChange={e => setReceiverPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#ffffff',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      color: '#0f172a',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  marginTop: '0.5rem',
                  padding: '0.95rem',
                  background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(13, 148, 136, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                SAVE AND PROCEED TO ORDER
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
