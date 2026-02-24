/**
 * Custom API error class.
 * Allows throwing errors with a specific HTTP status code.
 */
class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'ApiError';
    }
}

module.exports = ApiError;
