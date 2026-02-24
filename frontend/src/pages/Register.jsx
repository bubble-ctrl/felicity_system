import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        participantType: 'non-iiit',
        contactNumber: '',
        collegeOrOrg: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const { confirmPassword, ...submitData } = formData;
            await register(submitData);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card auth-card-wide">
                <div className="auth-header">
                    <h1>🎉 Felicity</h1>
                    <p>Create your account</p>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="firstName">First Name</label>
                            <input
                                id="firstName"
                                name="firstName"
                                type="text"
                                placeholder="John"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="lastName">Last Name</label>
                            <input
                                id="lastName"
                                name="lastName"
                                type="text"
                                placeholder="Doe"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="participantType">Participant Type</label>
                        <select
                            id="participantType"
                            name="participantType"
                            value={formData.participantType}
                            onChange={handleChange}
                            required
                        >
                            <option value="non-iiit">Non-IIIT Student</option>
                            <option value="iiit">IIIT Student</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">
                            Email {formData.participantType === 'iiit' && <span className="hint">(use your IIIT email)</span>}
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder={formData.participantType === 'iiit' ? 'you@students.iiit.ac.in' : 'you@example.com'}
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="Min 6 chars, A-z, 0-9"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="contactNumber">Contact Number</label>
                            <input
                                id="contactNumber"
                                name="contactNumber"
                                type="tel"
                                placeholder="9876543210"
                                value={formData.contactNumber}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="collegeOrOrg">College / Organization</label>
                            <input
                                id="collegeOrOrg"
                                name="collegeOrOrg"
                                type="text"
                                placeholder="Your college name"
                                value={formData.collegeOrOrg}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>
                <p className="auth-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
