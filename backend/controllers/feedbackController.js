const Feedback = require('../models/Feedback');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');

/**
 * @desc    Submit anonymous feedback for an attended event
 * @route   POST /api/events/:id/feedback
 * @access  Participant (must have attended)
 */
const submitFeedback = async (req, res, next) => {
    try {
        const eventId = req.params.id;
        const userId = req.user.id;

        // Verify event exists and is completed or closed
        const event = await Event.findById(eventId);
        if (!event) throw new ApiError(404, 'Event not found');

        // Verify participant attended the event
        const registration = await Registration.findOne({
            userId,
            eventId,
            attended: true,
        });
        if (!registration) {
            throw new ApiError(403, 'You must have attended this event to leave feedback');
        }

        const { rating, comment } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            throw new ApiError(400, 'Rating must be between 1 and 5');
        }

        // Generate anonymous hash
        const userHash = Feedback.hashUser(userId, eventId);

        // Check if already submitted (upsert not used — explicit error)
        const existing = await Feedback.findOne({ eventId, userHash });
        if (existing) {
            throw new ApiError(400, 'You have already submitted feedback for this event');
        }

        const feedback = await Feedback.create({
            eventId,
            userHash,
            rating: Math.round(rating),
            comment: (comment || '').trim().slice(0, 2000),
        });

        res.status(201).json({
            success: true,
            message: 'Thank you! Your anonymous feedback has been submitted.',
            data: { feedback: { rating: feedback.rating, comment: feedback.comment, createdAt: feedback.createdAt } },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Check if current user already submitted feedback
 * @route   GET /api/events/:id/feedback/mine
 * @access  Participant
 */
const getMyFeedback = async (req, res, next) => {
    try {
        const userHash = Feedback.hashUser(req.user.id, req.params.id);
        const feedback = await Feedback.findOne({ eventId: req.params.id, userHash })
            .select('rating comment createdAt');

        res.json({
            success: true,
            data: { submitted: !!feedback, feedback: feedback || null },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Get aggregated feedback stats for an event (organizer)
 * @route   GET /api/organizer/events/:id/feedback/stats
 * @access  Organizer (event owner)
 */
const getFeedbackStats = async (req, res, next) => {
    try {
        const eventId = req.params.id;

        // Verify organizer owns the event
        const event = await Event.findOne({ _id: eventId, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found or you do not own it');

        const stats = await Feedback.aggregate([
            { $match: { eventId: event._id } },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    averageRating: { $avg: '$rating' },
                    minRating: { $min: '$rating' },
                    maxRating: { $max: '$rating' },
                },
            },
        ]);

        // Rating distribution (1–5)
        const distribution = await Feedback.aggregate([
            { $match: { eventId: event._id } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);

        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        distribution.forEach((d) => { ratingDistribution[d._id] = d.count; });

        const summary = stats[0] || { totalCount: 0, averageRating: 0, minRating: 0, maxRating: 0 };
        summary.averageRating = Math.round((summary.averageRating || 0) * 100) / 100;

        res.json({
            success: true,
            data: {
                eventName: event.name,
                stats: summary,
                ratingDistribution,
            },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Get paginated feedback list for an event (organizer), filterable by rating
 * @route   GET /api/organizer/events/:id/feedback
 * @access  Organizer (event owner)
 * @query   rating (1-5), page, limit
 */
const getFeedbackList = async (req, res, next) => {
    try {
        const eventId = req.params.id;

        const event = await Event.findOne({ _id: eventId, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found or you do not own it');

        const { rating, page = 1, limit = 20 } = req.query;

        const filter = { eventId: event._id };
        if (rating) {
            const r = parseInt(rating, 10);
            if (r >= 1 && r <= 5) filter.rating = r;
        }

        const total = await Feedback.countDocuments(filter);
        const feedbacks = await Feedback.find(filter)
            .select('rating comment createdAt')         // never expose userHash
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit, 10));

        res.json({
            success: true,
            data: {
                feedbacks,
                pagination: {
                    total,
                    page: parseInt(page, 10),
                    pages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Export feedback as CSV (organizer)
 * @route   GET /api/organizer/events/:id/feedback/export
 * @access  Organizer (event owner)
 * @query   rating (optional filter)
 */
const exportFeedbackCSV = async (req, res, next) => {
    try {
        const eventId = req.params.id;

        const event = await Event.findOne({ _id: eventId, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found or you do not own it');

        const filter = { eventId: event._id };
        if (req.query.rating) {
            const r = parseInt(req.query.rating, 10);
            if (r >= 1 && r <= 5) filter.rating = r;
        }

        const feedbacks = await Feedback.find(filter)
            .select('rating comment createdAt')
            .sort({ createdAt: -1 });

        // Build CSV
        const header = 'Rating,Comment,Date\n';
        const rows = feedbacks.map((f) => {
            const safeComment = `"${(f.comment || '').replace(/"/g, '""')}"`;
            return `${f.rating},${safeComment},${f.createdAt.toISOString()}`;
        }).join('\n');

        const csv = header + rows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${event.name.replace(/[^a-z0-9]/gi, '_')}_feedback.csv"`);
        res.send(csv);
    } catch (error) { next(error); }
};

module.exports = {
    submitFeedback,
    getMyFeedback,
    getFeedbackStats,
    getFeedbackList,
    exportFeedbackCSV,
};
