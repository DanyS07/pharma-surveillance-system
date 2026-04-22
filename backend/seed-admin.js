// Run ONCE to create the first admin account.
// Usage: node seed-admin.js
// Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in your .env before running.
// After the admin is created these env values are never read by the server.

require('dotenv').config();
require('./db');
const argon2    = require('argon2');
const userModel = require('./models/userModel');

const ARGON2_OPTIONS = {
    type:        argon2.argon2id,
    memoryCost:  65536,
    timeCost:    3,
    parallelism: 4,
};

async function seed() {
    try {
        const existing = await userModel.findOne({ role: 'admin' });
        if (existing) {
            console.log('Admin already exists:', existing.email);
            process.exit(0);
        }

        const password = process.env.SEED_ADMIN_PASSWORD;
        const email    = process.env.SEED_ADMIN_EMAIL || 'admin@pharma.gov.in';

        if (!password) {
            console.error('Error: SEED_ADMIN_PASSWORD is not set in your .env file.');
            process.exit(1);
        }

        const hashedPassword = await argon2.hash(password, ARGON2_OPTIONS);

        const admin = await new userModel({
            name:     'System Admin',
            email,
            password: hashedPassword,
            role:     'admin',
            status:   'active',
        }).save();

        console.log('Admin created successfully:', admin.email);
        console.log('You can now log in and remove SEED_ADMIN_PASSWORD from your .env');
        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err.message);
        process.exit(1);
    }
}

seed();