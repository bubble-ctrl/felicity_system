const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const organizerRoutes = require('./routes/organizerRoutes');
const eventRoutes = require('./routes/eventRoutes');
const organizerPublicRoutes = require('./routes/organizerPublicRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const messageRoutes = require('./routes/messageRoutes');

const app = express();

// --------------- Middleware ---------------
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (dev only)
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// --------------- Routes ---------------
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/organizers', organizerPublicRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/messages', messageRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
