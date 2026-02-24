const express = require('express');
const { listOrganizers, getOrganizerDetail } = require('../controllers/organizerPublicController');

const router = express.Router();

// GET /api/organizers — List all active organizers (public)
router.get('/', listOrganizers);

// GET /api/organizers/:id — Organizer detail with events (public)
router.get('/:id', getOrganizerDetail);

module.exports = router;
