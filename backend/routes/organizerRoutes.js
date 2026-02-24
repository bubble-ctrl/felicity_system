const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const {
    createEvent, getMyEvents, getMyEvent, updateEvent,
    publishEvent, startEvent, closeEvent, completeEvent, deleteEvent,
} = require('../controllers/organizerEventController');
const {
    getEventRegistrations, exportCSV, markAttendance,
    approvePayment, rejectPayment, scanQRCode, getAttendanceDashboard,
} = require('../controllers/registrationController');
const { getFeedbackStats, getFeedbackList, exportFeedbackCSV } = require('../controllers/feedbackController');

const router = express.Router();

// All routes require organizer role
router.use(authenticate);
router.use(authorize(ROLES.ORGANIZER));

// Event CRUD
router.post('/events', [
    body('name').trim().notEmpty().withMessage('Event name is required'),
    body('type').optional().isIn(['normal', 'merchandise']),
    body('eligibility').optional().isIn(['iiit', 'open']),
    body('fee').optional().isFloat({ min: 0 }),
    body('registrationLimit').optional().isInt({ min: 0 }),
    validate,
], createEvent);

router.get('/events', getMyEvents);
router.get('/events/:id', getMyEvent);

router.put('/events/:id', [
    body('name').optional().trim().notEmpty(),
    body('type').optional().isIn(['normal', 'merchandise']),
    body('eligibility').optional().isIn(['iiit', 'open']),
    body('fee').optional().isFloat({ min: 0 }),
    body('registrationLimit').optional().isInt({ min: 0 }),
    validate,
], updateEvent);

// Status transitions
router.patch('/events/:id/publish', publishEvent);
router.patch('/events/:id/start', startEvent);
router.patch('/events/:id/close', closeEvent);
router.patch('/events/:id/complete', completeEvent);

// Delete (draft only)
router.delete('/events/:id', deleteEvent);

// Registrations management
router.get('/events/:id/registrations', getEventRegistrations);
router.get('/events/:id/export', exportCSV);
router.patch('/registrations/:id/attendance', markAttendance);

// Payment approval (merchandise)
router.patch('/registrations/:id/approve', approvePayment);
router.patch('/registrations/:id/reject', rejectPayment);

// QR scanner & attendance
router.post('/events/:id/scan-qr', scanQRCode);
router.get('/events/:id/attendance', getAttendanceDashboard);

// Feedback (organizer views)
router.get('/events/:id/feedback/stats', getFeedbackStats);
router.get('/events/:id/feedback', getFeedbackList);
router.get('/events/:id/feedback/export', exportFeedbackCSV);

module.exports = router;
