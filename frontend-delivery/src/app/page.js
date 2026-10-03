"use client";
import React, { useState, useEffect } from 'react';
import { API } from '../utils/apiConfig';
import { buildNavigationLinks, resolvePharmacyDetails } from '../utils/gpsManager';
const AGENT_ID = "AGT-591";

export default function DeliveryDashboard() {
  const [readyOrders, setReadyOrders] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');

  // Doorstep Payment QR Controller: 'main' vs 'live'
  const [qrMode, setQrMode] = useState('main');
  const [mainQrImage, setMainQrImage] = useState('');
  const [liveQrImage, setLiveQrImage] = useState('');
  const [qrStatusMsg, setQrStatusMsg] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('medora_rider_main_qr');
      if (saved) setMainQrImage(saved);
      else {
        setMainQrImage(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=rider.${AGENT_ID.toLowerCase()}@okhdfcbank%26pn=MEDORA_RIDER%26cu=INR`);
      }
    } catch (e) {}
  }, []);

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

  const handleUploadLiveQr = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const base64Data = uploadEvent.target.result;
      setLiveQrImage(base64Data);
      setQrMode('live');
      setQrStatusMsg('Fresh Live QR uploaded! Broadcast to customer payment terminal.');
      if (activeJob) {
        try {
          localStorage.setItem(`medora_order_qr_${activeJob.id}`, JSON.stringify({ mode: 'live', qr: base64Data }));
          await fetch(`${API}/api/v1/orders/${activeJob.id}/rider-qr`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rider_qr_image: base64Data,
              rider_qr_type: 'live',
              rider_name: `Rider ${AGENT_ID}`,
              rider_upi_id: `rider.${AGENT_ID.toLowerCase()}@okhdfcbank`
            })
          });
        } catch (err) {}
      }
    };
    reader.readAsDataURL(file);
  };

  // Poll for 'ready' orders — these are orders the pharmacy packed and marked ready for pickup
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

  // Accept & pick up: status -> out_for_delivery
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
      // Optimistic
      setActiveJob({ ...order, status: 'out_for_delivery' });
      setReadyOrders(prev => prev.filter(o => o.id !== order.id));
    }
    setUpdatingId(null);
  };

  // Confirm delivery: status -> delivered
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

  // ─── ACTIVE DELIVERY SCREEN ───
  if (activeJob) {
    const steps = [
      { label: 'Picked Up', done: true },
      { label: 'En Route',  done: true },
      { label: 'Arrived',   done: false },
      { label: 'Delivered', done: false },
    ];
    const navLinks = buildNavigationLinks(activeJob.pharmacy_id, activeJob.delivery_address);
    const pickupStore = resolvePharmacyDetails(activeJob.pharmacy_id);

    return (
      <main className="container">
        <div className="active-header">
          <h1>⚡ ACTIVE DELIVERY</h1>
          <p className="sub">{AGENT_ID} • En Route</p>
        </div>

        <div className="map-mock" style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
          <div className="emoji">🗺️</div>
          <div className="route-text" style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#fff' }}>GPS Voice Navigation & Route</div>
          
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '10px',
            padding: '10px 14px',
            margin: '12px auto',
            maxWidth: '440px',
            textAlign: 'left',
            fontSize: '0.82rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div>
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>🏪 Pickup: </span>
              <strong style={{ color: '#fff' }}>{pickupStore.name}</strong>
              <div style={{ color: '#94a3b8', fontSize: '0.74rem' }}>{pickupStore.address}</div>
              {pickupStore.phone && (
                <a href={`tel:${pickupStore.phone}`} style={{ color: '#38bdf8', fontSize: '0.72rem', textDecoration: 'none' }}>
                  📞 {pickupStore.phone}
                </a>
              )}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
              <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>🏠 Drop-off: </span>
              <strong style={{ color: '#fff' }}>Customer {activeJob.user}</strong>
              <div style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                {activeJob.delivery_address 
                  ? [activeJob.delivery_address.houseNo, activeJob.delivery_address.area, activeJob.delivery_address.city, activeJob.delivery_address.pincode].filter(Boolean).join(', ')
                  : 'Flat 402, Airport Road, Vamanjoor, Mangalore'}
              </div>
              {activeJob.delivery_address?.receiverPhone && (
                <a href={`tel:${activeJob.delivery_address.receiverPhone}`} style={{ color: '#4ade80', fontSize: '0.72rem', textDecoration: 'none' }}>
                  📞 {activeJob.delivery_address.receiverPhone}
                </a>
              )}
            </div>
          </div>

          <div className="eta-badge" style={{ marginBottom: '12px' }}>ETA: ~8 mins</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <a
              href={navLinks.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '0.92rem',
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)'
              }}
            >
              <span>🧭</span>
              <span>Open in Google Maps (Turn-by-Turn GPS) ↗</span>
            </a>
            <div style={{ display: 'flex', gap: '8px' }}>
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
        </div>

        <div className="job-details">
          <div className="info-row">
            <span className="info-label">Order ID</span>
            <span className="info-value">{activeJob.id}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Pharmacy</span>
            <span className="info-value">{activeJob.pharmacy_id || 'Vamanjoor Pharmacy, Mangalore'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Items</span>
            <span className="info-value">{formatItems(activeJob.items)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Payout</span>
            <span className="info-value payout-big">₹45.00</span>
          </div>

          <div className="mini-tracker">
            {steps.map((s, i) => (
              <div key={i} className="tracker-step">
                <div className={`tracker-dot ${s.done ? 'done' : ''}`} />
                <span className={`tracker-label ${s.done ? 'done' : ''}`}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Customer Doorstep Payment QR Code Controller (Main vs Live QR) */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: '1.5px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '16px',
            padding: '1.25rem',
            margin: '1.25rem 0',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>📲</span>
                <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>Customer Doorstep UPI Payment QR</strong>
              </div>
              <span style={{
                background: qrMode === 'live' ? '#f59e0b' : '#0284c7',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: '800',
                padding: '3px 10px',
                borderRadius: '99px',
                textTransform: 'uppercase'
              }}>
                Active: {qrMode === 'live' ? 'Live Dynamic QR' : 'Main Registered QR'}
              </span>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 12px 0', textAlign: 'left', lineHeight: '1.4' }}>
              Choose which payment QR is shared with the customer upon arrival. Use your pre-registered profile QR or capture a fresh live QR on the spot.
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

          <button className="btn-deliver" onClick={handleDeliver}>✅ Confirm Delivery</button>
        </div>
      </main>
    );
  }

  // ─── MAIN QUEUE SCREEN ───
  return (
    <main className="container">
      {/* Header */}
      <div className="rider-header">
        <div>
          <h1>🛵 MEDORA Rider</h1>
          <p className="sub">{AGENT_ID}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button className={`toggle-btn ${isOnline ? '' : 'offline'}`} onClick={() => setIsOnline(v => !v)}>
            {isOnline ? '● ONLINE' : '○ OFFLINE'}
          </button>
          <div className={`conn-dot ${backendStatus}`}>
            {backendStatus === 'online' ? '⬤ Backend Connected' : backendStatus === 'offline' ? '⬤ Backend Offline' : '⟳ Connecting...'}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-value">{completedCount}</div>
          <div className="stat-label">Delivered</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">₹{earnings}</div>
          <div className="stat-label">Today&apos;s Earnings</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{readyOrders.length}</div>
          <div className="stat-label">Available</div>
        </div>
      </div>

      {/* Content */}
      <div className="content-area">
        <h2 className="section-title">📦 Packed &amp; Ready for Pickup</h2>
        <p className="section-sub">Orders confirmed and packed by pharmacy</p>

        {!isOnline ? (
          <div className="empty-state">
            <div className="emoji">😴</div>
            <p>You are currently offline.</p>
            <button className="btn-go-online" onClick={() => setIsOnline(true)}>Go Online</button>
          </div>
        ) : readyOrders.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">🕐</div>
            <p>Waiting for pharmacy to pack orders...</p>
            <p className="hint">Orders appear here once pharmacy marks them &quot;Ready&quot;</p>
          </div>
        ) : (
          readyOrders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-top">
                <span className="order-id">{order.id}</span>
                <span className="tag-urgent pulse">URGENT MEDICAL</span>
              </div>
              <div className="order-pharmacy">📍 Vamanjoor Pharmacy, Mangalore</div>
              <div className="order-items">{formatItems(order.items)}</div>
              <div className="payout-row">
                <span className="payout">Payout: ₹45.00</span>
                <span className="distance">~2.5 km</span>
              </div>
              <button
                className="btn-accept"
                onClick={() => handleAccept(order)}
                disabled={updatingId === order.id}
              >
                {updatingId === order.id ? 'Accepting...' : '🛵 Accept & Pick Up'}
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
