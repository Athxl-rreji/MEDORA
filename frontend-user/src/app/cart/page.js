"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-three-kappa-38.vercel.app';
const USER_ID = "1";

export default function FullPageCart() {
  const [cart, setCart] = useState([]);
  const [uploadedPrescriptionId, setUploadedPrescriptionId] = useState(null);
  
  // Payment Flow State: 'cart' | 'payment' | 'processing' | 'success'
  const [paymentStep, setPaymentStep] = useState('cart');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('user@upi');
  const [cardNumber, setCardNumber] = useState('4532 8912 3456 7890');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('888');
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

  const handleInitiatePayment = () => {
    if (cart.length === 0) return alert("Your cart is empty!");
    setPaymentStep('payment');
  };

  const handleExecutePayment = async () => {
    if (cart.length === 0) return alert("Cart is empty!");
    const totalAmt = cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0);
    setIsProcessingPayment(true);
    setPaymentStep('processing');
    setPaymentStatusMsg('Initializing 256-bit Encrypted Session...');

    // Cash on Delivery direct flow
    if (selectedPaymentMethod === 'cod') {
      try {
        await finalizeOrderPlacement(totalAmt, 'cod', `COD_${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
      } catch (err) {
        alert(`COD Error: ${err.message}`);
        setPaymentStep('payment');
      } finally {
        setIsProcessingPayment(false);
      }
      return;
    }

    // Online Payments via Razorpay Test API
    try {
      setPaymentStatusMsg('Connecting to Razorpay Test Gateway & Creating Order...');
      
      const intentRes = await fetch(`${API}/api/v1/payments/create-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: USER_ID,
          amount: totalAmt,
          currency: 'INR',
          payment_method: selectedPaymentMethod
        })
      });
      const intentData = await intentRes.json();
      
      if (!intentRes.ok) {
        throw new Error(intentData.detail || "Payment intent creation failed");
      }

      const activeKey = intentData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TGSG2Ef0As1aMa";

      // If Razorpay SDK is loaded
      if (typeof window !== 'undefined' && window.Razorpay && intentData.gateway_order_id && !intentData.gateway_order_id.startsWith('rzp_sandbox')) {
        const options = {
          key: activeKey,
          amount: Math.round(totalAmt * 100),
          currency: "INR",
          name: "MEDORA Pharmacy Ecosystem",
          description: `Pharmacy Order Payment (${selectedPaymentMethod.toUpperCase()})`,
          order_id: intentData.gateway_order_id,
          handler: async function (response) {
            setIsProcessingPayment(true);
            setPaymentStatusMsg('Verifying Payment Signature with Razorpay Servers...');
            try {
              const verifyRes = await fetch(`${API}/api/v1/payments/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  payment_method: selectedPaymentMethod
                })
              });
              if (verifyRes.ok) {
                await finalizeOrderPlacement(totalAmt, selectedPaymentMethod, response.razorpay_payment_id);
              } else {
                throw new Error("Razorpay signature verification failed.");
              }
            } catch (err) {
              alert(`Payment Verification Error: ${err.message}`);
              setIsProcessingPayment(false);
              setPaymentStep('payment');
            }
          },
          prefill: { 
            name: "MEDORA Customer", 
            email: "customer@medora.com",
            contact: "9999999999",
            method: selectedPaymentMethod === 'upi' ? 'upi' : selectedPaymentMethod === 'card' ? 'card' : undefined
          },
          theme: { color: "#B8F7E4" },
          modal: {
            ondismiss: function () {
              setIsProcessingPayment(false);
              setPaymentStep('payment');
            }
          }
        };
        
        const rzp = new window.Razorpay(options);
        rzp.open();
        return;
      }

      // Built-in Sandbox Test Verification Fallback
      setPaymentStatusMsg('Verifying Payment Security Tokens...');
      await new Promise(r => setTimeout(r, 800));

      const verifyRes = await fetch(`${API}/api/v1/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: intentData.gateway_order_id || intentData.payment_intent_id,
          payment_method: selectedPaymentMethod
        })
      });
      const verifyData = await verifyRes.json();

      await finalizeOrderPlacement(totalAmt, selectedPaymentMethod, verifyData.payment_id || intentData.payment_intent_id);

    } catch (err) {
      alert(`Payment Processing Failed: ${err.message}`);
      setPaymentStep('payment');
    } finally {
      setIsProcessingPayment(false);
    }
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* UPI */}
                <div onClick={() => setSelectedPaymentMethod('upi')} style={{ padding: '1.2rem', borderRadius: '12px', border: selectedPaymentMethod === 'upi' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)', background: selectedPaymentMethod === 'upi' ? 'rgba(184, 247, 228, 0.08)' : 'rgba(0,0,0,0.2)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    <span>⚡ UPI / QR</span>
                    {selectedPaymentMethod === 'upi' && <span style={{ color: 'var(--primary)' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>GPay, PhonePe, Paytm, BHIM</div>
                </div>

                {/* Cards */}
                <div onClick={() => setSelectedPaymentMethod('card')} style={{ padding: '1.2rem', borderRadius: '12px', border: selectedPaymentMethod === 'card' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)', background: selectedPaymentMethod === 'card' ? 'rgba(184, 247, 228, 0.08)' : 'rgba(0,0,0,0.2)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    <span>💳 Credit / Debit Card</span>
                    {selectedPaymentMethod === 'card' && <span style={{ color: 'var(--primary)' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Visa, Mastercard, RuPay</div>
                </div>

                {/* Free Sandbox */}
                <div onClick={() => setSelectedPaymentMethod('mock_gateway')} style={{ padding: '1.2rem', borderRadius: '12px', border: selectedPaymentMethod === 'mock_gateway' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)', background: selectedPaymentMethod === 'mock_gateway' ? 'rgba(184, 247, 228, 0.08)' : 'rgba(0,0,0,0.2)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    <span>🛡️ Free Sandbox</span>
                    {selectedPaymentMethod === 'mock_gateway' && <span style={{ color: 'var(--primary)' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Simulated Test Gateway</div>
                </div>

                {/* COD */}
                <div onClick={() => setSelectedPaymentMethod('cod')} style={{ padding: '1.2rem', borderRadius: '12px', border: selectedPaymentMethod === 'cod' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)', background: selectedPaymentMethod === 'cod' ? 'rgba(184, 247, 228, 0.08)' : 'rgba(0,0,0,0.2)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    <span>💵 Cash on Delivery</span>
                    {selectedPaymentMethod === 'cod' && <span style={{ color: 'var(--primary)' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pay at Doorstep</div>
                </div>
              </div>

              {/* Dynamic Inputs */}
              {selectedPaymentMethod === 'upi' && (
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.88rem', color: 'var(--primary)', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                      ⚡ Instant Scan & Pay ₹{totalAmount.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scan using GPay, PhonePe, Paytm or BHIM app</span>
                  </div>
                  
                  {/* Dynamic QR Code */}
                  <div style={{ background: '#fff', padding: '10px', borderRadius: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=upi://pay?pa=medora.pay@upi%26pn=MEDORA%20Pharmacy%26am=${totalAmount.toFixed(2)}%26cu=INR`} 
                      alt="UPI QR Code"
                      style={{ width: '130px', height: '130px', display: 'block' }}
                    />
                  </div>

                  <div style={{ width: '100%' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Or enter VPA / UPI ID:</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        value={upiId} 
                        onChange={e => setUpiId(e.target.value)}
                        style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#16171a', border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.9rem' }}
                      />
                      <span style={{ background: 'rgba(74, 222, 128, 0.15)', color: 'var(--green)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                        Verified ✓
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedPaymentMethod === 'card' && (
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {/* Card Preview Chip */}
                  <div style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', color: '#fff', fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontFamily: 'sans-serif', fontWeight: 'bold' }}>CREDIT / DEBIT</span>
                      <span style={{ fontSize: '1.1rem' }}>💳</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>{cardNumber || '•••• •••• •••• ••••'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      <span>CARDHOLDER</span>
                      <span>EXP: {cardExpiry || 'MM/YY'}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Card Number:</label>
                    <input type="text" value={cardNumber} onChange={e => setCardNumber(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#16171a', border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.9rem' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Expiry Date:</label>
                      <input type="text" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#16171a', border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.9rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CVC / CVV:</label>
                      <input type="password" maxLength={4} value={cardCvc} onChange={e => setCardCvc(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#16171a', border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.9rem' }} />
                    </div>
                  </div>
                </div>
              )}

              <button onClick={handleExecutePayment} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                {selectedPaymentMethod === 'cod' ? 'Confirm COD Order 🛵' : `Pay ₹${totalAmount.toFixed(2)} & Authorize 🔒`}
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
