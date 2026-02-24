const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { browseEvents, getEventDetails, getTrendingEvents } = require('../controllers/publicEventController');
const { registerForEvent } = require('../controllers/registrationController');
const { getMessages, getReplies, createMessage, deleteMessage, togglePin, reactToMessage } = require('../controllers/messageController');
const { submitFeedback, getMyFeedback } = require('../controllers/feedbackController');

const router = express.Router();

// Public event routes (optionalAuth for recommendations)
router.get('/trending', getTrendingEvents);
router.get('/', optionalAuth, browseEvents);
router.get('/:id', getEventDetails);

// Registration (requires auth + participant role)
router.post('/:id/register', authenticate, registerForEvent);

// Discussion forum (requires auth — access checked in controller)
router.get('/:id/messages', authenticate, getMessages);
router.post('/:id/messages', authenticate, createMessage);

// Anonymous feedback (requires auth — attendance checked in controller)
router.post('/:id/feedback', authenticate, submitFeedback);
router.get('/:id/feedback/mine', authenticate, getMyFeedback);

module.exports = router;
