import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI, organizerListAPI } from '../services/api';

const Profile = () => {
    const { user, setUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        contactNumber: '',
        collegeOrOrg: '',
        organizerName: '',
        category: '',
        description: '',
        contactEmail: '',
        discordWebhookUrl: '',
    });

    // Password change state (participant)
    const [pwData, setPwData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwLoading, setPwLoading] = useState(false);

    // Interests/followed clubs state (participant)
    const [interests, setInterests] = useState([]);
    const [followedClubs, setFollowedClubs] = useState([]);
    const [organizers, setOrganizers] = useState([]);
    const [prefLoading, setPrefLoading] = useState(false);

    const interestOptions = [
        'Technology', 'Music', 'Art', 'Sports', 'Gaming', 'Dance',
        'Photography', 'Literary', 'Quiz', 'Coding', 'Robotics',
        'Dramatics', 'Social Service', 'Finance', 'Design', 'Entrepreneurship',
    ];

    // Password reset request state (organizer only)
    const [resetReason, setResetReason] = useState('');
    const [resetRequests, setResetRequests] = useState([]);
    const [resetLoading, setResetLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                contactNumber: user.contactNumber || '',
                collegeOrOrg: user.collegeOrOrg || '',
                organizerName: user.organizerName || '',
                category: user.category || '',
                description: user.description || '',
                contactEmail: user.contactEmail || '',
                discordWebhookUrl: user.discordWebhookUrl || '',
            });
            if (user.role === 'organizer') fetchResetRequests();
            if (user.role === 'participant') {
                setInterests(user.interests || []);
                setFollowedClubs(user.followedClubs?.map(c => typeof c === 'object' ? c._id : c) || []);
                organizerListAPI.list().then(({ data }) => setOrganizers(data.data.organizers)).catch(() => { });
            }
        }
    }, [user]);

    const fetchResetRequests = async () => {
        try {
            const { data } = await userAPI.getMyResetRequests();
            setResetRequests(data.data.requests);
        } catch (e) { /* ignore */ }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = { firstName: formData.firstName, lastName: formData.lastName, contactNumber: formData.contactNumber, collegeOrOrg: formData.collegeOrOrg };
            if (user.role === 'organizer') {
                payload.organizerName = formData.organizerName;
                payload.category = formData.category;
                payload.description = formData.description;
                payload.contactEmail = formData.contactEmail;
                payload.discordWebhookUrl = formData.discordWebhookUrl;
            }
            const res = await userAPI.updateProfile(payload);
            setUser(res.data.data.user);
            showMessage('success', 'Profile updated successfully!');
        } catch (err) {
            showMessage('error', err.response?.data?.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    // --- Password change (participant) ---
    const handlePasswordChange = async () => {
        if (!pwData.currentPassword || !pwData.newPassword) {
            showMessage('error', 'Please fill in all password fields');
            return;
        }
        if (pwData.newPassword.length < 6) {
            showMessage('error', 'New password must be at least 6 characters');
            return;
        }
        if (pwData.newPassword !== pwData.confirmPassword) {
            showMessage('error', 'New passwords do not match');
            return;
        }
        try {
            setPwLoading(true);
            await userAPI.changePassword({ currentPassword: pwData.currentPassword, newPassword: pwData.newPassword });
            showMessage('success', 'Password changed successfully!');
            setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            showMessage('error', err.response?.data?.message || 'Failed to change password');
        } finally { setPwLoading(false); }
    };

    // --- Preferences (participant) ---
    const toggleInterest = (interest) => {
        setInterests((prev) => prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]);
    };

    const toggleFollow = (id) => {
        setFollowedClubs((prev) => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
    };

    const handleSavePreferences = async () => {
        try {
            setPrefLoading(true);
            await userAPI.updatePreferences({ interests, followedClubs });
            const updated = { ...user, interests, followedClubs };
            setUser(updated);
            localStorage.setItem('user', JSON.stringify(updated));
            showMessage('success', 'Preferences saved!');
        } catch (err) {
            showMessage('error', err.response?.data?.message || 'Failed to save preferences');
        } finally { setPrefLoading(false); }
    };

    // --- Organizer password reset request ---
    const handleResetRequest = async () => {
        if (!resetReason.trim()) {
            showMessage('error', 'Please provide a reason for the password reset');
            return;
        }
        try {
            setResetLoading(true);
            await userAPI.requestPasswordReset({ reason: resetReason.trim() });
            showMessage('success', 'Password reset request submitted! Admin will review it shortly.');
            setResetReason('');
            fetchResetRequests();
        } catch (err) {
            showMessage('error', err.response?.data?.message || 'Failed to submit request');
        } finally { setResetLoading(false); }
    };

    if (!user) return null;

    const hasPendingReset = resetRequests.some((r) => r.status === 'pending');

    return (
        <div className="profile-page">
            <div className="page-header">
                <div>
                    <h1>My Profile</h1>
                    <p className="page-subtitle">View and edit your account details</p>
                </div>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>{message.text}</div>
            )}

            <div className="profile-card">
                <div className="profile-badge-row">
                    <span className="user-role-badge">{user.role}</span>
                    {user.participantType && (
                        <span className="user-type-badge">{user.participantType.toUpperCase()}</span>
                    )}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="firstName">First Name</label>
                            <input id="firstName" name="firstName" type="text" value={formData.firstName} onChange={handleChange} placeholder="First name" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="lastName">Last Name</label>
                            <input id="lastName" name="lastName" type="text" value={formData.lastName} onChange={handleChange} placeholder="Last name" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email <span className="hint">(read-only)</span></label>
                        <input type="email" value={user.email} disabled className="input-disabled" />
                    </div>

                    {user.participantType && (
                        <div className="form-group">
                            <label>Participant Type <span className="hint">(read-only)</span></label>
                            <input type="text" value={user.participantType === 'iiit' ? 'IIIT Student' : 'Non-IIIT Participant'} disabled className="input-disabled" />
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="contactNumber">Contact Number</label>
                            <input id="contactNumber" name="contactNumber" type="tel" value={formData.contactNumber} onChange={handleChange} placeholder="9876543210" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="collegeOrOrg">College / Organization</label>
                            <input id="collegeOrOrg" name="collegeOrOrg" type="text" value={formData.collegeOrOrg} onChange={handleChange} placeholder="e.g. IIIT Hyderabad" />
                        </div>
                    </div>

                    {user.role === 'organizer' && (
                        <>
                            <hr className="form-divider" />
                            <h3 className="form-section-title">Organization Details</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="organizerName">Organizer Name</label>
                                    <input id="organizerName" name="organizerName" type="text" value={formData.organizerName} onChange={handleChange} placeholder="Club / Org name" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="category">Category</label>
                                    <input id="category" name="category" type="text" value={formData.category} onChange={handleChange} placeholder="e.g. Technical, Cultural" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="description">Description</label>
                                <textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="About your organization..." rows={3} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="contactEmail">Contact Email</label>
                                <input id="contactEmail" name="contactEmail" type="email" value={formData.contactEmail} onChange={handleChange} placeholder="contact@example.com" />
                                <span className="hint" style={{ fontSize: '0.8rem' }}>Public contact email (different from login email)</span>
                            </div>
                            <div className="form-group">
                                <label htmlFor="discordWebhookUrl">Discord Webhook URL</label>
                                <input id="discordWebhookUrl" name="discordWebhookUrl" type="url" value={formData.discordWebhookUrl} onChange={handleChange} placeholder="https://discord.com/api/webhooks/..." />
                                <span className="hint" style={{ fontSize: '0.8rem' }}>Auto-post new events to your Discord channel</span>
                            </div>
                        </>
                    )}

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>
            </div>

            {/* Interests & Followed Clubs — Participant Only */}
            {user.role === 'participant' && (
                <div className="profile-card" style={{ marginTop: '1.5rem' }}>
                    <h3 className="form-section-title">🎯 Interests</h3>
                    <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.8rem' }}>
                        Select topics to get personalized event recommendations
                    </p>
                    <div className="interest-chips">
                        {interestOptions.map((item) => (
                            <button key={item}
                                className={`interest-chip ${interests.includes(item.toLowerCase()) ? 'selected' : ''}`}
                                onClick={() => toggleInterest(item.toLowerCase())}
                                type="button">
                                {item}
                            </button>
                        ))}
                    </div>

                    <hr className="form-divider" />
                    <h3 className="form-section-title">🏢 Followed Clubs</h3>
                    <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.8rem' }}>
                        Follow clubs to see their events first
                    </p>
                    {organizers.length === 0 ? (
                        <p className="text-muted">No organizers available yet.</p>
                    ) : (
                        <div className="organizer-follow-grid">
                            {organizers.map((org) => (
                                <div key={org._id}
                                    className={`organizer-follow-card ${followedClubs.includes(org._id) ? 'followed' : ''}`}
                                    onClick={() => toggleFollow(org._id)}>
                                    <h4>{org.organizerName}</h4>
                                    <span className="org-category">{org.category || 'Club'}</span>
                                    <span className="follow-indicator">
                                        {followedClubs.includes(org._id) ? '✓ Following' : '+ Follow'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={handleSavePreferences} disabled={prefLoading}>
                        {prefLoading ? 'Saving...' : 'Save Preferences'}
                    </button>
                </div>
            )}

            {/* Password Change — Participant Only */}
            {user.role === 'participant' && (
                <div className="profile-card" style={{ marginTop: '1.5rem' }}>
                    <h3 className="form-section-title">🔐 Change Password</h3>
                    <div className="form-group">
                        <label>Current Password</label>
                        <input type="password" value={pwData.currentPassword}
                            onChange={(e) => setPwData({ ...pwData, currentPassword: e.target.value })}
                            placeholder="Enter current password" />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>New Password</label>
                            <input type="password" value={pwData.newPassword}
                                onChange={(e) => setPwData({ ...pwData, newPassword: e.target.value })}
                                placeholder="Min 6 characters" />
                        </div>
                        <div className="form-group">
                            <label>Confirm New Password</label>
                            <input type="password" value={pwData.confirmPassword}
                                onChange={(e) => setPwData({ ...pwData, confirmPassword: e.target.value })}
                                placeholder="Confirm new password" />
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={handlePasswordChange} disabled={pwLoading}>
                        {pwLoading ? 'Changing...' : 'Change Password'}
                    </button>
                </div>
            )}

            {/* Password Reset Request — Organizer Only */}
            {user.role === 'organizer' && (
                <div className="profile-card" style={{ marginTop: '1.5rem' }}>
                    <h3 className="form-section-title">🔐 Password Reset</h3>
                    <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Request a password reset from the admin. You'll receive new credentials once approved.
                    </p>

                    {hasPendingReset ? (
                        <div className="alert alert-info" style={{ background: 'rgba(116,185,255,0.1)', color: 'var(--primary)' }}>
                            ⏳ You have a pending password reset request. Please wait for admin to process it.
                        </div>
                    ) : (
                        <div>
                            <div className="form-group">
                                <label>Reason for Password Reset</label>
                                <textarea
                                    value={resetReason}
                                    onChange={(e) => setResetReason(e.target.value)}
                                    placeholder="e.g. Forgot my password, need a new one..."
                                    rows={2}
                                    maxLength={500}
                                />
                            </div>
                            <button className="btn btn-primary" onClick={handleResetRequest} disabled={resetLoading || !resetReason.trim()}>
                                {resetLoading ? 'Submitting...' : '📨 Submit Reset Request'}
                            </button>
                        </div>
                    )}

                    {/* Request History */}
                    {resetRequests.length > 0 && (
                        <div style={{ marginTop: '1.2rem' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>Request History</h4>
                            <div className="reset-history">
                                {resetRequests.map((r) => (
                                    <div key={r._id} className="reset-history-item">
                                        <div className="reset-history-header">
                                            <span className={`status-badge status-${r.status === 'approved' ? 'active' : r.status === 'rejected' ? 'disabled' : 'draft'}`}>
                                                {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                                            </span>
                                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                                                {new Date(r.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', margin: '0.3rem 0' }}>{r.reason}</p>
                                        {r.adminComment && (
                                            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Admin: {r.adminComment}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Profile;
