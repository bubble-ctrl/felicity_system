const { validationResult } = require('express-validator');

/**
 * Middleware to check express-validator results.
 * If there are validation errors, returns 400 with error details.
 * Use after express-validator check chains in route definitions.
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map((e) => ({
                field: e.path,
                message: e.msg,
            })),
        });
    }
    next();
};

module.exports = validate;
