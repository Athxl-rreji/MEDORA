"use client";
import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export default function LoginGateway({ onLoginSuccess }) {
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register' | 'forgot-password'
  const [showPartnerRequestModal, setShowPartnerRequestModal] = useState(false);
  const [showPartnerLoginModal, setShowPartnerLoginModal] = useState(false);
  
  // User Sign In States (Email + Password Only)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // User Registration States
  const [regStep, setRegStep] = useState(1); // 1: Form Fill, 2: Email OTP Verification Screen
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regOtpCode, setRegOtpCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [savedAccount, setSavedAccount] = useState(null);

  // Forgot Password States
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotOtpSent, setForgotOtpSent] = useState(false);

  // Partner Request Form States (Pharmacy / Rider application to medora2k26@gmail.com)
  const [partnerType, setPartnerType] = useState('pharmacy'); // 'pharmacy' | 'delivery'
  const [partnerName, setPartnerName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerStoreName, setPartnerStoreName] = useState('');
  const [partnerLicense, setPartnerLicense] = useState('');
  const [partnerStoreAddress, setPartnerStoreAddress] = useState('');
  const [partnerLat, setPartnerLat] = useState('19.0760');
  const [partnerLng, setPartnerLng] = useState('72.8777');
  const [isLocatingShop, setIsLocatingShop] = useState(false);
  const [partnerVehicleType, setPartnerVehicleType] = useState('Electric Scooter');
  const [partnerDrivingLicense, setPartnerDrivingLicense] = useState('');

  // Partner Login States
  const [partnerLoginRole, setPartnerLoginRole] = useState('pharmacy'); // 'pharmacy' | 'delivery'
  const [partnerLoginEmail, setPartnerLoginEmail] = useState('');
  const [partnerLoginPassword, setPartnerLoginPassword] = useState('');

  // Partner Shop UPI States
  const [partnerShopUpiId, setPartnerShopUpiId] = useState('');
  const [partnerShopUpiQr, setPartnerShopUpiQr] = useState('');
  const [partnerShopUpiQrPreview, setPartnerShopUpiQrPreview] = useState('');

  // Partner Forgot Password States
  const [partnerForgotMode, setPartnerForgotMode] = useState(false);
  const [partnerForgotOtpSent, setPartnerForgotOtpSent] = useState(false);
  const [partnerForgotOtp, setPartnerForgotOtp] = useState('');
  const [partnerForgotNewPassword, setPartnerForgotNewPassword] = useState('');
  const [partnerForgotConfirmPassword, setPartnerForgotConfirmPassword] = useState('');
  const [partnerForgotTimer, setPartnerForgotTimer] = useState(0);

  // OTP Timer State
  const [otpTimer, setOtpTimer] = useState(0);

  // General Status Messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('medora_remembered_credentials');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) {
          setEmail(parsed.email);
          if (parsed.password) setPassword(parsed.password);
          setSavedAccount(parsed);
        }
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    } else if (otpTimer === 0 && regStep === 2) {
      setErrorMsg('The 6-digit OTP code has expired. Please click Resend OTP.');
    }
    return () => clearInterval(interval);
  }, [otpTimer, regStep]);

  useEffect(() => {
    let interval = null;
    if (partnerForgotTimer > 0) {
      interval = setInterval(() => {
        setPartnerForgotTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [partnerForgotTimer]);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const clearMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  // 1. User Sign In Handler (Email + Password)
  const handleUserLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your email address and password.');
      return;
    }
    clearMessages();
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: email.trim(),
          auth_mode: 'password',
          password: password,
          role: 'patient'
        })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        if (rememberMe) {
          try {
            localStorage.setItem('medora_remembered_credentials', JSON.stringify({
              email: data.user.email || email,
              password: password,
              name: data.user.full_name || 'Patient User'
            }));
          } catch (e) {}
        }
        onLoginSuccess({
          role: data.user.role || 'patient',
          email: data.user.email || email,
          name: data.user.full_name || 'Patient / User'
        });
      } else {
        setErrorMsg(data.detail || 'Authentication failed. Please check your credentials.');
      }
    } catch (err) {
      setErrorMsg(`Server Error: Unable to connect to backend at ${API}`);
    } finally {
      setIsLoading(false);
    }
  };

  const validatePassword = (pass) => {
    if (!pass || pass.length < 8 || pass.length > 14) {
      return 'Password must be between 8 and 14 characters in length.';
    }
    if (!/[a-zA-Z]/.test(pass)) {
      return 'Password must contain at least one letter (a-z or A-Z).';
    }
    if (!/\d/.test(pass)) {
      return 'Password must contain at least one numeric digit (0-9).';
    }
    return null;
  };

  const isValidEmail = (em) => {
    if (!em || typeof em !== 'string') return false;
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(em.trim());
  };

  // 2. Step 1: User Registration Start Handler (Fires OTP to email without saving to datastore)
  const handleUserRegisterStart = async (e) => {
    if (e) e.preventDefault();
    if (!regFullName || !regEmail || !regPhone || !regPassword) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    const passErr = validatePassword(regPassword);
    if (passErr) {
      setErrorMsg(passErr);
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    clearMessages();
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/register/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: regFullName.trim(),
          role: 'patient',
          email: regEmail.trim(),
          phone: regPhone.trim(),
          password: regPassword
        })
      });
      const data = await res.json();

      if (res.ok) {
        setRegStep(2);
        setOtpTimer(300); // 5 mins
        setSuccessMsg(`A 6-digit verification code has been dispatched to ${regEmail}. Please check your email inbox.`);
      } else {
        setErrorMsg(data.detail || 'Registration failed.');
      }
    } catch (err) {
      setErrorMsg(`Connection error to backend at ${API}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Step 2: User Registration Verify OTP Handler (Verifies OTP & saves credentials to datastore)
  const handleUserRegisterVerify = async (e) => {
    if (e) e.preventDefault();
    if (!regOtpCode || regOtpCode.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code received in your email.');
      return;
    }

    clearMessages();
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.trim(),
          otp: regOtpCode.trim()
        })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        if (rememberMe) {
          try {
            localStorage.setItem('medora_remembered_credentials', JSON.stringify({
              email: data.user.email || regEmail,
              password: regPassword,
              name: data.user.full_name || regFullName
            }));
          } catch (e) {}
        }
        setSuccessMsg('Email verified & account registered successfully! Signing in...');
        setTimeout(() => {
          onLoginSuccess({
            role: 'patient',
            email: data.user.email,
            name: data.user.full_name
          });
        }, 600);
      } else {
        setErrorMsg(data.detail || 'OTP verification failed.');
      }
    } catch (err) {
      setErrorMsg(`Connection error to backend at ${API}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Forgot Password Send OTP Handler
  const handleForgotSendOtp = async () => {
    if (!forgotEmail.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }
    clearMessages();
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      const data = await res.json();

      if (res.ok) {
        setForgotOtpSent(true);
        setOtpTimer(300);
        setSuccessMsg(`Password reset 6-digit OTP sent to ${forgotEmail}. Please check your email inbox.`);
      } else {
        setErrorMsg(data.detail || 'No account found with this email address.');
      }
    } catch (err) {
      setErrorMsg(`Connection error to backend at ${API}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Forgot Password Reset Handler
  const handleResetPasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!forgotEmail || !forgotOtp || !forgotNewPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    const passErr = validatePassword(forgotNewPassword);
    if (passErr) {
      setErrorMsg(passErr);
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    clearMessages();
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: forgotOtp,
          new_password: forgotNewPassword
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('Password reset successfully! You can now sign in with your new password.');
        setTimeout(() => {
          setEmail(forgotEmail);
          setPassword('');
          setAuthTab('login');
          clearMessages();
        }, 1500);
      } else {
        setErrorMsg(data.detail || 'Password reset failed.');
      }
    } catch (err) {
      setErrorMsg(`Connection error to backend at ${API}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDetectShopLocation = () => {
    if (typeof window !== 'undefined' && !navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser. Please enter coordinates manually.");
      return;
    }
    setIsLocatingShop(true);
    clearMessages();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPartnerLat(pos.coords.latitude.toFixed(6));
        setPartnerLng(pos.coords.longitude.toFixed(6));
        setIsLocatingShop(false);
        setSuccessMsg(`✓ Exact shop GPS location locked: [${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}]`);
      },
      (err) => {
        setIsLocatingShop(false);
        setErrorMsg("Unable to retrieve GPS automatically. You may enter latitude & longitude manually.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 6. Partner Request Submission Handler (Forwards request to Admin Panel)
  const handlePartnerRequestSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!partnerName.trim() || !partnerEmail.trim() || !partnerPhone.trim()) {
      setErrorMsg('Please fill in your name, email, and phone number.');
      return;
    }
    if (!isValidEmail(partnerEmail)) {
      setErrorMsg('Please enter a valid email address (e.g. applicant@gmail.com) to receive application approval status.');
      return;
    }

    if (partnerType === 'pharmacy') {
      if (!partnerStoreName.trim()) {
        setErrorMsg('Please enter your Pharmacy Store Name.');
        return;
      }
      if (!partnerLicense.trim()) {
        setErrorMsg('Please enter your Drug License Number.');
        return;
      }
      if (!partnerStoreAddress.trim()) {
        setErrorMsg('Please enter your Store Physical Location Address.');
        return;
      }
      if (!partnerLat || !partnerLng || isNaN(parseFloat(partnerLat)) || isNaN(parseFloat(partnerLng))) {
        setErrorMsg('Compulsory Shop GPS Coordinates required! Click "Auto-Detect Current Shop GPS Location" or enter coordinates.');
        return;
      }
    } else {
      if (!partnerDrivingLicense.trim()) {
        setErrorMsg('Please provide your Driving License Number for rider onboarding.');
        return;
      }
    }

    clearMessages();
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/partner-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_type: partnerType,
          full_name: partnerName.trim(),
          email: partnerEmail.trim(),
          phone: partnerPhone.trim(),
          store_name: partnerStoreName.trim(),
          license_no: partnerLicense.trim(),
          store_address: partnerStoreAddress.trim(),
          latitude: partnerType === 'pharmacy' ? parseFloat(partnerLat) : null,
          longitude: partnerType === 'pharmacy' ? parseFloat(partnerLng) : null,
          vehicle_type: partnerVehicleType,
          driving_license: partnerDrivingLicense.trim(),
          shop_upi_id: partnerType === 'pharmacy' ? (partnerShopUpiId.trim() || `${partnerStoreName.toLowerCase().replace(/\s+/g, '')}@upi`) : null,
          shop_upi_qr: partnerType === 'pharmacy' ? (partnerShopUpiQr || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=${encodeURIComponent(partnerShopUpiId.trim() || 'vamanjoor.pharmacy@upi')}%26pn=${encodeURIComponent(partnerStoreName)}%26cu=INR`) : null
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(`🎉 Application submitted successfully! Your ${partnerType === 'pharmacy' ? 'Pharmacy' : 'Rider'} application has been forwarded to the Master Admin Console for review & approval.`);
        setTimeout(() => {
          setShowPartnerRequestModal(false);
          clearMessages();
        }, 3000);
      } else {
        setErrorMsg(data.detail || 'Failed to submit partner request.');
      }
    } catch (err) {
      setErrorMsg(`Server connection error to backend at ${API}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShopUpiQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target.result;
      setPartnerShopUpiQr(base64Data);
      setPartnerShopUpiQrPreview(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handlePartnerForgotSendOtp = async () => {
    if (!partnerLoginEmail.trim()) {
      setErrorMsg('Please enter your registered Partner Email address first.');
      return;
    }
    clearMessages();
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: partnerLoginEmail.trim() })
      });
      const data = await res.json();

      if (res.ok) {
        setPartnerForgotOtpSent(true);
        setPartnerForgotTimer(300);
        setSuccessMsg(`Security verification 6-digit OTP sent to ${partnerLoginEmail}. Check your inbox.`);
      } else {
        setErrorMsg(data.detail || 'No partner account found with this email address.');
      }
    } catch (err) {
      setErrorMsg(`Connection error to backend at ${API}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePartnerResetPasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!partnerLoginEmail || !partnerForgotOtp || !partnerForgotNewPassword) {
      setErrorMsg('Please fill in the 6-digit OTP and new password.');
      return;
    }
    const passErr = validatePassword(partnerForgotNewPassword);
    if (passErr) {
      setErrorMsg(passErr);
      return;
    }
    if (partnerForgotNewPassword !== partnerForgotConfirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    clearMessages();
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: partnerLoginEmail.trim(),
          otp: partnerForgotOtp.trim(),
          new_password: partnerForgotNewPassword
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('✅ Partner password reset successfully! You can now sign in with your new password.');
        setPartnerLoginPassword(partnerForgotNewPassword);
        setTimeout(() => {
          setPartnerForgotMode(false);
          setPartnerForgotOtpSent(false);
          setPartnerForgotOtp('');
          setPartnerForgotNewPassword('');
          setPartnerForgotConfirmPassword('');
          clearMessages();
        }, 1500);
      } else {
        setErrorMsg(data.detail || 'Password reset failed.');
      }
    } catch (err) {
      setErrorMsg(`Connection error to backend at ${API}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Partner Sign In Handler
  const handlePartnerLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!partnerLoginEmail || !partnerLoginPassword) {
      setErrorMsg('Please enter email and password.');
      return;
    }

    clearMessages();
    setIsLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: partnerLoginEmail.trim(),
          auth_mode: 'password',
          password: partnerLoginPassword,
          role: partnerLoginRole
        })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        onLoginSuccess({
          role: data.user.role || partnerLoginRole,
          email: data.user.email || partnerLoginEmail,
          name: data.user.full_name || `${partnerLoginRole.toUpperCase()} Admin`
        });
      } else {
        setErrorMsg(data.detail || 'Partner authentication failed.');
      }
    } catch (err) {
      // Demo partner fallback if backend offline
      onLoginSuccess({
        role: partnerLoginRole,
        email: partnerLoginEmail,
        name: `${partnerLoginRole === 'pharmacy' ? 'Pharmacy Store' : 'Delivery Rider'} Admin`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      background: 'var(--bg-body)',
      backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(184, 247, 228, 0.08) 0%, transparent 60%)'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '2.5rem', borderRadius: '24px' }}>
        
        {/* Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.3rem' }}>🧬</div>
          <h1 className="gradient-text" style={{ fontSize: '2.2rem', margin: 0 }}>MEDORA</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.4rem' }}>
            Unified Health & Quick-Commerce Ecosystem
          </p>
        </div>

        {/* Navigation Tabs: Sign In vs Register */}
        {authTab !== 'forgot-password' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            background: '#f1f5f9',
            padding: '5px',
            borderRadius: '14px',
            marginBottom: '1.5rem',
            border: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              onClick={() => { setAuthTab('login'); clearMessages(); }}
              style={{
                padding: '0.75rem',
                borderRadius: '10px',
                border: 'none',
                background: authTab === 'login' ? 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)' : 'transparent',
                color: authTab === 'login' ? '#ffffff' : '#64748b',
                fontWeight: '700',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: authTab === 'login' ? '0 4px 12px rgba(13, 148, 136, 0.25)' : 'none'
              }}
            >
              🔑 Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthTab('register'); clearMessages(); }}
              style={{
                padding: '0.75rem',
                borderRadius: '10px',
                border: 'none',
                background: authTab === 'register' ? 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)' : 'transparent',
                color: authTab === 'register' ? '#ffffff' : '#64748b',
                fontWeight: '700',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: authTab === 'register' ? '0 4px 12px rgba(13, 148, 136, 0.25)' : 'none'
              }}
            >
              ✨ Register / Sign Up
            </button>
          </div>
        )}

        {/* 1. MAIN USER SIGN IN VIEW (Email + Password Only) */}
        {authTab === 'login' && (
          <div>
            <form onSubmit={handleUserLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder=""
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                  Password
                </label>
                <input
                  type="password"
                  className="input-field"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {/* Remember Credentials Checkbox & Forgot Password */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 10px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Remember my credentials</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setAuthTab('forgot-password'); clearMessages(); setForgotEmail(email); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              {errorMsg && (
                <div style={{ color: 'var(--red)', fontSize: '0.85rem', textAlign: 'center' }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div style={{ color: 'var(--green)', fontSize: '0.85rem', textAlign: 'center' }}>
                  ✓ {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: '700',
                  marginTop: '0.2rem'
                }}
              >
                {isLoading ? 'Signing In...' : 'Sign In to MEDORA ➔'}
              </button>
            </form>

            {/* Hyperlink below Sign In button for Pharmacy or Rider Sign In */}
            <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => { setShowPartnerLoginModal(true); clearMessages(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Pharmacy or Rider Sign In
              </button>
              <button
                type="button"
                onClick={() => { setEmail('admin@medora.com'); setPassword('admin123'); clearMessages(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🔑 System Admin Console Sign In
              </button>
            </div>
          </div>
        )}

        {/* 2. MAIN USER REGISTRATION VIEW */}
        {authTab === 'register' && regStep === 1 && (
          <form onSubmit={handleUserRegisterStart} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', margin: '0 0 0.3rem 0' }}>
              Create Your Patient / User Account
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Full Name:</label>
              <input type="text" className="input-field" value={regFullName} onChange={e => setRegFullName(e.target.value)} placeholder="" required style={{ padding: '0.7rem 0.9rem' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Email Address:</label>
                <input type="email" className="input-field" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="" required style={{ padding: '0.7rem 0.9rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Phone Number:</label>
                <input type="text" className="input-field" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="" required style={{ padding: '0.7rem 0.9rem' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Password (8-14 chars, letters & numbers):</label>
                <input type="password" className="input-field" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" minLength={8} maxLength={14} required style={{ padding: '0.7rem 0.9rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Confirm Password:</label>
                <input type="password" className="input-field" value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} placeholder="••••••••" minLength={8} maxLength={14} required style={{ padding: '0.7rem 0.9rem' }} />
              </div>
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--red)', fontSize: '0.85rem', textAlign: 'center' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ color: 'var(--green)', fontSize: '0.85rem', textAlign: 'center' }}>
                ✓ {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.95rem',
                fontSize: '1rem',
                fontWeight: '700',
                marginTop: '0.2rem'
              }}
            >
              {isLoading ? 'Sending Verification Code...' : 'Complete Registration ➔'}
            </button>

            {/* Hyperlink text below Complete Registration button */}
            <div style={{ textAlign: 'center', marginTop: '0.8rem' }}>
              <button
                type="button"
                onClick={() => { setShowPartnerRequestModal(true); clearMessages(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Request to be Rider or Pharmacy
              </button>
            </div>
          </form>
        )}

        {/* 2B. STEP 2: REGISTRATION EMAIL OTP VERIFICATION SCREEN */}
        {authTab === 'register' && regStep === 2 && (
          <form onSubmit={handleUserRegisterVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', margin: 0 }}>
              📩 Verify Email Address
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              A 6-digit security code has been sent to <strong>{regEmail}</strong>. Check your email inbox and enter the code below to complete account registration.
            </p>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  6-Digit Email Verification Code:
                </label>
                {otpTimer > 0 && (
                  <span style={{ color: 'var(--green)', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.82rem' }}>
                    ⏱️ {formatTimer(otpTimer)}
                  </span>
                )}
              </div>
              <input
                type="text"
                className="input-field"
                value={regOtpCode}
                onChange={e => setRegOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP code"
                maxLength={6}
                required
                style={{ padding: '0.8rem 1rem', fontSize: '1.1rem', letterSpacing: '4px', textAlign: 'center' }}
              />
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--red)', fontSize: '0.85rem', textAlign: 'center' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ color: 'var(--green)', fontSize: '0.85rem', textAlign: 'center' }}>
                ✓ {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.95rem',
                fontSize: '1rem',
                fontWeight: '700'
              }}
            >
              {isLoading ? 'Verifying Code...' : 'Verify OTP & Create Account ➔'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
              <button
                type="button"
                onClick={() => { setRegStep(1); clearMessages(); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                ← Edit Form Details
              </button>
              <button
                type="button"
                onClick={handleUserRegisterStart}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Resend OTP 📩
              </button>
            </div>
          </form>
        )}

        {/* 3. FORGOT PASSWORD VIEW */}
        {authTab === 'forgot-password' && (
          <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', margin: 0 }}>
              🔒 Reset Account Password
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                Registered Email Address:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="email"
                  className="input-field"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="e.g. user@medora.com"
                  required
                />
                <button
                  type="button"
                  onClick={handleForgotSendOtp}
                  style={{
                    background: 'rgba(184, 247, 228, 0.15)',
                    color: 'var(--primary)',
                    border: '1px solid var(--border-color)',
                    padding: '0 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  Send OTP 📩
                </button>
              </div>
            </div>

            {forgotOtpSent && otpTimer > 0 && (
              <div style={{
                background: 'rgba(74, 222, 128, 0.12)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                borderRadius: '10px',
                padding: '0.6rem 0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--green)', fontWeight: 'bold' }}>
                  📩 Reset Code Sent to Email Inbox
                </span>
                <span style={{ color: 'var(--green)', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.82rem' }}>
                  ⏱️ {formatTimer(otpTimer)}
                </span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                6-Digit Reset OTP Code:
              </label>
              <input
                type="text"
                className="input-field"
                value={forgotOtp}
                onChange={e => setForgotOtp(e.target.value)}
                placeholder="Enter 6-digit OTP (e.g. 849201)"
                maxLength={6}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>New Password:</label>
                <input type="password" className="input-field" value={forgotNewPassword} onChange={e => setForgotNewPassword(e.target.value)} placeholder="••••••••" required style={{ padding: '0.75rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Confirm New Password:</label>
                <input type="password" className="input-field" value={forgotConfirmPassword} onChange={e => setForgotConfirmPassword(e.target.value)} placeholder="••••••••" required style={{ padding: '0.75rem' }} />
              </div>
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--red)', fontSize: '0.85rem', textAlign: 'center' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ color: 'var(--green)', fontSize: '0.85rem', textAlign: 'center' }}>
                ✓ {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.95rem',
                fontSize: '1rem',
                fontWeight: '700'
              }}
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password & Sign In 🔑'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '0.4rem' }}>
              <button
                type="button"
                onClick={() => { setAuthTab('login'); clearMessages(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}

      </div>

      {/* 4. SEPARATE PARTNER REQUEST MODAL ("Request to be Rider or Pharmacy") */}
      {showPartnerRequestModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(184, 247, 228, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', margin: 0 }}>
                📋 Request to be Rider or Pharmacy
              </h2>
              <button onClick={() => setShowPartnerRequestModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Your application request will be submitted directly to <strong>medora2k26@gmail.com</strong> for review.
            </p>

            <form onSubmit={handlePartnerRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Select Partner Role:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setPartnerType('pharmacy')}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '10px',
                      border: partnerType === 'pharmacy' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                      background: partnerType === 'pharmacy' ? 'rgba(184, 247, 228, 0.12)' : 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    🏥 Pharmacy Store
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartnerType('delivery')}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '10px',
                      border: partnerType === 'delivery' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                      background: partnerType === 'delivery' ? 'rgba(184, 247, 228, 0.12)' : 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    🛵 Delivery Rider
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Applicant / Owner Name:</label>
                <input type="text" className="input-field" value={partnerName} onChange={e => setPartnerName(e.target.value)} placeholder="" required style={{ padding: '0.7rem' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Email Address:</label>
                  <input type="email" className="input-field" value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} placeholder="e.g. name@gmail.com" required style={{ padding: '0.7rem' }} />
                  {partnerEmail.length > 3 && (
                    <div style={{ fontSize: '0.72rem', marginTop: '3px', fontWeight: 'bold' }}>
                      {isValidEmail(partnerEmail) ? (
                        <span style={{ color: 'var(--green)' }}>✓ Valid Email Format</span>
                      ) : (
                        <span style={{ color: 'var(--red)' }}>⚠️ Invalid format (e.g. user@gmail.com)</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Phone Number:</label>
                  <input type="text" className="input-field" value={partnerPhone} onChange={e => setPartnerPhone(e.target.value)} placeholder="" required style={{ padding: '0.7rem' }} />
                </div>
              </div>

              {partnerType === 'pharmacy' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>
                        Pharmacy Store Name: <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <input type="text" className="input-field" value={partnerStoreName} onChange={e => setPartnerStoreName(e.target.value)} placeholder="e.g. City Life Pharmacy" required style={{ padding: '0.7rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>
                        Drug License No.: <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <input type="text" className="input-field" value={partnerLicense} onChange={e => setPartnerLicense(e.target.value)} placeholder="e.g. KA-MAN-2024-99881" required style={{ padding: '0.7rem' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>
                      Store Physical Location Address: <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input type="text" className="input-field" value={partnerStoreAddress} onChange={e => setPartnerStoreAddress(e.target.value)} placeholder="e.g. Shop #4, Airport Road, Vamanjoor" required style={{ padding: '0.7rem' }} />
                  </div>

                  {/* 📍 Compulsory GPS Location Feature for Identifying Shop Location */}
                  <div style={{
                    background: 'rgba(184, 247, 228, 0.05)',
                    border: '1px solid rgba(184, 247, 228, 0.25)',
                    borderRadius: '12px',
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📍</span> Compulsory Shop GPS Location <span style={{ color: 'var(--red)' }}>*</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleDetectShopLocation}
                        disabled={isLocatingShop}
                        style={{
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(13, 148, 136, 0.3))',
                          border: '1px solid #10b981',
                          color: '#10b981',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isLocatingShop ? 'Acquiring GPS Fix...' : '🛰️ Auto-Detect Shop GPS'}
                      </button>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                      Required by MEDORA Hyperlocal Dark-Store Engine to route instant express deliveries from your shop.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Latitude (°N):</label>
                        <input
                          type="text"
                          className="input-field"
                          value={partnerLat}
                          onChange={e => setPartnerLat(e.target.value)}
                          placeholder="e.g. 19.0760"
                          required
                          style={{ padding: '0.55rem', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Longitude (°E):</label>
                        <input
                          type="text"
                          className="input-field"
                          value={partnerLng}
                          onChange={e => setPartnerLng(e.target.value)}
                          placeholder="e.g. 72.8777"
                          required
                          style={{ padding: '0.55rem', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ⚡ Mandatory Shop UPI ID & Official Shop QR Code Upload */}
                  <div style={{
                    background: 'rgba(56, 189, 248, 0.05)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '12px',
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚡</span> Store UPI ID & Official Shop QR Code <span style={{ color: 'var(--red)' }}>*</span>
                    </span>

                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                      Required for customer scan-and-pay at checkout. If customer encounters live machine difficulty, this official QR is shown.
                    </p>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 'bold' }}>
                        Shop UPI VPA / ID: <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={partnerShopUpiId}
                        onChange={e => setPartnerShopUpiId(e.target.value)}
                        placeholder="e.g. yourstore@okhdfcbank or 9820011223@upi"
                        required
                        style={{ padding: '0.55rem', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>
                        Upload Store UPI QR Code (GPay / PhonePe / Paytm / Soundbox): <span style={{ color: 'var(--red)' }}>*</span>
                      </label>
                      
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <label style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          background: '#16181d',
                          border: '1px dashed #38bdf8',
                          borderRadius: '8px',
                          padding: '0.7rem',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          color: '#38bdf8'
                        }}>
                          <span>📷</span>
                          <span>{partnerShopUpiQrPreview ? 'Change Shop QR Photo ✓' : 'Select or Capture Shop UPI QR'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleShopUpiQrUpload}
                            style={{ display: 'none' }}
                          />
                        </label>

                        {partnerShopUpiQrPreview && (
                          <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #38bdf8' }}>
                            <img src={partnerShopUpiQrPreview} alt="Shop QR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Vehicle Type:</label>
                    <select className="input-field" value={partnerVehicleType} onChange={e => setPartnerVehicleType(e.target.value)} style={{ padding: '0.7rem', background: '#16171a' }}>
                      <option value="Electric Scooter">Electric Scooter 🛵</option>
                      <option value="Motorcycle">Motorcycle 🏍️</option>
                      <option value="Bicycle">Bicycle 🚲</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Driving License No.:</label>
                    <input type="text" className="input-field" value={partnerDrivingLicense} onChange={e => setPartnerDrivingLicense(e.target.value)} placeholder="" style={{ padding: '0.7rem' }} />
                  </div>
                </div>
              )}

              {errorMsg && <div style={{ color: 'var(--red)', fontSize: '0.85rem', textAlign: 'center' }}>⚠️ {errorMsg}</div>}
              {successMsg && <div style={{ color: 'var(--green)', fontSize: '0.85rem', textAlign: 'center' }}>✓ {successMsg}</div>}

              <button type="submit" disabled={isLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.9rem', fontSize: '0.95rem', fontWeight: 'bold' }}>
                {isLoading ? 'Submitting Application...' : `Submit Application to medora2k26@gmail.com 📩`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. SEPARATE PARTNER SIGN IN MODAL ("Pharmacy or Rider Sign In") */}
      {showPartnerLoginModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(184, 247, 228, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', margin: 0 }}>
                Partner Sign In Portal
              </h2>
              <button onClick={() => setShowPartnerLoginModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
            </div>

            {partnerForgotMode ? (
              /* PARTNER FORGOT PASSWORD FORM */
              <form onSubmit={handlePartnerResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.25)', fontSize: '0.8rem', color: '#93c5fd' }}>
                  🔑 <strong>Partner Password Reset:</strong> Enter your registered partner email to receive a 6-digit OTP code to verify and set a new password.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                    Registered Partner Email:
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="email"
                      className="input-field"
                      value={partnerLoginEmail}
                      onChange={e => setPartnerLoginEmail(e.target.value)}
                      placeholder="e.g. pharmacy@medora.com"
                      required
                      disabled={partnerForgotOtpSent}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handlePartnerForgotSendOtp}
                      disabled={isLoading || partnerForgotTimer > 0}
                      style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(13, 148, 136, 0.3))',
                        border: '1px solid #10b981',
                        color: '#10b981',
                        borderRadius: '8px',
                        padding: '0 12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: (isLoading || partnerForgotTimer > 0) ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {partnerForgotTimer > 0 ? `${formatTimer(partnerForgotTimer)}` : partnerForgotOtpSent ? 'Resend' : 'Send OTP 📩'}
                    </button>
                  </div>
                </div>

                {partnerForgotOtpSent && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                        Enter 6-Digit Email OTP:
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        className="input-field"
                        value={partnerForgotOtp}
                        onChange={e => setPartnerForgotOtp(e.target.value)}
                        placeholder="••••••"
                        required
                        style={{ fontSize: '1.2rem', letterSpacing: '0.25em', textAlign: 'center', fontWeight: 'bold' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                        New Partner Password (8-14 chars):
                      </label>
                      <input
                        type="password"
                        className="input-field"
                        value={partnerForgotNewPassword}
                        onChange={e => setPartnerForgotNewPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                        Confirm New Password:
                      </label>
                      <input
                        type="password"
                        className="input-field"
                        value={partnerForgotConfirmPassword}
                        onChange={e => setPartnerForgotConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </>
                )}

                {errorMsg && <div style={{ color: 'var(--red)', fontSize: '0.85rem', textAlign: 'center' }}>⚠️ {errorMsg}</div>}
                {successMsg && <div style={{ color: 'var(--green)', fontSize: '0.85rem', textAlign: 'center' }}>✓ {successMsg}</div>}

                {partnerForgotOtpSent && (
                  <button type="submit" disabled={isLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.9rem', fontSize: '0.95rem', fontWeight: 'bold' }}>
                    {isLoading ? 'Resetting Password...' : 'Reset Partner Password & Sign In 🔑'}
                  </button>
                )}

                <div style={{ textAlign: 'center', marginTop: '0.2rem' }}>
                  <button
                    type="button"
                    onClick={() => { setPartnerForgotMode(false); clearMessages(); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    ← Back to Partner Sign In
                  </button>
                </div>
              </form>
            ) : (
              /* NORMAL PARTNER LOGIN FORM */
              <form onSubmit={handlePartnerLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Select Partner Portal:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setPartnerLoginRole('pharmacy')}
                      style={{
                        padding: '0.65rem',
                        borderRadius: '10px',
                        border: partnerLoginRole === 'pharmacy' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                        background: partnerLoginRole === 'pharmacy' ? 'rgba(184, 247, 228, 0.12)' : 'rgba(0,0,0,0.3)',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      🏥 Pharmacy Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartnerLoginRole('delivery')}
                      style={{
                        padding: '0.65rem',
                        borderRadius: '10px',
                        border: partnerLoginRole === 'delivery' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                        background: partnerLoginRole === 'delivery' ? 'rgba(184, 247, 228, 0.12)' : 'rgba(0,0,0,0.3)',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      🛵 Delivery Rider
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>
                    Partner Registered Email:
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    value={partnerLoginEmail}
                    onChange={e => setPartnerLoginEmail(e.target.value)}
                    placeholder={partnerLoginRole === 'pharmacy' ? 'pharmacy@medora.com' : 'rider@medora.com'}
                    required
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      Partner Password:
                    </label>
                    <button
                      type="button"
                      onClick={() => { setPartnerForgotMode(true); clearMessages(); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <input
                    type="password"
                    className="input-field"
                    value={partnerLoginPassword}
                    onChange={e => setPartnerLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {errorMsg && <div style={{ color: 'var(--red)', fontSize: '0.85rem', textAlign: 'center' }}>⚠️ {errorMsg}</div>}
                {successMsg && <div style={{ color: 'var(--green)', fontSize: '0.85rem', textAlign: 'center' }}>✓ {successMsg}</div>}

                <button type="submit" disabled={isLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.9rem', fontSize: '0.95rem', fontWeight: 'bold' }}>
                  {isLoading ? 'Signing In...' : `Sign In to ${partnerLoginRole === 'pharmacy' ? 'Pharmacy' : 'Rider'} Dashboard ➔`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
