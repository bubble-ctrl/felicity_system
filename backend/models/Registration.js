const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
        },
        status: {
            type: String,
            enum: ['registered', 'pending_approval', 'cancelled', 'completed', 'rejected'],
            default: 'registered',
        },
        // Unique ticket identifier (auto-generated)
        ticketId: {
            type: String,
            unique: true,
            required: true,
        },
        // QR code as data URI (base64 PNG) — only generated after approval for merch
        qrCode: {
            type: String,
        },
        // Responses to custom form fields (JSON)
        formResponses: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        // For merchandise events: selected variant ID + quantity
        merchandiseVariant: {
            variantId: { type: mongoose.Schema.Types.ObjectId },
            quantity: { type: Number, default: 1 },
        },
        // Payment proof image (base64 data URI) — for merchandise approval workflow
        paymentProof: {
            type: String,
            default: null,
        },
        // Attendance tracking
        attended: {
            type: Boolean,
            default: false,
        },
        attendedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

// One registration per user per event
registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });
registrationSchema.index({ eventId: 1, status: 1 });

const Registration = mongoose.model('Registration', registrationSchema);
module.exports = Registration;
