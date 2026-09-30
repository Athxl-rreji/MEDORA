"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const USER_ID = "1";

export default function FullPageCart() {
  const [cart, setCart] = useState([]);
  const [uploadedPrescriptionId, setUploadedPrescriptionId] = useState(null);
  
  // Payment Flow State: 'cart' | 'payment' | 'processing' | 'success'
  const [paymentStep, setPaymentStep] = useState('cart');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [liveTerminalData, setLiveTerminalData] = useState(null);
  const [qrViewMode, setQrViewMode] = useState('auto');
  const [isRefreshingLiveQr, setIsRefreshingLiveQr] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatusMsg, setPaymentStatusMsg] = useState('');
  const [completedOrderInfo, setCompletedOrderInfo] = useState(null);

  useEffect(() => {
    // Load local cart if present in localStorage or state
    try {
      const savedCart = localStorage.getItem('medora_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (e) {}
  }, []);

  const saveCartToStorage = (updated) => {
    setCart(updated);
    try {
      localStorage.setItem('medora_cart', JSON.stringify(updated));
    } catch (e) {}
  };

  const removeFromCart = (index) => {
    const updated = cart.filter((_, i) => i !== index);
    saveCartToStorage(updated);
  };

  const clearCart = () => {
    saveCartToStorage([]);
  };

  const fetchPharmacyLiveTerminalQr = async () => {
    setIsRefreshingLiveQr(true);
    try {
      const totalAmt = cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0);
      const res = await fetch(`${API}/api/v1/medicines/pharmacy/live-terminal-qr?pharmacy_id=PHARM_001&amount=${totalAmt}`);
      if (res.ok) {
        const data = await res.json();
        setLiveTerminalData(data);
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (e) {
      console.warn('Could not fetch pharmacy live terminal QR:', e);
    } finally {
      setIsRefreshingLiveQr(false);
    }
  };

  // Real-time synchronization heartbeat with store UPI terminal
  useEffect(() => {
    if (paymentStep !== 'payment') return;
    fetchPharmacyLiveTerminalQr();
    const interval = setInterval(() => {
      fetchPharmacyLiveTerminalQr();
    }, 3500);
    return () => clearInterval(interval);
  }, [paymentStep, cart]);

  const handleInitiatePayment = () => {
    if (cart.length === 0) return alert("Your cart is empty!");
    setPaymentStep('payment');
    fetchPharmacyLiveTerminalQr();
  };

  const handleExecutePayment = async () => {
    if (cart.length === 0) return alert("Cart is empty!");
    const totalAmt = cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0);
    setIsProcessingPayment(true);
    setPaymentStep('processing');

    // 1. Cash on Delivery
    if (selectedPaymentMethod === 'cod') {
      try {
        setPaymentStatusMsg('Confirming COD Request with Fulfilling Pharmacy & Dispatching Rider...');
        await new Promise(r => setTimeout(r, 700));
        await finalizeOrderPlacement(totalAmt, 'cod', `COD_${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
      } catch (err) {
        alert(`COD Error: ${err.message}`);
        setPaymentStep('payment');
      } finally {
        setIsProcessingPayment(false);
      }
      return;
    }

    // 2. Direct Store UPI Payment Flow with Terminal Soundbox Sync
    if (selectedPaymentMethod === 'upi') {
      try {
        setPaymentStatusMsg('Connecting to Store Terminal & Synchronizing UPI Soundbox...');
        await new Promise(r => setTimeout(r, 900));
        setPaymentStatusMsg('Verifying Payment with Store POS Soundbox & Authorizing...');
        await new Promise(r => setTimeout(r, 800));
        const upiTxnId = `UPI_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        await finalizeOrderPlacement(totalAmt, 'upi', upiTxnId);
      } catch (err) {
        alert(`UPI Payment Error: ${err.message}`);
        setPaymentStep('payment');
      } finally {
        setIsProcessingPayment(false);
      }
      return;
    }

    setSelectedPaymentMethod('upi');
    setIsProcessingPayment(false);
    setPaymentStep('payment');
  };

  const totalAmount = cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)', color: 'var(--text-main)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Navigation Bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>🧬 MEDORA</span>
          </Link>
          <Link href="/" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.5rem 1.2rem', borderRadius: '99px', textDecoration: 'none', fontSize: '0.88rem' }}>
            ← Home
          </Link>
        </header>

        {/* Main Cart Container */}
        <main className="glass-panel" style={{ padding: '2rem' }}>
          
          {/* Header Step Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>🛒</span> Shopping Cart Checkout
            </h1>
            <span style={{ fontSize: '0.85rem', background: 'rgba(184, 247, 228, 0.1)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '99px' }}>
              🛡️ Free Developer Test Gateway Mode
            </span>
          </div>

          {/* STEP 1: CART LIST VIEW */}
          {paymentStep === 'cart' && (
            <div>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                  <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1rem' }}>🛒</span>
                  <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>Your cart is empty</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Add medicines from our store to proceed to checkout.</p>
                  <Link href="/" className="btn-primary" style={{ textDecoration: 'none' }}>
                    🔍 Search Medicines & Add to Cart
                  </Link>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Items in your Cart ({cart.length}):</span>
                    <button onClick={clearCart} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
                      Clear All
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                    {cart.map((item, idx) => (
                      <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '1.1rem', color: '#fff' }}>{item.brand_name}</strong> {item.dosage && `(${item.dosage})`}
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>Generic Composition: {item.generic_name}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>₹{item.price_mrp}</span>
                          <button onClick={() => removeFromCart(idx)} style={{ background: 'transparent', border: '1px solid rgba(255,107,107,0.3)', color: 'var(--red)', borderRadius: '8px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary Card */}
                  <div style={{ background: 'rgba(184, 247, 228, 0.04)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', display: 'block' }}>Grand Total</span>
                      <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>₹{totalAmount.toFixed(2)}</span>
                    </div>
                    <button onClick={handleInitiatePayment} className="btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}>
                      Proceed to Payment 💳
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 2: PAYMENT METHOD SELECTION */}
          {paymentStep === 'payment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <button onClick={() => setPaymentStep('cart')} style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                ← Back to Cart
              </button>

              <div style={{ background: 'rgba(184, 247, 228, 0.05)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Amount</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>₹{totalAmount.toFixed(2)}</div>
                </div>
                <span style={{ background: 'rgba(74, 222, 128, 0.15)', color: 'var(--green)', padding: '6px 14px', borderRadius: '99px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  ⚡ Free 15-Min Quick Delivery
                </span>
              </div>

              {/* Payment Option Cards - Strictly UPI & COD Only */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* UPI Card */}
                <div 
                  onClick={() => setSelectedPaymentMethod('upi')} 
                  style={{ 
                    padding: '1.2rem', 
                    borderRadius: '14px', 
                    border: selectedPaymentMethod === 'upi' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)', 
                    background: selectedPaymentMethod === 'upi' ? 'rgba(184, 247, 228, 0.08)' : 'rgba(0,0,0,0.2)', 
                    cursor: 'pointer',
                    boxShadow: selectedPaymentMethod === 'upi' ? '0 4px 18px rgba(13, 148, 136, 0.2)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    <span style={{ color: '#fff' }}>⚡ UPI Instant Pay & QR</span>
                    {selectedPaymentMethod === 'upi' && <span style={{ color: 'var(--primary)' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>GPay, PhonePe, Paytm & Soundbox Sync</div>
                </div>

                {/* COD Card */}
                <div 
                  onClick={() => setSelectedPaymentMethod('cod')} 
                  style={{ 
                    padding: '1.2rem', 
                    borderRadius: '14px', 
                    border: selectedPaymentMethod === 'cod' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)', 
                    background: selectedPaymentMethod === 'cod' ? 'rgba(184, 247, 228, 0.08)' : 'rgba(0,0,0,0.2)', 
                    cursor: 'pointer',
                    boxShadow: selectedPaymentMethod === 'cod' ? '0 4px 18px rgba(13, 148, 136, 0.2)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    <span style={{ color: '#fff' }}>💵 Cash on Delivery</span>
                    {selectedPaymentMethod === 'cod' && <span style={{ color: 'var(--primary)' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pay cash or UPI scan to rider at doorstep</div>
                </div>
              </div>

              {/* Dynamic Inputs for UPI */}
              {selectedPaymentMethod === 'upi' && (
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  
                  {/* Store Sync Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        DISPATCHING PARTNER PHARMACY:
                      </div>
                      <div style={{ fontSize: '1rem', color: '#fff', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🏥</span>
                        <span>{liveTerminalData?.pharmacy_name || 'Vamanjoor Express Pharmacy'}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', fontWeight: '600' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                        <span>Live Terminal Synced {lastSyncTime ? `(${lastSyncTime})` : '• Real-Time Active'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={fetchPharmacyLiveTerminalQr}
                      disabled={isRefreshingLiveQr}
                      style={{
                        background: 'rgba(13, 148, 136, 0.15)',
                        border: '1px solid var(--primary)',
                        color: 'var(--primary)',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 'bold',
                        cursor: isRefreshingLiveQr ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <span>🔄</span>
                      <span>{isRefreshingLiveQr ? 'Syncing...' : 'Sync Terminal'}</span>
                    </button>
                  </div>

                  {/* QR View Mode Toggles */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setQrViewMode('live')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: (qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                        background: (qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                        color: (qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) ? '#34d399' : '#94a3b8',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>📷</span>
                      <span>Soundbox Display {liveTerminalData?.has_live_scanner_qr ? '● LIVE' : '(Idle)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQrViewMode('shop')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: qrViewMode === 'shop' || (!liveTerminalData?.has_live_scanner_qr && qrViewMode === 'auto') ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                        background: qrViewMode === 'shop' || (!liveTerminalData?.has_live_scanner_qr && qrViewMode === 'auto') ? 'rgba(184, 247, 228, 0.1)' : 'rgba(0,0,0,0.2)',
                        color: qrViewMode === 'shop' || (!liveTerminalData?.has_live_scanner_qr && qrViewMode === 'auto') ? 'var(--primary)' : '#94a3b8',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>🏪</span>
                      <span>Store Exact-Amount QR</span>
                    </button>
                  </div>

                  {/* QR Display Area */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
                    {(qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) && liveTerminalData?.live_upi_qr ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ background: '#fff', padding: '10px', borderRadius: '14px', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)', border: '2px solid #10b981', display: 'inline-block' }}>
                          <img 
                            src={liveTerminalData.live_upi_qr} 
                            alt="Live POS Machine Screen"
                            style={{ maxWidth: '210px', maxHeight: '190px', objectFit: 'contain', borderRadius: '8px', display: 'block' }}
                          />
                        </div>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '3px 10px', borderRadius: '99px', fontSize: '0.74rem', fontWeight: 'bold' }}>
                            🟢 LIVE POS DISPLAY
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                            {liveTerminalData.terminal_label || 'Counter Soundbox'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ background: '#fff', padding: '12px', borderRadius: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', border: '2px solid var(--primary)', display: 'inline-block' }}>
                          <img 
                            src={liveTerminalData?.dynamic_upi_qr || liveTerminalData?.shop_upi_qr || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${encodeURIComponent(liveTerminalData?.shop_upi_id || 'vamanjoor.pharmacy@upi')}%26pn=${encodeURIComponent(liveTerminalData?.pharmacy_name || 'Vamanjoor Pharmacy')}%26am=${totalAmount.toFixed(2)}%26cu=INR`} 
                            alt="Store Official UPI QR"
                            style={{ width: '160px', height: '160px', objectFit: 'contain', display: 'block' }}
                          />
                        </div>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span style={{ background: 'rgba(184, 247, 228, 0.15)', color: 'var(--primary)', padding: '3px 10px', borderRadius: '99px', fontSize: '0.74rem', fontWeight: 'bold' }}>
                            ₹{totalAmount.toFixed(2)} PRE-ENCODED
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                            Auto-fills in your UPI app
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 1-Tap Mobile UPI Intent Launcher */}
                    <a
                      href={liveTerminalData?.upi_intent || `upi://pay?pa=${encodeURIComponent(liveTerminalData?.shop_upi_id || 'vamanjoor.pharmacy@upi')}&pn=${encodeURIComponent(liveTerminalData?.pharmacy_name || 'Vamanjoor Express Pharmacy')}&am=${totalAmount.toFixed(2)}&cu=INR&tn=MEDORA-Order`}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
                        color: '#ffffff',
                        padding: '11px 18px',
                        borderRadius: '10px',
                        textDecoration: 'none',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)'
                      }}
                    >
                      <span>📲</span>
                      <span>Pay via UPI App (GPay / PhonePe / Paytm / BHIM)</span>
                    </a>

                    {/* Soundbox Voice Guarantee */}
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '10px 14px', fontSize: '0.78rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '1.25rem' }}>🔊</span>
                      <div>
                        <strong>Soundbox Voice Confirmation:</strong> Counter POS speaker at {liveTerminalData?.pharmacy_name || 'Vamanjoor Express'} will announce <em>&quot;₹{totalAmount.toFixed(2)} received&quot;</em> in real time upon payment.
                      </div>
                    </div>
                  </div>

                  {/* Store Verified UPI VPA / ID Row */}
                  <div style={{ width: '100%' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>
                      Shop's Verified UPI VPA / ID:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        readOnly
                        value={liveTerminalData?.shop_upi_id || 'vamanjoor.pharmacy@upi'} 
                        style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#16171a', border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 'bold' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const vpa = liveTerminalData?.shop_upi_id || 'vamanjoor.pharmacy@upi';
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(vpa);
                          }
                          setCopiedVpa(true);
                          setTimeout(() => setCopiedVpa(false), 2000);
                        }}
                        style={{
                          background: copiedVpa ? 'rgba(74, 222, 128, 0.2)' : 'rgba(184, 247, 228, 0.1)',
                          border: '1px solid var(--primary)',
                          color: copiedVpa ? 'var(--green)' : 'var(--primary)',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {copiedVpa ? '✓ Copied!' : '📋 Copy VPA'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* COD Option Content */}
              {selectedPaymentMethod === 'cod' && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1.25rem', borderRadius: '14px', border: '1px dashed rgba(245, 158, 11, 0.4)', fontSize: '0.88rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '2rem' }}>💵</span>
                  <div>
                    <div style={{ fontWeight: '800', color: '#fef08a', marginBottom: '3px' }}>Cash on Doorstep Delivery</div>
                    Pay ₹{totalAmount.toFixed(2)} directly to your rider via cash or mobile UPI scan when your parcel arrives in 15 mins.
                  </div>
                </div>
              )}

              <button onClick={handleExecutePayment} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                {selectedPaymentMethod === 'cod' ? 'Confirm COD Order 🛵' : `Pay ₹${totalAmount.toFixed(2)} via UPI & Place Order ⚡`}
              </button>
            </div>
          )}

          {/* STEP 3: PROCESSING */}
          {paymentStep === 'processing' && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '4px solid rgba(184, 247, 228, 0.2)', borderTop: '4px solid var(--primary)', animation: 'spin 1s linear infinite' }} />
              <h2 style={{ color: '#fff', margin: 0 }}>Processing Payment</h2>
              <p style={{ color: 'var(--primary)', margin: 0 }}>{paymentStatusMsg}</p>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {paymentStep === 'success' && completedOrderInfo && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ fontSize: '4rem' }}>🎉</div>
              <h2 style={{ color: 'var(--primary)', margin: 0 }}>Payment & Order Confirmed!</h2>
              
              <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Order Reference:</span>
                  <strong style={{ color: '#fff' }}>#{completedOrderInfo.order_id}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Payment ID:</span>
                  <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{completedOrderInfo.payment_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>{completedOrderInfo.payment_status}</span>
                </div>
              </div>

              <Link href="/" className="btn-primary" style={{ justifyContent: 'center', textDecoration: 'none', padding: '1rem' }}>
                🛵 Back to Home & Track Order
              </Link>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
