import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { organizerEventAPI } from '../services/api';

const STATUS_ORDER = ['draft', 'published', 'ongoing', 'closed', 'completed'];
const STATUS_COLORS = {
    draft: 'status-draft', published: 'status-active',
    ongoing: 'status-ongoing', closed: 'status-disabled', completed: 'status-completed',
};

const OrganizerEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [searchParams] = useSearchParams();
    const [filter, setFilter] = useState(searchParams.get('filter') || 'all');

    useEffect(() => { fetchEvents(); }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const res = await organizerEventAPI.getAll();
            setEvents(res.data.data.events);
        } catch { setMessage({ type: 'error', text: 'Failed to load events' }); }
        finally { setLoading(false); }
    };

    const showMsg = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete draft "${name}"?`)) return;
        try {
            await organizerEventAPI.delete(id);
            showMsg('success', 'Draft deleted');
            fetchEvents();
        } catch (err) { showMsg('error', err.response?.data?.message || 'Delete failed'); }
    };

    const filtered = filter === 'all' ? events : events.filter((e) => e.status === filter);

    const stats = {
        total: events.length,
        draft: events.filter((e) => e.status === 'draft').length,
        published: events.filter((e) => e.status === 'published').length,
        ongoing: events.filter((e) => e.status === 'ongoing').length,
    };

    return (
        <div className="org-events-page">
            <div className="page-header">
                <div>
                    <h1>My Events</h1>
                    <p className="page-subtitle">Create and manage your events</p>
                </div>
                <Link to="/organizer/events/new" className="btn btn-primary">+ Create Event</Link>
            </div>

            {message.text && <div className={`alert alert-${message.type}`}>{message.text}</div>}

            {/* Stats */}
            <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="dashboard-card"><div className="card-icon">📊</div><h3>Total</h3><p className="card-stat">{stats.total}</p></div>
                <div className="dashboard-card"><div className="card-icon">📝</div><h3>Drafts</h3><p className="card-stat">{stats.draft}</p></div>
                <div className="dashboard-card"><div className="card-icon">🟢</div><h3>Published</h3><p className="card-stat">{stats.published}</p></div>
                <div className="dashboard-card"><div className="card-icon">🔴</div><h3>Ongoing</h3><p className="card-stat">{stats.ongoing}</p></div>
            </div>

            {/* Filter tabs */}
            <div className="filter-tabs">
                {['all', ...STATUS_ORDER].map((s) => (
                    <button key={s} className={`filter-tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="loading-screen" style={{ height: 'auto', padding: '3rem' }}>Loading events...</div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <p>{filter === 'all' ? '🎪 No events yet. Create your first event!' : `No ${filter} events.`}</p>
                </div>
            ) : (
                <div className="event-cards-grid">
                    {filtered.map((event) => (
                        <div key={event._id} className="event-card">
                            <div className="event-card-header">
                                <span className={`status-badge ${STATUS_COLORS[event.status]}`}>{event.status}</span>
                                <span className="event-type-badge">{event.type}</span>
                            </div>
                            <h3 className="event-card-title">{event.name}</h3>
                            <p className="event-card-desc">{event.description?.slice(0, 100) || 'No description'}{event.description?.length > 100 ? '...' : ''}</p>
                            <div className="event-card-meta">
                                {event.startDate && <span>📅 {new Date(event.startDate).toLocaleDateString()}</span>}
                                <span>💰 {event.fee > 0 ? `₹${event.fee}` : 'Free'}</span>
                                {event.eligibility && <span>🎯 {event.eligibility.toUpperCase()}</span>}
                            </div>
                            {event.tags?.length > 0 && (
                                <div className="event-tags">
                                    {event.tags.slice(0, 3).map((t) => <span key={t} className="tag">{t}</span>)}
                                </div>
                            )}
                            <div className="event-card-actions">
                                <Link to={`/organizer/events/${event._id}`} className="btn btn-sm btn-secondary">View</Link>
                                {event.status === 'draft' && (
                                    <>
                                        <Link to={`/organizer/events/${event._id}/edit`} className="btn btn-sm btn-secondary">✏️ Edit</Link>
                                        <button onClick={() => handleDelete(event._id, event.name)} className="btn btn-sm btn-danger">🗑️</button>
                                    </>
                                )}
                                {event.status === 'published' && (
                                    <Link to={`/organizer/events/${event._id}/edit`} className="btn btn-sm btn-secondary">✏️ Edit</Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrganizerEvents;
