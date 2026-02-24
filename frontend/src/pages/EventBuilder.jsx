import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { organizerEventAPI } from '../services/api';

/**
 * EventBuilder — create/edit events with:
 * - Basic info, schedule, pricing, tags
 * - Custom form builder (text, dropdown, checkbox, file fields)
 * - Merchandise variant builder (size, color, stock, price)
 */
export default function EventBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [eventStatus, setEventStatus] = useState('draft');

    const [form, setForm] = useState({
        name: '', description: '', type: 'normal', eligibility: 'open',
        registrationDeadline: '', startDate: '', endDate: '',
        registrationLimit: '', fee: '', tags: [],
    });
    const [tagInput, setTagInput] = useState('');

    // Custom form builder state
    const [customFields, setCustomFields] = useState([]); // [{label,type,required,options}]
    const [newFieldLabel, setNewFieldLabel] = useState('');
    const [newFieldType, setNewFieldType] = useState('text');
    const [newFieldRequired, setNewFieldRequired] = useState(false);
    const [newFieldOptions, setNewFieldOptions] = useState(''); // comma-separated for dropdown

    // Merchandise variants state
    const [variants, setVariants] = useState([]); // [{label,size,color,stock,price}]
    const [purchaseLimit, setPurchaseLimit] = useState(1);

    useEffect(() => {
        if (isEdit) {
            organizerEventAPI.getOne(id).then(({ data }) => {
                const e = data.data.event;
                setForm({
                    name: e.name || '', description: e.description || '',
                    type: e.type || 'normal', eligibility: e.eligibility || 'open',
                    registrationDeadline: e.registrationDeadline ? e.registrationDeadline.slice(0, 16) : '',
                    startDate: e.startDate ? e.startDate.slice(0, 16) : '',
                    endDate: e.endDate ? e.endDate.slice(0, 16) : '',
                    registrationLimit: e.registrationLimit || '',
                    fee: e.fee || '', tags: e.tags || [],
                });
                if (Array.isArray(e.customForm)) setCustomFields(e.customForm);
                if (e.merchandiseDetails) {
                    setVariants(e.merchandiseDetails.variants || []);
                    setPurchaseLimit(e.merchandiseDetails.purchaseLimit || 1);
                }
                setEventStatus(e.status || 'draft');
            }).catch(() => setError('Failed to load event'))
                .finally(() => setLoading(false));
        }
    }, [id, isEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Tag management
    const addTag = () => {
        const t = tagInput.trim().toLowerCase();
        if (t && !form.tags.includes(t)) setForm((prev) => ({ ...prev, tags: [...prev.tags, t] }));
        setTagInput('');
    };
    const removeTag = (tag) => setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));

    // Custom form management
    const addField = () => {
        if (!newFieldLabel.trim()) return;
        const field = { label: newFieldLabel.trim(), type: newFieldType, required: newFieldRequired };
        if (newFieldType === 'dropdown') field.options = newFieldOptions.split(',').map((o) => o.trim()).filter(Boolean);
        setCustomFields((prev) => [...prev, field]);
        setNewFieldLabel(''); setNewFieldType('text'); setNewFieldRequired(false); setNewFieldOptions('');
    };
    const removeField = (idx) => setCustomFields((prev) => prev.filter((_, i) => i !== idx));
    const moveField = (idx, dir) => {
        const arr = [...customFields];
        const target = idx + dir;
        if (target < 0 || target >= arr.length) return;
        [arr[idx], arr[target]] = [arr[target], arr[idx]];
        setCustomFields(arr);
    };

    // Merchandise variant management
    const addVariant = () => {
        setVariants((prev) => [...prev, { label: '', size: '', color: '', stock: 0, price: 0 }]);
    };
    const updateVariant = (idx, field, value) => {
        setVariants((prev) => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
    };
    const removeVariant = (idx) => setVariants((prev) => prev.filter((_, i) => i !== idx));

    // Save
    const handleSave = async (publish = false) => {
        try {
            setSaving(true); setError('');
            const payload = {
                ...form,
                fee: form.fee ? Number(form.fee) : 0,
                registrationLimit: form.registrationLimit ? Number(form.registrationLimit) : undefined,
                customForm: customFields.length > 0 ? customFields : null,
            };
            if (form.type === 'merchandise') {
                payload.merchandiseDetails = { variants, purchaseLimit: Number(purchaseLimit) };
            }

            if (isEdit) {
                await organizerEventAPI.update(id, payload);
                if (publish) await organizerEventAPI.publish(id);
            } else {
                const { data } = await organizerEventAPI.create(payload);
                if (publish) await organizerEventAPI.publish(data.data.event._id);
            }
            navigate('/organizer/events');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save event');
        } finally { setSaving(false); }
    };

    if (loading) return <div className="main-content"><p className="loading-text">Loading...</p></div>;

    return (
        <div className="main-content">
            <div className="page-header">
                <h1>{isEdit ? 'Edit Event' : 'Create Event'}</h1>
                <Link to="/organizer/events" className="btn btn-outline btn-sm">← Back</Link>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="builder-card">
                {/* Basic Info */}
                <h3>Basic Information</h3>
                <div className="form-group">
                    <label className="form-label">Event Name *</label>
                    <input className="form-input" name="name" value={form.name} onChange={handleChange} required />
                </div>
                <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" name="description" rows="4" value={form.description} onChange={handleChange} />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Type</label>
                        <select className="form-input" name="type" value={form.type} onChange={handleChange}>
                            <option value="normal">Normal</option>
                            <option value="merchandise">Merchandise</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Eligibility</label>
                        <select className="form-input" name="eligibility" value={form.eligibility} onChange={handleChange}>
                            <option value="open">Open to All</option>
                            <option value="iiit">IIIT Students Only</option>
                        </select>
                    </div>
                </div>

                {/* Schedule */}
                <h3 style={{ marginTop: '1.5rem' }}>Schedule</h3>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Start Date *</label>
                        <input className="form-input" type="datetime-local" name="startDate" value={form.startDate} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">End Date</label>
                        <input className="form-input" type="datetime-local" name="endDate" value={form.endDate} onChange={handleChange} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Registration Deadline</label>
                    <input className="form-input" type="datetime-local" name="registrationDeadline" value={form.registrationDeadline} onChange={handleChange} />
                </div>

                {/* Registration */}
                <h3 style={{ marginTop: '1.5rem' }}>Registration</h3>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Registration Limit</label>
                        <input className="form-input" type="number" name="registrationLimit" min="0" value={form.registrationLimit} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Fee (₹)</label>
                        <input className="form-input" type="number" name="fee" min="0" value={form.fee} onChange={handleChange} />
                    </div>
                </div>

                {/* Tags */}
                <h3 style={{ marginTop: '1.5rem' }}>Tags</h3>
                <div className="tag-input-row">
                    <input className="form-input" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add a tag..." />
                    <button className="btn btn-outline btn-sm" type="button" onClick={addTag}>Add</button>
                </div>
                {form.tags.length > 0 && (
                    <div className="event-tags" style={{ marginTop: '0.5rem' }}>
                        {form.tags.map((t) => <span key={t} className="tag tag-removable" onClick={() => removeTag(t)}>{t} ×</span>)}
                    </div>
                )}

                {/* Custom Form Builder (all event types) */}
                <>
                    <h3 style={{ marginTop: '1.5rem' }}>Custom Registration Form</h3>
                    <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '0.8rem' }}>
                        Add custom fields that participants need to fill when registering. Form is locked after first registration.
                    </p>
                    {customFields.length > 0 && (
                        <div className="custom-fields-list">
                            {customFields.map((f, idx) => (
                                <div key={idx} className="custom-field-item">
                                    <span className="cf-label">{f.label}</span>
                                    <span className="cf-type">{f.type}</span>
                                    {f.required && <span className="cf-required">required</span>}
                                    {f.type === 'dropdown' && <span className="cf-options">[{(f.options || []).join(', ')}]</span>}
                                    <div className="cf-actions">
                                        <button className="btn-icon" onClick={() => moveField(idx, -1)} title="Move up">↑</button>
                                        <button className="btn-icon" onClick={() => moveField(idx, 1)} title="Move down">↓</button>
                                        <button className="btn-icon btn-icon-danger" onClick={() => removeField(idx)}>×</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="add-field-row">
                        <input className="form-input" placeholder="Field label" value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)} />
                        <select className="form-input" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)} style={{ width: 'auto' }}>
                            <option value="text">Text</option>
                            <option value="dropdown">Dropdown</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="file">File Upload</option>
                        </select>
                        <label className="checkbox-label" style={{ whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={newFieldRequired} onChange={(e) => setNewFieldRequired(e.target.checked)} />
                            Required
                        </label>
                        <button className="btn btn-outline btn-sm" onClick={addField}>+ Add Field</button>
                    </div>
                    {newFieldType === 'dropdown' && (
                        <div className="form-group" style={{ marginTop: '0.5rem' }}>
                            <input className="form-input" placeholder="Options (comma-separated)" value={newFieldOptions}
                                onChange={(e) => setNewFieldOptions(e.target.value)} />
                        </div>
                    )}
                </>


                {/* Merchandise Variant Builder */}
                {form.type === 'merchandise' && (
                    <>
                        <h3 style={{ marginTop: '1.5rem' }}>Merchandise Variants</h3>
                        <div className="form-group">
                            <label className="form-label">Purchase Limit Per User</label>
                            <input className="form-input" type="number" min="1" value={purchaseLimit}
                                onChange={(e) => setPurchaseLimit(e.target.value)} style={{ maxWidth: '150px' }} />
                        </div>
                        {variants.map((v, idx) => (
                            <div key={idx} className="variant-row">
                                <input className="form-input" placeholder="Label" value={v.label} onChange={(e) => updateVariant(idx, 'label', e.target.value)} />
                                <input className="form-input" placeholder="Size" value={v.size} onChange={(e) => updateVariant(idx, 'size', e.target.value)} />
                                <input className="form-input" placeholder="Color" value={v.color} onChange={(e) => updateVariant(idx, 'color', e.target.value)} />
                                <input className="form-input" type="number" placeholder="Stock" min="0" value={v.stock} onChange={(e) => updateVariant(idx, 'stock', Number(e.target.value))} />
                                <input className="form-input" type="number" placeholder="Price" min="0" value={v.price} onChange={(e) => updateVariant(idx, 'price', Number(e.target.value))} />
                                <button className="btn btn-danger btn-sm" onClick={() => removeVariant(idx)}>×</button>
                            </div>
                        ))}
                        <button className="btn btn-outline btn-sm" onClick={addVariant} style={{ marginTop: '0.5rem' }}>+ Add Variant</button>
                    </>
                )}

                {/* Actions */}
                <div className="builder-actions">
                    {isEdit && eventStatus !== 'draft' ? (
                        <button className="btn btn-primary" onClick={() => handleSave(false)} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    ) : (
                        <>
                            <button className="btn btn-outline" onClick={() => handleSave(false)} disabled={saving}>
                                {saving ? 'Saving...' : 'Save as Draft'}
                            </button>
                            <button className="btn btn-primary" onClick={() => handleSave(true)} disabled={saving}>
                                {saving ? 'Saving...' : 'Save & Publish'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
