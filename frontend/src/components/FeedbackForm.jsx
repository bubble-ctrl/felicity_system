import { useState, useEffect } from 'react';
import { feedbackAPI } from '../services/api';

/**
 * FeedbackForm — Anonymous star-rating + comment form for attended participants.
 * Shows previous submission if already submitted.
 */
const FeedbackForm = ({ eventId }) => {
    const [rating, setRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [existingFeedback, setExistingFeedback] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        checkExisting();
    }, [eventId]);

    const checkExisting = async () => {
        try {
            const { data } = await feedbackAPI.getMine(eventId);
            if (data.data.submitted) {
                setSubmitted(true);
                setExistingFeedback(data.data.feedback);
            }
        } catch (e) { /* ignore */ }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating < 1 || rating > 5) {
            setMessage({ type: 'error', text: 'Please select a rating (1-5 stars)' });
            return;
        }
        try {
            setSubmitting(true);
            const { data } = await feedbackAPI.submit(eventId, { rating, comment: comment.trim() });
            setSubmitted(true);
            setExistingFeedback({ rating, comment: comment.trim(), createdAt: new Date().toISOString() });
            setMessage({ type: 'success', text: data.message || 'Feedback submitted!' });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit feedback' });
        } finally { setSubmitting(false); }
    };

    if (loading) return null;

    const renderStars = (value, interactive = false) => (
        <div className="star-rating">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    className={`star ${star <= (interactive ? (hoveredStar || rating) : value) ? 'filled' : ''}`}
                    onClick={interactive ? () => setRating(star) : undefined}
                    onMouseEnter={interactive ? () => setHoveredStar(star) : undefined}
                    onMouseLeave={interactive ? () => setHoveredStar(0) : undefined}
                    disabled={!interactive}
                >
                    ★
                </button>
            ))}
        </div>
    );

    return (
        <div className="feedback-form-container">
            <h3>📝 Anonymous Feedback</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                Your feedback is completely anonymous — the organizer will never know who submitted it.
            </p>

            {message.text && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: '0.8rem' }}>{message.text}</div>
            )}

            {submitted && existingFeedback ? (
                <div className="feedback-submitted">
                    <div className="feedback-submitted-icon">✅</div>
                    <p><strong>Thank you for your feedback!</strong></p>
                    <div className="feedback-submitted-details">
                        <div>Your rating: {renderStars(existingFeedback.rating)}</div>
                        {existingFeedback.comment && (
                            <p className="feedback-submitted-comment">"{existingFeedback.comment}"</p>
                        )}
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                            Submitted {new Date(existingFeedback.createdAt).toLocaleString()}
                        </span>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="feedback-form">
                    <div className="form-group">
                        <label>Rating *</label>
                        {renderStars(rating, true)}
                        {rating > 0 && (
                            <span className="rating-label">
                                {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                            </span>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="fb-comment">Comments (optional)</label>
                        <textarea
                            id="fb-comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Share your experience..."
                            rows={3}
                            maxLength={2000}
                        />
                        <span className="char-count">{comment.length}/2000</span>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={submitting || rating < 1}>
                        {submitting ? 'Submitting...' : '📨 Submit Anonymous Feedback'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default FeedbackForm;
