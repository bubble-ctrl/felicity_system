const User = require('../models/User');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');
const crypto = require('crypto');

/**
 * Generate a random password (12 chars, mixed case + digits + special)
 */
const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const special = '@#$!';
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    password += 'A1a' + special.charAt(Math.floor(Math.random() * special.length));
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * @desc    Create a new organizer account
 * @route   POST /api/admin/organizers
 * @access  Admin only
 */
const createOrganizer = async (req, res, next) => {
    try {
        const { organizerName, email, category, description, contactEmail, contactNumber } = req.body;

        if (!organizerName || !email) {
            throw new ApiError(400, 'Organizer name and email are required');
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new ApiError(400, 'An account with this email already exists');
        }

        const generatedPassword = generatePassword();

        const organizer = await User.create({
            organizerName,
            email: email.toLowerCase(),
            password: generatedPassword,
            role: ROLES.ORGANIZER,
            category,
            description,
            contactNumber,
            createdBy: req.user.id,
        });

        res.status(201).json({
            success: true,
            message: 'Organizer account created successfully',
            data: {
                organizer,
                credentials: {
                    email: organizer.email,
                    password: generatedPassword,
                    note: 'Share these credentials securely with the organizer',
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all organizers
 * @route   GET /api/admin/organizers
 * @access  Admin only
 */
const getAllOrganizers = async (req, res, next) => {
    try {
        const organizers = await User.find({ role: ROLES.ORGANIZER })
            .sort({ createdAt: -1 })
            .select('-password');

        res.status(200).json({
            success: true,
            count: organizers.length,
            data: { organizers },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single organizer by ID
 * @route   GET /api/admin/organizers/:id
 * @access  Admin only
 */
const getOrganizerById = async (req, res, next) => {
    try {
        const organizer = await User.findOne({
            _id: req.params.id,
            role: ROLES.ORGANIZER,
        }).select('-password');

        if (!organizer) {
            throw new ApiError(404, 'Organizer not found');
        }

        res.status(200).json({
            success: true,
            data: { organizer },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update organizer details
 * @route   PUT /api/admin/organizers/:id
 * @access  Admin only
 */
const updateOrganizer = async (req, res, next) => {
    try {
        const { organizerName, category, description, contactNumber } = req.body;

        const organizer = await User.findOne({
            _id: req.params.id,
            role: ROLES.ORGANIZER,
        });

        if (!organizer) {
            throw new ApiError(404, 'Organizer not found');
        }

        if (organizerName !== undefined) organizer.organizerName = organizerName;
        if (category !== undefined) organizer.category = category;
        if (description !== undefined) organizer.description = description;
        if (contactNumber !== undefined) organizer.contactNumber = contactNumber;

        await organizer.save();

        res.status(200).json({
            success: true,
            message: 'Organizer updated successfully',
            data: { organizer },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Toggle organizer active status (enable/disable)
 * @route   PATCH /api/admin/organizers/:id/toggle-status
 * @access  Admin only
 */
const toggleOrganizerStatus = async (req, res, next) => {
    try {
        const organizer = await User.findOne({
            _id: req.params.id,
            role: ROLES.ORGANIZER,
        });

        if (!organizer) {
            throw new ApiError(404, 'Organizer not found');
        }

        organizer.isActive = !organizer.isActive;
        await organizer.save();

        res.status(200).json({
            success: true,
            message: `Organizer ${organizer.isActive ? 'enabled' : 'disabled'} successfully`,
            data: { organizer },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete organizer permanently
 * @route   DELETE /api/admin/organizers/:id
 * @access  Admin only
 */
const deleteOrganizer = async (req, res, next) => {
    try {
        const organizer = await User.findOne({
            _id: req.params.id,
            role: ROLES.ORGANIZER,
        });

        if (!organizer) {
            throw new ApiError(404, 'Organizer not found');
        }

        // Cascade-delete all associated data
        const Event = require('../models/Event');
        const Registration = require('../models/Registration');
        const Message = require('../models/Message');
        const Feedback = require('../models/Feedback');

        // Find all events by this organizer
        const organizerEvents = await Event.find({ organizerId: organizer._id }).select('_id');
        const eventIds = organizerEvents.map(e => e._id);

        // Delete registrations for those events
        if (eventIds.length > 0) {
            await Registration.deleteMany({ eventId: { $in: eventIds } });
            await Message.deleteMany({ eventId: { $in: eventIds } });
            await Feedback.deleteMany({ eventId: { $in: eventIds } });
        }

        // Delete all events
        await Event.deleteMany({ organizerId: organizer._id });

        // Delete password reset requests
        await PasswordResetRequest.deleteMany({ organizerId: organizer._id });

        // Delete the organizer account
        await User.deleteOne({ _id: organizer._id });

        res.status(200).json({
            success: true,
            message: 'Organizer and all associated data deleted permanently',
        });
    } catch (error) {
        next(error);
    }
};

// ========== Password Reset Requests ==========

/**
 * @desc    Get all password reset requests
 * @route   GET /api/admin/password-resets
 * @access  Admin only
 */
const getPasswordResetRequests = async (req, res, next) => {
    try {
        const requests = await PasswordResetRequest.find()
            .populate('organizerId', 'organizerName email category')
            .populate('processedBy', 'firstName lastName email')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: { requests } });
    } catch (error) { next(error); }
};

/**
 * @desc    Approve a password reset request
 * @route   PATCH /api/admin/password-resets/:id/approve
 * @access  Admin only
 */
const approvePasswordReset = async (req, res, next) => {
    try {
        const request = await PasswordResetRequest.findById(req.params.id)
            .populate('organizerId', 'organizerName email');

        if (!request) throw new ApiError(404, 'Request not found');
        if (request.status !== 'pending') throw new ApiError(400, 'Request already processed');

        const newPassword = generatePassword();

        const organizer = await User.findById(request.organizerId._id).select('+password');
        if (!organizer) throw new ApiError(404, 'Organizer account not found');
        organizer.password = newPassword;
        await organizer.save();

        request.status = 'approved';
        request.newPassword = newPassword;
        request.adminComment = req.body.comment || '';
        request.processedBy = req.user.id;
        request.processedAt = new Date();
        await request.save();

        res.json({
            success: true,
            message: 'Password reset approved',
            data: {
                request,
                credentials: {
                    email: organizer.email,
                    organizerName: organizer.organizerName,
                    newPassword,
                    note: 'Share this new password securely with the organizer',
                },
            },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Reject a password reset request
 * @route   PATCH /api/admin/password-resets/:id/reject
 * @access  Admin only
 */
const rejectPasswordReset = async (req, res, next) => {
    try {
        const request = await PasswordResetRequest.findById(req.params.id);
        if (!request) throw new ApiError(404, 'Request not found');
        if (request.status !== 'pending') throw new ApiError(400, 'Request already processed');

        request.status = 'rejected';
        request.adminComment = req.body.comment || '';
        request.processedBy = req.user.id;
        request.processedAt = new Date();
        await request.save();

        res.json({ success: true, message: 'Password reset request rejected' });
    } catch (error) { next(error); }
};

module.exports = {
    createOrganizer,
    getAllOrganizers,
    getOrganizerById,
    updateOrganizer,
    toggleOrganizerStatus,
    deleteOrganizer,
    getPasswordResetRequests,
    approvePasswordReset,
    rejectPasswordReset,
};
