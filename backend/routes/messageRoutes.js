const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getReplies, deleteMessage, togglePin, reactToMessage } = require('../controllers/messageController');

const router = express.Router();

// All message routes require authentication
router.use(authenticate);

// Thread replies
router.get('/:id/replies', getReplies);

// Delete message (organizer = any, participant = own)
router.delete('/:id', deleteMessage);

// Pin/unpin (organizer only)
router.patch('/:id/pin', togglePin);

// React to message
router.patch('/:id/react', reactToMessage);

module.exports = router;
