const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const cookieParser  = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit     = require('express-rate-limit');
const app           = express();
require('dotenv').config();
const connectDB     = require('./db');

app.use(helmet());
app.use(cors({
    origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// express-mongo-sanitize's middleware rewrites req.query internally.
// Express 5 made req.query a read-only getter — that write throws on
// every single request before any route runs.
// Fix: call sanitize() directly on req.body only, which is the actual
// attack surface. No route in this app builds Mongo queries from req.query.
app.use((req, res, next) => {
    if (req.body) {
        req.body = mongoSanitize.sanitize(req.body, { replaceWith: '_' });
    }
    next();
});

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      100,
    message:  { message: 'Too many requests, please try again later' },
}));

app.use('/user',      require('./routes/userRoute'));
app.use('/pharmacy',  require('./routes/pharmacyRoute'));
app.use('/inventory', require('./routes/inventoryRoute'));
app.use('/alert',     require('./routes/alertRoute'));
app.use('/nsq',       require('./routes/nsqRoute'));

app.get('/', (req, res) => res.json({ message: 'Pharma Surveillance API is running' }));

app.use((err, req, res, next) => {
    console.error('Global error:', err.message);
    if (err.name === 'MulterError') {
        return res.status(400).json({ message: `File upload error: ${err.message}` });
    }
    res.status(500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

connectDB()
    .then(() => {
        app.listen(PORT, () => console.log(`Pharma server running on PORT ${PORT}`));
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });
