// User roles
const ROLES = {
    PARTICIPANT: 'participant',
    ORGANIZER: 'organizer',
    ADMIN: 'admin',
};

// Participant types
const PARTICIPANT_TYPES = {
    IIIT: 'iiit',
    NON_IIIT: 'non-iiit',
};

// Event types
const EVENT_TYPES = {
    NORMAL: 'normal',
    MERCHANDISE: 'merchandise',
};

// Event statuses
const EVENT_STATUSES = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ONGOING: 'ongoing',
    COMPLETED: 'completed',
    CLOSED: 'closed',
};

// Registration statuses
const REGISTRATION_STATUSES = {
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    REJECTED: 'rejected',
    PENDING: 'pending',
};

module.exports = {
    ROLES,
    PARTICIPANT_TYPES,
    EVENT_TYPES,
    EVENT_STATUSES,
    REGISTRATION_STATUSES,
};
