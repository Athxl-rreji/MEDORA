"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import LivePerimeterRadar from '../../components/LivePerimeterRadar';
import { API } from '../../utils/apiConfig';

export default function RadarPage() {
  const [mounted, setMounted] = useState(false);
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

  const [perimeterKm, setPerimeterKm] = useState(3.5);
  const [filterInsideOnly, setFilterInsideOnly] = useState(false);
  const [liveGpsCoords, setLiveGpsCoords] = useState({ lat: 19.0760, lng: 72.8777, accuracy: null });
  const [pharmacyNetwork, setPharmacyNetwork] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('medora_selected_address');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.houseNo) setSelectedAddress(parsed);
      }
      const savedPerimeter = localStorage.getItem('medora_perimeter_km');
      if (savedPerimeter) setPerimeterKm(parseFloat(savedPerimeter));
    } catch (e) {}
  }, []);

  // Fetch pharmacy network relative to coordinates and perimeter
  useEffect(() => {
    const fetchNetwork = async () => {
      setIsLoading(true);
      try {
        const lat = selectedAddress?.latitude || 19.0760;
        const lng = selectedAddress?.longitude || 72.8777;
        const res = await fetch(`${API}/api/v1/medicines/instamart/pharmacy-network?lat=${lat}&lng=${lng}&perimeter_km=${perimeterKm}`);
        if (res.ok) {
          const data = await res.json();
          setPharmacyNetwork(data.pharmacies || []);
        }
      } catch (e) {
        console.error("Network fetch failed:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNetwork();
  }, [selectedAddress, perimeterKm]);

  const handleUpdateAddress = (addr) => {
    setSelectedAddress(addr);
    try {
      localStorage.setItem('medora_selected_address', JSON.stringify(addr));
    } catch (e) {}
  };

  const handleChangePerimeter = (km) => {
    setPerimeterKm(km);
    try {
      localStorage.setItem('medora_perimeter_km', km.toString());
    } catch (e) {}
  };

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-body)',
      backgroundImage: 'radial-gradient(circle at 10% 15%, rgba(184, 247, 228, 0.4) 0%, transparent 45%), radial-gradient(circle at 90% 85%, rgba(204, 251, 241, 0.5) 0%, transparent 50%)',
      padding: '2rem 1.5rem',
      color: '#0f172a'
    }}>
      {/* Top Navbar */}
      <nav style={{
        maxWidth: '1100px',
        margin: '0 auto 2rem auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.8rem 1.5rem',
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(16px)',
        borderRadius: '18px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem' }}>🧬</span>
          <span style={{ fontWeight: '900', fontSize: '1.25rem', color: '#0d9488', fontFamily: 'Outfit, sans-serif' }}>
            MEDORA
          </span>
          <span style={{ color: '#94a3b8', margin: '0 4px' }}>|</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>
            Delivery Radar Control
          </span>
        </Link>

        <Link
          href="/"
          style={{
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
            color: '#ffffff',
            padding: '8px 18px',
            borderRadius: '99px',
            fontSize: '0.85rem',
            fontWeight: '800',
            boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>←</span> Back to Pharmacy Home
        </Link>
      </nav>

      {/* Main Container */}
      <main style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <LivePerimeterRadar
          userCoords={liveGpsCoords}
          onUpdateCoords={(coords) => setLiveGpsCoords(coords)}
          selectedAddress={selectedAddress}
          onUpdateAddress={handleUpdateAddress}
          pharmacies={pharmacyNetwork}
          perimeterKm={perimeterKm}
          onChangePerimeter={handleChangePerimeter}
          filterInsideOnly={filterInsideOnly}
          onToggleFilterInsideOnly={(val) => setFilterInsideOnly(val)}
          isStandalonePage={true}
        />
      </main>
    </div>
  );
}
