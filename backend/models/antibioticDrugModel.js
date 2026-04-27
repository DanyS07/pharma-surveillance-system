const mongoose = require('mongoose');

const antibioticDrugSchema = new mongoose.Schema({
    drugName:         { type: String, required: true, trim: true },
    manufacturer:     { type: String, default: '', trim: true },
    activeIngredient: { type: String, default: '', trim: true },
    dosageForm:       { type: String, default: '', trim: true },
    strength:         { type: String, default: '', trim: true },
}, { timestamps: true });

antibioticDrugSchema.index({ drugName: 1 });

module.exports = mongoose.model('antibiotic_master', antibioticDrugSchema);
