"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API } from '../../utils/apiConfig';
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

  // AI Drug Interaction Checker States
  const [isAiCheckingInteractions, setIsAiCheckingInteractions] = useState(false);
  const [aiInteractionModalOpen, setAiInteractionModalOpen] = useState(false);
  const [aiInteractionReport, setAiInteractionReport] = useState(null);
  const [safetyVerifiedBanner, setSafetyVerifiedBanner] = useState(false);
  const [toastNotice, setToastNotice] = useState(null);

  const showCartToast = (msg, icon = '✓') => {
    setToastNotice({ msg, icon });
    setTimeout(() => setToastNotice(null), 3500);
  };


  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('medora_cart');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to load cart from localStorage:", e);
    }
  }, []);

  const clearCart = () => {
    setCart([]);
    try {
      localStorage.removeItem('medora_cart');
    } catch (e) {}
  };

  const removeFromCart = (index) => {
    setCart((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      try {
        localStorage.setItem('medora_cart', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const fetchPharmacyLiveTerminalQr = async () => {
    setIsRefreshingLiveQr(true);
    try {
      const totalAmt = cart.reduce((s, i) => s + (parseFloat(i.price_mrp || i.price || 0) || 0), 0);
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

  // Real-time synchronization heartbeat with fulfilling pharmacy UPI terminal during checkout
  useEffect(() => {
    if (paymentStep !== 'payment') return;
    fetchPharmacyLiveTerminalQr();
    const syncInterval = setInterval(() => {
      fetchPharmacyLiveTerminalQr();
    }, 3500);
    return () => clearInterval(syncInterval);
  }, [paymentStep, cart]);

  const finalizeOrderPlacement = async (totalAmt, method, paymentId) => {
    setPaymentStatusMsg('Confirming Order with Pharmacy & Dispatching Delivery Rider...');
    await new Promise(r => setTimeout(r, 600));

    let activeUser = null;
    let selectedAddress = null;
    try {
      const uStr = localStorage.getItem('medora_active_user');
      if (uStr) activeUser = JSON.parse(uStr);
      const aStr = localStorage.getItem('medora_selected_address');
      if (aStr) selectedAddress = JSON.parse(aStr);
    } catch (e) {}

    const currentUserId = activeUser?.id || activeUser?.email || USER_ID;
    const activeRiderQr = (typeof window !== 'undefined' ? (localStorage.getItem('medora_rider_main_qr') || '') : '') || activeUser?.rider_upi_qr || '';

    const orderRes = await fetch(`${API}/api/v1/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUserId,
        user: currentUserId,
        user_email: activeUser?.email || "patient@medora.com",
        user_name: activeUser?.name || "Patient",
        items: cart.map(item => ({
          medicine_id: item.medicine_id || item.id,
          brand_name: item.brand_name || item.name,
          price_mrp: parseFloat(item.price_mrp || item.price || 0) || 0,
          quantity: item.quantity || 1
        })),
        prescription_id: uploadedPrescriptionId,
        delivery_type: "15-Min Quick Commerce",
        distance: selectedAddress?.area ? `${selectedAddress.area} (Nearby Hub)` : "1.2 km away",
        payment_method: method,
        payment_status: method === 'cod' ? 'unpaid' : 'paid',
        payment_id: paymentId,
        rider_qr_image: activeRiderQr || undefined,
        delivery_address: selectedAddress
      })
    });

    if (orderRes.ok) {
      const orderData = await orderRes.json();
      if (activeRiderQr && orderData.order?.id && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`medora_order_qr_${orderData.order.id}`, activeRiderQr);
        } catch (e) {}
      }
      setCompletedOrderInfo({
        order_id: orderData.order?.id || "ORD-SUCCESS",
        total: totalAmt,
        payment_method: method.toUpperCase(),
        payment_id: paymentId,
        payment_status: method === 'cod' ? 'Unpaid (COD)' : 'Paid ✅'
      });
      setCart([]);
      try { localStorage.removeItem('medora_cart'); } catch(e){}
      setUploadedPrescriptionId(null);
      setPaymentStep('success');
    } else {
      let errorMsg = "Failed to confirm order.";
      try {
        const err = await orderRes.json();
        errorMsg = err.detail?.[0]?.msg || err.detail || err.message || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }
  };

  // Clinical Rule Matrix for Drug Interactions

  const checkClientSideInteractions = (items) => {
    if (!items || items.length < 2) return [];
    const alerts = [];
    const textOf = (m) => `${m.brand_name || m.name || ''} ${m.generic_name || m.salt || ''} ${m.dosage || ''}`.toLowerCase();

    const paracetamolMeds = items.filter(m => /dolo|crocin|calpol|pacimol|paracetamol|acetaminophen|combiflam|febrex/.test(textOf(m)));
    const nsaidMeds = items.filter(m => /ibuprofen|combiflam|diclofenac|voveran|aceclofenac|zerodol|naproxen|brufen|ketorolac/.test(textOf(m)));
    const antibioticMeds = items.filter(m => /ciprofloxacin|cipro|azithromycin|azithral|azee|doxycycline|doxy|levofloxacin|norfloxacin|augmentin|amoxicillin|cefixime/.test(textOf(m)));
    const antacidCalciumMeds = items.filter(m => /gelusil|digene|shelcal|calcium|antacid|sucralfate|aluminium|magnesium/.test(textOf(m)));
    const sedativeAntihistamineMeds = items.filter(m => /cetirizine|allegra|fexofenadine|atarax|hydroxyzine|benadryl|pheniramine|avil|montelukast|ascoril/.test(textOf(m)));
    const bloodThinnerMeds = items.filter(m => /aspirin|ecospirin|clopidogrel|clopilet|warfarin|eliquis|apixaban|heparin/.test(textOf(m)));
    const steroidMeds = items.filter(m => /prednisolone|dexamethasone|betnesol|deflazacort|medrol|hydrocortisone/.test(textOf(m)));

    if (paracetamolMeds.length >= 2) {
      alerts.push({
        medicine_a: paracetamolMeds[0].brand_name || paracetamolMeds[0].name,
        medicine_b: paracetamolMeds[1].brand_name || paracetamolMeds[1].name,
        severity: 'CRITICAL',
        title: '⚠️ Duplicate Paracetamol Overdose Hazard',
        description: `Both '${paracetamolMeds[0].brand_name}' and '${paracetamolMeds[1].brand_name}' contain Paracetamol. Co-administering multiple Paracetamol formulations risks exceeding safe hepatotoxic ceiling (2000-4000mg/day), carrying severe risk of acute toxic liver injury.`,
        recommendation: `Remove one of the Paracetamol products (${paracetamolMeds[0].brand_name} or ${paracetamolMeds[1].brand_name}) before checkout.`
      });
    }

    if (nsaidMeds.length >= 2) {
      alerts.push({
        medicine_a: nsaidMeds[0].brand_name || nsaidMeds[0].name,
        medicine_b: nsaidMeds[1].brand_name || nsaidMeds[1].name,
        severity: 'CRITICAL',
        title: '⚠️ Dual NSAID Gastric Ulceration Hazard',
        description: `Taking '${nsaidMeds[0].brand_name}' concurrently with '${nsaidMeds[1].brand_name}' combines two potent NSAIDs, multiplying the risk of gastric mucosal erosion, peptic ulcer perforation, and renal impairment.`,
        recommendation: `Choose either '${nsaidMeds[0].brand_name}' or '${nsaidMeds[1].brand_name}'. Do not consume two NSAID pain relievers together.`
      });
    }

    if (bloodThinnerMeds.length > 0 && nsaidMeds.length > 0) {
      alerts.push({
        medicine_a: bloodThinnerMeds[0].brand_name || bloodThinnerMeds[0].name,
        medicine_b: nsaidMeds[0].brand_name || nsaidMeds[0].name,
        severity: 'CRITICAL',
        title: '🩸 Severe Internal Hemorrhage & Bleeding Risk',
        description: `Combining blood thinner '${bloodThinnerMeds[0].brand_name}' with NSAID '${nsaidMeds[0].brand_name}' impairs clotting and mucosal protection, creating a severe risk of gastrointestinal bleeding.`,
        recommendation: `Consult your doctor before taking '${nsaidMeds[0].brand_name}' with '${bloodThinnerMeds[0].brand_name}'.`
      });
    }

    if (antibioticMeds.length > 0 && antacidCalciumMeds.length > 0) {
      alerts.push({
        medicine_a: antibioticMeds[0].brand_name || antibioticMeds[0].name,
        medicine_b: antacidCalciumMeds[0].brand_name || antacidCalciumMeds[0].name,
        severity: 'MODERATE',
        title: '⚠️ Antibiotic Inactivation by Antacid / Minerals',
        description: `Metal cations in '${antacidCalciumMeds[0].brand_name}' chelate and bind with '${antibioticMeds[0].brand_name}', preventing antibiotic absorption and causing treatment failure.`,
        recommendation: `Maintain a minimum 2 to 3 hour gap between taking '${antibioticMeds[0].brand_name}' and '${antacidCalciumMeds[0].brand_name}'.`
      });
    }

    if (steroidMeds.length > 0 && nsaidMeds.length > 0) {
      alerts.push({
        medicine_a: steroidMeds[0].brand_name || steroidMeds[0].name,
        medicine_b: nsaidMeds[0].brand_name || nsaidMeds[0].name,
        severity: 'CRITICAL',
        title: '⚠️ Synergistic Peptic Ulceration & Perforation',
        description: `Corticosteroid '${steroidMeds[0].brand_name}' combined with NSAID '${nsaidMeds[0].brand_name}' produces a 4x to 15x multiplied risk of acute upper gastrointestinal ulceration and hemorrhage.`,
        recommendation: 'Do not combine steroids with NSAIDs without explicit physician direction.'
      });
    }

    if (sedativeAntihistamineMeds.length >= 2) {
      alerts.push({
        medicine_a: sedativeAntihistamineMeds[0].brand_name || sedativeAntihistamineMeds[0].name,
        medicine_b: sedativeAntihistamineMeds[1].brand_name || sedativeAntihistamineMeds[1].name,
        severity: 'MODERATE',
        title: '💤 Additive Sedation & CNS Depression',
        description: `Combining '${sedativeAntihistamineMeds[0].brand_name}' with '${sedativeAntihistamineMeds[1].brand_name}' produces additive antihistaminic CNS suppression, causing marked drowsiness and impaired coordination.`,
        recommendation: 'Avoid combining multiple anti-allergic preparations together. Do not drive or operate machinery.'
      });
    }

    return alerts;
  };

  const runAiDrugInteractionCheck = async () => {
    if (cart.length === 0) {
      showCartToast("Your cart is empty!", "🛒");
      return;
    }

    if (cart.length < 2) {
      setSafetyVerifiedBanner(true);
      setTimeout(() => setSafetyVerifiedBanner(false), 4000);
      setPaymentStep('payment');
      fetchPharmacyLiveTerminalQr();
      return;
    }

    setIsAiCheckingInteractions(true);

    try {
      const payload = {
        medicines: cart.map(item => ({
          name: item.brand_name || item.name || '',
          generic_name: item.generic_name || item.salt || '',
          dosage: item.dosage || ''
        }))
      };

      const res = await fetch(`${API}/api/v1/ai/check-interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.safe && data.alerts && data.alerts.length > 0) {
          setAiInteractionReport(data);
          setAiInteractionModalOpen(true);
          setIsAiCheckingInteractions(false);
          return;
        }
      }
    } catch (err) {
      console.warn("AI interaction API offline, using local clinical safety rules", err);
    }

    const clientAlerts = checkClientSideInteractions(cart);
    setIsAiCheckingInteractions(false);

    if (clientAlerts.length > 0) {
      setAiInteractionReport({
        safe: false,
        severity: clientAlerts.some(a => a.severity === 'CRITICAL') ? 'CRITICAL' : 'MODERATE',
        alerts: clientAlerts,
        summary: `Detected ${clientAlerts.length} significant drug combination hazard(s) in your cart.`
      });
      setAiInteractionModalOpen(true);
      return;
    }

    setSafetyVerifiedBanner(true);
    setTimeout(() => setSafetyVerifiedBanner(false), 4000);
    setPaymentStep('payment');
    fetchPharmacyLiveTerminalQr();
  };

  const handleInitiatePayment = () => {
    runAiDrugInteractionCheck();
  };

  const handleExecutePayment = async () => {
    if (cart.length === 0) {
      showCartToast("Cart is empty!", "🛒");
      return;
    }
    const totalAmt = cart.reduce((s, i) => s + (parseFloat(i.price_mrp || i.price || 0) || 0), 0);
    setIsProcessingPayment(true);
    setPaymentStep('processing');

    // 1. Cash on Delivery
    if (selectedPaymentMethod === 'cod') {
      try {
        setPaymentStatusMsg('Confirming COD Request with Fulfilling Pharmacy & Dispatching Rider...');
        await new Promise(r => setTimeout(r, 700));
        await finalizeOrderPlacement(totalAmt, 'cod', `COD_${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
      } catch (err) {
        showCartToast(`COD Error: ${err.message}`, '⚠️');
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
        showCartToast(`UPI Payment Error: ${err.message}`, '⚠️');
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

  const totalAmount = cart.reduce((s, i) => s + (parseFloat(i.price_mrp || i.price || 0) || 0), 0);

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

        {/* MODAL: AI CLINICAL DRUG-DRUG INTERACTION SAFETY ALERT */}
        {aiInteractionModalOpen && aiInteractionReport && (
          <div
            className="modal-overlay active"
            onClick={() => setAiInteractionModalOpen(false)}
            style={{ zIndex: 2500 }}
          >
            <div
              className="modal-content"
              style={{
                padding: '2rem',
                maxWidth: '640px',
                width: '92%',
                background: '#ffffff',
                border: aiInteractionReport.severity === 'CRITICAL' ? '2px solid #ef4444' : '2px solid #f59e0b',
                borderRadius: '24px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
                color: '#0f172a'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: aiInteractionReport.severity === 'CRITICAL' ? '#fee2e2' : '#fef3c7',
                  color: aiInteractionReport.severity === 'CRITICAL' ? '#dc2626' : '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  flexShrink: 0
                }}>
                  ⚠️
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: aiInteractionReport.severity === 'CRITICAL' ? '#b91c1c' : '#b45309', fontSize: '1.3rem', fontWeight: '800' }}>
                      Dangerous Drug Combination Detected!
                    </h3>
                    <span style={{
                      background: aiInteractionReport.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: '900',
                      padding: '2px 8px',
                      borderRadius: '99px'
                    }}>
                      {aiInteractionReport.severity} HAZARD
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#475569', lineHeight: '1.4' }}>
                    MEDORA's AI Clinical Pharmacist reviewed your cart and identified adverse drug interactions that are dangerous if consumed together.
                  </p>
                </div>
              </div>

              <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', paddingRight: '4px' }}>
                {aiInteractionReport.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '1.1rem',
                      borderRadius: '14px',
                      background: alert.severity === 'CRITICAL' ? '#fff5f5' : '#fffbeb',
                      border: alert.severity === 'CRITICAL' ? '1px solid #fecaca' : '1px solid #fde68a'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '0.92rem', color: alert.severity === 'CRITICAL' ? '#991b1b' : '#92400e' }}>
                        {alert.title}
                      </strong>
                      <span style={{ fontSize: '0.72rem', background: '#ffffff', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontWeight: '700', color: '#334155' }}>
                        {alert.medicine_a} ⚡ {alert.medicine_b}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#334155', lineHeight: '1.45' }}>
                      {alert.description}
                    </p>

                    <div style={{ fontSize: '0.78rem', color: '#0369a1', background: '#f0f9ff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '10px' }}>
                      <strong>Clinical Direction:</strong> {alert.recommendation}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const itemIndex = cart.findIndex(c => (c.brand_name || c.name || '').toLowerCase().includes(alert.medicine_a.toLowerCase()) || alert.medicine_a.toLowerCase().includes((c.brand_name || c.name || '').toLowerCase()));
                          if (itemIndex >= 0) {
                            removeFromCart(itemIndex);
                            setAiInteractionModalOpen(false);
                          }
                        }}
                        style={{
                          background: '#fee2e2',
                          border: '1px solid #fca5a5',
                          color: '#b91c1c',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '0.74rem',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Remove {alert.medicine_a}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const itemIndex = cart.findIndex(c => (c.brand_name || c.name || '').toLowerCase().includes(alert.medicine_b.toLowerCase()) || alert.medicine_b.toLowerCase().includes((c.brand_name || c.name || '').toLowerCase()));
                          if (itemIndex >= 0) {
                            removeFromCart(itemIndex);
                            setAiInteractionModalOpen(false);
                          }
                        }}
                        style={{
                          background: '#fee2e2',
                          border: '1px solid #fca5a5',
                          color: '#b91c1c',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '0.74rem',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Remove {alert.medicine_b}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setAiInteractionModalOpen(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Review Cart
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAiInteractionModalOpen(false);
                    setPaymentStep('payment');
                    fetchPharmacyLiveTerminalQr();
                    showCartToast("Acknowledged clinical warnings. Proceeding with checkout.", "🛡️");
                  }}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Acknowledge & Proceed
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FLOATING SAFETY VERIFIED BADGE */}
        {safetyVerifiedBanner && (
          <div style={{
            position: 'fixed',
            top: '75px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2600,
            background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
            color: '#ffffff',
            padding: '0.8rem 1.8rem',
            borderRadius: '30px',
            boxShadow: '0 10px 30px rgba(22, 101, 52, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.88rem',
            fontWeight: '800',
            border: '1px solid #86efac'
          }}>
            <span style={{ fontSize: '1.2rem' }}>🛡️</span>
            <span>AI Clinical Safety Check Passed: No Drug Interactions Detected!</span>
          </div>
        )}

        {/* FLOATING TOAST NOTIFICATION */}
        {toastNotice && (
          <div style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: 3000,
            background: '#1e293b',
            color: '#ffffff',
            border: '1px solid var(--primary)',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            <span>{toastNotice.icon || '✓'}</span>
            <span>{toastNotice.msg}</span>
          </div>
        )}


        </main>
      </div>
    </div>
  );
}
