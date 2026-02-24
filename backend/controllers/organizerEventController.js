const Event = require('../models/Event');
const User = require('../models/User');
const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const { EVENT_STATUSES } = require('../config/constants');

/**
 * Auto-update event status based on current time vs start/end dates.
 */
const autoUpdateEventStatus = async (event) => {
    if (!event || !event.status) return event;
    const now = new Date();
    let newStatus = null;
    if (event.status === EVENT_STATUSES.PUBLISHED && event.startDate && new Date(event.startDate) <= now) {
        newStatus = EVENT_STATUSES.ONGOING;
    } else if (event.status === EVENT_STATUSES.ONGOING && event.endDate && new Date(event.endDate) <= now) {
        newStatus = EVENT_STATUSES.COMPLETED;
    }
    if (newStatus && newStatus !== event.status) {
        await Event.updateOne({ _id: event._id }, { status: newStatus });
        event.status = newStatus;
    }
    return event;
};

// Valid lifecycle transitions: Draft → Published → Ongoing → Closed → Completed
const LIFECYCLE = {
    [EVENT_STATUSES.DRAFT]: [EVENT_STATUSES.PUBLISHED],
    [EVENT_STATUSES.PUBLISHED]: [EVENT_STATUSES.ONGOING, EVENT_STATUSES.CLOSED],
    [EVENT_STATUSES.ONGOING]: [EVENT_STATUSES.CLOSED],
    [EVENT_STATUSES.CLOSED]: [EVENT_STATUSES.COMPLETED],
    [EVENT_STATUSES.COMPLETED]: [],
};

/**
 * @desc    Create a new event (draft)
 * @route   POST /api/organizer/events
 */
const createEvent = async (req, res, next) => {
    try {
        const {
            name, description, type, eligibility,
            registrationDeadline, startDate, endDate,
            registrationLimit, fee, tags, customForm,
            merchandiseDetails,
        } = req.body;

        const event = await Event.create({
            name, description, type, eligibility,
            registrationDeadline, startDate, endDate,
            registrationLimit, fee,
            tags: tags || [],
            customForm: customForm || null,
            merchandiseDetails: type === 'merchandise' ? merchandiseDetails : undefined,
            organizerId: req.user.id,
            status: EVENT_STATUSES.DRAFT,
        });

        res.status(201).json({ success: true, message: 'Event created as draft', data: { event } });
    } catch (error) { next(error); }
};

/**
 * @desc    Get all events for current organizer (with aggregate analytics)
 * @route   GET /api/organizer/events
 */
const getMyEvents = async (req, res, next) => {
    try {
        const events = await Event.find({ organizerId: req.user.id }).sort({ updatedAt: -1 });

        // Auto-update event statuses based on current time
        await Promise.all(events.map(e => autoUpdateEventStatus(e)));

        // Aggregate analytics across all events
        const analytics = {
            totalEvents: events.length,
            totalRegistrations: events.reduce((sum, e) => sum + (e.registrationCount || 0), 0),
            totalAttendance: events.reduce((sum, e) => sum + (e.attendanceCount || 0), 0),
            totalRevenue: events.reduce((sum, e) => sum + (e.revenue || 0), 0),
        };

        res.status(200).json({ success: true, count: events.length, data: { events, analytics } });
    } catch (error) { next(error); }
};

/**
 * @desc    Get single event (own) with analytics
 * @route   GET /api/organizer/events/:id
 */
const getMyEvent = async (req, res, next) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found');

        // Auto-update status based on current time
        await autoUpdateEventStatus(event);

        res.status(200).json({ success: true, data: { event } });
    } catch (error) { next(error); }
};

/**
 * @desc    Update event — editing restrictions per assignment:
 *          Draft: free edit all fields
 *          Published: only description, extend deadline, increase limit
 *          Ongoing/Completed: no content edits
 * @route   PUT /api/organizer/events/:id
 */
