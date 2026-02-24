const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
    {
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        content: {
            type: String,
            required: [true, 'Message content is required'],
            trim: true,
            maxlength: [2000, 'Message cannot exceed 2000 characters'],
        },
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },
        type: {
            type: String,
            enum: ['message', 'announcement'],
            default: 'message',
        },
        pinned: {
            type: Boolean,
            default: false,
        },
        reactions: {
            type: Map,
            of: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            default: {},
        },
        deleted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Index for efficient querying
messageSchema.index({ eventId: 1, createdAt: -1 });
messageSchema.index({ parentId: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
