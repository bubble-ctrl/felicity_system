import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { organizerListAPI, userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * OrganizerListing — public page listing all active organizers with follow/unfollow
 */
export default function OrganizerListing() {
    const { user } = useAuth();
    const [organizers, setOrganizers] = useState([]);
    const [followedIds, setFollowedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [orgRes, prefRes] = await Promise.all([
                    organizerListAPI.list(),
                    user?.role === 'participant' ? userAPI.getPreferences() : Promise.resolve(null),
                ]);
                setOrganizers(orgRes.data.data.organizers);
                if (prefRes) {
                    setFollowedIds((prefRes.data.data.preferences.followedClubs || []).map((c) => c._id || c));
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load organizers');
            } finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const handleFollow = async (orgId) => {
        try {
            if (followedIds.includes(orgId)) {
                await userAPI.unfollowOrganizer(orgId);
                setFollowedIds((prev) => prev.filter((id) => id !== orgId));
            } else {
                await userAPI.followOrganizer(orgId);
                setFollowedIds((prev) => [...prev, orgId]);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Action failed');
        }
    };

    if (loading) return <div className="main-content"><p className="loading-text">Loading organizers...</p></div>;

    return (
        <div className="main-content">
            <div className="page-header">
                <h1>Clubs & Organizers</h1>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {organizers.length === 0 ? (
                <div className="empty-state"><p>No organizers registered yet.</p></div>
            ) : (
                <div className="organizer-listing-grid">
                    {organizers.map((org) => (
                        <div key={org._id} className="organizer-card">
                            <Link to={`/clubs/${org._id}`} className="org-card-link">
                                <h3>{org.organizerName}</h3>
                                <span className="org-category-badge">{org.category || 'Club'}</span>
                                {org.description && <p className="org-desc">{org.description}</p>}
                                <span className="org-email">{org.email}</span>
                            </Link>
                            {user?.role === 'participant' && (
                                <button
                                    className={`btn btn-sm ${followedIds.includes(org._id) ? 'btn-outline' : 'btn-primary'}`}
                                    onClick={() => handleFollow(org._id)}>
                                    {followedIds.includes(org._id) ? 'Unfollow' : 'Follow'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
