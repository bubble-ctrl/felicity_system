const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const {
    register,
    login,
    getMe,
    createOrganizer,
} = require('../controllers/authController');

const router = express.Router();

// ---- Public Routes ----

// POST /api/auth/register — Participant registration
router.post(
    '/register',
    [
        body('firstName').trim().notEmpty().withMessage('First name is required'),
        body('lastName').trim().notEmpty().withMessage('Last name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters'),
        body('participantType')
            .isIn(['iiit', 'non-iiit'])
            .withMessage('Participant type must be iiit or non-iiit'),
        body('contactNumber').optional().trim(),
        body('collegeOrOrg').optional().trim(),
        validate,
    ],
    register
);

// POST /api/auth/login — Login (any role)
router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required'),
        validate,
    ],
    login
);

// ---- Protected Routes ----

// GET /api/auth/me — Get current user profile
router.get('/me', authenticate, getMe);

// POST /api/auth/create-organizer — Admin creates organizer account
router.post(
    '/create-organizer',
    authenticate,
    authorize(ROLES.ADMIN),
    [
        body('organizerName').trim().notEmpty().withMessage('Organizer name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters'),
        body('category').optional().trim(),
        body('description').optional().trim(),
        body('contactNumber').optional().trim(),
        validate,
    ],
    createOrganizer
);

module.exports = router;
