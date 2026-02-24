const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');
const ApiError = require('../utils/ApiError');
const { ROLES, PARTICIPANT_TYPES } = require('../config/constants');

// IIIT email domain pattern
const IIIT_EMAIL_REGEX = /@(students\.iiit\.ac\.in|iiit\.ac\.in|research\.iiit\.ac\.in)$/i;

/**
 * @desc    Register a new participant
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
    try {
        const { firstName, lastName, email, password, participantType, contactNumber, collegeOrOrg } =
            req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new ApiError(400, 'An account with this email already exists');
        }

        // Validate participant type
        if (!participantType || !Object.values(PARTICIPANT_TYPES).includes(participantType)) {
            throw new ApiError(400, 'Valid participant type is required (iiit or non-iiit)');
        }

        // IIIT students must use IIIT email
        if (participantType === PARTICIPANT_TYPES.IIIT) {
            if (!IIIT_EMAIL_REGEX.test(email)) {
                throw new ApiError(400, 'IIIT participants must register with an IIIT-issued email address');
            }
        }

        // Non-IIIT participants must NOT use IIIT email
        if (participantType === PARTICIPANT_TYPES.NON_IIIT) {
            if (IIIT_EMAIL_REGEX.test(email)) {
                throw new ApiError(400, 'Non-IIIT participants cannot register with an IIIT email');
            }
        }

        // Password strength check
        if (!password || password.length < 6) {
            throw new ApiError(400, 'Password must be at least 6 characters');
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            throw new ApiError(
                400,
                'Password must contain at least one uppercase letter, one lowercase letter, and one number'
            );
        }

        // Create participant
        const user = await User.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password,
            role: ROLES.PARTICIPANT,
            participantType,
            contactNumber,
            collegeOrOrg,
        });

        // Generate JWT
        const token = generateToken({ id: user._id, role: user.role });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user,
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Login user (participant, organizer, or admin)
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ApiError(400, 'Email and password are required');
        }

        // Find user and explicitly select password
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            throw new ApiError(401, 'Invalid email or password');
        }

        // Check if account is active
        if (!user.isActive) {
            throw new ApiError(403, 'Your account has been disabled. Contact the administrator.');
        }

        // Compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            throw new ApiError(401, 'Invalid email or password');
        }

        // Generate JWT
        const token = generateToken({ id: user._id, role: user.role });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user,
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get current logged-in user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        res.status(200).json({
            success: true,
            data: { user },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Admin creates a new organizer account
 * @route   POST /api/auth/create-organizer
 * @access  Private (Admin only)
 */
const createOrganizer = async (req, res, next) => {
    try {
        const { organizerName, email, password, category, description, contactNumber } = req.body;

        if (!organizerName || !email || !password) {
            throw new ApiError(400, 'Organizer name, email, and password are required');
        }

        // Check for existing user
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new ApiError(400, 'An account with this email already exists');
        }

        const organizer = await User.create({
            organizerName,
            email: email.toLowerCase(),
            password,
            role: ROLES.ORGANIZER,
            category,
            description,
            contactNumber,
        });

        res.status(201).json({
            success: true,
            message: 'Organizer account created successfully',
            data: {
                organizer,
                credentials: {
                    email: organizer.email,
                    note: 'Share these credentials securely with the organizer',
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    getMe,
    createOrganizer,
};
