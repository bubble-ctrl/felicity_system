const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { EVENT_STATUSES } = require('../config/constants');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { sendRegistrationEmail } = require('../utils/email');

/**
 * @desc    Register for an event (normal or merchandise)
 * @route   POST /api/events/:id/register
 * @access  Authenticated participant
 */
const registerForEvent = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) throw new ApiError(404, 'Event not found');

        // Must be published or ongoing to register
        if (![EVENT_STATUSES.PUBLISHED, EVENT_STATUSES.ONGOING].includes(event.status)) {
            throw new ApiError(400, 'Registrations are not open for this event');
        }

        // Check registration deadline
        if (event.registrationDeadline && new Date(event.registrationDeadline) < new Date()) {
            throw new ApiError(400, 'Registration deadline has passed');
        }

        // Eligibility check (IIIT-only events)
        const user = await User.findById(req.user.id);
        if (event.eligibility === 'iiit' && user.participantType !== 'iiit') {
            throw new ApiError(403, 'This event is restricted to IIIT students');
        }

        // Duplicate check
        const existing = await Registration.findOne({
            userId: req.user.id,
            eventId: event._id,
            status: { $nin: ['cancelled', 'rejected'] },
        });
        if (existing) throw new ApiError(400, 'You are already registered for this event');

        // Generate ticket ID (always — used as identifier)
        const ticketId = `FEL-${uuidv4().slice(0, 8).toUpperCase()}`;

        // --- Merchandise-specific flow (payment approval) ---
        if (event.type === 'merchandise') {
            const { variantId, quantity = 1 } = req.body;
            if (!variantId) throw new ApiError(400, 'Please select a variant');

            const selectedVariant = event.merchandiseDetails.variants.id(variantId);
            if (!selectedVariant) throw new ApiError(400, 'Invalid variant selected');

            // Stock check
            if (selectedVariant.stock < quantity) {
                throw new ApiError(400, `Insufficient stock. Only ${selectedVariant.stock} remaining.`);
            }

            // Per-user purchase limit
            const userPurchaseCount = await Registration.countDocuments({
                userId: req.user.id, eventId: event._id, status: { $in: ['registered', 'pending_approval'] },
            });
            const limit = event.merchandiseDetails.purchaseLimit || 1;
            if (userPurchaseCount + quantity > limit) {
                throw new ApiError(400, `Purchase limit is ${limit} per user`);
            }

            // Create registration as PENDING — no QR yet, no stock decrement yet
            const registration = await Registration.create({
                userId: req.user.id,
                eventId: event._id,
                ticketId,
                status: 'pending_approval',
                formResponses: req.body.formResponses || null,
                merchandiseVariant: { variantId: selectedVariant._id, quantity },
            });

            const populatedReg = await Registration.findById(registration._id)
                .populate({
                    path: 'eventId',
                    select: 'name type status startDate endDate fee organizerId',
                    populate: { path: 'organizerId', select: 'organizerName' },
                });

            return res.status(201).json({
                success: true,
                message: 'Order placed! Please upload payment proof for approval.',
                data: { registration: populatedReg },
            });
        }

        // --- Normal event flow ---
        if (event.registrationLimit && event.registrationCount >= event.registrationLimit) {
            throw new ApiError(400, 'Event is full — no spots remaining');
        }

        // Generate QR code (immediate for normal events)
        const qrData = JSON.stringify({ ticketId, event: event.name, user: user.email });
        const qrCode = await QRCode.toDataURL(qrData);

        const registration = await Registration.create({
            userId: req.user.id,
            eventId: event._id,
            ticketId,
            qrCode,
            formResponses: req.body.formResponses || null,
        });

        // Update event counters
        event.registrationCount = (event.registrationCount || 0) + 1;
        event.revenue = (event.revenue || 0) + (event.fee || 0);
        await event.save();

        // Send confirmation email (fire-and-forget)
        sendRegistrationEmail({ to: user.email, eventName: event.name, ticketId, qrCode });

        const populatedReg = await Registration.findById(registration._id)
            .populate({
                path: 'eventId',
                select: 'name type status startDate endDate fee organizerId',
                populate: { path: 'organizerId', select: 'organizerName' },
            });

        res.status(201).json({
            success: true,
            message: 'Registration successful! Ticket generated.',
            data: { registration: populatedReg },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Upload payment proof for a pending merchandise order
 * @route   PATCH /api/users/registrations/:id/payment-proof
 * @access  Authenticated participant
 */
const uploadPaymentProof = async (req, res, next) => {
    try {
        const reg = await Registration.findById(req.params.id);
        if (!reg) throw new ApiError(404, 'Registration not found');
        if (reg.userId.toString() !== req.user.id) throw new ApiError(403, 'Not authorized');
        if (reg.status !== 'pending_approval') throw new ApiError(400, 'Payment proof can only be uploaded for pending orders');

        const { paymentProof } = req.body;
        if (!paymentProof) throw new ApiError(400, 'Payment proof image is required');

        reg.paymentProof = paymentProof;
        await reg.save();

        res.status(200).json({ success: true, message: 'Payment proof uploaded', data: { registration: reg } });
    } catch (error) { next(error); }
};

/**
 * @desc    Approve a merchandise payment (organizer)
 * @route   PATCH /api/organizer/registrations/:id/approve
 * @access  Organizer
 */
const approvePayment = async (req, res, next) => {
    try {
        const reg = await Registration.findById(req.params.id).populate('eventId');
        if (!reg) throw new ApiError(404, 'Registration not found');
        if (reg.eventId.organizerId.toString() !== req.user.id) throw new ApiError(403, 'Not authorized — not your event');
        if (reg.status !== 'pending_approval') throw new ApiError(400, 'Only pending orders can be approved');

        const event = await Event.findById(reg.eventId._id);
        const user = await User.findById(reg.userId);

        // Decrement stock now
        if (reg.merchandiseVariant?.variantId) {
            const variant = event.merchandiseDetails.variants.id(reg.merchandiseVariant.variantId);
            if (!variant) throw new ApiError(400, 'Variant not found');
            const qty = reg.merchandiseVariant.quantity || 1;
            if (variant.stock < qty) throw new ApiError(400, `Insufficient stock. Only ${variant.stock} remaining.`);
            variant.stock -= qty;
            event.revenue = (event.revenue || 0) + (variant.price * qty);
        }
        event.registrationCount = (event.registrationCount || 0) + 1;
        await event.save();

        // Generate QR code + update status
        const qrData = JSON.stringify({ ticketId: reg.ticketId, event: event.name, user: user.email });
        const qrCode = await QRCode.toDataURL(qrData);

        reg.status = 'registered';
        reg.qrCode = qrCode;
        await reg.save();

        // Send confirmation email
        sendRegistrationEmail({ to: user.email, eventName: event.name, ticketId: reg.ticketId, qrCode });

        res.status(200).json({ success: true, message: 'Payment approved — ticket generated', data: { registration: reg } });
    } catch (error) { next(error); }
};

/**
 * @desc    Reject a merchandise payment (organizer)
 * @route   PATCH /api/organizer/registrations/:id/reject
 * @access  Organizer
 */
const rejectPayment = async (req, res, next) => {
    try {
        const reg = await Registration.findById(req.params.id).populate('eventId');
        if (!reg) throw new ApiError(404, 'Registration not found');
        if (reg.eventId.organizerId.toString() !== req.user.id) throw new ApiError(403, 'Not authorized — not your event');
        if (reg.status !== 'pending_approval') throw new ApiError(400, 'Only pending orders can be rejected');

        reg.status = 'rejected';
        await reg.save();

        res.status(200).json({ success: true, message: 'Payment rejected', data: { registration: reg } });
    } catch (error) { next(error); }
};

/**
 * @desc    Cancel own registration
 * @route   PATCH /api/registrations/:id/cancel
 * @access  Authenticated participant
 */
const cancelRegistration = async (req, res, next) => {
    try {
        const reg = await Registration.findById(req.params.id).populate('eventId');
        if (!reg) throw new ApiError(404, 'Registration not found');
        if (reg.userId.toString() !== req.user.id) throw new ApiError(403, 'Not authorized');
        if (reg.status === 'cancelled') throw new ApiError(400, 'Already cancelled');

        const wasApproved = reg.status === 'registered';
        reg.status = 'cancelled';
        await reg.save();

        // Only restore counters/stock if was actually approved
        if (wasApproved) {
            if (reg.eventId.type === 'merchandise' && reg.merchandiseVariant?.variantId) {
                const event = await Event.findById(reg.eventId._id);
                const variant = event.merchandiseDetails.variants.id(reg.merchandiseVariant.variantId);
                if (variant) {
                    variant.stock += (reg.merchandiseVariant.quantity || 1);
                    event.registrationCount = Math.max(0, (event.registrationCount || 1) - 1);
                    event.revenue = Math.max(0, (event.revenue || 0) - (variant.price * (reg.merchandiseVariant.quantity || 1)));
                    await event.save();
                }
            } else {
                await Event.findByIdAndUpdate(reg.eventId._id, { $inc: { registrationCount: -1 } });
            }
        }

        res.status(200).json({ success: true, message: 'Registration cancelled', data: { registration: reg } });
    } catch (error) { next(error); }
};

/**
 * @desc    Mark attendance for a registration (organizer action)
 * @route   PATCH /api/organizer/registrations/:id/attendance
 * @access  Organizer
 */
const markAttendance = async (req, res, next) => {
    try {
        const reg = await Registration.findById(req.params.id).populate('eventId');
        if (!reg) throw new ApiError(404, 'Registration not found');
        if (reg.eventId.organizerId.toString() !== req.user.id) throw new ApiError(403, 'Not authorized — not your event');
        if (reg.attended) throw new ApiError(400, 'Attendance already marked');
        if (reg.status !== 'registered') throw new ApiError(400, 'Only approved registrations can be marked for attendance');

        reg.attended = true;
        reg.attendedAt = new Date();
        await reg.save();

        await Event.findByIdAndUpdate(reg.eventId._id, { $inc: { attendanceCount: 1 } });

        res.status(200).json({ success: true, message: 'Attendance marked', data: { registration: reg } });
    } catch (error) { next(error); }
};

/**
 * @desc    Scan QR code to mark attendance (organizer)
 * @route   POST /api/organizer/events/:id/scan-qr
 * @access  Organizer
 */
const scanQRCode = async (req, res, next) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found');

        const { ticketId } = req.body;
        if (!ticketId) throw new ApiError(400, 'Ticket ID is required');

        const reg = await Registration.findOne({ eventId: event._id, ticketId })
            .populate('userId', 'firstName lastName email');

        if (!reg) throw new ApiError(404, 'Invalid ticket — no registration found for this event');
        if (reg.status !== 'registered') throw new ApiError(400, `Ticket status is "${reg.status}" — cannot mark attendance`);
        if (reg.attended) {
            throw new ApiError(400, `Already scanned — ${reg.userId?.firstName} ${reg.userId?.lastName} was marked present at ${new Date(reg.attendedAt).toLocaleString()}`);
        }

        reg.attended = true;
        reg.attendedAt = new Date();
        await reg.save();

        await Event.findByIdAndUpdate(event._id, { $inc: { attendanceCount: 1 } });

        res.status(200).json({
            success: true,
            message: `✅ ${reg.userId?.firstName} ${reg.userId?.lastName} marked present`,
            data: {
                participant: {
                    name: `${reg.userId?.firstName} ${reg.userId?.lastName}`,
                    email: reg.userId?.email,
                    ticketId: reg.ticketId,
                    attendedAt: reg.attendedAt,
                },
            },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Get attendance dashboard data for an event
 * @route   GET /api/organizer/events/:id/attendance
 * @access  Organizer
 */
const getAttendanceDashboard = async (req, res, next) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found');

        const allRegs = await Registration.find({ eventId: event._id, status: 'registered' })
            .populate('userId', 'firstName lastName email')
            .sort({ attendedAt: -1 });

        const scanned = allRegs.filter((r) => r.attended);
        const notScanned = allRegs.filter((r) => !r.attended);

        res.status(200).json({
            success: true,
            data: {
                total: allRegs.length,
                scannedCount: scanned.length,
                notScannedCount: notScanned.length,
                recentScans: scanned.slice(0, 20).map((r) => ({
                    name: `${r.userId?.firstName} ${r.userId?.lastName}`,
                    email: r.userId?.email,
                    ticketId: r.ticketId,
                    attendedAt: r.attendedAt,
                })),
                notYetScanned: notScanned.map((r) => ({
                    name: `${r.userId?.firstName} ${r.userId?.lastName}`,
                    email: r.userId?.email,
                    ticketId: r.ticketId,
                })),
            },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Get all registrations for current user
 * @route   GET /api/users/registrations
 * @access  Authenticated
 */
const getMyRegistrations = async (req, res, next) => {
    try {
        const registrations = await Registration.find({ userId: req.user.id })
            .populate({
                path: 'eventId',
                select: 'name type status startDate endDate fee organizerId',
                populate: { path: 'organizerId', select: 'organizerName' },
            })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: registrations.length,
            data: { registrations },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Get registrations for an organizer's event
 * @route   GET /api/organizer/events/:id/registrations
 * @access  Organizer
 */
const getEventRegistrations = async (req, res, next) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found');

        const { search, status } = req.query;
        const filter = { eventId: event._id };
        if (status) filter.status = status;

        let registrations = await Registration.find(filter)
            .populate('userId', 'firstName lastName email contactNumber participantType collegeOrOrg')
            .sort({ createdAt: -1 });

        if (search) {
            const s = search.toLowerCase();
            registrations = registrations.filter((r) => {
                const uName = `${r.userId?.firstName || ''} ${r.userId?.lastName || ''}`.toLowerCase();
                return uName.includes(s) || (r.userId?.email || '').toLowerCase().includes(s);
            });
        }

        res.status(200).json({
            success: true,
            count: registrations.length,
            data: {
                registrations,
                event: { name: event.name, type: event.type, registrationCount: event.registrationCount, attendanceCount: event.attendanceCount, revenue: event.revenue },
            },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Export registrations as CSV
 * @route   GET /api/organizer/events/:id/export
 * @access  Organizer
 */
const exportCSV = async (req, res, next) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
        if (!event) throw new ApiError(404, 'Event not found');

        const registrations = await Registration.find({ eventId: event._id })
            .populate('userId', 'firstName lastName email contactNumber participantType collegeOrOrg');

        const header = 'Name,Email,Contact,Type,College,TicketID,Status,Attended,RegisteredAt\n';
        const rows = registrations.map((r) => {
            const u = r.userId || {};
            return [
                `"${(u.firstName || '')} ${(u.lastName || '')}"`,
                u.email || '', u.contactNumber || '', u.participantType || '',
                `"${u.collegeOrOrg || ''}"`, r.ticketId, r.status,
                r.attended ? 'Yes' : 'No',
                r.createdAt ? new Date(r.createdAt).toISOString() : '',
            ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_participants.csv"`);
        res.status(200).send(header + rows);
    } catch (error) { next(error); }
};

module.exports = {
    registerForEvent,
    uploadPaymentProof,
    approvePayment,
    rejectPayment,
    cancelRegistration,
    markAttendance,
    scanQRCode,
    getAttendanceDashboard,
    getMyRegistrations,
    getEventRegistrations,
    exportCSV,
};
