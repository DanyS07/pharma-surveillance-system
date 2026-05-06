const mongoose = require('mongoose');

const antibioticTrendMatchSchema = new mongoose.Schema({
    saleRecordId:    { type: mongoose.Schema.Types.ObjectId, ref: 'pharmacy_sales', required: true, unique: true },
    pharmacyId:      { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    uploadSessionId: { type: String, default: '', index: true },

    drugName:        { type: String, required: true },
    batchNumber:     { type: String, default: '' },
    saleMonth:       { type: Number, required: true, min: 1, max: 12 },
    saleYear:        { type: Number, required: true },
    quantity:        { type: Number, default: 0 },
    unitPrice:       { type: Number, default: 0 },

    antibioticMatch: { type: String, default: '' },
    antibioticClass: { type: String, default: '' },
    antibioticScore: { type: Number, default: null },
}, { timestamps: true });

antibioticTrendMatchSchema.index({ pharmacyId: 1, saleYear: 1, saleMonth: 1 });

module.exports = mongoose.model('antibiotic_trend_matches', antibioticTrendMatchSchema);
