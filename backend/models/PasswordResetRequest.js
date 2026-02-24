const mongoose = require('mongoose');

const passwordResetRequestSchema = new mongoose.Schema(
    {
        organizerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        reason: {
            type: String,
            required: [true, 'Reason is required'],
            trim: true,
            maxlength: [500, 'Reason cannot exceed 500 characters'],
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        adminComment: {
            type: String,
            trim: true,
            default: '',
        },
        newPassword: {
            type: String,
            default: null,
        },
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        processedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

const PasswordResetRequest = mongoose.model('PasswordResetRequest', passwordResetRequestSchema);

module.exports = PasswordResetRequest;
