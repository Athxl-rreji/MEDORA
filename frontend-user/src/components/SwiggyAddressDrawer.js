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
  activeUser,
  isFirstTimeSetup = false
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

  // Update receiver fields whenever activeUser changes
  useEffect(() => {
    if (activeUser?.name) setReceiverName(activeUser.name);
    if (activeUser?.phone) setReceiverPhone(activeUser.phone);
  }, [activeUser]);

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
      isDefault: true
    };

    const updated = [newAddr, ...savedAddresses.map(a => ({ ...a, isDefault: false }))];
    saveAddressesToStorage(updated);
    onSelectAddress(newAddr);
    setViewMode('list');
    onClose();
  };

  const handleSelectSavedAddress = (addr) => {
    const updated = savedAddresses.map(a => ({
      ...a,
      isDefault: a.id === addr.id
    }));
    saveAddressesToStorage(updated);
    onSelectAddress({ ...addr, isDefault: true });
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
      background: 'rgba(5, 7, 10, 0.75)',
      backdropFilter: 'blur(10px)',
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

      {/* Drawer Container - Dark Obsidian Neumorphism */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '460px',
        height: '100%',
        background: '#151a24',
        borderRight: '1.5px solid rgba(56, 189, 248, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '12px 0 45px rgba(0, 0, 0, 0.8)',
        zIndex: 2510,
        overflowY: 'auto',
        color: '#f1f5f9'
      }}>
        
        {/* Drawer Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#181e2b',
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
                  background: '#1c2331',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  color: '#2dd4bf',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                ←
              </button>
            )}
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#f1f5f9', margin: 0 }}>
                {viewMode === 'list' ? 'Delivery Location' : 'Save Delivery Address'}
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {viewMode === 'list' ? 'Instant 10-15 min delivery address' : 'MEDORA Verified Delivery Address'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#1c2331',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#94a3b8',
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

          {/* First Time Sign-In Prompt Banner */}
          {isFirstTimeSetup && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.16) 0%, rgba(56, 189, 248, 0.12) 100%)',
              border: '1.5px solid rgba(45, 212, 191, 0.45)',
              borderRadius: '14px',
              padding: '1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
            }}>
              <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>📍</span>
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem', color: '#5eead4', fontWeight: '800' }}>
                  First Time Setup • Set Default Delivery Address
                </strong>
                <span style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.45', display: 'block', marginTop: '3px' }}>
                  Welcome to MEDORA! Please set or confirm your delivery address. This will be saved as your <strong>default delivery address</strong> so emergency 10-minute medicine dispatches reach you seamlessly.
                </span>
              </div>
            </div>
          )}

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
                    background: '#121620',
                    border: '1.5px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    color: '#f1f5f9',
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
                      background: '#181e2b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#cbd5e1',
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
                  background: '#181e2b',
                  border: '1.5px dashed #2dd4bf',
                  borderRadius: '14px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: 'var(--neo-shadow-raised-sm)'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(45, 212, 191, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  color: '#2dd4bf'
                }}>
                  🎯
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '800', color: '#2dd4bf', fontSize: '0.95rem' }}>
                    {isLocating ? 'Detecting high-accuracy GPS...' : 'Use Current Device Location'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                    Real-time reverse geocoding • Instant 10-15 Min dispatch
                  </div>
                </div>
                <span style={{ color: '#2dd4bf', fontSize: '1rem', fontWeight: 'bold' }}>➔</span>
              </div>

              {/* Add New Address Button */}
              <button
                type="button"
                onClick={() => setViewMode('add')}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: '#181e2b',
                  border: '1.5px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '12px',
                  color: '#f1f5f9',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: 'var(--neo-shadow-raised-sm)'
                }}
              >
                <span style={{ color: '#2dd4bf', fontSize: '1.2rem' }}>+</span> Add New Address
              </button>

              {/* Saved Addresses Section */}
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  color: '#94a3b8',
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
                        onClick={() => handleSelectSavedAddress(addr)}
                        style={{
                          background: isSelected ? '#1c2436' : '#181e2b',
                          border: isSelected ? '2px solid #2dd4bf' : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '16px',
                          padding: '1.1rem',
                          cursor: 'pointer',
                          position: 'relative',
                          boxShadow: isSelected ? '0 4px 16px rgba(45, 212, 191, 0.2)' : 'var(--neo-shadow-raised-sm)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>{addr.icon || '📍'}</span>
                            <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#f1f5f9' }}>
                              {addr.tag}
                            </span>
                            {isSelected && (
                              <span style={{
                                background: '#2dd4bf',
                                color: '#0d1117',
                                fontSize: '0.65rem',
                                fontWeight: '900',
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

                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                          <div style={{ fontWeight: '700', color: '#f1f5f9' }}>{addr.houseNo}</div>
                          <div>{addr.area}, {addr.city} {addr.pincode}</div>
                          {addr.landmark && (
                            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                              Landmark: {addr.landmark}
                            </div>
                          )}
                        </div>

                        <div style={{
                          marginTop: '0.75rem',
                          paddingTop: '0.6rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                          color: '#94a3b8'
                        }}>
                          <span>👤 {addr.receiverName} • {addr.receiverPhone}</span>
                          <span style={{ color: '#2dd4bf', fontWeight: '800' }}>
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
                background: '#121620',
                border: '1.5px solid rgba(56, 189, 248, 0.25)',
                position: 'relative',
                overflow: 'hidden',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: 'var(--neo-shadow-inset)'
              }}>
                <div style={{
                  fontSize: '2rem',
                  zIndex: 2,
                  animation: 'bounce 1s infinite alternate'
                }}>
                  📍
                </div>
                
                <div style={{
                  background: '#181e2b',
                  border: '1px solid #2dd4bf',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  color: '#2dd4bf',
                  fontWeight: '800',
                  zIndex: 2,
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}>
                  📍 Pin: {detectedCoords.lat.toFixed(4)}° N, {detectedCoords.lng.toFixed(4)}° E {detectedCoords.accuracy ? `(±${detectedCoords.accuracy}m)` : ''}
                </div>

                <button
                  type="button"
                  onClick={handleDetectGpsForForm}
                  disabled={isLocating}
                  style={{
                    background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
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
                    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.35)'
                  }}
                >
                  <span>{isLocating ? '⏳' : '🎯'}</span>
                  {isLocating ? 'Locating...' : 'Center Pin on My Live GPS'}
                </button>

                {gpsStatus && (
                  <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: '700', zIndex: 2, textAlign: 'center' }}>
                    {gpsStatus}
                  </span>
                )}
              </div>

              {/* Save Address As Chips */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px', fontWeight: '800' }}>
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
                          background: active ? '#2dd4bf' : '#181e2b',
                          color: active ? '#0d1117' : '#cbd5e1',
                          border: active ? '1.5px solid #2dd4bf' : '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '10px',
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          fontWeight: '800',
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
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '800' }}>
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
                    background: '#121620',
                    border: '1.5px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Apartment / Road / Area */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '800' }}>
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
                    background: '#121620',
                    border: '1.5px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* City and Pincode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '800' }}>
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
                      background: '#121620',
                      border: '1.5px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#f1f5f9',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '800' }}>
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
                      background: '#121620',
                      border: '1.5px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#f1f5f9',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Landmark */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '800' }}>
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
                    background: '#121620',
                    border: '1.5px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Receiver Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '800' }}>
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
                      background: '#121620',
                      border: '1.5px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#f1f5f9',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '800' }}>
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
                      background: '#121620',
                      border: '1.5px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#f1f5f9',
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
                  background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
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
