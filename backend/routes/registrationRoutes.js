const express = require('express');
const { authenticate } = require('../middleware/auth');
const { cancelRegistration } = require('../controllers/registrationController');

const router = express.Router();

router.use(authenticate);

// PATCH /api/registrations/:id/cancel — Cancel own registration
router.patch('/:id/cancel', cancelRegistration);

module.exports = router;
