const mongoose = require('mongoose');

// One collection, three roles: admin / officer / pharmacy
// status gate: pharmacy registers as 'pending', blocked until admin approves

const userSchema = new mongoose.Schema({
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },  // argon2id hash
    role:     { type: String, enum: ['admin', 'officer', 'pharmacy'], required: true },
    status:   { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },

    // Pharmacy-only fields
    licenseNumber:       { type: String, default: '' },
    pharmacistRegNumber: { type: String, default: '' },
    address:             { type: String, default: '' },
    district:            { type: String, default: '' },
    state:               { type: String, default: '' },

    // Officer-only: array of pharmacy ObjectIds assigned by admin
    assignedPharmacies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'users' }],

    // Password reset — these sit empty until a reset is triggered.
    // When user requests reset: generate a random token, hash it, store hash here,
    // set expiry 1 hour from now, email the plain token to the user.
    // On reset: re-hash the submitted token, compare to stored hash, check expiry.
    // After successful reset: clear both fields.
    // You will build the email flow (nodemailer) when ready — the schema is ready now.
    resetPasswordToken:  { type: String,  default: null },  // hashed token stored here
    resetPasswordExpiry: { type: Date,    default: null },  // expiry timestamp

}, { timestamps: true });

module.exports = mongoose.model('users', userSchema);