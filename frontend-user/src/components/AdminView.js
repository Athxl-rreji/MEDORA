"use client";
import React, { useState, useEffect } from 'react';
import { API } from '../utils/apiConfig';

export default function AdminView() {
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'users'

  // Partner Requests State
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'pharmacy' | 'delivery'
  const [statusCounts, setStatusCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  
  // User Accounts State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState('all'); // 'all' | 'patient' | 'pharmacy' | 'delivery'
  const [userStatusFilter, setUserStatusFilter] = useState('all'); // 'all' | 'active' | 'deactivated'
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // User Action & Confirm States (No browser alert/confirm popups)
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);

  // Rejection Modal State
  const [selectedReqForReject, setSelectedReqForReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  
  // Action Toast / Modal Notice
  const [toastMsg, setToastMsg] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/admin/partner-requests?status=${statusFilter}&partner_type=${roleFilter}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        if (data.counts) {
          setStatusCounts(data.counts);
        }
      }
    } catch (err) {
      console.error("Failed to fetch admin partner requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch admin users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchUsers();
  }, [statusFilter, roleFilter]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const handleToggleUserStatus = async (user) => {
    const isCurrentlyDeactivated = (user.status || '').toLowerCase() === 'deactivated';
    const nextStatus = isCurrentlyDeactivated ? 'active' : 'deactivated';
    const targetKey = user.id || user.email;

    setUpdatingUserId(user.id || user.email);

    // Optimistic UI update so the change reflects instantly
    setUsers(prev => prev.map(u => (u.id === user.id || u.email === user.email) ? { ...u, status: nextStatus } : u));

    try {
      const res = await fetch(`${API}/api/v1/admin/users/${encodeURIComponent(targetKey)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          nextStatus === 'active'
            ? `🟢 ${user.full_name || user.email} has been reactivated! Login access restored.`
            : `⏸️ ${user.full_name || user.email} has been deactivated! Login blocked.`
        );
        fetchUsers();
      } else {
        // Revert on failure
        setUsers(prev => prev.map(u => (u.id === user.id || u.email === user.email) ? { ...u, status: user.status } : u));
        showToast(data.detail || 'Failed to update user status.', true);
      }
    } catch (err) {
      setUsers(prev => prev.map(u => (u.id === user.id || u.email === user.email) ? { ...u, status: user.status } : u));
      showToast(`Error: ${err.message}`, true);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const executeDeleteUser = async (user) => {
    const targetKey = user.id || user.email;
    setUpdatingUserId(user.id || user.email);
    setDeletingUserId(null);

    // Optimistically remove from UI list immediately
    setUsers(prev => prev.filter(u => u.id !== user.id && u.email !== user.email));

    try {
      const res = await fetch(`${API}/api/v1/admin/users/${encodeURIComponent(targetKey)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`🗑️ User account ${user.email} (${user.full_name || 'User'}) deleted permanently.`);
        fetchUsers();
      } else {
        showToast(data.detail || 'Failed to delete user.', true);
        fetchUsers();
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, true);
      fetchUsers();
    } finally {
      setUpdatingUserId(null);
    }
  };

  const showToast = (msg, isError = false) => {
    setToastMsg({ text: msg, isError });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const handleApprove = async (req) => {
    setProcessingId(req.id);
    // Optimistically remove from list immediately
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try {
      const res = await fetch(`${API}/api/v1/admin/partner-requests/${req.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✅ Approved ${req.full_name}! Login credentials (${data.temp_password || 'dispatched'}) emailed to ${req.email}. Removed from onboarding.`);
        fetchRequests();
        fetchUsers();
      } else {
        showToast(data.detail || 'Approval failed.', true);
        fetchRequests();
      }
    } catch (err) {
      showToast(`Server error: ${err.message}`, true);
      fetchRequests();
    } finally {
      setProcessingId(null);
    }
  };
    

  const handleRejectSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedReqForReject) return;

    const trimmedReason = (rejectReason || '').trim();
    if (!trimmedReason) {
      showToast('⚠️ Please enter or select a rejection reason before confirming.', true);
      return;
    }

    const rejectId = selectedReqForReject.id;
    const applicantName = selectedReqForReject.full_name;
    const applicantEmail = selectedReqForReject.email;

    setProcessingId(rejectId);
    // Optimistically remove from list immediately
    setRequests(prev => prev.filter(r => r.id !== rejectId));
    setSelectedReqForReject(null);
    setRejectReason('');

    try {
      const res = await fetch(`${API}/api/v1/admin/partner-requests/${rejectId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmedReason, ...selectedReqForReject })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`❌ Rejected application for ${applicantName}. Official rejection email with reason dispatched to ${applicantEmail}! Removed from list.`);
        fetchRequests();
      } else {
        showToast(data.detail || 'Rejection failed.', true);
        fetchRequests();
      }
    } catch (err) {
      showToast(`Server error: ${err.message}`, true);
      fetchRequests();
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeletePartnerRequest = async (req) => {
    setProcessingId(req.id);
    // Optimistically remove from list immediately
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try {
      const res = await fetch(`${API}/api/v1/admin/partner-requests/${req.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`🗑️ Partner application for ${req.full_name} removed from onboarding list.`);
        fetchRequests();
      } else {
        showToast(data.detail || 'Failed to remove partner request.', true);
        fetchRequests();
      }
    } catch (err) {
      showToast(`Server error: ${err.message}`, true);
      fetchRequests();
    } finally {
      setProcessingId(null);
    }
  };

  // KPI Calculations
  const totalCount = statusCounts.total || requests.length;
  const pendingCount = statusCounts.pending || requests.filter(r => r.status === 'pending').length;
  const approvedCount = statusCounts.approved || requests.filter(r => r.status === 'approved').length;
  const rejectedCount = statusCounts.rejected || requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="admin-console-root" style={{ minHeight: '100vh', background: '#0c0d0e', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', padding: '2rem 1.5rem' }}>
      
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: toastMsg.isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 9999,
          fontWeight: 'bold',
          fontSize: '0.9rem',
          maxWidth: '450px'
        }}>
          {toastMsg.text}
        </div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header Banner */}
        <div className="admin-header-banner" style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(184, 247, 228, 0.2)',
          padding: '1.75rem 2rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '1.5rem' }}>🔑</span>
              <h1 style={{ fontSize: '1.6rem', color: 'var(--primary, #B8F7E4)', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                MEDORA Partner Onboarding Console
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>
              Review, approve, and reject Pharmacy Store & Delivery Rider onboarding applications.
            </p>
          </div>

          <button
            onClick={fetchRequests}
            style={{
              background: 'rgba(184, 247, 228, 0.12)',
              color: 'var(--primary, #B8F7E4)',
              border: '1px solid rgba(184, 247, 228, 0.3)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔄 Refresh Applications
          </button>
        </div>

        {/* Console Navigation Tabs */}
        <div className="admin-console-nav-tabs" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
          <button
            onClick={() => setActiveTab('requests')}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'requests' ? 'var(--primary, #B8F7E4)' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'requests' ? '#0c0d0e' : '#94a3b8',
              fontWeight: '800',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span>📋</span>
            <span>Partner Onboarding KYC ({pendingCount} Pending)</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'users' ? 'var(--primary, #B8F7E4)' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'users' ? '#0c0d0e' : '#94a3b8',
              fontWeight: '800',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span>👥</span>
            <span>User Accounts & Permissions ({users.length} Registered)</span>
          </button>
        </div>

        {/* KPI Stat Cards (Conditional by Tab) */}
        {activeTab === 'requests' ? (
          <div className="admin-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ background: '#16181d', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>PENDING REVIEW</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#f59e0b', marginTop: '4px' }}>
                {pendingCount}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Requires Admin Action</span>
            </div>

            <div style={{ background: '#16181d', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>APPROVED PARTNERS</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                {approvedCount}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Active Portal Credentials</span>
            </div>

            <div style={{ background: '#16181d', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>REJECTED APPLICATIONS</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ef4444', marginTop: '4px' }}>
                {rejectedCount}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Flagged as Non-Compliant</span>
            </div>

            <div style={{ background: '#16181d', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>TOTAL SUBMISSIONS</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
                {totalCount}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Lifetime Onboarding Requests</span>
            </div>
          </div>
        ) : (
          <div className="admin-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ background: '#16181d', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>TOTAL REGISTERED USERS</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary, #B8F7E4)', marginTop: '4px' }}>
                {users.length}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Across all system portals</span>
            </div>

            <div style={{ background: '#16181d', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>ACTIVE ACCOUNTS</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                {users.filter(u => u.status !== 'deactivated').length}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Can login and transact</span>
            </div>

            <div style={{ background: '#16181d', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>DEACTIVATED ACCOUNTS</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ef4444', marginTop: '4px' }}>
                {users.filter(u => u.status === 'deactivated').length}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Blocked by Administrator</span>
            </div>

            <div style={{ background: '#16181d', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold' }}>PARTNER NODES</span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
                {users.filter(u => u.role === 'pharmacy' || u.role === 'delivery').length}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Pharmacies & Riders</span>
            </div>
          </div>
        )}

        {/* TAB 1: PARTNER ONBOARDING APPLICATIONS */}
        {activeTab === 'requests' && (
          <div>

        {/* Filter Navigation Bar */}
        <div className="admin-filter-bar" style={{
          background: '#16181d',
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          
          {/* Status Tabs */}
          <div className="admin-status-tabs" style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { key: 'pending', label: '⏳ Pending' },
              { key: 'approved', label: '✅ Approved' },
              { key: 'rejected', label: '❌ Rejected' },
              { key: 'all', label: '📋 All Submissions' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: statusFilter === tab.key ? '1px solid var(--primary, #B8F7E4)' : '1px solid transparent',
                  background: statusFilter === tab.key ? 'rgba(184, 247, 228, 0.15)' : 'transparent',
                  color: statusFilter === tab.key ? 'var(--primary, #B8F7E4)' : '#94a3b8',
                  fontWeight: 'bold',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Role Filter Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 'bold' }}>Filter Role:</span>
            {[
              { key: 'all', label: 'All' },
              { key: 'pharmacy', label: '🏥 Pharmacy' },
              { key: 'delivery', label: '🛵 Rider' }
            ].map(role => (
              <button
                key={role.key}
                onClick={() => setRoleFilter(role.key)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: roleFilter === role.key ? '#334155' : 'rgba(255,255,255,0.05)',
                  color: roleFilter === role.key ? '#fff' : '#94a3b8',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontWeight: roleFilter === role.key ? 'bold' : 'normal'
                }}
              >
                {role.label}
              </button>
            ))}
          </div>

        </div>

        {/* Applications List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '1rem' }}>
            ⏳ Loading partner applications...
          </div>
        ) : requests.length === 0 ? (
          <div style={{
            background: '#16181d',
            padding: '3rem 2rem',
            borderRadius: '12px',
            textAlign: 'center',
            border: '1px dashed rgba(255,255,255,0.15)'
          }}>
            <p style={{ fontSize: '1.1rem', color: '#94a3b8', margin: 0 }}>
              No partner requests found for status <strong>"{statusFilter.toUpperCase()}"</strong>.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {requests.map(req => (
              <div
                key={req.id}
                style={{
                  background: '#16181d',
                  borderRadius: '14px',
                  border: req.status === 'pending'
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : req.status === 'approved'
                    ? '1px solid rgba(16, 185, 129, 0.4)'
                    : '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      background: req.partner_type === 'pharmacy' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                      color: req.partner_type === 'pharmacy' ? '#38bdf8' : '#fbbf24',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '1.2rem'
                    }}>
                      {req.partner_type === 'pharmacy' ? '🏥' : '🛵'}
                    </span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{req.full_name}</h3>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        Applied as <strong style={{ color: '#e2e8f0' }}>{req.partner_type.toUpperCase()}</strong> • ID: {req.id}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {req.status === 'pending' && (
                      <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                        ⏳ PENDING REVIEW
                      </span>
                    )}
                    {req.status === 'approved' && (
                      <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                        ✅ APPROVED
                      </span>
                    )}
                    {req.status === 'rejected' && (
                      <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                        ❌ REJECTED
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', background: '#0e1013', padding: '1rem 1.25rem', borderRadius: '10px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 'bold' }}>EMAIL ADDRESS:</span>
                    <span style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>{req.email}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 'bold' }}>PHONE NUMBER:</span>
                    <span style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>{req.phone}</span>
                  </div>

                  {req.partner_type === 'pharmacy' ? (
                    <>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 'bold' }}>STORE NAME:</span>
                        <span style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>{req.store_name || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 'bold' }}>DRUG LICENSE NO.:</span>
                        <span style={{ fontSize: '0.88rem', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 'bold' }}>{req.license_no || 'N/A'}</span>
                      </div>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 'bold' }}>LOCATION ADDRESS:</span>
                          <span style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>{req.store_address || 'N/A'}</span>
                        </div>
                        {req.latitude && req.longitude && (
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#10b981', fontWeight: 'bold' }}>📍 GPS LOCATION (COMPULSORY):</span>
                            <a
                              href={`https://www.google.com/maps?q=${req.latitude},${req.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.82rem',
                                color: 'var(--primary, #B8F7E4)',
                                background: 'rgba(184, 247, 228, 0.1)',
                                border: '1px solid rgba(184, 247, 228, 0.25)',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontWeight: 'bold'
                              }}
                            >
                              <span>🗺️</span>
                              <span>{req.latitude.toFixed(4)}, {req.longitude.toFixed(4)} (Open in Maps ➔)</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 'bold' }}>VEHICLE TYPE:</span>
                        <span style={{ fontSize: '0.88rem', color: '#fbbf24', fontWeight: 'bold' }}>{req.vehicle_type || 'Electric Scooter'}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 'bold' }}>DRIVING LICENSE NO.:</span>
                        <span style={{ fontSize: '0.88rem', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 'bold' }}>{req.driving_license || 'N/A'}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Rejection Reason Notice if rejected */}
                {req.status === 'rejected' && req.rejection_reason && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.82rem', color: '#fca5a5' }}>
                    <strong>Rejection Reason:</strong> {req.rejection_reason}
                  </div>
                )}

                {/* Approved Password Notice */}
                {req.status === 'approved' && req.temp_password && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.82rem', color: '#6ee7b7' }}>
                    <strong>Initial Password Sent:</strong> <code style={{ background: '#000', padding: '2px 6px', borderRadius: '4px' }}>{req.temp_password}</code>
                  </div>
                )}

                {/* Action Buttons for Requests */}
                {req.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={processingId === req.id}
                      style={{
                        flex: 1,
                        minWidth: '220px',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {processingId === req.id ? 'Processing Approval...' : '✅ Approve & Mail Credentials'}
                    </button>

                    <button
                      onClick={() => { setSelectedReqForReject(req); setRejectReason(''); }}
                      disabled={processingId === req.id}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        padding: '0.75rem 1.25rem',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '0.88rem',
                        cursor: 'pointer'
                      }}
                    >
                      ❌ Reject
                    </button>

                    <button
                      onClick={() => handleDeletePartnerRequest(req)}
                      disabled={processingId === req.id}
                      title="Remove this application from onboarding list"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#94a3b8',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Remove from List
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => handleDeletePartnerRequest(req)}
                      disabled={processingId === req.id}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Remove from List
                    </button>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
          </div>
        )}

        {/* TAB 2: USER ACCOUNTS & PERMISSIONS MANAGEMENT */}
        {activeTab === 'users' && (
          <div>
            {/* Filter Navigation Bar for Users */}
            <div style={{
              background: '#16181d',
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              {/* Role Filters */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: '👥 All Roles' },
                  { key: 'patient', label: '👤 Patients' },
                  { key: 'pharmacy', label: '🏥 Pharmacies' },
                  { key: 'delivery', label: '🛵 Delivery Riders' },
                  { key: 'admin', label: '👑 Admins' }
                ].map(r => (
                  <button
                    key={r.key}
                    onClick={() => setUserRoleFilter(r.key)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: userRoleFilter === r.key ? '1px solid var(--primary, #B8F7E4)' : '1px solid transparent',
                      background: userRoleFilter === r.key ? 'rgba(184, 247, 228, 0.15)' : 'transparent',
                      color: userRoleFilter === r.key ? 'var(--primary, #B8F7E4)' : '#94a3b8',
                      fontWeight: 'bold',
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Status Filter & Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {[
                    { key: 'all', label: 'All Status' },
                    { key: 'active', label: '🟢 Active' },
                    { key: 'deactivated', label: '🔴 Deactivated' }
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => setUserStatusFilter(s.key)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        border: userStatusFilter === s.key ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        background: userStatusFilter === s.key ? 'rgba(255,255,255,0.15)' : 'transparent',
                        color: userStatusFilter === s.key ? '#fff' : '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="🔍 Search user name, email, phone..."
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  style={{
                    background: '#0e1013',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    minWidth: '220px'
                  }}
                />
              </div>
            </div>

            {/* Users List */}
            {usersLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                Loading registered user accounts...
              </div>
            ) : (() => {
              const filteredUsers = users.filter(u => {
                if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
                if (userStatusFilter !== 'all' && u.status !== userStatusFilter) return false;
                if (userSearchQuery.trim()) {
                  const q = userSearchQuery.toLowerCase();
                  const matchName = (u.full_name || '').toLowerCase().includes(q);
                  const matchEmail = (u.email || '').toLowerCase().includes(q);
                  const matchPhone = (u.phone || '').toLowerCase().includes(q);
                  const matchId = (u.id || '').toLowerCase().includes(q);
                  if (!matchName && !matchEmail && !matchPhone && !matchId) return false;
                }
                return true;
              });

              if (filteredUsers.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', background: '#16181d', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>👥</span>
                    <p style={{ color: '#fff', fontWeight: 'bold' }}>No user accounts found matching your filters</p>
                    <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Try clearing the search query or changing role filters.</p>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {filteredUsers.map(user => {
                    const isActive = user.status !== 'deactivated';
                    const roleColors = {
                      admin: { bg: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', label: '👑 Admin' },
                      pharmacy: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', label: '🏥 Pharmacy' },
                      delivery: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', label: '🛵 Rider' },
                      patient: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', label: '👤 Patient' }
                    };
                    const rConfig = roleColors[user.role] || roleColors.patient;

                    return (
                      <div
                        key={user.id}
                        style={{
                          background: '#16181d',
                          borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          padding: '1.25rem 1.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '1rem',
                          opacity: isActive ? 1 : 0.65
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: rConfig.bg,
                            color: rConfig.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem'
                          }}>
                            {user.role === 'admin' ? '👑' : user.role === 'pharmacy' ? '🏥' : user.role === 'delivery' ? '🛵' : '👤'}
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '1rem', color: '#fff' }}>{user.full_name}</strong>
                              <span style={{ background: rConfig.bg, color: rConfig.color, padding: '2px 8px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                {rConfig.label}
                              </span>
                              <span style={{
                                background: isActive ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isActive ? '#4ade80' : '#f87171',
                                padding: '2px 8px',
                                borderRadius: '99px',
                                fontSize: '0.72rem',
                                fontWeight: 'bold',
                                border: isActive ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                              }}>
                                {isActive ? '● Active' : '○ Deactivated'}
                              </span>
                              {user.must_change_password && (
                                <span style={{
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#fbbf24',
                                  padding: '2px 8px',
                                  borderRadius: '99px',
                                  fontSize: '0.72rem',
                                  fontWeight: 'bold',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <span>🔑</span>
                                  <span>Temp Pass (Setup Pending)</span>
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                              <span>📧 {user.email}</span>
                              {user.phone && <span>📞 {user.phone}</span>}
                              <span>🆔 <code style={{ color: '#64748b' }}>{user.id}</code></span>
                              {user.pharmacy_license && <span>📜 License: {user.pharmacy_license}</span>}
                              {user.vehicle_type && <span>🛵 Vehicle: {user.vehicle_type}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {user.role !== 'admin' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            {/* Deactivate / Reactivate Toggle Button */}
                            <button
                              id={`btn-toggle-status-${user.id || user.email}`}
                              onClick={() => handleToggleUserStatus(user)}
                              disabled={updatingUserId === (user.id || user.email)}
                              style={{
                                background: isActive
                                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.12) 100%)'
                                  : 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(5, 150, 105, 0.12) 100%)',
                                color: isActive ? '#fbbf24' : '#34d399',
                                border: isActive ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(16, 185, 129, 0.45)',
                                boxShadow: isActive ? '0 2px 10px rgba(245, 158, 11, 0.15)' : '0 2px 10px rgba(16, 185, 129, 0.15)',
                                padding: '7px 14px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                cursor: updatingUserId === (user.id || user.email) ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                backdropFilter: 'blur(8px)',
                                opacity: updatingUserId === (user.id || user.email) ? 0.6 : 1
                              }}
                              onMouseEnter={(e) => {
                                if (updatingUserId !== (user.id || user.email)) {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = isActive ? '0 4px 16px rgba(245, 158, 11, 0.35)' : '0 4px 16px rgba(16, 185, 129, 0.35)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = isActive ? '0 2px 10px rgba(245, 158, 11, 0.15)' : '0 2px 10px rgba(16, 185, 129, 0.15)';
                              }}
                              title={isActive ? "Click to deactivate user account" : "Click to reactivate user account"}
                            >
                              {updatingUserId === (user.id || user.email) ? (
                                <><span>⏳</span><span>Updating...</span></>
                              ) : isActive ? (
                                <>
                                  <span style={{ fontSize: '0.9rem' }}>⏸️</span>
                                  <span>Deactivate Account</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: '0.9rem' }}>▶️</span>
                                  <span>Reactivate Account</span>
                                </>
                              )}
                            </button>

                            {/* Two-Stage Interactive Delete Button (Zero Browser Confirm Needed) */}
                            {deletingUserId === (user.id || user.email) ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  id={`btn-confirm-delete-${user.id || user.email}`}
                                  onClick={() => executeDeleteUser(user)}
                                  disabled={updatingUserId === (user.id || user.email)}
                                  style={{
                                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                                    color: '#ffffff',
                                    border: '1px solid #f87171',
                                    boxShadow: '0 0 14px rgba(239, 68, 68, 0.45)',
                                    padding: '7px 13px',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: '700',
                                    cursor: updatingUserId === (user.id || user.email) ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s ease'
                                  }}
                                  title="Permanently remove this user record"
                                >
                                  <span>⚠️</span>
                                  <span>Confirm Delete?</span>
                                </button>
                                <button
                                  id={`btn-cancel-delete-${user.id || user.email}`}
                                  onClick={() => setDeletingUserId(null)}
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: '#94a3b8',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    padding: '7px 11px',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                  title="Cancel deletion"
                                >
                                  ✕ Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                id={`btn-delete-${user.id || user.email}`}
                                onClick={() => setDeletingUserId(user.id || user.email)}
                                disabled={updatingUserId === (user.id || user.email)}
                                style={{
                                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.1) 100%)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.12)',
                                  padding: '7px 13px',
                                  borderRadius: '8px',
                                  fontSize: '0.8rem',
                                  fontWeight: '700',
                                  cursor: updatingUserId === (user.id || user.email) ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                  backdropFilter: 'blur(8px)',
                                  opacity: updatingUserId === (user.id || user.email) ? 0.6 : 1
                                }}
                                onMouseEnter={(e) => {
                                  if (updatingUserId !== (user.id || user.email)) {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.2) 100%)';
                                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.3)';
                                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.1) 100%)';
                                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.12)';
                                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                                }}
                                title="Delete account permanently"
                              >
                                <span style={{ fontSize: '0.9rem' }}>🗑️</span>
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

      </div>

      {/* REJECTION REASON MODAL */}
      {selectedReqForReject && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#16181d',
            width: '100%',
            maxWidth: '520px',
            padding: '1.75rem',
            borderRadius: '16px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <span style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  letterSpacing: '0.5px'
                }}>
                  REJECTION NOTICE EMAIL
                </span>
                <h3 style={{ color: '#ef4444', margin: '6px 0 0 0', fontSize: '1.25rem', fontWeight: '800' }}>
                  ❌ Reject Application: {selectedReqForReject.full_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReqForReject(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.25rem', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Recipient details box */}
            <div style={{
              background: '#0d1014',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #1e2430',
              marginBottom: '1rem',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Recipient Email:</span>
                <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>📧 {selectedReqForReject.email}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Partner Role:</span>
                <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{selectedReqForReject.partner_type.toUpperCase()}</span>
              </div>
              {selectedReqForReject.license_no && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>License No:</span>
                  <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{selectedReqForReject.license_no}</span>
                </div>
              )}
            </div>

            <p style={{ fontSize: '0.83rem', color: '#94a3b8', marginBottom: '0.75rem', lineHeight: '1.4' }}>
              Please specify the reason below. This exact reason will be <strong>formally emailed to {selectedReqForReject.email}</strong> explaining why their application was not approved.
            </p>

            {/* Quick Reason Chips */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase' }}>
                Quick Preset Reasons:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  '📜 Drug License document is unverified or expired.',
                  '📍 Store address could not be validated on GPS mapping.',
                  '🪪 Incomplete KYC identity and registration documents.',
                  '⚠️ Uploaded certificate photo is blurry and illegible.'
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRejectReason(preset)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#cbd5e1',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                      e.currentTarget.style.color = '#fca5a5';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.color = '#cbd5e1';
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleRejectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>
                  Official Reason for Rejection Email:
                </label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Type or select the specific reason why this application was rejected..."
                  rows={4}
                  required
                  style={{
                    width: '100%',
                    background: '#0e1013',
                    border: '1px solid #334155',
                    color: '#fff',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSelectedReqForReject(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', padding: '0.6rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === selectedReqForReject.id || !rejectReason.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.75rem 1.4rem',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '0.88rem',
                    cursor: (processingId === selectedReqForReject.id || !rejectReason.trim()) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: (!rejectReason.trim() || processingId === selectedReqForReject.id) ? 0.6 : 1
                  }}
                >
                  {processingId === selectedReqForReject.id ? (
                    <><span>⏳</span><span>Sending Rejection Email...</span></>
                  ) : (
                    <><span>✉️</span><span>Confirm & Mail Rejection</span></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
