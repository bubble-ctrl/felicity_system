const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server running',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
