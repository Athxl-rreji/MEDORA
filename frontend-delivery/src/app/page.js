"use client";
import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-three-kappa-38.vercel.app';
const AGENT_ID = "AGT-591";

export default function DeliveryDashboard() {
  const [readyOrders, setReadyOrders] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');

  // Poll for 'ready' orders — these are orders the pharmacy packed and marked ready for pickup
  useEffect(() => {
    if (!isOnline) return;
    const poll = async () => {
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
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [isOnline]);

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
    return (
      <main className="container">
        <div className="active-header">
          <h1>⚡ ACTIVE DELIVERY</h1>
          <p className="sub">{AGENT_ID} • En Route</p>
        </div>

        <div className="map-mock" style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
          <div className="emoji">🗺️</div>
          <div className="route-text" style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#fff' }}>GPS Routing & Google Maps Sync</div>
          <div className="route-sub" style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 10px 0' }}>
            🏪 {activeJob.pharmacy_id || 'Vamanjoor Pharmacy, Mangalore'} ➔ 🏠 Customer {activeJob.user}
          </div>
          <div className="eta-badge" style={{ marginBottom: '12px' }}>ETA: ~8 mins</div>

          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(activeJob.pharmacy_id || 'Vamanjoor Express Pharmacy, Mangalore')}&destination=${encodeURIComponent(
              activeJob.delivery_address 
                ? [activeJob.delivery_address.houseNo, activeJob.delivery_address.area, activeJob.delivery_address.city].filter(Boolean).join(', ')
                : 'Airport Road, Vamanjoor, Mangalore'
            )}&travelmode=driving`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: '#2563eb',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 'bold',
              fontSize: '0.88rem',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
            }}
          >
            <span>🧭</span>
            <span>Launch Google Maps GPS App ↗</span>
          </a>
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
