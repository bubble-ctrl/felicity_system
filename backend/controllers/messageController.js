const Message = require('../models/Message');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');

/**
 * Check if user has access to event forum.
 * Participants must be registered; organizers must own the event.
 */
const checkForumAccess = async (userId, userRole, eventId) => {
    if (userRole === 'organizer') {
        const event = await Event.findOne({ _id: eventId, organizerId: userId });
        if (!event) throw new ApiError(403, 'You do not own this event');
        return 'organizer';
    }
    // participant — must have active registration
    const reg = await Registration.findOne({
        userId,
        eventId,
        status: { $in: ['registered', 'completed'] },
    });
    if (!reg) throw new ApiError(403, 'You must be registered to access the forum');
    return 'participant';
};

/**
 * @desc    Get messages for an event (paginated)
 * @route   GET /api/events/:id/messages
 */
const getMessages = async (req, res, next) => {
    try {
        const eventId = req.params.id;
        await checkForumAccess(req.user.id, req.user.role, eventId);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        // Get top-level messages (non-deleted)
        const messages = await Message.find({
            eventId,
            parentId: null,
            deleted: false,
        })
            .populate('userId', 'firstName lastName organizerName role')
            .sort({ pinned: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        // Get reply counts for each message
        const messageIds = messages.map((m) => m._id);
        const replyCounts = await Message.aggregate([
            { $match: { parentId: { $in: messageIds }, deleted: false } },
            { $group: { _id: '$parentId', count: { $sum: 1 } } },
        ]);
        const replyMap = {};
        replyCounts.forEach((r) => { replyMap[r._id.toString()] = r.count; });

        const enriched = messages.map((m) => ({
            ...m,
            replyCount: replyMap[m._id.toString()] || 0,
        }));

        const total = await Message.countDocuments({ eventId, parentId: null, deleted: false });

        res.json({
            success: true,
            data: { messages: enriched, total, page, pages: Math.ceil(total / limit) },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Get replies for a message (thread)
 * @route   GET /api/messages/:id/replies
 */
const getReplies = async (req, res, next) => {
    try {
        const parent = await Message.findById(req.params.id);
        if (!parent) throw new ApiError(404, 'Message not found');

        await checkForumAccess(req.user.id, req.user.role, parent.eventId);

        const replies = await Message.find({ parentId: parent._id, deleted: false })
            .populate('userId', 'firstName lastName organizerName role')
            .sort({ createdAt: 1 })
            .lean();

        res.json({ success: true, data: { replies } });
    } catch (error) { next(error); }
};

/**
 * @desc    Create a message / reply
 * @route   POST /api/events/:id/messages
 */
const createMessage = async (req, res, next) => {
    try {
        const eventId = req.params.id;
        const accessRole = await checkForumAccess(req.user.id, req.user.role, eventId);

        const { content, parentId, type } = req.body;
        if (!content || !content.trim()) throw new ApiError(400, 'Message content is required');

        // Only organizers can post announcements
        const msgType = (type === 'announcement' && accessRole === 'organizer') ? 'announcement' : 'message';

        // Validate parentId if provided
        if (parentId) {
            const parent = await Message.findOne({ _id: parentId, eventId, deleted: false });
            if (!parent) throw new ApiError(404, 'Parent message not found');
        }

        const message = await Message.create({
            eventId,
            userId: req.user.id,
            content: content.trim(),
            parentId: parentId || null,
            type: msgType,
        });

        const populated = await Message.findById(message._id)
            .populate('userId', 'firstName lastName organizerName role')
            .lean();

        // Emit via Socket.IO if available
        const io = req.app.get('io');
        if (io) {
            io.to(`event:${eventId}`).emit('newMessage', { ...populated, replyCount: 0 });
        }

        res.status(201).json({ success: true, data: { message: { ...populated, replyCount: 0 } } });
    } catch (error) { next(error); }
};

/**
 * @desc    Delete a message (organizer = any, participant = own only)
 * @route   DELETE /api/messages/:id
 */
const deleteMessage = async (req, res, next) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message || message.deleted) throw new ApiError(404, 'Message not found');

        const accessRole = await checkForumAccess(req.user.id, req.user.role, message.eventId);

        // Participants can only delete their own messages
        if (accessRole === 'participant' && message.userId.toString() !== req.user.id) {
            throw new ApiError(403, 'You can only delete your own messages');
        }

        message.deleted = true;
        await message.save();

        // Emit via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.to(`event:${message.eventId}`).emit('messageDeleted', { messageId: message._id });
        }

        res.json({ success: true, message: 'Message deleted' });
    } catch (error) { next(error); }
};

/**
 * @desc    Toggle pin on a message (organizer only)
 * @route   PATCH /api/messages/:id/pin
 */
const togglePin = async (req, res, next) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message || message.deleted) throw new ApiError(404, 'Message not found');

        // Only organizers
        const event = await Event.findOne({ _id: message.eventId, organizerId: req.user.id });
        if (!event) throw new ApiError(403, 'Only the event organizer can pin messages');

        message.pinned = !message.pinned;
        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`event:${message.eventId}`).emit('messagePinned', {
                messageId: message._id,
                pinned: message.pinned,
            });
        }

        res.json({ success: true, message: message.pinned ? 'Message pinned' : 'Message unpinned' });
    } catch (error) { next(error); }
};

/**
 * @desc    Toggle emoji reaction on a message
 * @route   PATCH /api/messages/:id/react
 * @body    { emoji: "👍" }
 */
const reactToMessage = async (req, res, next) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message || message.deleted) throw new ApiError(404, 'Message not found');

        await checkForumAccess(req.user.id, req.user.role, message.eventId);

        const { emoji } = req.body;
        const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀'];
        if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
            throw new ApiError(400, 'Invalid reaction emoji');
        }

        const userId = req.user.id;
        const reactionUsers = message.reactions.get(emoji) || [];
        const idx = reactionUsers.findIndex((id) => id.toString() === userId);

        if (idx >= 0) {
            reactionUsers.splice(idx, 1); // Remove reaction
        } else {
            reactionUsers.push(userId); // Add reaction
        }
        message.reactions.set(emoji, reactionUsers);
        await message.save();

        // Build reactions summary for emit
        const reactionsObj = {};
        for (const [key, val] of message.reactions) {
            reactionsObj[key] = val.length;
        }

        const io = req.app.get('io');
        if (io) {
            io.to(`event:${message.eventId}`).emit('messageReaction', {
                messageId: message._id,
                reactions: reactionsObj,
                emoji,
                userId,
                action: idx >= 0 ? 'removed' : 'added',
            });
        }

        res.json({ success: true, data: { reactions: reactionsObj } });
    } catch (error) { next(error); }
};

module.exports = { getMessages, getReplies, createMessage, deleteMessage, togglePin, reactToMessage };
