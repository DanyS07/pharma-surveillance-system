const mongoose = require('mongoose');

// Alerts are auto-created by processAIResults() — never manually by any user.
// NSQ_CONFIRMED  → immediate enforcement action required
// PROBABLE_MATCH → officer should investigate, high similarity but not confirmed

const alertSchema = new mongoose.Schema({
    pharmacyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'users',          required: true },
    officerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'users',          required: true },
    saleRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'pharmacy_sales', required: true },

    drugName:    { type: String, required: true },  // drug name as written in pharmacy CSV
    batchNumber: { type: String, required: true },

    alertType: {
        type:    String,
        enum:    ['NSQ_CONFIRMED', 'PROBABLE_MATCH'],
        default: 'NSQ_CONFIRMED',
    },

    // ── AI enrichment fields ─────────────────────────────────────────
    // Written by processAIResults() from the AI response.
    // Stored here so officers see full context without extra DB queries.
    // These are raw AI outputs — the MERN backend decides what to DO with them.
    similarityScore: { type: Number, default: null },  // 0-100, AI's name match confidence
    nsqDrugName:     { type: String, default: '' },    // exact drug name from CDSCO master list
    banDate:         { type: String, default: '' },    // "Jan-20" — when CDSCO flagged this batch
    nsqManufacturer: { type: String, default: '' },    // manufacturer from NSQ master list

    // ── Risk tier ────────────────────────────────────────────────────
    // Calculated by MERN controller — NOT by AI service.
    // AI returns similarityScore. MERN decides regulatory consequence.
    // HIGH   → NSQ_CONFIRMED (product seizure, immediate action)
    // MEDIUM → PROBABLE_MATCH, similarityScore >= 85 (investigate within 48h)
    // LOW    → PROBABLE_MATCH, similarityScore < 85  (log and monitor)
    riskTier: {
        type:    String,
        enum:    ['HIGH', 'MEDIUM', 'LOW'],
        default: 'HIGH',
    },

    status: {
        type:    String,
        enum:    ['OPEN', 'INVESTIGATING', 'RESOLVED'],
        default: 'OPEN',
    },

    officerNotes: { type: String, default: '' },

}, { timestamps: true });

module.exports = mongoose.model('alerts', alertSchema);