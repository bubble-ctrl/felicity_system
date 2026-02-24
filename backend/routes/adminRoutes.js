const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const {
    createOrganizer,
    getAllOrganizers,
    getOrganizerById,
    updateOrganizer,
    toggleOrganizerStatus,
    deleteOrganizer,
    getPasswordResetRequests,
    approvePasswordReset,
    rejectPasswordReset,
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

// POST /api/admin/organizers — Create new organizer
router.post(
    '/organizers',
    [
        body('organizerName').trim().notEmpty().withMessage('Organizer name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('category').optional().trim(),
        body('description').optional().trim(),
        body('contactNumber').optional().trim(),
        validate,
    ],
    createOrganizer
);

// GET /api/admin/organizers — List all organizers
router.get('/organizers', getAllOrganizers);

// GET /api/admin/organizers/:id — Get single organizer
router.get('/organizers/:id', getOrganizerById);

// PUT /api/admin/organizers/:id — Update organizer
router.put(
    '/organizers/:id',
    [
        body('organizerName').optional().trim().notEmpty().withMessage('Organizer name cannot be empty'),
        body('category').optional().trim(),
        body('description').optional().trim(),
        body('contactNumber').optional().trim(),
        validate,
    ],
    updateOrganizer
);

// PATCH /api/admin/organizers/:id/toggle-status — Enable/Disable
router.patch('/organizers/:id/toggle-status', toggleOrganizerStatus);

// DELETE /api/admin/organizers/:id — Permanent delete
router.delete('/organizers/:id', deleteOrganizer);

// Password reset requests
router.get('/password-resets', getPasswordResetRequests);
router.patch('/password-resets/:id/approve', approvePasswordReset);
router.patch('/password-resets/:id/reject', rejectPasswordReset);

module.exports = router;
