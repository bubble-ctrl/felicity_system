import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { organizerEventAPI, registrationAPI } from '../services/api';

const Dashboard = () => {
    const { user } = useAuth();
    if (!user) return null;
    return (
        <div className="dashboard">
            {user.role === 'participant' && <ParticipantDashboard user={user} />}
            {user.role === 'organizer' && <OrganizerDashboard user={user} />}
            {user.role === 'admin' && <AdminDashboard user={user} />}
        </div>
    );
};

// ---- Clickable Card ----
const DashCard = ({ icon, title, stat, desc, to }) => {
    const content = (
        <div className={`dashboard-card ${to ? 'dashboard-card-link' : ''}`}>
            <div className="card-icon">{icon}</div>
            <h3>{title}</h3>
            <p className="card-stat">{stat}</p>
            <p className="card-desc">{desc}</p>
        </div>
    );
    return to ? <Link to={to} className="card-link-wrap">{content}</Link> : content;
};

// ---- Participant Dashboard ----
const ParticipantDashboard = ({ user }) => {
    const [regs, setRegs] = useState([]);
    const fetched = useRef(false);

    useEffect(() => {
        if (fetched.current) return;
        fetched.current = true;
        registrationAPI.getMyRegistrations().then(({ data }) => setRegs(data.data.registrations)).catch(() => { });
    }, []);

    const active = regs.filter((r) => r.status === 'registered');
    const upcoming = active.filter((r) => r.eventId?.startDate && new Date(r.eventId.startDate) >= new Date());
    const completed = regs.filter((r) => r.status === 'completed' || r.eventId?.status === 'completed');
    const pending = regs.filter((r) => r.status === 'pending_approval');

    return (
        <div className="dashboard-content">
            <div className="dashboard-welcome">
                <h1>Welcome, {user.firstName} 👋</h1>
                <p>Explore events, register, and track your participation.</p>
            </div>
            <div className="dashboard-grid">
                <DashCard icon="📅" title="Upcoming" stat={upcoming.length} desc="Upcoming events" to="/my-events?tab=upcoming" />
                <DashCard icon="🎫" title="All Tickets" stat={active.length} desc="Active registrations" to="/my-events" />
                <DashCard icon="⏳" title="Pending" stat={pending.length} desc="Awaiting approval" to="/my-events" />
                <DashCard icon="✅" title="Completed" stat={completed.length} desc="Events attended" to="/my-events?tab=completed" />
            </div>
            <div className="dashboard-info">
                <h3>Quick Links</h3>
                <div className="info-grid">
                    <Link to="/events" className="btn btn-primary btn-sm">Browse Events</Link>
                    <Link to="/clubs" className="btn btn-outline btn-sm">Clubs & Organizers</Link>
                    <Link to="/profile" className="btn btn-outline btn-sm">Edit Profile</Link>
                </div>
            </div>
        </div>
    );
};

// ---- Organizer Dashboard ----
const OrganizerDashboard = ({ user }) => {
    const [analytics, setAnalytics] = useState(null);
    const [events, setEvents] = useState([]);
    const fetched = useRef(false);

    useEffect(() => {
        if (fetched.current) return;
        fetched.current = true;
        organizerEventAPI.getAll().then(({ data }) => {
            setEvents(data.data.events);
            setAnalytics(data.data.analytics);
        }).catch(() => { });
    }, []);

    const a = analytics || {};
    const active = events.filter((e) => e.status === 'ongoing' || e.status === 'published');

    return (
        <div className="dashboard-content">
            <div className="dashboard-welcome">
                <h1>Welcome, {user.organizerName} 🎯</h1>
                <p>Manage your events and track participation.</p>
            </div>
            <div className="dashboard-grid">
                <DashCard icon="📅" title="Total Events" stat={a.totalEvents ?? '—'} desc="All events" to="/organizer/events" />
                <DashCard icon="🎟️" title="Registrations" stat={a.totalRegistrations ?? '—'} desc="Across all events" to="/organizer/events" />
                <DashCard icon="✅" title="Attendance" stat={a.totalAttendance ?? '—'} desc="Total attended" />
                <DashCard icon="💰" title="Revenue" stat={a.totalRevenue !== undefined ? `₹${a.totalRevenue}` : '—'} desc="Total earnings" />
            </div>

            {/* Active events */}
            {active.length > 0 && (
                <div className="dashboard-info">
                    <h3>Active Events</h3>
                    <div className="trending-cards">
                        {active.slice(0, 6).map((e) => (
                            <Link key={e._id} to={`/organizer/events/${e._id}`} className="trending-card">
                                <h4>{e.name}</h4>
                                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem' }}>
                                    <span className="event-type-badge">{e.type}</span>
                                    <span className={`status-badge status-${e.status}`}>{e.status}</span>
                                </div>
                                <span className="trending-views">{e.registrationCount || 0} registrations</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ---- Admin Dashboard ----
const AdminDashboard = ({ user }) => (
    <div className="dashboard-content">
        <div className="dashboard-welcome">
            <h1>Admin Panel 🛡️</h1>
            <p>Manage clubs, organizers, and system settings.</p>
        </div>
        <div className="dashboard-grid">
            <DashCard icon="🏢" title="Organizers" stat="—" desc="Active clubs & organizers" to="/manage-organizers" />
            <DashCard icon="👥" title="Participants" stat="—" desc="Registered users" />
            <DashCard icon="📅" title="Events" stat="—" desc="Total events created" />
            <DashCard icon="🔑" title="System" stat="—" desc="System management" />
        </div>
        <div className="dashboard-info">
            <h3>Admin Info</h3>
            <div className="info-grid">
                <div><strong>Email:</strong> {user.email}</div>
                <div><strong>Role:</strong> System Administrator</div>
            </div>
        </div>
    </div>
);

export default Dashboard;
