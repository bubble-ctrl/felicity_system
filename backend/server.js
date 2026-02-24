const dotenv = require('dotenv');

// Load env vars BEFORE anything else
dotenv.config();

const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./app');
const connectDB = require('./config/db');
const seedAdmin = require('./utils/seedAdmin');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    // Connect to MongoDB
    await connectDB();

    // Seed default admin
    await seedAdmin();

    // Create HTTP server and attach Socket.IO
    const httpServer = http.createServer(app);
    const io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    // Make io accessible in controllers via req.app.get('io')
    app.set('io', io);

    // Socket.IO authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication required'));
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    // Socket.IO connection handling
    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.user.id} (${socket.user.role})`);

        // Join an event room for real-time messages
        socket.on('joinEvent', (eventId) => {
            socket.join(`event:${eventId}`);
        });

        socket.on('leaveEvent', (eventId) => {
            socket.leave(`event:${eventId}`);
        });

        socket.on('disconnect', () => {
            // Cleanup handled automatically by Socket.IO
        });
    });

    httpServer.listen(PORT, () => {
        console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
};

startServer();