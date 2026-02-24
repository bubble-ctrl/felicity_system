const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const {
    getProfile, updateProfile, getPreferences, updatePreferences,
    followOrganizer, unfollowOrganizer, changePassword,
    requestPasswordReset, getMyResetRequests,
} = require('../controllers/userController');
const { getMyRegistrations, uploadPaymentProof } = require('../controllers/registrationController');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Profile
router.get('/profile', getProfile);
router.put('/profile', [
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
    body('contactNumber').optional().trim(),
    body('collegeOrOrg').optional().trim(),
    body('organizerName').optional().trim().notEmpty(),
    body('category').optional().trim(),
    body('description').optional().trim(),
    validate,
], updateProfile);

// Preferences
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

// Follow / Unfollow
router.post('/follow/:id', followOrganizer);
router.delete('/follow/:id', unfollowOrganizer);

// My Registrations (participant)
router.get('/registrations', getMyRegistrations);

// Upload payment proof for merchandise orders
router.patch('/registrations/:id/payment-proof', uploadPaymentProof);

// Change password
router.put('/change-password', [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    validate,
], changePassword);

// Password reset requests (organizer only)
router.post('/password-reset-request', requestPasswordReset);
router.get('/password-reset-requests', getMyResetRequests);

module.exports = router;
