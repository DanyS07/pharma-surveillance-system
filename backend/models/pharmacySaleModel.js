const mongoose = require('mongoose');

// Each document is one drug batch row from a pharmacy uploaded CSV/Excel file.
// All rows from one upload share the same uploadSessionId.
//
// saleDate removed and replaced with saleMonth + saleYear.
// Pharmacies export from Tally, MedPlus POS, custom Excel — date formats vary wildly.
// The pharmacy selects month + year from frontend dropdowns before uploading.
// Every row is stamped with clean integers server-side. No date parsing, no corruption.

const pharmacySaleSchema = new mongoose.Schema({
    pharmacyId:      { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    uploadSessionId: { type: String, required: true },

    // Reporting period — stamped server-side from frontend dropdown selection
    saleMonth: { type: Number, required: true, min: 1, max: 12 },  // 1 = January
    saleYear:  { type: Number, required: true },                    // e.g. 2026

    // Core drug data — supports two naming conventions from different pharmacy exports:
    // New format:    drug_name, batch_number, quantity_sold
    // Legacy format: drugName,  batchNumber,  quantity
    drugName:     { type: String, required: true },
    batchNumber:  { type: String, required: true, index: true },
    manufacturer: { type: String, default: '' },
    expiryDate:   { type: String, default: '' },
    quantity:     { type: Number, required: true },

    // Optional — stored if present in CSV, ignored if absent
    unitPrice:        { type: Number, default: 0  },  // price per unit
    pharmacyRecordId: { type: String, default: '' },  // pharmacy's internal record ID (REC0001)
    similarityScore:  { type: Number, default: null }, // AI fuzzy-match score for matched rows
    nsqDrugName:      { type: String, default: '' },   // name from matched NSQ master record
    nsqManufacturer:  { type: String, default: '' },   // NSQ master record manufacturer
    nsqBanDate:       { type: String, default: '' },   // NSQ report date / ban date string

    // Antibiotic matching result — written back after antibiotic matching completes
    // Maps uploaded drug to antibiotic class (e.g., "beta-lactam", "fluoroquinolone")
    // Populated automatically on upload; used for anomaly detection scoring
    antibioticClass:  { type: String, default: '' },   // e.g., "carbapenem", "beta-lactam"
    antibioticMatch:  { type: String, default: '' },   // matched antibiotic standard name
    antibioticScore:  { type: Number, default: null }, // fuzzy match score (0-100)

    // NSQ match result — written back after AI validation completes
    // pending        → not yet checked
    // NSQ_CONFIRMED  → AI confirmed match with CDSCO NSQ record (immediate enforcement action)
    // PROBABLE_MATCH → AI found strong similarity below confirmation threshold (investigate)
    // SAFE           → no NSQ match found
    // MISMATCH       → batch number matched but drug name did not (manual review needed)
    nsqStatus: {
        type:    String,
        enum:    ['pending', 'NSQ_CONFIRMED', 'PROBABLE_MATCH', 'SAFE', 'MISMATCH'],
        default: 'pending',
    },

}, { timestamps: true });

// Compound index for duplicate upload guard in inventoryController
// Prevents a pharmacy submitting twice for the same reporting period
pharmacySaleSchema.index({ pharmacyId: 1, saleMonth: 1, saleYear: 1 });

module.exports = mongoose.model('pharmacy_sales', pharmacySaleSchema);
