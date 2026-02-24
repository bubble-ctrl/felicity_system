import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { publicEventAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * BrowseEvents — participant page with search, filters, trending, pagination.
 * Supports: fuzzy search, type/eligibility/sort filters, followed-only toggle.
 */
export default function BrowseEvents() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [trending, setTrending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);

    // Filter state
    const [search, setSearch] = useState('');
    const [type, setType] = useState('');
    const [eligibility, setEligibility] = useState('');
    const [sort, setSort] = useState('recommended');
    const [followedOnly, setFollowedOnly] = useState(false);
    const [startFrom, setStartFrom] = useState('');
    const [startTo, setStartTo] = useState('');
    const [page, setPage] = useState(1);

    // Prevent double fetch from StrictMode
    const trendingFetched = useRef(false);

    useEffect(() => {
        if (trendingFetched.current) return;
        trendingFetched.current = true;
        publicEventAPI.trending().then(({ data }) => setTrending(data.data.events)).catch(() => { });
    }, []);

    useEffect(() => { fetchEvents(); }, [search, type, eligibility, sort, followedOnly, startFrom, startTo, page]);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const params = { page, limit: 12, sort };
            if (search) params.search = search;
            if (type) params.type = type;
            if (eligibility) params.eligibility = eligibility;
            if (followedOnly) params.followedOnly = 'true';
            if (startFrom) params.startFrom = startFrom;
            if (startTo) params.startTo = startTo;

            const { data } = await publicEventAPI.browse(params);
            setEvents(data.data.events);
            setTotal(data.total);
            setPages(data.pages);
        } catch (err) {
            console.error(err);
        } finally { setLoading(false); }
    };

    // Debounced search
    const searchTimerRef = useRef(null);
    const [searchInput, setSearchInput] = useState('');
    const handleSearch = (val) => {
        setSearchInput(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
    };

    return (
        <div className="main-content">
            <div className="page-header">
                <h1>Browse Events</h1>
            </div>

            {/* Trending */}
            {trending.length > 0 && (
                <div className="trending-section">
                    <h2>🔥 Trending Events</h2>
                    <div className="trending-cards">
                        {trending.map((e) => (
                            <Link key={e._id} to={`/events/${e._id}`} className="trending-card">
                                <h4>{e.name}</h4>
                                {e.organizerId?.organizerName && <span className="trending-org">{e.organizerId.organizerName}</span>}
                                <span className="trending-views">{e.viewCount} views</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Search + Filters */}
            <div className="search-filters-bar">
                <input className="search-input" placeholder="Search events or organizers..."
                    value={searchInput}
                    onChange={(e) => handleSearch(e.target.value)} />
                <div className="filter-group">
                    <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                        <option value="">All Types</option>
                        <option value="normal">Normal</option>
                        <option value="merchandise">Merchandise</option>
                    </select>
                    <select value={eligibility} onChange={(e) => { setEligibility(e.target.value); setPage(1); }}>
                        <option value="">All Eligibility</option>
                        <option value="open">Open to All</option>
                        <option value="iiit">IIIT Only</option>
                    </select>
                    <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                        <option value="recommended">Recommended</option>
                        <option value="startDate">Date (Earliest)</option>
                        <option value="-startDate">Date (Latest)</option>
                        <option value="popular">Most Popular</option>
                        <option value="newest">Newest</option>
                    </select>
                    {user?.role === 'participant' && (
                        <label className="checkbox-label" style={{ whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={followedOnly} onChange={(e) => { setFollowedOnly(e.target.checked); setPage(1); }} />
                            Followed Clubs Only
                        </label>
                    )}
                    <input type="date" className="form-input" style={{ maxWidth: '160px' }}
                        value={startFrom} onChange={(e) => { setStartFrom(e.target.value); setPage(1); }}
                        title="Events starting from" placeholder="From date" />
                    <input type="date" className="form-input" style={{ maxWidth: '160px' }}
                        value={startTo} onChange={(e) => { setStartTo(e.target.value); setPage(1); }}
                        title="Events starting until" placeholder="To date" />
                </div>
            </div>

            {/* Events grid */}
            {loading ? (
                <p className="loading-text">Loading events...</p>
            ) : events.length === 0 ? (
                <div className="empty-state"><p>No events found matching your criteria.</p></div>
            ) : (
                <>
                    <div className="event-cards-grid">
                        {events.map((e) => (
                            <Link key={e._id} to={`/events/${e._id}`} className="event-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div className="event-card-header">
                                    <span className="event-card-title">{e.name}</span>
                                    <span className="event-type-badge">{e.type}</span>
                                </div>
                                {e.organizerId?.organizerName && (
                                    <span className="event-org-name">by {e.organizerId.organizerName}</span>
                                )}
                                {e.description && <p className="event-card-desc">{e.description.slice(0, 120)}{e.description.length > 120 ? '...' : ''}</p>}
                                <div className="event-card-meta">
                                    {e.startDate && <span>📅 {new Date(e.startDate).toLocaleDateString()}</span>}
                                    {e.fee > 0 && <span>💰 ₹{e.fee}</span>}
                                    <span>{e.eligibility === 'iiit' ? '🔒 IIIT' : '🌐 Open'}</span>
                                    <span>👁 {e.viewCount || 0}</span>
                                </div>
                                {e.tags?.length > 0 && (
                                    <div className="event-tags">
                                        {e.tags.slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>

                    {/* Pagination */}
                    {pages > 1 && (
                        <div className="pagination">
                            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                            <span className="page-info">Page {page} of {pages} ({total} events)</span>
                            <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
