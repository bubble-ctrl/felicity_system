const User = require('../models/User');
const Event = require('../models/Event');
const { ROLES, EVENT_STATUSES } = require('../config/constants');

/**
 * @desc    List all active organizers (public)
 * @route   GET /api/organizers
 */
const listOrganizers = async (req, res, next) => {
    try {
        const organizers = await User.find({ role: ROLES.ORGANIZER, isActive: true })
            .select('organizerName category description email contactNumber');

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
 * @desc    Get organizer detail with upcoming/past events (public)
 * @route   GET /api/organizers/:id
 */
const getOrganizerDetail = async (req, res, next) => {
    try {
        const organizer = await User.findOne({
            _id: req.params.id,
            role: ROLES.ORGANIZER,
            isActive: true,
        }).select('organizerName category description email contactNumber');

        if (!organizer) {
            throw new (require('../utils/ApiError'))(404, 'Organizer not found');
        }

        const now = new Date();
        const [upcoming, past] = await Promise.all([
            Event.find({
                organizerId: organizer._id,
                status: { $in: [EVENT_STATUSES.PUBLISHED, EVENT_STATUSES.ONGOING] },
                startDate: { $gte: now },
            }).select('name type startDate endDate fee eligibility tags status').sort({ startDate: 1 }).limit(20),
            Event.find({
                organizerId: organizer._id,
                status: { $in: [EVENT_STATUSES.CLOSED, EVENT_STATUSES.COMPLETED] },
            }).select('name type startDate endDate fee eligibility tags status').sort({ startDate: -1 }).limit(20),
        ]);

        res.status(200).json({
            success: true,
            data: { organizer, upcoming, past },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { listOrganizers, getOrganizerDetail };
