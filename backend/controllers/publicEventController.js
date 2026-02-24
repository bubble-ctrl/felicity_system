const Event = require('../models/Event');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { EVENT_STATUSES, ROLES } = require('../config/constants');

/**
 * Auto-update event status based on current time vs start/end dates.
 * Per clarification: whenever an event is displayed, its status should be
 * determined by comparing the current time with start and end times.
 * Only applies to published/ongoing events (not drafts or manually closed/completed).
 */
const autoUpdateEventStatus = async (event) => {
    if (!event || !event.status) return event;

    const now = new Date();
    let newStatus = null;

    if (event.status === EVENT_STATUSES.PUBLISHED && event.startDate && new Date(event.startDate) <= now) {
        // Published event whose start date has passed → Ongoing
        newStatus = EVENT_STATUSES.ONGOING;
    } else if (event.status === EVENT_STATUSES.ONGOING && event.endDate && new Date(event.endDate) <= now) {
        // Ongoing event whose end date has passed → Completed
        newStatus = EVENT_STATUSES.COMPLETED;
    }

    if (newStatus && newStatus !== event.status) {
        await Event.updateOne({ _id: event._id }, { status: newStatus });
        event.status = newStatus;
    }

    return event;
};

/**
 * @desc    Browse published events with search, filters, pagination + recommendations
 * @route   GET /api/events
 * @access  Public (but enhanced if authenticated)
 */
const browseEvents = async (req, res, next) => {
    try {
        const {
            search, type, eligibility, tags,
            startFrom, startTo, followedOnly,
            page = 1, limit = 12,
            sort = 'recommended',
        } = req.query;

        const filter = {
            status: { $in: [EVENT_STATUSES.PUBLISHED, EVENT_STATUSES.ONGOING] },
        };

        // --- Fuzzy / partial search on event name + organizer name ---
        let organizerIds = null;
        if (search) {
            // Build fuzzy regex pattern: "hack" → "h.*a.*c.*k" for partial matching
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fuzzyPattern = escaped.split('').join('.*');
            const fuzzyRegex = new RegExp(fuzzyPattern, 'i');
            const normalRegex = new RegExp(escaped, 'i');

            // Search organizers by name
            const matchingOrganizers = await User.find({
                role: ROLES.ORGANIZER,
                organizerName: { $regex: normalRegex },
            }).select('_id');
            organizerIds = matchingOrganizers.map((o) => o._id);

            filter.$or = [
                { name: { $regex: normalRegex } },
                { name: { $regex: fuzzyRegex } },
                { description: { $regex: normalRegex } },
                ...(organizerIds.length ? [{ organizerId: { $in: organizerIds } }] : []),
            ];
        }

        // --- Filters ---
        if (type) filter.type = type;
        if (eligibility) filter.eligibility = eligibility;
        if (tags) {
            const tagArr = tags.split(',').map((t) => t.trim().toLowerCase());
            filter.tags = { $in: tagArr };
        }
        if (startFrom || startTo) {
            filter.startDate = {};
            if (startFrom) filter.startDate.$gte = new Date(startFrom);
            if (startTo) filter.startDate.$lte = new Date(startTo);
        }

        // Followed clubs filter: only show events from followed organizers
        let userFollowed = [];
        let userInterests = [];
        if (req.user) {
            const currentUser = await User.findById(req.user.id).select('followedClubs interests');
            if (currentUser) {
                userFollowed = currentUser.followedClubs || [];
                userInterests = (currentUser.interests || []).map((i) => i.toLowerCase());
            }
        }

        if (followedOnly === 'true' && userFollowed.length > 0) {
            filter.organizerId = { $in: userFollowed };
        }

        // --- Sorting ---
        const sortMap = {
            startDate: { startDate: 1 },
            '-startDate': { startDate: -1 },
            name: { name: 1 },
            newest: { createdAt: -1 },
            popular: { viewCount: -1 },
            recommended: { createdAt: -1 }, // default; we re-sort below
        };
        const sortOption = sortMap[sort] || sortMap.recommended;

        const skip = (Number(page) - 1) * Number(limit);

        let events = await Event.find(filter)
            .populate('organizerId', 'organizerName email category')
            .sort(sortOption)
            .skip(skip)
            .limit(Number(limit));

        // Auto-update event statuses based on current time
        await Promise.all(events.map(e => autoUpdateEventStatus(e)));

        // --- Recommendation scoring (only for 'recommended' sort) ---
        if (sort === 'recommended' && (userFollowed.length > 0 || userInterests.length > 0)) {
            events = events.map((e) => {
                let score = 0;
                // Boost if from followed organizer
                if (userFollowed.some((f) => f.toString() === e.organizerId?._id?.toString())) score += 10;
                // Boost if tags match user interests
                const eventTags = (e.tags || []).map((t) => t.toLowerCase());
                const matchCount = eventTags.filter((t) => userInterests.includes(t)).length;
                score += matchCount * 3;
                return { ...e.toObject(), _score: score };
            });
            events.sort((a, b) => b._score - a._score);
        }

        const total = await Event.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: events.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            data: { events },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Get single event details (published/ongoing/closed/completed)
 * @route   GET /api/events/:id
 */
const getEventDetails = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizerId', 'organizerName email category description');

        if (!event) throw new ApiError(404, 'Event not found');
        if (event.status === EVENT_STATUSES.DRAFT) throw new ApiError(404, 'Event not found');

        // Auto-update status based on current time
        await autoUpdateEventStatus(event);

        // Increment view count atomically (avoids double-counting from React StrictMode)
        await Event.updateOne({ _id: event._id }, { $inc: { viewCount: 1 } });
        event.viewCount = (event.viewCount || 0) + 1; // reflect in response

        res.status(200).json({ success: true, data: { event } });
    } catch (error) { next(error); }
};

/**
 * @desc    Get trending events (top 5 by views)
 * @route   GET /api/events/trending
 */
const getTrendingEvents = async (req, res, next) => {
    try {
        const events = await Event.find({
            status: { $in: [EVENT_STATUSES.PUBLISHED, EVENT_STATUSES.ONGOING] },
        })
            .populate('organizerId', 'organizerName category')
            .sort({ viewCount: -1 })
            .limit(5);

        res.status(200).json({ success: true, count: events.length, data: { events } });
    } catch (error) { next(error); }
};

module.exports = { browseEvents, getEventDetails, getTrendingEvents };
