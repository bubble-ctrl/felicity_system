import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { registrationAPI } from '../services/api';
import TicketViewer from '../components/TicketViewer';

/**
 * MyEvents — participant page showing all registrations with tabs:
 * Upcoming, Normal, Merchandise, Completed, Cancelled/Rejected
 * Reads ?tab= from URL to set initial active tab.
 */
export default function MyEvents() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') || 'upcoming';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [selectedTicket, setSelectedTicket] = useState(null);
    // Payment proof upload state
    const [uploadingId, setUploadingId] = useState(null);
    const [proofPreview, setProofPreview] = useState('');
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchRegistrations();
    }, []);

    const fetchRegistrations = async () => {
        try {
            setLoading(true);
            const { data } = await registrationAPI.getMyRegistrations();
            setRegistrations(data.data.registrations);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load registrations');
        } finally { setLoading(false); }
    };

    const handleCancel = async (regId) => {
        if (!confirm('Cancel this registration? This action cannot be undone.')) return;
        try {
            await registrationAPI.cancel(regId);
            fetchedRef.current = false;
            fetchRegistrations();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to cancel');
        }
    };

    const handleUploadProof = async (regId) => {
        if (!proofPreview) {
            alert('Please select a payment proof image first');
            return;
        }
        try {
            setUploadingId(regId);
            await registrationAPI.uploadPaymentProof(regId, { paymentProof: proofPreview });
            setProofPreview('');
            setUploadingId(null);
            fetchedRef.current = false;
            fetchRegistrations();
            alert('Payment proof uploaded!');
        } catch (err) {
            alert(err.response?.data?.message || 'Upload failed');
            setUploadingId(null);
        }
    };

    const handleProofFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Max 5 MB'); return; }
        const reader = new FileReader();
        reader.onload = () => setProofPreview(reader.result);
        reader.readAsDataURL(file);
    };

    // Filter registrations by tab
    const filtered = registrations.filter((r) => {
        const event = r.eventId || {};
        const now = new Date();
        switch (activeTab) {
            case 'upcoming':
                return ['registered', 'pending_approval'].includes(r.status) && event.startDate && new Date(event.startDate) >= now;
            case 'normal':
                return event.type === 'normal' && ['registered', 'pending_approval'].includes(r.status);
            case 'merchandise':
                return event.type === 'merchandise' && ['registered', 'pending_approval'].includes(r.status);
            case 'completed':
                return r.status === 'completed' || event.status === 'completed';
            case 'cancelled':
                return r.status === 'cancelled' || r.status === 'rejected';
            default: return true;
        }
    });

    const tabs = [
        { key: 'upcoming', label: '📅 Upcoming' },
        { key: 'normal', label: '🎫 Normal' },
        { key: 'merchandise', label: '🛍️ Merchandise' },
        { key: 'completed', label: '✅ Completed' },
        { key: 'cancelled', label: '❌ Cancelled/Rejected' },
    ];

    // Count for pending badge
    const pendingCount = registrations.filter((r) => r.status === 'pending_approval').length;

    if (loading) return <div className="main-content"><p className="loading-text">Loading your events...</p></div>;

    return (
        <div className="main-content">
            <div className="page-header">
                <h1>My Events</h1>
                <Link to="/events" className="btn btn-primary btn-sm">Browse Events</Link>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* Tabs */}
            <div className="filter-tabs">
                {tabs.map((t) => (
                    <button key={t.key}
                        className={`filter-tab ${activeTab === t.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.key)}>
                        {t.label}
                        {t.key === 'pending' && pendingCount > 0 && (
                            <span className="tab-badge">{pendingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Registration list */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <p>No events in this category yet.</p>
                    <Link to="/events" className="btn btn-outline btn-sm">Browse Events</Link>
                </div>
            ) : (
                <div className="registrations-list">
                    {filtered.map((reg) => {
                        const event = reg.eventId || {};
                        return (
                            <div key={reg._id} className="registration-card">
                                <div className="reg-card-main">
                                    <div className="reg-card-info">
                                        <Link to={`/events/${event._id}`} className="reg-event-name">{event.name || 'Unknown Event'}</Link>
                                        <div className="reg-card-meta">
                                            <span className="event-type-badge">{event.type}</span>
                                            <span className={`status-badge status-${reg.status}`}>
                                                {reg.status === 'pending_approval' ? 'Pending Approval' : reg.status}
                                            </span>
                                            {event.organizerId?.organizerName && (
                                                <span className="reg-organizer">by {event.organizerId.organizerName}</span>
                                            )}
                                        </div>
                                        {event.startDate && (
                                            <span className="reg-date">📅 {new Date(event.startDate).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                    <div className="reg-card-actions">
                                        {/* Show ticket button only for approved registrations */}
                                        {reg.status === 'registered' && reg.qrCode && (
                                            <button className="btn btn-outline btn-sm" onClick={() => setSelectedTicket(reg)}>
                                                🎫 View Ticket
                                            </button>
                                        )}
                                        {reg.status === 'registered' && (
                                            <button className="btn btn-danger btn-sm" onClick={() => handleCancel(reg._id)}>Cancel</button>
                                        )}
                                        {reg.status === 'pending_approval' && (
                                            <button className="btn btn-danger btn-sm" onClick={() => handleCancel(reg._id)}>Cancel Order</button>
                                        )}
                                    </div>
                                </div>
                                {/* Payment proof section for pending orders */}
                                {reg.status === 'pending_approval' && (
                                    <div className="reg-card-payment">
                                        {reg.paymentProof ? (
                                            <div className="payment-proof-row">
                                                <span className="text-muted" style={{ fontSize: '0.85rem' }}>✅ Payment proof uploaded — awaiting approval</span>
                                                <img src={reg.paymentProof} alt="Proof" className="payment-proof-thumb" />
                                            </div>
                                        ) : (
                                            <div className="payment-proof-upload">
                                                <p style={{ fontSize: '0.85rem', margin: '0 0 0.4rem' }}>📤 Upload payment proof to proceed:</p>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <input type="file" accept="image/*" onChange={handleProofFile} className="form-input" style={{ flex: 1, minWidth: '200px' }} />
                                                    <button className="btn btn-primary btn-sm"
                                                        onClick={() => handleUploadProof(reg._id)}
                                                        disabled={uploadingId === reg._id || !proofPreview}>
                                                        {uploadingId === reg._id ? 'Uploading...' : 'Upload'}
                                                    </button>
                                                </div>
                                                {proofPreview && <img src={proofPreview} alt="Preview" className="payment-proof-thumb" style={{ marginTop: '0.5rem' }} />}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Ticket viewer modal */}
            {selectedTicket && (
                <TicketViewer ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
            )}
        </div>
    );
}
