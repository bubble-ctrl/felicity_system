const mongoose = require('mongoose');
const { EVENT_TYPES, EVENT_STATUSES } = require('../config/constants');

// --- Merchandise variant sub-schema ---
const variantSchema = new mongoose.Schema({
    label: { type: String, trim: true },       // e.g. "Red / XL"
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    stock: { type: Number, default: 0, min: 0 },
    price: { type: Number, default: 0, min: 0 },
}, { _id: true });

const eventSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Event name is required'],
            trim: true,
            maxlength: [150, 'Event name cannot exceed 150 characters'],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [5000, 'Description cannot exceed 5000 characters'],
        },
        type: {
            type: String,
            enum: Object.values(EVENT_TYPES),
            default: EVENT_TYPES.NORMAL,
        },
        eligibility: {
            type: String,
            enum: ['iiit', 'open'],
            default: 'open',
        },
        registrationDeadline: { type: Date },
        startDate: { type: Date },
        endDate: { type: Date },
        registrationLimit: {
            type: Number,
            min: [0, 'Registration limit cannot be negative'],
        },
        fee: {
            type: Number,
            default: 0,
            min: [0, 'Fee cannot be negative'],
        },
        organizerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Organizer is required'],
        },
        tags: [{ type: String, trim: true, lowercase: true }],
        status: {
            type: String,
            enum: Object.values(EVENT_STATUSES),
            default: EVENT_STATUSES.DRAFT,
        },

        // --- Custom registration form (JSON array of field definitions) ---
        // Example: [{ label:"Name", type:"text", required:true }, { label:"Size", type:"dropdown", options:["S","M","L"], required:false }]
        customForm: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        // --- Merchandise-specific fields ---
        merchandiseDetails: {
            variants: [variantSchema],
            purchaseLimit: { type: Number, default: 1, min: 1 }, // max purchases per user
        },

        // --- Tracking ---
        registrationCount: { type: Number, default: 0 },
        viewCount: { type: Number, default: 0 },
        attendanceCount: { type: Number, default: 0 },
        revenue: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Indexes for querying
eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ organizerId: 1 });
eventSchema.index({ tags: 1 });
eventSchema.index({ name: 'text', description: 'text' });

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
