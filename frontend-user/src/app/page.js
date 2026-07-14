"use client";
import React, { useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';

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
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [cart, setCart] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hello! I am MEDORA's AI Virtual Doctor. What symptoms are you experiencing today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatFinished, setChatFinished] = useState(false);
  const [chatSuggestedMedicines, setChatSuggestedMedicines] = useState([]);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const fileInputRef = React.useRef(null);

  // Highlight matched query text
  const highlightMatch = (text, query) => {
    if (!query) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} style={{ background: 'rgba(99, 102, 241, 0.4)', color: '#fff', borderRadius: '2px', padding: '0 2px', fontWeight: 'bold' }}>
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

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
          setFocusedIndex(-1); // Reset index on new results
        }
      } catch (err) { console.error("Backend offline", err); }
    };
    const t = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Handle keyboard events in search bar
  const handleKeyDown = (e) => {
    if (!showSuggestions || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < searchResults.length) {
        addToCart(searchResults[focusedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

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

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading || chatFinished) return;

    const userMessage = { role: 'user', content: chatInput };
    const updatedMessages = [...chatMessages, userMessage];
    
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:8001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: USER_ID,
          messages: updatedMessages
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        if (data.session_finished) {
          setChatFinished(true);
          setChatSuggestedMedicines(data.suggested_medicines || []);
        }
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: "I am having trouble connecting to my diagnostic system. Please try again." }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to AI service. Please make sure the service is running on port 8001." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const resetChat = () => {
    setChatMessages([
      { role: 'assistant', content: "Hello! I am MEDORA's AI Virtual Doctor. What symptoms are you experiencing today?" }
    ]);
    setChatInput('');
    setChatFinished(false);
    setChatSuggestedMedicines([]);
  };

  const addChatSuggestedToCart = async () => {
    if (chatSuggestedMedicines.length === 0) return;
    
    for (const medName of chatSuggestedMedicines) {
      try {
        const res = await fetch(`${API}/api/v1/medicines/search?q=${medName}`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const bestMatch = data.results[0];
            addToCart(bestMatch);
          } else {
            addToCart({
              medicine_id: `MED_OTC_${Math.floor(Math.random() * 1000)}`,
              brand_name: medName,
              generic_name: medName,
              price_mrp: "20.00",
              dosage: "1 Unit"
            });
          }
        }
      } catch (e) {
        addToCart({
          medicine_id: `MED_OTC_${Math.floor(Math.random() * 1000)}`,
          brand_name: medName,
          generic_name: medName,
          price_mrp: "20.00",
          dosage: "1 Unit"
        });
      }
    }
    
    alert(`Added ${chatSuggestedMedicines.join(', ')} to cart! Check your cart above.`);
    resetChat();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    setOcrResult('');

    try {
      // Run Tesseract entirely in the browser for Vercel compatibility
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text;
      
      if (text && text.trim().length > 0) {
        setOcrResult(text);
      } else {
        setOcrResult("No text detected in the image.");
      }
    } catch (err) {
      console.error("Local OCR error:", err);
      setOcrResult("Failed to process image locally. Please try again.");
    } finally {
      setIsOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
              onKeyDown={handleKeyDown}
              style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '1rem 2rem' }}>Search</button>
          </form>

          {/* Dropdown */}
          {showSuggestions && searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '10px', background: 'rgba(15,23,42,0.98)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '1rem', backdropFilter: 'blur(10px)', maxHeight: '400px', overflowY: 'auto' }}>
              <h4 style={{ marginBottom: '10px', color: 'var(--secondary)' }}>Live Matches:</h4>
              {searchResults.map((med, idx) => {
                const isFocused = idx === focusedIndex;
                return (
                  <div key={idx} style={{ 
                    padding: '1rem', 
                    background: isFocused ? 'rgba(99, 102, 241, 0.25)' : 'rgba(0,0,0,0.4)', 
                    border: isFocused ? '1px solid var(--primary)' : '1px solid transparent',
                    borderRadius: '8px', 
                    marginBottom: '0.5rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => addToCart(med)}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  >
                    <div>
                      <strong style={{ fontSize: '1.1rem' }}>{highlightMatch(med.brand_name, searchQuery)}</strong> ({med.dosage})<br />
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Salt: {highlightMatch(med.generic_name, searchQuery)} • {med.usage_indication}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }} onClick={(e) => e.stopPropagation()}>
                      <span style={{ color: '#10b981', fontWeight: 'bold', display: 'block' }}>₹{med.price_mrp}</span>
                      <button type="button" onClick={() => addToCart(med)} className="btn-secondary" style={{ padding: '0.3rem 0.8rem', marginTop: '4px', fontSize: '0.8rem' }}>Add To Cart</button>
                    </div>
                  </div>
                );
              })}
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
        {/* AI Virtual Doctor Chat */}
        <div className="feature-card glass-panel" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.2)', margin: 0 }}>🩺</div>
              <div>
                <h3 className="card-title" style={{ margin: 0 }}>AI Virtual Doctor</h3>
                <p className="card-desc" style={{ margin: 0 }}>Step-by-step clinical symptom diagnosis & consultation</p>
              </div>
            </div>
            <button onClick={resetChat} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Reset Consultation</button>
          </div>

          <div style={{
            flex: 1,
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            padding: '1.25rem',
            overflowY: 'auto',
            maxHeight: '350px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            {chatMessages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    maxWidth: '85%'
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: isUser ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #374151, #1f2937)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.9rem', flexShrink: 0,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      {isUser ? '👤' : '🩺'}
                    </div>
                    
                    <div style={{
                      padding: '0.85rem 1.1rem',
                      borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      background: isUser ? 'linear-gradient(135deg, #4f46e5, #3730a3)' : 'rgba(30, 41, 59, 0.85)',
                      border: isUser ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                      color: '#f8fafc',
                      fontSize: '0.95rem',
                      lineHeight: '1.45',
                      whiteSpace: 'pre-wrap',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {isChatLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #374151, #1f2937)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem'
                  }}>🩺</div>
                  <div style={{
                    padding: '0.75rem 1rem', borderRadius: '4px 16px 16px 16px',
                    background: 'rgba(30, 41, 59, 0.85)', border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <span className="dot-typing" style={{ color: '#94a3b8' }}>Doctor is analyzing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {chatFinished && chatSuggestedMedicines.length > 0 && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10b981',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              animation: 'fadeIn 0.5s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>💊</span>
                <strong style={{ color: '#6ee7b7', fontSize: '1.1rem' }}>Prescribed Remedies:</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>
                The virtual doctor has suggested adding the following medicines to your cart:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.25rem 0' }}>
                {chatSuggestedMedicines.map((med, idx) => (
                  <span key={idx} style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    padding: '3px 10px',
                    borderRadius: '99px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold'
                  }}>{med}</span>
                ))}
              </div>
              <button 
                onClick={addChatSuggestedToCart}
                className="btn-primary" 
                style={{ background: '#10b981', border: 'none', padding: '0.75rem 1.5rem', alignSelf: 'flex-start', cursor: 'pointer', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}
              >
                Add Suggested Medicines to Cart
              </button>
            </div>
          )}

          <form onSubmit={sendChatMessage} style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              className="input-field"
              placeholder={chatFinished ? "Consultation completed. Click Reset to start over." : "Describe your symptom, reply to the doctor, etc..."}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              disabled={chatFinished || isChatLoading}
              style={{ flex: 1, borderRadius: '8px' }}
            />
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={chatFinished || isChatLoading || !chatInput.trim()}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              Send
            </button>
          </form>
        </div>

        {/* Vision Card */}
        <div className="feature-card glass-panel" style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column' }}>
          <div className="icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary)' }}>📷</div>
          <h3 className="card-title">Vision Verification</h3>
          <p className="card-desc">Upload prescription. OCR validates against doctor's orders.</p>
          
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }} 
          />
          
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isOcrLoading}
            className="btn-primary" 
            style={{ marginTop: 'auto', alignSelf: 'flex-start', background: 'var(--secondary)', opacity: isOcrLoading ? 0.7 : 1, cursor: isOcrLoading ? 'not-allowed' : 'pointer' }}
          >
            {isOcrLoading ? 'Scanning...' : 'Upload Rx'}
          </button>

          {ocrResult && (
            <div style={{
              marginTop: '1.5rem', padding: '1rem', borderRadius: '12px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              maxHeight: '200px', overflowY: 'auto',
              fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: '#cbd5e1',
              width: '100%'
            }}>
              <strong style={{ display: 'block', marginBottom: '8px', color: '#10b981' }}>Extracted Text:</strong>
              {ocrResult}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
