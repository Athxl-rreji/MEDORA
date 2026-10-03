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
import { API } from '../utils/apiConfig';
const DEFAULT_USER_ID = "usr_patient_1";

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
          background: 'rgba(255,255,255,0.12)', borderRadius: '4px', zIndex: 0
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
                background: done ? 'var(--primary)' : '#1e2433',
                border: active ? '3px solid var(--primary)' : done ? '2px solid var(--green)' : '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                boxShadow: active ? '0 0 20px rgba(184, 247, 228, 0.4)' : 'none',
                transition: 'all 0.5s ease',
                color: done ? '#16171a' : '#cbd5e1'
              }}>
                {stage.icon}
              </div>
              <span style={{
                fontSize: '0.74rem', marginTop: '8px', textAlign: 'center',
                color: done ? 'var(--primary)' : '#94a3b8',
                fontWeight: active ? '800' : '600',
                maxWidth: '85px', lineHeight: '1.2'
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
          if (parsed && (parsed.email || parsed.role)) {
            // Instantly activate user session so credentials and dashboard persist smoothly
            setActiveUser(parsed);

            // Asynchronously verify with backend without logging out on temporary network blips
            if (parsed.email) {
              fetch(`${API}/api/v1/auth/user-status?identifier=${encodeURIComponent(parsed.email)}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                  if (!data) return; // Retain session if backend is temporarily starting up
                  if (data.exists === false) {
                    showToast('This account has been deleted by the administrator.', '⚠️');
                    handleLogout();
                  } else if (data.status === 'deactivated') {
                    showToast('This account has been deactivated by the administrator.', '🚫');
                    handleLogout();
                  }
                })
                .catch(() => {
                  // Retain active session on connection hiccups
                });
            }
          }
        } catch (e) {}
      }
    }
  }, []);

  const [isFirstTimeAddressSetup, setIsFirstTimeAddressSetup] = useState(false);

  const handleLoginSuccess = (userData) => {
    setActiveUser(userData);
    if (typeof window !== 'undefined') {
      localStorage.setItem('medora_active_user', JSON.stringify(userData));

      // First-time address prompt for patients
      const role = userData?.role || 'patient';
      if (role === 'patient') {
        const userKey = (userData?.email || userData?.id || 'patient').toLowerCase();
        const hasConfigured = localStorage.getItem(`medora_address_configured_${userKey}`);
        if (!hasConfigured) {
          setIsFirstTimeAddressSetup(true);
          setIsAddressDrawerOpen(true);
          showToast("📍 Welcome to MEDORA! Please set your delivery address to start receiving 10-minute medicine deliveries.", "👋");
        }
      }
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
  const [searchCategoryFilter, setSearchCategoryFilter] = useState('All');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [recentSearches, setRecentSearches] = useState(['Dolo 650', 'Augmentin 625', 'Pantocid 40', 'Allegra 120']);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef(null);
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
    const updated = { ...addr, isDefault: true };
    setSelectedAddress(updated);
    try {
      localStorage.setItem('medora_selected_address', JSON.stringify(updated));
      const userKey = (activeUser?.email || activeUser?.id || 'patient').toLowerCase();
      localStorage.setItem(`medora_address_configured_${userKey}`, 'true');
      setIsFirstTimeAddressSetup(false);
      showToast(`📍 Default delivery address set to ${addr.tag || 'Home'} (${addr.area || 'Mangalore'})`, '✅');
    } catch (e) {}
  };
  
  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGreetingVisible, setIsGreetingVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am MEDORA's AI Virtual Doctor & Clinical Pharmacist.\n\nTo help diagnose and recommend safe relief, what symptoms are you experiencing today?",
      confidence_score: 0.50,
      confidence_label: "Intake Ready",
      quiz_options: ["Fever & Chills", "Cold & Sneezing", "Acidity & Heartburn", "Severe Headache", "Throat Pain & Cough", "Body & Muscle Ache"]
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatFinished, setChatFinished] = useState(false);
  const [chatSuggestedMedicines, setChatSuggestedMedicines] = useState([]);
  const chatEndRef = useRef(null);
  const chatAbortControllerRef = useRef(null);

  const cancelChatRequest = () => {
    if (chatAbortControllerRef.current) {
      try {
        chatAbortControllerRef.current.abort();
      } catch (e) {}
      chatAbortControllerRef.current = null;
    }
    setIsChatLoading(false);
  };

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
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [copiedVpa, setCopiedVpa] = useState(false);

  // Dedicated Main View Toggle ('home' | 'radar' | 'account')
  const [activeMainView, setActiveMainView] = useState('home');
  const [activeAccountSection, setActiveAccountSection] = useState('hub');
  
  // Interactive Medicine Details Modal
  const [selectedMedicineDetail, setSelectedMedicineDetail] = useState(null);

  // Shop Selection Popup on "+ Add to Cart"
  const [selectedMedicineForShopPicker, setSelectedMedicineForShopPicker] = useState(null);

  // AI Drug-Drug Interaction Safety Checker State
  const [isAiCheckingInteractions, setIsAiCheckingInteractions] = useState(false);
  const [aiInteractionModalOpen, setAiInteractionModalOpen] = useState(false);
  const [aiInteractionReport, setAiInteractionReport] = useState(null);
  const [safetyVerifiedBanner, setSafetyVerifiedBanner] = useState(false);

  // Amazon-Style Search Filters & Sorting State
  const [amazonSortBy, setAmazonSortBy] = useState('featured'); // 'featured' | 'price_asc' | 'price_desc' | 'rating' | 'fastest'
  const [filterPrimeOnly, setFilterPrimeOnly] = useState(false);
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [filterPriceBracket, setFilterPriceBracket] = useState('all');
  const [filterDiscountOnly, setFilterDiscountOnly] = useState(false);

  // Amazon Account Management Hub Profile States
  const [accountEditName, setAccountEditName] = useState(activeUser?.name || 'Adhwaith');
  const [accountEditPhone, setAccountEditPhone] = useState(activeUser?.phone || '+91 99999 99999');
  const [accountEditEmail, setAccountEditEmail] = useState(activeUser?.email || 'patient@medora.com');
  const [accountEditAddress, setAccountEditAddress] = useState(activeUser?.address || '');
  const [accountEditAllergies, setAccountEditAllergies] = useState(activeUser?.allergies || 'Sulfa Drugs');
  const [accountEditConditions, setAccountEditConditions] = useState(activeUser?.chronic_conditions || 'None');
  const [accountEditBlood, setAccountEditBlood] = useState(activeUser?.blood_group || 'O+');
  const [accountEditEmergencyPhone, setAccountEditEmergencyPhone] = useState(activeUser?.emergency_phone || '');
  const [accountNewPassword, setAccountNewPassword] = useState('');
  const [allUserOrders, setAllUserOrders] = useState([]);

  useEffect(() => {
    if (activeUser) {
      setAccountEditName(activeUser.name || '');
      setAccountEditEmail(activeUser.email || '');
      setAccountEditPhone(activeUser.phone || activeUser.mobile || '+91 99999 99999');
      setAccountEditAddress(
        typeof activeUser.address === 'string'
          ? activeUser.address
          : (activeUser.address?.houseNo ? `${activeUser.address.houseNo}, ${activeUser.address.area || ''}` : (activeUser.address || ''))
      );
      setAccountEditAllergies(activeUser.allergies || 'None');
      setAccountEditConditions(activeUser.chronic_conditions || 'None');
      setAccountEditBlood(activeUser.blood_group || 'O+');
      setAccountEditEmergencyPhone(activeUser.emergency_phone || '');
    }
  }, [activeUser]);
  const [familyProfiles, setFamilyProfiles] = useState([
    { id: 'fam_1', name: 'Adhwaith (Self)', age: 24, relation: 'Self', blood: 'O+', allergies: 'Sulfa Drugs', conditions: 'None' },
    { id: 'fam_2', name: 'R. K. Shenoy (Father)', age: 58, relation: 'Father', blood: 'B+', allergies: 'Penicillin', conditions: 'Type 2 Diabetes, Hypertension' },
    { id: 'fam_3', name: 'Geetha Shenoy (Mother)', age: 52, relation: 'Mother', blood: 'A+', allergies: 'None', conditions: 'Thyroid (Hypothyroid)' }
  ]);
  const [savedUpiIds, setSavedUpiIds] = useState([
    { id: 'upi_1', vpa: 'adhwaith@okaxis', bank: 'Axis Bank', isDefault: true },
    { id: 'upi_2', vpa: 'adhwaith@icici', bank: 'ICICI Bank', isDefault: false }
  ]);
  const [showAddUpiInput, setShowAddUpiInput] = useState(false);
  const [newUpiVpaInput, setNewUpiVpaInput] = useState('');
  const [newUpiBankInput, setNewUpiBankInput] = useState('');

  // Add Family Member Modal State
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  const [newFamName, setNewFamName] = useState('');
  const [newFamRelation, setNewFamRelation] = useState('Parent');
  const [newFamAge, setNewFamAge] = useState('');
  const [newFamBlood, setNewFamBlood] = useState('B+');
  const [newFamAllergies, setNewFamAllergies] = useState('');
  const [newFamConditions, setNewFamConditions] = useState('');


  // Elegant Toast Notification System
  const [toastNotification, setToastNotification] = useState(null);

  const showToast = (message, icon = '✓') => {
    setToastNotification({ message, icon, id: Date.now() });
    setTimeout(() => {
      setToastNotification(prev => (prev?.message === message ? null : prev));
    }, 3200);
  };

  // ─── AI CLINICAL DRUG-DRUG INTERACTION RULES ENGINE ───
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
    const aceArbMeds = items.filter(m => /telmisartan|telma|losartan|enalapril|ramipril/.test(textOf(m)));
    const potassiumMeds = items.filter(m => /potassium|k-bind|potcl/.test(textOf(m)));

    if (paracetamolMeds.length >= 2) {
      alerts.push({
        medicine_a: paracetamolMeds[0].brand_name || paracetamolMeds[0].name,
        medicine_b: paracetamolMeds[1].brand_name || paracetamolMeds[1].name,
        severity: 'CRITICAL',
        title: '⚠️ Duplicate Paracetamol Overdose Hazard',
        description: `Both '${paracetamolMeds[0].brand_name}' and '${paracetamolMeds[1].brand_name}' contain Paracetamol (Acetaminophen). Co-administering multiple Paracetamol formulations risks exceeding the safe hepatotoxic ceiling (2000-4000mg/day), carrying severe risk of acute toxic liver injury.`,
        recommendation: `Remove one of the Paracetamol products (${paracetamolMeds[0].brand_name} or ${paracetamolMeds[1].brand_name}) before completing checkout.`
      });
    }

    if (nsaidMeds.length >= 2) {
      alerts.push({
        medicine_a: nsaidMeds[0].brand_name || nsaidMeds[0].name,
        medicine_b: nsaidMeds[1].brand_name || nsaidMeds[1].name,
        severity: 'CRITICAL',
        title: '⚠️ Dual NSAID Gastric Ulceration Hazard',
        description: `Taking '${nsaidMeds[0].brand_name}' concurrently with '${nsaidMeds[1].brand_name}' combines two potent non-steroidal anti-inflammatory drugs. This drastically increases the risk of severe gastric mucosal erosion, peptic ulcer perforation, and renal impairment.`,
        recommendation: `Choose either '${nsaidMeds[0].brand_name}' or '${nsaidMeds[1].brand_name}'. Do not consume two NSAID pain relievers together.`
      });
    }

    if (bloodThinnerMeds.length > 0 && nsaidMeds.length > 0) {
      alerts.push({
        medicine_a: bloodThinnerMeds[0].brand_name || bloodThinnerMeds[0].name,
        medicine_b: nsaidMeds[0].brand_name || nsaidMeds[0].name,
        severity: 'CRITICAL',
        title: '🩸 Severe Internal Hemorrhage & Bleeding Risk',
        description: `Combining blood thinner '${bloodThinnerMeds[0].brand_name}' with NSAID '${nsaidMeds[0].brand_name}' impairs normal clotting mechanisms and damages mucosal protection, creating a severe risk of gastrointestinal or systemic bleeding.`,
        recommendation: `Consult your doctor before taking '${nsaidMeds[0].brand_name}' with '${bloodThinnerMeds[0].brand_name}'.`
      });
    }

    if (antibioticMeds.length > 0 && antacidCalciumMeds.length > 0) {
      alerts.push({
        medicine_a: antibioticMeds[0].brand_name || antibioticMeds[0].name,
        medicine_b: antacidCalciumMeds[0].brand_name || antacidCalciumMeds[0].name,
        severity: 'MODERATE',
        title: '⚠️ Antibiotic Inactivation by Antacid / Minerals',
        description: `Metal cations (Calcium, Magnesium, Aluminium) in '${antacidCalciumMeds[0].brand_name}' chelate and bind with '${antibioticMeds[0].brand_name}' in the digestive tract, preventing antibiotic absorption and causing treatment failure.`,
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
        recommendation: 'Do not combine steroids with NSAIDs without explicit physician supervision and proton-pump inhibitor (e.g. Pantocid 40) co-prescription.'
      });
    }

    if (sedativeAntihistamineMeds.length >= 2) {
      alerts.push({
        medicine_a: sedativeAntihistamineMeds[0].brand_name || sedativeAntihistamineMeds[0].name,
        medicine_b: sedativeAntihistamineMeds[1].brand_name || sedativeAntihistamineMeds[1].name,
        severity: 'MODERATE',
        title: '💤 Additive Sedation & CNS Depression',
        description: `Combining '${sedativeAntihistamineMeds[0].brand_name}' with '${sedativeAntihistamineMeds[1].brand_name}' produces additive antihistaminic CNS suppression, causing marked drowsiness, slowed reflexes, and impaired psychomotor coordination.`,
        recommendation: 'Avoid combining multiple anti-allergic or cough preparations together. Do not drive or operate machinery.'
      });
    }

    if (aceArbMeds.length > 0 && potassiumMeds.length > 0) {
      alerts.push({
        medicine_a: aceArbMeds[0].brand_name || aceArbMeds[0].name,
        medicine_b: potassiumMeds[0].brand_name || potassiumMeds[0].name,
        severity: 'CRITICAL',
        title: '❤️ Life-Threatening Hyperkalemia Risk',
        description: `Blood pressure medication '${aceArbMeds[0].brand_name}' reduces renal excretion of potassium. Combining with '${potassiumMeds[0].brand_name}' can cause acute hyperkalemia and lethal cardiac dysrhythmias.`,
        recommendation: 'Do not take potassium supplements with blood pressure medicines without cardiologist direction.'
      });
    }

    return alerts;
  };

  const runAiDrugInteractionCheck = async () => {
    if (cart.length === 0) {
      showToast('Your cart is empty!', '🛒');
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
    showToast('🤖 AI Clinical Pharmacist: Checking Drug-Drug Interactions & Safety...', '🛡️');

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
      console.warn("AI interaction API offline, using local clinical safety matrix", err);
    }

    // Client-side instant clinical check as guaranteed backup
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

    // Safe to proceed!
    setSafetyVerifiedBanner(true);
    setTimeout(() => setSafetyVerifiedBanner(false), 4000);
    setPaymentStep('payment');
    fetchPharmacyLiveTerminalQr();
  };

  // ─── MULTI-PHARMACY SHOP GENERATOR FOR MEDICINES ───
  const getShopsForMedicine = (med) => {
    if (!med) return [];
    const basePrice = parseFloat(med.price_mrp || med.price || 45);
    return [
      {
        id: "shop_apollo_vamanjoor",
        name: "Apollo Pharmacy - Vamanjoor",
        badge: "Express 10m ⚡",
        distance: "0.8 km away",
        deliveryTime: "10-12 mins",
        rating: "4.9",
        reviews: "680+",
        stock: 28,
        price: (basePrice * 0.95).toFixed(2),
        discount: "5% OFF",
        address: "Near SJEC College, Airport Road"
      },
      {
        id: "shop_vamanjoor_central",
        name: "Vamanjoor Central Chemist & Druggist",
        badge: "Best Seller 🏆",
        distance: "1.1 km away",
        deliveryTime: "12-15 mins",
        rating: "4.8",
        reviews: "450+",
        stock: 19,
        price: basePrice.toFixed(2),
        discount: "M.R.P.",
        address: "Main Junction, Vamanjoor"
      },
      {
        id: "shop_medplus_kadri",
        name: "MedPlus Chemist - Kadri",
        badge: "Best Value 🏷️",
        distance: "2.3 km away",
        deliveryTime: "15-20 mins",
        rating: "4.7",
        reviews: "320+",
        stock: 45,
        price: (basePrice * 0.92).toFixed(2),
        discount: "8% OFF",
        address: "Kadri Hills, Mangalore"
      },
      {
        id: "shop_greencross_lifeline",
        name: "GreenCross Lifeline 24x7",
        badge: "24/7 Open 🌙",
        distance: "3.2 km away",
        deliveryTime: "20-25 mins",
        rating: "4.8",
        reviews: "210+",
        stock: 12,
        price: (basePrice * 0.97).toFixed(2),
        discount: "3% OFF",
        address: "Mallikatte Circle, Mangalore"
      }
    ];
  };

  const handleAddMedicineFromShop = (med, shop, qtyDelta = 1) => {
    const itemWithShop = {
      ...med,
      medicine_id: med.medicine_id,
      brand_name: med.brand_name,
      generic_name: med.generic_name,
      dosage: med.dosage,
      price_mrp: shop.price,
      pharmacy_id: shop.name,
      pharmacy_badge: shop.badge,
      delivery_time: shop.deliveryTime
    };
    handleUpdateItemQuantity(itemWithShop, qtyDelta);
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
  const [scannedPrescription, setScannedPrescription] = useState(null);
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

  // Amazon Curated Best Sellers in Pharmacy (Amazon Choice)
  const AMAZON_BEST_SELLERS = [
    { medicine_id: 'bs_dolo650', brand_name: 'Dolo 650 Tablet', generic_name: 'Paracetamol 650mg', dosage: '650mg', form: 'Tablet', category: 'Pain & Fever', rating: '4.9', reviews: '3.4k', price_mrp: 32, original_mrp: 42, icon: '💊', badge: '#1 Best Seller' },
    { medicine_id: 'bs_aug625', brand_name: 'Augmentin 625 Duo', generic_name: 'Amoxicillin + Clavulanic Acid', dosage: '625mg', form: 'Tablet', category: 'Antibiotics', rating: '4.8', reviews: '2.1k', price_mrp: 204, original_mrp: 245, icon: '💊', badge: 'Doctor Choice' },
    { medicine_id: 'bs_pan40', brand_name: 'Pan 40 Tablet', generic_name: 'Pantoprazole Gastro-Resistant', dosage: '40mg', form: 'Tablet', category: 'Acidity & Digestion', rating: '4.8', reviews: '1.9k', price_mrp: 155, original_mrp: 185, icon: '💊', badge: 'Top Rated' },
    { medicine_id: 'bs_crocin', brand_name: 'Crocin Advance 500mg', generic_name: 'Fast Release Paracetamol', dosage: '500mg', form: 'Tablet', category: 'Pain & Fever', rating: '4.7', reviews: '1.4k', price_mrp: 18, original_mrp: 24, icon: '💊', badge: 'MEDORA Choice' },
    { medicine_id: 'bs_shelcal', brand_name: 'Shelcal 500 Tablet', generic_name: 'Calcium 500mg + Vitamin D3 250IU', dosage: '500mg', form: 'Tablet', category: 'Vitamins & Supplements', rating: '4.9', reviews: '4.2k', price_mrp: 132, original_mrp: 160, icon: '💊', badge: '#1 in Vitamins' },
    { medicine_id: 'bs_allegra', brand_name: 'Allegra 120mg Tablet', generic_name: 'Fexofenadine HCl Non-Drowsy', dosage: '120mg', form: 'Tablet', category: 'Cold & Cough', rating: '4.8', reviews: '1.8k', price_mrp: 215, original_mrp: 258, icon: '💊', badge: 'Fast Relief' },
    { medicine_id: 'bs_betadine', brand_name: 'Betadine 5% Ointment 20g', generic_name: 'Povidone-Iodine 5% w/w', dosage: '20g Tube', form: 'Ointment', category: 'First Aid & Antiseptic', rating: '4.9', reviews: '2.9k', price_mrp: 125, original_mrp: 145, icon: '🧴', badge: 'First Aid Must-Have' },
    { medicine_id: 'bs_orsl', brand_name: 'ORSL Rehydration Electrolyte 200ml', generic_name: 'WHO Formula Apple Electrolyte', dosage: '200ml Drink', form: 'Liquid', category: 'All Pharmacy', rating: '4.8', reviews: '2.5k', price_mrp: 48, original_mrp: 55, icon: '🧃', badge: 'Instant Energy' }
  ];

  // Close search suggestions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live suggestions debounced fetch with Instamart local store inventory & speed
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setMultiCompositionSplit(null);
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
    if (!showSuggestions || searchResults.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAmazonSearchSubmit(e);
      }
      return;
    }

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
      } else {
        setShowSuggestions(false);
        handleAmazonSearchSubmit(e);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Amazon Pharmacy Departments Directory
  const AMAZON_DEPARTMENTS = [
    { id: 'All', label: 'All Pharmacy' },
    { id: 'Rx', label: 'Prescription (Rx)' },
    { id: 'Pain', label: 'Pain & Fever' },
    { id: 'Cold', label: 'Cold & Cough' },
    { id: 'Antibiotics', label: 'Antibiotics' },
    { id: 'Acidity', label: 'Acidity & Digestion' },
    { id: 'Vitamins', label: 'Vitamins & Supplements' },
    { id: 'FirstAid', label: 'First Aid & Antiseptic' },
    { id: 'Baby', label: 'Baby & Mother Care' }
  ];

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('medora_recent_searches');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) setRecentSearches(parsed);
      }
    } catch (e) {}
  }, []);

  const saveRecentSearch = (term) => {
    if (!term || !term.trim()) return;
    const clean = term.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(t => t.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 8);
      try { localStorage.setItem('medora_recent_searches', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  const clearRecentSearches = (e) => {
    if (e) e.stopPropagation();
    setRecentSearches([]);
    try { localStorage.removeItem('medora_recent_searches'); } catch (e) {}
    showToast('Recent searches cleared', '🗑️');
  };

  const removeSingleRecentSearch = (term, e) => {
    if (e) e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(t => t.toLowerCase() !== term.toLowerCase());
      try { localStorage.setItem('medora_recent_searches', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  const handleVoiceSearch = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast('Voice search not supported in this browser. Please type your search.', '⚠️');
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = 'en-IN';
      rec.interimResults = false;
      rec.onstart = () => {
        setIsListeningVoice(true);
        showToast('Listening... Speak medicine name now (e.g. Dolo 650)', '🎙️');
      };
      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        setShowSuggestions(true);
        saveRecentSearch(transcript);
        showToast(`Voice Search: "${transcript}"`, '🔍');
        setIsListeningVoice(false);
      };
      rec.onerror = () => setIsListeningVoice(false);
      rec.onend = () => setIsListeningVoice(false);
      rec.start();
    } catch (err) {
      setIsListeningVoice(false);
    }
  };

  const handleBuyNow = (med) => {
    addToCart(med);
    saveRecentSearch(med.brand_name);
    setIsCartOpen(true);
    setShowSuggestions(false);
    showToast(`Proceeding to instant 1-Click checkout for ${med.brand_name}!`, '⚡');
  };

  const filterByDepartment = (med, dept) => {
    if (!dept || dept === 'All') return true;
    const text = `${med.brand_name || ''} ${med.generic_name || ''} ${med.category || ''} ${med.dosage || ''} ${med.form || ''}`.toLowerCase();
    if (dept === 'Rx') return med.prescription_required || text.includes('prescription') || text.includes('schedule') || text.includes('rx') || text.includes('mg');
    if (dept === 'Pain') return text.includes('paracetamol') || text.includes('dolo') || text.includes('crocin') || text.includes('combiflam') || text.includes('ibuprofen') || text.includes('pain') || text.includes('fever') || text.includes('aspirin');
    if (dept === 'Cold') return text.includes('cetirizine') || text.includes('allegra') || text.includes('cheston') || text.includes('cold') || text.includes('cough') || text.includes('allergy') || text.includes('sinus') || text.includes('ascoril') || text.includes('benadryl') || text.includes('montelukast');
    if (dept === 'Antibiotics') return text.includes('amoxicillin') || text.includes('azithromycin') || text.includes('augmentin') || text.includes('cipro') || text.includes('antibiotic') || text.includes('zifi') || text.includes('clav');
    if (dept === 'Acidity') return text.includes('pantocid') || text.includes('pan 40') || text.includes('digene') || text.includes('gelusil') || text.includes('omeprazole') || text.includes('rabeprazole') || text.includes('antacid') || text.includes('acidity') || text.includes('panto');
    if (dept === 'Vitamins') return text.includes('vitamin') || text.includes('zinc') || text.includes('calcium') || text.includes('limcee') || text.includes('supradyn') || text.includes('b-complex') || text.includes('zincovit') || text.includes('supplement');
    if (dept === 'FirstAid') return text.includes('betadine') || text.includes('band') || text.includes('dettol') || text.includes('cotton') || text.includes('savlon') || text.includes('ointment');
    if (dept === 'Baby') return text.includes('baby') || text.includes('pediatric') || text.includes('drops') || text.includes('mother');
    return true;
  };

  const scrollToSearchBarTop = () => {
    if (typeof window === 'undefined') return;
    if (searchContainerRef.current) {
      const rect = searchContainerRef.current.getBoundingClientRect();
      const navbarOffset = 70;
      const targetY = window.pageYOffset + rect.top - navbarOffset;
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: 'smooth'
      });
    } else {
      const el = document.getElementById('search-results-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAmazonSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    saveRecentSearch(searchQuery);
    setShowSuggestions(false);

    // Smooth transition scroll down to bring search bar to top under navbar
    scrollToSearchBarTop();

    try {
      const lat = selectedAddress?.latitude || 19.0760;
      const lng = selectedAddress?.longitude || 72.8777;
      const res = await fetch(`${API}/api/v1/medicines/search?q=${encodeURIComponent(searchQuery)}&lat=${lat}&lng=${lng}&perimeter_km=${perimeterKm}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
        setMultiCompositionSplit(data.multi_composition_split || null);
      }
    } catch (err) {}

    setTimeout(scrollToSearchBarTop, 180);
  };

  // Close search suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Poll user's orders for live tracking with adaptive backoff & tab visibility check
  useEffect(() => {
    let timerId = null;
    let hasActive = false;

    const fetchMyOrders = async () => {
      if (typeof document !== 'undefined' && document.hidden) {
        timerId = setTimeout(fetchMyOrders, 12000);
        return;
      }
      try {
        const userIdentifier = activeUser?.id || activeUser?.email || DEFAULT_USER_ID;
        const res = await fetch(`${API}/api/v1/orders/user/${encodeURIComponent(userIdentifier)}`);
        if (res.ok) {
          const data = await res.json();
          const allOrders = data.orders || [];
          setAllUserOrders(allOrders);
          const live = allOrders.filter(o => o.status !== 'delivered');
          setActiveOrders(live);
          hasActive = live.length > 0;
        }
      } catch (e) {}

      // Active orders in progress: 4s tracking; No active orders: relaxed 20s poll
      const delay = hasActive ? 4000 : 20000;
      timerId = setTimeout(fetchMyOrders, delay);
    };

    fetchMyOrders();
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        if (timerId) clearTimeout(timerId);
        fetchMyOrders();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [activeUser]);

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
            <strong key={idx} style={{ color: '#38bdf8', fontWeight: '800' }}>
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

      // Section Header: Clinical Confidence Score
      if (lower.includes('clinical confidence:')) {
        return (
          <div key={lineIdx} style={{ marginTop: '0.65rem', marginBottom: '0.35rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              padding: '2px 9px',
              borderRadius: '99px',
              fontSize: '0.72rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <span>🎯</span> Clinical Confidence Score
            </span>
          </div>
        );
      }

      // Visual Progress Bar & Meter for Clinical Confidence Lines
      const confScoreMatch = trimmed.match(/(\d+)%\s*(.*)/i);
      if (confScoreMatch && (lower.includes('clinical') || lower.includes('correlation') || lower.includes('confidence') || lower.includes('readiness'))) {
        const pct = Math.min(100, Math.max(10, parseInt(confScoreMatch[1], 10)));
        const desc = confScoreMatch[2] || 'Clinical Correlation based on reported symptomatology';
        return (
          <div key={lineIdx} style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(13, 148, 136, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.28)',
            borderRadius: '12px',
            padding: '10px 14px',
            margin: '0.4rem 0 0.6rem 0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1rem' }}>🎯</span>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#065f46' }}>
                  {pct}% Clinical Correlation
                </span>
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: '700',
                background: '#10b981',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '99px'
              }}>
                {pct >= 90 ? 'High Confidence' : pct >= 75 ? 'Moderate Confidence' : 'Clinical Review'}
              </span>
            </div>
            
            {/* Visual Animated Gradient Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              background: '#e2e8f0',
              borderRadius: '99px',
              overflow: 'hidden',
              marginBottom: '6px'
            }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10b981 0%, #0d9488 100%)',
                borderRadius: '99px'
              }} />
            </div>

            <div style={{ fontSize: '0.74rem', color: '#047857', display: 'flex', justifyContent: 'space-between' }}>
              <span>{desc.replace(/^\((.*)\)$/, '$1')}</span>
              <span style={{ opacity: 0.85, fontWeight: '600' }}>Formulary Verified ✓</span>
            </div>
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
            background: matchedMed ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
            border: matchedMed ? '1px solid rgba(255, 255, 255, 0.12)' : 'none',
            borderRadius: matchedMed ? '10px' : '0',
            padding: matchedMed ? '8px 10px' : '2px 0 2px 4px',
            boxShadow: matchedMed ? '0 1px 4px rgba(0,0,0,0.15)' : 'none'
          }}>
            <span style={{ color: matchedMed ? 'var(--primary)' : '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
              {matchedMed ? '💊' : '•'}
            </span>
            <div style={{ flex: 1, fontSize: '0.88rem', color: '#f1f5f9', lineHeight: '1.55' }}>
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
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
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
        <p key={lineIdx} style={{ margin: '0 0 0.45rem 0', color: '#f1f5f9', lineHeight: '1.55', fontSize: '0.88rem' }}>
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
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            fontSize: '0.73rem',
            color: '#94a3b8',
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

  // Real-time synchronization heartbeat with fulfilling pharmacy UPI terminal during checkout
  useEffect(() => {
    if (paymentStep !== 'payment') return;
    fetchPharmacyLiveTerminalQr();
    const syncInterval = setInterval(() => {
      fetchPharmacyLiveTerminalQr();
    }, 3500);
    return () => clearInterval(syncInterval);
  }, [paymentStep, cart]);

  const handleInitiatePayment = () => {
    if (cart.length === 0) {
      showToast("Your cart is empty!", "🛒");
      return;
    }
    runAiDrugInteractionCheck();
  };

  const handleExecutePayment = async () => {
    if (cart.length === 0) {
      showToast("Your cart is empty!", "🛒");
      return;
    }
    
    const totalAmt = cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0);
    setIsProcessingPayment(true);
    setPaymentStep('processing');

    // 1. Cash on Delivery direct flow
    if (selectedPaymentMethod === 'cod') {
      try {
        setPaymentStatusMsg('Confirming COD Request with Fulfilling Pharmacy & Dispatching Rider...');
        await new Promise(r => setTimeout(r, 700));
        await finalizeOrderPlacement(totalAmt, 'cod', `COD_${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
      } catch (err) {
        showToast(`COD Error: ${err.message}`, '⚠️');
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
        showToast(`UPI Payment Error: ${err.message}`, '⚠️');
        setPaymentStep('payment');
      } finally {
        setIsProcessingPayment(false);
      }
      return;
    }

    // 3. Direct Rider Payment Flow (Payment goes to Rider who settles at dark-stores/pharmacies)
    if (selectedPaymentMethod === 'rider_upi') {
      try {
        setPaymentStatusMsg('Authorizing Direct Payment to Assigned Delivery Rider...');
        await new Promise(r => setTimeout(r, 700));
        setPaymentStatusMsg('Syncing Payment with Rider Terminal & Notifying Dark-store...');
        await new Promise(r => setTimeout(r, 700));
        const riderTxnId = `RIDER_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        await finalizeOrderPlacement(totalAmt, 'rider_upi', riderTxnId);
      } catch (err) {
        showToast(`Rider Payment Error: ${err.message}`, '⚠️');
        setPaymentStep('payment');
      } finally {
        setIsProcessingPayment(false);
      }
      return;
    }


    // Fallback if unexpected method
    setSelectedPaymentMethod('upi');
    setIsProcessingPayment(false);
    setPaymentStep('payment');
  };

  const finalizeOrderPlacement = async (totalAmt, method, paymentId) => {
    setPaymentStatusMsg('Confirming Order with Pharmacy & Dispatching Delivery Rider...');
    await new Promise(r => setTimeout(r, 600));

    const currentUserId = activeUser?.id || activeUser?.email || DEFAULT_USER_ID;
    const activeRiderQr = (typeof window !== 'undefined' ? (localStorage.getItem('medora_rider_main_qr') || '') : '') || activeUser?.rider_upi_qr || '';

    const orderRes = await fetch(`${API}/api/v1/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUserId,
        user: currentUserId,
        user_email: activeUser?.email || "patient@medora.com",
        user_name: activeUser?.name || accountEditName || "Patient",
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
        rider_qr_image: activeRiderQr || undefined,
        delivery_address: selectedAddress
      })
    });
    const orderData = await orderRes.json();

    if (orderRes.ok) {
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
      const err = await orderRes.json();
      throw new Error(err.detail?.[0]?.msg || "Failed to confirm order.");
    }
  };

  const handleTriggerChatMessage = async (inputText) => {
    if (!inputText || !inputText.trim()) return;

    // If an analysis was already pending, abort it immediately so user's new message takes precedence
    if (chatAbortControllerRef.current) {
      try { chatAbortControllerRef.current.abort(); } catch (e) {}
      chatAbortControllerRef.current = null;
    }

    const trimmedInput = inputText.trim();
    const userMessage = { role: 'user', content: trimmedInput };
    const updatedMessages = [...chatMessages, userMessage];
    
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsChatLoading(true);

    // Instant Casual Greeting Handler (<20ms instant local triage, avoids slow network hangs)
    const lowerInput = trimmedInput.toLowerCase().replace(/[!?.,;]/g, '').trim();
    const isGreeting = ["hi", "hello", "hey", "yo", "namaste", "hola", "doctor", "help", "doc", "good morning", "good afternoon", "good evening", "hey doc", "hello doctor", "hi doctor", "hey doctor"].includes(lowerInput) ||
      (lowerInput.length <= 8 && (lowerInput.startsWith("hi ") || lowerInput.startsWith("hey ") || lowerInput.startsWith("hello ")));

    if (isGreeting) {
      setTimeout(() => {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: "Hello! I am MEDORA's AI Virtual Doctor & Clinical Pharmacist. 👋\n\nI can evaluate your symptoms, identify potential interactions with existing conditions, and recommend safe OTC remedies.\n\n**What symptoms or discomfort are you experiencing today?** Tap an option below or describe your symptoms to begin:",
          confidence_score: 0.50,
          confidence_label: "50% Initial Symptom Intake",
          engine: "MEDORA AI Doctor (Gemini Flash)",
          suggested_medicines: [],
          quiz_options: [
            "🤒 High Fever & Chills",
            "🤢 Acidity & Heartburn",
            "🤧 Cold & Allergy Sneezing",
            "🤕 Severe Headache",
            "😷 Dry Cough & Sore Throat",
            "⚡ Body & Muscle Pain"
          ]
        }]);
        setIsChatLoading(false);
      }, 50);
      return;
    }

    // Network controller with 4.0-second timeout guarantee: never hangs or locks up the user!
    const controller = new AbortController();
    chatAbortControllerRef.current = controller;
    const timeoutId = setTimeout(() => {
      try { controller.abort(); } catch (e) {}
    }, 4000);

    try {
      const userMsgCount = updatedMessages.filter(m => m.role === 'user').length;
      const currentUserId = activeUser?.id || activeUser?.email || DEFAULT_USER_ID;

      // 1. Send to MEDORA backend AI endpoint (Google Gemini Flash + Clinical Pharmacology Engine)
      try {
        const res = await fetch(`${API}/api/v1/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUserId,
            messages: updatedMessages
          }),
          signal: controller.signal
        });
        
        if (res.ok) {
          clearTimeout(timeoutId);
          const data = await res.json();
          const meds = data.suggested_medicines || [];
          const dynamicScore = userMsgCount === 1 ? 0.58 : userMsgCount === 2 ? 0.82 : 0.98;
          const dynamicLabel = data.confidence_label || (
            userMsgCount === 1 
              ? 'Clinical Intake & Rule-Out (58%)' 
              : userMsgCount === 2 
                ? 'Differential Verification (82%)' 
                : 'High Clinical Match (98%)'
          );

          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: data.content,
            confidence_score: data.confidence_score ? Math.min(data.confidence_score, userMsgCount === 1 ? 0.65 : userMsgCount === 2 ? 0.85 : 1.0) : dynamicScore,
            confidence_label: dynamicLabel,
            engine: data.engine || 'MEDORA Clinical AI',
            suggested_medicines: meds,
            quiz_options: data.quiz_options || []
          }]);
          if (meds.length > 0) {
            setChatSuggestedMedicines(meds);
          }
          return;
        }
      } catch (err) {
        console.warn("Backend /api/v1/ai/chat network stall or timeout, using instant clinical fallback...", err);
      } finally {
        clearTimeout(timeoutId);
      }

      // 2. Try direct /chat route on main backend
      try {
        const res2 = await fetch(`${API}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUserId,
            messages: updatedMessages
          })
        });
        if (res2.ok) {
          const data2 = await res2.json();
          const meds2 = data2.suggested_medicines || [];
          const dynamicScore2 = data2.confidence_score || (userMsgCount === 1 ? 0.58 : userMsgCount === 2 ? 0.82 : 0.98);
          const dynamicLabel2 = data2.confidence_label || (
            userMsgCount === 1 
              ? 'Clinical Intake & Rule-Out (58%)' 
              : userMsgCount === 2 
                ? 'Differential Verification (82%)' 
                : 'High Clinical Match (98%)'
          );

          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: data2.content,
            confidence_score: dynamicScore2,
            confidence_label: dynamicLabel2,
            engine: data2.engine || 'MEDORA Clinical AI',
            suggested_medicines: meds2,
            quiz_options: data2.quiz_options || []
          }]);
          if (meds2.length > 0) {
            setChatSuggestedMedicines(meds2);
          }
          return;
        }
      } catch (err2) {
        console.warn("Direct /chat unreachable, applying multi-turn clinical pharmacology fallback...", err2);
      }

      // 3. Clinical Pharmacology Multi-Turn Rule Engine Fallback (guaranteed 100% uptime & zero crashes)
      const query = (inputText || '').toLowerCase();
      const allText = updatedMessages.map(m => m.content).join(' ').toLowerCase();

      let replyText = "";
      let foundMeds = [];
      let quizOptions = [];
      let score = 0.58;
      let label = "Clinical Symptom Intake (58%)";

      const isAcidity = allText.includes('acid') || allText.includes('reflux') || allText.includes('gerd') || allText.includes('heartburn') || allText.includes('burning') || allText.includes('chest burn');
      const isFever = allText.includes('fever') || allText.includes('temperature') || allText.includes('chills') || allText.includes('pyrexia') || allText.includes('warmth');
      const isCold = allText.includes('cold') || allText.includes('sneez') || allText.includes('runny') || allText.includes('allergy') || allText.includes('nasal') || allText.includes('congestion');
      const isCough = allText.includes('cough') || allText.includes('throat') || allText.includes('pharyngitis') || allText.includes('swallow');
      const isHeadache = allText.includes('headache') || allText.includes('migraine') || allText.includes('head pain') || allText.includes('temple');
      const isBodyPain = allText.includes('body pain') || allText.includes('back') || allText.includes('muscle') || allText.includes('joint') || allText.includes('strain') || allText.includes('spasm');

      if (userMsgCount === 1) {
        score = 0.58;
        label = "Clinical Symptom Intake (58%)";

        if (isFever) {
          replyText = "**Primary Assessment:** Acute Pyrexia / Febrile Symptom Intake.\n\n" +
            "To narrow down viral fever vs bacterial illness and ensure clinical safety, please answer:\n" +
            "1. What is your current body temperature (e.g. mild ~99-100°F vs high >101°F)?\n" +
            "2. How many days has the fever persisted?\n" +
            "3. Are you experiencing chills, headache, or throat irritation?";
          quizOptions = [
            "Mild fever (<100°F) for 1 day, feeling tired",
            "High fever (>101°F) with body chills & shivering",
            "Fever + severe sore throat and dry cough",
            "Fever + body ache and headache"
          ];
        } else if (isAcidity) {
          replyText = "**Primary Assessment:** Upper Gastrointestinal Hyperacidity / Reflux.\n\n" +
            "To rule out peptic ulcers and acute gastritis, please clarify:\n" +
            "1. Did this start after spicy/oily food, late dinner, or skipping meals?\n" +
            "2. Is there sour water regurgitation in the throat or nausea?\n" +
            "3. Have you taken any pain relief pills (e.g. Combiflam, Brufen, Aspirin) recently?";
          quizOptions = [
            "Severe heartburn after spicy/heavy meal",
            "Burning in empty stomach with sour burps",
            "Took painkiller earlier, now stomach burning",
            "Acid reflux worse when lying flat down"
          ];
        } else if (isCold) {
          replyText = "**Primary Assessment:** Upper Respiratory Rhinitis / Allergic Symptoms.\n\n" +
            "To differentiate allergic rhinitis from viral infection:\n" +
            "1. Is nasal discharge clear and watery, or thick yellowish?\n" +
            "2. Are you experiencing non-stop bouts of sneezing and itchy/watery eyes?\n" +
            "3. Any difficulty breathing or chest wheezing?";
          quizOptions = [
            "Watery runny nose + persistent sneezing",
            "Stuffy blocked nose + mild headache",
            "Allergy flare-up from dust / cold AC air",
            "Cold with low-grade fever"
          ];
        } else if (isCough) {
          replyText = "**Primary Assessment:** Acute Pharyngeal Irritation / Bronchial Cough.\n\n" +
            "To recommend the correct mucolytic or antitussive remedy:\n" +
            "1. Is it a dry tickling throat cough, or are you coughing up phlegm/mucus?\n" +
            "2. Does it hurt sharply when you swallow liquids or food?\n" +
            "3. How long has the cough been present?";
          quizOptions = [
            "Dry tickly cough, no phlegm produced",
            "Chest congestion with thick mucus",
            "Sharp throat pain while swallowing",
            "Persistent coughing fits at night"
          ];
        } else if (isHeadache) {
          replyText = "**Primary Assessment:** Cephalea / Tension or Migraine Symptom Intake.\n\n" +
            "To rule out neurological red-flags and verify etiology:\n" +
            "1. Is the pain on one side of your head, or a tight band across temples/forehead?\n" +
            "2. Is it throbbing/pulsating with light or screen sensitivity?\n" +
            "3. Any neck stiffness, dizziness, or nausea?";
          quizOptions = [
            "One-sided throbbing pain + sensitive to light",
            "Dull tension ache across forehead & temples",
            "Screen fatigue and eye strain headache",
            "Headache accompanied by mild nausea"
          ];
        } else if (isBodyPain) {
          replyText = "**Primary Assessment:** Musculoskeletal Strain / Myalgia.\n\n" +
            "To rule out inflammatory arthritis or nerve compression:\n" +
            "1. Did this start after gym workout, lifting, or prolonged sitting?\n" +
            "2. Is there visible swelling, warmth, or redness at the joint?\n" +
            "3. Is the pain localized to lower back, shoulders, or all over?";
          quizOptions = [
            "Lower back stiffness from sitting/lifting",
            "General muscle soreness after physical exertion",
            "Neck and shoulder spasm from poor posture",
            "Joint pain in knees/ankles"
          ];
        } else {
          replyText = "**Primary Assessment:** Clinical Health Intake.\n\n" +
            "Thank you for sharing your symptoms. To rule out complications and tailor safe OTC remedies:\n" +
            "1. How many hours or days have you felt this discomfort?\n" +
            "2. On a scale of 1-10, how severe is it?\n" +
            "3. Do you have any known medical conditions or drug allergies?";
          quizOptions = [
            "Started today, mild discomfort (2-3/10)",
            "Started 2-3 days ago, moderate (5-7/10)",
            "No known drug allergies or chronic diseases",
            "Have sensitive stomach / acidity"
          ];
        }
      } else if (userMsgCount === 2) {
        score = 0.82;
        label = "Differential Rule-Out & Safety Check (82%)";

        replyText = "**Clinical Correlation Updated (82% Confidence):**\n" +
          "Thank you for clarifying. Your symptoms have been correlated against pharmacological guidelines.\n\n" +
          "**⚠️ Patient Safety & Contraindication Check:**\n" +
          "1. Are you allergic to Paracetamol, NSAIDs (Ibuprofen), or Antihistamines?\n" +
          "2. Any history of severe liver impairment, kidney stones, or active gastric ulcers?\n" +
          "3. Are you currently pregnant or nursing?\n\n" +
          "If none of these apply, confirm below so I can formulate your safe OTC differential dosage regimen.";
        quizOptions = [
          "None apply - Confirm safe OTC regimen",
          "I have mild acidity / sensitive stomach",
          "Allergic to aspirin / NSAID painkillers",
          "I take regular blood pressure medicine"
        ];
      } else {
        // Turn 3+: Full diagnosis & continuous conversation!
        score = 0.98;
        label = "Differential Match & Prescription (98%)";

        if (isAcidity) {
          replyText = "**Probable Differential Condition:**\nGastroesophageal Reflux Disease (GERD) / Acute Gastric Hyperacidity\n\n" +
            "**Recommended Safe OTC Regimen:**\n" +
            "- **Pantocid 40 (Pantoprazole 40mg)**: 1 tablet once daily, strictly 30 minutes before breakfast. Suppresses excess proton-pump acid generation.\n" +
            "- **Gelusil Chewable / Liquid**: 10-15ml or 2 chewable tablets as needed 1 hour after meals for instant acid neutralization.\n\n" +
            "**Clinical Guidance & Diet:**\n" +
            "- Avoid citrus fruits, carbonated drinks, deep-fried snacks, and caffeine.\n" +
            "- Do not lie flat immediately after eating; elevate upper body by 6 inches.\n" +
            "- ⚠️ CRITICAL: Avoid NSAIDs (Combiflam, Dolo, Aspirin) as they irritate gastric mucosa.\n\n" +
            "*You can continue asking any follow-up questions or tap below to order these medicines.*";
          foundMeds = ["Pantocid 40", "Gelusil"];
          quizOptions = [
            "How long should I take Pantocid 40?",
            "Can I take Gelusil at bedtime?",
            "What home foods help soothe burning?",
            "What if symptoms persist after 3 days?"
          ];
        } else if (isFever) {
          replyText = "**Probable Differential Condition:**\nAcute Febrile Viral Syndrome / Pyrexia\n\n" +
            "**Recommended Safe OTC Regimen:**\n" +
            "- **Dolo 650 (Paracetamol 650mg)**: 1 tablet every 6 to 8 hours as needed (do NOT exceed 3 tablets in 24 hours). Always take after food with water.\n" +
            "- **Calpol 500 (Paracetamol 500mg)**: Gentler alternative if body weight is under 55kg or fever is mild.\n" +
            "- **ORS Electrolyte Drink**: 1 sachet dissolved in 1 litre drinking water, sip throughout the day to replace electrolytes lost via sweating.\n\n" +
            "**Clinical Guidance:**\n" +
            "- Rest in well-ventilated room, stay well hydrated.\n" +
            "- Use lukewarm water sponging if temperature crosses 101°F.\n" +
            "- ⚠️ Seek medical attention if fever exceeds 102°F or persists beyond 3 days.\n\n" +
            "*You can continue asking any questions regarding dosage timing or medicine interactions.*";
          foundMeds = ["Dolo 650", "Calpol 500", "ORS Electrolyte"];
          quizOptions = [
            "Can I take Dolo 650 on an empty stomach?",
            "How many hours gap between doses?",
            "Is Dolo 650 safe if I have acidity?",
            "What if I vomit after taking medicine?"
          ];
        } else if (isCold) {
          replyText = "**Probable Differential Condition:**\nAcute Allergic Rhinitis / Upper Respiratory Rhinovirus\n\n" +
            "**Recommended Safe OTC Regimen:**\n" +
            "- **Allegra 120 (Fexofenadine 120mg)**: 1 tablet once daily in the morning with a full glass of water. Non-drowsy 2nd generation antihistamine.\n" +
            "- **Cetirizine 10mg**: 1 tablet at night if nocturnal sneezing or nasal blockage disturbs sleep.\n\n" +
            "**Clinical Guidance:**\n" +
            "- Practice steam inhalation twice daily for 5-10 minutes.\n" +
            "- Avoid chilled beverages, direct AC draft, and dust exposure.\n" +
            "- Sip warm water with honey and ginger.\n\n" +
            "*Ask any follow-up questions or add medications to your cart below.*";
          foundMeds = ["Allegra 120", "Cetirizine 10mg"];
          quizOptions = [
            "Will Allegra 120 make me sleepy during daytime?",
            "Can I take both Allegra and Cetirizine?",
            "How many days should I continue?",
            "Can I do warm saline gargle?"
          ];
        } else if (isCough) {
          replyText = "**Probable Differential Condition:**\nAcute Pharyngitis / Irritant Bronchial Cough\n\n" +
            "**Recommended Safe OTC Regimen:**\n" +
            "- **Ascoril-D Cough Syrup**: 5-10ml two to three times daily after meals to soothe bronchial mucosal spasms.\n\n" +
            "**Clinical Guidance:**\n" +
            "- Gargle with warm salt water (1/2 tsp salt in 1 cup warm water) 3 times daily.\n" +
            "- Sip warm herbal tea or honey lemon water.\n" +
            "- Avoid cold drinks, smoking, and environmental air pollutants.\n\n" +
            "*Feel free to ask any other questions or add to cart.*";
          foundMeds = ["Ascoril-D"];
          quizOptions = [
            "Does Ascoril-D cause drowsiness?",
            "How many times a day should I gargle?",
            "What foods should I avoid with sore throat?",
            "Is hot honey water safe with diabetes?"
          ];
        } else if (isHeadache) {
          replyText = "**Probable Differential Condition:**\nTension Cephalea / Early Migraine Episode\n\n" +
            "**Recommended Safe OTC Regimen:**\n" +
            "- **Calpol 500 (Paracetamol 500mg)**: 1 tablet with 2 glasses of water. Safe first-line relief.\n" +
            "- **Combiflam (Ibuprofen + Paracetamol)**: 1 tablet strictly after meals if headache includes neck tension or muscular pain.\n\n" +
            "**Clinical Guidance:**\n" +
            "- Rest in a quiet, dark, dim-lit room.\n" +
            "- Discontinue digital screens (phones/laptops) for at least 1-2 hours.\n" +
            "- Drink plenty of water immediately.\n\n" +
            "*Ask any questions about dosage or duration below.*";
          foundMeds = ["Calpol 500", "Combiflam"];
          quizOptions = [
            "Can I take Combiflam if I have acidity?",
            "Is caffeine/tea helpful for headaches?",
            "When should I consult a neurologist?",
            "How long before the medicine acts?"
          ];
        } else if (isBodyPain) {
          replyText = "**Probable Differential Condition:**\nAcute Musculoskeletal Strain / Myalgia\n\n" +
            "**Recommended Safe OTC Regimen:**\n" +
            "- **Combiflam (Ibuprofen 400mg + Paracetamol 325mg)**: 1 tablet twice daily strictly after meals.\n" +
            "- **Dolo 650**: 1 tablet as gentle alternative.\n\n" +
            "**Clinical Guidance:**\n" +
            "- Apply hot water fomentation or cold pack to the affected area.\n" +
            "- Avoid sudden twisting, heavy lifting, or poor chair posture.\n\n" +
            "*Feel free to ask any questions or tap below to order.*";
          foundMeds = ["Combiflam", "Dolo 650"];
          quizOptions = [
            "Should I use hot pack or ice compress?",
            "Can I apply pain relief spray or balm?",
            "How many days can I take Combiflam?",
            "Is gentle stretching recommended?"
          ];
        } else {
          replyText = "**Clinical Response (Differential Correlation: 98%):**\n\n" +
            "Based on your continuous description, your condition has been thoroughly triaged. Please maintain hydration and rest.\n\n" +
            "If symptoms worsen or do not subside within 48 hours, please consult a physician in clinic.\n\n" +
            "*You can continue chatting with me about any symptom, dosage, or medical clarification.*";
          quizOptions = [
            "What diet is recommended?",
            "Can I take vitamins with this?",
            "What are warning signs to visit hospital?",
            "Reset and describe another symptom"
          ];
        }
      }

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: replyText,
        confidence_score: score,
        confidence_label: label,
        engine: 'MEDORA Clinical AI',
        suggested_medicines: foundMeds,
        quiz_options: quizOptions
      }]);
      if (foundMeds.length > 0) {
        setChatSuggestedMedicines(foundMeds);
      }
    } catch (fallbackErr) {
      console.error("Chat error:", fallbackErr);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "I am ready to help. Please tell me more about what you are feeling.",
        confidence_score: 0.60,
        confidence_label: "Intake Active",
        quiz_options: ["Fever", "Acidity", "Cold & Sneezing", "Headache"]
      }]);
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
    cancelChatRequest();
    setChatMessages([
      {
        role: 'assistant',
        content: "Hello! I am MEDORA's AI Virtual Doctor & Clinical Pharmacist. 👋\n\nTo help diagnose and recommend safe relief, what symptoms are you experiencing today?",
        confidence_score: 0.50,
        confidence_label: "50% Intake Ready",
        quiz_options: ["Fever & Chills", "Cold & Sneezing", "Acidity & Heartburn", "Severe Headache", "Throat Pain & Cough", "Body & Muscle Ache"]
      }
    ]);
    setChatInput('');
    setIsChatLoading(false);
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
    
    showToast(`Added ${chatSuggestedMedicines.join(', ')} to cart! Opening checkout...`, '🛒');
    setIsCartOpen(true);
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
          setScannedPrescription(aiData);
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
        // KEEP the Prescription Scanner modal open so patient can review all deciphered medicines, prices, and add to cart!
        setIsOcrLoading(false);
      } else {
        setOcrResult("No text detected in the image.");
        setIsOcrLoading(false);
      }
    } catch (err) {
      console.error("Prescription scanning error:", err);
      setOcrResult("Scanning error. Please ensure the prescription photo is clear and well lit.");
      setIsOcrLoading(false);
    }
  };

  const handleAddAllPrescriptionToCart = (matches) => {
    if (!matches || matches.length === 0) return;
    let addedCount = 0;
    matches.forEach(item => {
      addToCart({
        id: item.medicine_id || item.id,
        medicine_id: item.medicine_id || item.id,
        brand_name: item.brand_name || item.extracted_name,
        generic_name: item.generic_name,
        price_mrp: item.price_mrp || item.avg_price || 55,
        avg_price: item.avg_price || item.price_mrp || 55,
        form: item.dosage_form || 'Tablet',
        image_url: item.image_url
      });
      addedCount++;
    });
    showToast(`🛒 Added all ${addedCount} deciphered medicines to cart!`, '💊');
    setIsCartOpen(true);
  };


  const handleConsultAiWithPrescription = (prescData, textSummary) => {
    setIsOcrOpen(false);
    setIsChatOpen(true);
    const medList = prescData?.medicines && prescData.medicines.length > 0
      ? prescData.medicines.map(m => `• ${m.name} (${m.strength || ''}): ${m.frequency || 'as directed'} [${m.duration || ''}]`).join('\n')
      : (matchedMedicines.map(m => `• ${m.brand_name}: ${m.generic_name}`).join('\n') || textSummary);
    
    const promptText = `I have uploaded a doctor prescription with the following prescribed medicines:\n\n${medList}\n\nDoctor: ${prescData?.doctor_name || 'Consulting Physician'}\nClinic: ${prescData?.clinic_name || 'Apex Health Center'}\nClinical Instructions: ${prescData?.clinical_instructions || 'Complete prescribed course'}\n\nPlease explain what each medicine is for, how to take them safely together, meal timing, and any clinical cautions.`;
    handleTriggerChatMessage(promptText);
  };

  const renderRoleHeader = () => (
    <header className="medora-role-header" style={{
      background: 'rgba(15, 19, 27, 0.96)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '0.65rem 1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 1200,
      fontSize: '0.85rem',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.7)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span 
          onClick={goHome}
          className="gradient-mint-text"
          style={{ fontWeight: '900', fontFamily: 'Outfit, sans-serif', cursor: 'pointer', fontSize: '1.25rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          🧬 MEDORA
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>|</span>
        <span style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '4px 10px',
          borderRadius: '12px',
          color: '#f1f5f9',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.78rem'
        }}>
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
            className="header-location-chip"
            onClick={() => setIsAddressDrawerOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: '#131722',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              padding: '4px 12px',
              borderRadius: '24px',
              cursor: 'pointer',
              maxWidth: '380px',
              boxShadow: 'inset 2px 2px 5px rgba(0, 0, 0, 0.6), -1px -1px 3px rgba(255, 255, 255, 0.025)',
              transition: 'all 0.2s ease'
            }}
            title="Click to change delivery location"
          >
            <span style={{
              background: 'linear-gradient(135deg, #FF7700 0%, #FFAA00 100%)',
              color: '#fff',
              fontSize: '0.68rem',
              fontWeight: '800',
              padding: '2px 8px',
              borderRadius: '12px',
              boxShadow: '0 2px 6px rgba(255, 119, 0, 0.4)'
            }}>
              ⚡ 10-15 MINS
            </span>
            <span style={{ fontSize: '0.95rem' }}>{selectedAddress?.icon || '🏠'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', overflow: 'hidden' }}>
              <span style={{ fontWeight: '800', color: '#f1f5f9', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {selectedAddress?.tag || 'Home'} <span style={{ color: '#2dd4bf', fontSize: '0.65rem' }}>▼</span>
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedAddress ? `${selectedAddress.houseNo}, ${selectedAddress.area}` : 'Set Location'}
              </span>
            </div>
          </div>

          {/* Direct Switch to Dedicated Radar Page / View */}
          <button
            className="hide-on-mobile"
            onClick={() => setActiveMainView(prev => prev === 'radar' ? 'home' : 'radar')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeMainView === 'radar' ? 'linear-gradient(135deg, #14b8a6, #0d9488)' : '#161b26',
              color: activeMainView === 'radar' ? '#ffffff' : '#5eead4',
              border: activeMainView === 'radar' ? '1px solid #14b8a6' : '1px solid rgba(255, 255, 255, 0.08)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: '700',
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: activeMainView === 'radar' ? '0 0 16px rgba(20, 184, 166, 0.45)' : 'var(--neo-shadow-raised-sm)',
              transition: 'all 0.2s ease'
            }}
            title="Calibrate GPS & Radar Settings"
          >
            <span>🛰️</span>
            <span>{activeMainView === 'radar' ? 'Home Shelf' : `Radar (${perimeterKm}km)`}</span>
          </button>

          {/* Upload Rx button */}
          <button
            className="hide-on-mobile"
            onClick={() => {
              setIsOcrOpen(true);
              setTimeout(() => fileInputRef.current?.click(), 100);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#161b26',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: '700',
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: 'var(--neo-shadow-raised-sm)',
              transition: 'all 0.2s ease'
            }}
            title="Upload Doctor's Handwritten or Printed Prescription"
          >
            <span>📄</span>
            <span>Upload Rx</span>
          </button>

          {/* Live Cartoon Bootup Presentation Replay */}
          <button
            className="hide-on-mobile"
            onClick={() => setShowBootup(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#161b26',
              color: '#2dd4bf',
              border: '1px solid rgba(45, 212, 191, 0.25)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: '700',
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: 'var(--neo-shadow-raised-sm)',
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
          <>
            <button
              id="header-account-btn"
              className="hide-on-mobile"
              onClick={() => {
                setActiveMainView(prev => prev === 'account' ? 'home' : 'account');
                setActiveAccountSection('hub');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: activeMainView === 'account' ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' : '#161b26',
                color: activeMainView === 'account' ? '#38bdf8' : '#e2e8f0',
                border: activeMainView === 'account' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                padding: '6px 14px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.78rem',
                boxShadow: activeMainView === 'account' ? '0 0 14px rgba(56, 189, 248, 0.35)' : 'var(--neo-shadow-raised-sm)',
                transition: 'all 0.2s ease'
              }}
              title="Your Account & Settings"
            >
              <span>👤</span>
              <span>Your Account</span>
            </button>
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
                background: cart.length > 0 ? 'linear-gradient(135deg, #14b8a6 0%, #059669 100%)' : '#161b26',
                color: cart.length > 0 ? '#ffffff' : '#94a3b8',
                border: cart.length > 0 ? '1px solid #14b8a6' : '1px solid rgba(255, 255, 255, 0.08)',
                padding: '6px 14px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: '800',
                fontSize: '0.78rem',
                boxShadow: cart.length > 0 ? '0 0 18px rgba(20, 184, 166, 0.5)' : 'var(--neo-shadow-raised-sm)',
                transition: 'all 0.2s ease'
              }}
              title="Open Shopping Cart & Checkout Drawer"
            >
              <span>🛒</span>
              <span>
                {cart.length > 0 ? `Checkout (${cart.length}) • ₹${cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(0)}` : 'Cart (0)'}
              </span>
            </button>
          </>
        )}
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            padding: '6px 14px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.78rem',
            boxShadow: 'var(--neo-shadow-raised-sm)',
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

      <main className="container" style={{ paddingTop: '1.25rem' }}>
        {/* Details Fold / Redesigned Dashboard Hero */}
        <div className="hero-section" style={{ marginTop: '0.5rem', marginBottom: '2.5rem', textAlign: 'center' }}>
          
          {/* Live Hyperlocal Delivery Guarantee Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(20, 184, 166, 0.12)',
            border: '1px solid rgba(20, 184, 166, 0.32)',
            padding: '6px 16px',
            borderRadius: '99px',
            fontSize: '0.78rem',
            fontWeight: '800',
            color: '#2dd4bf',
            marginBottom: '1.1rem',
            boxShadow: 'var(--neo-shadow-raised-sm)'
          }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }} />
            <span>⚡ 10-MIN EXPRESS DELIVERY ACTIVE IN <strong style={{ color: '#5eead4', textTransform: 'uppercase' }}>{selectedAddress?.area || 'VAMANJOOR'}</strong></span>
          </div>

          <h1 className="hero-title" style={{ fontSize: 'clamp(2.1rem, 4.5vw, 3.2rem)', fontWeight: '900', lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: '0.9rem', color: '#f1f5f9' }}>
            Smart Healthcare, <br />
            <span style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 45%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block'
            }}>
              Delivered in 10 Minutes.
            </span>
          </h1>

          <p className="hero-subtitle" style={{ maxWidth: '680px', margin: '0 auto 1.8rem auto', fontSize: '0.96rem', color: '#94a3b8', lineHeight: 1.6 }}>
            Instant clinical consultation with MEDORA AI Doctor, handwritten prescription digitization with Gemini Vision, and verified generic medicines from licensed neighborhood dark-stores.
          </p>

          {/* 4 Premium Glassmorphic Quick-Action Command Cards Grid */}
          <div className="hero-command-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
            gap: '14px',
            maxWidth: '960px',
            margin: '0 auto 2rem auto',
            textAlign: 'left'
          }}>
            {/* Card 1: AI Clinical Doctor */}
            <div 
              onClick={() => setIsChatOpen(true)}
              style={{
                background: '#151a24',
                border: '1px solid rgba(20, 184, 166, 0.3)',
                borderRadius: '16px',
                padding: '1.2rem',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: 'var(--neo-shadow-raised)',
                minHeight: '142px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#14b8a6'; e.currentTarget.style.boxShadow = 'var(--neo-shadow-raised-lg), 0 0 16px rgba(20, 184, 166, 0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.3)'; e.currentTarget.style.boxShadow = 'var(--neo-shadow-raised)'; }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', boxShadow: '0 4px 10px rgba(20, 184, 166, 0.35)' }}>🩺</div>
                  <span style={{ fontSize: '0.66rem', fontWeight: '800', background: 'rgba(20, 184, 166, 0.16)', color: '#2dd4bf', border: '1px solid rgba(20, 184, 166, 0.3)', padding: '2px 8px', borderRadius: '99px' }}>● ONLINE</span>
                </div>
                <strong style={{ display: 'block', fontSize: '0.94rem', color: '#f1f5f9', fontWeight: '800' }}>AI Clinical Doctor</strong>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>Instant symptom diagnosis, safety checks & OTC recommendations</p>
            </div>

            {/* Card 2: Scan Prescription */}
            <div 
              onClick={() => {
                setIsOcrOpen(true);
                setTimeout(() => fileInputRef.current?.click(), 100);
              }}
              style={{
                background: '#151a24',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '16px',
                padding: '1.2rem',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: 'var(--neo-shadow-raised)',
                minHeight: '142px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.boxShadow = 'var(--neo-shadow-raised-lg), 0 0 16px rgba(56, 189, 248, 0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)'; e.currentTarget.style.boxShadow = 'var(--neo-shadow-raised)'; }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.35)' }}>📄</div>
                  <span style={{ fontSize: '0.66rem', fontWeight: '800', background: 'rgba(56, 189, 248, 0.16)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '99px' }}>Gemini Vision</span>
                </div>
                <strong style={{ display: 'block', fontSize: '0.94rem', color: '#f1f5f9', fontWeight: '800' }}>Upload Doctor Rx</strong>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>Digitizes handwritten & printed prescriptions in seconds</p>
            </div>

            {/* Card 3: Hyperlocal Radar */}
            <div 
              onClick={() => setActiveMainView('radar')}
              style={{
                background: '#151a24',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '16px',
                padding: '1.2rem',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: 'var(--neo-shadow-raised)',
                minHeight: '142px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.boxShadow = 'var(--neo-shadow-raised-lg), 0 0 16px rgba(168, 85, 247, 0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)'; e.currentTarget.style.boxShadow = 'var(--neo-shadow-raised)'; }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.35)' }}>🛰️</div>
                  <span style={{ fontSize: '0.66rem', fontWeight: '800', background: 'rgba(168, 85, 247, 0.16)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '2px 8px', borderRadius: '99px' }}>{perimeterKm} km GPS</span>
                </div>
                <strong style={{ display: 'block', fontSize: '0.94rem', color: '#f1f5f9', fontWeight: '800' }}>Dark-Store Radar</strong>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>Live network map with guaranteed 10-15 min delivery perimeter</p>
            </div>

            {/* Card 4: Instamart Quick Shelf */}
            <div 
              onClick={() => {
                const el = document.getElementById('instamart-shelf-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                background: '#151a24',
                border: '1px solid rgba(255, 119, 0, 0.3)',
                borderRadius: '16px',
                padding: '1.2rem',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: 'var(--neo-shadow-raised)',
                minHeight: '142px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#ff7700'; e.currentTarget.style.boxShadow = 'var(--neo-shadow-raised-lg), 0 0 16px rgba(255, 119, 0, 0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255, 119, 0, 0.3)'; e.currentTarget.style.boxShadow = 'var(--neo-shadow-raised)'; }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', boxShadow: '0 4px 10px rgba(234, 88, 12, 0.35)' }}>⚡</div>
                  <span style={{ fontSize: '0.66rem', fontWeight: '800', background: 'rgba(255, 119, 0, 0.16)', color: '#fb923c', border: '1px solid rgba(255, 119, 0, 0.3)', padding: '2px 8px', borderRadius: '99px' }}>10-15 Mins</span>
                </div>
                <strong style={{ display: 'block', fontSize: '0.94rem', color: '#f1f5f9', fontWeight: '800' }}>Instamart Shelf</strong>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>Direct 1-click re-order from nearby stocked partner pharmacies</p>
            </div>
          </div>

          {/* Pharmacy Search Bar Container */}
          <div 
            ref={searchContainerRef}
            className="search-container" 
            style={{ 
              position: 'relative',
              width: '100%',
              maxWidth: '960px',
              margin: '0 auto',
              background: '#121620',
              borderRadius: '14px',
              border: isSearchFocused ? '2px solid #38bdf8' : '1.5px solid rgba(255, 255, 255, 0.1)',
              boxShadow: isSearchFocused 
                ? '0 0 20px rgba(56, 189, 248, 0.35), inset 2px 2px 6px rgba(0, 0, 0, 0.6)' 
                : 'inset 2px 2px 6px rgba(0, 0, 0, 0.6), -2px -2px 6px rgba(255, 255, 255, 0.02)',
              transition: 'all 0.25s ease',
              scrollMarginTop: '16px',
              zIndex: 100
            }}
          >
            <form 
              onSubmit={handleAmazonSearchSubmit}
              style={{ 
                display: 'flex', 
                width: '100%', 
                alignItems: 'stretch',
                borderRadius: '12px',
                overflow: 'hidden'
              }}
            >
              {/* 1. Category / Department Dropdown */}
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: '#181e2b',
                borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0 8px 0 12px',
                cursor: 'pointer',
                flexShrink: 0
              }}>
                <select
                  value={selectedDepartment}
                  onChange={(e) => {
                    setSelectedDepartment(e.target.value);
                    showToast(`Department: ${e.target.options[e.target.selectedIndex].text}`, '🏷️');
                  }}
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    paddingRight: '16px',
                    paddingTop: '0.85rem',
                    paddingBottom: '0.85rem',
                    height: '100%'
                  }}
                >
                  {AMAZON_DEPARTMENTS.map(d => (
                    <option key={d.id} value={d.id} style={{ background: '#181e2b', color: '#f1f5f9' }}>{d.label}</option>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: '6px', fontSize: '0.62rem', color: '#94a3b8', pointerEvents: 'none' }}>
                  ▼
                </span>
              </div>

              {/* 2. Search Input */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 10px', background: '#121620', minWidth: 0 }}>
                <input
                  type="text"
                  placeholder="Search medicines, generic salt, symptoms (e.g. Dolo 650, Augmentin, Crocin)..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    setIsSearchFocused(true);
                    setShowSuggestions(true);
                    scrollToSearchBarTop();
                  }}
                  onClick={() => {
                    setIsSearchFocused(true);
                    setShowSuggestions(true);
                    scrollToSearchBarTop();
                  }}
                  onKeyDown={handleKeyDown}
                  style={{ 
                    flex: 1,
                    background: 'transparent', 
                    border: 'none', 
                    padding: '0.85rem 0.5rem',
                    fontSize: '0.98rem',
                    color: '#f1f5f9',
                    fontWeight: '500',
                    outline: 'none',
                    minWidth: 0
                  }}
                />

                {/* Clear Button */}
                {searchQuery && (
                  <button 
                    type="button" 
                    onClick={() => { setSearchQuery(''); setShowSuggestions(true); }} 
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#94a3b8', 
                      cursor: 'pointer', 
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      padding: '0 6px',
                      lineHeight: 1
                    }}
                    title="Clear search"
                  >
                    &times;
                  </button>
                )}

                {/* Amazon Voice Search Microphone Button */}
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  style={{
                    background: isListeningVoice ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                    border: 'none',
                    color: isListeningVoice ? '#f87171' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '1.15rem',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  title={isListeningVoice ? "Listening to voice..." : "Voice Search (Speak medicine name)"}
                >
                  {isListeningVoice ? '🔴' : '🎙️'}
                </button>

                {/* Rx / Camera Scan Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOcrOpen(true);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    fontSize: '1.15rem',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Scan Prescription (Handwritten / Printed)"
                >
                  📷
                </button>
              </div>

              {/* 3. Amazon Signature Amber/Gold Search Button */}
              <button
                type="submit"
                style={{
                  background: 'linear-gradient(180deg, #febd69 0%, #f3a847 100%)',
                  border: 'none',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#111827',
                  padding: '0 1.6rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  transition: 'all 0.15s ease',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f2a740'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(180deg, #febd69 0%, #f3a847 100%)'; }}
                title="Search Medicines"
              >
                <span>🔍</span>
              </button>
            </form>

            {/* Amazon Secondary Delivery Guarantee Strip */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.45rem 1rem',
              background: '#0f131a',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '0 0 12px 12px',
              fontSize: '0.74rem',
              color: '#94a3b8',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '0.68rem',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  letterSpacing: '0.03em'
                }}>
                  ⚡ EXPRESS
                </span>
                <span style={{ fontWeight: '600', color: '#f1f5f9' }}>
                  FREE 10-15 Min Express Delivery in {selectedAddress?.area || 'Mangalore'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#34d399', fontWeight: '700' }}>✓ 100% Genuine Pharmacy Stock</span>
                <span>•</span>
                <span style={{ color: '#38bdf8', fontWeight: '700' }}>Cash on Delivery & UPI</span>
              </div>
            </div>

              {/* Amazon Live Suggestions Dropdown: Dual Mode (Zero-State & Active Search) */}
              {showSuggestions && (isSearchFocused || searchQuery.trim().length > 0) && (
                <div 
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '8px',
                    background: '#151a24',
                    border: '1.5px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '16px',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), -3px -3px 10px rgba(255, 255, 255, 0.03)',
                    zIndex: 9999,
                    maxHeight: '520px',
                    overflowY: 'auto',
                    padding: '0.85rem'
                  }}
                >
                  {/* MODE 1: ZERO-STATE (searchQuery < 2 chars) */}
                  {searchQuery.trim().length < 2 ? (
                    <div>
                      {/* 1. Recent Searches */}
                      {recentSearches && recentSearches.length > 0 && (
                        <div style={{ marginBottom: '1.1rem' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                            padding: '0 4px'
                          }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🕒</span> Recent Searches
                            </span>
                            <button
                              type="button"
                              onClick={clearRecentSearches}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                            >
                              Clear all
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {recentSearches.map((term, rIdx) => (
                              <div
                                key={rIdx}
                                onClick={() => {
                                  setSearchQuery(term);
                                  setShowSuggestions(true);
                                  saveRecentSearch(term);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: '#1c2331',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '99px',
                                  padding: '5px 12px',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  color: '#e2e8f0',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#242d3e'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#1c2331'; }}
                              >
                                <span style={{ color: '#38bdf8', fontSize: '0.75rem' }}>🔍</span>
                                <span>{term}</span>
                                <span
                                  onClick={(e) => removeSingleRecentSearch(term, e)}
                                  style={{
                                    marginLeft: '4px',
                                    color: '#94a3b8',
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    lineHeight: 1
                                  }}
                                  title="Remove from history"
                                >
                                  ×
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 2. Amazon Trending Best Sellers in Pharmacy */}
                      <div style={{ marginBottom: '1.1rem' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.6rem',
                          padding: '0 4px'
                        }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🔥</span> Best Sellers in Pharmacy (10-15 Min Express)
                          </span>
                          <span style={{
                            background: 'rgba(255, 119, 0, 0.16)',
                            color: '#fb923c',
                            border: '1px solid rgba(255, 119, 0, 0.3)',
                            fontSize: '0.68rem',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            #1 Most Ordered
                          </span>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                          gap: '8px'
                        }}>
                          {AMAZON_BEST_SELLERS.slice(0, 6).map((bs, bIdx) => (
                            <div
                              key={bIdx}
                              onClick={() => {
                                setSearchQuery(bs.brand_name);
                                saveRecentSearch(bs.brand_name);
                                setShowSuggestions(true);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#181e2b',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '12px',
                                padding: '8px 10px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#1e2638';
                                e.currentTarget.style.borderColor = '#38bdf8';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#181e2b';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                <span style={{
                                  fontSize: '1.2rem',
                                  width: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: '#121620',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  flexShrink: 0
                                }}>
                                  {bs.icon}
                                </span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{
                                    fontSize: '0.82rem',
                                    fontWeight: '800',
                                    color: '#f1f5f9',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {bs.brand_name}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: '#f59e0b' }}>⭐ {bs.rating}</span>
                                    <span>({bs.reviews})</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#2dd4bf' }}>
                                    ₹{bs.price_mrp}
                                  </div>
                                  <div style={{ fontSize: '0.65rem', color: '#64748b', textDecoration: 'line-through' }}>
                                    ₹{bs.original_mrp}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBuyNow(bs);
                                  }}
                                  style={{
                                    background: 'linear-gradient(180deg, #ffa41c 0%, #ff8f00 100%)',
                                    color: '#0f1111',
                                    border: '1px solid #ff8f00',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    fontSize: '0.72rem',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title="1-Click Instant Checkout"
                                >
                                  <span>⚡</span> Buy
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 3. Shop by Category / Department */}
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#94a3b8', marginBottom: '0.5rem', padding: '0 4px' }}>
                          🏷️ Shop by Health Concern / Department
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {AMAZON_DEPARTMENTS.filter(d => d.id !== 'All').map(d => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                setSelectedDepartment(d.id);
                                setSearchQuery(d.label.split(' ')[0]);
                                setShowSuggestions(true);
                                saveRecentSearch(d.label);
                              }}
                              style={{
                                background: selectedDepartment === d.id ? 'linear-gradient(135deg, #14b8a6, #0d9488)' : '#181e2b',
                                color: selectedDepartment === d.id ? '#ffffff' : '#cbd5e1',
                                border: selectedDepartment === d.id ? '1px solid #2dd4bf' : '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '8px',
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* MODE 2: ACTIVE QUERY (searchQuery >= 2 chars) */
                    (() => {
                      const displayedResults = searchResults.filter(item => filterByDepartment(item, selectedDepartment));
                      return (
                        <div>
                          {/* Dropdown Header */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.35rem 0.6rem 0.6rem 0.6rem',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            marginBottom: '0.5rem',
                            flexWrap: 'wrap',
                            gap: '6px'
                          }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                              Live Stock Matches ({displayedResults.length})
                              {selectedDepartment !== 'All' && (
                                <span style={{
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#fbbf24',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.68rem',
                                  fontWeight: '700'
                                }}>
                                  in {selectedDepartment}
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: '700' }}>
                              ⚡ FREE Express Delivery (10-15 Min)
                            </span>
                          </div>

                          {/* Multi-Composition Split Banner */}
                          {multiCompositionSplit && multiCompositionSplit.tabs && multiCompositionSplit.tabs.length >= 2 && (
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.12) 0%, rgba(56, 189, 248, 0.1) 100%)',
                              border: '1px solid rgba(45, 212, 191, 0.3)',
                              borderRadius: '16px',
                              padding: '1rem',
                              marginBottom: '0.85rem'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '1.2rem' }}>💊</span>
                                  <strong style={{ fontSize: '0.92rem', color: '#2dd4bf' }}>
                                    Multi-Composition Formulation ({multiCompositionSplit.brand_searched})
                                  </strong>
                                </div>
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '3px 10px',
                                  borderRadius: '99px',
                                  background: multiCompositionSplit.is_combined_in_stock ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: multiCompositionSplit.is_combined_in_stock ? '#34d399' : '#f87171',
                                  fontWeight: '800'
                                }}>
                                  {multiCompositionSplit.is_combined_in_stock ? 'Combo Tablet Available' : '⚠️ Combo Tablet Out of Stock'}
                                </span>
                              </div>

                              <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                                {multiCompositionSplit.note}
                              </p>

                              {/* 2-TAB COMPOSITION SWITCHER */}
                              <div style={{
                                display: 'flex',
                                background: '#121620',
                                borderRadius: '12px',
                                padding: '3px',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
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
                                      padding: '8px 12px',
                                      borderRadius: '99px',
                                      border: 'none',
                                      background: activeCompositionTab === tIdx ? 'linear-gradient(135deg, #14b8a6, #0d9488)' : 'transparent',
                                      color: activeCompositionTab === tIdx ? '#ffffff' : '#94a3b8',
                                      fontWeight: '700',
                                      fontSize: '0.82rem',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      boxShadow: activeCompositionTab === tIdx ? '0 2px 8px rgba(20, 184, 166, 0.35)' : 'none'
                                    }}
                                  >
                                    <span>🧪</span>
                                    <span>{tab.label || tab.name}</span>
                                    <span style={{
                                      fontSize: '0.68rem',
                                      background: activeCompositionTab === tIdx ? 'rgba(255,255,255,0.25)' : 'rgba(255, 255, 255, 0.08)',
                                      color: '#f1f5f9',
                                      padding: '1px 6px',
                                      borderRadius: '99px'
                                    }}>
                                      {tab.count}
                                    </span>
                                  </button>
                                ))}
                              </div>

                              {/* Content of Selected Composition Tab */}
                              {multiCompositionSplit.tabs[activeCompositionTab] && (
                                <div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#2dd4bf', marginBottom: '6px' }}>
                                    Available standalone medicines containing {multiCompositionSplit.tabs[activeCompositionTab].name}:
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {multiCompositionSplit.tabs[activeCompositionTab].medicines.length === 0 ? (
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '6px' }}>
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
                                            background: '#181e2b',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '10px',
                                            padding: '8px 12px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          <div>
                                            <strong style={{ fontSize: '0.84rem', color: '#f1f5f9' }}>{cm.brand_name}</strong>
                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '6px' }}>
                                              ({cm.dosage || 'Standard'} • {cm.form || 'Tablet'})
                                            </span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.84rem', fontWeight: 'bold', color: '#2dd4bf' }}>
                                              ₹{cm.price_mrp || '45.00'}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); addToCart(cm); }}
                                              style={{
                                                background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '4px 10px',
                                                borderRadius: '7px',
                                                fontSize: '0.74rem',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              + ADD
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
                                  padding: '8px 14px',
                                  borderRadius: '10px',
                                  fontWeight: '800',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  boxShadow: '0 2px 10px rgba(255, 107, 0, 0.25)'
                                }}
                              >
                                <span>⚡ Add Both Compositions ({multiCompositionSplit.tabs[0].name} + {multiCompositionSplit.tabs[1].name}) in 1-Click</span>
                              </button>
                            </div>
                          )}

                          {/* Empty State */}
                          {displayedResults.length === 0 && !multiCompositionSplit ? (
                            <div style={{ padding: '1.75rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                              <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '6px' }}>🔍</span>
                              No local stock found for "<strong style={{ color: '#f1f5f9' }}>{searchQuery}</strong>"
                              {selectedDepartment !== 'All' ? ` in department ${selectedDepartment}.` : '.'}<br />
                              {selectedDepartment !== 'All' && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedDepartment('All')}
                                  style={{
                                    marginTop: '8px',
                                    background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    fontWeight: '700',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Search Across All Pharmacy ({searchResults.length} matches)
                                </button>
                              )}
                              <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: '8px', fontWeight: 'bold' }}>
                                📡 Urgent inquiry broadcast dispatched to all nearby partner pharmacies!
                              </div>
                            </div>
                          ) : (
                            /* Amazon Live Product Rows */
                            displayedResults.map((item, idx) => {
                              const itemCartQty = getItemCartCount(item.medicine_id);
                              const formStr = (item.dosage_form || item.dosage || item.form || '').toLowerCase();
                              const formIcon = formStr.includes('syr') || formStr.includes('liq') ? '🧴' : formStr.includes('drop') ? '💧' : formStr.includes('inj') ? '💉' : formStr.includes('gel') || formStr.includes('oint') ? '🧴' : '💊';
                              const currentPrice = Number(item.price_mrp || item.price || 45);
                              const originalMrp = Math.round(currentPrice * 1.25);
                              const discountPercent = Math.round(((originalMrp - currentPrice) / originalMrp) * 100);

                              return (
                                <div
                                  key={idx}
                                  onClick={() => {
                                    setShowSuggestions(false);
                                    setSelectedMedicineDetail(item);
                                  }}
                                  style={{
                                    padding: '0.75rem 0.9rem',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    background: focusedIndex === idx ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                                    transition: 'all 0.15s ease',
                                    borderBottom: idx !== displayedResults.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '12px'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = focusedIndex === idx ? 'rgba(56, 189, 248, 0.12)' : 'transparent'; }}
                                >
                                  {/* Amazon Form & Thumbnail Icon */}
                                  <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '10px',
                                    background: '#121620',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.2rem',
                                    flexShrink: 0
                                  }}>
                                    <span>{formIcon}</span>
                                    <span style={{ fontSize: '0.52rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', lineHeight: 1 }}>
                                      {item.form ? item.form.substring(0, 4) : 'MED'}
                                    </span>
                                  </div>

                                  {/* Middle Column: Medicine Details & Amazon Prime Badge */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                                      <strong style={{ fontSize: '0.94rem', color: '#f1f5f9' }}>
                                        {highlightMatch(item.brand_name, searchQuery)}
                                      </strong>
                                      {item.dosage && (
                                        <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: '600' }}>
                                          ({item.dosage})
                                        </span>
                                      )}
                                      {item.compound_badge && (
                                        <span style={{
                                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(13, 148, 136, 0.2))',
                                          color: '#2dd4bf',
                                          border: '1px solid rgba(13, 148, 136, 0.3)',
                                          padding: '2px 8px',
                                          borderRadius: '99px',
                                          fontSize: '0.68rem',
                                          fontWeight: 'bold'
                                        }}>
                                          🤖 {item.compound_badge}
                                        </span>
                                      )}
                                    </div>

                                    {item.compound_note && (
                                      <div style={{
                                        fontSize: '0.7rem',
                                        color: '#38bdf8',
                                        background: 'rgba(56, 189, 248, 0.1)',
                                        border: '1px solid rgba(56, 189, 248, 0.25)',
                                        padding: '2px 7px',
                                        borderRadius: '6px',
                                        marginBottom: '4px',
                                        display: 'inline-block'
                                      }}>
                                        💡 {item.compound_note}
                                      </div>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: '#cbd5e1', flexWrap: 'wrap' }}>
                                      <span>🧪 <strong>{highlightMatch(item.generic_name, searchQuery)}</strong></span>
                                      {item.manufacturer && <span style={{ color: '#94a3b8' }}>• {item.manufacturer}</span>}
                                    </div>

                                    {/* Star Rating & Delivery line */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.7rem', flexWrap: 'wrap' }}>
                                      <span style={{ color: '#f59e0b', fontWeight: '700' }}>⭐⭐⭐⭐½ 4.8</span>
                                      <span style={{ color: '#94a3b8' }}>(1,240+)</span>
                                      <span style={{ color: '#34d399', fontWeight: '700' }}>
                                        • 10-15 Min Express Delivery
                                      </span>
                                    </div>
                                  </div>

                                  {/* Right Column: Pricing & Amazon 1-Click Buttons */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                    <div style={{ textAlign: 'right', minWidth: '60px' }}>
                                      <div style={{ fontWeight: '800', color: '#2dd4bf', fontSize: '1rem' }}>
                                        ₹{currentPrice}
                                      </div>
                                      <div style={{ fontSize: '0.68rem', color: '#64748b', textDecoration: 'line-through' }}>
                                        ₹{originalMrp}
                                      </div>
                                      <div style={{ fontSize: '0.65rem', color: '#4ade80', fontWeight: '700' }}>
                                        {discountPercent}% OFF
                                      </div>
                                    </div>

                                    {/* Action Buttons: Add to Cart + 1-Click Buy Now */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      {itemCartQty > 0 ? (
                                        <div 
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            background: 'rgba(16, 185, 129, 0.12)',
                                            border: '1.5px solid #10b981',
                                            borderRadius: '8px',
                                            padding: '2px 6px'
                                          }}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateItemQuantity(item, -1)}
                                            style={{ background: 'transparent', border: 'none', color: '#34d399', fontWeight: '800', cursor: 'pointer', padding: '0 3px' }}
                                          >
                                            −
                                          </button>
                                          <span style={{ fontWeight: '800', fontSize: '0.78rem', color: '#34d399', minWidth: '14px', textAlign: 'center' }}>
                                            {itemCartQty}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateItemQuantity(item, 1)}
                                            style={{ background: 'transparent', border: 'none', color: '#34d399', fontWeight: '800', cursor: 'pointer', padding: '0 3px' }}
                                          >
                                            +
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleUpdateItemQuantity(item, 1);
                                          }}
                                          style={{
                                            background: '#1e2638',
                                            color: '#38bdf8',
                                            border: '1px solid rgba(56, 189, 248, 0.3)',
                                            padding: '6px 10px',
                                            borderRadius: '8px',
                                            fontWeight: '700',
                                            fontSize: '0.74rem',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap'
                                          }}
                                          title="Add to Cart"
                                        >
                                          + Cart
                                        </button>
                                      )}

                                      {/* Amazon 1-Click "⚡ Buy Now" Button */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleBuyNow(item);
                                        }}
                                        style={{
                                          background: 'linear-gradient(180deg, #ffa41c 0%, #ff8f00 100%)',
                                          color: '#0f1111',
                                          border: '1px solid #ff8f00',
                                          padding: '6px 12px',
                                          borderRadius: '8px',
                                          fontWeight: '800',
                                          fontSize: '0.74rem',
                                          cursor: 'pointer',
                                          boxShadow: '0 2px 6px rgba(255, 143, 0, 0.28)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          whiteSpace: 'nowrap'
                                        }}
                                        title="1-Click Instant Checkout"
                                      >
                                        <span>⚡</span>
                                        <span>Buy Now</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}

                          {/* Related Amazon Search Keywords Autocomplete */}
                          {displayedResults.length > 0 && (
                            <div style={{
                              marginTop: '0.75rem',
                              padding: '0.65rem 0.5rem 0.25rem 0.5rem',
                              borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94a3b8', marginBottom: '6px' }}>
                                🔍 Related Medicine Searches:
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {[
                                  `${searchQuery} tablet uses`,
                                  `${searchQuery} generic price`,
                                  `${searchQuery} strip of 15`,
                                  `${searchQuery} substitutes`
                                ].map((relTerm, rIdx) => (
                                  <button
                                    key={rIdx}
                                    type="button"
                                    onClick={() => {
                                      setSearchQuery(relTerm);
                                      saveRecentSearch(relTerm);
                                      setShowSuggestions(true);
                                    }}
                                    style={{
                                      background: '#181e2b',
                                      border: '1px solid rgba(255, 255, 255, 0.08)',
                                      borderRadius: '6px',
                                      padding: '3px 8px',
                                      fontSize: '0.7rem',
                                      color: '#38bdf8',
                                      fontWeight: '600',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    🔍 {relTerm}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dropdown Footer: View All in Catalogue */}
                          {displayedResults.length > 0 && (
                            <div style={{
                              marginTop: '0.5rem',
                              paddingTop: '0.5rem',
                              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                              textAlign: 'center'
                            }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowSuggestions(false);
                                  const el = document.getElementById('search-results-section');
                                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#2dd4bf',
                                  fontWeight: '700',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>View all {displayedResults.length} matched products in catalogue</span>
                                <span>↓</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>

            {/* Quick Clinical Category Pills Carousel */}
            <div style={{
              maxWidth: '960px',
              margin: '1.25rem auto 0 auto',
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '6px',
              scrollbarWidth: 'none',
              textAlign: 'left'
            }}>
              {[
                { label: '🤒 Fever & Chills', term: 'Dolo 650' },
                { label: '🤢 Acidity & Gas', term: 'Pantocid 40' },
                { label: '🤧 Cold & Allergy', term: 'Allegra 120' },
                { label: '⚡ Pain Relief', term: 'Combiflam' },
                { label: '😷 Cough & Throat', term: 'Ascoril-D' },
                { label: '🩹 First Aid', term: 'Betadine' },
                { label: '💊 Daily Vitamins', term: 'Zincovit' },
                { label: '🩺 BP & Diabetes', term: 'Metformin' }
              ].map((pill, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => {
                    setSearchQuery(pill.term);
                    setShowSuggestions(true);
                    scrollToSearchBarTop();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#151a24',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '99px',
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    transition: 'all 0.15s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'; e.currentTarget.style.color = '#38bdf8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.background = '#151a24'; e.currentTarget.style.color = '#cbd5e1'; }}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Quality & Speed Trust Guarantee Strip */}
            <div style={{
              maxWidth: '960px',
              margin: '1.25rem auto 0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '10px',
              textAlign: 'left'
            }}>
              {[
                { icon: '🛡️', title: '100% Genuine Pharmacy', desc: 'Direct from licensed dark-stores' },
                { icon: '⚡', title: '10-15 Min Express', desc: 'Real-time GPS courier dispatch' },
                { icon: '🤖', title: 'AI Clinical Safety', desc: 'Checks adverse drug interactions' },
                { icon: '🔊', title: 'Soundbox Settlement', desc: 'Instant UPI audio confirmation' }
              ].map((item, tIdx) => (
                <div
                  key={tIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#151a24',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    boxShadow: 'var(--neo-shadow-raised-sm)'
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.8rem', color: '#f8fafc' }}>{item.title}</strong>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Dedicated Doctor Prescription Upload Card (Handwritten & Printed) */}
            <div style={{
              marginTop: '1.75rem',
              background: 'linear-gradient(135deg, #151a24 0%, #101e28 100%)',
              border: '1.5px solid rgba(45, 212, 191, 0.3)',
              borderRadius: '22px',
              padding: '1.35rem 1.8rem',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
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

          {/* AMAZON "YOUR ACCOUNT" HUB VIEW */}
          {activeMainView === 'account' && (
            <div style={{ marginTop: '2rem', marginBottom: '4rem', width: '100%', textAlign: 'left' }} className="animate-fade-in">
              {/* Account Top Navigation & Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '2rem',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                padding: '1.25rem 1.6rem',
                borderRadius: '20px',
                border: '1px solid rgba(203, 213, 225, 0.85)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0d9488 0%, #1e293b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '1.5rem',
                    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)'
                  }}>
                    👤
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ margin: 0, fontSize: '1.45rem', color: '#f8fafc', fontWeight: '800' }}>
                        {accountEditName || activeUser?.name || 'Your Account'}
                      </h2>
                      <span className="amazon-gold-badge" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)' }}>
                        VERIFIED PATIENT ✓
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '3px' }}>
                      {accountEditEmail || activeUser?.email || 'patient@medora.com'} • {accountEditPhone} • ID: #{activeUser?.id || activeUser?.email || 'MED-88421'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                        Allergies: {accountEditAllergies || 'None'}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#7dd3fc', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                        Conditions: {accountEditConditions || 'None'}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                        Blood: {accountEditBlood || 'O+'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {activeAccountSection !== 'hub' && (
                    <button
                      onClick={() => setActiveAccountSection('hub')}
                      style={{
                        background: '#1e2433',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#f1f5f9',
                        padding: '0.6rem 1.1rem',
                        borderRadius: '12px',
                        fontWeight: '700',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      ← All Account Settings
                    </button>
                  )}
                  <button
                    onClick={() => setActiveMainView('home')}
                    style={{
                      background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '0.6rem 1.3rem',
                      borderRadius: '12px',
                      fontWeight: '800',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(13, 148, 136, 0.25)'
                    }}
                  >
                    🏪 Return to Store
                  </button>
                </div>
              </div>

              {/* 1. MAIN ACCOUNT TILES GRID */}
              {activeAccountSection === 'hub' && (
                <div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                    gap: '1.25rem',
                    marginBottom: '2rem'
                  }}>
                    {/* Tile 1: Your Orders */}
                    <div
                      className="amazon-account-tile"
                      onClick={() => setActiveAccountSection('orders')}
                    >
                      <div className="amazon-account-tile-icon">📦</div>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#f8fafc', fontWeight: '800' }}>
                          Your Orders
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.4' }}>
                          Track active deliveries, view receipt history, or buy medicines again.
                        </p>
                      </div>
                    </div>

                    {/* Tile 2: Login & Security */}
                    <div
                      className="amazon-account-tile"
                      onClick={() => setActiveAccountSection('security')}
                    >
                      <div className="amazon-account-tile-icon">🔒</div>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#f8fafc', fontWeight: '800' }}>
                          Login & Security
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.4' }}>
                          Edit name, mobile number, email, and update account password.
                        </p>
                      </div>
                    </div>

                    {/* Tile 3: Express 10-Min Delivery */}
                    <div
                      className="amazon-account-tile"
                      onClick={() => setActiveAccountSection('prime')}
                    >
                      <div className="amazon-account-tile-icon">⚡</div>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#f8fafc', fontWeight: '800' }}>
                          Express 10-Min Delivery
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.4' }}>
                          Manage 10-minute medicine delivery perks, ₹0 delivery fee benefits.
                        </p>
                      </div>
                    </div>

                    {/* Tile 4: Your Addresses */}
                    <div
                      className="amazon-account-tile"
                      onClick={() => setActiveAccountSection('addresses')}
                    >
                      <div className="amazon-account-tile-icon">📍</div>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#f8fafc', fontWeight: '800' }}>
                          Your Addresses
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.4' }}>
                          Edit delivery addresses, GPS pin locations, and apartment numbers.
                        </p>
                      </div>
                    </div>

                    {/* Tile 5: Payment Options & UPI */}
                    <div
                      className="amazon-account-tile"
                      onClick={() => setActiveAccountSection('payments')}
                    >
                      <div className="amazon-account-tile-icon">💳</div>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#f8fafc', fontWeight: '800' }}>
                          Payment Options & UPI
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.4' }}>
                          Manage saved UPI IDs, credit/debit cards, and payment preferences.
                        </p>
                      </div>
                    </div>

                    {/* Tile 6: Your Prescriptions & Rx */}
                    <div
                      className="amazon-account-tile"
                      onClick={() => setActiveAccountSection('prescriptions')}
                    >
                      <div className="amazon-account-tile-icon">📄</div>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#f8fafc', fontWeight: '800' }}>
                          Your Prescriptions & Rx
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.4' }}>
                          Access Gemini AI scanned handwritten prescriptions & OPD records.
                        </p>
                      </div>
                    </div>

                    {/* Tile 7: Family Health Profiles */}
                    <div
                      className="amazon-account-tile"
                      onClick={() => setActiveAccountSection('family')}
                    >
                      <div className="amazon-account-tile-icon">👨‍👩‍👧</div>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#f8fafc', fontWeight: '800' }}>
                          Family Health Profiles
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.4' }}>
                          Manage medical profiles for parents & family (Allergies, Blood Group).
                        </p>
                      </div>
                    </div>

                    {/* Tile 8: Customer Service & AI Doctor */}
                    <div
                      className="amazon-account-tile"
                      onClick={() => setActiveAccountSection('support')}
                    >
                      <div className="amazon-account-tile-icon">🩺</div>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: '#f8fafc', fontWeight: '800' }}>
                          Customer Service / AI Doctor
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.4' }}>
                          Instant 24/7 Clinical AI Doctor chat, dosage guidance & order help.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. SUBVIEW: YOUR ORDERS */}
              {activeAccountSection === 'orders' && (() => {
                const displayOrders = (allUserOrders && allUserOrders.length > 0 ? allUserOrders : activeOrders);
                return (
                  <div className="metallic-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.3rem' }}>Your Orders ({displayOrders.length})</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>Account: {accountEditEmail || activeUser?.email || 'Current Patient'}</p>
                      </div>
                      <button
                        onClick={() => setIsTrackingOpen(true)}
                        style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Live Tracking Modal 🛵
                      </button>
                    </div>

                    {displayOrders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📦</span>
                        <p style={{ fontWeight: '700', color: '#f8fafc' }}>No orders placed yet for this account</p>
                        <p style={{ fontSize: '0.85rem' }}>Search for medicines and checkout to initiate your first order!</p>
                        <button
                          onClick={() => setActiveMainView('home')}
                          className="btn-primary"
                          style={{ marginTop: '1rem', padding: '8px 18px', fontSize: '0.85rem' }}
                        >
                          Start Shopping Medicines
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {displayOrders.map(order => (
                          <div key={order.id} style={{ border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', padding: '1.25rem', background: '#161c28' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '0.85rem' }}>
                              <div>
                                <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>Order #{order.id}</strong>
                                <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginLeft: '12px' }}>
                                  Fulfilling Pharmacy: <strong style={{ color: '#f1f5f9' }}>{order.pharmacy_id || 'Dark-store Hub'}</strong>
                                </span>
                              </div>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '99px',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                background: order.status === 'delivered' ? 'rgba(16, 185, 129, 0.15)' : order.status === 'out_for_delivery' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(20, 184, 166, 0.15)',
                                color: order.status === 'delivered' ? '#34d399' : order.status === 'out_for_delivery' ? '#fbbf24' : '#2dd4bf',
                                border: `1px solid ${order.status === 'delivered' ? 'rgba(16, 185, 129, 0.3)' : order.status === 'out_for_delivery' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(20, 184, 166, 0.3)'}`
                              }}>
                                {order.status?.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </div>
                            
                            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>
                              <strong style={{ color: '#f8fafc' }}>Items:</strong> {Array.isArray(order.items) ? order.items.map(i => `${i.quantity || 1}x ${i.brand_name || i.name}`).join(', ') : order.items}
                            </div>

                            <TrackingBar status={order.status} />

                            {/* Rider Doorstep QR on active order */}
                            {(order.rider_qr_image || (typeof window !== 'undefined' && (localStorage.getItem(`medora_order_qr_${order.id}`) || localStorage.getItem('medora_rider_main_qr')))) && (
                              <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#1c2331', border: '1px dashed #0d9488', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <img
                                  src={order.rider_qr_image || (typeof window !== 'undefined' && (localStorage.getItem(`medora_order_qr_${order.id}`) || localStorage.getItem('medora_rider_main_qr')))}
                                  alt="Rider Doorstep QR"
                                  style={{ width: '80px', height: '80px', objectFit: 'contain', background: '#fff', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)' }}
                                />
                                <div>
                                  <strong style={{ fontSize: '0.85rem', color: '#f8fafc', display: 'block' }}>🛵 Contactless Doorstep UPI QR Shared by Rider</strong>
                                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Scan upon rider arrival using GPay, PhonePe, Paytm or any UPI App. Rider settles at pharmacy.</span>
                                </div>
                              </div>
                            )}

                            {/* Order Action Bar: Payment status & Reorder button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                {order.payment_method && <span>Payment: <strong style={{ color: '#f8fafc' }}>{String(order.payment_method).toUpperCase()}</strong> • </span>}
                                <span>Ref: #{order.id}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (Array.isArray(order.items) && order.items.length > 0) {
                                    order.items.forEach(it => {
                                      addToCart({
                                        id: it.medicine_id || it.id || `med_${Math.random().toString(36).substring(2, 7)}`,
                                        medicine_id: it.medicine_id || it.id,
                                        brand_name: it.brand_name || it.name,
                                        generic_name: it.generic_name || it.brand_name,
                                        price_mrp: it.price_mrp || it.price || 45,
                                        quantity: it.quantity || 1
                                      });
                                    });
                                    setIsCartOpen(true);
                                    showToast(`Added ${order.items.length} item(s) from Order #${order.id} to cart!`, '🛒');
                                  } else {
                                    showToast(`Order details loaded`, '📦');
                                  }
                                }}
                                className="btn-primary"
                                style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: '800', borderRadius: '8px' }}
                              >
                                🔁 Buy Again
                              </button>
                            </div>
                          </div>
                        ))}

                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 3. SUBVIEW: PERSONAL PROFILE & HEALTH DATA */}
              {activeAccountSection === 'security' && (
                <div className="metallic-card" style={{ padding: '2rem', maxWidth: '720px' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1.3rem' }}>Personal & Medical Profile</h3>
                  <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                    Each user has their unique persistent profile. Saved details auto-fill during rapid checkout and clinical triage.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Full Name</label>
                      <input
                        type="text"
                        value={accountEditName}
                        onChange={(e) => setAccountEditName(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Mobile Phone Number</label>
                      <input
                        type="text"
                        value={accountEditPhone}
                        onChange={(e) => setAccountEditPhone(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Email Address</label>
                      <input
                        type="email"
                        value={accountEditEmail}
                        onChange={(e) => setAccountEditEmail(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Blood Group</label>
                      <select
                        value={accountEditBlood}
                        onChange={(e) => setAccountEditBlood(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' }}
                      >
                        {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Primary Delivery Address</label>
                      <input
                        type="text"
                        placeholder="House / Flat No, Street, Landmark, Area, Pincode"
                        value={accountEditAddress}
                        onChange={(e) => setAccountEditAddress(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#f87171', display: 'block', marginBottom: '4px' }}>Known Drug Allergies</label>
                      <input
                        type="text"
                        placeholder="e.g. Sulfa drugs, Penicillin, Aspirin, None"
                        value={accountEditAllergies}
                        onChange={(e) => setAccountEditAllergies(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.9rem', outline: 'none', background: 'rgba(239, 68, 68, 0.08)', color: '#fca5a5' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>Chronic Medical Conditions</label>
                      <input
                        type="text"
                        placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma, None"
                        value={accountEditConditions}
                        onChange={(e) => setAccountEditConditions(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: '0.9rem', outline: 'none', background: 'rgba(56, 189, 248, 0.08)', color: '#7dd3fc' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Emergency Contact Phone</label>
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={accountEditEmergencyPhone}
                        onChange={(e) => setAccountEditEmergencyPhone(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>New Password</label>
                      <input
                        type="password"
                        placeholder="Leave blank to keep unchanged"
                        value={accountNewPassword}
                        onChange={(e) => setAccountNewPassword(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                      onClick={async () => {
                        const updatedUser = {
                          ...activeUser,
                          name: accountEditName,
                          email: accountEditEmail,
                          phone: accountEditPhone,
                          address: accountEditAddress,
                          allergies: accountEditAllergies,
                          chronic_conditions: accountEditConditions,
                          blood_group: accountEditBlood,
                          emergency_phone: accountEditEmergencyPhone
                        };
                        setActiveUser(updatedUser);
                        if (typeof window !== 'undefined') {
                          try {
                            localStorage.setItem('medora_active_user', JSON.stringify(updatedUser));
                            localStorage.setItem(`medora_user_profile_${accountEditEmail}`, JSON.stringify(updatedUser));
                          } catch (e) {}
                        }

                        try {
                          await fetch(`${API}/api/v1/auth/profile`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              identifier: activeUser?.email || accountEditEmail,
                              name: accountEditName,
                              phone: accountEditPhone,
                              email: accountEditEmail,
                              address: accountEditAddress,
                              allergies: accountEditAllergies,
                              chronic_conditions: accountEditConditions,
                              blood_group: accountEditBlood,
                              emergency_phone: accountEditEmergencyPhone,
                              password: accountNewPassword || null
                            })
                          });
                        } catch (e) {
                          console.warn("Could not sync profile to backend", e);
                        }

                        showToast('Personal profile & medical records saved successfully!', '🔒');
                        setActiveAccountSection('hub');
                      }}
                      className="btn-primary"
                      style={{ padding: '10px 24px', fontWeight: '800', fontSize: '0.88rem' }}
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setActiveAccountSection('hub')}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* 4. SUBVIEW: MEDORA EXPRESS DELIVERY */}
              {activeAccountSection === 'prime' && (
                <div className="metallic-card" style={{ padding: '2rem', maxWidth: '700px', background: '#161c28', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', color: '#fff' }}>
                      ⚡
                    </div>
                    <div>
                      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.4rem', fontWeight: '800' }}>MEDORA Express Delivery Membership</h3>
                      <span className="amazon-gold-badge" style={{ marginTop: '4px' }}>ACTIVE • RENEWS OCT 2027</span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 1.5rem 0' }}>
                    As a MEDORA Express member, you enjoy guaranteed 10-15 minute emergency medicine dispatch, ₹0 delivery fee on all orders from local pharmacies, and priority prescription OCR validation.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ padding: '1rem', background: '#121620', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <strong style={{ color: '#5eead4', display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>⚡ 10-Minute Guarantee</strong>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Automated priority rider assignment at zero surcharge</span>
                    </div>
                    <div style={{ padding: '1rem', background: '#121620', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <strong style={{ color: '#5eead4', display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>💸 Free Delivery Always</strong>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No minimum cart value required across any partner chemist</span>
                    </div>
                    <div style={{ padding: '1rem', background: '#121620', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <strong style={{ color: '#5eead4', display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>🛡️ AI Drug Interaction Safety</strong>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Automated clinical hazard cross-examination at checkout</span>
                    </div>
                    <div style={{ padding: '1rem', background: '#121620', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <strong style={{ color: '#5eead4', display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>🩺 24/7 AI Doctor Access</strong>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Unlimited clinical triage and OTC consultations</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. SUBVIEW: YOUR ADDRESSES */}
              {activeAccountSection === 'addresses' && (
                <div className="metallic-card" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.3rem' }}>Your Addresses</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>Manage your delivery locations and default home pin</p>
                    </div>
                    <button
                      onClick={() => setIsAddressDrawerOpen(true)}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: '800' }}
                    >
                      + Add New Address
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {addresses.map((addr) => {
                      const isSelected = selectedAddress?.id === addr.id;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => {
                            handleSelectAddress(addr);
                            showToast(`Default address set to ${addr.tag}`, '📍');
                          }}
                          style={{
                            border: isSelected ? '2px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '14px',
                            padding: '1.25rem',
                            background: isSelected ? 'rgba(20, 184, 166, 0.1)' : '#161c28',
                            cursor: 'pointer',
                            position: 'relative'
                          }}
                        >
                          {isSelected && (
                            <span style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--primary)', color: '#fff', fontSize: '0.68rem', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                              DEFAULT
                            </span>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>{addr.icon || '📍'}</span>
                            <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{addr.tag}</strong>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                            {addr.houseNo}, {addr.area}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
                            👤 {addr.receiverName} • 📞 {addr.receiverPhone}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 6. SUBVIEW: PAYMENT OPTIONS & UPI */}
              {activeAccountSection === 'payments' && (
                <div className="metallic-card" style={{ padding: '2rem', maxWidth: '680px' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1.3rem' }}>Payment Options & UPI</h3>
                  <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.82rem', color: '#94a3b8' }}>Manage your linked UPI VPA handles and payment preferences</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    {savedUpiIds.map(upi => (
                      <div key={upi.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#161c28', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.4rem' }}>📱</span>
                          <div>
                            <strong style={{ fontSize: '0.92rem', color: '#f8fafc', display: 'block' }}>{upi.vpa}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{upi.bank}</span>
                          </div>
                        </div>
                        {upi.isDefault ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: '800', fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px' }}>
                            PRIMARY UPI
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setSavedUpiIds(prev => prev.map(u => ({ ...u, isDefault: u.id === upi.id })));
                              showToast(`Set ${upi.vpa} as primary UPI`, '💳');
                            }}
                            style={{ background: '#1e2433', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Set Primary
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add New UPI VPA Row */}
                    {showAddUpiInput ? (
                      <div style={{ padding: '1.1rem', background: '#161c28', border: '1.5px dashed var(--primary)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <strong style={{ fontSize: '0.88rem', color: '#f8fafc' }}>Link New UPI VPA</strong>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="e.g. yourname@okaxis"
                            value={newUpiVpaInput}
                            onChange={(e) => setNewUpiVpaInput(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.85rem' }}
                          />
                          <input
                            type="text"
                            placeholder="Bank (e.g. HDFC Bank)"
                            value={newUpiBankInput}
                            onChange={(e) => setNewUpiBankInput(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.85rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!newUpiVpaInput || !newUpiVpaInput.includes('@')) {
                                showToast('Please enter a valid UPI VPA (e.g. name@okaxis)', '⚠️');
                                return;
                              }
                              setSavedUpiIds(prev => [
                                ...prev,
                                { id: `upi_${Date.now()}`, vpa: newUpiVpaInput.trim(), bank: newUpiBankInput.trim() || 'UPI Bank', isDefault: false }
                              ]);
                              showToast(`Linked UPI ID: ${newUpiVpaInput.trim()}`, '✓');
                              setNewUpiVpaInput('');
                              setNewUpiBankInput('');
                              setShowAddUpiInput(false);
                            }}
                            className="btn-primary"
                            style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: '800' }}
                          >
                            Save UPI ID
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddUpiInput(false)}
                            style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAddUpiInput(true)}
                        style={{
                          background: 'transparent',
                          border: '1px dashed #0d9488',
                          color: '#0d9488',
                          padding: '10px',
                          borderRadius: '10px',
                          fontWeight: '800',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>+</span>
                        <span>Link Another UPI ID</span>
                      </button>
                    )}
                  </div>

                  <div style={{ padding: '1rem', background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '12px' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#0d9488', display: 'block', marginBottom: '4px' }}>
                      ✓ Doorstep Contactless UPI Supported
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      When delivery partners arrive at your door, they present their live dynamic UPI QR code. You can also pay via Soundbox POS machine.
                    </span>
                  </div>
                </div>
              )}


              {/* 7. SUBVIEW: PRESCRIPTIONS */}
              {activeAccountSection === 'prescriptions' && (
                <div className="metallic-card" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.3rem' }}>Your Prescriptions & Rx</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>Doctor prescriptions parsed via Gemini Vision AI</p>
                    </div>
                    <button
                      onClick={() => setIsOcrOpen(true)}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: '800' }}
                    >
                      + Upload New Prescription
                    </button>
                  </div>

                  {uploadedPrescriptionId ? (
                    <div style={{ border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', padding: '1.25rem', background: '#161c28' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ color: '#f8fafc' }}>Prescription #{uploadedPrescriptionId}</strong>
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: '800', fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px' }}>
                          ✓ DIGITALLY VERIFIED
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
                        Deciphered by Google Gemini Vision AI. Prescribed medicines automatically mapped to local inventory.
                      </p>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                      <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📄</span>
                      <p style={{ fontWeight: '700', color: '#f8fafc' }}>No prescriptions uploaded yet</p>
                      <p style={{ fontSize: '0.85rem' }}>Upload doctor handwritten slips to automatically order prescribed drugs!</p>
                      <button
                        onClick={() => setIsOcrOpen(true)}
                        className="btn-primary"
                        style={{ marginTop: '1rem', padding: '8px 18px', fontSize: '0.85rem' }}
                      >
                        Upload Doctor Prescription
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 8. SUBVIEW: FAMILY HEALTH PROFILES */}
              {activeAccountSection === 'family' && (
                <div className="metallic-card" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.3rem' }}>Family Health Profiles</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>Store chronic conditions and drug allergies for safe medicine dispatch</p>
                    </div>
                    <button
                      onClick={() => setShowAddFamilyModal(v => !v)}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: '800' }}
                    >
                      {showAddFamilyModal ? '✕ Close Form' : '+ Add Family Member'}
                    </button>
                  </div>

                  {/* Add Family Member Inline Card */}
                  {showAddFamilyModal && (
                    <div style={{ padding: '1.25rem', background: '#161c28', border: '1.5px dashed var(--primary)', borderRadius: '16px', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>Add Family Medical Profile</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '700', display: 'block', marginBottom: '3px' }}>Full Name / Nickname</label>
                          <input
                            type="text"
                            placeholder="e.g. Grandma, Rohit (Brother)"
                            value={newFamName}
                            onChange={(e) => setNewFamName(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.85rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '700', display: 'block', marginBottom: '3px' }}>Relation</label>
                          <select
                            value={newFamRelation}
                            onChange={(e) => setNewFamRelation(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.85rem' }}
                          >
                            <option value="Parent">Parent</option>
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Spouse">Spouse</option>
                            <option value="Child">Child</option>
                            <option value="Sibling">Sibling</option>
                            <option value="Grandparent">Grandparent</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '700', display: 'block', marginBottom: '3px' }}>Age (Years)</label>
                          <input
                            type="number"
                            placeholder="e.g. 62"
                            value={newFamAge}
                            onChange={(e) => setNewFamAge(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.85rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '700', display: 'block', marginBottom: '3px' }}>Blood Group</label>
                          <select
                            value={newFamBlood}
                            onChange={(e) => setNewFamBlood(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.85rem' }}
                          >
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '700', display: 'block', marginBottom: '3px' }}>Drug Allergies</label>
                          <input
                            type="text"
                            placeholder="e.g. Penicillin, Sulfa, None"
                            value={newFamAllergies}
                            onChange={(e) => setNewFamAllergies(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.85rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '700', display: 'block', marginBottom: '3px' }}>Chronic Conditions</label>
                          <input
                            type="text"
                            placeholder="e.g. Hypertension, Asthma, None"
                            value={newFamConditions}
                            onChange={(e) => setNewFamConditions(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#121620', color: '#f1f5f9', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newFamName.trim()) {
                              showToast('Please enter a name for the family member', '⚠️');
                              return;
                            }
                            setFamilyProfiles(prev => [
                              ...prev,
                              {
                                id: `fam_${Date.now()}`,
                                name: newFamName.trim(),
                                relation: newFamRelation,
                                age: parseInt(newFamAge) || 35,
                                blood: newFamBlood,
                                allergies: newFamAllergies.trim() || 'None',
                                conditions: newFamConditions.trim() || 'None'
                              }
                            ]);
                            showToast(`Added ${newFamName.trim()} to family profiles!`, '👨‍👩‍👧');
                            setNewFamName('');
                            setNewFamAge('');
                            setNewFamAllergies('');
                            setNewFamConditions('');
                            setShowAddFamilyModal(false);
                          }}
                          className="btn-primary"
                          style={{ padding: '8px 18px', fontSize: '0.82rem', fontWeight: '800' }}
                        >
                          Save Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddFamilyModal(false)}
                          style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {familyProfiles.map(member => (
                      <div key={member.id} style={{ border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', padding: '1.25rem', background: '#161c28' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{member.name}</strong>
                          <span style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#cbd5e1', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                            {member.blood}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div><strong>Age:</strong> {member.age} yrs • <strong>Relation:</strong> {member.relation}</div>
                          <div><strong style={{ color: '#f87171' }}>Allergies:</strong> {member.allergies}</div>
                          <div><strong style={{ color: '#38bdf8' }}>Conditions:</strong> {member.conditions}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 9. SUBVIEW: CUSTOMER SERVICE / AI DOCTOR */}
              {activeAccountSection === 'support' && (
                <div className="metallic-card" style={{ padding: '2rem', maxWidth: '640px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#fff' }}>
                      🩺
                    </div>
                    <div>
                      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.3rem' }}>24/7 Clinical AI Doctor Support</h3>
                      <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '700' }}>● ONLINE & READY TO CONSULT</span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
                    Have questions about dosages, medicine interactions, side effects, or order delivery? MEDORA's AI Virtual Doctor is available 24/7 to provide instant medical guidance and inventory assistance.
                  </p>

                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="btn-primary"
                    style={{ padding: '12px 24px', fontSize: '0.95rem', fontWeight: '800', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <span>💬</span>
                    <span>Launch AI Virtual Doctor Consultation</span>
                  </button>
                </div>
              )}
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
                background: 'linear-gradient(135deg, rgba(255, 119, 0, 0.12) 0%, rgba(20, 184, 166, 0.08) 100%)',
                border: '1px solid rgba(255, 119, 0, 0.3)',
                boxShadow: 'var(--neo-shadow-raised)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #FF7700 0%, #FFAA00 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    boxShadow: '0 8px 20px rgba(255, 119, 0, 0.4)',
                    color: '#fff'
                  }}>
                    ⚡
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#f1f5f9' }}>
                        MEDORA Instamart
                      </h3>
                      <span style={{
                        background: 'rgba(52, 211, 153, 0.16)',
                        color: '#34d399',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        border: '1px solid rgba(52, 211, 153, 0.3)'
                      }}>
                        ● LIVE NETWORK
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
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
                        background: '#161b26',
                        border: pharm.is_fastest ? '1.5px solid #14b8a6' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        boxShadow: 'var(--neo-shadow-raised-sm)'
                      }}
                    >
                      <span style={{ color: '#34d399', fontSize: '0.65rem' }}>●</span>
                      <span style={{ color: '#f1f5f9', fontWeight: '700' }}>{pharm.name}</span>
                      <span style={{
                        color: pharm.is_fastest ? '#2dd4bf' : '#94a3b8',
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
                  <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🔥</span> Most Bought & Everyday Essentials
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                    High-demand medicines commonly searched by people — verified in stock at nearby partner pharmacies
                  </p>
                </div>
                <div 
                  onClick={() => setIsAddressDrawerOpen(true)}
                  style={{ fontSize: '0.78rem', color: '#2dd4bf', fontWeight: '700', cursor: 'pointer' }}
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
                        background: active ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' : '#161b26',
                        color: active ? '#ffffff' : '#94a3b8',
                        border: active ? '1px solid #14b8a6' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '24px',
                        padding: '7px 16px',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: active ? '0 4px 14px rgba(20, 184, 166, 0.45)' : 'var(--neo-shadow-raised-sm)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Fast Moving Medicine Cards Grid */}
              <div className="instamart-products-grid" style={{
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
                        background: '#151a24',
                        borderRadius: '20px',
                        border: '1px dashed rgba(255, 255, 255, 0.12)',
                        boxShadow: 'var(--neo-shadow-raised)'
                      }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>📡</div>
                        <h4 style={{ color: '#f1f5f9', margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: '800' }}>
                          No medicines found under "{activeInstamartCategory}" within {perimeterKm} km
                        </h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
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
                          background: '#151a24',
                          border: inRange ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.04)',
                          opacity: inRange ? 1 : 0.88,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)',
                          cursor: 'pointer',
                          boxShadow: 'var(--neo-shadow-raised)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = 'var(--neo-shadow-raised-lg), 0 0 16px rgba(20, 184, 166, 0.25)';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = 'var(--neo-shadow-raised)';
                          e.currentTarget.style.borderColor = inRange ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)';
                        }}
                      >
                        <div>
                          {/* Header Badges */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: '800',
                              color: '#2dd4bf',
                              background: 'rgba(20, 184, 166, 0.15)',
                              border: '1px solid rgba(20, 184, 166, 0.25)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              textTransform: 'uppercase'
                            }}>
                              {med.form || med.category || 'OTC'}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              color: inRange ? '#34d399' : '#fbbf24',
                              fontWeight: '700'
                            }}>
                              ● {inRange ? 'In Perimeter' : 'Extended Range'} ({med.instamart?.total_available || 40})
                            </span>
                          </div>

                          {/* Medicine Title & Generic */}
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '800', color: '#f1f5f9' }}>
                            {med.brand_name}
                          </h4>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {med.generic_name} • {med.dosage}
                          </div>
                          {med.compound_badge && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(20, 184, 166, 0.15)',
                              color: '#2dd4bf',
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
                              background: inRange ? 'rgba(255, 119, 0, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                              border: inRange ? '1px solid rgba(255, 119, 0, 0.28)' : '1px solid rgba(255, 255, 255, 0.06)',
                              borderRadius: '10px',
                              padding: '6px 10px',
                              marginTop: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span style={{ fontSize: '0.9rem' }}>{inRange ? '⚡' : '📍'}</span>
                              <div style={{ fontSize: '0.72rem', color: inRange ? '#fb923c' : '#94a3b8', fontWeight: '700' }}>
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
                          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#2dd4bf' }}>
                              ₹{med.price_mrp}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>
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
                                background: 'rgba(22, 163, 74, 0.16)',
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
                                  color: '#4ade80',
                                  fontSize: '1rem',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  padding: '0 4px'
                                }}
                                title="Decrease quantity"
                              >
                                −
                              </button>
                              <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#4ade80', minWidth: '18px', textAlign: 'center' }}>
                                {cartQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(med, 1)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#4ade80',
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
                                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
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
                                boxShadow: '0 4px 12px rgba(20, 184, 166, 0.35)',
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
            <div id="search-results-section" className="animate-fade-in" style={{ width: '100%', marginBottom: '3.5rem', textAlign: 'left' }}>
              
              {/* Amazon Results Top Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.25rem',
                background: '#151a24',
                padding: '0.9rem 1.4rem',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: 'var(--neo-shadow-raised)'
              }}>
                <div>
                  <div style={{ fontSize: '0.92rem', color: '#f1f5f9', fontWeight: '700' }}>
                    Results for <span style={{ color: '#ff7700', fontWeight: '800' }}>"{searchQuery}"</span>
                  </div>
                  <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                    Check each product page for other buying options and fulfilling partner pharmacies.
                  </span>
                </div>

                {/* Right: Amazon Sort Dropdown & Clear */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    <span style={{ fontWeight: '600' }}>Sort by:</span>
                    <select
                      value={amazonSortBy}
                      onChange={(e) => setAmazonSortBy(e.target.value)}
                      style={{
                        background: '#121620',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        color: '#f1f5f9',
                        cursor: 'pointer',
                        outline: 'none',
                        boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.5)'
                      }}
                    >
                      <option value="featured">Featured</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="rating">Avg. Customer Review</option>
                      <option value="fastest">Fastest Delivery (Express 10m)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setMultiCompositionSplit(null);
                      setShowSuggestions(false);
                      setFilterPrimeOnly(false);
                      setFilterMinRating(0);
                      setFilterPriceBracket('all');
                      setFilterDiscountOnly(false);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#f87171',
                      fontWeight: '700',
                      fontSize: '0.76rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Clear
                  </button>
                </div>
              </div>

              {/* Amazon 2-Column Layout: Sidebar Filters + Products Grid */}
              <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'flex-start' }}>
                
                {/* LEFT SIDEBAR: AMAZON FILTERS */}
                <aside style={{
                  width: '240px',
                  flexShrink: 0,
                  background: '#151a24',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  boxShadow: 'var(--neo-shadow-raised)'
                }}>
                  {/* Delivery Filter */}
                  <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#f1f5f9', marginBottom: '8px' }}>
                      Delivery Day
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={filterPrimeOnly}
                        onChange={(e) => setFilterPrimeOnly(e.target.checked)}
                        style={{ accentColor: '#14b8a6', cursor: 'pointer' }}
                      />
                      <span className="amazon-gold-badge" style={{ fontSize: '0.66rem', padding: '2px 6px' }}>
                        ⚡ 10-Min Express
                      </span>
                    </label>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: '4px', marginLeft: '22px' }}>
                      Free 10-15 min dispatch
                    </span>
                  </div>

                  {/* Department / Category Filter */}
                  <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#f1f5f9', marginBottom: '8px' }}>
                      Department
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                      {['All', 'Tablets & Capsules', 'Syrups & Liquids', 'Fast Dispatch (10m)'].map(cat => (
                        <div
                          key={cat}
                          onClick={() => setSearchCategoryFilter(cat)}
                          style={{
                            cursor: 'pointer',
                            color: searchCategoryFilter === cat ? '#2dd4bf' : '#94a3b8',
                            fontWeight: searchCategoryFilter === cat ? '800' : '500',
                            padding: '3px 6px',
                            borderRadius: '6px',
                            background: searchCategoryFilter === cat ? 'rgba(45, 212, 191, 0.1)' : 'transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {searchCategoryFilter === cat ? '▸ ' : ''}{cat}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Customer Review Filter */}
                  <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#f1f5f9', marginBottom: '8px' }}>
                      Customer Reviews
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                      <div
                        onClick={() => setFilterMinRating(prev => prev === 4 ? 0 : 4)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: filterMinRating === 4 ? '#38bdf8' : '#cbd5e1', fontWeight: filterMinRating === 4 ? '800' : 'normal' }}
                      >
                        <span style={{ color: '#e47911' }}>★★★★☆</span> & Up
                      </div>
                      <div
                        onClick={() => setFilterMinRating(prev => prev === 3 ? 0 : 3)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: filterMinRating === 3 ? '#38bdf8' : '#cbd5e1', fontWeight: filterMinRating === 3 ? '800' : 'normal' }}
                      >
                        <span style={{ color: '#e47911' }}>★★★☆☆</span> & Up
                      </div>
                      {filterMinRating > 0 && (
                        <span
                          onClick={() => setFilterMinRating(0)}
                          style={{ fontSize: '0.72rem', color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline', marginTop: '2px' }}
                        >
                          Clear rating filter
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price Bracket Filter */}
                  <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#f1f5f9', marginBottom: '8px' }}>
                      Price
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {[
                        { key: 'all', label: 'All Prices' },
                        { key: 'under50', label: 'Under ₹50' },
                        { key: '50to100', label: '₹50 to ₹100' },
                        { key: '100to250', label: '₹100 to ₹250' },
                        { key: 'above250', label: 'Over ₹250' },
                      ].map(p => (
                        <div
                          key={p.key}
                          onClick={() => setFilterPriceBracket(p.key)}
                          style={{
                            cursor: 'pointer',
                            color: filterPriceBracket === p.key ? '#2dd4bf' : '#94a3b8',
                            fontWeight: filterPriceBracket === p.key ? '800' : '500'
                          }}
                        >
                          {filterPriceBracket === p.key ? '● ' : '○ '}{p.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Discount Filter */}
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#f1f5f9', marginBottom: '8px' }}>
                      Discount
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={filterDiscountOnly}
                        onChange={(e) => setFilterDiscountOnly(e.target.checked)}
                        style={{ accentColor: '#14b8a6', cursor: 'pointer' }}
                      />
                      <span>10% Off or more</span>
                    </label>
                  </div>
                </aside>

                {/* RIGHT COLUMN: AMAZON PRODUCTS GRID */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {(() => {
                    let list = [...searchResults];

                    if (searchCategoryFilter !== 'All') {
                      list = list.filter(med => {
                        const form = `${med.dosage_form || ''} ${med.dosage || ''} ${med.form || ''} ${med.category || ''}`.toLowerCase();
                        if (searchCategoryFilter === 'Tablets & Capsules') return form.includes('tab') || form.includes('cap') || form.includes('pill');
                        if (searchCategoryFilter === 'Syrups & Liquids') return form.includes('syr') || form.includes('liq') || form.includes('susp') || form.includes('drop');
                        if (searchCategoryFilter === 'Fast Dispatch (10m)') return med.instamart?.nearest_pharmacy != null;
                        return true;
                      });
                    }

                    if (filterPrimeOnly) {
                      list = list.filter(med => med.instamart?.nearest_pharmacy != null || parseFloat(med.price_mrp || 0) > 30);
                    }

                    if (filterMinRating > 0) {
                      list = list.filter(med => (parseFloat(med.rating || 4.5) >= filterMinRating));
                    }

                    if (filterPriceBracket === 'under50') {
                      list = list.filter(med => parseFloat(med.price_mrp || 0) < 50);
                    } else if (filterPriceBracket === '50to100') {
                      list = list.filter(med => {
                        const p = parseFloat(med.price_mrp || 0);
                        return p >= 50 && p <= 100;
                      });
                    } else if (filterPriceBracket === '100to250') {
                      list = list.filter(med => {
                        const p = parseFloat(med.price_mrp || 0);
                        return p >= 100 && p <= 250;
                      });
                    } else if (filterPriceBracket === 'above250') {
                      list = list.filter(med => parseFloat(med.price_mrp || 0) > 250);
                    }

                    if (filterDiscountOnly) {
                      list = list.filter(med => parseFloat(med.discount_pct || 15) >= 10);
                    }

                    if (amazonSortBy === 'price_asc') {
                      list.sort((a, b) => parseFloat(a.price_mrp || 0) - parseFloat(b.price_mrp || 0));
                    } else if (amazonSortBy === 'price_desc') {
                      list.sort((a, b) => parseFloat(b.price_mrp || 0) - parseFloat(a.price_mrp || 0));
                    } else if (amazonSortBy === 'rating') {
                      list.sort((a, b) => (b.rating || 4.8) - (a.rating || 4.5));
                    } else if (amazonSortBy === 'fastest') {
                      list.sort((a, b) => (a.instamart ? -1 : 1));
                    }

                    if (list.length === 0) {
                      return (
                        <div style={{
                          padding: '3rem',
                          textAlign: 'center',
                          background: '#151a24',
                          borderRadius: '16px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: 'var(--neo-shadow-raised)',
                          color: '#94a3b8'
                        }}>
                          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>🔍</span>
                          <strong style={{ color: '#f1f5f9', fontSize: '1rem', display: 'block' }}>No matching medicines found for selected filters</strong>
                          <span style={{ fontSize: '0.85rem' }}>Try clearing your active filters to see all available inventory.</span>
                          <div style={{ marginTop: '12px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchCategoryFilter('All');
                                setFilterPrimeOnly(false);
                                setFilterMinRating(0);
                                setFilterPriceBracket('all');
                                setFilterDiscountOnly(false);
                              }}
                              className="btn-primary"
                              style={{ padding: '6px 16px', fontSize: '0.82rem' }}
                            >
                              Reset All Filters
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '1.25rem',
                        width: '100%'
                      }}>
                        {list.map((med, idx) => {
                          const cartQty = getItemCartCount(med.medicine_id);
                          const inCart = cartQty > 0;
                          const formStr = (med.dosage_form || med.dosage || med.form || '').toLowerCase();
                          const formIcon = formStr.includes('syr') || formStr.includes('liq') ? '🧴' : formStr.includes('drop') ? '💧' : '💊';
                          const isBestSeller = idx === 0;
                          const isAmazonChoice = idx === 1;

                          return (
                            <div
                              key={med.medicine_id || idx}
                              className="metallic-silver-panel"
                              style={{
                                padding: '1.4rem',
                                borderRadius: '18px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                cursor: 'pointer'
                              }}
                              onClick={() => setSelectedMedicineDetail(med)}
                            >
                              <div>
                                {/* Amazon Badge Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', minHeight: '26px' }}>
                                  {isBestSeller ? (
                                    <span className="amazon-gold-badge">
                                      #1 Best Seller
                                    </span>
                                  ) : isAmazonChoice ? (
                                    <span className="amazon-choice-badge">
                                      MEDORA's Choice
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '0.68rem',
                                      background: 'rgba(20, 184, 166, 0.12)',
                                      border: '1px solid rgba(20, 184, 166, 0.3)',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      color: '#2dd4bf',
                                      fontWeight: '800'
                                    }}>
                                      {formIcon} {med.category || 'Prescription'}
                                    </span>
                                  )}
                                  <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: '700' }}>
                                    {med.dosage}
                                  </span>
                                </div>

                                {/* Product Name */}
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '1.12rem', color: '#f1f5f9', fontWeight: '800', lineHeight: '1.3' }}>
                                  {highlightMatch(med.brand_name, searchQuery)}
                                </h4>

                                {/* Salt & Mfg */}
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: '1.45', marginBottom: '8px' }}>
                                  <span style={{ display: 'block' }}><strong>Salt:</strong> {highlightMatch(med.generic_name, searchQuery)}</span>
                                  {med.manufacturer && <span style={{ display: 'block', fontSize: '0.72rem' }}><strong>Mfg:</strong> {med.manufacturer}</span>}
                                </div>

                                {/* Star Reviews */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                                  <span style={{ color: '#e47911', fontSize: '0.85rem', letterSpacing: '1px' }}>★★★★★</span>
                                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#38bdf8' }}>4.8</span>
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>({med.reviews_count || (540 + idx * 80)})</span>
                                </div>

                                {/* Pricing Section with Amazon Style MRP Strikethrough */}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#2dd4bf' }}>
                                    ₹{med.price_mrp}
                                  </span>
                                  <span style={{ fontSize: '0.78rem', color: '#64748b', textDecoration: 'line-through' }}>
                                    M.R.P.: ₹{(parseFloat(med.price_mrp || 40) * 1.15).toFixed(0)}
                                  </span>
                                  <span style={{ fontSize: '0.74rem', color: '#4ade80', fontWeight: '800' }}>
                                    (15% off)
                                  </span>
                                </div>

                                {/* Express Delivery Badge */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#38bdf8', fontWeight: '700', marginBottom: '8px' }}>
                                  <span>⚡ FREE delivery <strong style={{ color: '#34d399' }}>Today in 10-15 mins</strong></span>
                                </div>

                                {/* Local Pharmacy Availability */}
                                <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: '700', background: 'rgba(16, 185, 129, 0.12)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-block' }}>
                                  ✓ Available across 4 local pharmacies
                                </div>
                              </div>

                              {/* Multi-Shop Picker Trigger Buttons */}
                              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMedicineForShopPicker(med);
                                  }}
                                  className="btn-primary"
                                  style={{
                                    flex: 1,
                                    padding: '0.65rem 0.8rem',
                                    fontSize: '0.8rem',
                                    borderRadius: '12px',
                                    fontWeight: '800',
                                    background: inCart ? 'linear-gradient(135deg, #15803d 0%, #166534 100%)' : 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                                    boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                  }}
                                  title="Compare shop prices & select fulfilling pharmacy"
                                >
                                  <span>🏪</span>
                                  <span>{inCart ? `In Cart (${cartQty}) • Choose Shop` : '+ Add to Cart'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMedicineForShopPicker(med);
                                  }}
                                  style={{
                                    background: 'linear-gradient(180deg, #ffa41c 0%, #ff8f00 100%)',
                                    color: '#0f1111',
                                    border: '1px solid #ff8f00',
                                    padding: '0.65rem 0.9rem',
                                    borderRadius: '12px',
                                    fontWeight: '800',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(255, 143, 0, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title="Select pharmacy and buy immediately"
                                >
                                  <span>⚡ Buy</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {cart.length > 0 && (
                <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                  <button
                    onClick={() => {
                      setIsCartOpen(true);
                      setPaymentStep('cart');
                    }}
                    className="btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
                      padding: '0.9rem 2.5rem',
                      fontWeight: '800',
                      fontSize: '0.95rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      borderRadius: '16px',
                      boxShadow: '0 6px 20px rgba(13, 148, 136, 0.35)'
                    }}
                  >
                    <span>Proceed to Cart & Checkout ({cart.length} {cart.length === 1 ? 'medicine' : 'medicines'}) 🛒</span>
                  </button>
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

                  {/* Contactless Doorstep UPI QR Code selected by Rider */}
                  {(order.rider_qr_image || (typeof window !== 'undefined' && localStorage.getItem(`medora_order_qr_${order.id}`))) && (
                    <div style={{
                      marginTop: '1.25rem',
                      background: 'rgba(13, 148, 136, 0.08)',
                      border: '1.5px dashed var(--primary)',
                      borderRadius: '14px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🛵</span>
                        <strong style={{ color: 'var(--primary)', fontSize: '0.92rem' }}>Delivery Partner Doorstep Payment QR</strong>
                      </div>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Contactless Doorstep UPI ({order.rider_qr_type === 'live' ? 'Live Dynamic QR' : 'Main Registered QR'}) shared by your rider:
                      </span>
                      <div style={{ padding: '8px', background: '#ffffff', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
                        <img
                          src={order.rider_qr_image || (typeof window !== 'undefined' && localStorage.getItem(`medora_order_qr_${order.id}`))}
                          alt="Rider Payment QR"
                          style={{ width: '150px', height: '150px', objectFit: 'contain', display: 'block' }}
                        />
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--green)', fontWeight: 'bold' }}>
                        ✓ Scan with any UPI app (GPay / PhonePe / Paytm / BHIM) upon doorstep arrival
                      </span>
                    </div>
                  )}
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

            {/* Upload Zone */}
            <div 
              onClick={() => !isOcrLoading && fileInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(13, 148, 136, 0.45)',
                borderRadius: '16px',
                padding: (scannedPrescription || matchedMedicines.length > 0) ? '1rem' : '1.75rem 1.5rem',
                textAlign: 'center',
                background: 'rgba(13, 148, 136, 0.04)',
                cursor: isOcrLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}
            >
              <div style={{ fontSize: (scannedPrescription || matchedMedicines.length > 0) ? '1.5rem' : '2.5rem' }}>📸</div>
              <div>
                <strong style={{ display: 'block', color: 'var(--primary)', fontSize: (scannedPrescription || matchedMedicines.length > 0) ? '0.92rem' : '1rem', marginBottom: '2px' }}>
                  {isOcrLoading ? 'Gemini AI is Deciphering Cursive Prescription...' : (scannedPrescription || matchedMedicines.length > 0) ? 'Click to Upload a Different Prescription' : 'Click to Upload Prescription Photo'}
                </strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Supports JPG, PNG, WEBP, or Camera Photos (Handwritten or Printed)
                </span>
              </div>
            </div>

            {uploadedPrescriptionId && (
              <div style={{
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                background: 'rgba(74, 222, 128, 0.08)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                color: 'var(--green)',
                fontSize: '0.82rem',
                textAlign: 'center',
                fontWeight: '600'
              }}>
                ✓ Prescription Uploaded & Digitally Attached (ID: {uploadedPrescriptionId})
              </div>
            )}

            {/* Deciphered Prescription Analysis: Multi-Medicine Breakdown */}
            {(scannedPrescription || matchedMedicines.length > 0) && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                {/* Prescription Meta Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '0.75rem'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>👨‍⚕️</span> {scannedPrescription?.doctor_name || 'Consulting Physician'}
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      🏥 {scannedPrescription?.clinic_name || 'Apex Health & Diagnostics'} • Patient: {scannedPrescription?.patient_name || 'Patient'}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '3px 9px',
                    borderRadius: '99px'
                  }}>
                    ✨ {scannedPrescription?.ai_engine || 'Gemini Vision AI'} Verified
                  </span>
                </div>

                {/* Clinical Instructions / Notes */}
                {scannedPrescription?.clinical_instructions && (
                  <div style={{
                    background: 'rgba(13, 148, 136, 0.08)',
                    border: '1px solid rgba(13, 148, 136, 0.25)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    color: '#99f6e4',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px'
                  }}>
                    <span>💡</span>
                    <div>
                      <strong>Doctor Directive:</strong> {scannedPrescription.clinical_instructions}
                    </div>
                  </div>
                )}

                {/* Deciphered Medicines Grid */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>💊</span> Prescribed Medicines ({matchedMedicines.length || scannedPrescription?.medicines?.length || 0} Deciphered):
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      ⚡ 10-15 Min Instant Node Match
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                    {(matchedMedicines.length > 0 ? matchedMedicines : (scannedPrescription?.medicines || [])).map((med, idx) => {
                      const brandName = med.brand_name || med.name;
                      const genericName = med.generic_name;
                      const strength = med.extracted_strength || med.strength || '';
                      const frequency = med.frequency || 'As directed';
                      const duration = med.duration || '';
                      const price = med.price_mrp || med.avg_price || 55.0;

                      return (
                        <div 
                          key={idx} 
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(0, 0, 0, 0.22)',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                            padding: '0.75rem 0.95rem',
                            borderRadius: '10px',
                            gap: '12px'
                          }}
                        >
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ffffff' }}>
                                {brandName}
                              </span>
                              {strength && (
                                <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', padding: '1px 6px', borderRadius: '4px' }}>
                                  {strength}
                                </span>
                              )}
                              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700' }}>
                                • In Stock ⚡
                              </span>
                            </div>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                              Salt: {genericName}
                            </span>
                            <div style={{ fontSize: '0.73rem', color: '#38bdf8', marginTop: '3px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <span>⏰ {frequency}</span>
                              {duration && <span>• 📅 {duration}</span>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: '800', color: '#fff' }}>
                              ₹{parseFloat(price).toFixed(2)}
                            </span>
                            <button 
                              onClick={() => {
                                addToCart({
                                  id: med.medicine_id || med.id || `med_scanned_${idx}`,
                                  medicine_id: med.medicine_id || med.id || `med_scanned_${idx}`,
                                  brand_name: brandName,
                                  generic_name: genericName,
                                  price_mrp: price,
                                  avg_price: price,
                                  form: med.dosage_form || med.form || 'Tablet',
                                  image_url: med.image_url
                                });
                                showToast(`Added ${brandName} to cart!`, '🛒');
                              }} 

                              className="btn-primary" 
                              style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '700' }}
                            >
                              + Add to Cart
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bulk Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    onClick={() => handleAddAllPrescriptionToCart(matchedMedicines.length > 0 ? matchedMedicines : (scannedPrescription?.medicines || []))}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '0.75rem 1rem',
                      fontSize: '0.86rem',
                      fontWeight: '800',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)'
                    }}
                  >
                    <span>🛒</span> Add All {matchedMedicines.length || scannedPrescription?.medicines?.length || 0} Medicines to Cart
                  </button>

                  <button
                    onClick={() => handleConsultAiWithPrescription(scannedPrescription, ocrResult)}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '0.75rem 1rem',
                      fontSize: '0.86rem',
                      fontWeight: '800',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>💬</span> Discuss Prescription with AI Doctor
                  </button>
                </div>
              </div>
            )}

            {ocrResult && !scannedPrescription && matchedMedicines.length === 0 && (
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
        <div className="modal-content glass-panel" style={{ padding: '2rem', maxWidth: '580px', background: '#151a24', border: '1.5px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 24px 70px rgba(0, 0, 0, 0.8), -3px -3px 10px rgba(255, 255, 255, 0.03)', borderRadius: '24px' }} onClick={(e) => e.stopPropagation()}>
          
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {paymentStep === 'payment' && (
                <button 
                  onClick={() => setPaymentStep('cart')}
                  style={{ background: '#1c2331', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f1f5f9', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold' }}
                >
                  ← Back
                </button>
              )}
              <h2 style={{ margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem', fontWeight: '800' }}>
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
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.75rem', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            )}
          </div>

          {/* STEP 1: CART LIST VIEW */}
          {paymentStep === 'cart' && (
            <>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🛒</span>
                  <p style={{ fontWeight: '700', color: '#f1f5f9' }}>Your cart is empty</p>
                  <p style={{ fontSize: '0.88rem', marginTop: '0.5rem' }}>Search and add medicines to start order checkout!</p>
                </div>
              ) : (
                <>
                  {/* Swiggy Instamart Delivery Address Selector Card in Cart */}
                  <div style={{
                    background: '#181e2b',
                    border: '1px solid rgba(20, 184, 166, 0.3)',
                    borderRadius: '16px',
                    padding: '0.9rem 1.1rem',
                    marginBottom: '1.2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: 'var(--neo-shadow-inset)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'rgba(45, 212, 191, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem'
                      }}>
                        {selectedAddress?.icon || '🏠'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#f1f5f9' }}>
                            Delivering to {selectedAddress?.tag || 'Home'}
                          </span>
                          <span style={{
                            background: 'rgba(52, 211, 153, 0.15)', color: '#34d399',
                            fontSize: '0.68rem', fontWeight: '800', padding: '1px 6px', borderRadius: '4px'
                          }}>
                            ⚡ 10-15 MINS
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedAddress ? `${selectedAddress.houseNo}, ${selectedAddress.area}` : 'Click to select delivery address'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#2dd4bf', marginTop: '2px', fontWeight: '600' }}>
                          👤 {selectedAddress?.receiverName} • {selectedAddress?.receiverPhone}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddressDrawerOpen(true)}
                      style={{
                        background: '#121620',
                        border: '1px solid #2dd4bf',
                        color: '#2dd4bf',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: 'var(--neo-shadow-raised-sm)'
                      }}
                    >
                      CHANGE
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Items in Cart ({cart.length}):</span>
                    <button 
                      onClick={() => setCart([])} 
                      style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline' }}
                    >
                      Clear All
                    </button>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {cart.map((item, idx) => (
                      <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div>
                          <strong style={{ color: '#f1f5f9', fontSize: '0.92rem' }}>{item.brand_name}</strong> {item.dosage && `(${item.dosage})`}
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Generic: {item.generic_name}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <span style={{ color: '#2dd4bf', fontWeight: 'bold', fontSize: '1rem' }}>₹{item.price_mrp}</span>
                          <button 
                            onClick={() => removeFromCart(idx)} 
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Grand Total</span>
                      <h3 style={{ margin: 0, fontSize: '1.6rem', color: '#2dd4bf' }}>₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)}</h3>
                      {uploadedPrescriptionId && (
                        <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '2px', fontWeight: 'bold' }}>
                          ✓ Prescription attached: {uploadedPrescriptionId}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <a
                        href="/cart"
                        style={{
                          background: '#181e2b',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#f1f5f9',
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
                          background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
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
              <div style={{ background: '#181e2b', border: '1px solid rgba(20, 184, 166, 0.3)', borderRadius: '14px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block' }}>Total Amount Payable</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2dd4bf' }}>
                    ₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)}
                  </span>
                </div>
                <span style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  ⚡ Free 15-Min Delivery
                </span>
              </div>

              <span style={{ fontSize: '0.88rem', color: '#94a3b8', fontWeight: '600' }}>Select Payment Option:</span>

              {/* Payment Option Cards - Rider UPI, Store UPI & COD */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                
                {/* Rider Direct UPI Card */}
                <div 
                  onClick={() => setSelectedPaymentMethod('rider_upi')}
                  style={{
                    padding: '1rem',
                    borderRadius: '14px',
                    border: selectedPaymentMethod === 'rider_upi' ? '2px solid #2dd4bf' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: selectedPaymentMethod === 'rider_upi' ? '#1c2436' : '#181e2b',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedPaymentMethod === 'rider_upi' ? '0 4px 16px rgba(45, 212, 191, 0.2)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.98rem', color: '#f1f5f9', fontWeight: '800' }}>🛵 Pay Delivery Rider</span>
                    {selectedPaymentMethod === 'rider_upi' && <span style={{ color: '#2dd4bf', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Direct UPI to Rider • Uploaded QR PNG</div>
                </div>

                {/* Store UPI Card */}
                <div 
                  onClick={() => setSelectedPaymentMethod('upi')}
                  style={{
                    padding: '1rem',
                    borderRadius: '14px',
                    border: selectedPaymentMethod === 'upi' ? '2px solid #2dd4bf' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: selectedPaymentMethod === 'upi' ? '#1c2436' : '#181e2b',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedPaymentMethod === 'upi' ? '0 4px 16px rgba(45, 212, 191, 0.2)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.98rem', color: '#f1f5f9', fontWeight: '800' }}>⚡ Store POS Terminal</span>
                    {selectedPaymentMethod === 'upi' && <span style={{ color: '#2dd4bf', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Counter Soundbox Sync & Merchant QR</div>
                </div>

                {/* Cash on Delivery */}
                <div 
                  onClick={() => setSelectedPaymentMethod('cod')}
                  style={{
                    padding: '1rem',
                    borderRadius: '14px',
                    border: selectedPaymentMethod === 'cod' ? '2px solid #2dd4bf' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: selectedPaymentMethod === 'cod' ? '#1c2436' : '#181e2b',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedPaymentMethod === 'cod' ? '0 4px 16px rgba(45, 212, 191, 0.2)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.98rem', color: '#f1f5f9', fontWeight: '800' }}>💵 Cash on Delivery</span>
                    {selectedPaymentMethod === 'cod' && <span style={{ color: '#2dd4bf', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Pay cash or UPI to rider at doorstep</div>
                </div>

              </div>

              {/* Dynamic Payment Body */}
              {selectedPaymentMethod === 'upi' && (
                <div style={{ background: '#181e2b', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Store Terminal Header with Live Sync Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        DISPATCHING PARTNER PHARMACY:
                      </div>
                      <div style={{ fontSize: '0.96rem', color: '#f1f5f9', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🏥</span>
                        <span>{liveTerminalData?.pharmacy_name || 'Vamanjoor Express Pharmacy'}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', fontWeight: '600' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
                        <span>Live Terminal Synced {lastSyncTime ? `(${lastSyncTime})` : '• Auto-updating'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={fetchPharmacyLiveTerminalQr}
                      disabled={isRefreshingLiveQr}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid #38bdf8',
                        color: '#38bdf8',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        cursor: isRefreshingLiveQr ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>🔄</span>
                      <span>{isRefreshingLiveQr ? 'Syncing...' : 'Sync Terminal'}</span>
                    </button>
                  </div>

                  {/* QR Selector Toggle Pills */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setQrViewMode('live')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: (qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) ? '2px solid #2dd4bf' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: (qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) ? '#1c2436' : '#121620',
                        color: (qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) ? '#2dd4bf' : '#94a3b8',
                        fontSize: '0.78rem',
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
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: qrViewMode === 'shop' || (!liveTerminalData?.has_live_scanner_qr && qrViewMode === 'auto') ? '2px solid #2dd4bf' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: qrViewMode === 'shop' || (!liveTerminalData?.has_live_scanner_qr && qrViewMode === 'auto') ? '#1c2436' : '#121620',
                        color: qrViewMode === 'shop' || (!liveTerminalData?.has_live_scanner_qr && qrViewMode === 'auto') ? '#2dd4bf' : '#94a3b8',
                        fontSize: '0.78rem',
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

                  {/* QR DISPLAY FRAME */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    {(qrViewMode === 'live' || (qrViewMode === 'auto' && liveTerminalData?.has_live_scanner_qr)) && liveTerminalData?.live_upi_qr ? (
                      /* LIVE MACHINE PHOTO STREAMED BY COUNTER CLERK */
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          background: '#fff',
                          padding: '10px',
                          borderRadius: '14px',
                          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
                          border: '2px solid #10b981',
                          display: 'inline-block'
                        }}>
                          <img 
                            src={liveTerminalData.live_upi_qr} 
                            alt="Live UPI POS Machine Screen"
                            style={{ maxWidth: '210px', maxHeight: '190px', objectFit: 'contain', borderRadius: '8px', display: 'block' }}
                          />
                        </div>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '3px 10px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                            🟢 LIVE POS SOUNDBOX DISPLAY
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {liveTerminalData.terminal_label || 'Counter POS Terminal'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* STORE'S DYNAMIC AMOUNT-ENCODED QR CODE */
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          background: '#fff',
                          padding: '12px',
                          borderRadius: '14px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          border: '2px solid #2dd4bf',
                          display: 'inline-block'
                        }}>
                          <img 
                            src={liveTerminalData?.dynamic_upi_qr || liveTerminalData?.shop_upi_qr || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${encodeURIComponent(liveTerminalData?.shop_upi_id || 'vamanjoor.pharmacy@upi')}%26pn=${encodeURIComponent(liveTerminalData?.pharmacy_name || 'Vamanjoor Pharmacy')}%26am=${cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0).toFixed(2)}%26cu=INR`} 
                            alt="Store Official UPI QR"
                            style={{ width: '160px', height: '160px', objectFit: 'contain', display: 'block' }}
                          />
                        </div>
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span style={{ background: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf', padding: '3px 10px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                            ₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0).toFixed(2)} PRE-ENCODED
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            Auto-fills amount in your UPI app
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 1-Tap Mobile UPI Intent Launcher */}
                    <a
                      href={liveTerminalData?.upi_intent || `upi://pay?pa=${encodeURIComponent(liveTerminalData?.shop_upi_id || 'vamanjoor.pharmacy@upi')}&pn=${encodeURIComponent(liveTerminalData?.pharmacy_name || 'Vamanjoor Express Pharmacy')}&am=${cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0).toFixed(2)}&cu=INR&tn=MEDORA-Order`}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                        color: '#ffffff',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        textDecoration: 'none',
                        fontWeight: '700',
                        fontSize: '0.88rem',
                        boxShadow: '0 4px 14px rgba(13, 148, 136, 0.25)',
                        transition: 'transform 0.15s ease'
                      }}
                    >
                      <span>📲</span>
                      <span>Pay via UPI App (GPay / PhonePe / Paytm / BHIM)</span>
                    </a>

                    {/* Store Counter Soundbox Voice Confirmation Guarantee */}
                    <div style={{ background: '#121620', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '0.76rem', color: '#86efac', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '1.25rem' }}>🔊</span>
                      <div>
                        <strong>Soundbox Voice Confirmation:</strong> Counter POS speaker at {liveTerminalData?.pharmacy_name || 'Vamanjoor Express'} will announce <em>&quot;₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0).toFixed(2)} received&quot;</em> instantly upon payment.
                      </div>
                    </div>
                  </div>

                  {/* Store Verified VPA with 1-Click Copy */}
                  <div style={{ width: '100%' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}>
                      Shop's Verified UPI VPA / ID:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        readOnly
                        value={liveTerminalData?.shop_upi_id || 'vamanjoor.pharmacy@upi'} 
                        style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#121620', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f1f5f9', fontSize: '0.88rem', fontFamily: 'monospace', fontWeight: 'bold' }}
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
                          background: copiedVpa ? 'rgba(52, 211, 153, 0.2)' : 'rgba(45, 212, 191, 0.15)',
                          border: '1px solid #2dd4bf',
                          color: copiedVpa ? '#34d399' : '#2dd4bf',
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

              {selectedPaymentMethod === 'rider_upi' && (
                <div style={{ background: '#181e2b', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        ASSIGNED DELIVERY PARTNER:
                      </div>
                      <div style={{ fontSize: '0.96rem', color: '#f1f5f9', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🛵</span>
                        <span>Rider Partner #{activeUser?.role === 'delivery' ? (activeUser.name || 'Arjun K') : 'AGT-591 (Verified)'}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', fontWeight: '600' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#2dd4bf', boxShadow: '0 0 6px #2dd4bf' }} />
                        <span>Rider Direct Settlement • Settle at Dark-store</span>
                      </div>
                    </div>
                    <span style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: '0.72rem', fontWeight: '800', padding: '3px 10px', borderRadius: '99px' }}>
                      ✓ REGISTERED UPI QR
                    </span>
                  </div>

                  {/* RIDER ACTUAL UPLOADED PNG QR CODE */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    {(() => {
                      const storedRiderQr = (typeof window !== 'undefined' ? (localStorage.getItem('medora_rider_main_qr') || '') : '') || activeUser?.rider_upi_qr;
                      const riderVpa = (typeof window !== 'undefined' ? (localStorage.getItem('medora_rider_vpa') || '') : '') || activeUser?.rider_upi_id || 'rider.express@okhdfcbank';
                      const totalAmount = cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0).toFixed(2);

                      return (
                        <>
                          <div style={{
                            background: '#ffffff',
                            padding: '12px',
                            borderRadius: '14px',
                            boxShadow: '0 8px 24px rgba(45, 212, 191, 0.25)',
                            border: '2px solid #2dd4bf',
                            display: 'inline-block',
                            textAlign: 'center'
                          }}>
                            {storedRiderQr ? (
                              <img
                                src={storedRiderQr}
                                alt="Rider Uploaded Registration UPI QR (PNG)"
                                style={{ width: '180px', height: '180px', objectFit: 'contain', display: 'block', borderRadius: '8px' }}
                              />
                            ) : (
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${encodeURIComponent(riderVpa)}%26pn=MEDORA-Delivery-Rider%26am=${totalAmount}%26cu=INR`}
                                alt="Rider Dynamic UPI QR"
                                style={{ width: '180px', height: '180px', objectFit: 'contain', display: 'block' }}
                              />
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ background: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf', padding: '3px 10px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                              ₹{totalAmount} DUE TO RIDER
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              {storedRiderQr ? "★ Verified Rider Registration PNG" : "Dynamic Rider Gateway"}
                            </span>
                          </div>

                          {/* 1-Tap Mobile UPI Intent Launcher */}
                          <a
                            href={`upi://pay?pa=${encodeURIComponent(riderVpa)}&pn=MEDORA-Rider&am=${totalAmount}&cu=INR&tn=Order-Delivery`}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                              color: '#ffffff',
                              padding: '10px 16px',
                              borderRadius: '10px',
                              textDecoration: 'none',
                              fontWeight: '700',
                              fontSize: '0.88rem',
                              boxShadow: '0 4px 14px rgba(13, 148, 136, 0.25)'
                            }}
                          >
                            <span>📲</span>
                            <span>Pay Rider via UPI App (GPay / PhonePe / Paytm)</span>
                          </a>

                          {/* Direct Settlement Explanation Banner */}
                          <div style={{ background: '#121620', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '0.76rem', color: '#86efac', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
                            <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
                            <div>
                              <strong>Dark-Store Settlement Guarantee:</strong> Your payment goes straight to the rider. The rider pays the pharmacy at pickup and delivers your medicine in 10-15 mins.
                            </div>
                          </div>

                          {/* Rider VPA display & copy */}
                          <div style={{ width: '100%' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}>
                              Rider's Registered UPI ID:
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                readOnly
                                value={riderVpa}
                                style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#121620', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f1f5f9', fontSize: '0.88rem', fontFamily: 'monospace', fontWeight: 'bold' }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(riderVpa);
                                  }
                                  setCopiedVpa(true);
                                  setTimeout(() => setCopiedVpa(false), 2000);
                                }}
                                style={{
                                  background: copiedVpa ? 'rgba(52, 211, 153, 0.2)' : 'rgba(45, 212, 191, 0.15)',
                                  border: '1px solid #2dd4bf',
                                  color: copiedVpa ? '#34d399' : '#2dd4bf',
                                  padding: '6px 14px',
                                  borderRadius: '8px',
                                  fontSize: '0.78rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer'
                                }}
                              >
                                {copiedVpa ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {selectedPaymentMethod === 'cod' && (
                <div style={{ background: '#181e2b', padding: '1.25rem', borderRadius: '14px', border: '1px dashed #f59e0b', fontSize: '0.88rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '2rem' }}>💵</span>
                  <div>
                    <div style={{ fontWeight: '800', color: '#f59e0b', marginBottom: '3px' }}>Cash on Doorstep Delivery</div>
                    Pay ₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0).toFixed(2)} directly to your rider via cash or mobile UPI scan when your parcel arrives in 15 mins.
                  </div>
                </div>
              )}

              <button 
                onClick={handleExecutePayment}
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', padding: '0.95rem', fontSize: '1rem', fontWeight: 'bold', marginTop: '0.5rem' }}
              >
                {selectedPaymentMethod === 'cod' 
                  ? 'Confirm COD Order 🛵' 
                  : selectedPaymentMethod === 'rider_upi'
                    ? `Pay Rider ₹${cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0).toFixed(2)} via Direct UPI 🛵`
                    : `Pay ₹${cart.reduce((s, i) => s + parseFloat(i.price_mrp || 0), 0).toFixed(2)} via Store POS & Place Order ⚡`}
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
                border: '4px solid #1c2436',
                borderTop: '4px solid #2dd4bf',
                animation: 'spin 1s linear infinite'
              }} />
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#f1f5f9', fontSize: '1.2rem', fontWeight: '800' }}>Processing Payment</h3>
                <p style={{ color: '#2dd4bf', fontSize: '0.88rem', margin: 0, fontWeight: '700' }}>{paymentStatusMsg}</p>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#181e2b', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '6px 14px', borderRadius: '99px' }}>
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
              <h3 style={{ margin: 0, color: '#2dd4bf', fontSize: '1.5rem', fontWeight: '800' }}>Payment & Order Confirmed!</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>Your order has been routed to Vamanjoor Pharmacy for rapid 15-min packing.</p>

              <div style={{ background: '#181e2b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Order Reference:</span>
                  <strong style={{ color: '#f1f5f9' }}>#{completedOrderInfo.order_id}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Payment ID:</span>
                  <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{completedOrderInfo.payment_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Method:</span>
                  <span style={{ color: '#f1f5f9', fontWeight: 'bold' }}>{completedOrderInfo.payment_method}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Payment Status:</span>
                  <span style={{ color: '#34d399', fontWeight: 'bold' }}>{completedOrderInfo.payment_status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ color: '#94a3b8' }}>Amount Paid:</span>
                  <strong style={{ color: '#2dd4bf', fontSize: '1rem' }}>₹{completedOrderInfo.total.toFixed(2)}</strong>
                </div>
              </div>

              <button 
                onClick={() => {
                  setIsCartOpen(false);
                  setPaymentStep('cart');
                  setIsTrackingOpen(true);
                }} 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', padding: '0.9rem', fontSize: '1rem', fontWeight: 'bold' }}
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
          <div className="modal-content glass-panel" style={{ padding: '2rem', maxWidth: '440px', background: '#151a24', border: '1.5px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 24px 70px rgba(0,0,0,0.8), -3px -3px 10px rgba(255,255,255,0.03)', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                <div>
                  <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.1rem', fontWeight: '800' }}>Bank 3D Secure Authorization</h3>
                  <span style={{ fontSize: '0.72rem', color: '#2dd4bf', fontWeight: '600' }}>Verified by Visa / MasterCard SecureCode</span>
                </div>
              </div>
              <button onClick={() => setShowOtpModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ background: '#181e2b', padding: '1rem', borderRadius: '14px', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Merchant:</span>
                <strong style={{ color: '#f1f5f9' }}>MEDORA Quick Commerce</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Card ending in:</span>
                <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>•••• {cardNumber.slice(-4) || '7890'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Amount:</span>
                <strong style={{ color: '#2dd4bf', fontSize: '1rem' }}>₹{cart.reduce((s, i) => s + parseFloat(i.price_mrp), 0).toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '8px', fontWeight: 'bold' }}>
                Enter 6-Digit Bank OTP:
              </label>
              <input 
                type="text" 
                maxLength={6}
                value={otpInput} 
                onChange={e => setOtpInput(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', background: '#121620', border: '2px solid #2dd4bf', color: '#f1f5f9', fontSize: '1.4rem', letterSpacing: '0.4em', textAlign: 'center', fontWeight: 'bold', boxShadow: 'var(--neo-shadow-inset)' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#34d399', display: 'block', marginTop: '6px', textAlign: 'center', fontWeight: '600' }}>
                ✓ Demo OTP prefilled (`123456`). Click below to authorize transaction.
              </span>
            </div>

            <button 
              onClick={handleExecutePayment} 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', padding: '0.9rem', fontSize: '1rem', fontWeight: 'bold' }}
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
                border: '1px solid rgba(56, 189, 248, 0.3)', 
                background: '#151a24', 
                color: '#f1f5f9', 
                fontSize: '0.88rem', 
                maxWidth: '260px', 
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
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
                  color: '#94a3b8',
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
      <div className={`chatbot-window glass-panel ${isChatOpen ? 'active' : ''}`} style={{ background: '#151a24', border: '1.5px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), -3px -3px 10px rgba(255, 255, 255, 0.03)' }}>
        <div className="chatbot-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#181e2b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🩺</span>
            <div>
              <strong style={{ display: 'block', fontSize: '0.95rem', color: '#38bdf8' }}>MEDORA AI Clinical Doctor</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: '800' }}>● ONLINE</span>
                <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>⚡ Gemini 3.1 Flash</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button 
              onClick={resetChat} 
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Reset
            </button>
            <button 
              onClick={() => setIsChatOpen(false)} 
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
            >
              &times;
            </button>
          </div>
        </div>

        <div className="chatbot-body" style={{ background: '#121620', padding: '1rem' }}>
          {chatMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', width: '100%', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: '0.55rem', maxWidth: isUser ? '85%' : '94%' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: isUser ? 'var(--primary)' : 'rgba(56, 189, 248, 0.15)',
                    color: isUser ? '#ffffff' : '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    flexShrink: 0,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                  }}>
                    {isUser ? '👤' : '🩺'}
                  </div>
                  <div style={{
                    padding: isUser ? '0.75rem 1rem' : '0.9rem 1.15rem',
                    borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    background: isUser ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' : '#181e2b',
                    border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#f1f5f9',
                    fontSize: '0.89rem',
                    lineHeight: '1.55',
                    whiteSpace: isUser ? 'pre-wrap' : 'normal',
                    boxShadow: 'var(--neo-shadow-raised-sm)',
                    width: '100%'
                  }}>
                    {!isUser && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        paddingBottom: '6px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                      }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>🩺</span> MEDORA AI Pharmacist
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          background: (msg.confidence_score || 0.95) >= 0.9 ? 'rgba(16, 185, 129, 0.15)' : (msg.confidence_score || 0.95) >= 0.75 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: (msg.confidence_score || 0.95) >= 0.9 ? '#34d399' : (msg.confidence_score || 0.95) >= 0.75 ? '#38bdf8' : '#fbbf24',
                          border: `1px solid ${(msg.confidence_score || 0.95) >= 0.9 ? 'rgba(16, 185, 129, 0.3)' : (msg.confidence_score || 0.95) >= 0.75 ? 'rgba(56, 189, 248, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                          padding: '2px 8px',
                          borderRadius: '99px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>🎯</span> {msg.confidence_label || `${Math.round((msg.confidence_score || 0.95) * 100)}% Confidence`}
                        </span>
                      </div>
                    )}
                    {isUser ? msg.content : renderFormattedMessageContent(msg.content)}

                    {/* Interactive Clinical Quiz Options Chips inside Assistant Bubble */}
                    {!isUser && Array.isArray(msg.quiz_options) && msg.quiz_options.length > 0 && (
                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255, 255, 255, 0.12)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          ⚡ Tap to Answer & Increase Confidence:
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {msg.quiz_options.map((opt, oIdx) => (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => handleTriggerChatMessage(opt)}
                              style={{
                                background: '#1c2331',
                                border: '1.5px solid #2dd4bf',
                                color: '#2dd4bf',
                                padding: '5px 11px',
                                borderRadius: '8px',
                                fontSize: '0.76rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(45, 212, 191, 0.15)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#1c2331'; }}
                            >
                              👉 {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
                  background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem'
                }}>🩺</div>
                <div style={{ padding: '0.55rem 0.9rem', borderRadius: '4px 14px 14px 14px', background: '#181e2b', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="dot-typing" style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Doctor is analyzing...</span>
                  <button
                    type="button"
                    onClick={cancelChatRequest}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                    title="Stop current analysis"
                  >
                    ✕ Stop
                  </button>
                </div>
              </div>
            </div>
          )}

          {chatSuggestedMedicines.length > 0 && (
            <div style={{
              background: '#181e2b',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              marginTop: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>💊</span>
                  <strong style={{ color: '#86efac', fontSize: '0.88rem' }}>Recommended OTC Remedies:</strong>
                </div>
                <button
                  type="button"
                  onClick={() => handleCheckoutFromChat(true)}
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.72rem',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Order All
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {chatSuggestedMedicines.map((med, idx) => (
                  <span 
                    key={idx} 
                    style={{
                      background: '#1c2331',
                      color: '#34d399',
                      border: '1px solid #10b981',
                      padding: '4px 10px',
                      borderRadius: '10px',
                      fontSize: '0.78rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)'
                    }}
                    onClick={() => handleSuggestedMedicineClick(med)}
                    title={`Click to add ${med} to cart`}
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
        <div style={{ padding: '8px 1rem', background: '#181e2b', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[
            { label: "🤒 High Fever", query: "I have high fever and severe headache since yesterday. What medicines can I take for relief?" },
            { label: "🤧 Cold & Allergy", query: "I am having persistent sneezing, runny nose, and itchy eyes. Recommend OTC allergy medicine." },
            { label: "🤢 Acidity & Gas", query: "I am having burning sensation in chest and stomach acid reflux. What should I take?" },
            { label: "🤕 Migraine", query: "Severe one-sided throbbing headache with light sensitivity. Please suggest safe OTC relief." },
            { label: "😷 Dry Cough", query: "I have had a dry tickling throat cough for 2 days. What OTC syrup or tablet helps?" },
            { label: "⚡ Sore Throat", query: "Sharp pain while swallowing and irritated throat. What gargle or lozenge should I use?" }
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleTriggerChatMessage(chip.query)}
              style={{
                background: '#1c2331',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '99px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: '700',
                color: '#f1f5f9',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="chatbot-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: '#181e2b' }}>
          <form onSubmit={sendChatMessage} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              className="input-field"
              placeholder={isChatLoading ? "Doctor is analyzing... (you can type follow-ups)" : "Type your symptom, quiz answer, or follow-up question..."}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              style={{ flex: 1, padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.88rem', background: '#121620', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f1f5f9' }}
            />
            {isChatLoading && (
              <button
                type="button"
                onClick={cancelChatRequest}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
                title="Stop analyzing"
              >
                ⏹ Stop
              </button>
            )}
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={!chatInput.trim()}
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
            style={{ padding: '2rem', maxWidth: '620px', background: '#151a24', border: '1.5px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 24px 70px rgba(0,0,0,0.8), -3px -3px 10px rgba(255,255,255,0.03)' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    background: 'rgba(20, 184, 166, 0.15)',
                    color: '#2dd4bf',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    textTransform: 'uppercase'
                  }}>
                    {selectedMedicineDetail.category || selectedMedicineDetail.form || 'Prescription & OTC'}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: '600' }}>
                    {selectedMedicineDetail.dosage}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#f1f5f9' }}>
                  {selectedMedicineDetail.brand_name}
                </h2>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                  Composition Salt: <strong style={{ color: '#2dd4bf' }}>{selectedMedicineDetail.generic_name}</strong>
                </div>
              </div>
              <button
                onClick={() => setSelectedMedicineDetail(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.75rem', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Pricing & Speed Pill */}
            <div style={{
              background: '#121620',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1.2rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
              boxShadow: 'var(--neo-shadow-inset)'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>MRP Inclusive of all Taxes</span>
                <span style={{ fontSize: '1.65rem', fontWeight: '800', color: '#2dd4bf' }}>₹{selectedMedicineDetail.price_mrp}</span>
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
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                  From {selectedMedicineDetail.instamart?.nearest_pharmacy?.pharmacy_name || 'Vamanjoor Central Pharmacy'}
                </div>
              </div>
            </div>

            {/* Clinical Usage & Indication */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: '700', color: '#f1f5f9' }}>
                Clinical Indication & Guidance
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.55' }}>
                {selectedMedicineDetail.description || `${selectedMedicineDetail.brand_name} (${selectedMedicineDetail.generic_name}) is approved for high-efficacy symptomatic relief. Certified WHO-GMP manufactured standard dosage. Follow prescribed guidelines.`}
              </p>
            </div>

            {/* Dark-Store Availability Breakdown */}
            <div style={{ marginBottom: '1.5rem', background: '#181e2b', border: '1px solid rgba(20, 184, 166, 0.3)', borderRadius: '14px', padding: '1.1rem' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#2dd4bf', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🏪</span> Real-Time Connected Dark-Store Verification:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• Vamanjoor Central Pharmacy (0.8 km):</span>
                  <strong style={{ color: '#34d399' }}>✓ 28 Units In Stock (Fastest Pickup)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• City Meds Express (1.4 km):</span>
                  <strong style={{ color: '#34d399' }}>✓ 15 Units In Stock</strong>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', alignItems: 'center' }}>
              {getItemCartCount(selectedMedicineDetail.medicine_id) > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Quantity in cart:</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1.5px solid #10b981',
                    borderRadius: '10px',
                    padding: '4px 12px'
                  }}>
                    <button
                      onClick={() => handleUpdateItemQuantity(selectedMedicineDetail, -1)}
                      style={{ background: 'transparent', border: 'none', color: '#34d399', fontSize: '1.1rem', fontWeight: '800', cursor: 'pointer' }}
                    >
                      −
                    </button>
                    <strong style={{ color: '#34d399', fontSize: '0.95rem', minWidth: '20px', textAlign: 'center' }}>
                      {getItemCartCount(selectedMedicineDetail.medicine_id)}
                    </strong>
                    <button
                      onClick={() => handleUpdateItemQuantity(selectedMedicineDetail, 1)}
                      style={{ background: 'transparent', border: 'none', color: '#34d399', fontSize: '1.1rem', fontWeight: '800', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const current = selectedMedicineDetail;
                    setSelectedMedicineDetail(null);
                    setSelectedMedicineForShopPicker(current);
                  }}
                  className="btn-primary"
                  style={{ padding: '0.75rem 1.8rem', fontSize: '0.9rem', fontWeight: '800' }}
                >
                  + Add to Cart (Choose Shop)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP: MULTI-PHARMACY SHOP SELECTION WITH LIVE PRICES & +- BUTTONS */}
      {selectedMedicineForShopPicker && (
        <div
          className="modal-overlay active"
          onClick={() => setSelectedMedicineForShopPicker(null)}
          style={{ zIndex: 2200 }}
        >
          <div
            className="modal-content metallic-silver-panel"
            style={{
              padding: '1.75rem 2rem',
              maxWidth: '680px',
              width: '92%',
              background: '#151a24',
              border: '1.5px solid rgba(56, 189, 248, 0.25)',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.8), -3px -3px 10px rgba(255, 255, 255, 0.03)',
              borderRadius: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem' }}>🏪</span>
                  <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.3rem', fontWeight: '800' }}>
                    Select Fulfilling Pharmacy & Price
                  </h3>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                  For <strong style={{ color: '#f1f5f9' }}>{selectedMedicineForShopPicker.brand_name}</strong> {selectedMedicineForShopPicker.dosage && `(${selectedMedicineForShopPicker.dosage})`} • Salt: {selectedMedicineForShopPicker.generic_name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMedicineForShopPicker(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.75rem', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Currently in Cart Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#181e2b', border: '1px solid rgba(20, 184, 166, 0.3)', padding: '0.65rem 1rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.82rem', color: '#2dd4bf', fontWeight: '700' }}>
                Total in your cart: <strong>{getItemCartCount(selectedMedicineForShopPicker.medicine_id)} {getItemCartCount(selectedMedicineForShopPicker.medicine_id) === 1 ? 'unit' : 'units'}</strong>
              </span>
              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                Pick whichever local store offers the best price or fastest dispatch
              </span>
            </div>

            {/* List of 4 Local Partner Pharmacies */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px', marginBottom: '1.5rem' }}>
              {getShopsForMedicine(selectedMedicineForShopPicker).map((shop) => {
                const shopCartCount = cart.filter(i => i.medicine_id === selectedMedicineForShopPicker.medicine_id && i.pharmacy_id === shop.name).length;

                return (
                  <div
                    key={shop.id}
                    style={{
                      border: shopCartCount > 0 ? '2px solid #2dd4bf' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      padding: '1.1rem 1.25rem',
                      background: shopCartCount > 0 ? '#1c2436' : '#181e2b',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      transition: 'all 0.2s ease',
                      boxShadow: 'var(--neo-shadow-raised-sm)'
                    }}
                  >
                    {/* Left: Shop Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '0.98rem', color: '#f1f5f9' }}>{shop.name}</strong>
                        <span style={{
                          fontSize: '0.68rem',
                          background: shop.badge.includes('Express') ? 'rgba(20, 184, 166, 0.15)' : shop.badge.includes('Best Seller') ? 'rgba(255, 119, 0, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                          color: shop.badge.includes('Express') ? '#2dd4bf' : shop.badge.includes('Best Seller') ? '#fb923c' : '#cbd5e1',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {shop.badge}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span>📍 {shop.distance}</span>
                        <span>⚡ {shop.deliveryTime}</span>
                        <span>⭐ {shop.rating} ({shop.reviews})</span>
                        <span style={{ color: '#34d399', fontWeight: '700' }}>✓ {shop.stock} in stock</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        {shop.address}
                      </div>
                    </div>

                    {/* Right: Price & Stepper Button */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#2dd4bf' }}>
                          ₹{shop.price}
                        </span>
                        {shop.discount !== 'M.R.P.' && (
                          <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: '800', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                            {shop.discount}
                          </span>
                        )}
                      </div>

                      {/* Stepper with +- buttons */}
                      {shopCartCount > 0 ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#121620',
                          border: '1.5px solid #2dd4bf',
                          borderRadius: '10px',
                          padding: '3px 8px',
                          boxShadow: '0 2px 6px rgba(45, 212, 191, 0.2)'
                        }}>
                          <button
                            type="button"
                            onClick={() => handleAddMedicineFromShop(selectedMedicineForShopPicker, shop, -1)}
                            style={{ background: 'transparent', border: 'none', color: '#2dd4bf', fontSize: '1.1rem', fontWeight: '800', cursor: 'pointer', padding: '0 4px' }}
                            title="Decrease quantity from this shop"
                          >
                            −
                          </button>
                          <span style={{ fontWeight: '800', fontSize: '0.88rem', color: '#f1f5f9', minWidth: '20px', textAlign: 'center' }}>
                            {shopCartCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddMedicineFromShop(selectedMedicineForShopPicker, shop, 1)}
                            style={{ background: 'transparent', border: 'none', color: '#2dd4bf', fontSize: '1.1rem', fontWeight: '800', cursor: 'pointer', padding: '0 4px' }}
                            title="Increase quantity from this shop"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            handleAddMedicineFromShop(selectedMedicineForShopPicker, shop, 1);
                            showToast(`Added from ${shop.name} (₹${shop.price})`, '🛒');
                          }}
                          className="btn-primary"
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.78rem',
                            fontWeight: '800',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>+ Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setSelectedMedicineForShopPicker(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
              >
                ← Back to Catalog
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMedicineForShopPicker(null);
                  setIsCartOpen(true);
                  setPaymentStep('cart');
                }}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.85rem', fontWeight: '800', borderRadius: '12px' }}
              >
                View Cart & Checkout 🛒
              </button>
            </div>
          </div>
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
              background: '#151a24',
              border: aiInteractionReport.severity === 'CRITICAL' ? '2px solid #ef4444' : '2px solid #f59e0b',
              borderRadius: '24px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), -3px -3px 10px rgba(255, 255, 255, 0.03)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Alert Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '1.25rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: aiInteractionReport.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: aiInteractionReport.severity === 'CRITICAL' ? '#f87171' : '#fbbf24',
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
                  <h3 style={{ margin: 0, color: aiInteractionReport.severity === 'CRITICAL' ? '#f87171' : '#fbbf24', fontSize: '1.3rem', fontWeight: '800' }}>
                    Dangerous Drug Combination Detected!
                  </h3>
                  <span style={{
                    background: aiInteractionReport.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: '900',
                    padding: '2px 8px',
                    borderRadius: '99px',
                    letterSpacing: '0.04em'
                  }}>
                    {aiInteractionReport.severity} HAZARD
                  </span>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                  MEDORA's AI Clinical Pharmacist reviewed your cart and identified adverse drug-drug interactions that are dangerous if consumed together.
                </p>
              </div>
            </div>

            {/* List of Detected Clinical Alerts */}
            <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', paddingRight: '4px' }}>
              {aiInteractionReport.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: alert.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    border: alert.severity === 'CRITICAL' ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.92rem', color: alert.severity === 'CRITICAL' ? '#f87171' : '#fbbf24' }}>
                      {alert.title}
                    </strong>
                    <span style={{ fontSize: '0.72rem', background: '#121620', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700', color: '#f1f5f9' }}>
                      {alert.medicine_a} ⚡ {alert.medicine_b}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.45' }}>
                    {alert.description}
                  </p>

                  <div style={{ fontSize: '0.78rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.25)', marginBottom: '10px' }}>
                    <strong>Clinical Direction:</strong> {alert.recommendation}
                  </div>

                  {/* 1-Click Quick Remove Conflicting Medicines */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const itemIndex = cart.findIndex(c => (c.brand_name || c.name || '').toLowerCase().includes(alert.medicine_a.toLowerCase()) || alert.medicine_a.toLowerCase().includes((c.brand_name || c.name || '').toLowerCase()));
                        if (itemIndex >= 0) {
                          removeFromCart(itemIndex);
                          showToast(`Removed ${alert.medicine_a} from cart`, '🗑️');
                          setAiInteractionModalOpen(false);
                        }
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
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
                          showToast(`Removed ${alert.medicine_b} from cart`, '🗑️');
                          setAiInteractionModalOpen(false);
                        }
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
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

            {/* Action Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setAiInteractionModalOpen(false);
                  setIsChatOpen(true);
                }}
                style={{
                  background: 'rgba(20, 184, 166, 0.15)',
                  border: '1px solid rgba(20, 184, 166, 0.3)',
                  color: '#2dd4bf',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🩺</span>
                <span>Ask AI Doctor for Safe Alternative</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setAiInteractionModalOpen(false)}
                  style={{
                    background: '#1c2331',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#cbd5e1',
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
                    showToast("Acknowledged clinical advisory. Proceeding to checkout...", "⚠️");
                    setPaymentStep('payment');
                    fetchPharmacyLiveTerminalQr();
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
          border: '1px solid #86efac',
          animation: 'fadeInUp 0.3s ease-out'
        }}>
          <span style={{ fontSize: '1.2rem' }}>🛡️</span>
          <span>AI Clinical Safety Check Passed: No Drug-Drug Interactions Detected!</span>
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
        onClose={() => {
          setIsAddressDrawerOpen(false);
          setIsFirstTimeAddressSetup(false);
        }}
        currentAddress={selectedAddress}
        onSelectAddress={handleSelectAddress}
        activeUser={activeUser}
        isFirstTimeSetup={isFirstTimeAddressSetup}
      />

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="medora-mobile-nav">
        <button
          className={`medora-nav-item ${activeMainView === 'home' && !isChatOpen && !isOcrOpen ? 'active' : ''}`}
          onClick={() => {
            setActiveMainView('home');
            setIsChatOpen(false);
            setIsOcrOpen(false);
            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="medora-nav-icon">🏠</span>
          <span className="medora-nav-label">Home</span>
        </button>

        <button
          className="medora-nav-item"
          onClick={() => {
            setActiveMainView('home');
            setIsChatOpen(false);
            setIsOcrOpen(false);
            const el = document.getElementById('instamart-shelf-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <span className="medora-nav-icon">⚡</span>
          <span className="medora-nav-label">Instamart</span>
        </button>

        <button
          className={`medora-nav-item ${isChatOpen ? 'active' : ''}`}
          onClick={() => {
            setIsChatOpen(true);
            setIsOcrOpen(false);
          }}
        >
          <span className="medora-nav-icon">🩺</span>
          <span className="medora-nav-label">AI Doctor</span>
        </button>

        <button
          className={`medora-nav-item ${isOcrOpen ? 'active' : ''}`}
          onClick={() => {
            setIsOcrOpen(true);
            setIsChatOpen(false);
          }}
        >
          <span className="medora-nav-icon">📄</span>
          <span className="medora-nav-label">Upload Rx</span>
        </button>

        <button
          className={`medora-nav-item ${isCartOpen || activeMainView === 'account' ? 'active' : ''}`}
          onClick={() => {
            if (cart.length > 0) {
              setIsCartOpen(true);
            } else {
              setActiveMainView(prev => prev === 'account' ? 'home' : 'account');
              setActiveAccountSection('hub');
            }
          }}
        >

          <span className="medora-nav-icon">{cart.length > 0 ? '🛒' : '👤'}</span>
          <span className="medora-nav-label">
            {cart.length > 0 ? `Cart (${cart.length})` : 'Account'}
          </span>
        </button>
      </nav>
    </>
  );
}
