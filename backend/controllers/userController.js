const User = require('../models/User');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');

/**
 * @desc    Get current user profile
 * @route   GET /api/users/profile
 */
const getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password')
            .populate('followedClubs', 'organizerName category');
        if (!user) throw new ApiError(404, 'User not found');
        res.status(200).json({ success: true, data: { user } });
    } catch (error) { next(error); }
};

/**
 * @desc    Update current user profile
 * @route   PUT /api/users/profile
 */
const updateProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) throw new ApiError(404, 'User not found');

        const commonFields = ['firstName', 'lastName', 'contactNumber', 'collegeOrOrg'];
        const roleFields = {
            participant: ['interests', 'followedClubs'],
            organizer: ['organizerName', 'category', 'description', 'contactEmail', 'discordWebhookUrl'],
            admin: [],
        };
        const allowedFields = [...commonFields, ...(roleFields[user.role] || [])];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        }
        await user.save();

        const populated = await User.findById(user._id).select('-password')
            .populate('followedClubs', 'organizerName category');

        res.status(200).json({ success: true, message: 'Profile updated successfully', data: { user: populated } });
    } catch (error) { next(error); }
};

/**
 * @desc    Get user preferences
 * @route   GET /api/users/preferences
 */
const getPreferences = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
            .select('interests followedClubs onboardingCompleted')
            .populate('followedClubs', 'organizerName category');
        if (!user) throw new ApiError(404, 'User not found');
        res.status(200).json({ success: true, data: { preferences: user } });
    } catch (error) { next(error); }
};

/**
 * @desc    Update preferences
 * @route   PUT /api/users/preferences
 */
const updatePreferences = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) throw new ApiError(404, 'User not found');

        if (req.body.interests !== undefined) user.interests = req.body.interests;
        if (req.body.followedClubs !== undefined) user.followedClubs = req.body.followedClubs;
        if (req.body.onboardingCompleted !== undefined) user.onboardingCompleted = req.body.onboardingCompleted;
        await user.save();

        const populated = await User.findById(user._id)
            .select('interests followedClubs onboardingCompleted')
            .populate('followedClubs', 'organizerName category');

        res.status(200).json({ success: true, message: 'Preferences updated', data: { preferences: populated } });
    } catch (error) { next(error); }
};

/**
 * @desc    Follow an organizer
 * @route   POST /api/users/follow/:id
 */
const followOrganizer = async (req, res, next) => {
    try {
        const organizer = await User.findOne({ _id: req.params.id, role: ROLES.ORGANIZER, isActive: true });
        if (!organizer) throw new ApiError(404, 'Organizer not found');

        await User.findByIdAndUpdate(req.user.id, {
            $addToSet: { followedClubs: organizer._id },
        });

        res.status(200).json({ success: true, message: `Now following ${organizer.organizerName}` });
    } catch (error) { next(error); }
};

/**
 * @desc    Unfollow an organizer
 * @route   DELETE /api/users/follow/:id
 */
const unfollowOrganizer = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user.id, {
            $pull: { followedClubs: req.params.id },
        });
        res.status(200).json({ success: true, message: 'Unfollowed successfully' });
    } catch (error) { next(error); }
};

/**
 * @desc    Change password
 * @route   PUT /api/users/change-password
 */
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) throw new ApiError(400, 'Both current and new password required');
        if (newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');

        const user = await User.findById(req.user.id).select('+password');
        if (!user) throw new ApiError(404, 'User not found');

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) throw new ApiError(400, 'Current password is incorrect');

        user.password = newPassword;
        await user.save();

        res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) { next(error); }
};

// ========== Organizer Password Reset Requests ==========

/**
 * @desc    Submit a password reset request (organizer only)
 * @route   POST /api/users/password-reset-request
 */
const requestPasswordReset = async (req, res, next) => {
    try {
        if (req.user.role !== ROLES.ORGANIZER) {
            throw new ApiError(403, 'Only organizers can request password resets through admin');
        }

        const { reason } = req.body;
        if (!reason || !reason.trim()) {
            throw new ApiError(400, 'Please provide a reason for the password reset');
        }

        // Check for existing pending request
        const existing = await PasswordResetRequest.findOne({
            organizerId: req.user.id,
            status: 'pending',
        });
        if (existing) {
            throw new ApiError(400, 'You already have a pending password reset request');
        }

        const request = await PasswordResetRequest.create({
            organizerId: req.user.id,
            reason: reason.trim(),
        });

        res.status(201).json({
            success: true,
            message: 'Password reset request submitted. Admin will review it shortly.',
            data: { request },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Get my password reset request history (organizer only)
 * @route   GET /api/users/password-reset-requests
 */
const getMyResetRequests = async (req, res, next) => {
    try {
        const requests = await PasswordResetRequest.find({ organizerId: req.user.id })
            .sort({ createdAt: -1 })
            .select('-newPassword');

        res.json({ success: true, data: { requests } });
    } catch (error) { next(error); }
};

module.exports = {
    getProfile, updateProfile, getPreferences, updatePreferences,
    followOrganizer, unfollowOrganizer, changePassword,
    requestPasswordReset, getMyResetRequests,
};
