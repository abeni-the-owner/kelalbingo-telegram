const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// In-memory storage for real-time card selections
const cardSelections = new Map(); // roundNumber -> { cardId: userId }

// Make io and cardSelections accessible to routes
app.set('io', io);
app.set('cardSelections', cardSelections);

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow Telegram Web App scripts
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const balanceRoutes = require('./routes/balance');
const gameRoutes = require('./routes/game');
const cardsRoutes = require('./routes/cards');
const referralRoutes = require('./routes/referral');
const adminRoutes = require('./routes/admin');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// Socket.IO real-time events
io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.id);

    // User joins a room (round-based)
    socket.on('join-round', (data) => {
        const { roundNumber, userId } = data;
        socket.join(`round-${roundNumber}`);
        socket.userId = userId;
        console.log(`User ${userId} joined round ${roundNumber}`);

        // Send current card selections for this round
        const roundSelections = cardSelections.get(roundNumber) || {};
        socket.emit('current-selections', roundSelections);
    });

    // User selects a card (real-time, no database)
    socket.on('select-card', (data) => {
        const { roundNumber, cardId, cardNumber, userId } = data;

        // Get or create round selections
        if (!cardSelections.has(roundNumber)) {
            cardSelections.set(roundNumber, {});
        }

        const roundSelections = cardSelections.get(roundNumber);

        // Check if card is already taken
        if (roundSelections[cardId] && roundSelections[cardId] !== userId) {
            socket.emit('card-taken', { cardId, cardNumber });
            return;
        }

        // Reserve card for this user
        roundSelections[cardId] = userId;

        // Broadcast to all users in this round
        io.to(`round-${roundNumber}`).emit('card-selected', {
            cardId,
            cardNumber,
            userId
        });

        console.log(`Card ${cardNumber} selected by user ${userId} in round ${roundNumber}`);
    });

    // User deselects a card
    socket.on('deselect-card', (data) => {
        const { roundNumber, cardId, cardNumber, userId } = data;

        const roundSelections = cardSelections.get(roundNumber);
        if (roundSelections && roundSelections[cardId] === userId) {
            delete roundSelections[cardId];

            // Broadcast to all users
            io.to(`round-${roundNumber}`).emit('card-deselected', {
                cardId,
                cardNumber,
                userId
            });

            console.log(`Card ${cardNumber} released by user ${userId}`);
        }
    });

    // User disconnects
    socket.on('disconnect', () => {
        console.log('👤 User disconnected:', socket.id);
    });
});

// Initialize Telegram Bot
require('./bot/bot');

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 WebSocket server ready`);
});

module.exports = { app, io };