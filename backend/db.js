const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
    const connectionString = process.env.MONGODB_URL_DIRECT || process.env.MONGODB_URL;

    if (!connectionString) {
        throw new Error('Missing MongoDB connection string. Set MONGODB_URL or MONGODB_URL_DIRECT.');
    }

    try {
        await mongoose.connect(connectionString, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log(`MongoDB connected successfully using ${process.env.MONGODB_URL_DIRECT ? 'direct' : 'SRV'} connection`);
    } catch (err) {
        if (err.message.includes('querySrv')) {
            console.log('MongoDB connection error: SRV lookup failed. Try setting MONGODB_URL_DIRECT in backend/.env.');
        }
        throw err;
    }
}

module.exports = connectDB;
