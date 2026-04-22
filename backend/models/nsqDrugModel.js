const mongoose = require('mongoose');

// Master list of NSQ (Not of Standard Quality) drug batches sourced from CDSCO alerts.
// Admin uploads the official CDSCO CSV — this collection is the reference the
// NSQ match engine queries against during every pharmacy inventory upload.

const nsqDrugSchema = new mongoose.Schema({
    drugName:     { type: String, required: true, trim: true },
    batchNumber:  { type: String, required: true, trim: true },
    manufacturer: { type: String, default: '' },
    reason:       { type: String, default: '' },    // NSQ Result column
    cdscoPdfRef:  { type: String, default: '' },    // Reporting Source column

    // Stored as a proper Date object.
    // CDSCO CSV format: "01-01-2020" (DD-MM-YYYY) — parsed in nsqController.
    // Sent to AI service as a Date — no conversion needed on either side.
    reportDate: { type: Date, required: true },

}, { timestamps: true });

// Compound index for fast batch number lookups — batchNumber is the leading field.
// unique: true intentionally removed.
// The same batch number can appear in multiple CDSCO reports across different months
// (e.g. flagged in Jan-2020 and again in Mar-2021 with a new report date).
// Enforcing uniqueness on batchNumber + drugName would incorrectly skip these.
nsqDrugSchema.index({ batchNumber: 1, drugName: 1 });

module.exports = mongoose.model('nsq_drugs', nsqDrugSchema);