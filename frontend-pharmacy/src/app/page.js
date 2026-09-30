"use client";
import React, { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const PHARMACY_ID = "PHARM_001";
const PHARMACY_DISPLAY_NAME = "Vamanjoor Express Pharmacy, Mangalore";

const STATUS_CONFIG = {
  pending:          { label: "New Order",       color: "#ef4444", bg: "rgba(239,68,68,0.12)",     next: "accepted",         nextLabel: "✅ Accept & Pack",        nextColor: "#10b981" },
  accepted:         { label: "Packing",          color: "#f59e0b", bg: "rgba(245,158,11,0.12)",    next: "ready",            nextLabel: "📦 Mark Ready for Pickup", nextColor: "#6366f1" },
  ready:            { label: "Ready for Pickup", color: "#6366f1", bg: "rgba(99,102,241,0.12)",    next: "out_for_delivery", nextLabel: "🛵 Dispatch to Rider",     nextColor: "#0ea5e9" },
  out_for_delivery: { label: "Out for Delivery", color: "#0ea5e9", bg: "rgba(14,165,233,0.12)",    next: null,               nextLabel: null,                      nextColor: null },
  delivered:        { label: "Delivered ✓",      color: "#10b981", bg: "rgba(16,185,129,0.08)",   next: null,               nextLabel: null,                      nextColor: null },
};

export default function PharmacyDashboard() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'inventory' | 'quiz' | 'scanner' | 'inquiries' | 'terminal'

  // Live Orders State
  const [orders, setOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null);

  // Store Stock & Full Database Catalog State
  const [fullCatalog, setFullCatalog] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [catalogStockFilter, setCatalogStockFilter] = useState('all'); // 'all' | 'in_stock' | 'out_of_stock'
  const [inventoryEdits, setInventoryEdits] = useState({});
  const [isSavingInventory, setIsSavingInventory] = useState(false);
  const [inventorySaveNotice, setInventorySaveNotice] = useState(null);

  // OCR Scanner State (Single & Batch Gemini Vision)
  const [scannerMode, setScannerMode] = useState('batch'); // 'batch' | 'single'
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchPreviews, setBatchPreviews] = useState([]);
  const [isExtractingBatch, setIsExtractingBatch] = useState(false);
  const [extractedBatch, setExtractedBatch] = useState([]);
  const [isCommittingBatch, setIsCommittingBatch] = useState(false);
  const [batchNotice, setBatchNotice] = useState(null);

  // Single OCR Scanner State
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrImage, setOcrImage] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [medicineName, setMedicineName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [quantityToAdd, setQuantityToAdd] = useState('50');

  // Chemical Compounds Onboarding Quiz State
  const [compoundsList, setCompoundsList] = useState([]);
  const [compoundSelections, setCompoundSelections] = useState({});
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);
  const [quizSuccessNotice, setQuizSuccessNotice] = useState(null);

  // Missing Medicine Inquiries Broadcast State
  const [missingFeed, setMissingFeed] = useState({ urgent_alerts: [], ignored_requests: [], total_pending: 0, total_ignored: 0 });
  const [currentUrgentAlert, setCurrentUrgentAlert] = useState(null);
  const [acceptingReq, setAcceptingReq] = useState(null);
  const [acceptQty, setAcceptQty] = useState('50');
  const [acceptPrice, setAcceptPrice] = useState('85.00');

  // Live POS Terminal & UPI Machine Scanner State
  const [liveTerminalInfo, setLiveTerminalInfo] = useState(null);
  const [scannerStream, setScannerStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' | 'user'
  const [capturedMachinePhoto, setCapturedMachinePhoto] = useState(null);
  const [terminalLabel, setTerminalLabel] = useState('Counter UPI Soundbox Display');
  const [customUpiId, setCustomUpiId] = useState('');
  const [customUpiQr, setCustomUpiQr] = useState('');
  const [isSavingUpiSettings, setIsSavingUpiSettings] = useState(false);
  const [upiSettingsNotice, setUpiSettingsNotice] = useState(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [scannerNotice, setScannerNotice] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);

  // ─── DATA FETCHING ───

  // Fetch Full Catalog of All Medicines in Database
  const fetchFullCatalog = async () => {
    setIsCatalogLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/medicines/all?pharmacy_id=${encodeURIComponent(PHARMACY_ID)}`);
      if (res.ok) {
        const data = await res.json();
        setFullCatalog(data.medicines || []);
      }
    } catch (e) {
      console.warn("Failed to fetch full catalog:", e);
    } finally {
      setIsCatalogLoading(false);
    }
  };

  // Fetch Essential Chemical Compounds
  const fetchEssentialCompounds = async () => {
    try {
      const res = await fetch(`${API}/api/v1/medicines/essential-compounds`);
      if (res.ok) {
        const data = await res.json();
        const list = data.compounds || [];
        setCompoundsList(list);

        try {
          const saved = localStorage.getItem('medora_pharmacy_compounds');
          if (saved) {
            setCompoundSelections(JSON.parse(saved));
          } else {
            const defaults = {};
            list.forEach(c => { defaults[c.compound_name] = true; });
            setCompoundSelections(defaults);
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Failed to fetch essential compounds:", e);
    }
  };

  // Fetch Missing Medicine Feed (Urgent Popups & Ignored List)
  const fetchMissingFeed = async () => {
    try {
      const res = await fetch(`${API}/api/v1/medicines/missing/pharmacy-feed?pharmacy_id=${encodeURIComponent(PHARMACY_ID)}`);
      if (res.ok) {
        const data = await res.json();
        setMissingFeed(data);
        if (data.urgent_alerts && data.urgent_alerts.length > 0) {
          if (!currentUrgentAlert || !data.urgent_alerts.some(a => a.id === currentUrgentAlert.id)) {
            setCurrentUrgentAlert(data.urgent_alerts[0]);
          }
        } else {
          setCurrentUrgentAlert(null);
        }
      }
    } catch (e) {
      console.warn("Failed to poll missing medicine feed:", e);
    }
  };

  // Poll Orders and Missing Inquiries
  useEffect(() => {
    fetch(`${API}/health`).then(r => setBackendOnline(r.ok)).catch(() => setBackendOnline(false));
    fetchFullCatalog();
    fetchEssentialCompounds();
    fetchMissingFeed();

    const fetchOrders = async () => {
      try {
        const [r1, r2, r3] = await Promise.all([
          fetch(`${API}/api/v1/orders/active?status=pending`),
          fetch(`${API}/api/v1/orders/active?status=accepted`),
          fetch(`${API}/api/v1/orders/active?status=ready`),
        ]);
        setBackendOnline(true);
        const [d1, d2, d3] = await Promise.all([
          r1.ok ? r1.json() : { orders: [] },
          r2.ok ? r2.json() : { orders: [] },
          r3.ok ? r3.json() : { orders: [] },
        ]);
        const combined = [...(d1.orders || []), ...(d2.orders || []), ...(d3.orders || [])];
        if (combined.length > orders.length) {
          try {
            const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
            audio.play().catch(() => {});
          } catch (e) {}
        }
        setOrders(combined);
      } catch (e) {
        setBackendOnline(false);
      }
    };

    fetchOrders();
    const timer = setInterval(() => {
      fetchOrders();
      fetchMissingFeed();
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // ─── ORDER MANAGEMENT HANDLERS ───
  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`${API}/api/v1/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      } else {
        alert(`Failed to update order ${orderId}`);
      }
    } catch (e) {
      alert("Lost connection to backend.");
    }
    setUpdatingId(null);
  };

  const handleReject = async (orderId) => {
    if (!confirm(`Reject order ${orderId}?`)) return;
    await handleStatusUpdate(orderId, "rejected");
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const clearOrders = async () => {
    if (!confirm("Clear ALL orders from the system? This cannot be undone.")) return;
    try {
      await fetch(`${API}/api/v1/orders/clear`, { method: 'DELETE' });
      setOrders([]);
      alert("✅ All orders cleared.");
    } catch (e) {
      alert("Failed to reach backend.");
    }
  };

  // ─── STOCK & FULL CATALOG MANAGEMENT HANDLERS ───
  const handleToggleStock = (medId) => {
    setFullCatalog(prev => prev.map(med => {
      if (med.medicine_id === medId) {
        const nextStatus = !med.in_stock;
        const nextQty = nextStatus ? (med.quantity > 0 ? med.quantity : 50) : 0;
        setInventoryEdits(curr => ({
          ...curr,
          [medId]: { in_stock: nextStatus, quantity: nextQty }
        }));
        return { ...med, in_stock: nextStatus, quantity: nextQty };
      }
      return med;
    }));
  };

  const handleQuantityChange = (medId, newQty) => {
    const qtyInt = Math.max(0, parseInt(newQty, 10) || 0);
    const nextStatus = qtyInt > 0;
    setFullCatalog(prev => prev.map(med => {
      if (med.medicine_id === medId) {
        setInventoryEdits(curr => ({
          ...curr,
          [medId]: { in_stock: nextStatus, quantity: qtyInt }
        }));
        return { ...med, in_stock: nextStatus, quantity: qtyInt };
      }
      return med;
    }));
  };

  const handleBulkMarkAll = (status) => {
    setFullCatalog(prev => {
      const nextEdits = { ...inventoryEdits };
      const updated = prev.map(med => {
        const qty = status ? (med.quantity > 0 ? med.quantity : 50) : 0;
        nextEdits[med.medicine_id] = { in_stock: status, quantity: qty };
        return { ...med, in_stock: status, quantity: qty };
      });
      setInventoryEdits(nextEdits);
      return updated;
    });
  };

  const handleApplyInventoryChanges = async () => {
    const keys = Object.keys(inventoryEdits);
    if (keys.length === 0) {
      alert("No stock changes pending. Toggle medicines as available or out of stock to apply.");
      return;
    }
    setIsSavingInventory(true);
    try {
      const res = await fetch(`${API}/api/v1/medicines/pharmacy/inventory-bulk-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacy_id: PHARMACY_ID,
          updates: inventoryEdits
        })
      });
      if (res.ok) {
        const data = await res.json();
        setInventorySaveNotice(`✅ Live Stock Updated! Successfully modified ${data.updated_count || keys.length} medicines in your pharmacy catalog.`);
        setInventoryEdits({});
        setTimeout(() => setInventorySaveNotice(null), 5000);
      } else {
        alert("Failed to apply stock updates to database.");
      }
    } catch (e) {
      alert("Error contacting inventory server.");
    } finally {
      setIsSavingInventory(false);
    }
  };

  // ─── OCR SCANNER HANDLERS ───
  const handleFileUpload = async (e) => {
    e.preventDefault();
    const fileInput = e.target.elements[0];
    if (!fileInput.files || !fileInput.files.length) return;
    
    const file = fileInput.files[0];
    setOcrImage(URL.createObjectURL(file));
    setIsExtracting(true);
    setOcrResult(null);

    try {
      let text = "";
      try {
        const ocrFormData = new FormData();
        ocrFormData.append('file', file);
        ocrFormData.append('apikey', 'helloworld');
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
      } catch (err) {}

      if (!text) {
        const result = await Tesseract.recognize(file, 'eng');
        text = result.data.text || "";
      }
      
      const parsed = {
        medicine_name: text.split('\n')[0] || "Sample Medicine 500mg",
        generic: "Generic Formula",
        expiry: "12/2028",
        manufacturer: "Pharma Corp"
      };

      setOcrResult(parsed);
      setMedicineName(parsed.medicine_name);
      setGenericName(parsed.generic);
      setExpiryDate(parsed.expiry);
      setManufacturer(parsed.manufacturer);
      setQuantityToAdd('50');
    } catch (err) {
      alert("OCR scanning error");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSyncToInventory = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/v1/medicines/inventory/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacy_id: PHARMACY_ID,
          medicine_name: medicineName,
          generic: genericName,
          quantity: parseInt(quantityToAdd, 10) || 50,
          expiry: expiryDate,
          manufacturer: manufacturer
        })
      });
      if (res.ok) {
        alert(`✅ Successfully synced ${quantityToAdd} units of "${medicineName}" to inventory!`);
        setOcrResult(null);
        setOcrImage(null);
        fetchFullCatalog();
      } else {
        alert("Failed to sync inventory.");
      }
    } catch (e) {
      alert("Error syncing to inventory backend.");
    }
  };

  // ─── BATCH STRIP OCR & GEMINI VISION HANDLERS ───
  const handleBatchFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setBatchFiles(prev => [...prev, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setBatchPreviews(prev => [...prev, { name: file.name, url: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleClearBatch = () => {
    setBatchFiles([]);
    setBatchPreviews([]);
    setExtractedBatch([]);
    setBatchNotice(null);
  };

  const handleProcessBatchGemini = async () => {
    if (batchFiles.length === 0) {
      alert("Please select at least one medicine strip photo to scan.");
      return;
    }
    
    setIsExtractingBatch(true);
    setBatchNotice(null);
    
    const formData = new FormData();
    batchFiles.forEach(file => {
      formData.append('files', file);
    });
    
    try {
      const res = await fetch(`${API}/api/v1/medicines/inventory/ocr-batch-gemini?pharmacy_id=${encodeURIComponent(PHARMACY_ID)}`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setExtractedBatch(data.items || []);
        setBatchNotice(`✨ Google Gemini Vision successfully extracted ${data.total_extracted} medicine strip(s)! Review details below and click Add to Inventory.`);
      } else {
        alert("Batch strip OCR failed. Please verify connection to backend.");
      }
    } catch (err) {
      alert(`Error during Gemini OCR processing: ${err.message}`);
    } finally {
      setIsExtractingBatch(false);
    }
  };

  const handleUpdateBatchItem = (id, field, value) => {
    setExtractedBatch(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRemoveBatchItem = (id) => {
    setExtractedBatch(prev => prev.filter(item => item.id !== id));
  };

  const handleCommitBatchInventory = async () => {
    if (extractedBatch.length === 0) return;
    setIsCommittingBatch(true);
    try {
      const payload = {
        pharmacy_id: PHARMACY_ID,
        items: extractedBatch.map(item => ({
          medicine_name: item.medicine_name,
          generic_name: item.generic_name,
          quantity: parseInt(item.quantity, 10) || 50,
          expiry_date: item.expiry_date,
          price_mrp: item.price_mrp,
          manufacturer: item.manufacturer,
          batch_number: item.batch_number
        }))
      };
      const res = await fetch(`${API}/api/v1/medicines/inventory/batch-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setBatchNotice(`🎉 Successfully committed ${data.added_count} scanned medicines to your pharmacy inventory!`);
        setExtractedBatch([]);
        setBatchFiles([]);
        setBatchPreviews([]);
        fetchFullCatalog();
      } else {
        alert("Failed to commit batch medicines to database.");
      }
    } catch (err) {
      alert(`Failed to commit batch: ${err.message}`);
    } finally {
      setIsCommittingBatch(false);
    }
  };
  const handleToggleCompound = (name) => {
    setCompoundSelections(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleSelectAllCompounds = (inStock) => {
    const updated = {};
    compoundsList.forEach(c => {
      updated[c.compound_name] = inStock;
    });
    setCompoundSelections(updated);
  };

  const handleSaveCompoundQuiz = async () => {
    setIsSavingQuiz(true);
    try {
      const res = await fetch(`${API}/api/v1/medicines/pharmacy/compound-quiz-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacy_id: PHARMACY_ID,
          selections: compoundSelections
        })
      });
      if (res.ok) {
        const data = await res.json();
        try {
          localStorage.setItem('medora_pharmacy_compounds', JSON.stringify(compoundSelections));
        } catch (e) {}
        setQuizSuccessNotice(`🎉 ${data.message || 'Inventory updated successfully!'}`);
        fetchFullCatalog();
        setTimeout(() => {
          setQuizSuccessNotice(null);
        }, 3000);
      } else {
        alert("Failed to sync compound inventory.");
      }
    } catch (e) {
      alert("Error saving compound inventory to backend.");
    } finally {
      setIsSavingQuiz(false);
    }
  };

  // ─── MISSING INQUIRY HANDLERS ───
  const handleRespondMissing = async (reqId, action, qty = 50, price = "85.00") => {
    try {
      const res = await fetch(`${API}/api/v1/medicines/missing/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: reqId,
          pharmacy_id: PHARMACY_ID,
          action: action,
          quantity: parseInt(qty, 10) || 50,
          price: price
        })
      });
      if (res.ok) {
        if (action === 'in_stock') {
          alert(`✅ Stock Added! You marked this medicine in stock (+${qty} units).`);
        }
        setCurrentUrgentAlert(null);
        setAcceptingReq(null);
        fetchMissingFeed();
        fetchFullCatalog();
      }
    } catch (e) {
      alert("Failed to respond to medicine request.");
    }
  };

  // ─── LIVE UPI TERMINAL SCANNER HANDLERS ───
  const fetchLiveTerminalStatus = async () => {
    try {
      const res = await fetch(`${API}/api/v1/medicines/pharmacy/live-terminal-qr?pharmacy_id=${encodeURIComponent(PHARMACY_ID)}`);
      if (res.ok) {
        const data = await res.json();
        setLiveTerminalInfo(data);
        if (data.shop_upi_id && !customUpiId) {
          setCustomUpiId(data.shop_upi_id);
        }
        if (data.terminal_label) {
          setTerminalLabel(data.terminal_label);
        }
      }
    } catch (e) {
      console.warn("Could not fetch live terminal status:", e);
    }
  };

  const savePermanentUpiSettings = async () => {
    if (!customUpiId || !customUpiId.includes('@')) {
      return alert("Please enter a valid UPI VPA (e.g. yourstore@okaxis, 9876543210@paytm).");
    }
    setIsSavingUpiSettings(true);
    setUpiSettingsNotice(null);
    try {
      const res = await fetch(`${API}/api/v1/medicines/pharmacy/update-upi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacy_id: PHARMACY_ID,
          shop_upi_id: customUpiId.trim(),
          pharmacy_name: PHARMACY_DISPLAY_NAME,
          shop_upi_qr: customUpiQr || null,
          terminal_label: terminalLabel.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setUpiSettingsNotice("✅ Store UPI VPA & QR settings synchronized with all customer checkouts!");
        fetchLiveTerminalStatus();
      } else {
        alert(data.detail || "Failed to save UPI settings.");
      }
    } catch (e) {
      alert("Error updating UPI settings: " + e.message);
    } finally {
      setIsSavingUpiSettings(false);
    }
  };

  const handlePermanentQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomUpiQr(ev.target.result);
      setUpiSettingsNotice("📷 New Store Permanent QR sticker selected! Click 'Save & Sync Store UPI' below to apply.");
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetchLiveTerminalStatus();
  }, []);

  useEffect(() => {
    return () => {
      if (scannerStream) {
        scannerStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [scannerStream]);

  const startCamera = async (facing = cameraFacing) => {
    setCameraError(null);
    try {
      if (scannerStream) {
        scannerStream.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      setScannerStream(stream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Camera init failed:", err);
      setCameraError(err.message || "Camera access denied or device not supported.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (scannerStream) {
      scannerStream.getTracks().forEach(t => t.stop());
      setScannerStream(null);
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    if (isCameraActive) {
      startCamera(nextFacing);
    }
  };

  const captureSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      const v = videoRef.current;
      canvas.width = v.videoWidth || 640;
      canvas.height = v.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedMachinePhoto(dataUrl);
      setScannerNotice("📸 Machine screen captured! Click 'Broadcast Snapshot to Customer Checkout' below to send it live.");
    } catch (err) {
      alert("Snapshot capture failed: " + err.message);
    }
  };

  const handleManualPhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedMachinePhoto(ev.target.result);
      setScannerNotice("📷 Machine photo selected! Click 'Broadcast Snapshot to Customer Checkout' below to send it live.");
    };
    reader.readAsDataURL(file);
  };

  const broadcastLiveQr = async () => {
    if (!capturedMachinePhoto) {
      return alert("Please take a snapshot of your UPI machine screen or upload a photo first.");
    }
    setIsBroadcasting(true);
    setScannerNotice(null);
    try {
      const res = await fetch(`${API}/api/v1/medicines/pharmacy/live-terminal-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacy_id: PHARMACY_ID,
          live_upi_qr: capturedMachinePhoto,
          terminal_label: terminalLabel,
          expires_in_minutes: 30
        })
      });
      if (res.ok) {
        setScannerNotice("🟢 Live Machine Photo is now ACTIVE! Customers in checkout will see this display before confirming orders.");
        fetchLiveTerminalStatus();
        stopCamera();
      } else {
        alert("Failed to broadcast terminal QR.");
      }
    } catch (e) {
      alert("Broadcast error: " + e.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const resetToPermanentQr = async () => {
    try {
      await fetch(`${API}/api/v1/medicines/pharmacy/live-terminal-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacy_id: PHARMACY_ID,
          live_upi_qr: "",
          terminal_label: "Store Official Permanent QR",
          expires_in_minutes: 0
        })
      });
      setCapturedMachinePhoto(null);
      fetchLiveTerminalStatus();
      setScannerNotice("Reverted: Customer checkout will now display your official static KYC Shop QR code.");
    } catch (e) {
      alert("Failed to reset QR.");
    }
  };

  // ─── FILTERED FULL CATALOG ───
  const filteredCatalog = fullCatalog.filter(med => {
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase();
      const match = (med.brand_name || '').toLowerCase().includes(q) ||
                    (med.generic_name || '').toLowerCase().includes(q) ||
                    (med.category || '').toLowerCase().includes(q) ||
                    (med.manufacturer || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (catalogCategory !== 'All') {
      if (!(med.category || '').toLowerCase().includes(catalogCategory.toLowerCase())) {
        return false;
      }
    }
    if (catalogStockFilter === 'in_stock' && !med.in_stock) return false;
    if (catalogStockFilter === 'out_of_stock' && med.in_stock) return false;
    return true;
  });

  const totalCatalogCount = fullCatalog.length;
  const inStockCount = fullCatalog.filter(m => m.in_stock).length;
  const outOfStockCount = totalCatalogCount - inStockCount;
  const pendingEditsCount = Object.keys(inventoryEdits).length;

  const CATEGORY_CHIPS = ['All', 'Antibiotic', 'Analgesic', 'Antacid', 'Respiratory', 'Cardiovascular', 'Antidiabetic', 'Supplements'];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem', fontFamily: 'Outfit, sans-serif' }}>
      
      {/* ─── TOP PORTAL HEADER ─── */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🏥</span>
            <h1 style={{ fontSize: '1.6rem', color: 'var(--primary)', margin: 0, fontWeight: '800', letterSpacing: '-0.02em' }}>
              Pharmacy Store Management Hub
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
            {PHARMACY_DISPLAY_NAME} • Instant Fulfillment, Live Catalog Stock Control & AI OCR
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            fontSize: '0.78rem',
            padding: '6px 14px',
            borderRadius: '99px',
            fontWeight: 'bold',
            background: backendOnline ? 'rgba(74,222,128,0.15)' : 'rgba(255,107,107,0.15)',
            color: backendOnline ? 'var(--green)' : 'var(--red)',
            border: backendOnline ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,107,107,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: backendOnline ? 'var(--green)' : 'var(--red)' }} />
            {backendOnline ? 'Cloud Synced' : 'Offline'}
          </span>
          <button
            onClick={() => setActiveTab('terminal')}
            style={{
              background: liveTerminalInfo?.has_live_scanner_qr ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(13, 148, 136, 0.15)',
              border: liveTerminalInfo?.has_live_scanner_qr ? '1px solid #10b981' : '1px solid rgba(13, 148, 136, 0.4)',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: liveTerminalInfo?.has_live_scanner_qr ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span>📷</span>
            <span>{liveTerminalInfo?.has_live_scanner_qr ? 'Live POS Broadcast: Active' : 'Live UPI Scanner'}</span>
          </button>
          <button
            onClick={clearOrders}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,107,107,0.3)',
              color: 'var(--red)',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 'bold'
            }}
          >
            Clear Orders
          </button>
        </div>
      </header>

      {/* ─── ICONIC TOP NAVIGATION MENU TABS ─── */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '18px',
        padding: '6px',
        marginBottom: '2rem',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        overflowX: 'auto',
        gap: '6px'
      }}>
        {/* Tab 1: Live Orders */}
        <button
          onClick={() => setActiveTab('orders')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeTab === 'orders' ? 'linear-gradient(135deg, #0d9488, #059669)' : 'transparent',
            border: 'none',
            color: activeTab === 'orders' ? '#ffffff' : '#94a3b8',
            padding: '10px 18px',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'orders' ? '0 4px 16px rgba(13, 148, 136, 0.4)' : 'none'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>📦</span>
          <span>Live Orders</span>
          {orders.length > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.72rem',
              padding: '2px 7px',
              borderRadius: '99px',
              fontWeight: '800'
            }}>
              {orders.length}
            </span>
          )}
        </button>

        {/* Tab 2: Store Stock & Full Catalog (Requested Feature!) */}
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeTab === 'inventory' ? 'linear-gradient(135deg, #0d9488, #059669)' : 'transparent',
            border: 'none',
            color: activeTab === 'inventory' ? '#ffffff' : '#94a3b8',
            padding: '10px 18px',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'inventory' ? '0 4px 16px rgba(13, 148, 136, 0.4)' : 'none'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>📋</span>
          <span>Store Stock & Catalog</span>
          {pendingEditsCount > 0 && (
            <span style={{
              background: '#f59e0b',
              color: '#0f172a',
              fontSize: '0.72rem',
              padding: '2px 7px',
              borderRadius: '99px',
              fontWeight: '800'
            }}>
              {pendingEditsCount} unsaved
            </span>
          )}
        </button>

        {/* Tab 3: Chemical Compounds Quiz */}
        <button
          onClick={() => setActiveTab('quiz')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeTab === 'quiz' ? 'linear-gradient(135deg, #0d9488, #059669)' : 'transparent',
            border: 'none',
            color: activeTab === 'quiz' ? '#ffffff' : '#94a3b8',
            padding: '10px 18px',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'quiz' ? '0 4px 16px rgba(13, 148, 136, 0.4)' : 'none'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🧪</span>
          <span>Chemical Compounds Quiz</span>
        </button>

        {/* Tab 4: OCR Scanner */}
        <button
          onClick={() => setActiveTab('scanner')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeTab === 'scanner' ? 'linear-gradient(135deg, #0d9488, #059669)' : 'transparent',
            border: 'none',
            color: activeTab === 'scanner' ? '#ffffff' : '#94a3b8',
            padding: '10px 18px',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'scanner' ? '0 4px 16px rgba(13, 148, 136, 0.4)' : 'none'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>📷</span>
          <span>OCR Stock Scanner</span>
        </button>

        {/* Tab 5: Patient Inquiries */}
        <button
          onClick={() => setActiveTab('inquiries')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeTab === 'inquiries' ? 'linear-gradient(135deg, #0d9488, #059669)' : 'transparent',
            border: 'none',
            color: activeTab === 'inquiries' ? '#ffffff' : '#94a3b8',
            padding: '10px 18px',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'inquiries' ? '0 4px 16px rgba(13, 148, 136, 0.4)' : 'none'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🔔</span>
          <span>Patient Inquiries</span>
          {missingFeed.total_ignored > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.72rem',
              padding: '2px 7px',
              borderRadius: '99px',
              fontWeight: '800'
            }}>
              {missingFeed.total_ignored}
            </span>
          )}
        </button>

        {/* Tab 6: Live UPI Soundbox & POS Terminal Scanner */}
        <button
          onClick={() => setActiveTab('terminal')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeTab === 'terminal' ? 'linear-gradient(135deg, #0d9488, #059669)' : 'transparent',
            border: 'none',
            color: activeTab === 'terminal' ? '#ffffff' : '#94a3b8',
            padding: '10px 18px',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            whiteSpace: 'nowrap',
            boxShadow: activeTab === 'terminal' ? '0 4px 16px rgba(13, 148, 136, 0.4)' : 'none'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>📷</span>
          <span>Live UPI Scanner</span>
          {liveTerminalInfo?.has_live_scanner_qr ? (
            <span style={{
              background: '#10b981',
              color: '#ffffff',
              fontSize: '0.72rem',
              padding: '2px 7px',
              borderRadius: '99px',
              fontWeight: '800'
            }}>
              LIVE
            </span>
          ) : (
            <span style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#94a3b8',
              fontSize: '0.7rem',
              padding: '2px 6px',
              borderRadius: '99px',
              fontWeight: '600'
            }}>
              POS
            </span>
          )}
        </button>
      </nav>

      {/* ─── TAB 1: LIVE ORDERS FEED ─── */}
      {activeTab === 'orders' && (
        <section className="glass-panel" style={{ padding: '2rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span>📦</span> Incoming Orders Queue ({orders.length})
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                Auto-refreshing in real-time. Advance order status to notify customers and dispatch riders.
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>
              ⚡ 3s Live Heartbeat
            </span>
          </div>

          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.8rem' }}>🕐</span>
              <p style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>No pending orders right now</p>
              <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                Orders placed by nearby customers will automatically pop up here with an audible alert chime!
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {orders.map(order => {
                const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                return (
                  <div key={order.id} style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1.4rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '1.1rem', color: '#fff' }}>Order #{order.id}</strong>
                        <span style={{ padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '800', background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>
                        <div style={{ color: '#cbd5e1', marginBottom: '4px' }}>
                          👤 <strong>Customer:</strong> {order.user}
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                          🧾 <strong>Items:</strong> {Array.isArray(order.items) ? order.items.map(i => `${i.quantity || 1}x ${i.brand_name || i.name}`).join(', ') : order.items}
                        </div>
                        {order.delivery_address && (
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            📍 <strong>Address:</strong> {order.delivery_address.area || order.delivery_address.houseNo || 'Nearby Customer'}
                          </div>
                        )}
                        {order.payment_method && (
                          <div style={{ color: 'var(--primary)', marginTop: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            💳 Payment: {order.payment_method.toUpperCase()} ({order.payment_status || 'paid'})
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.85rem' }}>
                      {statusInfo.next && (
                        <button
                          onClick={() => handleStatusUpdate(order.id, statusInfo.next)}
                          disabled={updatingId === order.id}
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: 'center', padding: '0.65rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                        >
                          {updatingId === order.id ? 'Updating...' : statusInfo.nextLabel}
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleReject(order.id)}
                          style={{
                            background: 'rgba(255,107,107,0.15)',
                            color: 'var(--red)',
                            border: '1px solid rgba(255,107,107,0.3)',
                            borderRadius: '8px',
                            padding: '0.65rem 1rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 'bold'
                          }}
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ─── TAB 2: STORE STOCK & FULL DATABASE CATALOG (REQUESTED CORE FEATURE) ─── */}
      {activeTab === 'inventory' && (
        <section className="glass-panel" style={{ padding: '2rem', borderRadius: '20px' }}>
          
          {/* Top Banner and Metrics */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.45rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>📋</span> Store Inventory & Full Medicine Catalog
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                  Review all medicines available in the database. Toggle the checkbox beside any medicine to instantly mark it as <strong>Available</strong> or <strong>Out of Stock</strong>, adjust quantities, and click <strong>Apply & Save</strong>.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  onClick={() => handleBulkMarkAll(true)}
                  style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ✓ Mark All In Stock
                </button>
                <button
                  onClick={() => handleBulkMarkAll(false)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ✗ Mark All Out of Stock
                </button>
                <button
                  onClick={fetchFullCatalog}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#cbd5e1',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ↺ Refresh
                </button>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1rem 1.25rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total In Catalog</span>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>{totalCatalogCount}</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '14px', padding: '1rem 1.25rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em' }}>In Stock & Available</span>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>{inStockCount}</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '14px', padding: '1rem 1.25rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Out of Stock</span>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>{outOfStockCount}</div>
              </div>
              <div style={{ background: pendingEditsCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.04)', border: pendingEditsCount > 0 ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1rem 1.25rem' }}>
                <span style={{ fontSize: '0.78rem', color: pendingEditsCount > 0 ? '#f59e0b' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Unsaved Modifications</span>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: pendingEditsCount > 0 ? '#f59e0b' : '#94a3b8', marginTop: '2px' }}>
                  {pendingEditsCount}
                </div>
              </div>
            </div>

            {/* Notification alert on save */}
            {inventorySaveNotice && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(13, 148, 136, 0.25))',
                border: '1px solid #10b981',
                color: '#34d399',
                padding: '0.85rem 1.25rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                fontWeight: '700',
                fontSize: '0.9rem'
              }}>
                {inventorySaveNotice}
              </div>
            )}

            {/* Search and Filters Toolbar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontSize: '1rem' }}>🔍</span>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search medicine brand name, generic chemical formula, manufacturer..."
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%', borderRadius: '12px' }}
                  />
                  {catalogSearch && (
                    <button
                      onClick={() => setCatalogSearch('')}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Stock filter toggles */}
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    onClick={() => setCatalogStockFilter('all')}
                    style={{
                      background: catalogStockFilter === 'all' ? 'var(--primary)' : 'transparent',
                      color: catalogStockFilter === 'all' ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    All ({totalCatalogCount})
                  </button>
                  <button
                    onClick={() => setCatalogStockFilter('in_stock')}
                    style={{
                      background: catalogStockFilter === 'in_stock' ? '#10b981' : 'transparent',
                      color: catalogStockFilter === 'in_stock' ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    In Stock ({inStockCount})
                  </button>
                  <button
                    onClick={() => setCatalogStockFilter('out_of_stock')}
                    style={{
                      background: catalogStockFilter === 'out_of_stock' ? '#ef4444' : 'transparent',
                      color: catalogStockFilter === 'out_of_stock' ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Out of Stock ({outOfStockCount})
                  </button>
                </div>
              </div>

              {/* Category Pills */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                {CATEGORY_CHIPS.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCatalogCategory(cat)}
                    style={{
                      background: catalogCategory === cat ? 'rgba(13, 148, 136, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: catalogCategory === cat ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: catalogCategory === cat ? 'var(--primary)' : '#94a3b8',
                      borderRadius: '99px',
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Medicines Catalog Grid / Table */}
          {isCatalogLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <span>🔄 Loading complete medicine database...</span>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>🔍</span>
              <p style={{ color: '#fff', fontWeight: 'bold' }}>No medicines matched your search filter</p>
              <p style={{ fontSize: '0.82rem' }}>Try clearing filters or search terms.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto', paddingRight: '6px' }}>
              {filteredCatalog.map(med => {
                const isModified = !!inventoryEdits[med.medicine_id];
                return (
                  <div
                    key={med.medicine_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: med.in_stock ? 'rgba(16, 185, 129, 0.04)' : 'rgba(0,0,0,0.2)',
                      border: isModified ? '1px solid #f59e0b' : med.in_stock ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '14px',
                      padding: '1rem 1.25rem',
                      transition: 'all 0.2s ease',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    {/* Left: Checkbox Toggle + Medicine Details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '300px' }}>
                      {/* Checkbox Toggle Switch */}
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={med.in_stock}
                          onChange={() => handleToggleStock(med.medicine_id)}
                          style={{ display: 'none' }}
                        />
                        <div style={{
                          width: '46px',
                          height: '24px',
                          borderRadius: '99px',
                          background: med.in_stock ? '#10b981' : '#334155',
                          position: 'relative',
                          transition: 'background 0.25s ease',
                          boxShadow: med.in_stock ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none'
                        }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            position: 'absolute',
                            top: '3px',
                            left: med.in_stock ? '25px' : '3px',
                            transition: 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                          }} />
                        </div>
                      </label>

                      {/* Medicine Info */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '1.02rem', color: '#ffffff' }}>
                            {med.brand_name}
                          </strong>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'rgba(255,255,255,0.08)',
                            color: '#94a3b8'
                          }}>
                            {med.form || 'Tablet'} • {med.dosage || 'Standard'}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'rgba(13, 148, 136, 0.15)',
                            color: 'var(--primary)'
                          }}>
                            {med.category || 'General'}
                          </span>
                          {isModified && (
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.2)',
                              color: '#f59e0b',
                              fontWeight: 'bold'
                            }}>
                              Unsaved Edit
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          🧪 <em>Active Formulation:</em> <strong style={{ color: '#cbd5e1' }}>{med.generic_name}</strong> • Mfg: {med.manufacturer}
                        </div>
                      </div>
                    </div>

                    {/* Right: Price & Quantity Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#ffffff' }}>
                          ₹{med.price_mrp || '50.00'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MRP</div>
                      </div>

                      {/* Units Stepper (Active when in-stock) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <button
                          onClick={() => handleQuantityChange(med.medicine_id, (med.quantity || 0) - 10)}
                          disabled={!med.in_stock || med.quantity <= 0}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: med.in_stock ? '#ffffff' : '#64748b',
                            width: '24px',
                            height: '24px',
                            cursor: med.in_stock ? 'pointer' : 'default',
                            fontWeight: 'bold',
                            fontSize: '1rem'
                          }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={med.quantity || 0}
                          onChange={e => handleQuantityChange(med.medicine_id, e.target.value)}
                          disabled={!med.in_stock}
                          style={{
                            width: '48px',
                            background: 'transparent',
                            border: 'none',
                            color: med.in_stock ? '#34d399' : '#64748b',
                            textAlign: 'center',
                            fontSize: '0.88rem',
                            fontWeight: 'bold'
                          }}
                        />
                        <button
                          onClick={() => handleQuantityChange(med.medicine_id, (med.quantity || 0) + 10)}
                          disabled={!med.in_stock}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: med.in_stock ? '#ffffff' : '#64748b',
                            width: '24px',
                            height: '24px',
                            cursor: med.in_stock ? 'pointer' : 'default',
                            fontWeight: 'bold',
                            fontSize: '1rem'
                          }}
                        >
                          +
                        </button>
                      </div>

                      {/* Status Badge */}
                      <span style={{
                        padding: '5px 12px',
                        borderRadius: '99px',
                        fontSize: '0.74rem',
                        fontWeight: '800',
                        minWidth: '105px',
                        textAlign: 'center',
                        background: med.in_stock ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: med.in_stock ? '#34d399' : '#f87171',
                        border: med.in_stock ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)'
                      }}>
                        {med.in_stock ? `✓ IN STOCK (${med.quantity})` : '✗ OUT OF STOCK'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sticky Bottom Apply & Save Button */}
          <div style={{
            position: 'sticky',
            bottom: '10px',
            marginTop: '1.5rem',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(13, 148, 136, 0.4)',
            borderRadius: '16px',
            padding: '1rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 12px 35px rgba(0,0,0,0.5)',
            zIndex: 100
          }}>
            <div>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>
                {pendingEditsCount > 0 ? `⚡ ${pendingEditsCount} medicine stock changes ready to commit` : '✓ All stock status synchronized with database'}
              </strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Applying changes immediately updates customer search results, multi-composition fallback suggestions, and 15-minute quick delivery routes.
              </div>
            </div>

            <button
              onClick={handleApplyInventoryChanges}
              disabled={isSavingInventory || pendingEditsCount === 0}
              className="btn-primary"
              style={{
                padding: '0.75rem 2rem',
                fontSize: '0.95rem',
                fontWeight: '800',
                opacity: pendingEditsCount === 0 ? 0.6 : 1,
                cursor: pendingEditsCount === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {isSavingInventory ? 'Applying to Database...' : `Apply & Save Stock Changes (${pendingEditsCount})`}
            </button>
          </div>
        </section>
      )}

      {/* ─── TAB 3: CHEMICAL COMPOUNDS ONBOARDING QUIZ ─── */}
      {activeTab === 'quiz' && (
        <section className="glass-panel" style={{ padding: '2rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.45rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span>🧪</span> Essential Chemical Compounds Stock Quiz
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                Indicate which generic active compounds (APIs) your pharmacy stores. We list <strong>chemical compound molecules</strong> (e.g. Paracetamol, Amoxicillin)—not commercial brand names—to guarantee customer search equivalence.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => handleSelectAllCompounds(true)}
                style={{
                  background: 'rgba(184, 247, 228, 0.1)',
                  color: 'var(--primary)',
                  border: '1px solid rgba(184, 247, 228, 0.25)',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ✓ Select All (Stocked)
              </button>
              <button
                onClick={() => handleSelectAllCompounds(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            </div>
          </div>

          {quizSuccessNotice && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid #10b981',
              color: '#34d399',
              borderRadius: '12px',
              padding: '0.85rem 1.25rem',
              marginBottom: '1.5rem',
              fontWeight: 'bold'
            }}>
              {quizSuccessNotice}
            </div>
          )}

          {/* Grid of Essential Compounds */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.25rem',
            maxHeight: '620px',
            overflowY: 'auto',
            paddingRight: '6px',
            marginBottom: '1.5rem'
          }}>
            {compoundsList.map(comp => {
              const isSelected = !!compoundSelections[comp.compound_name];
              return (
                <div
                  key={comp.compound_name}
                  onClick={() => handleToggleCompound(comp.compound_name)}
                  style={{
                    background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: isSelected ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isSelected ? '0 6px 20px rgba(16, 185, 129, 0.15)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '1.05rem', color: isSelected ? '#fff' : '#cbd5e1' }}>
                        {comp.compound_name}
                      </strong>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '99px',
                        fontSize: '0.74rem',
                        fontWeight: '800',
                        background: isSelected ? '#10b981' : 'rgba(255,255,255,0.1)',
                        color: isSelected ? '#fff' : '#94a3b8'
                      }}>
                        {isSelected ? 'YES (In Stock)' : 'NO'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '6px' }}>
                      🏷️ {comp.category} • <span style={{ color: 'var(--text-muted)' }}>{comp.standard_strength}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>
                      💡 Clinical Indication: {comp.indications || comp.common_indication}
                    </div>
                  </div>

                  <div style={{
                    fontSize: '0.74rem',
                    color: '#94a3b8',
                    background: 'rgba(0,0,0,0.25)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    📦 Common Brand Equivalents: <span style={{ color: '#e2e8f0' }}>{comp.brand_examples || comp.common_brands_info}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>
              {Object.values(compoundSelections).filter(Boolean).length} of {compoundsList.length} Compounds Currently Marked in Stock
            </div>
            <button
              onClick={handleSaveCompoundQuiz}
              disabled={isSavingQuiz}
              className="btn-primary"
              style={{ padding: '0.75rem 2rem', fontWeight: 'bold', fontSize: '0.95rem' }}
            >
              {isSavingQuiz ? 'Saving...' : '💾 Save Compounds Inventory'}
            </button>
          </div>
        </section>
      )}

      {/* ─── TAB 4: OCR STOCK SCANNER (BATCH GEMINI VISION & SINGLE) ─── */}
      {activeTab === 'scanner' && (
        <section className="glass-panel" style={{ padding: '2rem', borderRadius: '20px', maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.5rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
              <span>📸</span> Batch Strip OCR & Gemini Vision Stock Ingestion
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '6px 0 0 0' }}>
              Upload multiple medicine packaging or blister strip photos at once. Google Gemini AI vision analyzes every strip, extracts active generic molecules, expiries, batch numbers, and syncs your store catalog in 1 click.
            </p>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              onClick={() => setScannerMode('batch')}
              style={{
                background: scannerMode === 'batch' ? 'linear-gradient(135deg, #0d9488, #059669)' : 'rgba(255,255,255,0.06)',
                color: scannerMode === 'batch' ? '#fff' : '#94a3b8',
                border: scannerMode === 'batch' ? '1px solid #14b8a6' : '1px solid rgba(255,255,255,0.1)',
                padding: '8px 20px',
                borderRadius: '99px',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <span>✨</span>
              <span>Batch Strip Photos (Google Gemini Vision)</span>
            </button>

            <button
              onClick={() => setScannerMode('single')}
              style={{
                background: scannerMode === 'single' ? 'linear-gradient(135deg, #0d9488, #059669)' : 'rgba(255,255,255,0.06)',
                color: scannerMode === 'single' ? '#fff' : '#94a3b8',
                border: scannerMode === 'single' ? '1px solid #14b8a6' : '1px solid rgba(255,255,255,0.1)',
                padding: '8px 20px',
                borderRadius: '99px',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <span>🔍</span>
              <span>Single Strip Scan</span>
            </button>
          </div>

          {/* Notice Banner */}
          {batchNotice && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399',
              padding: '12px 18px',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🎉</span>
                <span>{batchNotice}</span>
              </div>
              <button
                onClick={() => setBatchNotice(null)}
                style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* ─── BATCH MODE ─── */}
          {scannerMode === 'batch' && (
            <div>
              {/* Batch Upload Dropzone */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '2px dashed rgba(20, 184, 166, 0.4)',
                borderRadius: '16px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                marginBottom: '1.5rem',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleBatchFileSelect}
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                    zIndex: 10
                  }}
                />
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>📸</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>
                  Click to Browse or Drag & Drop Multiple Strip Photos
                </h3>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  Select 1, 5, 10 or more blister packs / medicine box photos at the same time (JPG, PNG, WebP)
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <span style={{
                    display: 'inline-block',
                    background: 'rgba(20, 184, 166, 0.15)',
                    color: '#2dd4bf',
                    border: '1px solid rgba(20, 184, 166, 0.3)',
                    padding: '6px 16px',
                    borderRadius: '99px',
                    fontSize: '0.82rem',
                    fontWeight: 'bold'
                  }}>
                    {batchFiles.length > 0 ? `📁 ${batchFiles.length} Strip Photos Staged` : '📂 Select Medicine Strip Photos'}
                  </span>
                </div>
              </div>

              {/* Selected Photo Thumbnails Carousel */}
              {batchPreviews.length > 0 && (
                <div style={{ marginBottom: '1.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#e2e8f0' }}>
                      Staged Strip Photos ({batchPreviews.length}):
                    </span>
                    <button
                      onClick={handleClearBatch}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Clear Selection
                    </button>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    overflowX: 'auto',
                    paddingBottom: '8px'
                  }}>
                    {batchPreviews.map((prev, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          flexShrink: 0,
                          width: '110px',
                          height: '90px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: '#000'
                        }}
                      >
                        <img
                          src={prev.url}
                          alt={prev.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          fontSize: '0.65rem',
                          padding: '2px 4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {prev.name}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Extract with Gemini Action Button */}
                  <div style={{ marginTop: '1.25rem' }}>
                    <button
                      onClick={handleProcessBatchGemini}
                      disabled={isExtractingBatch}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '0.95rem',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        background: isExtractingBatch ? 'rgba(13, 148, 136, 0.5)' : 'linear-gradient(135deg, #0d9488, #059669)',
                        boxShadow: '0 4px 18px rgba(13, 148, 136, 0.4)'
                      }}
                    >
                      {isExtractingBatch ? (
                        <span>⏳ Analyzing {batchFiles.length} Strip Photos with Google Gemini Vision...</span>
                      ) : (
                        <span>🤖 Extract All {batchFiles.length} Strips with Google Gemini Vision</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Extracted Batch Items Review Cards */}
              {extractedBatch.length > 0 && (
                <div style={{ marginTop: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>✨</span>
                        <span>Gemini AI Extracted Medicines ({extractedBatch.length})</span>
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                        Review and adjust medicine details before committing to your store database.
                      </p>
                    </div>

                    <button
                      onClick={handleCommitBatchInventory}
                      disabled={isCommittingBatch}
                      className="btn-primary"
                      style={{
                        padding: '0.75rem 1.75rem',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #10b981, #059669)'
                      }}
                    >
                      {isCommittingBatch ? 'Committing...' : `⚡ Add All ${extractedBatch.length} to Inventory`}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {extractedBatch.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        style={{
                          background: 'rgba(15, 23, 42, 0.75)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '14px',
                          padding: '1.25rem',
                          display: 'grid',
                          gridTemplateColumns: '120px 1fr auto',
                          gap: '1.25rem',
                          alignItems: 'center'
                        }}
                      >
                        {/* Strip Thumbnail */}
                        <div style={{ width: '120px', height: '90px', borderRadius: '10px', overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.15)' }}>
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt={item.medicine_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '1.8rem' }}>💊</div>
                          )}
                        </div>

                        {/* Editable Medicine Fields */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}>
                              Brand Name:
                            </label>
                            <input
                              type="text"
                              value={item.medicine_name}
                              onChange={e => handleUpdateBatchItem(item.id, 'medicine_name', e.target.value)}
                              style={{ width: '100%', background: '#0a0b0d', border: '1px solid #334155', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}>
                              Active Generic Composition:
                            </label>
                            <input
                              type="text"
                              value={item.generic_name}
                              onChange={e => handleUpdateBatchItem(item.id, 'generic_name', e.target.value)}
                              style={{ width: '100%', background: '#0a0b0d', border: '1px solid #334155', color: '#38bdf8', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}>
                              Batch Expiry Date:
                            </label>
                            <input
                              type="text"
                              value={item.expiry_date}
                              onChange={e => handleUpdateBatchItem(item.id, 'expiry_date', e.target.value)}
                              style={{ width: '100%', background: '#0a0b0d', border: '1px solid #334155', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}>
                                Stock Units:
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={e => handleUpdateBatchItem(item.id, 'quantity', parseInt(e.target.value, 10) || 0)}
                                style={{ width: '100%', background: '#0a0b0d', border: '1px solid #334155', color: '#4ade80', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}>
                                MRP (₹):
                              </label>
                              <input
                                type="text"
                                value={item.price_mrp}
                                onChange={e => handleUpdateBatchItem(item.id, 'price_mrp', e.target.value)}
                                style={{ width: '100%', background: '#0a0b0d', border: '1px solid #334155', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Action Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          <span style={{
                            background: 'rgba(20, 184, 166, 0.15)',
                            color: '#2dd4bf',
                            border: '1px solid rgba(20, 184, 166, 0.3)',
                            padding: '3px 8px',
                            borderRadius: '99px',
                            fontSize: '0.68rem',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.engine || '✨ Gemini Vision'}
                          </span>

                          <button
                            onClick={() => handleRemoveBatchItem(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#f87171',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              padding: '4px 8px'
                            }}
                            title="Remove strip from batch"
                          >
                            🗑️ Discard
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Commit Action Bar */}
                  <div style={{
                    marginTop: '1.5rem',
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(20, 184, 166, 0.3)',
                    borderRadius: '14px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div>
                      <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>
                        Ready to Commit {extractedBatch.length} Extracted Medicines
                      </span>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                        All medicines will be added with their generic compositions and stock units into your live store.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        onClick={handleClearBatch}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#94a3b8',
                          padding: '0.75rem 1.25rem',
                          borderRadius: '8px',
                          fontSize: '0.88rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel Batch
                      </button>
                      <button
                        onClick={handleCommitBatchInventory}
                        disabled={isCommittingBatch}
                        className="btn-primary"
                        style={{
                          padding: '0.75rem 2rem',
                          fontSize: '0.92rem',
                          fontWeight: 'bold',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)'
                        }}
                      >
                        {isCommittingBatch ? 'Adding to Store...' : `⚡ Commit All ${extractedBatch.length} to Inventory`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── SINGLE MODE ─── */}
          {scannerMode === 'single' && (
            <div>
              <form onSubmit={handleFileUpload} style={{ marginBottom: '1.5rem' }}>
                <input type="file" accept="image/*" className="input-field" style={{ marginBottom: '0.85rem' }} />
                <button type="submit" disabled={isExtracting} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '0.92rem' }}>
                  {isExtracting ? 'Extracting Text via OCR...' : '🔍 Scan Single Strip Photo'}
                </button>
              </form>

              {ocrImage && (
                <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                  <img src={ocrImage} alt="Scanned strip" style={{ maxHeight: '180px', borderRadius: '14px', border: '1px solid var(--border-color)' }} />
                </div>
              )}

              {ocrResult && (
                <form onSubmit={handleSyncToInventory} style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--primary)' }}>Verify & Add Single Medicine to Inventory:</h3>
                  
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Medicine Brand Name:</label>
                    <input type="text" className="input-field" value={medicineName} onChange={e => setMedicineName(e.target.value)} style={{ padding: '0.6rem 0.85rem', width: '100%' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Generic Chemical Formula:</label>
                    <input type="text" className="input-field" value={genericName} onChange={e => setGenericName(e.target.value)} style={{ padding: '0.6rem 0.85rem', width: '100%' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Batch Expiry Date:</label>
                      <input type="text" className="input-field" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={{ padding: '0.6rem 0.85rem', width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Quantity to Add:</label>
                      <input type="number" className="input-field" value={quantityToAdd} onChange={e => setQuantityToAdd(e.target.value)} style={{ padding: '0.6rem 0.85rem', width: '100%' }} />
                    </div>
                  </div>

                  <button type="submit" className="btn-primary" style={{ justifyContent: 'center', padding: '0.85rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                    ➕ Confirm & Sync Single Medicine
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      {/* ─── TAB 5: PATIENT MISSING MEDICINE INQUIRIES ─── */}
      {activeTab === 'inquiries' && (
        <section className="glass-panel" style={{ padding: '2rem', borderRadius: '20px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.45rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>🔔</span> Patient Missing Medicine Inquiries
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
              When patients search for medicines unavailable across the local pharmacy network, real-time alerts appear here. If your physical shop holds stock, fulfill it with 1 click!
            </p>
          </div>

          {missingFeed.ignored_requests.length === 0 && (!missingFeed.urgent_alerts || missingFeed.urgent_alerts.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.8rem' }}>✨</span>
              <p style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>No pending patient inquiries</p>
              <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                All medicine queries searched by patients currently have active local pharmacy stock!
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {[...(missingFeed.urgent_alerts || []), ...(missingFeed.ignored_requests || [])].map(req => (
                <div
                  key={req.id}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>{req.medicine_name}</strong>
                      <span style={{
                        fontSize: '0.7rem',
                        color: req.pharmacy_status === 'ignored' ? '#f59e0b' : '#ef4444',
                        background: req.pharmacy_status === 'ignored' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: 'bold'
                      }}>
                        {req.pharmacy_status === 'ignored' ? 'Saved for Later' : 'Urgent Demand'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px' }}>
                      🧪 Compound: <strong>{req.compound_name}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Searched {req.search_count || 1} time(s) by nearby patients in the last 2 hours.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button
                      onClick={() => setAcceptingReq(req)}
                      className="btn-primary"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        padding: '0.6rem 0.85rem',
                        fontSize: '0.82rem',
                        fontWeight: 'bold'
                      }}
                    >
                      ✅ Fulfill & Add Stock
                    </button>
                    <button
                      onClick={() => handleRespondMissing(req.id, 'dismiss')}
                      style={{
                        background: 'transparent',
                        color: '#94a3b8',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      ✕ Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── TAB 6: LIVE UPI MACHINE & POS TERMINAL SCANNER ─── */}
      {activeTab === 'terminal' && (
        <section className="glass-panel" style={{ padding: '2rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📷</span>
                <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: 0, fontWeight: '800' }}>
                  Live UPI POS Machine & Soundbox Screen Scanner
                </h2>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                Capture live photo of your physical UPI Soundbox / POS device screen and broadcast it instantly to customers during checkout. If camera is inactive or customer faces glare, MEDORA seamlessly serves your verified KYC Shop QR code.
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '99px',
              background: liveTerminalInfo?.has_live_scanner_qr ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.12)',
              border: liveTerminalInfo?.has_live_scanner_qr ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.25)',
              color: liveTerminalInfo?.has_live_scanner_qr ? '#34d399' : '#94a3b8',
              fontWeight: '700',
              fontSize: '0.82rem'
            }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: liveTerminalInfo?.has_live_scanner_qr ? '#10b981' : '#94a3b8',
                boxShadow: liveTerminalInfo?.has_live_scanner_qr ? '0 0 10px #10b981' : 'none'
              }} />
              <span>{liveTerminalInfo?.has_live_scanner_qr ? '🟢 LIVE BROADCAST ACTIVE' : '🏪 STANDBY (SERVING SHOP KYC QR)'}</span>
            </div>
          </div>

          {/* Alert / Notice */}
          {scannerNotice && (
            <div style={{
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#a7f3d0',
              fontSize: '0.88rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>{scannerNotice}</span>
              <button
                onClick={() => setScannerNotice(null)}
                style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>
          )}

          {cameraError && (
            <div style={{
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              fontSize: '0.85rem',
              marginBottom: '1.5rem'
            }}>
              ⚠️ {cameraError} (You can still snap or select a photo using the file picker below)
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(320px, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* LEFT COLUMN: LIVE VIEWFINDER & CAPTURE */}
            <div style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '1.5rem'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📹</span> Live Camera Viewfinder
              </h3>

              {/* Viewfinder Window */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '320px',
                background: '#090d16',
                borderRadius: '14px',
                overflow: 'hidden',
                border: isCameraActive ? '2px solid #10b981' : '1px dashed rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem'
              }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: isCameraActive ? 'block' : 'none'
                  }}
                />

                {!isCameraActive && (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📷</div>
                    <div style={{ fontWeight: '700', color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>Camera Inactive</div>
                    <p style={{ fontSize: '0.8rem', margin: '0 0 1rem 0', color: '#64748b' }}>
                      Click Start Camera below to capture your POS machine or soundbox screen
                    </p>
                    <button
                      onClick={() => startCamera()}
                      style={{
                        background: 'linear-gradient(135deg, #0d9488, #059669)',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(13, 148, 136, 0.4)'
                      }}
                    >
                      ▶️ Start Live Camera
                    </button>
                  </div>
                )}

                {/* HUD Overlay Reticle when camera is active */}
                {isCameraActive && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '190px',
                    height: '190px',
                    border: '2px dashed rgba(16, 185, 129, 0.8)',
                    borderRadius: '16px',
                    pointerEvents: 'none',
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: '6px'
                  }}>
                    <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: '800', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px' }}>
                      ALIGN MACHINE SCREEN HERE
                    </span>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                {isCameraActive ? (
                  <>
                    <button
                      onClick={captureSnapshot}
                      style={{
                        flex: 2,
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '12px 18px',
                        borderRadius: '10px',
                        fontWeight: '800',
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      <span>📸</span> Snap Machine Screen
                    </button>
                    <button
                      onClick={toggleCameraFacing}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.08)',
                        color: '#cbd5e1',
                        border: '1px solid rgba(255,255,255,0.15)',
                        padding: '12px',
                        borderRadius: '10px',
                        fontWeight: '700',
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      🔄 Flip Lens
                    </button>
                    <button
                      onClick={stopCamera}
                      style={{
                        background: 'rgba(239,68,68,0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.3)',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        fontWeight: '700',
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      ⏹️ Stop
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startCamera()}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #0d9488, #059669)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      fontWeight: '800',
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>▶️</span> Activate Scanner Camera
                  </button>
                )}
              </div>

              {/* File Upload Fallback */}
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Device camera not supported or permissions blocked?
                </span>
                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}>
                  <span>📁</span> Select / Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handleManualPhotoSelect}
                  />
                </label>
              </div>
            </div>

            {/* RIGHT COLUMN: BROADCAST STAGING & CUSTOMER PREVIEW */}
            <div style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '1.5rem'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🛰️</span> Checkout Broadcast Control
              </h3>

              {/* Staging Snapshot Preview */}
              <div style={{
                background: '#090d16',
                borderRadius: '12px',
                padding: '1rem',
                border: '1px solid rgba(255,255,255,0.08)',
                marginBottom: '1.25rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                  {capturedMachinePhoto ? '✨ Staged Snapshot (Ready to Broadcast)' : 'Active Customer View'}
                </div>

                {capturedMachinePhoto ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={capturedMachinePhoto}
                      alt="Captured POS Machine"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '200px',
                        borderRadius: '10px',
                        border: '2px solid #10b981',
                        objectFit: 'contain'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      background: 'rgba(0,0,0,0.75)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      color: '#34d399',
                      fontWeight: '800'
                    }}>
                      🟢 Fresh Capture
                    </div>
                  </div>
                ) : liveTerminalInfo?.live_upi_qr ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={liveTerminalInfo.live_upi_qr}
                      alt="Active Live POS QR"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '200px',
                        borderRadius: '10px',
                        border: '2px solid #10b981',
                        objectFit: 'contain'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      background: 'rgba(0,0,0,0.75)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      color: '#34d399',
                      fontWeight: '800'
                    }}>
                      🟢 Currently Broadcasting
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '2rem 1rem', color: '#64748b' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>🏪</div>
                    <div style={{ fontWeight: '700', color: '#cbd5e1', fontSize: '0.9rem' }}>Permanent KYC QR is Currently Serving</div>
                    <p style={{ fontSize: '0.78rem', margin: '4px 0 0 0' }}>
                      Snap or select a machine photo above to activate live screen streaming for customers.
                    </p>
                  </div>
                )}
              </div>

              {/* Terminal Label Input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '700' }}>
                  Terminal / Device Label:
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={terminalLabel}
                  onChange={e => setTerminalLabel(e.target.value)}
                  placeholder="e.g. Counter UPI Soundbox / PhonePe SmartPOS"
                  style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                />
              </div>

              {/* Broadcast Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <button
                  onClick={broadcastLiveQr}
                  disabled={!capturedMachinePhoto || isBroadcasting}
                  style={{
                    background: capturedMachinePhoto ? 'linear-gradient(135deg, #0d9488, #059669)' : 'rgba(255,255,255,0.06)',
                    color: capturedMachinePhoto ? '#ffffff' : '#64748b',
                    border: 'none',
                    padding: '13px',
                    borderRadius: '12px',
                    fontWeight: '800',
                    fontSize: '0.92rem',
                    cursor: capturedMachinePhoto && !isBroadcasting ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: capturedMachinePhoto ? '0 4px 18px rgba(13, 148, 136, 0.4)' : 'none'
                  }}
                >
                  <span>🚀</span>
                  <span>{isBroadcasting ? 'Broadcasting to Checkout...' : 'Broadcast Snapshot to Customer Checkout'}</span>
                </button>

                {liveTerminalInfo?.has_live_scanner_qr && (
                  <button
                    onClick={resetToPermanentQr}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      padding: '10px',
                      borderRadius: '10px',
                      fontWeight: '700',
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 End Live Stream (Revert to Store Official QR)
                  </button>
                )}
              </div>

              {/* Permanent Store QR Info Card */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  background: '#ffffff',
                  borderRadius: '8px',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {liveTerminalInfo?.shop_upi_qr ? (
                    <img
                      src={liveTerminalInfo.shop_upi_qr}
                      alt="Shop Permanent QR"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: '1.75rem' }}>🏪</span>
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#fff' }}>
                    Permanent KYC Shop QR
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {liveTerminalInfo?.shop_upi_id || 'vamanjoor.pharmacy@upi'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                    Stored in KYC registry • Served automatically as robust fallback
                  </div>
                </div>
              </div>

              {/* Permanent Store UPI & QR Configuration Panel */}
              <div style={{
                marginTop: '1.25rem',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '6px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚙️</span> Store Permanent UPI & Soundbox Settings
                  </h4>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(13, 148, 136, 0.15)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                    Customer Sync Active
                  </span>
                </div>

                {upiSettingsNotice && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.78rem', color: '#34d399', marginBottom: '1rem', fontWeight: '600' }}>
                    {upiSettingsNotice}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>
                      Store Merchant UPI VPA / ID:
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={customUpiId}
                      onChange={e => setCustomUpiId(e.target.value)}
                      placeholder="e.g. vamanjoor.express@okaxis or 9876543210@paytm"
                      style={{ width: '100%', padding: '0.65rem 0.85rem', fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>
                      Counter POS / Soundbox Label:
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={terminalLabel}
                      onChange={e => setTerminalLabel(e.target.value)}
                      placeholder="e.g. Counter UPI Soundbox #1"
                      style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '4px', fontWeight: '700' }}>
                      Permanent Store QR Sticker (Optional Custom File):
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        color: '#cbd5e1',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}>
                        <span>📁</span> Upload Official Sticker
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handlePermanentQrUpload}
                        />
                      </label>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {customUpiQr ? 'Custom image loaded' : 'Auto-generates NPCI standard QR if empty'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={savePermanentUpiSettings}
                    disabled={isSavingUpiSettings}
                    style={{
                      background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      fontWeight: '800',
                      fontSize: '0.85rem',
                      cursor: isSavingUpiSettings ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: '4px',
                      boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)'
                    }}
                  >
                    <span>💾</span>
                    <span>{isSavingUpiSettings ? 'Saving & Syncing...' : 'Save & Sync Store UPI'}</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </section>
      )}

      {/* 🚨 Urgent Real-Time Missing Medicine Popup Modal */}
      {currentUrgentAlert && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          maxWidth: '440px',
          width: 'calc(100vw - 48px)',
          background: 'linear-gradient(135deg, rgba(26, 17, 34, 0.98), rgba(15, 23, 42, 0.98))',
          backdropFilter: 'blur(20px)',
          border: '2px solid #ef4444',
          borderRadius: '18px',
          padding: '1.5rem',
          boxShadow: '0 20px 50px rgba(239, 68, 68, 0.35), 0 0 30px rgba(0,0,0,0.8)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>🚨</span>
              <strong style={{ fontSize: '1rem', color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Urgent Medicine Inquiry!
              </strong>
            </div>
            <span style={{
              fontSize: '0.7rem',
              padding: '3px 8px',
              borderRadius: '99px',
              background: 'rgba(239,68,68,0.2)',
              color: '#fca5a5',
              fontWeight: 'bold',
              border: '1px solid rgba(239,68,68,0.4)'
            }}>
              Zero Area Stock
            </span>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '0.85rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
              {currentUrgentAlert.medicine_name}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginBottom: '4px' }}>
              🧪 Active Compound: <strong>{currentUrgentAlert.compound_name}</strong>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4', margin: '0 0 1.2rem 0' }}>
            A patient nearby needs this medicine immediately, but no pharmacy currently has it stocked. Do you have this in your physical store?
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                setAcceptingReq(currentUrgentAlert);
                setCurrentUrgentAlert(null);
              }}
              style={{
                flex: 1.5,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                fontSize: '0.88rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>✅</span> Yes, We Have This!
            </button>
            <button
              onClick={() => handleRespondMissing(currentUrgentAlert.id, 'ignore')}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.07)',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                padding: '0.75rem 0.8rem',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {/* 📦 Quick Stock Confirmation Dialog */}
      {acceptingReq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#16181f',
            border: '1px solid rgba(184, 247, 228, 0.3)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '460px',
            padding: '1.75rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💊</span> Add Medicine to Pharmacy Stock
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Confirm your available quantity and unit price to fulfill patient inquiries immediately.
            </p>

            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '4px' }}>
                {acceptingReq.medicine_name}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                🧪 Active Compound: <strong>{acceptingReq.compound_name}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Available Units / Strips:
                </label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={acceptQty}
                  onChange={e => setAcceptQty(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Unit Price (₹):
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={acceptPrice}
                  onChange={e => setAcceptPrice(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setAcceptingReq(null)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text-muted)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRespondMissing(acceptingReq.id, 'in_stock', acceptQty, acceptPrice)}
                className="btn-primary"
                style={{
                  flex: 2,
                  justifyContent: 'center',
                  padding: '0.75rem',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}
              >
                ✅ Confirm & Add Stock
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
