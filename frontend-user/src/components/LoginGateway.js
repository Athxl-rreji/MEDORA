"use client";
import React, { useState, useEffect } from 'react';
import CartoonBootup from './CartoonBootup';

const API = (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (!process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL.includes('localhost') || process.env.NEXT_PUBLIC_API_URL.includes('127.0.0.1')))
  ? (window.location.protocol + '//' + window.location.hostname + ':8000')
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

export default function LoginGateway({ onLoginSuccess }) {
  const [showBootupToon, setShowBootupToon] = useState(false);
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
  const [partnerDeliveryZone, setPartnerDeliveryZone] = useState('');
  const [partnerVehicleNumber, setPartnerVehicleNumber] = useState('');
  const [partnerShiftPreference, setPartnerShiftPreference] = useState('Full Time (Express 10-Min)');
  const [partnerRiderUpi, setPartnerRiderUpi] = useState('');
  const [partnerBagConfirmed, setPartnerBagConfirmed] = useState(true);

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

  // First-Time Temporary Password Reset States (Pharmacies & Delivery Onboarding)
  const [showFirstTimePasswordModal, setShowFirstTimePasswordModal] = useState(false);
  const [firstTimeUser, setFirstTimeUser] = useState(null);
  const [newFirstPassword, setNewFirstPassword] = useState('');
  const [confirmFirstPassword, setConfirmFirstPassword] = useState('');
  const [firstPassEye, setFirstPassEye] = useState(false);
  const [firstConfirmEye, setFirstConfirmEye] = useState(false);
  const [firstPassError, setFirstPassError] = useState('');
  const [firstPassSuccess, setFirstPassSuccess] = useState('');
  const [firstPassLoading, setFirstPassLoading] = useState(false);

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
        if (data.must_change_password || data.user.must_change_password) {
          setFirstTimeUser({
            ...data.user,
            tempPassword: password,
            identifier: email.trim(),
            role: data.user.role || 'patient'
          });
          setNewFirstPassword('');
          setConfirmFirstPassword('');
          setFirstPassError('');
          setFirstPassSuccess('');
          setShowFirstTimePasswordModal(true);
          return;
        }

        try {
          const userCreds = {
            email: data.user.email || email.trim(),
            password: password,
            name: data.user.full_name || 'Patient User',
            role: data.user.role || 'patient'
          };
          if (rememberMe) {
            localStorage.setItem('medora_remembered_credentials', JSON.stringify(userCreds));
          }
          const rawAccounts = localStorage.getItem('medora_registered_accounts');
          const accounts = rawAccounts ? JSON.parse(rawAccounts) : [];
          const updated = accounts.filter(a => a.email.toLowerCase() !== userCreds.email.toLowerCase());
          updated.unshift(userCreds);
          localStorage.setItem('medora_registered_accounts', JSON.stringify(updated));

          localStorage.setItem('medora_active_user', JSON.stringify({
            role: data.user.role || 'patient',
            email: data.user.email || email,
            name: data.user.full_name || 'Patient / User'
          }));
        } catch (e) {}

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
        try {
          const userCreds = {
            email: data.user.email || regEmail.trim(),
            password: regPassword,
            name: data.user.full_name || regFullName.trim(),
            phone: regPhone.trim(),
            role: 'patient'
          };
          // Always remember newly signed up user credentials
          localStorage.setItem('medora_remembered_credentials', JSON.stringify(userCreds));
          
          // Append/update in registered accounts list
          const rawAccounts = localStorage.getItem('medora_registered_accounts');
          const accounts = rawAccounts ? JSON.parse(rawAccounts) : [];
          const updated = accounts.filter(a => a.email.toLowerCase() !== userCreds.email.toLowerCase());
          updated.unshift(userCreds);
          localStorage.setItem('medora_registered_accounts', JSON.stringify(updated));

          // Also set active user so they are immediately logged in
          localStorage.setItem('medora_active_user', JSON.stringify({
            role: 'patient',
            email: data.user.email,
            name: data.user.full_name
          }));
        } catch (e) {}

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
        setPartnerLat('19.0760');
        setPartnerLng('72.8777');
      }
    } else {
      if (!partnerDrivingLicense.trim()) {
        setErrorMsg('Please provide your Driving License Number for rider onboarding.');
        return;
      }
      if (!partnerVehicleNumber.trim()) {
        setErrorMsg('Please provide your Vehicle Registration / Plate Number.');
        return;
      }
      if (!partnerDeliveryZone.trim()) {
        setErrorMsg('Please enter your preferred Delivery Operational City / Area.');
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
          store_name: partnerType === 'pharmacy' ? partnerStoreName.trim() : null,
          license_no: partnerType === 'pharmacy' ? partnerLicense.trim() : null,
          store_address: partnerType === 'pharmacy' ? partnerStoreAddress.trim() : null,
          latitude: partnerType === 'pharmacy' ? parseFloat(partnerLat) : null,
          longitude: partnerType === 'pharmacy' ? parseFloat(partnerLng) : null,
          vehicle_type: partnerType === 'delivery' ? partnerVehicleType : null,
          driving_license: partnerType === 'delivery' ? partnerDrivingLicense.trim() : null,
          vehicle_number: partnerType === 'delivery' ? partnerVehicleNumber.trim() : null,
          delivery_zone: partnerType === 'delivery' ? partnerDeliveryZone.trim() : null,
          shift_preference: partnerType === 'delivery' ? partnerShiftPreference : null,
          rider_upi_id: partnerType === 'delivery' ? (partnerRiderUpi.trim() || null) : null,
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
        if (data.must_change_password || data.user.must_change_password) {
          setFirstTimeUser({
            ...data.user,
            tempPassword: partnerLoginPassword,
            identifier: partnerLoginEmail.trim(),
            role: data.user.role || partnerLoginRole
          });
          setNewFirstPassword('');
          setConfirmFirstPassword('');
          setFirstPassError('');
          setFirstPassSuccess('');
          setShowPartnerLoginModal(false);
          setShowFirstTimePasswordModal(true);
          return;
        }

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

  // 8. Mandatory First-Time Temporary Password Setup Handler
  const handleFirstTimePasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!newFirstPassword || !confirmFirstPassword) {
      setFirstPassError('Please enter and confirm your new permanent password.');
      return;
    }
    const passErr = validatePassword(newFirstPassword);
    if (passErr) {
      setFirstPassError(passErr);
      return;
    }
    if (newFirstPassword !== confirmFirstPassword) {
      setFirstPassError('New passwords do not match. Please verify both fields.');
      return;
    }
    if (newFirstPassword === firstTimeUser?.tempPassword) {
      setFirstPassError('Your new password cannot be the same as your initial temporary password. Please choose a new, unique password.');
      return;
    }

    setFirstPassError('');
    setFirstPassSuccess('');
    setFirstPassLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/change-first-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: firstTimeUser.identifier || firstTimeUser.email,
          temp_password: firstTimeUser.tempPassword,
          new_password: newFirstPassword,
          confirm_password: confirmFirstPassword
        })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        setFirstPassSuccess('🎉 Password successfully configured! Launching your dashboard...');
        
        try {
          const userCreds = {
            email: data.user.email || firstTimeUser.email,
            password: newFirstPassword,
            name: data.user.full_name || firstTimeUser.full_name || firstTimeUser.name,
            role: data.user.role || firstTimeUser.role
          };
          localStorage.setItem('medora_remembered_credentials', JSON.stringify(userCreds));
          localStorage.setItem('medora_active_user', JSON.stringify({
            role: data.user.role || firstTimeUser.role,
            email: data.user.email || firstTimeUser.email,
            name: data.user.full_name || firstTimeUser.full_name || firstTimeUser.name
          }));
        } catch (e) {}

        setTimeout(() => {
          setShowFirstTimePasswordModal(false);
          onLoginSuccess({
            role: data.user.role || firstTimeUser.role,
            email: data.user.email || firstTimeUser.email,
            name: data.user.full_name || firstTimeUser.full_name || firstTimeUser.name
          });
        }, 1200);
      } else {
        setFirstPassError(data.detail || 'Failed to update password.');
      }
    } catch (err) {
      setFirstPassError(`Connection error to backend: ${err.message}`);
    } finally {
      setFirstPassLoading(false);
    }
  };

  return (
    <>
      {showBootupToon && <CartoonBootup onComplete={() => setShowBootupToon(false)} />}
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 0.85rem',
        background: 'var(--bg-body)',
        backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(184, 247, 228, 0.14) 0%, transparent 60%)'
      }}>
        <div className="glass-panel" style={{
          width: '100%',
          maxWidth: '540px',
          padding: 'clamp(1.25rem, 4vw, 2.5rem)',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08), 0 0 30px rgba(13, 148, 136, 0.1)'
        }}>
          
          {/* Logo & Cartoon Quick Launch */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setShowBootupToon(true)}
                style={{
                  background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.12) 0%, rgba(45, 212, 191, 0.22) 100%)',
                  border: '1px solid rgba(45, 212, 191, 0.45)',
                  color: 'var(--primary)',
                  padding: '5px 14px',
                  borderRadius: '99px',
                  fontSize: '0.78rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.25s ease',
                  boxShadow: '0 2px 10px rgba(13, 148, 136, 0.12)'
                }}
                title="Watch Live Cartoon Bootup"
              >
                <span>🎬 Watch Live Cartoon</span>
                <span style={{ fontSize: '0.9rem' }}>✨</span>
              </button>
            </div>
            <div style={{ fontSize: '3rem', marginBottom: '0.2rem', filter: 'drop-shadow(0 6px 16px rgba(13, 148, 136, 0.25))' }}>🧬</div>
            <h1 className="gradient-text" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.3rem)', margin: 0 }}>MEDORA</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
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
            {savedAccount && savedAccount.email && (
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                border: '1.5px solid #86efac',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.84rem',
                color: '#15803d',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>👋</span>
                  <div>
                    <div style={{ fontWeight: '800', color: '#166534' }}>
                      Remembered Account: {savedAccount.name || 'User'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#15803d' }}>
                      {savedAccount.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(savedAccount.email || '');
                    if (savedAccount.password) setPassword(savedAccount.password);
                  }}
                  style={{
                    background: '#15803d',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Prefilled ✓
                </button>
              </div>
            )}

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

            {/* Hyperlinks below Sign In button */}
            <div style={{ textAlign: 'center', marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                <span style={{ color: '#cbd5e1' }}>•</span>
                <button
                  type="button"
                  onClick={() => { setShowPartnerRequestModal(true); clearMessages(); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#10b981',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  🏥 Partner Onboarding / Signup
                </button>
              </div>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Email Address:</label>
                <input type="email" className="input-field" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="e.g. name@gmail.com" required style={{ padding: '0.7rem 0.9rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Phone Number:</label>
                <input type="tel" inputMode="tel" className="input-field" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="10-digit mobile" required style={{ padding: '0.7rem 0.9rem' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>New Password:</label>
                <input type="password" className="input-field" value={forgotNewPassword} onChange={e => setForgotNewPassword(e.target.value)} placeholder="••••••••" minLength={8} maxLength={14} required style={{ padding: '0.75rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Confirm New Password:</label>
                <input type="password" className="input-field" value={forgotConfirmPassword} onChange={e => setForgotConfirmPassword(e.target.value)} placeholder="••••••••" minLength={8} maxLength={14} required style={{ padding: '0.75rem' }} />
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
          inset: 0,
          background: 'rgba(3, 7, 18, 0.88)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '0.75rem',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '560px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '1.5rem 1.25rem',
            borderRadius: '22px',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            background: 'linear-gradient(180deg, #0e1726 0%, #070e18 100%)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(16, 185, 129, 0.12)',
            margin: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', padding: '3px 10px', fontSize: '0.72rem', color: '#10b981', fontWeight: 'bold', marginBottom: '6px' }}>
                  <span>✨</span> MEDORA PARTNER NETWORK
                </div>
                <h2 style={{ fontSize: '1.3rem', color: '#f8fafc', margin: 0, fontWeight: '800', letterSpacing: '-0.02em' }}>
                  Partner Registration
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0 0', lineHeight: '1.3' }}>
                  Submit application for instant review & dashboard credentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowPartnerRequestModal(false); clearMessages(); }}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e2e8f0',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background 0.2s ease'
                }}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePartnerRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Role Toggle */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Select Partner Category:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => { setPartnerType('pharmacy'); clearMessages(); }}
                    style={{
                      padding: '0.85rem 0.75rem',
                      borderRadius: '14px',
                      border: partnerType === 'pharmacy' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                      background: partnerType === 'pharmacy' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(13, 148, 136, 0.15) 100%)' : 'rgba(255,255,255,0.03)',
                      color: partnerType === 'pharmacy' ? '#ffffff' : '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      boxShadow: partnerType === 'pharmacy' ? '0 0 20px rgba(16, 185, 129, 0.25)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }}>🏥</span>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Pharmacy Store</span>
                    <span style={{ fontSize: '0.68rem', color: partnerType === 'pharmacy' ? '#6ee7b7' : '#64748b' }}>Dark-Store & Retail</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPartnerType('delivery'); clearMessages(); }}
                    style={{
                      padding: '0.85rem 0.75rem',
                      borderRadius: '14px',
                      border: partnerType === 'delivery' ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                      background: partnerType === 'delivery' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(14, 165, 233, 0.15) 100%)' : 'rgba(255,255,255,0.03)',
                      color: partnerType === 'delivery' ? '#ffffff' : '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      boxShadow: partnerType === 'delivery' ? '0 0 20px rgba(56, 189, 248, 0.25)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }}>🛵</span>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Delivery Rider</span>
                    <span style={{ fontSize: '0.68rem', color: partnerType === 'delivery' ? '#7dd3fc' : '#64748b' }}>Express 10-Min Fleet</span>
                  </button>
                </div>
              </div>

              {/* Applicant Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                  {partnerType === 'pharmacy' ? 'Store Owner / Pharmacist Name:' : 'Rider Full Legal Name:'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={partnerName}
                  onChange={e => setPartnerName(e.target.value)}
                  placeholder={partnerType === 'pharmacy' ? 'e.g. Dr. Rajesh Kumar' : 'e.g. Rahul Sharma'}
                  required
                  style={{ padding: '0.75rem 0.85rem', fontSize: '0.9rem' }}
                />
              </div>

              {/* Email & Phone - Responsive Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                    Email Address: <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    value={partnerEmail}
                    onChange={e => setPartnerEmail(e.target.value)}
                    placeholder="e.g. applicant@gmail.com"
                    required
                    style={{ padding: '0.75rem 0.85rem', fontSize: '0.9rem' }}
                  />
                  {partnerEmail.length > 3 && (
                    <div style={{ fontSize: '0.72rem', marginTop: '3px', fontWeight: 'bold' }}>
                      {isValidEmail(partnerEmail) ? (
                        <span style={{ color: '#10b981' }}>✓ Valid Email Format</span>
                      ) : (
                        <span style={{ color: '#f87171' }}>⚠️ Enter valid email (e.g. name@domain.com)</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                    Mobile Phone Number: <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    className="input-field"
                    value={partnerPhone}
                    onChange={e => setPartnerPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    required
                    style={{ padding: '0.75rem 0.85rem', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* PHARMACY SPECIFIC FIELDS */}
              {partnerType === 'pharmacy' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                        Pharmacy Store Name: <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={partnerStoreName}
                        onChange={e => setPartnerStoreName(e.target.value)}
                        placeholder="e.g. Medora Care Pharmacy"
                        required
                        style={{ padding: '0.75rem 0.85rem', fontSize: '0.9rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                        Drug License No. (DL): <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={partnerLicense}
                        onChange={e => setPartnerLicense(e.target.value)}
                        placeholder="e.g. KA-2024-DL9881"
                        required
                        style={{ padding: '0.75rem 0.85rem', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                      Store Physical Location Address: <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={partnerStoreAddress}
                      onChange={e => setPartnerStoreAddress(e.target.value)}
                      placeholder="e.g. Shop #4, Ground Floor, Vamanjoor Junction"
                      required
                      style={{ padding: '0.75rem 0.85rem', fontSize: '0.9rem' }}
                    />
                  </div>

                  {/* Compulsory GPS Module */}
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '14px',
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.7rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📍</span> Compulsory Store GPS Coordinates <span style={{ color: '#ef4444' }}>*</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleDetectShopLocation}
                        disabled={isLocatingShop}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
                          border: 'none',
                          color: '#ffffff',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '0.76rem',
                          fontWeight: '700',
                          cursor: isLocatingShop ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                          minHeight: '36px'
                        }}
                      >
                        {isLocatingShop ? '🛰️ Locking GPS...' : '🛰️ Auto-Detect Shop GPS'}
                      </button>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', lineHeight: '1.4' }}>
                      Required for MEDORA's Hyperlocal 10-Minute Dispatch Engine to route express courier pickups from your shop.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '3px' }}>Latitude (°N):</label>
                        <input
                          type="text"
                          className="input-field"
                          value={partnerLat}
                          onChange={e => setPartnerLat(e.target.value)}
                          placeholder="e.g. 12.8941"
                          required
                          style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '3px' }}>Longitude (°E):</label>
                        <input
                          type="text"
                          className="input-field"
                          value={partnerLng}
                          onChange={e => setPartnerLng(e.target.value)}
                          placeholder="e.g. 74.8431"
                          required
                          style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* UPI VPA & QR Upload */}
                  <div style={{
                    background: 'rgba(56, 189, 248, 0.06)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '14px',
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.7rem'
                  }}>
                    <span style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚡</span> Store UPI ID & Official Shop QR Code <span style={{ color: '#ef4444' }}>*</span>
                    </span>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', lineHeight: '1.4' }}>
                      Used for instant direct settlement to your bank account when customers pay at delivery or store checkout.
                    </p>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                        Shop UPI VPA / Handle (e.g. for payments):
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={partnerShopUpiId}
                        onChange={e => setPartnerShopUpiId(e.target.value)}
                        placeholder="e.g. storename@okhdfcbank or auto-generated"
                        style={{ padding: '0.65rem 0.8rem', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                        Store UPI QR Code (GPay / PhonePe / Paytm / Soundbox): <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{
                          flex: 1,
                          minWidth: '200px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px dashed #38bdf8',
                          borderRadius: '10px',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          color: '#38bdf8',
                          fontWeight: '600',
                          minHeight: '44px'
                        }}>
                          <span>📷</span>
                          <span>{partnerShopUpiQrPreview ? 'Change QR Photo ✓' : 'Select or Capture Shop UPI QR'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleShopUpiQrUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                        {partnerShopUpiQrPreview && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #38bdf8' }}>
                              <img src={partnerShopUpiQrPreview} alt="Shop QR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <button
                              type="button"
                              onClick={() => { setPartnerShopUpiQr(''); setPartnerShopUpiQrPreview(''); }}
                              style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* RIDER SPECIFIC FIELDS */}
              {partnerType === 'delivery' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                        Vehicle Type: <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        className="input-field"
                        value={partnerVehicleType}
                        onChange={e => setPartnerVehicleType(e.target.value)}
                        style={{ padding: '0.75rem', background: '#111827', color: '#ffffff', fontSize: '0.9rem' }}
                      >
                        <option value="Electric Scooter">Electric Scooter 🛵 (Preferred)</option>
                        <option value="Motorcycle">Motorcycle 🏍️</option>
                        <option value="Bicycle">Bicycle 🚲 (Hyperlocal &lt; 2km)</option>
                        <option value="EV Cargo Van">EV Cargo Van 🚐 (Bulk)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                        Driving License No. (DL): <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={partnerDrivingLicense}
                        onChange={e => setPartnerDrivingLicense(e.target.value)}
                        placeholder="e.g. DL-1420110012345"
                        required
                        style={{ padding: '0.75rem 0.85rem', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                        Vehicle Number / Plate: <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={partnerVehicleNumber}
                        onChange={e => setPartnerVehicleNumber(e.target.value)}
                        placeholder="e.g. KA-19-MB-4021"
                        required
                        style={{ padding: '0.75rem 0.85rem', fontSize: '0.9rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                        Operational City & Delivery Zone: <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={partnerDeliveryZone}
                        onChange={e => setPartnerDeliveryZone(e.target.value)}
                        placeholder="e.g. Mangalore Central / Indiranagar"
                        required
                        style={{ padding: '0.75rem 0.85rem', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                        Preferred Working Shift:
                      </label>
                      <select
                        className="input-field"
                        value={partnerShiftPreference}
                        onChange={e => setPartnerShiftPreference(e.target.value)}
                        style={{ padding: '0.75rem', background: '#111827', color: '#ffffff', fontSize: '0.9rem' }}
                      >
                        <option value="Full Time (Express 10-Min)">Full Time (Express 10-Min Fleet)</option>
                        <option value="Evening Peak (5 PM - 11 PM)">Evening Peak (5 PM - 11 PM)</option>
                        <option value="Flexible / Part Time">Flexible / On-Demand</option>
                        <option value="Weekend Express">Weekend Express</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>
                        Rider UPI ID (For Daily Payouts):
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={partnerRiderUpi}
                        onChange={e => setPartnerRiderUpi(e.target.value)}
                        placeholder="e.g. yourname@okaxis"
                        style={{ padding: '0.75rem 0.85rem', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>

                  {/* Rider Readiness Checklist */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    background: 'rgba(56, 189, 248, 0.06)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={partnerBagConfirmed}
                      onChange={e => setPartnerBagConfirmed(e.target.checked)}
                      style={{ accentColor: '#38bdf8', width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: '0.78rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                      <strong>Rider Readiness Confirmation:</strong> I confirm I possess an active Android/iOS smartphone with GPS, valid driving credentials, and readiness to carry an insulated medicine delivery kit.
                    </div>
                  </label>
                </>
              )}

              {errorMsg && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  color: '#f87171',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  fontWeight: '600'
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  color: '#34d399',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  fontWeight: '600'
                }}>
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
                  borderRadius: '12px',
                  background: partnerType === 'pharmacy' ? 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)' : 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                  boxShadow: partnerType === 'pharmacy' ? '0 4px 15px rgba(16, 185, 129, 0.35)' : '0 4px 15px rgba(56, 189, 248, 0.35)',
                  minHeight: '48px',
                  cursor: isLoading ? 'wait' : 'pointer'
                }}
              >
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
          inset: 0,
          background: 'rgba(3, 7, 18, 0.88)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '0.75rem',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '480px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '1.5rem 1.25rem',
            borderRadius: '22px',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            background: 'linear-gradient(180deg, #0e1726 0%, #070e18 100%)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(16, 185, 129, 0.12)',
            margin: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#f8fafc', margin: 0, fontWeight: '800' }}>
                  Partner Sign In Portal
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                  Access Pharmacy Store or Rider Fleet Console
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowPartnerLoginModal(false); clearMessages(); }}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e2e8f0',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                aria-label="Close dialog"
              >
                ✕
              </button>
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

                <div style={{ textAlign: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPartnerLoginModal(false);
                      setShowPartnerRequestModal(true);
                      clearMessages();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.84rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    ✨ New Partner? Apply for Pharmacy Store or Rider Onboarding ➔
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MANDATORY FIRST-TIME TEMPORARY PASSWORD SETUP MODAL */}
      {showFirstTimePasswordModal && firstTimeUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.25rem'
        }}>
          <div style={{
            background: '#121418',
            borderRadius: '20px',
            border: '1px solid rgba(184, 247, 228, 0.35)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(184, 247, 228, 0.15)',
            width: '100%',
            maxWidth: '520px',
            padding: '2rem 2.25rem',
            animation: 'fadeInUp 0.3s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                padding: '4px 12px',
                borderRadius: '99px',
                fontSize: '0.74rem',
                fontWeight: '800',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                textTransform: 'uppercase'
              }}>
                <span>🔐</span>
                <span>Mandatory Security Step</span>
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: '800', color: '#fff', margin: '0 0 0.4rem 0' }}>
                Create Your Permanent Password
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: '1.45', margin: 0 }}>
                Welcome to MEDORA! Because your account was initialized with a temporary password, you must create a new permanent password to activate full access.
              </p>
            </div>

            {/* Account Info Pill */}
            <div style={{
              background: '#181b21',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '0.85rem 1.1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 'bold' }}>ACCOUNT:</span>
                <span style={{ fontSize: '0.88rem', color: '#fff', fontWeight: '600' }}>{firstTimeUser.email}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  background: firstTimeUser.role === 'pharmacy' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: firstTimeUser.role === 'pharmacy' ? '#38bdf8' : '#fbbf24',
                  border: firstTimeUser.role === 'pharmacy' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 'bold',
                  display: 'inline-block'
                }}>
                  {firstTimeUser.role === 'pharmacy' ? '🏥 Pharmacy Store' : firstTimeUser.role === 'delivery' ? '🛵 Delivery Rider' : '👤 Verified User'}
                </span>
              </div>
            </div>

            {/* Password Form */}
            <form onSubmit={handleFirstTimePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>
                  New Permanent Password (8-14 chars):
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={firstPassEye ? 'text' : 'password'}
                    className="input-field"
                    value={newFirstPassword}
                    onChange={e => setNewFirstPassword(e.target.value)}
                    placeholder="Enter new private password"
                    style={{ paddingRight: '45px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setFirstPassEye(p => !p)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      color: '#94a3b8'
                    }}
                  >
                    {firstPassEye ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: '600' }}>
                  Confirm Permanent Password:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={firstConfirmEye ? 'text' : 'password'}
                    className="input-field"
                    value={confirmFirstPassword}
                    onChange={e => setConfirmFirstPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    style={{ paddingRight: '45px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setFirstConfirmEye(p => !p)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      color: '#94a3b8'
                    }}
                  >
                    {firstConfirmEye ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              {/* Real-time Password Rules Checklist */}
              <div style={{
                background: '#0e1013',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.74rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.4rem'
              }}>
                <div style={{ color: (newFirstPassword.length >= 8 && newFirstPassword.length <= 14) ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>{(newFirstPassword.length >= 8 && newFirstPassword.length <= 14) ? '✓' : '○'}</span>
                  <span>8 to 14 characters</span>
                </div>
                <div style={{ color: /[a-zA-Z]/.test(newFirstPassword) ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>{/[a-zA-Z]/.test(newFirstPassword) ? '✓' : '○'}</span>
                  <span>At least 1 letter</span>
                </div>
                <div style={{ color: /\d/.test(newFirstPassword) ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>{/\d/.test(newFirstPassword) ? '✓' : '○'}</span>
                  <span>At least 1 digit</span>
                </div>
                <div style={{ color: (newFirstPassword && newFirstPassword === confirmFirstPassword) ? '#34d399' : '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>{(newFirstPassword && newFirstPassword === confirmFirstPassword) ? '✓' : '○'}</span>
                  <span>Passwords match</span>
                </div>
              </div>

              {firstPassError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#f87171',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  textAlign: 'center'
                }}>
                  ⚠️ {firstPassError}
                </div>
              )}

              {firstPassSuccess && (
                <div style={{
                  background: 'rgba(52, 211, 153, 0.15)',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  color: '#34d399',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  textAlign: 'center'
                }}>
                  {firstPassSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={firstPassLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '0.85rem',
                  fontSize: '0.92rem',
                  fontWeight: 'bold',
                  marginTop: '0.25rem'
                }}
              >
                {firstPassLoading ? 'Securing Password...' : 'Save Password & Enter Dashboard ➔'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowFirstTimePasswordModal(false);
                    setFirstTimeUser(null);
                    setNewFirstPassword('');
                    setConfirmFirstPassword('');
                    setFirstPassError('');
                    setFirstPassSuccess('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  ← Cancel & Return to Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
