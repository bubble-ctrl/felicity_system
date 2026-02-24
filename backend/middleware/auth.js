const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token from the Authorization header.
 * Attaches decoded user payload to req.user.
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id, role, ... }
        next();
    } catch (error) {
        next(error); // Handled by errorHandler (JWT errors)
    }
};

/**
 * Middleware factory for role-based access control.
 * Usage: authorize('admin', 'organizer')
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Role '${req.user.role}' is not authorized.`,
            });
        }

        next();
    };
};

/**
 * Like authenticate but doesn't block — sets req.user if token present, otherwise continues.
 * Used for optional recommendations on public routes.
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch (_) { /* ignore invalid tokens for optional auth */ }
    next();
};

module.exports = { authenticate, authorize, optionalAuth };
