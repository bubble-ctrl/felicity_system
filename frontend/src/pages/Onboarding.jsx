import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI, organizerListAPI } from '../services/api';

/**
 * Onboarding — post-signup screen for participants to select interests and follow organizers.
 * Can be skipped to complete onboarding without selecting preferences.
 */
export default function Onboarding() {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1 = interests, 2 = follow organizers
    const [interests, setInterests] = useState([]);
    const [organizers, setOrganizers] = useState([]);
    const [followedIds, setFollowedIds] = useState([]);
    const [saving, setSaving] = useState(false);

    // Predefined interest categories
    const interestOptions = [
        'Technology', 'Music', 'Art', 'Sports', 'Gaming', 'Dance',
        'Photography', 'Literary', 'Quiz', 'Coding', 'Robotics',
        'Dramatics', 'Social Service', 'Finance', 'Design', 'Entrepreneurship',
    ];

    useEffect(() => {
        // Load organizers for step 2
        organizerListAPI.list().then(({ data }) => {
            setOrganizers(data.data.organizers);
        }).catch(() => { });
    }, []);

    const toggleInterest = (interest) => {
        setInterests((prev) =>
            prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
        );
    };

    const toggleFollow = (id) => {
        setFollowedIds((prev) =>
            prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await userAPI.updatePreferences({
                interests,
                followedClubs: followedIds,
                onboardingCompleted: true,
            });
            // Update local user state
            const updated = { ...user, onboardingCompleted: true };
            setUser(updated);
            localStorage.setItem('user', JSON.stringify(updated));
            navigate('/dashboard');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save preferences');
        } finally { setSaving(false); }
    };

    const handleSkip = async () => {
        try {
            setSaving(true);
            await userAPI.updatePreferences({ onboardingCompleted: true });
            const updated = { ...user, onboardingCompleted: true };
            setUser(updated);
            localStorage.setItem('user', JSON.stringify(updated));
            navigate('/dashboard');
        } catch (err) {
            navigate('/dashboard');
        }
    };

    return (
        <div className="main-content onboarding-page">
            <div className="onboarding-card">
                <h1>Welcome to Felicity! 🎉</h1>
                <p className="onboarding-subtitle">Let's personalize your experience</p>

                {/* Step indicator */}
                <div className="step-indicator">
                    <span className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</span>
                    <span className="step-line"></span>
                    <span className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</span>
                </div>

                {step === 1 && (
                    <div className="onboarding-step">
                        <h2>What are you interested in?</h2>
                        <p className="text-muted">Select topics to get personalized recommendations</p>
                        <div className="interest-chips">
                            {interestOptions.map((item) => (
                                <button key={item}
                                    className={`interest-chip ${interests.includes(item.toLowerCase()) ? 'selected' : ''}`}
                                    onClick={() => toggleInterest(item.toLowerCase())}>
                                    {item}
                                </button>
                            ))}
                        </div>
                        <div className="onboarding-actions">
                            <button className="btn btn-outline" onClick={handleSkip} disabled={saving}>Skip</button>
                            <button className="btn btn-primary" onClick={() => setStep(2)}>Next →</button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="onboarding-step">
                        <h2>Follow Clubs & Organizers</h2>
                        <p className="text-muted">Get updates on events from your favorite clubs</p>
                        {organizers.length === 0 ? (
                            <p className="empty-state-text">No organizers available yet.</p>
                        ) : (
                            <div className="organizer-follow-grid">
                                {organizers.map((org) => (
                                    <div key={org._id}
                                        className={`organizer-follow-card ${followedIds.includes(org._id) ? 'followed' : ''}`}
                                        onClick={() => toggleFollow(org._id)}>
                                        <h4>{org.organizerName}</h4>
                                        <span className="org-category">{org.category || 'Club'}</span>
                                        <span className="follow-indicator">
                                            {followedIds.includes(org._id) ? '✓ Following' : '+ Follow'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="onboarding-actions">
                            <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Get Started 🚀'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
