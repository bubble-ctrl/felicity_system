import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/dashboard">🎉 Felicity</Link>
            </div>
            <div className="navbar-links">
                <Link to="/dashboard">Dashboard</Link>
                {user.role === 'participant' && (
                    <>
                        <Link to="/events">Browse Events</Link>
                        <Link to="/my-events">My Events</Link>
                        <Link to="/clubs">Clubs</Link>
                    </>
                )}
                {user.role === 'organizer' && (
                    <>
                        <Link to="/organizer/events">My Events</Link>
                        <Link to="/organizer/events?filter=ongoing">Ongoing Events</Link>
                        <Link to="/organizer/events/new">Create Event</Link>
                    </>
                )}
                {user.role === 'admin' && (
                    <>
                        <Link to="/manage-organizers">Manage Organizers</Link>
                        <Link to="/manage-organizers?tab=password-resets">Password Resets</Link>
                    </>
                )}
                <Link to="/profile">Profile</Link>
            </div>
            <div className="navbar-user">
                <span className="user-role-badge">{user.role}</span>
                <span className="user-name">{user.firstName || user.organizerName || 'Admin'}</span>
                <button onClick={handleLogout} className="btn btn-logout">Logout</button>
            </div>
        </nav>
    );
};

export default Navbar;
