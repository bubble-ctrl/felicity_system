import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminAPI } from '../services/api';

const ManageOrganizers = () => {
    const [searchParams] = useSearchParams();
    const [organizers, setOrganizers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [credentials, setCredentials] = useState(null);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'password-resets' ? 'resets' : 'organizers');
    const [resetRequests, setResetRequests] = useState([]);
    const [resetCredentials, setResetCredentials] = useState(null);
    const [processingReset, setProcessingReset] = useState(null);
    const [formData, setFormData] = useState({
        organizerName: '',
        email: '',
        category: '',
        description: '',
        contactNumber: '',
    });

    useEffect(() => {
        fetchOrganizers();
        fetchResetRequests();
    }, []);

    const fetchOrganizers = async () => {
        try {
            setLoading(true);
            const res = await adminAPI.getAllOrganizers();
            setOrganizers(res.data.data.organizers);
        } catch (err) {
            showMessage('error', 'Failed to load organizers');
        } finally {
            setLoading(false);
        }
    };

    const fetchResetRequests = async () => {
        try {
            const res = await adminAPI.getPasswordResetRequests();
            setResetRequests(res.data.data.requests);
        } catch (e) { /* ignore */ }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const resetForm = () => {
        setFormData({ organizerName: '', email: '', category: '', description: '', contactNumber: '' });
        setEditingId(null);
        setShowForm(false);
        setCredentials(null);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                const { email, ...updateData } = formData;
                await adminAPI.updateOrganizer(editingId, updateData);
                showMessage('success', 'Organizer updated successfully');
            } else {
                const res = await adminAPI.createOrganizer(formData);
                setCredentials(res.data.data.credentials);
                showMessage('success', 'Organizer created! Save the credentials shown below.');
            }
            fetchOrganizers();
            if (editingId) resetForm();
        } catch (err) {
            showMessage('error', err.response?.data?.message || 'Operation failed');
        }
    };

    const handleEdit = (org) => {
        setFormData({
            organizerName: org.organizerName || '',
            email: org.email,
            category: org.category || '',
            description: org.description || '',
            contactNumber: org.contactNumber || '',
        });
        setEditingId(org._id);
        setShowForm(true);
        setCredentials(null);
    };

    const handleToggleStatus = async (id) => {
        try {
            const res = await adminAPI.toggleOrganizerStatus(id);
            showMessage('success', res.data.message);
            fetchOrganizers();
        } catch (err) {
            showMessage('error', 'Failed to toggle status');
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
        try {
            await adminAPI.deleteOrganizer(id);
            showMessage('success', 'Organizer deleted permanently');
            fetchOrganizers();
        } catch (err) {
            showMessage('error', 'Failed to delete organizer');
        }
    };

    const handleApproveReset = async (requestId) => {
        try {
            setProcessingReset(requestId);
            const res = await adminAPI.approvePasswordReset(requestId, {});
            const creds = res.data.data.credentials;
            setResetCredentials({ email: creds.email, password: creds.newPassword });
            showMessage('success', 'Password reset approved! New credentials generated.');
            fetchResetRequests();
        } catch (err) {
            showMessage('error', err.response?.data?.message || 'Failed to approve reset');
        } finally { setProcessingReset(null); }
    };

    const handleRejectReset = async (requestId) => {
        const comment = window.prompt('Optional rejection reason:');
        try {
            setProcessingReset(requestId);
            await adminAPI.rejectPasswordReset(requestId, { comment: comment || '' });
            showMessage('success', 'Password reset request rejected');
            fetchResetRequests();
        } catch (err) {
            showMessage('error', err.response?.data?.message || 'Failed to reject reset');
        } finally { setProcessingReset(null); }
    };

    const pendingResets = resetRequests.filter((r) => r.status === 'pending').length;

    return (
        <div className="manage-organizers">
            <div className="page-header">
                <div>
                    <h1>Manage Organizers</h1>
                    <p className="page-subtitle">Create, edit, and manage club & organizer accounts</p>
                </div>
                {activeTab === 'organizers' && (
                    <button
                        className="btn btn-primary"
                        onClick={() => { resetForm(); setShowForm(!showForm); }}
                    >
                        {showForm && !editingId ? '✕ Cancel' : '+ Add Organizer'}
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
                <button className={`filter-tab ${activeTab === 'organizers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('organizers')}>
                    🏢 Organizers ({organizers.length})
                </button>
                <button className={`filter-tab ${activeTab === 'resets' ? 'active' : ''}`}
                    onClick={() => setActiveTab('resets')}>
                    🔐 Password Resets {pendingResets > 0 && <span className="tab-badge">{pendingResets}</span>}
                </button>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>{message.text}</div>
            )}

            {/* Organizers Tab */}
            {activeTab === 'organizers' && (
                <>
                    {/* Create / Edit Form */}
                    {showForm && (
                        <div className="organizer-form-card">
                            <h3>{editingId ? '✏️ Edit Organizer' : '🆕 Create New Organizer'}</h3>
                            <form onSubmit={handleSubmit}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="organizerName">Organizer Name *</label>
                                        <input id="organizerName" name="organizerName" type="text" placeholder="e.g. Coding Club" value={formData.organizerName} onChange={handleChange} required />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="email">Email *</label>
                                        <input id="email" name="email" type="email" placeholder="club@felicity.org" value={formData.email} onChange={handleChange} required disabled={!!editingId} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="category">Category</label>
                                        <input id="category" name="category" type="text" placeholder="e.g. Technical, Cultural" value={formData.category} onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="contactNumber">Contact Number</label>
                                        <input id="contactNumber" name="contactNumber" type="tel" placeholder="9876543210" value={formData.contactNumber} onChange={handleChange} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="description">Description</label>
                                    <textarea id="description" name="description" placeholder="Brief description..." value={formData.description} onChange={handleChange} rows={3} />
                                </div>
                                <div className="form-actions">
                                    <button type="submit" className="btn btn-primary">{editingId ? 'Update Organizer' : 'Create Organizer'}</button>
                                    <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                                </div>
                            </form>
                            {credentials && (
                                <div className="credentials-box">
                                    <h4>🔑 Generated Credentials</h4>
                                    <p>Share these securely with the organizer:</p>
                                    <div className="credential-field"><strong>Email:</strong> <code>{credentials.email}</code></div>
                                    <div className="credential-field"><strong>Password:</strong> <code>{credentials.password}</code></div>
                                    <button className="btn btn-secondary btn-sm" onClick={() => {
                                        navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.password}`);
                                        showMessage('success', 'Credentials copied to clipboard!');
                                    }}>📋 Copy Credentials</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Organizers Table */}
                    {loading ? (
                        <div className="loading-screen">Loading organizers...</div>
                    ) : organizers.length === 0 ? (
                        <div className="empty-state">
                            <p>🏢 No organizers yet. Click "Add Organizer" to create one.</p>
                        </div>
                    ) : (
                        <div className="organizers-table-wrap">
                            <table className="organizers-table">
                                <thead>
                                    <tr><th>Name</th><th>Email</th><th>Category</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {organizers.map((org) => (
                                        <tr key={org._id} className={!org.isActive ? 'row-disabled' : ''}>
                                            <td className="td-name">
                                                <strong>{org.organizerName || '—'}</strong>
                                                {org.description && <span className="td-desc">{org.description}</span>}
                                            </td>
                                            <td>{org.email}</td>
                                            <td>{org.category || '—'}</td>
                                            <td>
                                                <span className={`status-badge ${org.isActive ? 'status-active' : 'status-disabled'}`}>
                                                    {org.isActive ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td>{new Date(org.createdAt).toLocaleDateString()}</td>
                                            <td className="td-actions">
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(org)} title="Edit">✏️</button>
                                                <button className={`btn btn-sm ${org.isActive ? 'btn-warning' : 'btn-success-sm'}`}
                                                    onClick={() => handleToggleStatus(org._id)} title={org.isActive ? 'Disable' : 'Enable'}>
                                                    {org.isActive ? '🚫' : '✅'}
                                                </button>
                                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(org._id, org.organizerName)} title="Delete">🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* Password Resets Tab */}
            {activeTab === 'resets' && (
                <div>
                    {/* Reset credentials display */}
                    {resetCredentials && (
                        <div className="credentials-box" style={{ marginBottom: '1rem' }}>
                            <h4>🔑 New Credentials Generated</h4>
                            <p>Share these securely with the organizer:</p>
                            <div className="credential-field"><strong>Email:</strong> <code>{resetCredentials.email}</code></div>
                            <div className="credential-field"><strong>Password:</strong> <code>{resetCredentials.password}</code></div>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                                navigator.clipboard.writeText(`Email: ${resetCredentials.email}\nPassword: ${resetCredentials.password}`);
                                showMessage('success', 'Credentials copied to clipboard!');
                            }}>📋 Copy Credentials</button>
                            <button className="btn btn-secondary btn-sm" style={{ marginLeft: '0.5rem' }}
                                onClick={() => setResetCredentials(null)}>✕ Dismiss</button>
                        </div>
                    )}

                    {resetRequests.length === 0 ? (
                        <div className="empty-state">
                            <p>✅ No password reset requests.</p>
                        </div>
                    ) : (
                        <div className="reset-requests-list">
                            {resetRequests.map((req) => (
                                <div key={req._id} className={`reset-request-card ${req.status}`}>
                                    <div className="reset-request-header">
                                        <div>
                                            <strong>{req.organizerId?.organizerName || req.organizerId?.email || 'Unknown'}</strong>
                                            <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                                                {req.organizerId?.email}
                                            </span>
                                        </div>
                                        <span className={`status-badge status-${req.status === 'approved' ? 'active' : req.status === 'rejected' ? 'disabled' : 'draft'}`}>
                                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                        </span>
                                    </div>
                                    <p className="reset-request-reason">{req.reason}</p>
                                    <div className="reset-request-meta">
                                        <span className="text-muted">Requested: {new Date(req.createdAt).toLocaleString()}</span>
                                        {req.processedAt && (
                                            <span className="text-muted">Processed: {new Date(req.processedAt).toLocaleString()}</span>
                                        )}
                                        {req.adminComment && (
                                            <span className="text-muted">Comment: {req.adminComment}</span>
                                        )}
                                    </div>
                                    {req.status === 'pending' && (
                                        <div className="reset-request-actions">
                                            <button className="btn btn-primary btn-sm"
                                                onClick={() => handleApproveReset(req._id)}
                                                disabled={processingReset === req._id}>
                                                {processingReset === req._id ? 'Processing...' : '✅ Approve & Generate Password'}
                                            </button>
                                            <button className="btn btn-danger btn-sm"
                                                onClick={() => handleRejectReset(req._id)}
                                                disabled={processingReset === req._id}>
                                                ❌ Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ManageOrganizers;
