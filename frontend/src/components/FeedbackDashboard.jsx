import { useState, useEffect, useCallback } from 'react';
import { feedbackAPI } from '../services/api';

/**
 * FeedbackDashboard — Organizer view of aggregated event feedback:
 * - Stats card with average rating, total count, distribution bar
 * - Filterable list of individual anonymous comments
 * - CSV export
 */
const FeedbackDashboard = ({ eventId }) => {
    const [stats, setStats] = useState(null);
    const [distribution, setDistribution] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    const [feedbacks, setFeedbacks] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
    const [filterRating, setFilterRating] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const { data } = await feedbackAPI.getStats(eventId);
            setStats(data.data.stats);
            setDistribution(data.data.ratingDistribution);
        } catch (e) { /* ignore */ }
    }, [eventId]);

    const fetchList = useCallback(async (page = 1) => {
        try {
            const params = { page, limit: 15 };
            if (filterRating) params.rating = filterRating;
            const { data } = await feedbackAPI.getList(eventId, params);
            setFeedbacks(data.data.feedbacks);
            setPagination(data.data.pagination);
        } catch (e) { /* ignore */ }
    }, [eventId, filterRating]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchStats(), fetchList()]);
            setLoading(false);
        };
        load();
    }, [fetchStats, fetchList]);

    const handleFilterChange = (r) => {
        setFilterRating(r);
    };

    const handleExportCSV = async () => {
        try {
            const params = {};
            if (filterRating) params.rating = filterRating;
            const response = await feedbackAPI.exportCSV(eventId, params);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `feedback_export.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) { alert('Failed to export CSV'); }
    };

    const renderStars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

    if (loading) return <div className="forum-loading">Loading feedback data...</div>;
    if (!stats || stats.totalCount === 0) {
        return (
            <div className="feedback-dashboard">
                <h3>📊 Feedback</h3>
                <div className="forum-empty">No feedback received yet.</div>
            </div>
        );
    }

    const maxDistCount = Math.max(...Object.values(distribution), 1);

    return (
        <div className="feedback-dashboard">
            <div className="feedback-dash-header">
                <h3>📊 Feedback Analytics</h3>
                <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>
                    📥 Export CSV
                </button>
            </div>

            {/* Stats Summary */}
            <div className="feedback-stats-grid">
                <div className="feedback-stat-card main-stat">
                    <div className="stat-avg-rating">{stats.averageRating}</div>
                    <div className="stat-avg-stars">{renderStars(Math.round(stats.averageRating))}</div>
                    <div className="stat-label">Average Rating</div>
                </div>
                <div className="feedback-stat-card">
                    <div className="stat-value">{stats.totalCount}</div>
                    <div className="stat-label">Total Responses</div>
                </div>
                <div className="feedback-stat-card">
                    <div className="stat-value">{stats.maxRating}★</div>
                    <div className="stat-label">Highest</div>
                </div>
                <div className="feedback-stat-card">
                    <div className="stat-value">{stats.minRating}★</div>
                    <div className="stat-label">Lowest</div>
                </div>
            </div>

            {/* Rating Distribution */}
            <div className="rating-distribution">
                <h4>Rating Distribution</h4>
                {[5, 4, 3, 2, 1].map((r) => (
                    <div key={r} className="distribution-row" onClick={() => handleFilterChange(filterRating === String(r) ? '' : String(r))}>
                        <span className="dist-label">{r}★</span>
                        <div className="dist-bar-bg">
                            <div
                                className="dist-bar-fill"
                                style={{ width: `${(distribution[r] / maxDistCount) * 100}%` }}
                            />
                        </div>
                        <span className="dist-count">{distribution[r]}</span>
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div className="feedback-filter-row">
                <span className="filter-label">Filter:</span>
                <div className="filter-tabs">
                    <button
                        className={`filter-tab ${filterRating === '' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('')}
                    >
                        All ({stats.totalCount})
                    </button>
                    {[5, 4, 3, 2, 1].map((r) => (
                        <button
                            key={r}
                            className={`filter-tab ${filterRating === String(r) ? 'active' : ''}`}
                            onClick={() => handleFilterChange(filterRating === String(r) ? '' : String(r))}
                        >
                            {r}★ ({distribution[r]})
                        </button>
                    ))}
                </div>
            </div>

            {/* Feedback List */}
            <div className="feedback-list">
                {feedbacks.length === 0 ? (
                    <div className="forum-empty">No feedback matches your filter.</div>
                ) : (
                    feedbacks.map((fb) => (
                        <div key={fb._id} className="feedback-item">
                            <div className="feedback-item-header">
                                <span className="feedback-stars">{renderStars(fb.rating)}</span>
                                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                                    {new Date(fb.createdAt).toLocaleString()}
                                </span>
                            </div>
                            {fb.comment && <p className="feedback-comment">{fb.comment}</p>}
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="feedback-pagination">
                    <button
                        className="btn btn-sm btn-outline"
                        disabled={pagination.page <= 1}
                        onClick={() => fetchList(pagination.page - 1)}
                    >
                        ← Prev
                    </button>
                    <span className="text-muted">
                        Page {pagination.page} of {pagination.pages}
                    </span>
                    <button
                        className="btn btn-sm btn-outline"
                        disabled={pagination.page >= pagination.pages}
                        onClick={() => fetchList(pagination.page + 1)}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

export default FeedbackDashboard;
