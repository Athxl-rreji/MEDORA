"use client";
import React, { useState, useEffect } from 'react';
import { API } from '../utils/apiConfig';
import { buildNavigationLinks, resolvePharmacyDetails } from '../utils/gpsManager';
const AGENT_ID = "AGT-591";

export default function RiderView() {
  const [readyOrders, setReadyOrders] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');

  // Doorstep Payment QR Mode: 'main' (registered) vs 'live' (uploaded on the spot)
  const [qrMode, setQrMode] = useState('main');
  const [mainQrImage, setMainQrImage] = useState('');
  const [liveQrImage, setLiveQrImage] = useState('');
  const [qrStatusMsg, setQrStatusMsg] = useState('');

  // Load saved rider main QR on mount (prioritizing uploaded PNG from registration or active profile)
  useEffect(() => {
    try {
      const activeUserStr = localStorage.getItem('medora_active_user');
      let userQr = null;
      if (activeUserStr) {
        try {
          const u = JSON.parse(activeUserStr);
          if (u.rider_upi_qr) userQr = u.rider_upi_qr;
          else if (u.email) {
            userQr = localStorage.getItem(`medora_rider_qr_${u.email.toLowerCase()}`);
          }
        } catch (e) {}
      }
      const saved = userQr || localStorage.getItem('medora_rider_main_qr');
      if (saved && (saved.startsWith('data:image') || saved.startsWith('http'))) {
        setMainQrImage(saved);
      } else {
        setMainQrImage(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=rider.${AGENT_ID.toLowerCase()}@okhdfcbank%26pn=MEDORA_RIDER%26cu=INR`);
      }
    } catch (e) {}
  }, []);

  const handleUploadMainQr = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressQrImage(file, async (compressedBase64) => {
      setMainQrImage(compressedBase64);
      localStorage.setItem('medora_rider_main_qr', compressedBase64);
      try {
        const uStr = localStorage.getItem('medora_active_user');
        if (uStr) {
          const u = JSON.parse(uStr);
          if (u.email) localStorage.setItem(`medora_rider_qr_${u.email.toLowerCase()}`, compressedBase64);
        }
      } catch (e) {}
      setQrStatusMsg('✅ Registered Profile QR updated to your uploaded PNG!');
      if (activeJob) {
        handleSelectQrMode('main');
      }
    });
  };

  const handleSelectQrMode = async (mode) => {
    setQrMode(mode);
    const chosenQr = mode === 'live' && liveQrImage ? liveQrImage : (mainQrImage || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=rider.${AGENT_ID.toLowerCase()}@okhdfcbank%26pn=MEDORA_RIDER%26cu=INR`);
    setQrStatusMsg(mode === 'live' ? 'Dynamic Live QR active for customer.' : 'Main Registered Profile QR active for customer.');
    
    if (activeJob) {
      try {
        localStorage.setItem(`medora_order_qr_${activeJob.id}`, JSON.stringify({ mode, qr: chosenQr }));
        await fetch(`${API}/api/v1/orders/${activeJob.id}/rider-qr`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rider_qr_image: chosenQr,
            rider_qr_type: mode,
            rider_name: `Rider ${AGENT_ID}`,
            rider_upi_id: `rider.${AGENT_ID.toLowerCase()}@okhdfcbank`
          })
        });
      } catch (err) {}
    }
  };

  const compressQrImage = (file, callback) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 380;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_SIZE) {
                height = Math.round((height * MAX_SIZE) / width);
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width = Math.round((width * MAX_SIZE) / height);
                height = MAX_SIZE;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            callback(compressed);
          } catch (err) {
            callback(e.target.result);
          }
        };
        img.onerror = () => callback(e.target.result);
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const fallbackReader = new FileReader();
      fallbackReader.onload = (e) => callback(e.target.result);
      fallbackReader.readAsDataURL(file);
    }
  };

  const handleUploadLiveQr = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressQrImage(file, async (compressedBase64) => {
      setLiveQrImage(compressedBase64);
      setQrMode('live');
      setQrStatusMsg('Fresh Live QR uploaded! Broadcast to customer payment terminal.');
      if (activeJob) {
        try {
          localStorage.setItem(`medora_order_qr_${activeJob.id}`, JSON.stringify({ mode: 'live', qr: compressedBase64 }));
          await fetch(`${API}/api/v1/orders/${activeJob.id}/rider-qr`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rider_qr_image: compressedBase64,
              rider_qr_type: 'live',
              rider_name: `Rider ${AGENT_ID}`,
              rider_upi_id: `rider.${AGENT_ID.toLowerCase()}@okhdfcbank`
            })
          });
        } catch (err) {}
      }
    });
  };

  // Poll for 'ready' orders packed by pharmacy (pauses if rider already has an active job or tab is hidden)
  useEffect(() => {
    if (!isOnline) return;
    const poll = async () => {
      if (activeJob) return; // Rider already has a delivery in progress
      if (typeof document !== 'undefined' && document.hidden) return; // Tab in background
      try {
        const res = await fetch(`${API}/api/v1/orders/active?status=ready`);
        if (res.ok) {
          setBackendStatus('online');
          const data = await res.json();
          setReadyOrders(data.orders || []);
        } else {
          setBackendStatus('offline');
        }
      } catch {
        setBackendStatus('offline');
      }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [isOnline, activeJob]);

  const handleAccept = async (order) => {
    setUpdatingId(order.id);
    try {
      const res = await fetch(`${API}/api/v1/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'out_for_delivery' })
      });
      if (res.ok) {
        setActiveJob({ ...order, status: 'out_for_delivery' });
        setReadyOrders(prev => prev.filter(o => o.id !== order.id));
      }
    } catch {
      setActiveJob({ ...order, status: 'out_for_delivery' });
      setReadyOrders(prev => prev.filter(o => o.id !== order.id));
    }
    setUpdatingId(null);
  };

  const handleDeliver = async () => {
    if (!activeJob) return;
    try {
      await fetch(`${API}/api/v1/orders/${activeJob.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' })
      });
    } catch {}
    setCompletedCount(c => c + 1);
    setEarnings(e => e + 45);
    setActiveJob(null);
  };

  const formatItems = (items) => {
    if (Array.isArray(items)) return items.map(i => `${i.quantity}x ${i.brand_name}`).join(', ');
    return String(items || 'Items');
  };

  const navLinks = activeJob ? buildNavigationLinks(activeJob.pharmacy_id, activeJob.delivery_address) : null;
  const pickupStore = activeJob ? resolvePharmacyDetails(activeJob.pharmacy_id) : null;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      
      {/* Rider Header */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🛵</span> MEDORA Delivery Network
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
            Agent: {AGENT_ID} • Quick Commerce Express Rider
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <button 
            onClick={() => setIsOnline(v => !v)}
            style={{
              padding: '6px 16px',
              borderRadius: '99px',
              border: isOnline ? '1px solid var(--green)' : '1px solid var(--text-muted)',
              background: isOnline ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.05)',
              color: isOnline ? 'var(--green)' : '#fff',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            {isOnline ? '● ONLINE' : '○ OFFLINE'}
          </button>
          <div style={{ fontSize: '0.7rem', marginTop: '4px', color: backendStatus === 'online' ? 'var(--green)' : 'var(--red)' }}>
            {backendStatus === 'online' ? '⬤ Connected' : '⬤ Offline'}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{completedCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Delivered Today</div>
        </div>
        <div style={{ borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', padding: '0 1.5rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--green)' }}>₹{earnings}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Today&apos;s Earnings</div>
        </div>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff' }}>{readyOrders.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Orders Available</div>
        </div>
      </div>

      {/* ACTIVE JOB SCREEN */}
      {activeJob ? (
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div style={{ borderBottom: '2px solid var(--primary)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
            <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚡</span> ACTIVE DELIVERY IN PROGRESS
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Order #{activeJob.id} • Express Delivery Route Active
            </p>
          </div>

          {/* Map Simulation & Google Maps Navigation Box */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(22,23,26,0.9) 0%, rgba(37,39,44,0.9) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.75rem 1.25rem',
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.4rem' }}>🗺️</div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>GPS Live Routing & Navigation</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0.85rem 0' }}>
              Synchronized: Pharmacy Pickup ➔ Customer Address
            </p>
            
            {/* Live Navigation Route Details */}
            <div style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '1rem',
              textAlign: 'left',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              fontSize: '0.82rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>🏪 Pickup:</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: '600' }}>{pickupStore?.name || activeJob.pharmacy_id || 'Vamanjoor Express Pharmacy'}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{pickupStore?.address || 'Airport Road, Vamanjoor, Mangalore'}</div>
                  {pickupStore?.phone && (
                    <a href={`tel:${pickupStore.phone}`} style={{ color: '#38bdf8', fontSize: '0.72rem', textDecoration: 'none' }}>
                      📞 {pickupStore.phone}
                    </a>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>🏠 Drop-off:</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: '600' }}>Customer: {activeJob.user || 'Adhwaith'}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    {activeJob.delivery_address 
                      ? [activeJob.delivery_address.houseNo, activeJob.delivery_address.area, activeJob.delivery_address.city, activeJob.delivery_address.pincode].filter(Boolean).join(', ')
                      : `Flat 402, Tower 2, Airport Road, Vamanjoor, Mangalore`}
                  </div>
                  {activeJob.delivery_address?.receiverPhone && (
                    <a href={`tel:${activeJob.delivery_address.receiverPhone}`} style={{ color: '#4ade80', fontSize: '0.72rem', textDecoration: 'none' }}>
                      📞 {activeJob.delivery_address.receiverPhone}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Direct Multi-App Navigation Launch Buttons */}
            {navLinks && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '0.8rem' }}>
                <a
                  href={navLinks.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.85rem 1.5rem',
                    borderRadius: '12px',
                    fontWeight: '800',
                    fontSize: '0.95rem',
                    textDecoration: 'none',
                    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>🧭</span>
                  <span>Open in Google Maps (Turn-by-Turn GPS) ↗</span>
                </a>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <a
                    href={navLinks.appleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      fontSize: '0.75rem',
                      textDecoration: 'none'
                    }}
                  >
                    🍏 Apple Maps
                  </a>
                  <a
                    href={navLinks.wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      fontSize: '0.75rem',
                      textDecoration: 'none'
                    }}
                  >
                    🚗 Waze GPS
                  </a>
                </div>
              </div>
            )}
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Opens live voice-guided driving directions calibrated with exact store & delivery GPS
            </div>
          </div>

          {/* Job Details */}
          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '14px', padding: '1.2rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Pickup Store:</span>
              <strong style={{ color: '#fff' }}>{activeJob.pharmacy_id || 'Vamanjoor Pharmacy, Mangalore'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Items to Deliver:</span>
              <span style={{ color: '#fff' }}>{formatItems(activeJob.items)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Trip Payout:</span>
              <strong style={{ color: 'var(--green)', fontSize: '1.1rem' }}>₹45.00</strong>
            </div>
          </div>

          {/* Customer Doorstep Payment QR Code Controller (Main vs Live QR) */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: '1.5px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '16px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>📲</span>
                <strong style={{ fontSize: '0.98rem', color: '#ffffff' }}>Customer Doorstep UPI Payment QR</strong>
              </div>
              <span style={{
                background: qrMode === 'live' ? '#f59e0b' : '#0284c7',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: '800',
                padding: '3px 10px',
                borderRadius: '99px',
                textTransform: 'uppercase'
              }}>
                Active: {qrMode === 'live' ? 'Live Dynamic QR' : 'Main Registered QR'}
              </span>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 12px 0', textAlign: 'left', lineHeight: '1.4' }}>
              Choose which payment QR is shared with the customer upon arrival. You can use your pre-registered profile QR or capture a fresh live QR on the spot.
            </p>

            {/* Toggle Buttons: Main QR vs Live QR */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => handleSelectQrMode('main')}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: qrMode === 'main' ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: qrMode === 'main' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0, 0, 0, 0.25)',
                  color: qrMode === 'main' ? '#38bdf8' : '#cbd5e1',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>⭐</span>
                <span>Use Main QR</span>
              </button>

              <label style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: qrMode === 'live' ? '2px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                background: qrMode === 'live' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0, 0, 0, 0.25)',
                color: qrMode === 'live' ? '#fbbf24' : '#cbd5e1',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}>
                <span>📸</span>
                <span>Upload Live QR</span>
                <input type="file" accept="image/*" onChange={handleUploadLiveQr} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Quick Upload / Replace Main Registered Profile QR */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px dashed #38bdf8',
                color: '#38bdf8',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <span>🖼️</span>
                <span>Upload / Change Registered Main QR (PNG/JPG)</span>
                <input type="file" accept="image/*" onChange={handleUploadMainQr} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Live QR Display Box */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '12px',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
              margin: '0 auto'
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrMode === 'live' && liveQrImage ? liveQrImage : (mainQrImage || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=rider.${AGENT_ID.toLowerCase()}@okhdfcbank%26pn=MEDORA_RIDER%26cu=INR`)}
                alt="Active Rider UPI Payment QR"
                style={{ width: '140px', height: '140px', objectFit: 'contain', display: 'block' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#111827', fontWeight: '800', marginTop: '6px' }}>
                {qrMode === 'live' ? 'Dynamic Live Order QR' : 'Registered Rider Main QR'}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#059669', fontWeight: '700' }}>
                ✓ Synced with Customer Payment Terminal
              </span>
            </div>

            {qrStatusMsg && (
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '8px', fontWeight: '600' }}>
                {qrStatusMsg}
              </div>
            )}
          </div>

          <button onClick={handleDeliver} className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'var(--green)', color: '#16171a', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
            ✅ Confirm Delivery to Customer
          </button>
        </div>
      ) : (
        /* READY QUEUE LIST */
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: '0 0 4px 0' }}>
            📦 Packed Orders Ready for Pickup
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            Accept an order below to navigate and earn ₹45 per delivery
          </p>

          {!isOnline ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.8rem' }}>😴</span>
              <p style={{ color: '#fff', fontWeight: 'bold' }}>You are currently Offline</p>
              <button onClick={() => setIsOnline(true)} className="btn-primary" style={{ marginTop: '1rem' }}>
                Go Online Now
              </button>
            </div>
          ) : readyOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.8rem' }}>🕐</span>
              <p style={{ color: '#fff', fontWeight: 'bold' }}>Waiting for pharmacy to pack orders...</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>New orders will appear automatically when marked &quot;Ready&quot;</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {readyOrders.map(order => (
                <div key={order.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <strong style={{ fontSize: '1.05rem', color: '#fff' }}>Order #{order.id}</strong>
                    <span style={{ background: 'var(--red)', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '99px' }}>
                      URGENT MEDICAL
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                    📍 Vamanjoor Pharmacy, Mangalore <br />
                    🧾 {formatItems(order.items)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                    <div>
                      <span style={{ color: 'var(--green)', fontWeight: 'bold', fontSize: '1.1rem' }}>Payout: ₹45.00</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '8px' }}>~2.5 km</span>
                    </div>
                    <button
                      onClick={() => handleAccept(order)}
                      disabled={updatingId === order.id}
                      className="btn-primary"
                      style={{ padding: '0.6rem 1.4rem', fontSize: '0.88rem', fontWeight: 'bold' }}
                    >
                      {updatingId === order.id ? 'Accepting...' : 'Accept & Pick Up 🛵'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
