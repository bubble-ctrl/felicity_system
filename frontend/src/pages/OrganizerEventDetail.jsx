import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { organizerEventAPI } from '../services/api';
import DiscussionForum from '../components/DiscussionForum';
import FeedbackDashboard from '../components/FeedbackDashboard';

/**
 * OrganizerEventDetail — organizer's view of a single event with:
 * - Status transitions, edit/delete actions
 * - Analytics (registrations, attendance, revenue)
 * - Participants table with search, attendance marking, CSV export
 * - Payment Approvals tab (merchandise events)
 * - QR Scanner link
 */
export default function OrganizerEventDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [regSearch, setRegSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeSection, setActiveSection] = useState('participants'); // 'participants' | 'approvals'
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => { fetchData(); }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [eventRes, regRes] = await Promise.all([
                organizerEventAPI.getOne(id),
                organizerEventAPI.getRegistrations(id).catch(() => ({ data: { data: { registrations: [] } } })),
            ]);
            setEvent(eventRes.data.data.event);
            setRegistrations(regRes.data.data.registrations || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load event');
        } finally { setLoading(false); }
    };

    const handleTransition = async (action) => {
        try {
            await organizerEventAPI[action](id);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Action failed'); }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this draft event?')) return;
        try {
            await organizerEventAPI.delete(id);
            navigate('/organizer/events');
        } catch (err) { alert(err.response?.data?.message || 'Failed to delete'); }
    };

    const handleAttendance = async (regId) => {
        try {
            await organizerEventAPI.markAttendance(regId);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Failed to mark attendance'); }
    };

    const handleApprove = async (regId) => {
        try {
            setProcessingId(regId);
            await organizerEventAPI.approvePayment(regId);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Failed to approve'); }
        finally { setProcessingId(null); }
    };

    const handleReject = async (regId) => {
        if (!confirm('Reject this payment? The order will be cancelled.')) return;
        try {
            setProcessingId(regId);
            await organizerEventAPI.rejectPayment(regId);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Failed to reject'); }
        finally { setProcessingId(null); }
    };

    const handleExportCSV = async () => {
        try {
            const response = await organizerEventAPI.exportCSV(id);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${event.name || 'event'}_participants.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) { alert('Failed to export CSV'); }
    };

    if (loading) return <div className="main-content"><p className="loading-text">Loading...</p></div>;
    if (error) return <div className="main-content"><div className="alert alert-error">{error}</div></div>;
    if (!event) return <div className="main-content"><p>Event not found.</p></div>;

    // Filter registrations
    const filteredRegs = registrations.filter((r) => {
        if (activeSection === 'approvals') return r.status === 'pending_approval';
        // participants section: show approved (registered) + completed
        if (r.status !== 'registered' && r.status !== 'completed') return false;
        if (!regSearch) return true;
        const s = regSearch.toLowerCase();
        const name = `${r.userId?.firstName || ''} ${r.userId?.lastName || ''}`.toLowerCase();
        return name.includes(s) || (r.userId?.email || '').toLowerCase().includes(s) || (r.ticketId || '').toLowerCase().includes(s);
    });

    const pendingCount = registrations.filter((r) => r.status === 'pending_approval').length;

    // Status-based available actions
    const actions = [];
    if (event.status === 'draft') actions.push({ label: 'Publish', action: 'publish', cls: 'btn-primary' });
    if (event.status === 'published') {
        actions.push({ label: 'Start Event', action: 'start', cls: 'btn-primary' });
        actions.push({ label: 'Close Registrations', action: 'close', cls: 'btn-outline' });
    }
    if (event.status === 'ongoing') actions.push({ label: 'Close', action: 'close', cls: 'btn-outline' });
    if (event.status === 'closed') actions.push({ label: 'Complete', action: 'complete', cls: 'btn-primary' });

    return (
        <div className="main-content">
            <Link to="/organizer/events" className="back-link">← My Events</Link>

            {/* Status bar */}
            <div className="detail-actions-bar">
                <div>
                    <h2 style={{ margin: 0 }}>{event.name}</h2>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                        <span className="event-type-badge">{event.type}</span>
                        <span className={`status-badge status-${event.status}`}>{event.status}</span>
                    </div>
                </div>
                <div className="detail-btns">
                    {actions.map((a) => (
                        <button key={a.action} className={`btn btn-sm ${a.cls}`} onClick={() => handleTransition(a.action)}>{a.label}</button>
                    ))}
                    {['draft', 'published'].includes(event.status) && (
                        <Link to={`/organizer/events/${id}/edit`} className="btn btn-outline btn-sm">Edit</Link>
                    )}
                    {event.status === 'draft' && (
                        <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
                    )}
                </div>
            </div>

            {/* Analytics */}
            <div className="dashboard-grid" style={{ marginBottom: '1rem' }}>
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Registrations</div>
                    <div className="dashboard-card-value">{event.registrationCount || 0}</div>
                </div>
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Attendance</div>
                    <div className="dashboard-card-value">{event.attendanceCount || 0}</div>
                </div>
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Revenue</div>
                    <div className="dashboard-card-value">₹{event.revenue || 0}</div>
                </div>
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Views</div>
                    <div className="dashboard-card-value">{event.viewCount || 0}</div>
                </div>
            </div>

            {/* QR Scanner link */}
            {['published', 'ongoing', 'closed'].includes(event.status) && (
                <div style={{ marginBottom: '1rem' }}>
                    <Link to={`/organizer/events/${id}/scan`} className="btn btn-primary">
                        📷 Open QR Scanner
                    </Link>
                </div>
            )}

            {/* Event Details */}
            <div className="detail-grid">
                <div className="detail-section">
                    <h3>Event Info</h3>
                    <div className="detail-row"><strong>Eligibility:</strong> {event.eligibility === 'iiit' ? 'IIIT Only' : 'Open'}</div>
                    {event.fee > 0 && <div className="detail-row"><strong>Fee:</strong> ₹{event.fee}</div>}
                    {event.registrationLimit && <div className="detail-row"><strong>Limit:</strong> {event.registrationLimit}</div>}
                    {event.startDate && <div className="detail-row"><strong>Start:</strong> {new Date(event.startDate).toLocaleString()}</div>}
                    {event.endDate && <div className="detail-row"><strong>End:</strong> {new Date(event.endDate).toLocaleString()}</div>}
                    {event.registrationDeadline && <div className="detail-row"><strong>Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}</div>}
                </div>
                <div className="detail-section">
                    <h3>Description</h3>
                    <p className="detail-description">{event.description || 'No description provided.'}</p>
                    {event.tags?.length > 0 && (
                        <div className="event-tags" style={{ marginTop: '0.6rem' }}>
                            {event.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                        </div>
                    )}
                </div>
            </div>

            {/* Merchandise Variants */}
            {event.type === 'merchandise' && event.merchandiseDetails?.variants?.length > 0 && (
                <div className="detail-section" style={{ marginTop: '1rem' }}>
                    <h3>Merchandise Variants</h3>
                    <table className="participants-table">
                        <thead>
                            <tr><th>Label</th><th>Size</th><th>Color</th><th>Stock</th><th>Price</th></tr>
                        </thead>
                        <tbody>
                            {event.merchandiseDetails.variants.map((v) => (
                                <tr key={v._id}><td>{v.label}</td><td>{v.size}</td><td>{v.color}</td><td>{v.stock}</td><td>₹{v.price}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tabs: Participants vs Payment Approvals */}
            <div className="detail-section" style={{ marginTop: '1rem' }}>
                <div className="filter-tabs" style={{ marginBottom: '0.8rem' }}>
                    <button className={`filter-tab ${activeSection === 'participants' ? 'active' : ''}`}
                        onClick={() => setActiveSection('participants')}>
                        👥 Participants ({registrations.filter(r => r.status === 'registered').length})
                    </button>
                    {event.type === 'merchandise' && (
                        <button className={`filter-tab ${activeSection === 'approvals' ? 'active' : ''}`}
                            onClick={() => setActiveSection('approvals')}>
                            ⏳ Payment Approvals {pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
                        </button>
                    )}
                    <button className={`filter-tab ${activeSection === 'discussion' ? 'active' : ''}`}
                        onClick={() => setActiveSection('discussion')}>
                        💬 Discussion
                    </button>
                    <button className={`filter-tab ${activeSection === 'feedback' ? 'active' : ''}`}
                        onClick={() => setActiveSection('feedback')}>
                        📊 Feedback
                    </button>
                    <button className={`filter-tab ${activeSection === 'attendance' ? 'active' : ''}`}
                        onClick={() => setActiveSection('attendance')}>
                        📋 Attendance ({registrations.filter(r => r.status === 'registered' && r.attended).length}/{registrations.filter(r => r.status === 'registered').length})
                    </button>
                </div>

                {activeSection === 'participants' && (
                    <>
                        <div className="participants-header">
                            <div className="participants-actions">
                                <input className="search-input" style={{ maxWidth: '250px' }} placeholder="Search name / email / ticket..."
                                    value={regSearch} onChange={(e) => setRegSearch(e.target.value)} />
                                <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>📥 Export CSV</button>
                            </div>
                        </div>
                        {filteredRegs.length === 0 ? (
                            <p className="text-muted" style={{ marginTop: '0.8rem' }}>No participants found.</p>
                        ) : (
                            <table className="participants-table">
                                <thead>
                                    <tr>
                                        <th>Name</th><th>Email</th><th>Type</th><th>Ticket ID</th>
                                        <th>Attended</th><th>Registered</th><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRegs.map((r) => (
                                        <tr key={r._id}>
                                            <td>{r.userId?.firstName} {r.userId?.lastName}</td>
                                            <td>{r.userId?.email}</td>
                                            <td>{r.userId?.participantType}</td>
                                            <td><code>{r.ticketId}</code></td>
                                            <td>{r.attended ? `✅ ${new Date(r.attendedAt).toLocaleTimeString()}` : '—'}</td>
                                            <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                {!r.attended && r.status === 'registered' && (
                                                    <button className="btn btn-primary btn-sm" onClick={() => handleAttendance(r._id)}>Mark Present</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}

                {activeSection === 'approvals' && (
                    <>
                        {filteredRegs.length === 0 ? (
                            <p className="text-muted">No pending orders.</p>
                        ) : (
                            <div className="approval-cards">
                                {filteredRegs.map((r) => (
                                    <div key={r._id} className="approval-card">
                                        <div className="approval-card-header">
                                            <div>
                                                <strong>{r.userId?.firstName} {r.userId?.lastName}</strong>
                                                <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>{r.userId?.email}</span>
                                            </div>
                                            <span className="status-badge status-pending_approval">Pending</span>
                                        </div>
                                        <div className="approval-card-body">
                                            <div className="approval-info">
                                                <span>Ticket: <code>{r.ticketId}</code></span>
                                                {r.merchandiseVariant && (
                                                    <span>Qty: {r.merchandiseVariant.quantity || 1}</span>
                                                )}
                                                <span>Ordered: {new Date(r.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            {r.paymentProof ? (
                                                <div className="payment-proof-section">
                                                    <p style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}><strong>Payment Proof:</strong></p>
                                                    <img src={r.paymentProof} alt="Payment proof" className="payment-proof-img"
                                                        onClick={() => window.open(r.paymentProof, '_blank')} />
                                                </div>
                                            ) : (
                                                <p className="text-muted" style={{ fontSize: '0.85rem' }}>⚠️ No payment proof uploaded yet</p>
                                            )}
                                        </div>
                                        <div className="approval-card-actions">
                                            <button className="btn btn-primary btn-sm"
                                                onClick={() => handleApprove(r._id)}
                                                disabled={processingId === r._id}>
                                                {processingId === r._id ? 'Processing...' : '✅ Approve'}
                                            </button>
                                            <button className="btn btn-danger btn-sm"
                                                onClick={() => handleReject(r._id)}
                                                disabled={processingId === r._id}>
                                                ❌ Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeSection === 'discussion' && (
                    <DiscussionForum eventId={id} isOrganizer={true} />
                )}

                {activeSection === 'feedback' && (
                    <FeedbackDashboard eventId={id} />
                )}

                {activeSection === 'attendance' && (() => {
                    const registered = registrations.filter(r => r.status === 'registered');
                    const attended = registered.filter(r => r.attended);
                    const notAttended = registered.filter(r => !r.attended);
                    return (
                        <div>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ padding: '0.8rem 1.2rem', background: 'rgba(0,206,201,0.1)', borderRadius: '10px', flex: 1, minWidth: '140px' }}>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#00cec9' }}>{attended.length}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#999' }}>Attended</div>
                                </div>
                                <div style={{ padding: '0.8rem 1.2rem', background: 'rgba(253,121,168,0.1)', borderRadius: '10px', flex: 1, minWidth: '140px' }}>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fd79a8' }}>{notAttended.length}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#999' }}>Not Yet Attended</div>
                                </div>
                            </div>

                            {notAttended.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ marginBottom: '0.5rem', color: '#fd79a8' }}>⚠️ Not Yet Attended ({notAttended.length})</h4>
                                    <table className="participants-table">
                                        <thead><tr><th>Name</th><th>Email</th><th>Ticket ID</th><th>Registered</th><th>Action</th></tr></thead>
                                        <tbody>
                                            {notAttended.map(r => (
                                                <tr key={r._id}>
                                                    <td>{r.userId?.firstName} {r.userId?.lastName}</td>
                                                    <td>{r.userId?.email}</td>
                                                    <td><code>{r.ticketId}</code></td>
                                                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                                                    <td><button className="btn btn-primary btn-sm" onClick={() => handleAttendance(r._id)}>Mark Present</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {attended.length > 0 && (
                                <div>
                                    <h4 style={{ marginBottom: '0.5rem', color: '#00cec9' }}>✅ Attended ({attended.length})</h4>
                                    <table className="participants-table">
                                        <thead><tr><th>Name</th><th>Email</th><th>Ticket ID</th><th>Checked In</th></tr></thead>
                                        <tbody>
                                            {attended.map(r => (
                                                <tr key={r._id}>
                                                    <td>{r.userId?.firstName} {r.userId?.lastName}</td>
                                                    <td>{r.userId?.email}</td>
                                                    <td><code>{r.ticketId}</code></td>
                                                    <td>✅ {new Date(r.attendedAt).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
