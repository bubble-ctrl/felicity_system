import axios from 'axios';

const API = axios.create({
    baseURL: 'https://felicity-backend-vqz2.onrender.com/api',
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle 401 responses globally
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Auth
export const authAPI = {
    register: (data) => API.post('/auth/register', data),
    login: (data) => API.post('/auth/login', data),
    getMe: () => API.get('/auth/me'),
};

// Admin
export const adminAPI = {
    createOrganizer: (data) => API.post('/admin/organizers', data),
    getAllOrganizers: () => API.get('/admin/organizers'),
    getOrganizer: (id) => API.get(`/admin/organizers/${id}`),
    updateOrganizer: (id, data) => API.put(`/admin/organizers/${id}`, data),
    toggleOrganizerStatus: (id) => API.patch(`/admin/organizers/${id}/toggle-status`),
    deleteOrganizer: (id) => API.delete(`/admin/organizers/${id}`),
    // Password reset requests
    getPasswordResetRequests: () => API.get('/admin/password-resets'),
    approvePasswordReset: (id, data) => API.patch(`/admin/password-resets/${id}/approve`, data),
    rejectPasswordReset: (id, data) => API.patch(`/admin/password-resets/${id}/reject`, data),
};

// User profile & preferences
export const userAPI = {
    getProfile: () => API.get('/users/profile'),
    updateProfile: (data) => API.put('/users/profile', data),
    getPreferences: () => API.get('/users/preferences'),
    updatePreferences: (data) => API.put('/users/preferences', data),
    followOrganizer: (id) => API.post(`/users/follow/${id}`),
    unfollowOrganizer: (id) => API.delete(`/users/follow/${id}`),
    changePassword: (data) => API.put('/users/change-password', data),
    // Password reset requests (organizer)
    requestPasswordReset: (data) => API.post('/users/password-reset-request', data),
    getMyResetRequests: () => API.get('/users/password-reset-requests'),
};

// Registrations
export const registrationAPI = {
    register: (eventId, data) => API.post(`/events/${eventId}/register`, data),
    getMyRegistrations: () => API.get('/users/registrations'),
    cancel: (regId) => API.patch(`/registrations/${regId}/cancel`),
    uploadPaymentProof: (regId, data) => API.patch(`/users/registrations/${regId}/payment-proof`, data),
};

// Organizer Event management
export const organizerEventAPI = {
    create: (data) => API.post('/organizer/events', data),
    getAll: () => API.get('/organizer/events'),
    getOne: (id) => API.get(`/organizer/events/${id}`),
    update: (id, data) => API.put(`/organizer/events/${id}`, data),
    publish: (id) => API.patch(`/organizer/events/${id}/publish`),
    start: (id) => API.patch(`/organizer/events/${id}/start`),
    close: (id) => API.patch(`/organizer/events/${id}/close`),
    complete: (id) => API.patch(`/organizer/events/${id}/complete`),
    delete: (id) => API.delete(`/organizer/events/${id}`),
    getRegistrations: (id, params) => API.get(`/organizer/events/${id}/registrations`, { params }),
    exportCSV: (id) => API.get(`/organizer/events/${id}/export`, { responseType: 'blob' }),
    markAttendance: (regId) => API.patch(`/organizer/registrations/${regId}/attendance`),
    approvePayment: (regId) => API.patch(`/organizer/registrations/${regId}/approve`),
    rejectPayment: (regId) => API.patch(`/organizer/registrations/${regId}/reject`),
    scanQR: (eventId, data) => API.post(`/organizer/events/${eventId}/scan-qr`, data),
    getAttendanceDashboard: (eventId) => API.get(`/organizer/events/${eventId}/attendance`),
};

// Public events
export const publicEventAPI = {
    browse: (params) => API.get('/events', { params }),
    getDetails: (id) => API.get(`/events/${id}`),
    trending: () => API.get('/events/trending'),
};

// Public organizers
export const organizerListAPI = {
    list: () => API.get('/organizers'),
    getDetail: (id) => API.get(`/organizers/${id}`),
};

// Discussion forum messages
export const messageAPI = {
    getMessages: (eventId, params) => API.get(`/events/${eventId}/messages`, { params }),
    createMessage: (eventId, data) => API.post(`/events/${eventId}/messages`, data),
    getReplies: (messageId) => API.get(`/messages/${messageId}/replies`),
    deleteMessage: (messageId) => API.delete(`/messages/${messageId}`),
    togglePin: (messageId) => API.patch(`/messages/${messageId}/pin`),
    react: (messageId, data) => API.patch(`/messages/${messageId}/react`, data),
};

// Anonymous feedback
export const feedbackAPI = {
    submit: (eventId, data) => API.post(`/events/${eventId}/feedback`, data),
    getMine: (eventId) => API.get(`/events/${eventId}/feedback/mine`),
    // Organizer endpoints
    getStats: (eventId) => API.get(`/organizer/events/${eventId}/feedback/stats`),
    getList: (eventId, params) => API.get(`/organizer/events/${eventId}/feedback`, { params }),
    exportCSV: (eventId, params) => API.get(`/organizer/events/${eventId}/feedback/export`, { params, responseType: 'blob' }),
};

export default API;

