import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Connect to live cloud backend (accessible from anywhere, anytime)
const API = 'https://backend-three-kappa-38.vercel.app';
const AGENT_ID = "AGT-591";

export default function App() {
  const [readyOrders, setReadyOrders] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [backendStatus, setBackendStatus] = useState('checking');

  // Poll for 'ready' orders (pharmacy packed, waiting for rider)
  useEffect(() => {
    if (!isOnline) return;
    const poll = async () => {
      if (activeJob) return;
      try {
        const res = await fetch(`${API}/api/v1/orders/active?status=ready`);
        if (res.ok) {
          setBackendStatus('online');
          const data = await res.json();
          setReadyOrders(data.orders || []);
        } else {
          setBackendStatus('offline');
        }
      } catch (e) {
        setBackendStatus('offline');
      }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [isOnline, activeJob]);

  const formatItems = (items) => {
    if (Array.isArray(items)) return items.map(i => `${i.quantity}x ${i.brand_name}`).join(', ');
    return String(items || 'Items');
  };

  // Accept pickup -> out_for_delivery
  const handleAccept = async (order) => {
    try {
      await fetch(`${API}/api/v1/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'out_for_delivery' })
      });
    } catch (e) {}
    setActiveJob({ ...order, status: 'out_for_delivery' });
    setReadyOrders(prev => prev.filter(o => o.id !== order.id));
  };

  // Confirm delivery -> delivered
  const handleDeliver = async () => {
    if (!activeJob) return;
    try {
      await fetch(`${API}/api/v1/orders/${activeJob.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' })
      });
    } catch (e) {}
    setCompletedCount(c => c + 1);
    setEarnings(e => e + 45);
    Alert.alert('✅ Delivered!', 'Payout ₹45 credited.');
    setActiveJob(null);
  };

  // ── ACTIVE DELIVERY SCREEN ──
  if (activeJob) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        <View style={s.header}>
          <Text style={s.headerTitle}>⚡ ACTIVE DELIVERY</Text>
          <Text style={s.headerSub}>{AGENT_ID} • En Route</Text>
        </View>

        <View style={s.mapArea}>
          <Text style={{ fontSize: 50 }}>🗺️</Text>
          <Text style={s.mapTitle}>Live Routing Active</Text>
          <Text style={s.mapSub}>Delivering to Customer {activeJob.user}</Text>
          <View style={s.etaBadge}>
            <Text style={s.etaText}>ETA: ~8 mins</Text>
          </View>
        </View>

        <View style={s.detailsArea}>
          <InfoRow label="ORDER" value={activeJob.id} />
          <InfoRow label="PHARMACY" value={activeJob.pharmacy_id || 'Vamanjoor Pharmacy'} />
          <InfoRow label="ITEMS" value={formatItems(activeJob.items)} />
          <InfoRow label="PAYOUT" value="₹45.00" highlight />

          <View style={s.tracker}>
            {['Picked Up','En Route','Arrived','Delivered'].map((step, i) => (
              <View key={i} style={s.trackerStep}>
                <View style={[s.dot, i < 2 && s.dotDone]} />
                <Text style={[s.dotLabel, i < 2 && s.dotLabelDone]}>{step}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.btnGreen} onPress={handleDeliver}>
            <Text style={s.btnText}>✅ Confirm Delivery</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── MAIN QUEUE SCREEN ──
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />

      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>🛵 MEDORA Rider</Text>
          <Text style={s.headerSub}>{AGENT_ID}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <TouchableOpacity
            style={[s.toggleBtn, !isOnline && s.toggleOff]}
            onPress={() => setIsOnline(v => !v)}
          >
            <Text style={[s.toggleText, !isOnline && { color: '#94a3b8' }]}>
              {isOnline ? '● ONLINE' : '○ OFFLINE'}
            </Text>
          </TouchableOpacity>
          <Text style={{
            fontSize: 10, marginTop: 4,
            color: backendStatus === 'online' ? '#10b981' : backendStatus === 'offline' ? '#ef4444' : '#94a3b8'
          }}>
            {backendStatus === 'online' ? '⬤ Connected' : backendStatus === 'offline' ? '⬤ Offline' : '⟳ ...'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsBar}>
        <Stat value={completedCount} label="Delivered" />
        <Stat value={`₹${earnings}`} label="Earnings" />
        <Stat value={readyOrders.length} label="Available" />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.sectionTitle}>📦 Ready for Pickup</Text>
        <Text style={s.sectionSub}>Packed by pharmacy, waiting for rider</Text>

        {!isOnline ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>😴</Text>
            <Text style={s.emptyText}>You are offline</Text>
            <TouchableOpacity style={s.btnBlue} onPress={() => setIsOnline(true)}>
              <Text style={s.btnText}>Go Online</Text>
            </TouchableOpacity>
          </View>
        ) : readyOrders.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🕐</Text>
            <Text style={s.emptyText}>Waiting for orders...</Text>
            <Text style={s.emptyHint}>Orders appear when pharmacy marks "Ready"</Text>
          </View>
        ) : (
          readyOrders.map(order => (
            <View key={order.id} style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.cardId}>{order.id}</Text>
                <View style={s.urgentTag}><Text style={s.urgentText}>URGENT</Text></View>
              </View>
              <Text style={s.cardPharmacy}>📍 Vamanjoor Pharmacy, Mangalore</Text>
              <Text style={s.cardItems}>{formatItems(order.items)}</Text>
              <View style={s.payoutRow}>
                <Text style={s.payoutText}>₹45.00</Text>
                <Text style={s.distText}>~2.5 km</Text>
              </View>
              <TouchableOpacity style={s.btnBlue} onPress={() => handleAccept(order)}>
                <Text style={s.btnText}>🛵 Accept & Pick Up</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, highlight && { color: '#10b981', fontWeight: '800', fontSize: 18 }]}>{value}</Text>
    </View>
  );
}

function Stat({ value, label }) {
  return (
    <View style={s.statItem}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f19' },
  header: { padding: 16, paddingTop: 20, backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#60a5fa', fontSize: 20, fontWeight: '700' },
  headerSub: { color: '#64748b', fontSize: 12, marginTop: 2 },

  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)' },
  toggleOff: { borderColor: '#64748b', backgroundColor: 'rgba(100,116,139,0.12)' },
  toggleText: { color: '#10b981', fontWeight: '700', fontSize: 12 },

  statsBar: { flexDirection: 'row', backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#1e293b', paddingVertical: 14 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  statLbl: { color: '#64748b', fontSize: 11, marginTop: 2 },

  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700', marginBottom: 2 },
  sectionSub: { color: '#64748b', fontSize: 12, marginBottom: 16 },

  empty: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 15 },
  emptyHint: { color: '#475569', fontSize: 12, marginTop: 6, textAlign: 'center' },

  card: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardId: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  urgentTag: { backgroundColor: '#ef4444', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  urgentText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  cardPharmacy: { color: '#94a3b8', fontSize: 12, marginBottom: 4 },
  cardItems: { color: '#cbd5e1', fontSize: 14, marginBottom: 10 },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  payoutText: { color: '#10b981', fontWeight: '700', fontSize: 15 },
  distText: { color: '#94a3b8', fontSize: 13 },

  btnBlue: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnGreen: { backgroundColor: '#10b981', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Active delivery
  mapArea: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, borderColor: '#3b82f6' },
  mapTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700', marginTop: 12 },
  mapSub: { color: '#94a3b8', marginTop: 6 },
  etaBadge: { marginTop: 14, backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 99, paddingHorizontal: 18, paddingVertical: 6 },
  etaText: { color: '#93c5fd', fontWeight: '700', fontSize: 13 },

  detailsArea: { padding: 20, backgroundColor: '#0f172a' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#1e293b' },
  infoLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  infoValue: { color: '#f8fafc', fontSize: 13, textAlign: 'right', maxWidth: '60%' },

  tracker: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 4 },
  trackerStep: { alignItems: 'center', flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#334155', marginBottom: 4 },
  dotDone: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  dotLabel: { color: '#475569', fontSize: 9, textAlign: 'center' },
  dotLabelDone: { color: '#93c5fd' },
});
