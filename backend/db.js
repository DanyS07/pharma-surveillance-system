const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

async function connectDB() {
    const dnsServers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);

    if (dnsServers.length > 0) {
        dns.setServers(dnsServers);
    }

    const connectionString = process.env.MONGODB_URL;

    if (!connectionString) {
        throw new Error('Missing MongoDB connection string. Set MONGODB_URL.');
    }

    try {
        await mongoose.connect(connectionString, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log('MongoDB connected successfully using SRV connection');
    } catch (err) {
        if (err.message.includes('querySrv')) {
            console.log('MongoDB connection error: SRV lookup failed. Check DNS resolver or network policy.');
        }
        throw err;
    }
}

module.exports = connectDB;
