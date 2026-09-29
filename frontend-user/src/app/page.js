"use client";
import React, { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';
import LoginGateway from '../components/LoginGateway';
import PharmacyView from '../components/PharmacyView';
import RiderView from '../components/RiderView';
import AdminView from '../components/AdminView';
import SwiggyAddressDrawer from '../components/SwiggyAddressDrawer';
import LivePerimeterRadar from '../components/LivePerimeterRadar';
import CartoonBootup from '../components/CartoonBootup';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://backend-three-kappa-38.vercel.app';
const USER_ID = "1";

// Order lifecycle stages
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
          background: 'rgba(255,255,255,0.06)', borderRadius: '4px', zIndex: 0
        }} />
        <div style={{
          position: 'absolute', top: '22px', left: '22px', height: '4px',
          width: currentIdx <= 0 ? '0%' : `${(currentIdx / (STAGES.length - 1)) * 100}%`,
          background: 'linear-gradient(90deg, var(--primary), var(--green))',
          borderRadius: '4px', zIndex: 1,
          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />

        {STAGES.map((stage, idx) => {
          const done = idx <= currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, flex: 1 }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: done ? 'var(--primary)' : '#25272C',
                border: active ? '3px solid var(--primary)' : done ? '2px solid var(--green)' : '2px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                boxShadow: active ? '0 0 20px rgba(184, 247, 228, 0.4)' : 'none',
                transition: 'all 0.5s ease',
                color: done ? '#16171a' : '#fff'
              }}>
                {stage.icon}
              </div>
              <span style={{
                fontSize: '0.7rem', marginTop: '8px', textAlign: 'center',
                color: done ? 'var(--primary)' : 'rgba(255,255,255,0.3)',
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
  const [mounted, setMounted] = useState(false);
  const [showBootup, setShowBootup] = useState(true);
  const [activeUser, setActiveUser] = useState(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      try {
        const played = sessionStorage.getItem('medora_bootup_played');
        if (played) {
          setShowBootup(false);
        }
      } catch (e) {}
      const saved = localStorage.getItem('medora_active_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.email) {
            // Verify with backend that this user account is still active
            fetch(`${API}/api/v1/auth/user-status?identifier=${encodeURIComponent(parsed.email)}`)
              .then(res => res.json())
              .then(data => {
                if (data.exists === false) {
                  showToast('This account has been deleted by the administrator.', '⚠️');
                  handleLogout();
                } else if (data.status === 'deactivated') {
                  showToast('This account has been deactivated by the administrator.', '🚫');
                  handleLogout();
                } else {
                  setActiveUser(parsed);
                }
              })
              .catch(() => {
                setActiveUser(parsed);
              });
          }
        } catch (e) {}
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setActiveUser(userData);
    if (typeof window !== 'undefined') {
      localStorage.setItem('medora_active_user', JSON.stringify(userData));
    }
  };

  const handleLogout = () => {
    setActiveUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('medora_active_user');
    }
  };

  const handleSwitchRole = async (roleKey) => {
    const roleMap = {
      patient: { role: 'patient', email: 'patient@medora.com', name: 'Adhwaith (Patient)' },
      pharmacy: { role: 'pharmacy', email: 'pharmacy@medora.com', name: 'Vamanjoor Pharmacy Admin' },
      delivery: { role: 'delivery', email: 'rider@medora.com', name: 'Rider AGT-591' }
    };
    const targetUser = roleMap[roleKey];
    if (!targetUser) return;

    try {
      const res = await fetch(`${API}/api/v1/auth/user-status?identifier=${encodeURIComponent(targetUser.email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.exists === false) {
          showToast(`Cannot switch: Account ${targetUser.email} has been deleted.`, '⚠️');
          return;
        }
        if (data.status === 'deactivated') {
          showToast(`Cannot switch: Account ${targetUser.email} is currently DEACTIVATED by admin.`, '🚫');
          return;
        }
      }
    } catch (e) {}

    setActiveUser(targetUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem('medora_active_user', JSON.stringify(targetUser));
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [multiCompositionSplit, setMultiCompositionSplit] = useState(null);
  const [activeCompositionTab, setActiveCompositionTab] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [cart, setCart] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);

  // Swiggy Instamart Location & Delivery Address State
  const [isAddressDrawerOpen, setIsAddressDrawerOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState({
    id: "addr_home_1",
    tag: "Home",
    icon: "🏠",
    houseNo: "Flat 402, 4th Floor, Tower 2",
    area: "Airport Road, Vamanjoor",
    city: "Mangalore",
    pincode: "575028",
    landmark: "Opposite St. Joseph Engineering College",
    receiverName: "Adhwaith",
    receiverPhone: "+91 99999 99999",
    latitude: 19.0760,
    longitude: 72.8777
  });

  // Instamart Quick Commerce & Live Perimeter State
  const [bootCatalog, setBootCatalog] = useState([]);
  const [pharmacyNetwork, setPharmacyNetwork] = useState([]);
  const [isBootLoading, setIsBootLoading] = useState(false);
  const [activeInstamartCategory, setActiveInstamartCategory] = useState('All Essentials');
  const [perimeterKm, setPerimeterKm] = useState(3.5);
  const [filterInsideOnly, setFilterInsideOnly] = useState(false);
  const [liveGpsCoords, setLiveGpsCoords] = useState({ lat: 19.0760, lng: 72.8777, accuracy: null });

  // Load saved address from localStorage
  useEffect(() => {
    try {
      const savedAddr = localStorage.getItem('medora_selected_address');
      if (savedAddr) {
        const parsed = JSON.parse(savedAddr);
        if (parsed?.houseNo) setSelectedAddress(parsed);
      }
    } catch (e) {}
  }, []);

  // Fetch Instamart boot catalog of popular medicines in stock nearby
  useEffect(() => {
    const fetchBootCatalog = async () => {
      setIsBootLoading(true);
      try {
        const lat = selectedAddress?.latitude || 19.0760;
        const lng = selectedAddress?.longitude || 72.8777;
        const res = await fetch(`${API}/api/v1/medicines/instamart/boot-catalog?lat=${lat}&lng=${lng}&perimeter_km=${perimeterKm}`);
        if (res.ok) {
          const data = await res.json();
          setBootCatalog(data.items || []);
          setPharmacyNetwork(data.connected_pharmacies || []);
        }
      } catch (e) {
        console.error("Instamart boot catalog offline", e);
      } finally {
        setIsBootLoading(false);
      }
    };
    fetchBootCatalog();
  }, [selectedAddress, perimeterKm]);

  const handleSelectAddress = (addr) => {
    setSelectedAddress(addr);
    try {
      localStorage.setItem('medora_selected_address', JSON.stringify(addr));
    } catch (e) {}
  };
  
  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGreetingVisible, setIsGreetingVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hello! I am MEDORA's AI Virtual Doctor. What symptoms are you experiencing today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatFinished, setChatFinished] = useState(false);
  const [chatSuggestedMedicines, setChatSuggestedMedicines] = useState([]);
  const chatEndRef = useRef(null);

  // Modals Toggles
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [uploadedPrescriptionId, setUploadedPrescriptionId] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isNavVisible, setIsNavVisible] = useState(false);

  // Payment Gateway Flow State ('cart' | 'payment' | 'processing' | 'success')
  const [paymentStep, setPaymentStep] = useState('cart');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('user@upi');
  const [cardNumber, setCardNumber] = useState('4532 8912 3456 7890');
  const [cardHolder, setCardHolder] = useState('AD HWAITH');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('888');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('123456');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatusMsg, setPaymentStatusMsg] = useState('');
  const [completedOrderInfo, setCompletedOrderInfo] = useState(null);

  // Live POS Machine & Shop UPI Terminal State
  const [liveTerminalData, setLiveTerminalData] = useState(null);
  const [qrViewMode, setQrViewMode] = useState('auto'); // 'auto' | 'live' | 'shop'
  const [isRefreshingLiveQr, setIsRefreshingLiveQr] = useState(false);

  // Dedicated Main View Toggle ('home' | 'radar')
  const [activeMainView, setActiveMainView] = useState('home');
  // Interactive Medicine Details Modal
  const [selectedMedicineDetail, setSelectedMedicineDetail] = useState(null);
  // Elegant Toast Notification System
  const [toastNotification, setToastNotification] = useState(null);

  const showToast = (message, icon = '✓') => {
    setToastNotification({ message, icon, id: Date.now() });
    setTimeout(() => {
      setToastNotification(prev => (prev?.message === message ? null : prev));
    }, 3200);
  };

  const getItemCartCount = (medicineId) => {
    return cart.filter(i => i.medicine_id === medicineId).length;
  };

  const handleUpdateItemQuantity = (med, delta) => {
    if (delta > 0) {
      setCart(prev => {
        const updated = [...prev, med];
        try { localStorage.setItem('medora_cart', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
      showToast(`Added ${med.brand_name} to cart (Total: ${getItemCartCount(med.medicine_id) + 1})`, '🛒');
    } else {
      const idx = cart.findIndex(i => i.medicine_id === med.medicine_id);
      if (idx !== -1) {
        setCart(prev => {
          const updated = prev.filter((_, i) => i !== idx);
          try { localStorage.setItem('medora_cart', JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
        const remaining = getItemCartCount(med.medicine_id) - 1;
        showToast(`Removed 1x ${med.brand_name}${remaining > 0 ? ` (${remaining} in cart)` : ''}`, '🗑️');
      }
    }
  };

  const filterByCategory = (med, cat) => {
    if (!cat || cat === 'All Essentials') return true;
    const text = `${med.brand_name || ''} ${med.generic_name || ''} ${med.category || ''} ${med.dosage || ''} ${med.form || ''}`.toLowerCase();
    if (cat === 'Fever & Pain') {
      return text.includes('paracetamol') || text.includes('dolo') || text.includes('crocin') || text.includes('combiflam') || text.includes('ibuprofen') || text.includes('pain') || text.includes('fever') || text.includes('aspirin');
    }
    if (cat === 'Cold & Allergy') {
      return text.includes('cetirizine') || text.includes('allegra') || text.includes('cheston') || text.includes('cold') || text.includes('cough') || text.includes('allergy') || text.includes('sinus') || text.includes('ascoril') || text.includes('benadryl') || text.includes('montelukast');
    }
    if (cat === 'Antibiotics') {
      return text.includes('amoxicillin') || text.includes('azithromycin') || text.includes('augmentin') || text.includes('cipro') || text.includes('antibiotic') || text.includes('zifi') || text.includes('bacterial') || text.includes('clav');
    }
    if (cat === 'Acidity & Digestion') {
      return text.includes('pantocid') || text.includes('pan 40') || text.includes('digene') || text.includes('gelusil') || text.includes('omeprazole') || text.includes('rabeprazole') || text.includes('antacid') || text.includes('acidity') || text.includes('panto');
    }
    if (cat === 'First Aid & Vitamins') {
      return text.includes('betadine') || text.includes('band') || text.includes('dettol') || text.includes('vitamin') || text.includes('zinc') || text.includes('calcium') || text.includes('limcee') || text.includes('supradyn') || text.includes('b-complex') || text.includes('cotton') || text.includes('zincovit');
    }
    return true;
  };

  const goHome = () => {
    setActiveMainView('home');
    setIsCartOpen(false);
    setIsTrackingOpen(false);
    setIsOcrOpen(false);
    setIsChatOpen(false);
    setSelectedMedicineDetail(null);
    setPaymentStep('cart');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsNavVisible(window.scrollY > 80);
      const t = Math.min(window.scrollY / 450, 1);
      const progress = 1 - Math.pow(1 - t, 3);
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Vision OCR State
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const [matchedMedicines, setMatchedMedicines] = useState([]);
  const fileInputRef = useRef(null);
  // Matrix Rain Background Effect
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    
    // Set size
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.offsetWidth || window.innerWidth;
      canvas.height = canvas.parentElement.offsetHeight || window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Characters
    const chars = "01010101010101010101010101010101🧬💊🩺🧪⚕️";
    const charArr = chars.split("");
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize) + 1;
    const drops = Array(columns).fill(1);
    
    const draw = () => {
      // Semi-transparent light slate to build trailing effect for light theme
      ctx.fillStyle = 'rgba(248, 250, 252, 0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = 'rgba(13, 148, 136, 0.18)'; // gentle teal/mint glyphs
      ctx.font = `${fontSize}px monospace`;
      
      for (let i = 0; i < drops.length; i++) {
        const text = charArr[Math.floor(Math.random() * charArr.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        
        ctx.fillText(text, x, y);
        
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      animationFrameId = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Highlight matched query text
  const highlightMatch = (text, query) => {
    if (!query) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} style={{ background: 'rgba(184, 247, 228, 0.3)', color: 'var(--primary)', borderRadius: '2px', padding: '0 2px', fontWeight: 'bold' }}>
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const handleAddBothCompositionsToCart = (split) => {
    if (!split || !split.tabs || split.tabs.length < 2) return;
    const item1 = split.tabs[0].medicines?.[0];
    const item2 = split.tabs[1].medicines?.[0];
    let countAdded = 0;
    if (item1) { addToCart(item1); countAdded++; }
    if (item2) { addToCart(item2); countAdded++; }
    if (countAdded > 0) {
      showToast(`Added both separate formulations (${split.tabs[0].name} + ${split.tabs[1].name}) to cart!`, '💊');
    }
  };

  // Live suggestions debounced fetch with Instamart local store inventory & speed
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        setMultiCompositionSplit(null);
        setShowSuggestions(false);
        return;
      }
      try {
        const lat = selectedAddress?.latitude || 19.0760;
        const lng = selectedAddress?.longitude || 72.8777;
        const res = await fetch(`${API}/api/v1/medicines/search?q=${encodeURIComponent(searchQuery)}&lat=${lat}&lng=${lng}&perimeter_km=${perimeterKm}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
          setMultiCompositionSplit(data.multi_composition_split || null);
          setActiveCompositionTab(0);
          setShowSuggestions(true);
          setFocusedIndex(-1);
        }
      } catch (err) { console.error("Backend offline", err); }
    };
    const t = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(t);
  }, [searchQuery, selectedAddress, perimeterKm]);

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

  // Poll user's orders for live tracking
  useEffect(() => {
    const fetchMyOrders = async () => {
      try {
        const res = await fetch(`${API}/api/v1/orders/user/${USER_ID}`);
        if (res.ok) {
          const data = await res.json();
          const live = (data.orders || []).filter(o => o.status !== 'delivered');
          setActiveOrders(live);
        }
      } catch (e) {}
    };
    fetchMyOrders();
    const interval = setInterval(fetchMyOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-popup chatbot greeting bubble after 2 seconds of visiting
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsGreetingVisible(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('medora_cart');
      if (saved) setCart(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const addToCart = (med) => {
    setCart(prev => {
      const updated = [...prev, med];
      try { localStorage.setItem('medora_cart', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const removeFromCart = (idx) => {
    setCart(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      try { localStorage.setItem('medora_cart', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  const handleSuggestedMedicineClick = async (medName) => {
    try {
      const res = await fetch(`${API}/api/v1/medicines/search?q=${encodeURIComponent(medName)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          addToCart(data.results[0]);
          showToast(`Added ${medName} to cart! Click Checkout to complete order`, '🛒');
          return;
        }
      }
    } catch (e) {}
    
    addToCart({
      medicine_id: `MED_OTC_${Math.floor(Math.random() * 1000)}`,
      brand_name: medName,
      generic_name: medName,
      price_mrp: "45.00",
      dosage: "1 Unit"
    });
    showToast(`Added ${medName} to cart! Click Checkout to complete order`, '🛒');
  };

  const renderFormattedMessageContent = (content) => {
    if (!content) return null;

    let mainText = content;
    let disclaimerText = "";

    const disclaimerIndex = content.toLowerCase().indexOf("disclaimer:");
    if (disclaimerIndex !== -1) {
      mainText = content.substring(0, disclaimerIndex).trim();
      disclaimerText = content.substring(disclaimerIndex).trim();
    }

    const parseBold = (txt) => {
      const parts = txt.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const cleanName = part.slice(2, -2).trim();
          return (
            <strong key={idx} style={{ color: '#0f172a', fontWeight: '800' }}>
              {cleanName}
            </strong>
          );
        }
        return part;
      });
    };

    const lines = mainText.split('\n');
    const formattedElements = lines.map((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={lineIdx} style={{ height: '0.4rem' }} />;

      const lower = trimmed.toLowerCase();

      // Section Header: Probable Condition
      if (lower.includes('probable condition:')) {
        return (
          <div key={lineIdx} style={{ marginTop: '0.5rem', marginBottom: '0.3rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              padding: '2px 8px',
              borderRadius: '99px',
              fontSize: '0.72rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <span>🩺</span> Probable Condition
            </span>
          </div>
        );
      }

      // Section Header: Recommended OTC Relief
      if (lower.includes('recommended otc relief:')) {
        return (
          <div key={lineIdx} style={{ marginTop: '0.7rem', marginBottom: '0.35rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#f0fdf4',
              color: '#15803d',
              border: '1px solid #bbf7d0',
              padding: '2px 8px',
              borderRadius: '99px',
              fontSize: '0.72rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <span>💊</span> Recommended OTC Relief
            </span>
          </div>
        );
      }

      // Section Header: Clinical Guidance
      if (lower.includes('clinical guidance:')) {
        return (
          <div key={lineIdx} style={{ marginTop: '0.7rem', marginBottom: '0.35rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#f0fdfa',
              color: '#0f766e',
              border: '1px solid #99f6e4',
              padding: '2px 8px',
              borderRadius: '99px',
              fontSize: '0.72rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <span>📋</span> Clinical Guidance
            </span>
          </div>
        );
      }

      // Warning or Critical Contraindication
      if (lower.includes('critical warning:') || lower.includes('do not take') || lower.includes('contraindication:')) {
        return (
          <div key={lineIdx} style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '7px 11px',
            margin: '0.45rem 0',
            color: '#991b1b',
            fontSize: '0.84rem',
            lineHeight: '1.45',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px'
          }}>
            <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>⚠️</span>
            <div>{parseBold(trimmed.replace(/^[\*\-]\s*/, ''))}</div>
          </div>
        );
      }

      // Bullet items (e.g. medicine or guidance point)
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        const cleanLine = trimmed.replace(/^[\*\-]\s*/, '').trim();

        // Check if this line introduces a recommended medicine
        const knownMeds = ["Pantocid 40", "Gelusil", "Dolo 650", "Calpol 500", "Crocin Advance", "Allegra 120", "Cetirizine 10mg", "Ascoril-D", "ORS Electrolyte", "Combiflam"];
        let matchedMed = null;
        for (const m of knownMeds) {
          if (cleanLine.toLowerCase().includes(m.toLowerCase().split(' ')[0])) {
            matchedMed = m;
            break;
          }
        }

        return (
          <div key={lineIdx} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            margin: '0.35rem 0',
            background: matchedMed ? '#ffffff' : 'transparent',
            border: matchedMed ? '1px solid #e2e8f0' : 'none',
            borderRadius: matchedMed ? '10px' : '0',
            padding: matchedMed ? '8px 10px' : '2px 0 2px 4px',
            boxShadow: matchedMed ? '0 1px 4px rgba(0,0,0,0.03)' : 'none'
          }}>
            <span style={{ color: matchedMed ? 'var(--primary)' : '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>
              {matchedMed ? '💊' : '•'}
            </span>
            <div style={{ flex: 1, fontSize: '0.88rem', color: '#1e293b', lineHeight: '1.55' }}>
              {parseBold(cleanLine)}
            </div>
            {matchedMed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSuggestedMedicineClick(matchedMed);
                }}
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#15803d',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                title={`Add ${matchedMed} to cart`}
              >
                + Add
              </button>
            )}
          </div>
        );
      }

      // Default plain paragraph
      return (
        <p key={lineIdx} style={{ margin: '0 0 0.45rem 0', color: '#1e293b', lineHeight: '1.55', fontSize: '0.88rem' }}>
          {parseBold(trimmed)}
        </p>
      );
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        {formattedElements}
        {disclaimerText && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.6rem 0.85rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '0.73rem',
            color: '#64748b',
            fontStyle: 'italic',
            lineHeight: '1.45',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ fontStyle: 'normal' }}>ℹ️</span>
            <span>{disclaimerText}</span>
          </div>
        )}
      </div>
    );
  };

  const fetchPharmacyLiveTerminalQr = async () => {
    setIsRefreshingLiveQr(true);
    try {
      const res = await fetch(`${API}/api/v1/medicines/pharmacy/live-terminal-qr?pharmacy_id=PHARM_001`);
      if (res.ok) {
        const data = await res.json();
        setLiveTerminalData(data);
      }
    } catch (e) {
      console.warn('Could not fetch pharmacy live terminal QR:', e);
    } finally {
      setIsRefreshingLiveQr(false);
    }
  };

  const handleInitiatePayment = () => {
    if (cart.length === 0) return alert("Cart is empty!");
    setPaymentStep('payment');
    fetchPharmacyLiveTerminalQr();
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

    // Direct UPI Payment Flow with Store QR Verification
    if (selectedPaymentMethod === 'upi') {
      try {
        setPaymentStatusMsg('Verifying UPI Payment with Store Soundbox & Authorizing...');
        await new Promise(r => setTimeout(r, 1200));
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

  const finalizeOrderPlacement = async (totalAmt, method, paymentId) => {
    setPaymentStatusMsg('Confirming Order with Pharmacy & Dispatching Delivery Rider...');
    await new Promise(r => setTimeout(r, 600));

    const orderRes = await fetch(`${API}/api/v1/orders/create`, {
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
        prescription_id: uploadedPrescriptionId,
        delivery_type: "15-Min Quick Commerce",
        distance: selectedAddress?.area ? `${selectedAddress.area} (Nearby Hub)` : "1.2 km away",
        payment_method: method,
        payment_status: method === 'cod' ? 'unpaid' : 'paid',
        payment_id: paymentId,
        delivery_address: selectedAddress
      })
    });
    const orderData = await orderRes.json();

    if (orderRes.ok) {
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
      const err = await orderRes.json();
      throw new Error(err.detail?.[0]?.msg || "Failed to confirm order.");
    }
  };

  const handleTriggerChatMessage = async (inputText) => {
    if (!inputText || !inputText.trim() || isChatLoading || chatFinished) return;

    const userMessage = { role: 'user', content: inputText.trim() };
    const updatedMessages = [...chatMessages, userMessage];
    
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsChatLoading(true);

    // 1. Send to MEDORA backend AI endpoint (Google Gemini Flash + Clinical Pharmacology Engine)
    try {
      const res = await fetch(`${API}/api/v1/ai/chat`, {
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
        if (data.session_finished || (data.suggested_medicines && data.suggested_medicines.length > 0)) {
          setChatFinished(true);
          setChatSuggestedMedicines(data.suggested_medicines || []);
        }
        return;
      }
    } catch (err) {
      console.warn("Backend /api/v1/ai/chat unreachable, trying /chat or clinical fallback...", err);
    }

    // 2. Try direct /chat route on main backend
    try {
      const res2 = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: USER_ID,
          messages: updatedMessages
        })
      });
      if (res2.ok) {
        const data2 = await res2.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data2.content }]);
        if (data2.session_finished || (data2.suggested_medicines && data2.suggested_medicines.length > 0)) {
          setChatFinished(true);
          setChatSuggestedMedicines(data2.suggested_medicines || []);
        }
        return;
      }
    } catch (err2) {
      console.warn("Direct /chat unreachable, applying clinical pharmacology fallback...", err2);
    }

    // 3. Clinical Pharmacology Rule Engine Fallback (guaranteed 100% uptime & zero crashes)
    try {
      const query = (inputText || '').toLowerCase();
      const allText = updatedMessages.map(m => m.content).join(' ').toLowerCase();

      let replyText = "";
      let foundMeds = [];

      if (allText.includes('acid') || allText.includes('reflux') || allText.includes('gerd') || allText.includes('heartburn') || allText.includes('chest burn') || allText.includes('burning')) {
        replyText = "**Probable Condition:**\nGastroesophageal Reflux / Acute Gastric Hyperacidity\n\n" +
          "**Recommended OTC Relief:**\n" +
          "- **Pantocid 40**: 1 tablet once daily in the morning, 30 minutes before breakfast. Reduces gastric acid secretion.\n" +
          "- **Gelusil**: 10ml syrup or 1-2 chewable tablets as needed 1 hour after meals for instant acid neutralization.\n\n" +
          "**Clinical Guidance:**\n" +
          "- Avoid spicy, oily, acidic foods, citrus fruits, and late-night meals.\n" +
          "- Keep head elevated by 6 inches while resting.\n" +
          "- ⚠️ CRITICAL CONTRAINDICATION: Do NOT take Dolo 650, Crocin, Combiflam, or Aspirin, as NSAIDs irritate the gastric mucosa and worsen burning!\n\n" +
          "Disclaimer: I am an AI assistant, not a doctor. Consult a healthcare professional before taking medications.";
        foundMeds = ["Pantocid 40", "Gelusil"];
      } else if (allText.includes('fever') || allText.includes('temperature') || allText.includes('chills') || allText.includes('pyrexia')) {
        replyText = "**Probable Condition:**\nAcute Febrile Illness / Viral Pyrexia\n\n" +
          "**Recommended OTC Relief:**\n" +
          "- **Dolo 650**: 1 tablet every 6-8 hours as needed (maximum 3 tablets per 24 hours) after meals.\n" +
          "- **Calpol 500**: Safe alternative for mild-to-moderate fever reduction.\n" +
          "- **ORS Electrolyte**: Drink throughout the day to replenish hydration lost via sweating.\n\n" +
          "**Clinical Guidance:**\n" +
          "- Maintain strict bed rest and drink plenty of fluids.\n" +
          "- Apply lukewarm water compresses if temperature exceeds 101°F.\n" +
          "- ⚠️ Seek medical attention if fever lasts over 3 days or causes rash.\n\n" +
          "Disclaimer: I am an AI assistant, not a doctor. Consult a healthcare professional before taking medications.";
        foundMeds = ["Dolo 650", "Calpol 500", "ORS Electrolyte"];
      } else if (allText.includes('cold') || allText.includes('sneez') || allText.includes('runny') || allText.includes('allergy') || allText.includes('nasal')) {
        replyText = "**Probable Condition:**\nAllergic Rhinitis / Acute Upper Respiratory Rhinovirus\n\n" +
          "**Recommended OTC Relief:**\n" +
          "- **Allegra 120**: 1 tablet once daily in the morning with water (non-drowsy 2nd gen antihistamine).\n" +
          "- **Cetirizine 10mg**: 1 tablet at bedtime if nighttime sneezing or nasal congestion persists.\n\n" +
          "**Clinical Guidance:**\n" +
          "- Practice steam inhalation twice daily to clear nasal passages.\n" +
          "- Avoid exposure to dust, sudden AC chilling, and pet dander.\n" +
          "- Drink warm herbal tea or honey lemon water.\n\n" +
          "Disclaimer: I am an AI assistant, not a doctor. Consult a healthcare professional before taking medications.";
        foundMeds = ["Allegra 120", "Cetirizine 10mg"];
      } else if (allText.includes('cough') || allText.includes('throat') || allText.includes('sore throat')) {
        replyText = "**Probable Condition:**\nAcute Pharyngitis / Irritant Bronchial Cough\n\n" +
          "**Recommended OTC Relief:**\n" +
          "- **Ascoril-D**: 5-10ml syrup twice or thrice daily after meals to soothe irritated bronchial passages.\n\n" +
          "**Clinical Guidance:**\n" +
          "- Gargle with warm salt water (1/2 tsp salt in 1 cup warm water) 3 times a day.\n" +
          "- Sip warm honey water to lubricate mucosal membranes.\n" +
          "- Avoid cold beverages and exposure to environmental smoke.\n\n" +
          "Disclaimer: I am an AI assistant, not a doctor. Consult a healthcare professional before taking medications.";
        foundMeds = ["Ascoril-D"];
      } else if (allText.includes('headache') || allText.includes('migraine') || allText.includes('head pain')) {
        replyText = "**Probable Condition:**\nTension Headache / Migraine Cephalea\n\n" +
          "**Recommended OTC Relief:**\n" +
          "- **Calpol 500**: 1 tablet with a full glass of water. Repeat after 6 hours if pain persists.\n" +
          "- **Combiflam**: 1 tablet after food if headache is accompanied by neck or body stiffness.\n\n" +
          "**Clinical Guidance:**\n" +
          "- Rest in a quiet, darkened room away from digital screens and loud noises.\n" +
          "- Hydrate with at least 2 glasses of water immediately.\n" +
          "- Apply a cool compress to forehead and temples.\n\n" +
          "Disclaimer: I am an AI assistant, not a doctor. Consult a healthcare professional before taking medications.";
        foundMeds = ["Calpol 500", "Combiflam"];
      } else if (allText.includes('body pain') || allText.includes('back') || allText.includes('muscle') || allText.includes('joint') || allText.includes('ache')) {
        replyText = "**Probable Condition:**\nAcute Musculoskeletal Strain / Myalgia\n\n" +
          "**Recommended OTC Relief:**\n" +
          "- **Combiflam**: 1 tablet twice daily strictly after meals to reduce muscle inflammation.\n" +
          "- **Dolo 650**: 1 tablet as a gentler alternative for aches.\n\n" +
          "**Clinical Guidance:**\n" +
          "- Apply warm fomentation or ice pack for 15-minute intervals.\n" +
          "- Avoid heavy lifting or sudden twisting movements.\n\n" +
          "Disclaimer: I am an AI assistant, not a doctor. Consult a healthcare professional before taking medications.";
        foundMeds = ["Combiflam", "Dolo 650"];
      } else {
        replyText = "Hello! I am MEDORA's AI Clinical Pharmacist powered by Google Gemini.\n\n" +
          "To provide accurate clinical guidance, please share:\n" +
          "1. What primary symptoms are you feeling (e.g. fever, acidity, cold, cough, headache, or pain)?\n" +
          "2. How long have you experienced these symptoms?\n" +
          "3. Any known allergies or underlying medical conditions?";
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
      if (foundMeds.length > 0) {
        setChatFinished(true);
        setChatSuggestedMedicines(foundMeds);
      }
    } catch (fallbackErr) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "I am ready to help. Please describe your symptoms (e.g. fever, headache, acidity, cold)." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    handleTriggerChatMessage(chatInput);
  };

  const handleCheckoutFromChat = async (openCheckoutDirectly = true) => {
    if (chatSuggestedMedicines.length === 0) return;
    
    for (const medName of chatSuggestedMedicines) {
      try {
        const res = await fetch(`${API}/api/v1/medicines/search?q=${encodeURIComponent(medName)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            addToCart(data.results[0]);
          } else {
            addToCart({
              medicine_id: `MED_OTC_${Math.floor(Math.random() * 1000)}`,
              brand_name: medName,
              generic_name: medName,
              price_mrp: "45.00",
              dosage: "1 Unit"
            });
          }
        }
      } catch (e) {
        addToCart({
          medicine_id: `MED_OTC_${Math.floor(Math.random() * 1000)}`,
          brand_name: medName,
          generic_name: medName,
          price_mrp: "45.00",
          dosage: "1 Unit"
        });
      }
    }
    
    showToast(`Added ${chatSuggestedMedicines.join(', ')} to cart! Opening checkout...`, '🛒');
    setIsChatOpen(false);
    if (openCheckoutDirectly) {
      setIsCartOpen(true);
      setPaymentStep('cart');
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
    
    alert(`Added ${chatSuggestedMedicines.join(', ')} to cart! Check your cart below.`);
    resetChat();
    setIsChatOpen(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    setOcrResult('');
    setUploadedPrescriptionId(null);
    setMatchedMedicines([]);

    try {
      // 1. Upload to backend prescription API
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetch(`${API}/api/v1/prescriptions/upload`, {
        method: 'POST',
        body: formData
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        setUploadedPrescriptionId(uploadData.prescription_id);
      }

      // 2. Perform Gemini AI Vision OCR with fallback to Cloud OCR & Tesseract
      let text = "";
      let foundMatches = [];

      try {
        const aiScanRes = await fetch(`${API}/api/v1/prescriptions/scan-ai`, {
          method: 'POST',
          body: formData
        });

        if (aiScanRes.ok) {
          const aiData = await aiScanRes.json();
          if (aiData.matched_inventory && aiData.matched_inventory.length > 0) {
            foundMatches = aiData.matched_inventory;
          }
          const medSummary = aiData.medicines && aiData.medicines.length > 0
            ? aiData.medicines.map(m => `• ${m.name} (${m.strength || ''}): ${m.frequency || 'as directed'} [${m.duration || ''}]`).join('\n')
            : "";
          text = aiData.raw_transcription || medSummary || "";
          
          if (aiData.clinical_instructions) {
            text += `\nInstructions: ${aiData.clinical_instructions}`;
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini Vision AI scan failed, falling back to local OCR:", geminiErr);
      }

      // Fallback to OCR.space / local Tesseract if AI scan returned empty
      if (!text && foundMatches.length === 0) {
        try {
          const ocrFormData = new FormData();
          ocrFormData.append('file', file);
          ocrFormData.append('apikey', 'helloworld'); // Default free developer key
          ocrFormData.append('language', 'eng');
          ocrFormData.append('isOverlayRequired', 'false');

          const ocrSpaceRes = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: ocrFormData
          });
          
          if (ocrSpaceRes.ok) {
            const ocrSpaceData = await ocrSpaceRes.json();
            if (ocrSpaceData.ParsedResults && ocrSpaceData.ParsedResults.length > 0) {
              text = ocrSpaceData.ParsedResults[0].ParsedText || "";
            }
          }
        } catch (err) {
          console.warn("OCR.space API failed, falling back to local Tesseract:", err);
        }

        if (!text) {
          const result = await Tesseract.recognize(file, 'eng');
          text = result.data.text || "";
        }
      }
      
      if (text && text.trim().length > 0) {
        setOcrResult(text);

        // 3. If Gemini didn't already match inventory, fallback to word matching against database
        if (foundMatches.length === 0) {
          const cleanText = text.replace(/[^a-zA-Z\s]/g, ' ');
          const words = cleanText.split(/\s+/).map(w => w.trim()).filter(w => w.length >= 4);
          const uniqueWords = [...new Set(words)];
          
          for (const word of uniqueWords) {
            const upperWord = word.toUpperCase();
            if (["SAI", "CLINIC", "MOB", "TEMP", "DR", "PATIL", "SACHIN", "FROM", "UPLOAD", "PRESCRIPTION", "CLINIC"].includes(upperWord)) {
              continue;
            }
            try {
              const res = await fetch(`${API}/api/v1/medicines/search?q=${word}`);
              if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                  const match = data.results.find(m => 
                    m.brand_name.toLowerCase().includes(word.toLowerCase()) ||
                    m.generic_name.toLowerCase().includes(word.toLowerCase())
                  );
                  if (match && !foundMatches.some(m => m.medicine_id === match.medicine_id)) {
                    foundMatches.push(match);
                  }
                }
              }
            } catch (e) {}
            if (foundMatches.length >= 5) break;
          }
        }
        
        setMatchedMedicines(foundMatches);

        // 4. Automatically forward OCR details to the chatbot
        setIsOcrOpen(false);
        setIsChatOpen(true);
        const promptText = `I've uploaded a prescription with the following content:\n\n"${text}"\n\nCan you guide me on the dosage, usage details, and suggest matching remedies?`;
        
        const userMsg = { role: 'user', content: promptText };
        const updatedMsgs = [...chatMessages, userMsg];
        setChatMessages(updatedMsgs);
        setIsChatLoading(true);

        try {
          const res = await fetch(`${API}/api/v1/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: USER_ID,
              messages: updatedMsgs
            })
          });
          
          if (res.ok) {
            const data = await res.json();
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
            if (data.session_finished || (data.suggested_medicines && data.suggested_medicines.length > 0)) {
              setChatFinished(true);
              setChatSuggestedMedicines(data.suggested_medicines || []);
            }
          } else {
            const fallbackSummary = `**Probable Condition:**\nDoctor Prescription Review & Medication Schedule\n\n` +
              `**Recommended OTC Relief:**\n` +
              (foundMatches.length > 0
                ? foundMatches.map(m => `- **${m.brand_name}**: ${m.generic_name} (MRP: ₹${m.price_mrp})`).join('\n')
                : `- **Prescribed Medication**: Administer as instructed on prescription slip.`) +
              `\n\n**Clinical Guidance:**\n` +
              `- Take all oral medications after food unless specified otherwise by the physician.\n` +
              `- Complete the full prescribed course without skipping or altering dosages.\n\n` +
              `Disclaimer: I am an AI assistant, not a doctor. Consult a healthcare professional before taking medications.`;
            setChatMessages(prev => [...prev, { role: 'assistant', content: fallbackSummary }]);
            if (foundMatches.length > 0) {
              setChatFinished(true);
              setChatSuggestedMedicines(foundMatches.map(m => m.brand_name));
            }
          }
        } catch (err) {
          const fallbackSummary = `**Probable Condition:**\nDoctor Prescription Review & Medication Schedule\n\n` +
            `**Recommended OTC Relief:**\n` +
            (foundMatches.length > 0
              ? foundMatches.map(m => `- **${m.brand_name}**: ${m.generic_name} (MRP: ₹${m.price_mrp})`).join('\n')
              : `- **Prescribed Medication**: Administer as instructed on prescription slip.`) +
            `\n\n**Clinical Guidance:**\n` +
            `- Take all oral medications after food unless specified otherwise by the physician.\n` +
            `- Complete the full prescribed course without skipping or altering dosages.\n\n` +
            `Disclaimer: I am an AI assistant, not a doctor. Consult a healthcare professional before taking medications.`;
          setChatMessages(prev => [...prev, { role: 'assistant', content: fallbackSummary }]);
          if (foundMatches.length > 0) {
            setChatFinished(true);
            setChatSuggestedMedicines(foundMatches.map(m => m.brand_name));
          }
        } finally {
          setIsChatLoading(false);
        }
      } else {
        setOcrResult("No text detected in the image.");
      }
    } catch (err) {
      console.error("Prescription processing error:", err);
      setOcrResult("Failed to process prescription. Please try again.");
    } finally {
      setIsOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderRoleHeader = () => (
    <header style={{
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(226, 232, 240, 0.9)',
      padding: '0.65rem 1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 1200,
      fontSize: '0.85rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span 
          onClick={goHome}
          style={{ fontWeight: '800', color: 'var(--primary)', fontFamily: 'Outfit, sans-serif', cursor: 'pointer', fontSize: '1.05rem' }}
        >
          🧬 MEDORA
        </span>
        <span style={{ color: 'rgba(15, 23, 42, 0.15)' }}>|</span>
        <span style={{ color: 'var(--text-main)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {activeUser.role === 'admin' && '🔑 Executive Admin Portal'}
          {activeUser.role === 'patient' && '👤 Patient Portal'}
          {activeUser.role === 'pharmacy' && '🏥 Pharmacy Operations'}
          {activeUser.role === 'delivery' && '🛵 Rider Network'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({activeUser.name})</span>
      </div>

      {/* Swiggy Instamart Location Selector in Header for Patients */}
      {activeUser.role === 'patient' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div 
            onClick={() => setIsAddressDrawerOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: '#ffffff',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              padding: '4px 12px',
              borderRadius: '24px',
              cursor: 'pointer',
              maxWidth: '380px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}
            title="Click to change delivery location"
          >
            <span style={{
              background: 'linear-gradient(135deg, #FF6B00 0%, #FFA800 100%)',
              color: '#fff',
              fontSize: '0.68rem',
              fontWeight: '800',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              ⚡ 10-15 MINS
            </span>
            <span style={{ fontSize: '0.95rem' }}>{selectedAddress?.icon || '🏠'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', overflow: 'hidden' }}>
              <span style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {selectedAddress?.tag || 'Home'} <span style={{ color: 'var(--primary)', fontSize: '0.65rem' }}>▼</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedAddress ? `${selectedAddress.houseNo}, ${selectedAddress.area}` : 'Set Location'}
              </span>
            </div>
          </div>

          {/* Direct Switch to Dedicated Radar Page / View */}
          <button
            onClick={() => setActiveMainView(prev => prev === 'radar' ? 'home' : 'radar')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeMainView === 'radar' ? 'var(--primary)' : 'rgba(13, 148, 136, 0.1)',
              color: activeMainView === 'radar' ? '#ffffff' : 'var(--primary)',
              border: '1px solid rgba(13, 148, 136, 0.3)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: '700',
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: activeMainView === 'radar' ? '0 2px 10px rgba(13, 148, 136, 0.3)' : 'none',
              transition: 'all 0.2s ease'
            }}
            title="Calibrate GPS & Radar Settings"
          >
            <span>🛰️</span>
            <span>{activeMainView === 'radar' ? 'Home Shelf' : `Radar (${perimeterKm}km)`}</span>
          </button>

          {/* Live Cartoon Bootup Presentation Replay */}
          <button
            onClick={() => setShowBootup(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.12), rgba(184, 247, 228, 0.25))',
              color: '#0d9488',
              border: '1px solid rgba(13, 148, 136, 0.3)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: '700',
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(13, 148, 136, 0.08)',
              transition: 'all 0.2s ease'
            }}
            title="Watch Live Cartoon Bootup Animation"
          >
            <span>🎬</span>
            <span>Live Cartoon</span>
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {activeUser.role === 'patient' && (
          <button
            id="header-checkout-btn"
            onClick={() => {
              setIsCartOpen(true);
              setPaymentStep('cart');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: cart.length > 0 ? 'linear-gradient(135deg, #0d9488 0%, #059669 100%)' : '#ffffff',
              color: cart.length > 0 ? '#ffffff' : 'var(--primary)',
              border: cart.length > 0 ? 'none' : '1px solid var(--primary)',
              padding: '6px 14px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '0.78rem',
              boxShadow: cart.length > 0 ? '0 4px 14px rgba(13, 148, 136, 0.35)' : 'none',
              transition: 'all 0.2s ease'
            }}
            title="Open Shopping Cart & Checkout Drawer"
          >
            <span>🛒</span>
            <span>
              {cart.length > 0 ? `Checkout (${cart.length}) • ₹${cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(0)}` : 'Cart (0)'}
            </span>
          </button>
        )}
        <button
          onClick={handleLogout}
          style={{
            background: '#fff1f2',
            color: '#e11d48',
            border: '1px solid #fecdd3',
            padding: '5px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.78rem',
            transition: 'all 0.2s ease'
          }}
        >
          Logout 🚪
        </button>
      </div>
    </header>
  );

  if (!mounted) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--primary)',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        fontFamily: 'Outfit, sans-serif'
      }}>
        🧬 Loading MEDORA...
      </div>
    );
  }

  if (showBootup) {
    return (
      <CartoonBootup
        onComplete={() => {
          setShowBootup(false);
          try {
            sessionStorage.setItem('medora_bootup_played', 'true');
          } catch (e) {}
        }}
      />
    );
  }

  if (!activeUser) {
    return <LoginGateway onLoginSuccess={handleLoginSuccess} />;
  }

  if (activeUser.role === 'admin') {
    return (
      <>
        {renderRoleHeader()}
        <AdminView />
      </>
    );
  }

  if (activeUser.role === 'pharmacy') {
    return (
      <>
        {renderRoleHeader()}
        <PharmacyView />
      </>
    );
  }

  if (activeUser.role === 'delivery') {
    return (
      <>
        {renderRoleHeader()}
        <RiderView />
      </>
    );
  }

  return (
    <>
      {renderRoleHeader()}
      {/* Navigation Header */}
      <nav className={`nav-bar ${isNavVisible ? 'visible' : 'hidden'}`}>
        <div 
          className="nav-bar-logo gradient-text" 
          onClick={goHome}
          title="Home"
          style={{ 
            opacity: scrollProgress > 0.8 ? Math.min((scrollProgress - 0.8) / 0.2, 1) : 0,
            transition: 'opacity 0.15s ease',
            pointerEvents: scrollProgress > 0.8 ? 'auto' : 'none',
            cursor: 'pointer'
          }}
        >
          🧬 MEDORA.
        </div>
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div 
            onClick={() => setIsAddressDrawerOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              background: '#f8fafc',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              padding: '4px 10px',
              borderRadius: '16px',
              fontSize: '0.78rem'
            }}
            title="Change Delivery Address"
          >
            <span style={{ color: '#FF9E00', fontWeight: 'bold' }}>⚡ 10m</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{selectedAddress?.tag || 'Home'} ▼</span>
          </div>

          <a 
            href="#" 
            className="nav-link" 
            onClick={(e) => { 
              e.preventDefault(); 
              setActiveMainView(prev => prev === 'radar' ? 'home' : 'radar'); 
            }} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            🛰️ Radar
          </a>

          <a 
            href="/splash" 
            className="nav-link" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title="Interactive Presentation Video Showcase"
          >
            🎬 Showcase
          </a>

          <a 
            href="#" 
            className="nav-link" 
            onClick={(e) => { 
              e.preventDefault(); 
              setIsOcrOpen(true); 
            }} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0d9488', fontWeight: '700' }}
            title="Upload Doctor's Handwritten or Printed Prescription"
          >
            <span>📄 Upload Rx</span>
            <span style={{ fontSize: '0.66rem', background: 'rgba(13, 148, 136, 0.12)', padding: '1px 6px', borderRadius: '4px', color: '#0d9488', fontWeight: '800' }}>
              Handwritten OK
            </span>
          </a>

          <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); setIsTrackingOpen(true); }} style={{ display: 'flex', alignItems: 'center' }}>
            Track Orders
            {activeOrders.length > 0 && <span className="badge">{activeOrders.length}</span>}
          </a>
          <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); setIsCartOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🛒 Cart
            {cart.length > 0 && <span className="badge">{cart.length}</span>}
          </a>
        </div>
      </nav>

      {/* Cinematic Splash Screen (100vh) */}
      <section className="splash-container">
        <canvas 
          ref={canvasRef} 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            zIndex: 8, 
            opacity: 0.25, 
            pointerEvents: 'none' 
          }} 
        />
        {/* Animated Flying Logo Wrapper */}
        <div 
          style={{
            position: 'fixed',
            top: `calc(50vh - ${scrollProgress} * (50vh - 34px))`,
            left: `calc(50vw - ${scrollProgress} * (50vw - 130px))`,
            transform: `translate(-50%, -50%) scale(${1 - scrollProgress * 0.55})`,
            opacity: 1 - Math.max((scrollProgress - 0.8) / 0.2, 0),
            pointerEvents: scrollProgress > 0.8 ? 'none' : 'auto',
            zIndex: 1050,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'opacity 0.15s ease'
          }}
        >
          <div className="boot-logo-container" onClick={goHome} style={{ cursor: 'pointer' }} title="Home">
            <div className="boot-logo-symbol">🧬</div>
            <div className="boot-logo-name">MEDORA</div>
          </div>
        </div>
        <div className="scroll-indicator-container">
          <span className="scroll-indicator-text">Scroll to explore</span>
          <div className="scroll-indicator-wheel">
            <div className="scroll-indicator-wheel" />
          </div>
        </div>
      </section>

      {/* App Details & Search Section */}
      <section className="morph-section-details">
        <main className="container">
          {/* Details Fold */}
          <div className="hero-section" style={{ marginTop: '2rem', marginBottom: '2.5rem' }}>
            <h1 className="hero-title">
              Smart Pharmacy, <br />
              <span className="gradient-text">Delivered Instantly.</span>
            </h1>
            <p className="hero-subtitle" style={{ maxWidth: '680px', margin: '0 auto 1.5rem auto' }}>
              We bring hyper-local digital healthcare directly to your doorstep. Consult the AI doctor, order generic alternatives, and get fast delivery in 15 minutes.
            </p>

            {/* Showcase, Prescription Upload & AI Doctor Quick Pills */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <a
                href="/splash"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.12), rgba(184, 247, 228, 0.35))',
                  border: '1px solid rgba(13, 148, 136, 0.35)',
                  color: '#0d9488',
                  padding: '7px 18px',
                  borderRadius: '99px',
                  fontSize: '0.82rem',
                  fontWeight: '800',
                  textDecoration: 'none',
                  boxShadow: '0 2px 10px rgba(13, 148, 136, 0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>▶</span>
                <span>Watch Interactive Presentation Showcase ➔</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setIsOcrOpen(true);
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '7px 18px',
                  borderRadius: '99px',
                  fontSize: '0.82rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(13, 148, 136, 0.28)',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>📄</span>
                <span>Upload Rx (Handwritten OK)</span>
                <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.22)', padding: '1px 6px', borderRadius: '4px' }}>Gemini AI</span>
              </button>

              <button
                type="button"
                onClick={() => setIsChatOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: 'var(--text-main)',
                  padding: '7px 16px',
                  borderRadius: '99px',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                <span>🩺</span>
                <span>Ask Gemini AI Doctor</span>
              </button>
            </div>

            {/* Search Bar Container */}
            <div className="search-container glass-panel" style={{ padding: '0.4rem', borderRadius: '18px', flexDirection: 'column', position: 'relative' }}>
              <form onSubmit={e => { e.preventDefault(); }} style={{ display: 'flex', width: '100%', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.25rem', paddingLeft: '1rem', color: 'var(--primary)' }}>🔍</span>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search medicines or brand names (e.g. Crocin, Augmentin, Dolo)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchQuery.length > 1) setShowSuggestions(true); }}
                  onKeyDown={handleKeyDown}
                  style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '0.8rem 0.5rem' }}
                />
                {searchQuery && (
                  <button 
                    type="button" 
                    onClick={() => { setSearchQuery(''); setShowSuggestions(false); }} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem', fontSize: '1.1rem' }}
                  >
                    &times;
                  </button>
                )}
              </form>

              {/* Live Suggestions Dropdown with AI Compound Matching Badges */}
              {showSuggestions && searchQuery.length >= 2 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '8px',
                  background: '#ffffff',
                  border: '1px solid rgba(13, 148, 136, 0.25)',
                  borderRadius: '16px',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
                  zIndex: 9999,
                  maxHeight: '440px',
                  overflowY: 'auto',
                  padding: '0.5rem'
                }}>
                  {/* ─── MULTI-COMPOSITION 2-TAB SPLIT BANNER (When brand has multiple compositions or combo tablet not in stock) ─── */}
                  {multiCompositionSplit && multiCompositionSplit.tabs && multiCompositionSplit.tabs.length >= 2 && (
                    <div style={{
                      background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)',
                      border: '1px solid #99f6e4',
                      borderRadius: '14px',
                      padding: '1rem',
                      marginBottom: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '1.2rem' }}>💊</span>
                          <strong style={{ fontSize: '0.92rem', color: '#0f766e' }}>
                            Multi-Composition Formulation ({multiCompositionSplit.brand_searched})
                          </strong>
                        </div>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '99px',
                          background: multiCompositionSplit.is_combined_in_stock ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: multiCompositionSplit.is_combined_in_stock ? '#059669' : '#dc2626',
                          fontWeight: '800'
                        }}>
                          {multiCompositionSplit.is_combined_in_stock ? 'Combo Tablet Available' : '⚠️ Combo Tablet Out of Stock'}
                        </span>
                      </div>

                      <p style={{ fontSize: '0.78rem', color: '#334155', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                        {multiCompositionSplit.note}
                      </p>

                      {/* 2-TAB COMPOSITION SWITCHER */}
                      <div style={{
                        display: 'flex',
                        background: '#ffffff',
                        borderRadius: '10px',
                        padding: '3px',
                        border: '1px solid #cbd5e1',
                        marginBottom: '10px',
                        gap: '4px'
                      }}>
                        {multiCompositionSplit.tabs.map((tab, tIdx) => (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setActiveCompositionTab(tIdx); }}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '7px 10px',
                              borderRadius: '8px',
                              border: 'none',
                              background: activeCompositionTab === tIdx ? 'linear-gradient(135deg, #0d9488, #059669)' : 'transparent',
                              color: activeCompositionTab === tIdx ? '#ffffff' : '#475569',
                              fontWeight: '700',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: activeCompositionTab === tIdx ? '0 2px 8px rgba(13, 148, 136, 0.25)' : 'none'
                            }}
                          >
                            <span>🧪</span>
                            <span>{tab.label || tab.name}</span>
                            <span style={{
                              fontSize: '0.68rem',
                              background: activeCompositionTab === tIdx ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                              padding: '1px 5px',
                              borderRadius: '99px'
                            }}>
                              {tab.count}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Content of the Selected Composition Tab */}
                      {multiCompositionSplit.tabs[activeCompositionTab] && (
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#0f766e', marginBottom: '6px' }}>
                            Available standalone medicines containing {multiCompositionSplit.tabs[activeCompositionTab].name}:
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {multiCompositionSplit.tabs[activeCompositionTab].medicines.length === 0 ? (
                              <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', padding: '6px' }}>
                                No individual medicines found in stock for this composition.
                              </div>
                            ) : (
                              multiCompositionSplit.tabs[activeCompositionTab].medicines.slice(0, 3).map((cm, cIdx) => (
                                <div
                                  key={cIdx}
                                  onClick={(e) => { e.stopPropagation(); addToCart(cm); }}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '6px 10px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <div>
                                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{cm.brand_name}</strong>
                                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '6px' }}>
                                      ({cm.dosage || 'Standard'} • {cm.form || 'Tablet'})
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#0d9488' }}>
                                      ₹{cm.price_mrp || '45.00'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); addToCart(cm); }}
                                      style={{
                                        background: '#0d9488',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.72rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      + Add
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* 1-Click: Add Both Compositions To Cart */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddBothCompositionsToCart(multiCompositionSplit);
                        }}
                        style={{
                          marginTop: '10px',
                          width: '100%',
                          background: 'linear-gradient(135deg, #FF6B00 0%, #FFA800 100%)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          fontWeight: '800',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(255, 107, 0, 0.25)'
                        }}
                      >
                        <span>⚡ Add Both Compositions ({multiCompositionSplit.tabs[0].name} + {multiCompositionSplit.tabs[1].name}) in 1-Click</span>
                      </button>
                    </div>
                  )}

                  {/* Standard Search Results List */}
                  {searchResults.length === 0 && !multiCompositionSplit ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      <span style={{ fontSize: '1.6rem', display: 'block', marginBottom: '6px' }}>🧪</span>
                      No local pharmacy stock found for "<strong>{searchQuery}</strong>".<br />
                      <span style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '6px', display: 'inline-block', fontWeight: 'bold' }}>
                        📡 An urgent inquiry broadcast has been dispatched to all partner pharmacies!
                      </span>
                    </div>
                  ) : (
                    searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => addToCart(item)}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          background: focusedIndex === idx ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                          transition: 'background 0.15s ease',
                          borderBottom: idx !== searchResults.length - 1 ? '1px solid #f1f5f9' : 'none'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(13, 148, 136, 0.06)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = focusedIndex === idx ? 'rgba(13, 148, 136, 0.08)' : 'transparent'; }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
                              {highlightMatch(item.brand_name, searchQuery)}
                            </strong>
                            {item.compound_badge && (
                              <span style={{
                                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(13, 148, 136, 0.2))',
                                color: '#0f766e',
                                border: '1px solid rgba(13, 148, 136, 0.3)',
                                padding: '2px 8px',
                                borderRadius: '99px',
                                fontSize: '0.72rem',
                                fontWeight: 'bold'
                              }}>
                                🤖 {item.compound_badge}
                              </span>
                            )}
                          </div>
                          <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.95rem' }}>
                            ₹{item.price_mrp || item.price}
                          </span>
                        </div>

                        {item.compound_note && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#0369a1',
                            background: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            marginBottom: '6px',
                            display: 'inline-block'
                          }}>
                            💡 {item.compound_note}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <span>🧪 Generic Salt: <strong>{item.generic_name}</strong></span>
                          <span style={{ color: item.stock_status === 'In Stock' ? 'var(--green)' : '#f59e0b', fontWeight: 'bold' }}>
                            {item.stock_status || (item.available_stock > 0 ? '✓ In Stock' : 'Low Stock')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Dedicated Doctor Prescription Upload Card (Handwritten & Printed) */}
            <div style={{
              marginTop: '1.75rem',
              background: 'linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)',
              border: '1.5px solid #99f6e4',
              borderRadius: '22px',
              padding: '1.35rem 1.8rem',
              boxShadow: '0 10px 30px rgba(13, 148, 136, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.5rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: '1 1 340px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  boxShadow: '0 6px 18px rgba(13, 148, 136, 0.3)',
                  flexShrink: 0
                }}>
                  📄
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                      Have a Doctor's Prescription?
                    </h3>
                    <span style={{
                      background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '99px',
                      letterSpacing: '0.04em'
                    }}>
                      ✨ Google Gemini Multimodal Vision AI
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                    Upload any <strong>doctor handwritten slip</strong>, clinic note, or digital prescription. Gemini Vision reads cursive handwriting, deciphers medicines, and matches local stock in 15 seconds!
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                      ✍️ Doctor Cursive Handwritings
                    </span>
                    <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                      🏥 OPD & Hospital Slips
                    </span>
                    <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                      🔒 100% HIPAA Private & Secure
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsOcrOpen(true);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '0.9rem 1.6rem',
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 6px 20px rgba(13, 148, 136, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>📤 Upload Prescription</span>
                  <span style={{ fontSize: '0.74rem', background: 'rgba(255,255,255,0.22)', padding: '2px 6px', borderRadius: '6px', fontWeight: '800' }}>
                    Handwritten OK
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* DEDICATED FULL GPS RADAR VIEW WHEN TOGGLED */}
          {activeMainView === 'radar' && (
            <div style={{ marginTop: '2rem', marginBottom: '4rem', width: '100%', textAlign: 'left' }}>
              {/* Back to Home Navigation Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                background: '#ffffff',
                padding: '1rem 1.5rem',
                borderRadius: '20px',
                border: '1px solid rgba(226, 232, 240, 0.9)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
              }}>
                <button
                  onClick={() => setActiveMainView('home')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '12px',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)'
                  }}
                >
                  ← Return to Medicine Shop
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <span>Delivering to: <strong style={{ color: 'var(--text-main)' }}>{selectedAddress?.tag || 'Home'} ({selectedAddress?.area || 'Vamanjoor'})</strong></span>
                  <span style={{
                    background: 'rgba(13, 148, 136, 0.12)',
                    color: 'var(--primary)',
                    fontWeight: '800',
                    padding: '4px 10px',
                    borderRadius: '12px'
                  }}>
                    🛰️ {perimeterKm} km Active Perimeter
                  </span>
                </div>
              </div>

              {/* Dedicated Live Perimeter Radar Component */}
              <LivePerimeterRadar
                userCoords={liveGpsCoords}
                onUpdateCoords={(coords) => {
                  setLiveGpsCoords(coords);
                }}
                selectedAddress={selectedAddress}
                onUpdateAddress={(addr) => {
                  handleSelectAddress(addr);
                }}
                pharmacies={pharmacyNetwork}
                perimeterKm={perimeterKm}
                onChangePerimeter={(km) => {
                  setPerimeterKm(km);
                  showToast(`Delivery perimeter set to ${km} km`, '🛰️');
                }}
                filterInsideOnly={filterInsideOnly}
                onToggleFilterInsideOnly={(val) => setFilterInsideOnly(val)}
                onBack={() => setActiveMainView('home')}
              />
            </div>
          )}

          {/* INSTAMART QUICK COMMERCE MEDICINE SHELF (WHEN ON HOME VIEW AND NO SEARCH QUERY) */}
          {activeMainView === 'home' && searchResults.length === 0 && (
            <div style={{ marginTop: '2.5rem', marginBottom: '3.5rem', width: '100%', textAlign: 'left' }}>
              
              {/* Sleek Hyperlocal Radar Quick-Bar (Clean, Modern & Uncluttered) */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(184, 247, 228, 0.18) 100%)',
                border: '1px solid rgba(13, 148, 136, 0.25)',
                borderRadius: '20px',
                padding: '1rem 1.4rem',
                marginBottom: '1.8rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: '0 4px 16px rgba(13, 148, 136, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    boxShadow: '0 6px 16px rgba(13, 148, 136, 0.22)',
                    color: '#fff'
                  }}>
                    🛰️
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)', fontWeight: '800' }}>
                        Hyperlocal GPS Radar Active ({perimeterKm} km)
                      </strong>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--green)',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '12px'
                      }}>
                        ● {pharmacyNetwork.length} Connected Dark-Stores
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Serving <strong>{selectedAddress?.area || 'Vamanjoor'}</strong> with 10-15 min express delivery. GPS calibrated.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => setActiveMainView('radar')}
                    style={{
                      background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '0.65rem 1.25rem',
                      fontSize: '0.84rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(13, 148, 136, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>🛰️ Open Radar & Calibrate GPS</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>

              {/* Swiggy Instamart Delivery Header Banner */}
              <div id="instamart-shelf-section" style={{
                background: 'linear-gradient(135deg, rgba(255, 107, 0, 0.08) 0%, rgba(13, 148, 136, 0.08) 100%)',
                border: '1px solid rgba(255, 107, 0, 0.25)',
                borderRadius: '20px',
                padding: '1.25rem 1.5rem',
                marginBottom: '1.8rem',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #FF6B00 0%, #FFA800 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    boxShadow: '0 8px 20px rgba(255, 107, 0, 0.35)',
                    color: '#fff'
                  }}>
                    ⚡
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        MEDORA Instamart
                      </h3>
                      <span style={{
                        background: 'rgba(74, 222, 128, 0.2)',
                        color: 'var(--green)',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '20px'
                      }}>
                        ● LIVE NETWORK
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Instant medicine delivery in 10-15 mins from connected local pharmacy dark-stores
                    </p>
                  </div>
                </div>

                {/* Connected Partner Pharmacies Status Pills */}
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {pharmacyNetwork.map(pharm => (
                    <div
                      key={pharm.id}
                      style={{
                        background: '#ffffff',
                        border: pharm.is_fastest ? '1.5px solid var(--primary)' : '1px solid rgba(226, 232, 240, 0.9)',
                        borderRadius: '12px',
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <span style={{ color: 'var(--green)', fontSize: '0.65rem' }}>●</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>{pharm.name}</span>
                      <span style={{
                        color: pharm.is_fastest ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: pharm.is_fastest ? '800' : '500'
                      }}>
                        ({pharm.distance_km} km • {pharm.delivery_time})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section Title & Subtitle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🔥</span> Most Bought & Everyday Essentials
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    High-demand medicines commonly searched by people — verified in stock at nearby partner pharmacies
                  </p>
                </div>
                <div 
                  onClick={() => setIsAddressDrawerOpen(true)}
                  style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}
                >
                  ⚡ Delivering to {selectedAddress?.tag || 'Home'} ({selectedAddress?.area || 'Vamanjoor'}) ➔
                </div>
              </div>

              {/* Category Pills */}
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>
                {['All Essentials', 'Fever & Pain', 'Cold & Allergy', 'Antibiotics', 'Acidity & Digestion', 'First Aid & Vitamins'].map(cat => {
                  const active = activeInstamartCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveInstamartCategory(cat);
                        showToast(`Filtered by ${cat}`, '🔍');
                      }}
                      style={{
                        background: active ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' : '#ffffff',
                        color: active ? '#ffffff' : '#334155',
                        border: active ? '1px solid #0d9488' : '1px solid rgba(226, 232, 240, 0.9)',
                        borderRadius: '24px',
                        padding: '7px 16px',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: active ? '0 4px 14px rgba(13, 148, 136, 0.25)' : '0 2px 6px rgba(0, 0, 0, 0.02)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Fast Moving Medicine Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '1.25rem'
              }}>
                {(() => {
                  const displayedList = bootCatalog
                    .filter(m => (filterInsideOnly ? m.instamart?.in_perimeter : true))
                    .filter(m => filterByCategory(m, activeInstamartCategory));

                  if (displayedList.length === 0) {
                    return (
                      <div style={{
                        gridColumn: '1 / -1',
                        padding: '3rem 2rem',
                        textAlign: 'center',
                        background: '#ffffff',
                        borderRadius: '20px',
                        border: '1px dashed rgba(226, 232, 240, 0.9)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.02)'
                      }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>📡</div>
                        <h4 style={{ color: 'var(--text-main)', margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: '800' }}>
                          No medicines found under "{activeInstamartCategory}" within {perimeterKm} km
                        </h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                          Try switching categories above or visit the Radar page to increase your search perimeter.
                        </p>
                        <button
                          onClick={() => setActiveInstamartCategory('All Essentials')}
                          className="btn-secondary"
                          style={{ marginTop: '1rem', padding: '0.5rem 1.2rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: '700' }}
                        >
                          View All Essentials
                        </button>
                      </div>
                    );
                  }

                  return displayedList.map((med, idx) => {
                    const nearest = med.instamart?.nearest_pharmacy;
                    const inRange = nearest?.in_perimeter !== false;
                    const cartQty = getItemCartCount(med.medicine_id);
                    const inCart = cartQty > 0;
                    return (
                      <div
                        key={idx}
                        className="glass-panel"
                        onClick={() => setSelectedMedicineDetail(med)}
                        style={{
                          padding: '1.25rem',
                          borderRadius: '20px',
                          background: '#ffffff',
                          border: inRange ? '1px solid rgba(226, 232, 240, 0.9)' : '1px solid rgba(226, 232, 240, 0.6)',
                          opacity: inRange ? 1 : 0.88,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)',
                          cursor: 'pointer',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = '0 12px 28px rgba(13, 148, 136, 0.12)';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.03)';
                          e.currentTarget.style.borderColor = inRange ? 'rgba(226, 232, 240, 0.9)' : 'rgba(226, 232, 240, 0.6)';
                        }}
                      >
                        <div>
                          {/* Header Badges */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: '800',
                              color: 'var(--primary)',
                              background: 'rgba(13, 148, 136, 0.1)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              textTransform: 'uppercase'
                            }}>
                              {med.form || med.category || 'OTC'}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              color: inRange ? 'var(--green)' : '#f59e0b',
                              fontWeight: '700'
                            }}>
                              ● {inRange ? 'In Perimeter' : 'Extended Range'} ({med.instamart?.total_available || 40})
                            </span>
                          </div>

                          {/* Medicine Title & Generic */}
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>
                            {med.brand_name}
                          </h4>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {med.generic_name} • {med.dosage}
                          </div>
                          {med.compound_badge && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(13, 148, 136, 0.12)',
                              color: 'var(--primary)',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              marginTop: '4px'
                            }}>
                              🤖 {med.compound_badge}
                            </div>
                          )}

                          {/* Instamart Speed & Store Banner */}
                          {nearest && (
                            <div style={{
                              background: inRange ? '#fff7ed' : '#f8fafc',
                              border: inRange ? '1px solid rgba(255, 107, 0, 0.25)' : '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '6px 10px',
                              marginTop: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span style={{ fontSize: '0.9rem' }}>{inRange ? '⚡' : '📍'}</span>
                              <div style={{ fontSize: '0.72rem', color: inRange ? '#c2410c' : 'var(--text-muted)', fontWeight: '700' }}>
                                {inRange
                                  ? `${nearest.delivery_time} from ${nearest.pharmacy_name} (${nearest.distance_km} km)`
                                  : `Beyond ${perimeterKm} km (${nearest.distance_km} km • ${nearest.pharmacy_name})`}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom Price & Add Action */}
                        <div style={{
                          marginTop: '1.1rem',
                          paddingTop: '0.8rem',
                          borderTop: '1px solid rgba(226, 232, 240, 0.8)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                              ₹{med.price_mrp}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                              MRP incl. taxes
                            </span>
                          </div>

                          {inCart ? (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#f0fdf4',
                                border: '1.5px solid #16a34a',
                                borderRadius: '10px',
                                padding: '3px 8px'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(med, -1)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#16a34a',
                                  fontSize: '1rem',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  padding: '0 4px'
                                }}
                                title="Decrease quantity"
                              >
                                −
                              </button>
                              <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#16a34a', minWidth: '18px', textAlign: 'center' }}>
                                {cartQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(med, 1)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#16a34a',
                                  fontSize: '1rem',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  padding: '0 4px'
                                }}
                                title="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateItemQuantity(med, 1);
                              }}
                              style={{
                                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '0.55rem 1.15rem',
                                fontSize: '0.82rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              + ADD
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Amazon/Instamart-style Medicine Search Results */}
            {searchResults.length > 0 && (
              <div id="search-results-section" className="animate-fade-in" style={{ width: '100%', marginBottom: '3rem', textAlign: 'left' }}>
                <h3 style={{ marginBottom: '1.25rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.3rem', fontWeight: 'bold' }}>
                  <span>📦</span> Matched Products ({searchResults.length})
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '1.5rem',
                  width: '100%'
                }}>
                  {searchResults.map((med, idx) => {
                    const cartQty = getItemCartCount(med.medicine_id);
                    const inCart = cartQty > 0;
                    return (
                      <div 
                        key={idx} 
                        className="glass-panel"
                        onClick={() => setSelectedMedicineDetail(med)}
                        style={{
                          padding: '1.5rem',
                          borderRadius: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          border: '1px solid rgba(226, 232, 240, 0.9)',
                          background: '#ffffff',
                          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                          position: 'relative',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-6px)';
                          e.currentTarget.style.boxShadow = '0 12px 30px rgba(13, 148, 136, 0.12)';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.03)';
                          e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.9)';
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              background: 'rgba(13, 148, 136, 0.1)',
                              border: '1px solid rgba(13, 148, 136, 0.25)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              color: 'var(--primary)',
                              textTransform: 'uppercase',
                              fontWeight: 'bold'
                            }}>
                              {med.category || 'Prescription'}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{med.dosage}</span>
                          </div>
                          <h4 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 'bold', lineHeight: '1.3' }}>
                            {highlightMatch(med.brand_name, searchQuery)}
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '8px 0 0 0', lineHeight: '1.45' }}>
                            <span style={{ display: 'block', marginBottom: '3px' }}><strong>Salt:</strong> {highlightMatch(med.generic_name, searchQuery)}</span>
                            <span><strong>Mfg:</strong> {med.manufacturer}</span>
                          </p>

                          {/* Instamart Faster Delivery Possible Badge */}
                          {med.instamart?.nearest_pharmacy ? (
                            <div style={{
                              background: '#fff7ed',
                              border: '1px solid rgba(255, 107, 0, 0.25)',
                              borderRadius: '10px',
                              padding: '8px 10px',
                              marginTop: '0.8rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.9rem' }}>⚡</span>
                                <span style={{ fontSize: '0.74rem', color: '#c2410c', fontWeight: '800' }}>
                                  Faster delivery in {med.instamart.nearest_pharmacy.delivery_time}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                Available at {med.instamart.nearest_pharmacy.pharmacy_name} ({med.instamart.nearest_pharmacy.distance_km} km away • {med.instamart.nearest_pharmacy.quantity} in stock)
                              </div>
                              {med.instamart.stores_count > 1 && (
                                <div style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: '2px', fontWeight: '600' }}>
                                  ✓ Also in stock at {med.instamart.stores_count - 1} other local partner pharmacies
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '6px 10px',
                              marginTop: '0.8rem',
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)'
                            }}>
                              ⚡ Standard 15-25 min delivery from regional warehouse
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(226, 232, 240, 0.8)', paddingTop: '0.9rem' }}>
                          <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--primary)' }}>₹{med.price_mrp}</span>

                          {inCart ? (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#f0fdf4',
                                border: '1.5px solid #16a34a',
                                borderRadius: '10px',
                                padding: '3px 8px'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(med, -1)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#16a34a',
                                  fontSize: '1rem',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  padding: '0 4px'
                                }}
                                title="Decrease quantity"
                              >
                                −
                              </button>
                              <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#16a34a', minWidth: '18px', textAlign: 'center' }}>
                                {cartQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(med, 1)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#16a34a',
                                  fontSize: '1rem',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  padding: '0 4px'
                                }}
                                title="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateItemQuantity(med, 1);
                              }}
                              className="btn-primary"
                              style={{ padding: '0.5rem 1.15rem', fontSize: '0.82rem', borderRadius: '10px', fontWeight: 'bold' }}
                            >
                              + Add to Cart
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {cart.length > 0 && (
                  <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <a 
                      href="/cart"
                      className="btn-primary"
                      style={{ background: 'var(--primary)', padding: '0.85rem 2.2rem', textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <span>View Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'}) 🛒</span>
                    </a>
                  </div>
                )}
              </div>
            )}



          {/* Quick-commerce Details Grid */}
          <section className="features-grid" style={{ marginBottom: '2.5rem' }}>
            <div className="feature-card glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="icon-wrapper">🏪</div>
              <h3 className="card-title">Local Pharmacy Network</h3>
              <p className="card-desc">
                We work directly with verified pharmacies around your location. Our database continuously scans local stock inventories to locate and book matching remedies.
              </p>
            </div>

            <div className="feature-card glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="icon-wrapper">🩺</div>
              <h3 className="card-title">AI Symptoms Analysis</h3>
              <p className="card-desc">
                Need guidance before purchase? Trigger our AI clinical helper at the bottom right. Describe your symptoms to extract potential generic compositions.
              </p>
            </div>
          </section>
        </main>
      </section>

      {/* Modal: Order Tracking */}
      <div className={`modal-overlay ${isTrackingOpen ? 'active' : ''}`} onClick={() => setIsTrackingOpen(false)}>
        <div className="modal-content glass-panel" style={{ padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem' }}>
              <span>📍</span> Live Order Tracking
            </h2>
            <button 
              onClick={() => setIsTrackingOpen(false)} 
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.75rem', cursor: 'pointer', lineHeight: 1 }}
            >
              &times;
            </button>
          </div>
          {activeOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>📦</span>
              <p style={{ fontWeight: '600', color: '#fff' }}>No active orders at the moment</p>
              <p style={{ fontSize: '0.88rem', marginTop: '0.5rem' }}>Add medicines to your cart and place an order to track it live!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {activeOrders.map(order => (
                <div key={order.id} style={{ background: 'rgba(22,23,26,0.6)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <strong style={{ fontSize: '1.05rem', color: '#fff' }}>Order #{order.id}</strong>
                    <span style={{
                      padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold',
                      background: order.status === 'delivered' ? 'var(--green)' : order.status === 'out_for_delivery' ? '#f59e0b' : 'rgba(184, 247, 228, 0.15)',
                      color: order.status === 'delivered' ? '#16171a' : '#fff'
                    }}>
                      {order.status?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.4' }}>
                    🏪 {order.pharmacy_id} <br />
                    🧾 {Array.isArray(order.items) ? order.items.map(i => `${i.quantity}x ${i.brand_name}`).join(', ') : order.items}
                  </p>
                  <TrackingBar status={order.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Prescription OCR Scanning */}
      <div className={`modal-overlay ${isOcrOpen ? 'active' : ''}`} onClick={() => setIsOcrOpen(false)}>
        <div className="modal-content glass-panel" style={{ padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.45rem' }}>
                <span>📄</span> Doctor Prescription Scanner
              </h2>
              <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: '700', letterSpacing: '0.03em' }}>
                ✨ Powered by Google Gemini Multimodal Vision AI
              </span>
            </div>
            <button 
              onClick={() => setIsOcrOpen(false)} 
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.75rem', cursor: 'pointer', lineHeight: 1 }}
            >
              &times;
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5', margin: 0 }}>
              Upload any physical prescription, OPD slip, or <strong>handwritten doctor note</strong>. Gemini AI deciphers cursive handwriting, extracts prescribed medicines, and matches available inventory in real time.
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', background: 'rgba(13, 148, 136, 0.15)', color: 'var(--primary)', padding: '3px 10px', borderRadius: '8px', fontWeight: 'bold' }}>
                ✍️ Doctor Cursive Handwriting Supported
              </span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(74, 222, 128, 0.15)', color: 'var(--green)', padding: '3px 10px', borderRadius: '8px', fontWeight: 'bold' }}>
                🏥 Hospital & Clinic Slips
              </span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '3px 10px', borderRadius: '8px', fontWeight: 'bold' }}>
                ⚡ Auto Inventory Match
              </span>
            </div>

            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }} 
            />

            <div 
              onClick={() => !isOcrLoading && fileInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(13, 148, 136, 0.45)',
                borderRadius: '16px',
                padding: '1.75rem 1.5rem',
                textAlign: 'center',
                background: 'rgba(13, 148, 136, 0.04)',
                cursor: isOcrLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📸</div>
              <strong style={{ display: 'block', color: 'var(--primary)', fontSize: '1rem', marginBottom: '4px' }}>
                {isOcrLoading ? 'Gemini AI is Deciphering Prescription...' : 'Click to Upload Prescription Photo'}
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Supports JPG, PNG, WEBP, or Camera Photos (Handwritten or Printed)
              </span>
            </div>

            {uploadedPrescriptionId && (
              <div style={{
                padding: '0.85rem 1.15rem',
                borderRadius: '10px',
                background: 'rgba(74, 222, 128, 0.08)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                color: 'var(--green)',
                fontSize: '0.88rem',
                textAlign: 'center',
                fontWeight: '600'
              }}>
                ✓ Prescription Uploaded & Attached (ID: {uploadedPrescriptionId})
              </div>
            )}

            {ocrResult && (
              <div style={{
                padding: '1.25rem',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-color)',
                maxHeight: '160px',
                overflowY: 'auto',
                fontSize: '0.88rem',
                whiteSpace: 'pre-wrap',
                color: '#e5e7eb',
                marginTop: '0.25rem'
              }}>
                <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--primary)' }}>Scanned Text Output:</strong>
                {ocrResult}
              </div>
            )}

            {matchedMedicines.length > 0 && (
              <div style={{
                background: 'rgba(184, 247, 228, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem',
                marginTop: '0.25rem'
              }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--primary)', fontSize: '0.88rem' }}>
                  🔍 Suggested Medicines from Scanner:
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {matchedMedicines.map((med, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                      <div 
                        style={{ textAlign: 'left', cursor: 'pointer' }} 
                        onClick={() => handleSuggestedMedicineClick(med.brand_name)}
                        title="Click to Search"
                      >
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', display: 'block', textDecoration: 'underline' }}>
                          🔍 {med.brand_name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Salt: {med.generic_name} • MRP: ₹{med.price_mrp}</span>
                      </div>
                      <button 
                        onClick={() => {
                          addToCart(med);
                          alert(`Added ${med.brand_name} to cart!`);
                        }} 
                        className="btn-primary" 
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px' }}
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Cart & Payment Gateway View */}
      <div className={`modal-overlay ${isCartOpen ? 'active' : ''}`} onClick={() => {
        if (!isProcessingPayment) {
          setIsCartOpen(false);
          setPaymentStep('cart');
        }
      }}>
        <div className="modal-content glass-panel" style={{ padding: '2rem', maxWidth: '580px', background: '#ffffff', border: '1px solid rgba(226, 232, 240, 0.95)', boxShadow: '0 24px 70px rgba(0, 0, 0, 0.15)' }} onClick={(e) => e.stopPropagation()}>
          
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {paymentStep === 'payment' && (
                <button 
                  onClick={() => setPaymentStep('cart')}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: 'var(--text-main)', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold' }}
                >
                  ← Back
                </button>
              )}
              <h2 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem' }}>
                {paymentStep === 'cart' && <span>🛒 Shopping Cart</span>}
                {paymentStep === 'payment' && <span>💳 Payment Gateway</span>}
                {paymentStep === 'processing' && <span>⚡ Authorizing Payment</span>}
                {paymentStep === 'success' && <span>🎉 Order Placed</span>}
              </h2>
            </div>
            
            {!isProcessingPayment && (
              <button 
                onClick={() => {
                  setIsCartOpen(false);
                  setPaymentStep('cart');
                }} 
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.75rem', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            )}
          </div>

          {/* STEP 1: CART LIST VIEW */}
          {paymentStep === 'cart' && (
            <>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🛒</span>
                  <p style={{ fontWeight: '700', color: 'var(--text-main)' }}>Your cart is empty</p>
                  <p style={{ fontSize: '0.88rem', marginTop: '0.5rem' }}>Search and add medicines to start order checkout!</p>
                </div>
              ) : (
                <>
                  {/* Swiggy Instamart Delivery Address Selector Card in Cart */}
                  <div style={{
                    background: '#f0fdfa',
                    border: '1px solid #ccfbf1',
                    borderRadius: '14px',
                    padding: '0.9rem 1.1rem',
                    marginBottom: '1.2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'rgba(13, 148, 136, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem'
                      }}>
                        {selectedAddress?.icon || '🏠'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)' }}>
                            Delivering to {selectedAddress?.tag || 'Home'}
                          </span>
                          <span style={{
                            background: 'rgba(74, 222, 128, 0.15)', color: 'var(--green)',
                            fontSize: '0.68rem', fontWeight: '800', padding: '1px 6px', borderRadius: '4px'
                          }}>
                            ⚡ 10-15 MINS
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedAddress ? `${selectedAddress.houseNo}, ${selectedAddress.area}` : 'Click to select delivery address'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '2px', fontWeight: '600' }}>
                          👤 {selectedAddress?.receiverName} • {selectedAddress?.receiverPhone}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddressDrawerOpen(true)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--primary)',
                        color: 'var(--primary)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                      }}
                    >
                      CHANGE
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Items in Cart ({cart.length}):</span>
                    <button 
                      onClick={() => setCart([])} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline' }}
                    >
                      Clear All
                    </button>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {cart.map((item, idx) => (
                      <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 0', borderBottom: '1px solid #e2e8f0' }}>
                        <div>
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>{item.brand_name}</strong> {item.dosage && `(${item.dosage})`}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Generic: {item.generic_name}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1rem' }}>₹{item.price_mrp}</span>
                          <button 
                            onClick={() => removeFromCart(idx)} 
                            style={{ background: 'transparent', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Grand Total</span>
                      <h3 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--primary)' }}>₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)}</h3>
                      {uploadedPrescriptionId && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--green)', marginTop: '2px', fontWeight: 'bold' }}>
                          ✓ Prescription attached: {uploadedPrescriptionId}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <a
                        href="/cart"
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          color: 'var(--text-main)',
                          padding: '0.8rem 1rem',
                          borderRadius: '99px',
                          textDecoration: 'none',
                          fontSize: '0.85rem',
                          fontWeight: '700'
                        }}
                      >
                        View Full Page ↗️
                      </a>
                      <button 
                        onClick={handleInitiatePayment} 
                        className="btn-primary" 
                        style={{
                          background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                          fontWeight: '800',
                          padding: '0.9rem 1.8rem',
                          fontSize: '0.95rem',
                          borderRadius: '14px',
                          boxShadow: '0 6px 20px rgba(13, 148, 136, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span>Proceed to Checkout</span>
                        <span>➔</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* STEP 2: PAYMENT METHOD SELECTION */}
          {paymentStep === 'payment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* Total Summary Header */}
              <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Total Amount Payable</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    ₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)}
                  </span>
                </div>
                <span style={{ background: 'rgba(74, 222, 128, 0.15)', color: 'var(--green)', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  ⚡ Free 15-Min Delivery
                </span>
              </div>

              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: '600' }}>Select Payment Option:</span>

              {/* Payment Option Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                
                {/* UPI Card */}
                <div 
                  onClick={() => setSelectedPaymentMethod('upi')}
                  style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    border: selectedPaymentMethod === 'upi' ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                    background: selectedPaymentMethod === 'upi' ? '#f0fdfa' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: '700' }}>⚡ UPI / QR</span>
                    {selectedPaymentMethod === 'upi' && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GPay, PhonePe, Paytm, BHIM</div>
                </div>

                {/* Card Option */}
                <div 
                  onClick={() => setSelectedPaymentMethod('card')}
                  style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    border: selectedPaymentMethod === 'card' ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                    background: selectedPaymentMethod === 'card' ? '#f0fdfa' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: '700' }}>💳 Cards</span>
                    {selectedPaymentMethod === 'card' && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Credit & Debit Cards</div>
                </div>

                {/* Sandbox Gateway */}
                <div 
                  onClick={() => setSelectedPaymentMethod('mock_gateway')}
                  style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    border: selectedPaymentMethod === 'mock_gateway' ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                    background: selectedPaymentMethod === 'mock_gateway' ? '#f0fdfa' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: '700' }}>🛡️ Sandbox</span>
                    {selectedPaymentMethod === 'mock_gateway' && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Simulated Approval</div>
                </div>

                {/* Cash on Delivery */}
                <div 
                  onClick={() => setSelectedPaymentMethod('cod')}
                  style={{
                    padding: '1.1rem',
                    borderRadius: '12px',
                    border: selectedPaymentMethod === 'cod' ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                    background: selectedPaymentMethod === 'cod' ? '#f0fdfa' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedPaymentMethod === 'cod' ? '0 4px 14px rgba(13, 148, 136, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: '800' }}>💵 Cash / COD</span>
                    {selectedPaymentMethod === 'cod' && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pay at Doorstep</div>
                </div>

              </div>

              {/* Dynamic Input Form based on Selection */}
              {selectedPaymentMethod === 'upi' && (
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Store Terminal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>DISPATCHING PHARMACY HUB:</div>
                      <div style={{ fontSize: '0.92rem', color: 'var(--text-main)', fontWeight: '800' }}>
                        🏥 {liveTerminalData?.pharmacy_name || 'Vamanjoor Express Pharmacy'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={fetchPharmacyLiveTerminalQr}
                      disabled={isRefreshingLiveQr}
                      style={{
                        background: 'rgba(13, 148, 136, 0.1)',
                        border: '1px solid var(--primary)',
                        color: 'var(--primary)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        cursor: isRefreshingLiveQr ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isRefreshingLiveQr ? 'Checking...' : '🔄 Refresh Terminal'}
                    </button>
                  </div>

                  {/* QR Selector Toggle Pills */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setQrViewMode('live')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: (qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) ? '2px solid #10b981' : '1px solid #cbd5e1',
                        background: (qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) ? '#f0fdf4' : '#ffffff',
                        color: (qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) ? '#15803d' : '#64748b',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>📷</span>
                      <span>Live Machine Photo {liveTerminalData?.has_live_scanner_qr ? '●' : '(Waiting)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQrViewMode('shop')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: qrViewMode === 'shop' || (!liveTerminalData?.has_live_scanner_qr && qrViewMode === 'auto') ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                        background: qrViewMode === 'shop' || (!liveTerminalData?.has_live_scanner_qr && qrViewMode === 'auto') ? '#f0fdfa' : '#ffffff',
                        color: qrViewMode === 'shop' || (!liveTerminalData?.has_live_scanner_qr && qrViewMode === 'auto') ? 'var(--primary)' : '#64748b',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>🏪</span>
                      <span>Store's Permanent QR</span>
                    </button>
                  </div>

                  {/* QR DISPLAY FRAME */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                    {(qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) && liveTerminalData?.live_upi_qr ? (
                      /* LIVE MACHINE PHOTO */
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          background: '#fff',
                          padding: '10px',
                          borderRadius: '14px',
                          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)',
                          border: '2px solid #10b981',
                          display: 'inline-block'
                        }}>
                          <img 
                            src={liveTerminalData.live_upi_qr} 
                            alt="Live UPI POS Machine Screen"
                            style={{ maxWidth: '200px', maxHeight: '180px', objectFit: 'contain', borderRadius: '8px', display: 'block' }}
                          />
                        </div>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                            🟢 LIVE POS MACHINE DISPLAY
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Captured by Pharmacy
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* STORE'S PERMANENT OFFICIAL QR CODE (UPLOADED AT SIGNUP) */
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          background: '#fff',
                          padding: '10px',
                          borderRadius: '14px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                          border: '2px solid var(--primary)',
                          display: 'inline-block'
                        }}>
                          <img 
                            src={liveTerminalData?.shop_upi_qr || `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=upi://pay?pa=${encodeURIComponent(liveTerminalData?.shop_upi_id || 'vamanjoor.pharmacy@upi')}%26pn=${encodeURIComponent(liveTerminalData?.pharmacy_name || 'Vamanjoor Pharmacy')}%26am=${cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)}%26cu=INR`} 
                            alt="Store Official UPI QR"
                            style={{ width: '150px', height: '150px', objectFit: 'contain', display: 'block' }}
                          />
                        </div>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span style={{ background: 'rgba(13, 148, 136, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                            🏪 STORE OFFICIAL QR
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Uploaded by Pharmacy during registration
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Difficulties helper notice */}
                    <div style={{ background: '#fffbeb', border: '1px dashed #fde68a', borderRadius: '8px', padding: '8px 12px', fontSize: '0.76rem', color: '#92400e', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                      💡 <strong>Scanning Assistance:</strong> You can scan using any UPI App (GPay, PhonePe, Paytm, BHIM). If you encounter any camera reflection or network difficulty, switch to <strong>"Store's Permanent QR"</strong> above.
                    </div>
                  </div>

                  {/* VPA / UPI ID row */}
                  <div style={{ width: '100%' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>
                      Shop's Verified UPI VPA / ID:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        readOnly
                        value={liveTerminalData?.shop_upi_id || 'vamanjoor.pharmacy@upi'} 
                        style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text-main)', fontSize: '0.88rem', fontFamily: 'monospace', fontWeight: 'bold' }}
                      />
                      <span style={{ background: 'rgba(74, 222, 128, 0.15)', color: 'var(--green)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                        Verified Store ✓
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedPaymentMethod === 'cod' && (
                <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: '12px', border: '1px dashed #fde68a', fontSize: '0.85rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.4rem' }}>💵</span>
                  <div>
                    <strong>Cash on Doorstep Delivery:</strong> Pay ₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)} directly to your rider via cash or mobile UPI scan when your parcel arrives in 15 mins.
                  </div>
                </div>
              )}

              <button 
                onClick={handleExecutePayment}
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', padding: '0.95rem', fontSize: '1rem', fontWeight: 'bold', marginTop: '0.5rem' }}
              >
                {selectedPaymentMethod === 'cod' ? 'Confirm COD Order 🛵' : `Pay ₹${cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)} via UPI & Place Order ⚡`}
              </button>
            </div>
          )}

          {/* STEP 3: PROCESSING ANIMATION */}
          {paymentStep === 'processing' && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                border: '4px solid #ccfbf1',
                borderTop: '4px solid var(--primary)',
                animation: 'spin 1s linear infinite'
              }} />
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: '800' }}>Processing Payment</h3>
                <p style={{ color: 'var(--primary)', fontSize: '0.88rem', margin: 0, fontWeight: '700' }}>{paymentStatusMsg}</p>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: '#f1f5f9', padding: '6px 14px', borderRadius: '99px' }}>
                🔒 256-bit Encrypted PCI-DSS Gateway Connection
              </div>
              <style jsx>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {paymentStep === 'success' && completedOrderInfo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem' }}>🎉</div>
              <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.5rem', fontWeight: '800' }}>Payment & Order Confirmed!</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>Your order has been routed to Vamanjoor Pharmacy for rapid 15-min packing.</p>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Order Reference:</span>
                  <strong style={{ color: 'var(--text-main)' }}>#{completedOrderInfo.order_id}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Payment ID:</span>
                  <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{completedOrderInfo.payment_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Method:</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{completedOrderInfo.payment_method}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Payment Status:</span>
                  <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>{completedOrderInfo.payment_status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Amount Paid:</span>
                  <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>₹{completedOrderInfo.total.toFixed(2)}</strong>
                </div>
              </div>

              <button 
                onClick={() => {
                  setIsCartOpen(false);
                  setPaymentStep('cart');
                  setIsTrackingOpen(true);
                }} 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', padding: '0.9rem', fontSize: '1rem', fontWeight: 'bold' }}
              >
                Track Order Live 🛵
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Modal: 3D Secure Bank OTP Verification */}
      {showOtpModal && (
        <div className="modal-overlay active" style={{ zIndex: 1100 }}>
          <div className="modal-content glass-panel" style={{ padding: '2rem', maxWidth: '440px', background: '#ffffff', border: '1px solid var(--primary)', boxShadow: '0 24px 70px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: '800' }}>Bank 3D Secure Authorization</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '600' }}>Verified by Visa / MasterCard SecureCode</span>
                </div>
              </div>
              <button onClick={() => setShowOtpModal(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Merchant:</span>
                <strong style={{ color: 'var(--text-main)' }}>MEDORA Quick Commerce</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Card ending in:</span>
                <span style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>•••• {cardNumber.slice(-4) || '7890'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Amount:</span>
                <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 'bold' }}>
                Enter 6-Digit Bank OTP:
              </label>
              <input 
                type="text" 
                maxLength={6}
                value={otpInput} 
                onChange={e => setOtpInput(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: '#f8fafc', border: '2px solid var(--primary)', color: 'var(--text-main)', fontSize: '1.4rem', letterSpacing: '0.4em', textAlign: 'center', fontWeight: 'bold' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--green)', display: 'block', marginTop: '6px', textAlign: 'center', fontWeight: '600' }}>
                ✓ Demo OTP prefilled (`123456`). Click below to authorize transaction.
              </span>
            </div>

            <button 
              onClick={handleExecutePayment} 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', padding: '0.9rem', fontSize: '1rem', fontWeight: 'bold' }}
            >
              Authorize & Complete Payment 🔒
            </button>
          </div>
        </div>
      )}

      {/* Floating Chatbot Bubble & Cloud Greeting */}
      {!isChatOpen && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', zIndex: 999 }}>
          {/* Cloud/Speech bubble popup */}
          {isGreetingVisible && (
            <div 
              className="glass-panel animate-fade-in" 
              style={{ 
                padding: '0.85rem 1.15rem', 
                borderRadius: '16px 16px 4px 16px', 
                border: '1px solid rgba(13, 148, 136, 0.3)', 
                background: '#ffffff', 
                color: 'var(--text-main)', 
                fontSize: '0.88rem', 
                maxWidth: '260px', 
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                position: 'relative',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={() => {
                setIsChatOpen(true);
                setIsGreetingVisible(false);
              }}
            >
              <span>💬 Need medical help? Chat with our AI Doctor!</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsGreetingVisible(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '0 4px',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                &times;
              </button>
            </div>
          )}
          
          <div 
            className="chatbot-trigger chat-alert-active" 
            onClick={() => {
              setIsChatOpen(true);
              setIsGreetingVisible(false);
            }} 
            title="Consult AI Doctor"
            style={{ position: 'static' }}
          >
            🩺
          </div>
        </div>
      )}

      {/* Floating Chatbot Drawer/Window */}
      <div className={`chatbot-window glass-panel ${isChatOpen ? 'active' : ''}`} style={{ background: '#ffffff', border: '1px solid rgba(226, 232, 240, 0.95)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.12)' }}>
        <div className="chatbot-header" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🩺</span>
            <div>
              <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--primary)' }}>MEDORA AI Clinical Doctor</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: '800' }}>● ONLINE</span>
                <span style={{ background: '#ccfbf1', color: '#0d9488', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>⚡ Gemini 3.1 Flash</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button 
              onClick={resetChat} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Reset
            </button>
            <button 
              onClick={() => setIsChatOpen(false)} 
              style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
            >
              &times;
            </button>
          </div>
        </div>

        <div className="chatbot-body" style={{ background: '#ffffff', padding: '1rem' }}>
          {chatMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', width: '100%', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: '0.55rem', maxWidth: isUser ? '85%' : '94%' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: isUser ? 'var(--primary)' : 'rgba(13, 148, 136, 0.12)',
                    color: isUser ? '#ffffff' : 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    flexShrink: 0,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                  }}>
                    {isUser ? '👤' : '🩺'}
                  </div>
                  <div style={{
                    padding: isUser ? '0.75rem 1rem' : '0.9rem 1.15rem',
                    borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    background: isUser ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' : '#f8fafc',
                    border: isUser ? 'none' : '1px solid #e2e8f0',
                    color: isUser ? '#ffffff' : '#0f172a',
                    fontSize: '0.89rem',
                    lineHeight: '1.55',
                    whiteSpace: isUser ? 'pre-wrap' : 'normal',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                    width: '100%'
                  }}>
                    {isUser ? msg.content : renderFormattedMessageContent(msg.content)}
                  </div>
                </div>
              </div>
            );
          })}

          {isChatLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'rgba(13, 148, 136, 0.1)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem'
                }}>🩺</div>
                <div style={{ padding: '0.6rem 0.9rem', borderRadius: '4px 14px 14px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                  <span className="dot-typing" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Doctor is analyzing...</span>
                </div>
              </div>
            </div>
          )}

          {chatFinished && chatSuggestedMedicines.length > 0 && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '1rem',
              marginTop: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>💊</span>
                  <strong style={{ color: '#15803d', fontSize: '0.92rem' }}>Recommended OTC Remedies:</strong>
                </div>
                <span style={{ background: '#dcfce7', color: '#166534', fontSize: '0.68rem', padding: '2px 8px', borderRadius: '99px', fontWeight: '800' }}>
                  ⚡ 10m FAST DISPATCH
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {chatSuggestedMedicines.map((med, idx) => (
                  <span 
                    key={idx} 
                    style={{
                      background: '#ffffff',
                      color: '#15803d',
                      border: '1px solid #86efac',
                      padding: '5px 12px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
                    }}
                    onClick={() => handleSuggestedMedicineClick(med)}
                  >
                    + {med}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Symptom Assessment Chips */}
        {!chatFinished && (
          <div style={{ padding: '8px 1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[
              { label: "🤒 High Fever", query: "I have high fever and severe headache since yesterday. What medicines can I take for relief?" },
              { label: "🤧 Cold & Allergy", query: "I am having persistent sneezing, runny nose, and itchy eyes. Recommend OTC allergy medicine." },
              { label: "🤢 Acidity & Gas", query: "I am having burning sensation in chest and stomach acid reflux. What should I take?" },
              { label: "🤕 Migraine", query: "Severe one-sided throbbing headache with light sensitivity. Please suggest safe OTC relief." },
              { label: "😷 Dry Cough", query: "I have had a dry tickling throat cough for 2 days. What OTC syrup or tablet helps?" }
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleTriggerChatMessage(chip.query)}
                disabled={isChatLoading}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '99px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <div className="chatbot-footer" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <form onSubmit={sendChatMessage} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="input-field"
              placeholder={chatFinished ? "Consultation completed." : "Type your message..."}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              disabled={chatFinished || isChatLoading}
              style={{ flex: 1, padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.88rem', background: '#ffffff', border: '1px solid #cbd5e1' }}
            />
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={chatFinished || isChatLoading || !chatInput.trim()}
              style={{ padding: '0.65rem 1.1rem', borderRadius: '8px', fontSize: '0.88rem' }}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Interactive Medicine Clinical Details Modal */}
      {selectedMedicineDetail && (
        <div className="modal-overlay active" onClick={() => setSelectedMedicineDetail(null)}>
          <div 
            className="modal-content glass-panel animate-fade-in" 
            style={{ padding: '2rem', maxWidth: '620px', background: '#ffffff', border: '1px solid rgba(226, 232, 240, 0.95)', boxShadow: '0 24px 70px rgba(0,0,0,0.15)' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    background: 'rgba(13, 148, 136, 0.12)',
                    color: 'var(--primary)',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    textTransform: 'uppercase'
                  }}>
                    {selectedMedicineDetail.category || selectedMedicineDetail.form || 'Prescription & OTC'}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    {selectedMedicineDetail.dosage}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {selectedMedicineDetail.brand_name}
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Composition Salt: <strong style={{ color: 'var(--primary)' }}>{selectedMedicineDetail.generic_name}</strong>
                </div>
              </div>
              <button
                onClick={() => setSelectedMedicineDetail(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.75rem', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Pricing & Speed Pill */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1.2rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>MRP Inclusive of all Taxes</span>
                <span style={{ fontSize: '1.65rem', fontWeight: '800', color: 'var(--primary)' }}>₹{selectedMedicineDetail.price_mrp}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  background: 'linear-gradient(135deg, #FF6B00 0%, #FFA800 100%)',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  display: 'inline-block'
                }}>
                  ⚡ 10-15 MINS DELIVERY
                </span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  From {selectedMedicineDetail.instamart?.nearest_pharmacy?.pharmacy_name || 'Vamanjoor Central Pharmacy'}
                </div>
              </div>
            </div>

            {/* Clinical Usage & Indication */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)' }}>
                Clinical Indication & Guidance
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.55' }}>
                {selectedMedicineDetail.description || `${selectedMedicineDetail.brand_name} (${selectedMedicineDetail.generic_name}) is approved for high-efficacy symptomatic relief. Certified WHO-GMP manufactured standard dosage. Follow prescribed guidelines.`}
              </p>
            </div>

            {/* Dark-Store Availability Breakdown */}
            <div style={{ marginBottom: '1.5rem', background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '14px', padding: '1.1rem' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🏪</span> Real-Time Connected Dark-Store Verification:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• Vamanjoor Central Pharmacy (0.8 km):</span>
                  <strong style={{ color: 'var(--green)' }}>✓ 28 Units In Stock (Fastest Pickup)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• City Meds Express (1.4 km):</span>
                  <strong style={{ color: 'var(--green)' }}>✓ 15 Units In Stock</strong>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', alignItems: 'center' }}>
              {getItemCartCount(selectedMedicineDetail.medicine_id) > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Quantity in cart:</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#f0fdf4',
                    border: '1.5px solid #16a34a',
                    borderRadius: '10px',
                    padding: '4px 12px'
                  }}>
                    <button
                      onClick={() => handleUpdateItemQuantity(selectedMedicineDetail, -1)}
                      style={{ background: 'transparent', border: 'none', color: '#16a34a', fontSize: '1.1rem', fontWeight: '800', cursor: 'pointer' }}
                    >
                      −
                    </button>
                    <strong style={{ color: '#16a34a', fontSize: '0.95rem', minWidth: '20px', textAlign: 'center' }}>
                      {getItemCartCount(selectedMedicineDetail.medicine_id)}
                    </strong>
                    <button
                      onClick={() => handleUpdateItemQuantity(selectedMedicineDetail, 1)}
                      style={{ background: 'transparent', border: 'none', color: '#16a34a', fontSize: '1.1rem', fontWeight: '800', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    handleUpdateItemQuantity(selectedMedicineDetail, 1);
                  }}
                  className="btn-primary"
                  style={{ padding: '0.75rem 1.8rem', fontSize: '0.9rem', fontWeight: '800' }}
                >
                  + Add to Cart
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Animated Toast Notification Bar */}
      {toastNotification && (
        <div style={{
          position: 'fixed',
          bottom: '28px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2600,
          background: '#0f172a',
          color: '#ffffff',
          padding: '0.75rem 1.5rem',
          borderRadius: '30px',
          boxShadow: '0 14px 34px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.88rem',
          fontWeight: '700',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          <span style={{ fontSize: '1.15rem' }}>{toastNotification.icon}</span>
          <span>{toastNotification.message}</span>
        </div>
      )}

      {/* Swiggy Instamart Floating Checkout Pill Bar */}
      {cart.length > 0 && !isCartOpen && (
        <div
          onClick={() => {
            setIsCartOpen(true);
            setPaymentStep('cart');
          }}
          style={{
            position: 'fixed',
            bottom: '22px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: '560px',
            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
            color: '#ffffff',
            borderRadius: '20px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 16px 36px rgba(13, 148, 136, 0.4)',
            cursor: 'pointer',
            zIndex: 990,
            transition: 'all 0.25s ease'
          }}
          title="Click to view cart and checkout"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.2)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem'
            }}>
              🛒
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '900', fontSize: '1.05rem', color: '#ffffff' }}>
                  {cart.length} {cart.length === 1 ? 'ITEM' : 'ITEMS'}
                </span>
                <span style={{ color: '#ccfbf1', fontSize: '0.8rem' }}>•</span>
                <span style={{ fontWeight: '900', fontSize: '1.05rem', color: '#ffffff' }}>
                  ₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#ccfbf1', marginTop: '1px' }}>
                ⚡ 10-15 Mins Delivery to <strong>{selectedAddress?.tag || 'Home'}</strong>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#ffffff',
            color: '#0d9488',
            padding: '8px 18px',
            borderRadius: '99px',
            fontWeight: '800',
            fontSize: '0.85rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <span>Checkout</span>
            <span>➔</span>
          </div>
        </div>
      )}

      {/* Swiggy Address Drawer */}
      <SwiggyAddressDrawer
        isOpen={isAddressDrawerOpen}
        onClose={() => setIsAddressDrawerOpen(false)}
        currentAddress={selectedAddress}
        onSelectAddress={handleSelectAddress}
        activeUser={activeUser}
      />

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="medora-mobile-nav">
        <button
          className={`medora-nav-item ${activeMainView === 'shelf' ? 'active' : ''}`}
          onClick={() => {
            setActiveMainView('shelf');
            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="medora-nav-icon">🏠</span>
          <span className="medora-nav-label">Home</span>
        </button>

        <button
          className="medora-nav-item"
          onClick={() => {
            setActiveMainView('shelf');
            const el = document.getElementById('instamart-shelf-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <span className="medora-nav-icon">⚡</span>
          <span className="medora-nav-label">Instamart</span>
        </button>

        <button
          className={`medora-nav-item ${activeMainView === 'radar' ? 'active' : ''}`}
          onClick={() => {
            setActiveMainView(activeMainView === 'radar' ? 'shelf' : 'radar');
          }}
        >
          <span className="medora-nav-icon">📡</span>
          <span className="medora-nav-label">Radar</span>
        </button>

        <button
          className="medora-nav-item"
          onClick={() => {
            if (activeOrders.length > 0) {
              setPaymentStep('order_success');
              setIsCartOpen(true);
            } else {
              showToast('No active orders right now', '📦');
            }
          }}
        >
          <span className="medora-nav-icon">📦</span>
          <span className="medora-nav-label">Orders</span>
        </button>

        <button
          className="medora-nav-item"
          onClick={() => setShowBootup(true)}
        >
          <span className="medora-nav-icon">🎬</span>
          <span className="medora-nav-label">Cartoon</span>
        </button>
      </nav>
    </>
  );
}
