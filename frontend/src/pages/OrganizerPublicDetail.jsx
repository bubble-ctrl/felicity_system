import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { organizerListAPI, userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * OrganizerPublicDetail — public page showing organizer info + upcoming/past events
 */
export default function OrganizerPublicDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const [organizer, setOrganizer] = useState(null);
    const [upcoming, setUpcoming] = useState([]);
    const [past, setPast] = useState([]);
    const [followed, setFollowed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data } = await organizerListAPI.getDetail(id);
                setOrganizer(data.data.organizer);
                setUpcoming(data.data.upcoming);
                setPast(data.data.past);
                // Check if user follows this organizer
                if (user?.role === 'participant') {
                    const prefRes = await userAPI.getPreferences();
                    const followedClubs = (prefRes.data.data.preferences.followedClubs || []).map((c) => c._id || c);
                    setFollowed(followedClubs.includes(id));
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load organizer');
            } finally { setLoading(false); }
        };
        fetchData();
    }, [id]);

    const handleFollow = async () => {
        try {
            if (followed) {
                await userAPI.unfollowOrganizer(id);
                setFollowed(false);
            } else {
                await userAPI.followOrganizer(id);
                setFollowed(true);
            }
        } catch (err) { alert(err.response?.data?.message || 'Action failed'); }
    };

    if (loading) return <div className="main-content"><p className="loading-text">Loading...</p></div>;
    if (error) return <div className="main-content"><div className="alert alert-error">{error}</div></div>;
    if (!organizer) return <div className="main-content"><p>Organizer not found.</p></div>;

    const renderEventCards = (events, emptyMsg) => {
        if (events.length === 0) return <p className="text-muted">{emptyMsg}</p>;
        return (
            <div className="event-cards-grid">
                {events.map((e) => (
                    <Link key={e._id} to={`/events/${e._id}`} className="event-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="event-card-header">
                            <span className="event-card-title">{e.name}</span>
                            <span className="event-type-badge">{e.type}</span>
                            <span className={`status-badge status-${e.status}`}>{e.status}</span>
                        </div>
                        <div className="event-card-meta">
                            {e.startDate && <span>📅 {new Date(e.startDate).toLocaleDateString()}</span>}
                            {e.fee > 0 && <span>💰 ₹{e.fee}</span>}
                            <span>{e.eligibility === 'iiit' ? '🔒 IIIT Only' : '🌐 Open'}</span>
                        </div>
                    </Link>
                ))}
            </div>
        );
    };

    return (
        <div className="main-content">
            <Link to="/clubs" className="back-link">← All Organizers</Link>

            <div className="org-detail-hero">
                <div className="org-detail-info">
                    <h1>{organizer.organizerName}</h1>
                    <span className="org-category-badge">{organizer.category || 'Club'}</span>
                    {organizer.description && <p className="org-detail-desc">{organizer.description}</p>}
                    <p className="org-detail-email">📧 {organizer.contactEmail || organizer.email}</p>
                    {organizer.contactNumber && <p className="org-detail-email">📞 {organizer.contactNumber}</p>}
                </div>
                {user?.role === 'participant' && (
                    <button className={`btn ${followed ? 'btn-outline' : 'btn-primary'}`} onClick={handleFollow}>
                        {followed ? 'Unfollow' : 'Follow'}
                    </button>
                )}
            </div>

            <div className="detail-section" style={{ marginBottom: '1rem' }}>
                <h3>Upcoming Events</h3>
                {renderEventCards(upcoming, 'No upcoming events')}
            </div>

            <div className="detail-section">
                <h3>Past Events</h3>
                {renderEventCards(past, 'No past events')}
            </div>
        </div>
    );
}
