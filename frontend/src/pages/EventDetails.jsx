import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicEventAPI, registrationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TicketViewer from '../components/TicketViewer';
import DiscussionForum from '../components/DiscussionForum';
import FeedbackForm from '../components/FeedbackForm';

/**
 * EventDetails — public event detail page with registration, custom form,
 * merchandise variant selection, payment proof upload, eligibility checks.
 */
export default function EventDetails() {
    const { id } = useParams();
    const { user } = useAuth();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [registering, setRegistering] = useState(false);
    const [regResult, setRegResult] = useState(null);
    const [showTicket, setShowTicket] = useState(false);
    const [existingReg, setExistingReg] = useState(null);

    // Custom form responses
    const [formResponses, setFormResponses] = useState({});
    // Merchandise selection
    const [selectedVariant, setSelectedVariant] = useState('');
    const [quantity, setQuantity] = useState(1);
    // Payment proof upload
    const [paymentProof, setPaymentProof] = useState('');
    const [uploading, setUploading] = useState(false);

    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchEvent();
        if (user?.role === 'participant') fetchExistingReg();
    }, [id]);

    const fetchEvent = async () => {
        try {
            setLoading(true);
            const { data } = await publicEventAPI.getDetails(id);
            setEvent(data.data.event);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load event');
        } finally { setLoading(false); }
    };

    const fetchExistingReg = async () => {
        try {
            const { data } = await registrationAPI.getMyRegistrations();
            const existing = data.data.registrations.find(
                (r) => (r.eventId?._id === id || r.eventId === id) && ['registered', 'pending_approval', 'completed'].includes(r.status)
            );
            if (existing) setExistingReg(existing);
        } catch (err) { /* ignore */ }
    };

    const getBlockReason = () => {
        if (!event) return null;
        if (!['published', 'ongoing'].includes(event.status)) return 'Registrations are not open';
        if (event.registrationDeadline && new Date(event.registrationDeadline) < new Date()) return 'Registration deadline has passed';
        if (event.type === 'normal' && event.registrationLimit && event.registrationCount >= event.registrationLimit) return 'Event is full — no spots remaining';
        if (event.eligibility === 'iiit' && user?.participantType !== 'iiit') return 'Restricted to IIIT students only';
        if (event.type === 'merchandise') {
            const variants = event.merchandiseDetails?.variants || [];
            if (variants.every((v) => v.stock <= 0)) return 'All variants are out of stock';
        }
        return null;
    };

    const handleRegister = async () => {
        if (event.type === 'merchandise' && !selectedVariant) {
            alert('Please select a variant');
            return;
        }
        const customFields = Array.isArray(event.customForm) ? event.customForm : [];
        for (const field of customFields) {
            if (field.required && !formResponses[field.label]) {
                alert(`Please fill in the required field: ${field.label}`);
                return;
            }
        }

        try {
            setRegistering(true);
            const payload = { formResponses };
            if (event.type === 'merchandise') {
                payload.variantId = selectedVariant;
                payload.quantity = quantity;
            }
            const { data } = await registrationAPI.register(id, payload);
            setRegResult(data.data.registration);
            setExistingReg(data.data.registration);
            // For normal events, show ticket; for merch, show pending state
            if (event.type !== 'merchandise') {
                setShowTicket(true);
            }
            fetchEvent();
        } catch (err) {
            alert(err.response?.data?.message || 'Registration failed');
        } finally { setRegistering(false); }
    };

    const handleUploadProof = async () => {
        if (!paymentProof) {
            alert('Please select a payment proof image');
            return;
        }
        try {
            setUploading(true);
            await registrationAPI.uploadPaymentProof(existingReg._id, { paymentProof });
            // Refresh registration
            setExistingReg((prev) => ({ ...prev, paymentProof }));
            alert('Payment proof uploaded! Waiting for organizer approval.');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to upload proof');
        } finally { setUploading(false); }
    };

    const handleProofFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Image too large. Max 5 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setPaymentProof(reader.result);
        reader.readAsDataURL(file);
    };

    const handleFormChange = (fieldLabel, value) => {
        setFormResponses((prev) => ({ ...prev, [fieldLabel]: value }));
    };

    if (loading) return <div className="main-content"><p className="loading-text">Loading event...</p></div>;
    if (error) return <div className="main-content"><div className="alert alert-error">{error}</div></div>;
    if (!event) return <div className="main-content"><p>Event not found.</p></div>;

    const organizer = event.organizerId || {};
    const blockReason = getBlockReason();
    const customFields = Array.isArray(event.customForm) ? event.customForm : [];
    const merchVariants = event.merchandiseDetails?.variants || [];
    const isRegistered = existingReg?.status === 'registered';
    const isPending = existingReg?.status === 'pending_approval';

    return (
        <div className="main-content">
            <Link to="/events" className="back-link">← Browse Events</Link>

            {/* Hero */}
            <div className="event-detail-hero">
                <div className="event-card-header">
                    <span className="event-type-badge">{event.type}</span>
                    <span className={`status-badge status-${event.status}`}>{event.status}</span>
                    {event.eligibility === 'iiit' && <span className="status-badge status-draft">🔒 IIIT Only</span>}
                </div>
                <h1>{event.name}</h1>
                {organizer.organizerName && (
                    <Link to={`/clubs/${organizer._id}`} className="event-org-name">
                        by {organizer.organizerName} ({organizer.category || 'Club'})
                    </Link>
                )}
            </div>

            <div className="detail-grid">
                {/* Left: Info */}
                <div>
                    <div className="detail-section">
                        <h3>Schedule</h3>
                        {event.startDate && <div className="detail-row"><strong>Start:</strong> {new Date(event.startDate).toLocaleString()}</div>}
                        {event.endDate && <div className="detail-row"><strong>End:</strong> {new Date(event.endDate).toLocaleString()}</div>}
                        {event.registrationDeadline && <div className="detail-row"><strong>Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}</div>}
                    </div>

                    <div className="detail-section" style={{ marginTop: '1rem' }}>
                        <h3>Details</h3>
                        {event.fee > 0 && <div className="detail-row"><strong>Fee:</strong> ₹{event.fee}</div>}
                        {event.registrationLimit && (
                            <div className="detail-row">
                                <strong>Spots:</strong> {event.registrationCount || 0} / {event.registrationLimit}
                            </div>
                        )}
                        <div className="detail-row"><strong>Eligibility:</strong> {event.eligibility === 'iiit' ? 'IIIT Students Only' : 'Open to All'}</div>
                    </div>

                    {event.description && (
                        <div className="detail-section" style={{ marginTop: '1rem' }}>
                            <h3>Description</h3>
                            <p className="detail-description">{event.description}</p>
                        </div>
                    )}

                    {event.tags?.length > 0 && (
                        <div className="event-tags" style={{ marginTop: '0.8rem' }}>
                            {event.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                        </div>
                    )}
                </div>

                {/* Right: Registration */}
                <div>
                    {/* Already approved — show ticket */}
                    {isRegistered ? (
                        <div className="registration-status-box">
                            <div className="reg-status" style={{ background: 'rgba(0,184,148,0.1)', color: 'var(--success)' }}>
                                ✅ You are registered for this event
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.8rem' }}
                                onClick={() => { setRegResult(existingReg); setShowTicket(true); }}>
                                🎫 View My Ticket
                            </button>
                        </div>
                    ) : isPending ? (
                        /* Pending merchandise approval */
                        <div className="registration-status-box">
                            <div className="reg-status" style={{ background: 'rgba(253,203,110,0.15)', color: 'var(--warning)' }}>
                                ⏳ Order placed — Pending Approval
                            </div>
                            {existingReg.paymentProof ? (
                                <div style={{ marginTop: '0.8rem' }}>
                                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>Payment proof uploaded. Waiting for organizer to approve.</p>
                                    <img src={existingReg.paymentProof} alt="Payment proof" className="payment-proof-preview" />
                                </div>
                            ) : (
                                <div style={{ marginTop: '0.8rem' }}>
                                    <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Please upload your payment proof:</p>
                                    <input type="file" accept="image/*" className="form-input" onChange={handleProofFileChange} />
                                    {paymentProof && (
                                        <img src={paymentProof} alt="Preview" className="payment-proof-preview" />
                                    )}
                                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}
                                        onClick={handleUploadProof} disabled={uploading || !paymentProof}>
                                        {uploading ? 'Uploading...' : '📤 Upload Payment Proof'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : blockReason ? (
                        <div className="registration-status-box">
                            <div className="reg-status reg-closed">{blockReason}</div>
                        </div>
                    ) : user?.role === 'participant' ? (
                        <div className="registration-status-box">
                            <h3>{event.type === 'merchandise' ? 'Purchase' : 'Register'}</h3>

                            {/* Merchandise variant selector */}
                            {event.type === 'merchandise' && merchVariants.length > 0 && (
                                <div className="merch-selector">
                                    <label className="form-label">Select Variant</label>
                                    <select className="form-input" value={selectedVariant} onChange={(e) => setSelectedVariant(e.target.value)}>
                                        <option value="">— Choose —</option>
                                        {merchVariants.map((v) => (
                                            <option key={v._id} value={v._id} disabled={v.stock <= 0}>
                                                {v.label || `${v.size || ''} ${v.color || ''}`} — ₹{v.price} ({v.stock > 0 ? `${v.stock} left` : 'Out of stock'})
                                            </option>
                                        ))}
                                    </select>
                                    {event.merchandiseDetails?.purchaseLimit > 1 && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <label className="form-label">Quantity (max {event.merchandiseDetails.purchaseLimit})</label>
                                            <input type="number" className="form-input" min="1" max={event.merchandiseDetails.purchaseLimit}
                                                value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Custom form fields */}
                            {customFields.length > 0 && (
                                <div className="custom-form-section">
                                    <h4>Registration Form</h4>
                                    {customFields.map((field, idx) => (
                                        <div key={idx} className="form-group">
                                            <label className="form-label">
                                                {field.label} {field.required && <span className="required">*</span>}
                                            </label>
                                            {field.type === 'text' && (
                                                <input type="text" className="form-input"
                                                    value={formResponses[field.label] || ''}
                                                    onChange={(e) => handleFormChange(field.label, e.target.value)}
                                                    required={field.required} />
                                            )}
                                            {field.type === 'dropdown' && (
                                                <select className="form-input"
                                                    value={formResponses[field.label] || ''}
                                                    onChange={(e) => handleFormChange(field.label, e.target.value)}>
                                                    <option value="">— Select —</option>
                                                    {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            )}
                                            {field.type === 'checkbox' && (
                                                <label className="checkbox-label">
                                                    <input type="checkbox"
                                                        checked={formResponses[field.label] || false}
                                                        onChange={(e) => handleFormChange(field.label, e.target.checked)} />
                                                    {field.label}
                                                </label>
                                            )}
                                            {field.type === 'file' && (
                                                <input type="file" className="form-input"
                                                    onChange={(e) => handleFormChange(field.label, e.target.files[0]?.name || '')} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}
                                onClick={handleRegister} disabled={registering}>
                                {registering ? 'Processing...' : event.type === 'merchandise' ? `Place Order — ₹${merchVariants.find(v => v._id === selectedVariant)?.price || event.fee || 0}` : `Register${event.fee > 0 ? ` — ₹${event.fee}` : ''}`}
                            </button>
                        </div>
                    ) : (
                        <div className="registration-status-box">
                            <p className="text-muted">Login as a participant to register.</p>
                        </div>
                    )}

                    {/* Organizer info */}
                    <div className="detail-section" style={{ marginTop: '1rem' }}>
                        <h3>Organizer</h3>
                        <div className="detail-row"><strong>Name:</strong> {organizer.organizerName || 'N/A'}</div>
                        <div className="detail-row"><strong>Category:</strong> {organizer.category || 'N/A'}</div>
                        <div className="detail-row"><strong>Email:</strong> {organizer.email || 'N/A'}</div>
                        {organizer.description && <div className="detail-row"><strong>About:</strong> {organizer.description}</div>}
                    </div>
                </div>
            </div>

            {/* Discussion Forum — visible to registered participants */}
            {user?.role === 'participant' && (isRegistered || isPending) && (
                <div style={{ marginTop: '2rem' }}>
                    <DiscussionForum eventId={id} isOrganizer={false} />
                </div>
            )}

            {/* Anonymous Feedback — visible to participants who attended */}
            {user?.role === 'participant' && existingReg?.attended && (
                <div style={{ marginTop: '2rem' }}>
                    <FeedbackForm eventId={id} />
                </div>
            )}

            {/* Ticket viewer modal */}
            {showTicket && regResult && (
                <TicketViewer ticket={regResult} onClose={() => setShowTicket(false)} />
            )}
        </div>
    );
}
