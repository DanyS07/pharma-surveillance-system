const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    pharmacyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'users',          required: true },
    officerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'users',          required: true },
    saleRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'pharmacy_sales', required: true },

    drugName:    { type: String, required: true },
    batchNumber: { type: String, required: true },

    alertType: {
        type: String,
        enum: ['NSQ_CONFIRMED', 'PROBABLE_MATCH', 'ANTIBIOTIC_ANOMALY'],
        default: 'NSQ_CONFIRMED',
    },

    similarityScore: { type: Number, default: null },
    nsqDrugName:     { type: String, default: '' },
    banDate:         { type: String, default: '' },
    nsqManufacturer: { type: String, default: '' },

    riskTier: {
        type: String,
        enum: ['HIGH', 'MEDIUM', 'LOW'],
        default: 'HIGH',
    },

    status: {
        type: String,
        enum: ['OPEN', 'INVESTIGATING', 'RESOLVED'],
        default: 'OPEN',
    },

    officerNotes: { type: String, default: '' },

}, { timestamps: true });

/**
 * Prevent duplicates:
 * Same saleRecord + same alertType should exist only once.
 */
alertSchema.index(
    { saleRecordId: 1, alertType: 1 },
    { unique: true }
);

module.exports = mongoose.model('alerts', alertSchema);
