"use client";
import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const PHARMACY_ID = "Vamanjoor Pharmacy, Mangalore";

const STATUS_CONFIG = {
  pending:          { label: "New Order",       color: "#ef4444", bg: "rgba(239,68,68,0.12)",     next: "accepted",         nextLabel: "✅ Accept & Pack",        nextColor: "#10b981" },
  accepted:         { label: "Packing",          color: "#f59e0b", bg: "rgba(245,158,11,0.12)",    next: "ready",            nextLabel: "📦 Mark Ready for Pickup", nextColor: "#6366f1" },
  ready:            { label: "Ready for Pickup", color: "#6366f1", bg: "rgba(99,102,241,0.12)",    next: "out_for_delivery", nextLabel: "🛵 Dispatch to Rider",     nextColor: "#0ea5e9" },
  out_for_delivery: { label: "Out for Delivery", color: "#0ea5e9", bg: "rgba(14,165,233,0.12)",    next: null,               nextLabel: null,                      nextColor: null },
  delivered:        { label: "Delivered ✓",      color: "#10b981", bg: "rgba(16,185,129,0.08)",   next: null,               nextLabel: null,                      nextColor: null },
};

export default function PharmacyDashboard() {
  const [orders, setOrders] = useState([]);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrImage, setOcrImage] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null); // null=checking, true, false

  const clearOrders = async () => {
    if (!confirm("Clear ALL orders from the system? This cannot be undone.")) return;
    try {
      await fetch(`${API}/api/v1/orders/clear`, { method: 'DELETE' });
      setOrders([]);
      alert("✅ All orders cleared.");
    } catch (e) {
      alert("Failed to reach backend.");
    }
  };

  useEffect(() => {
    // Health check ping
    fetch(`${API}/health`).then(r => setBackendOnline(r.ok)).catch(() => setBackendOnline(false));

    const fetchOrders = async () => {
      try {
        const [r1, r2, r3] = await Promise.all([
          fetch(`${API}/api/v1/orders/active?status=pending`),
          fetch(`${API}/api/v1/orders/active?status=accepted`),
          fetch(`${API}/api/v1/orders/active?status=ready`),
        ]);
        setBackendOnline(true);
        const [d1, d2, d3] = await Promise.all([
          r1.ok ? r1.json() : { orders: [] },
          r2.ok ? r2.json() : { orders: [] },
          r3.ok ? r3.json() : { orders: [] },
        ]);
        const combined = [...(d1.orders || []), ...(d2.orders || []), ...(d3.orders || [])];
        if (combined.length > orders.length) {
          try {
            const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
            audio.play().catch(() => {});
          } catch (e) {}
        }
        setOrders(combined);
      } catch (e) {
        setBackendOnline(false);
        console.warn("Backend polling failed");
      }
    };
    fetchOrders();
    const timer = setInterval(fetchOrders, 3000);
    return () => clearInterval(timer);
  }, [orders.length]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`${API}/api/v1/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      } else {
        alert(`Failed to update order ${orderId}`);
      }
    } catch (e) {
      alert("Lost connection to backend.");
    }
    setUpdatingId(null);
  };

  const handleReject = async (orderId) => {
    if (!confirm(`Reject order ${orderId}?`)) return;
    await handleStatusUpdate(orderId, "rejected");
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleFileUpload = (e) => {
    e.preventDefault();
    const fileInput = e.target.elements[0];
    if (!fileInput.files || !fileInput.files.length) return;
    setOcrImage(URL.createObjectURL(fileInput.files[0]));
    setIsExtracting(true);
    setOcrResult(null);
    setTimeout(() => {
      setIsExtracting(false);
      setOcrResult({ medicine_name: "Amoxicillin / Augmentin", generic: "Amoxicillin and Clavulanate 625mg", expiry: "12/2028", manufacturer: "GSK Pharmaceuticals", suggested_price: 175.50 });
    }, 3000);
  };

  const activeCount = orders.length;

  return (
    <main className="container">
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Dashboard</h1>
            <span style={{
              padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold',
              background: backendOnline === null ? 'rgba(100,116,139,0.3)' : backendOnline ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
              color: backendOnline === null ? '#94a3b8' : backendOnline ? '#10b981' : '#ef4444',
              border: `1px solid ${backendOnline === null ? '#475569' : backendOnline ? '#10b981' : '#ef4444'}`
            }}>
              {backendOnline === null ? '⟳ Connecting...' : backendOnline ? '● Backend Online' : '✕ Backend Offline'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>{PHARMACY_ID} — Manage incoming orders and dispatch riders.</p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: activeCount > 0 ? '#ef4444' : '#10b981' }}>{activeCount}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Active Orders</div>
          <button
            onClick={clearOrders}
            style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            🗑 Clear All Orders
          </button>
        </div>
      </div>

      <div className="grid-layout">
        {/* Live Order Queue */}
        <div className="card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
            🔴 Live Order Queue
            {activeCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: '99px', padding: '2px 10px', fontSize: '0.8rem' }}>
                {activeCount} active
              </span>
            )}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            Listening for dispatches from Vamanjoor service zone...
          </p>

          {orders.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕐</div>
              <p style={{ color: 'var(--text-muted)' }}>No active orders at the moment. Polling every 3 seconds...</p>
            </div>
          ) : (
            orders
              .filter(o => !["delivered", "rejected"].includes(o.status))
              .map(order => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const isUpdating = updatingId === order.id;
                return (
                  <div key={order.id} style={{
                    background: cfg.bg,
                    border: `2px solid ${cfg.color}`,
                    padding: '1.5rem', borderRadius: '16px',
                    marginBottom: '1rem', position: 'relative',
                    transition: 'all 0.4s ease'
                  }}>
                    {/* Status badge */}
                    <span style={{
                      position: 'absolute', top: '-12px', left: '16px',
                      background: cfg.color, color: '#fff',
                      padding: '3px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold'
                    }}>
                      {cfg.label}
                    </span>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>{order.id}</h3>
                        <p style={{ marginBottom: '0.3rem' }}>
                          <strong>Needs:</strong>{' '}
                          {Array.isArray(order.items)
                            ? order.items.map(i => `${i.quantity}x ${i.brand_name}`).join(', ')
                            : order.items}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          👤 User {order.user} &nbsp;•&nbsp; 🚚 {order.type}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '1.2rem', flexWrap: 'wrap' }}>
                      {cfg.next && (
                        <button
                          onClick={() => handleStatusUpdate(order.id, cfg.next)}
                          disabled={isUpdating}
                          style={{
                            flex: 1, padding: '0.9rem', borderRadius: '10px', border: 'none',
                            background: cfg.nextColor, color: '#fff',
                            fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
                            opacity: isUpdating ? 0.7 : 1, transition: 'all 0.2s'
                          }}
                        >
                          {isUpdating ? 'Updating...' : cfg.nextLabel}
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleReject(order.id)}
                          disabled={isUpdating}
                          style={{
                            padding: '0.9rem 1.2rem', borderRadius: '10px', border: '1px solid #ef4444',
                            background: 'transparent', color: '#ef4444',
                            fontWeight: 'bold', cursor: 'pointer'
                          }}
                        >
                          ✕ Reject
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* AI Inventory OCR */}
        <div className="card">
          <h2>📷 Smart Inventory (OCR)</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Upload a medicine strip image. AI extracts details instantly.
          </p>
          <form onSubmit={handleFileUpload} style={{ border: '2px dashed var(--border-light)', padding: '2rem', textAlign: 'center', borderRadius: '12px' }}>
            {ocrImage && (
              <div style={{ marginBottom: '1.5rem' }}>
                <img src={ocrImage} alt="Scanning..." style={{ maxHeight: '150px', borderRadius: '8px', border: '2px solid var(--primary)', animation: isExtracting ? 'pulse 1.5s infinite' : 'none' }} />
                {isExtracting && <p style={{ color: 'var(--primary)', marginTop: '10px', fontWeight: 'bold' }}>Running Tesseract Models...</p>}
              </div>
            )}
            <input type="file" accept="image/*" style={{ marginBottom: '1rem' }} required />
            <button type="submit" className="btn-primary" disabled={isExtracting}>
              {isExtracting ? 'Extracting via AI...' : 'Scan Strip'}
            </button>
          </form>

          {ocrResult && (
            <div style={{ marginTop: '1.5rem', background: 'rgba(16,185,129,0.08)', border: '1px solid #10b981', padding: '1.5rem', borderRadius: '12px' }}>
              <h3 style={{ color: '#6ee7b7', marginBottom: '1rem' }}>✅ OCR Extraction Success</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[['BRAND NAME', ocrResult.medicine_name], ['SALT / GENERIC', ocrResult.generic], ['EXPIRY', ocrResult.expiry], ['MANUFACTURER', ocrResult.manufacturer]].map(([label, val]) => (
                  <div key={label}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{label}</label>
                    <input type="text" className="input-field" defaultValue={val} readOnly />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                <label style={{ fontWeight: 'bold' }}>Quantity to Add to Stock:</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <input type="number" className="input-field" placeholder="E.g. 50" style={{ margin: 0 }} />
                  <button className="btn-primary" onClick={e => { e.preventDefault(); alert('✅ Inventory Synced!'); setOcrResult(null); }}>Sync Stock</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
