const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for a user.
 * @param {Object} payload - { id, role }
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
    });
};

module.exports = { generateToken };
