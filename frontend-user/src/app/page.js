"use client";
import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const USER_ID = "1";

// Order lifecycle
const STAGES = [
  { key: "pending",          label: "Order Placed",       icon: "🛒" },
  { key: "accepted",         label: "Pharmacy Confirmed",  icon: "✅" },
  { key: "ready",            label: "Packed & Ready",      icon: "📦" },
  { key: "out_for_delivery", label: "Rider Picked Up",     icon: "🛵" },
  { key: "delivered",        label: "Delivered",           icon: "🏠" },
];

function TrackingBar({ status }) {
  const currentIdx = STAGES.findIndex(s => s.key === status);
  return (
    <div style={{ margin: '1.5rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        {/* Progress line behind */}
        <div style={{
          position: 'absolute', top: '22px', left: '22px', right: '22px', height: '4px',
          background: 'rgba(255,255,255,0.1)', borderRadius: '4px', zIndex: 0
        }} />
        <div style={{
          position: 'absolute', top: '22px', left: '22px', height: '4px',
          width: currentIdx <= 0 ? '0%' : `${(currentIdx / (STAGES.length - 1)) * 100}%`,
          background: 'linear-gradient(90deg, #6366f1, #10b981)',
          borderRadius: '4px', zIndex: 1,
          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />

        {STAGES.map((stage, idx) => {
          const done = idx <= currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, flex: 1 }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: done ? 'linear-gradient(135deg, #6366f1, #10b981)' : 'rgba(30,41,59,0.8)',
                border: active ? '3px solid #a5b4fc' : done ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem',
                boxShadow: active ? '0 0 20px rgba(99,102,241,0.6)' : 'none',
                transition: 'all 0.5s ease'
              }}>
                {stage.icon}
              </div>
              <span style={{
                fontSize: '0.7rem', marginTop: '8px', textAlign: 'center',
                color: done ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
                fontWeight: active ? '700' : '400',
                maxWidth: '80px', lineHeight: '1.2'
              }}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cart, setCart] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [symptoms, setSymptoms] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Live suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.length < 2) { setSearchResults([]); setShowSuggestions(false); return; }
      try {
        const res = await fetch(`${API}/api/v1/medicines/search?q=${searchQuery}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowSuggestions(true);
        }
      } catch (err) { console.error("Backend offline", err); }
    };
    const t = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Poll user's own orders for live tracking
  useEffect(() => {
    const fetchMyOrders = async () => {
      try {
        const res = await fetch(`${API}/api/v1/orders/user/${USER_ID}`);
        if (res.ok) {
          const data = await res.json();
          // Only show non-delivered orders in tracker
          const live = (data.orders || []).filter(o => o.status !== 'delivered');
          setActiveOrders(live);
        }
      } catch (e) {}
    };
    fetchMyOrders();
    const interval = setInterval(fetchMyOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  const addToCart = (med) => {
    setCart(prev => [...prev, med]);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const removeFromCart = (idx) => setCart(cart.filter((_, i) => i !== idx));

  const handleCheckout = async () => {
    if (cart.length === 0) return alert("Cart is empty!");
    try {
      const response = await fetch(`${API}/api/v1/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: USER_ID,
          items: cart.map(item => ({
            medicine_id: item.medicine_id,
            brand_name: item.brand_name,
            price_mrp: parseFloat(item.price_mrp),
            quantity: 1
          })),
          delivery_type: "15-Min Quick Commerce",
          distance: "2.5 km away"
        })
      });
      if (response.ok) {
        setCart([]);
        alert("✅ Order placed! Track it live below.");
      } else {
        const err = await response.json();
        alert(`Failed: ${err.detail?.[0]?.msg || JSON.stringify(err.detail)}`);
      }
    } catch (err) {
      alert("Network error reaching backend.");
    }
  };

  const processSymptoms = async () => {
    if (!symptoms) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: USER_ID, symptoms })
      });
      const data = await res.json();
      setAiAnalysis(data);
    } catch {
      setAiAnalysis({ message: "AI Service unavailable. Ensure port 8001 is running." });
    }
    setIsAiLoading(false);
  };

  return (
    <main className="container">
      {/* Hero */}
      <section className="hero-section animate-float" style={{ position: 'relative', zIndex: 100 }}>
        <h1 className="hero-title">
          Smart Pharmacy, <br />
          <span className="gradient-text">Delivered Instantly.</span>
        </h1>
        <p className="hero-subtitle">
          Search generics, connect to AI symptom matchers, and get ultra-fast delivery. (User: {USER_ID})
        </p>

        {/* Search */}
        <div className="search-container glass-panel" style={{ padding: '0.5rem', borderRadius: '16px', flexDirection: 'column', position: 'relative' }}>
          <form onSubmit={e => { e.preventDefault(); }} style={{ display: 'flex', width: '100%', gap: '1rem' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search medicines (e.g. Paracetamol, Dolo)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchQuery.length > 1) setShowSuggestions(true); }}
              style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '1rem 2rem' }}>Search</button>
          </form>

          {/* Dropdown */}
          {showSuggestions && searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '10px', background: 'rgba(15,23,42,0.98)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '1rem', backdropFilter: 'blur(10px)', maxHeight: '400px', overflowY: 'auto' }}>
              <h4 style={{ marginBottom: '10px', color: 'var(--secondary)' }}>Live Matches:</h4>
              {searchResults.map((med, idx) => (
                <div key={idx} style={{ padding: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem' }}>{med.brand_name}</strong> ({med.dosage})<br />
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Salt: {med.generic_name} • {med.usage_indication}</span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold', display: 'block' }}>₹{med.price_mrp}</span>
                    <button type="button" onClick={() => addToCart(med)} className="btn-secondary" style={{ padding: '0.3rem 0.8rem', marginTop: '4px', fontSize: '0.8rem' }}>Add To Cart</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Cart */}
      {cart.length > 0 && (
        <section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--primary)' }}>
          <h2>🛒 Your Cart ({cart.length} items)</h2>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
            {cart.map((item, idx) => (
              <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>{item.brand_name} {item.dosage} ({item.generic_name})</span>
                <div>
                  <span style={{ color: '#10b981', marginRight: '1rem' }}>₹{item.price_mrp}</span>
                  <button onClick={() => removeFromCart(idx)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <h3 style={{ margin: 0 }}>Total: ₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)}</h3>
            <button onClick={handleCheckout} className="btn-primary" style={{ background: '#10b981' }}>Secure Checkout</button>
          </div>
        </section>
      )}

      {/* Live Order Tracking */}
      {activeOrders.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>📍 Live Order Tracking</h2>
          {activeOrders.map(order => (
            <div key={order.id} className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1rem', border: '1px solid rgba(99,102,241,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Order #{order.id}</span>
                <span style={{
                  padding: '4px 12px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 'bold',
                  background: order.status === 'delivered' ? '#10b981' : order.status === 'out_for_delivery' ? '#f59e0b' : 'rgba(99,102,241,0.3)',
                  color: 'white'
                }}>
                  {order.status?.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
                📍 {order.pharmacy_id} &nbsp;•&nbsp;
                🧾 {Array.isArray(order.items) ? order.items.map(i => `${i.quantity}x ${i.brand_name}`).join(', ') : order.items}
              </p>
              <TrackingBar status={order.status} />
            </div>
          ))}
        </section>
      )}

      {/* Feature Cards */}
      <section className="features-grid">
        {/* AI Symptom Card */}
        <div className="feature-card glass-panel" style={{ gridColumn: 'span 2' }}>
          <div className="icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.2)' }}>🤖</div>
          <h3 className="card-title">AI Symptom Assistant</h3>
          <p className="card-desc">Describe how you're feeling. Our AI cross-references your medical profile safely.</p>
          <textarea
            className="input-field"
            placeholder="E.g. I have a severe chest pain and shortness of breath..."
            rows="3" value={symptoms}
            onChange={e => setSymptoms(e.target.value)}
            style={{ marginTop: '1rem', resize: 'none' }}
          />
          <button onClick={processSymptoms} className="btn-primary" style={{ marginTop: '1rem', width: 'fit-content' }}>
            {isAiLoading ? 'Analyzing...' : 'Analyze Symptoms'}
          </button>
          {aiAnalysis && (
            <div style={{
              marginTop: '1.5rem', padding: '1.5rem', borderRadius: '12px',
              background: aiAnalysis.critical ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              border: `1px solid ${aiAnalysis.critical ? '#ef4444' : '#10b981'}`
            }}>
              <h4 style={{ color: aiAnalysis.critical ? '#fca5a5' : '#6ee7b7', marginBottom: '0.5rem' }}>
                {aiAnalysis.critical ? '⚠️ CRITICAL RED FLAG DETECTED' : '✅ AI Assessment Complete'}
              </h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{aiAnalysis.message}</p>
              {aiAnalysis.suggested_otc_medicines?.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Recommend checking: </strong>
                  <span style={{ color: 'var(--primary)' }}>{aiAnalysis.suggested_otc_medicines.join(', ')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vision Card */}
        <div className="feature-card glass-panel" style={{ alignSelf: 'flex-start' }}>
          <div className="icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary)' }}>📷</div>
          <h3 className="card-title">Vision Verification</h3>
          <p className="card-desc">Upload prescription. OCR validates against doctor's orders.</p>
          <button type="button" onClick={() => alert("✅ Document Scanner Active!")} className="btn-primary" style={{ marginTop: 'auto', alignSelf: 'flex-start', background: 'var(--secondary)' }}>Upload Rx</button>
        </div>
      </section>
    </main>
  );
}
