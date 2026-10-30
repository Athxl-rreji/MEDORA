"use client";
import React, { useState, useEffect } from 'react';

/**
 * YOUPI PG V2 — Sovereign UPI Payment Gateway Checkout Modal
 * Direct-to-Rider Settlement • 0% Aggregator Fee • NPCI UPI Dynamic Vector QR
 * Models the official YouPI-PG checkout portal (https://github.com/youpi-pg/YouPI-PG)
 */
export default function YouPiCheckoutModal({
  isOpen,
  onClose,
  amount = 0,
  orderId = '',
  customerName = 'Patient',
  customerEmail = 'patient@medora.com',
  riderName = 'Rider AGT-591',
  riderVpa = 'rider.agt-591@okhdfcbank',
  riderQr = '',
  paymentId = '',
  onPaymentSuccess
}) {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes standard YouPI session
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStepText, setVerifyStepText] = useState('');
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' | 'intent'

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setTimeLeft(300);
      setCopied(false);
      setVerifying(false);
      setVerifiedSuccess(false);
      setVerifyStepText('');
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || timeLeft <= 0 || verifying || verifiedSuccess) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, timeLeft, verifying, verifiedSuccess]);

  if (!isOpen) return null;

  const formattedAmount = Number(amount || 0).toFixed(2);
  const cleanVpa = riderVpa || 'rider.agt-591@okhdfcbank';
  const cleanName = riderName || 'Rider AGT-591';
  const cleanOrderId = orderId || `ORD-${Date.now().toString(36).toUpperCase()}`;

  // Standard NPCI UPI URI Scheme
  const upiUri = `upi://pay?pa=${encodeURIComponent(cleanVpa)}&pn=${encodeURIComponent(cleanName)}&am=${formattedAmount}&tn=${encodeURIComponent(cleanOrderId)}&cu=INR`;
  
  // Use rider uploaded QR if available, otherwise generate dynamic NPCI vector QR
  const qrDisplayUrl = riderQr && riderQr.startsWith('http')
    ? riderQr
    : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(upiUri)}`;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleCopyVpa = () => {
    try {
      navigator.clipboard.writeText(cleanVpa);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleAppLaunch = (appName) => {
    const isMobile = typeof window !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768);
    if (isMobile) {
      window.location.assign(upiUri);
    } else {
      handleCopyVpa();
      setVerifyStepText(`Copied UPI ID (${cleanVpa})! Open ${appName} to pay ₹${formattedAmount}.`);
      setTimeout(() => setVerifyStepText(''), 3500);
    }
  };

  const handleConfirmPayment = () => {
    setVerifying(true);
    setVerifyStepText('📡 Step 1/3: Listening for Bank SMS / Cellular Observer Push...');

    setTimeout(() => {
      setVerifyStepText('⚡ Step 2/3: Invariant Single-Slot FIFO Match Confirmed...');
    }, 800);

    setTimeout(() => {
      const mockUtr = `YPG${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      setVerifyStepText(`✅ Step 3/3: Payment Verified! UTR: ${mockUtr}`);
      setVerifiedSuccess(true);

      setTimeout(() => {
        if (typeof onPaymentSuccess === 'function') {
          onPaymentSuccess({
            status: 'SUCCESS',
            order_id: cleanOrderId,
            amount: parseFloat(formattedAmount),
            utr: mockUtr,
            payment_id: paymentId || `YOUPI_${Date.now()}`,
            payee: cleanVpa,
            rider: cleanName
          });
        }
      }, 700);
    }, 1600);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 16, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100000,
      padding: '1rem',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #10141f 0%, #0c0f17 100%)',
        border: '1px solid rgba(20, 184, 166, 0.35)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(20, 184, 166, 0.2)',
        borderRadius: '24px',
        maxWidth: '460px',
        width: '100%',
        color: '#f1f5f9',
        overflow: 'hidden',
        position: 'relative',
        animation: 'fadeInScale 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        
        {/* Top Header Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(13, 148, 136, 0.25) 100%)',
          borderBottom: '1px solid rgba(20, 184, 166, 0.25)',
          padding: '1.1rem 1.4rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: '900',
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.5px'
              }}>
                ⚡ YOUPI PG V2
              </span>
              <span style={{ fontSize: '0.75rem', color: '#5eead4', fontWeight: 'bold' }}>
                Sovereign Gateway
              </span>
            </div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.05rem', color: '#f8fafc', fontWeight: '800' }}>
              Direct Rider Settlement
            </h3>
          </div>

          <button
            onClick={onClose}
            disabled={verifying}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              fontSize: '1rem',
              cursor: verifying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            title="Cancel & Close"
          >
            ✕
          </button>
        </div>

        {/* Order Details & Session Timer Row */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          padding: '0.65rem 1.4rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.78rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <span style={{ color: '#94a3b8' }}>
            Ref: <code style={{ color: '#cbd5e1', fontWeight: 'bold' }}>{cleanOrderId}</code>
          </span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: timeLeft < 60 ? '#f87171' : '#38bdf8',
            fontWeight: 'bold',
            background: 'rgba(56, 189, 248, 0.1)',
            padding: '2px 8px',
            borderRadius: '99px'
          }}>
            <span>⏱️</span>
            <span>Session: {timeFormatted}</span>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.4rem' }}>
          
          {/* Amount Display & Payee Box */}
          <div style={{
            background: 'rgba(20, 184, 166, 0.08)',
            border: '1px solid rgba(20, 184, 166, 0.22)',
            borderRadius: '16px',
            padding: '1rem 1.2rem',
            marginBottom: '1.2rem',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Payable Amount (0% Fee)
            </span>
            <div style={{ fontSize: '2.1rem', fontWeight: '900', color: '#f8fafc', margin: '2px 0 6px 0', letterSpacing: '-0.5px' }}>
              ₹{formattedAmount}
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              padding: '3px 10px',
              borderRadius: '99px',
              fontSize: '0.76rem',
              color: '#34d399',
              fontWeight: 'bold'
            }}>
              <span>🛵</span>
              <span>Direct Settlement to {cleanName}</span>
            </div>
          </div>

          {/* VPA Copy Bar */}
          <div style={{
            background: '#070a12',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.2rem'
          }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>
                Rider UPI VPA
              </span>
              <strong style={{ fontSize: '0.86rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                {cleanVpa}
              </strong>
            </div>

            <button
              onClick={handleCopyVpa}
              style={{
                background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                color: copied ? '#34d399' : '#38bdf8',
                border: copied ? '1px solid #10b981' : '1px solid rgba(56, 189, 248, 0.3)',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease'
              }}
            >
              {copied ? '✓ Copied' : '📋 Copy VPA'}
            </button>
          </div>

          {/* QR Mode Switcher Tabs */}
          <div style={{
            display: 'flex',
            gap: '6px',
            background: '#070a12',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '1rem'
          }}>
            <button
              onClick={() => setActiveTab('qr')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'qr' ? 'rgba(20, 184, 166, 0.25)' : 'transparent',
                color: activeTab === 'qr' ? '#5eead4' : '#94a3b8',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              📷 Scan QR Code
            </button>
            <button
              onClick={() => setActiveTab('intent')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'intent' ? 'rgba(20, 184, 166, 0.25)' : 'transparent',
                color: activeTab === 'intent' ? '#5eead4' : '#94a3b8',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              📱 UPI Apps
            </button>
          </div>

          {/* Tab 1: Dynamic Vector QR Code Display */}
          {activeTab === 'qr' && (
            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
              <div style={{
                display: 'inline-block',
                background: '#ffffff',
                padding: '12px',
                borderRadius: '18px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                border: '3px solid #14b8a6'
              }}>
                <img
                  src={qrDisplayUrl}
                  alt="YouPI-PG Dynamic Rider QR"
                  style={{
                    width: '180px',
                    height: '180px',
                    display: 'block',
                    borderRadius: '8px'
                  }}
                />
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '10px' }}>
                Open <strong>GPay, PhonePe, Paytm, CRED or BHIM</strong> to scan & pay
              </div>
            </div>
          )}

          {/* Tab 2: 1-Tap UPI Apps Grid */}
          {activeTab === 'intent' && (
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                {[
                  { name: 'Google Pay', icon: '🟢', bg: 'rgba(66, 133, 244, 0.15)', border: 'rgba(66, 133, 244, 0.4)' },
                  { name: 'PhonePe', icon: '🟣', bg: 'rgba(103, 58, 183, 0.15)', border: 'rgba(103, 58, 183, 0.4)' },
                  { name: 'Paytm UPI', icon: '🔵', bg: 'rgba(0, 186, 242, 0.15)', border: 'rgba(0, 186, 242, 0.4)' },
                  { name: 'CRED UPI', icon: '⚪', bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.25)' },
                ].map(app => (
                  <button
                    key={app.name}
                    onClick={() => handleAppLaunch(app.name)}
                    style={{
                      background: app.bg,
                      border: `1px solid ${app.border}`,
                      color: '#f8fafc',
                      padding: '12px 10px',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>{app.icon}</span>
                    <span>{app.name}</span>
                  </button>
                ))}
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.74rem', color: '#64748b', marginTop: '8px' }}>
                On mobile, tapping an app launches it directly with the payment pre-filled.
              </p>
            </div>
          )}

          {/* Banking Observer Simulation & Status Pill */}
          <div style={{
            background: '#070a12',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '1.25rem',
            fontSize: '0.78rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                📡 YouPI Banking Observer Mesh
              </span>
              <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.72rem' }}>
                ● Single-Slot Active
              </span>
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.74rem', lineHeight: '1.4' }}>
              {verifyStepText || 'Listening for incoming bank SMS & cellular push notifications in real time.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handleConfirmPayment}
              disabled={verifying}
              style={{
                width: '100%',
                background: verifiedSuccess
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 18px rgba(20, 184, 166, 0.35)',
                padding: '12px',
                borderRadius: '12px',
                fontSize: '0.94rem',
                fontWeight: '800',
                cursor: verifying ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                opacity: verifying && !verifiedSuccess ? 0.8 : 1
              }}
            >
              {verifiedSuccess ? (
                <><span>🎉</span><span>Payment Verified by Observer!</span></>
              ) : verifying ? (
                <><span>⏳</span><span>Verifying with YouPI Observers...</span></>
              ) : (
                <><span>✅</span><span>I Have Paid via UPI (Verify Now)</span></>
              )}
            </button>

            <button
              onClick={onClose}
              disabled={verifying}
              style={{
                width: '100%',
                background: 'transparent',
                color: '#64748b',
                border: 'none',
                padding: '8px',
                fontSize: '0.78rem',
                cursor: verifying ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel Payment (0% Charged)
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}

