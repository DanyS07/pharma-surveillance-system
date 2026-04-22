const mongoose = require('mongoose');
require('dotenv').config();
 
mongoose.connect(process.env.MONGODB_URL)
    .then(() => {
        console.log('MongoDB connected successfully');
    })
    .catch((err) => {
        console.log('MongoDB connection error:', err.message);
        process.exit(1);
    });
 