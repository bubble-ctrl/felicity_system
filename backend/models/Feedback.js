const mongoose = require('mongoose');
const crypto = require('crypto');

const feedbackSchema = new mongoose.Schema(
    {
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
        },
        // Store a one-way hash of userId to ensure one-feedback-per-user while
        // keeping feedback anonymous — organizers can never see who submitted it.
        userHash: {
            type: String,
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: '',
        },
    },
    { timestamps: true }
);

// One feedback per user per event (enforced via hash)
feedbackSchema.index({ eventId: 1, userHash: 1 }, { unique: true });
feedbackSchema.index({ eventId: 1, rating: 1 });

/**
 * Generate a deterministic but irreversible hash for a user+event combo
 * so the system can prevent duplicates without exposing who submitted feedback.
 */
feedbackSchema.statics.hashUser = function (userId, eventId) {
    return crypto
        .createHash('sha256')
        .update(`${userId}:${eventId}:anonymous-feedback-salt`)
        .digest('hex');
};

const Feedback = mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;