const updateEvent = async (req, res, next) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found');

        if (event.status === EVENT_STATUSES.DRAFT) {
            // Draft: free edit all fields
            const draftFields = [
                'name', 'description', 'type', 'eligibility',
                'registrationDeadline', 'startDate', 'endDate',
                'registrationLimit', 'fee', 'tags', 'customForm',
                'merchandiseDetails',
            ];
            for (const field of draftFields) {
                if (req.body[field] !== undefined) event[field] = req.body[field];
            }
        } else if (event.status === EVENT_STATUSES.PUBLISHED) {
            // Published: limited edits — description, extend deadline, increase limit
            if (req.body.description !== undefined) event.description = req.body.description;
            if (req.body.registrationDeadline) {
                const newDeadline = new Date(req.body.registrationDeadline);
                if (!event.registrationDeadline || newDeadline >= event.registrationDeadline) {
                    event.registrationDeadline = newDeadline;
                } else {
                    throw new ApiError(400, 'Can only extend the deadline, not shorten it');
                }
            }
            if (req.body.registrationLimit !== undefined) {
                if (req.body.registrationLimit >= (event.registrationCount || 0)) {
                    event.registrationLimit = req.body.registrationLimit;
                } else {
                    throw new ApiError(400, 'Cannot reduce limit below current registration count');
                }
            }
            // CustomForm: lock if any registrations exist
            if (req.body.customForm !== undefined) {
                const regCount = await Registration.countDocuments({ eventId: event._id, status: 'registered' });
                if (regCount > 0) throw new ApiError(400, 'Cannot modify form after registrations have been received');
                event.customForm = req.body.customForm;
            }
        } else {
            // Ongoing / Closed / Completed: no content edits
            throw new ApiError(400, `Cannot edit event in "${event.status}" status. Only status changes are allowed.`);
        }

        await event.save();
        res.status(200).json({ success: true, message: 'Event updated successfully', data: { event } });
    } catch (error) { next(error); }
};

/**
 * Helper: transition event status with lifecycle validation
 */
const transitionStatus = (targetStatus) => async (req, res, next) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found');

        const allowed = LIFECYCLE[event.status] || [];
        if (!allowed.includes(targetStatus)) {
            throw new ApiError(400, `Cannot transition from "${event.status}" to "${targetStatus}"`);
        }

        // Validation before publishing
        if (targetStatus === EVENT_STATUSES.PUBLISHED) {
            if (!event.name) throw new ApiError(400, 'Event name is required before publishing');
            if (!event.startDate) throw new ApiError(400, 'Start date is required before publishing');
        }

        event.status = targetStatus;
        await event.save();

        // Discord webhook: auto-post when event is published
        if (targetStatus === EVENT_STATUSES.PUBLISHED) {
            try {
                const organizer = await User.findById(req.user.id);
                if (organizer?.discordWebhookUrl) {
                    const payload = {
                        embeds: [{
                            title: `🎉 New Event: ${event.name}`,
                            description: (event.description || '').slice(0, 300),
                            color: 0x74b9ff,
                            fields: [
                                { name: 'Type', value: event.type, inline: true },
                                { name: 'Eligibility', value: (event.eligibility || 'open').toUpperCase(), inline: true },
                                { name: 'Fee', value: event.fee > 0 ? `₹${event.fee}` : 'Free', inline: true },
                                { name: 'Start Date', value: event.startDate ? new Date(event.startDate).toLocaleDateString() : 'TBD', inline: true },
                            ],
                            footer: { text: `Organized by ${organizer.organizerName || 'Unknown'}` },
                            timestamp: new Date().toISOString(),
                        }],
                    };
                    fetch(organizer.discordWebhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    }).catch(() => { }); // fire-and-forget
                }
            } catch (_) { /* ignore webhook errors */ }
        }

        res.status(200).json({ success: true, message: `Event ${targetStatus} successfully`, data: { event } });
    } catch (error) { next(error); }
};

const publishEvent = transitionStatus(EVENT_STATUSES.PUBLISHED);
const startEvent = transitionStatus(EVENT_STATUSES.ONGOING);
const closeEvent = transitionStatus(EVENT_STATUSES.CLOSED);
const completeEvent = transitionStatus(EVENT_STATUSES.COMPLETED);

/**
 * @desc    Delete event (draft only)
 * @route   DELETE /api/organizer/events/:id
 */
const deleteEvent = async (req, res, next) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found');
        if (event.status !== EVENT_STATUSES.DRAFT) throw new ApiError(400, 'Only draft events can be deleted');

        await Event.deleteOne({ _id: event._id });
        res.status(200).json({ success: true, message: 'Draft event deleted' });
    } catch (error) { next(error); }
};

module.exports = {
    createEvent, getMyEvents, getMyEvent, updateEvent,
    publishEvent, startEvent, closeEvent, completeEvent, deleteEvent,
};
