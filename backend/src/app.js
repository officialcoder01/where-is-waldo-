const path = require('path');
const express = require('express');
const session = require('express-session');
const prisma = require('./config/prisma');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const levelRouter = require('./routes/levelRouter');
const leaderboardRouter = require('./routes/leaderboardRouter');
const cors = require('cors');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
// Detect whether the server is running in its deployed configuration.
const isProduction = process.env.NODE_ENV === 'production';
// Allow one or more frontend origins to be supplied from the environment.
const configuredOrigins = (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
// Include configured production origins plus the local dev URLs we commonly use.
const allowedOrigins = [
    ...configuredOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
].filter(Boolean);

function normalizeOrigin(origin) {
    // Reduce origins to a stable form so trailing slashes or full URLs do not break matching.
    if (!origin) {
        return null;
    }

    try {
        return new URL(origin).origin;
    } catch {
        return origin.replace(/\/+$/, '');
    }
}

function isAllowedOrigin(origin) {
    // Accept same-origin/server-side requests and approved browser origins.
    if (!origin) {
        return true;
    }

    // Compare normalized origins so environment formatting differences do not cause false rejections.
    const normalizedOrigin = normalizeOrigin(origin);
    const normalizedAllowedOrigins = allowedOrigins
        .map((allowedOrigin) => normalizeOrigin(allowedOrigin))
        .filter(Boolean);

    if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
        return true;
    }

    if (!isProduction) {
        try {
            // In development, allow any localhost-style origin regardless of port.
            const { hostname } = new URL(normalizedOrigin);
            return (
                hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname.endsWith('.localhost')
            );
        } catch {
            return false;
        }
    }

    return false;
}

if (isProduction) {
    // Trust the reverse proxy in production so secure cookies work correctly behind Vercel.
    app.set('trust proxy', 1);
}

app.use(express.json());
app.use(cors({
    origin(origin, callback) {
        // Let CORS decide request-by-request whether the browser origin is allowed.
        if (isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
}));

// Serve frontend assets (level previews and game images).
const frontendRoot = path.resolve(__dirname, '..', '..', 'frontend');
app.use('/assets', express.static(path.join(frontendRoot, 'assets')));
app.use('/frontend', express.static(frontendRoot));

// Build the session config once so tests can swap out the persistent store.
const sessionConfig = {
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // Session expires after 24 hours
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        secure: isProduction,
    },
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
};

if (process.env.NODE_ENV !== 'test') {
    // The Prisma-backed store is useful in the app, but it leaves timers open in tests.
    sessionConfig.store = new PrismaSessionStore(
        prisma,
        {
            checkPeriod: 2 * 60 * 1000, // Check for expired sessions every 2 minutes
            dbRecordIdIsSessionId: true, // Use the session ID as the record ID in the database
            dbRecordIdFunction: undefined, // Let the store generate its own record IDs
        }
    );
}

app.use(session({
    ...sessionConfig,
}));

app.use('/levels', levelRouter);
app.use('/leaderboard', leaderboardRouter);

app.get('/', (req, res) => {
    res.send('Welcome to the Where is Waldo API!');
});

if (require.main === module && process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
