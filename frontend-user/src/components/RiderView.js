"use client";
import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-three-kappa-38.vercel.app';
const AGENT_ID = "AGT-591";

export default function RiderView() {
  const [readyOrders, setReadyOrders] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');

  // Poll for 'ready' orders packed by pharmacy
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
              gap: '0.6rem',
              fontSize: '0.82rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>🏪 Pickup:</span>
                <span style={{ color: '#fff' }}>{activeJob.pharmacy_id || 'Vamanjoor Express Pharmacy, Airport Road, Mangalore'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>🏠 Drop-off:</span>
                <span style={{ color: '#fff' }}>
                  {activeJob.delivery_address 
                    ? [activeJob.delivery_address.houseNo, activeJob.delivery_address.area, activeJob.delivery_address.city, activeJob.delivery_address.pincode].filter(Boolean).join(', ')
                    : `Flat 402, Tower 2, Airport Road, Vamanjoor, Mangalore (Customer: ${activeJob.user})`}
                </span>
              </div>
            </div>

            {/* Direct Google Maps Navigation Launch Button */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(activeJob.pharmacy_id || 'Vamanjoor Express Pharmacy, Mangalore')}&destination=${encodeURIComponent(
                activeJob.delivery_address 
                  ? [activeJob.delivery_address.houseNo, activeJob.delivery_address.area, activeJob.delivery_address.city].filter(Boolean).join(', ')
                  : 'Airport Road, Vamanjoor, Mangalore'
              )}&travelmode=driving`}
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
                marginBottom: '0.5rem',
                transition: 'all 0.2s ease'
              }}
            >
              <span>🧭</span>
              <span>Open in Google Maps App (Turn-by-Turn GPS) ↗</span>
            </a>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Opens live voice-guided driving directions synced between pharmacy & customer
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
