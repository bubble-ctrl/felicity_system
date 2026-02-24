import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ManageOrganizers from './pages/ManageOrganizers';
import Profile from './pages/Profile';
import OrganizerEvents from './pages/OrganizerEvents';
import EventBuilder from './pages/EventBuilder';
import OrganizerEventDetail from './pages/OrganizerEventDetail';
import BrowseEvents from './pages/BrowseEvents';
import EventDetails from './pages/EventDetails';
import MyEvents from './pages/MyEvents';
import Onboarding from './pages/Onboarding';
import OrganizerListing from './pages/OrganizerListing';
import OrganizerPublicDetail from './pages/OrganizerPublicDetail';
import QRScanner from './pages/QRScanner';

// Redirect authenticated users away from auth pages
const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => {
  return (
    <>
      <Navbar />
      <main className="main-content">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

          {/* Protected routes — all roles */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Participant routes */}
          <Route path="/events" element={<ProtectedRoute roles={['participant']}><BrowseEvents /></ProtectedRoute>} />
          <Route path="/events/:id" element={<ProtectedRoute roles={['participant']}><EventDetails /></ProtectedRoute>} />
          <Route path="/my-events" element={<ProtectedRoute roles={['participant']}><MyEvents /></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute roles={['participant']}><Onboarding /></ProtectedRoute>} />
          <Route path="/clubs" element={<ProtectedRoute roles={['participant']}><OrganizerListing /></ProtectedRoute>} />
          <Route path="/clubs/:id" element={<ProtectedRoute roles={['participant']}><OrganizerPublicDetail /></ProtectedRoute>} />

          {/* Organizer routes */}
          <Route path="/organizer/events" element={<ProtectedRoute roles={['organizer']}><OrganizerEvents /></ProtectedRoute>} />
          <Route path="/organizer/events/new" element={<ProtectedRoute roles={['organizer']}><EventBuilder /></ProtectedRoute>} />
          <Route path="/organizer/events/:id" element={<ProtectedRoute roles={['organizer']}><OrganizerEventDetail /></ProtectedRoute>} />
          <Route path="/organizer/events/:id/edit" element={<ProtectedRoute roles={['organizer']}><EventBuilder /></ProtectedRoute>} />
          <Route path="/organizer/events/:id/scan" element={<ProtectedRoute roles={['organizer']}><QRScanner /></ProtectedRoute>} />

          {/* Admin routes */}
          <Route path="/manage-organizers" element={<ProtectedRoute roles={['admin']}><ManageOrganizers /></ProtectedRoute>} />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </>
  );
};

const App = () => (
  <Router>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </Router>
);

export default App;
