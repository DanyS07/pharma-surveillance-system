const axios = require('axios');
const antibioticDrugModel = require('../models/antibioticDrugModel');


async function fetchAntibioticReferenceRecords() {
    return antibioticDrugModel.find().lean();
}


function buildAntibioticPayload(pharmacyId, sessionId, salesRows, antibioticRecords) {
    return {
        pharmacyId,
        sessionId,
        salesRows: salesRows.map(row => ({
            sourceRecordId: row.pharmacyRecordId || String(row._id || ''),
            batchNumber: row.batchNumber || '',
            drugName: row.drugName,
            manufacturer: row.manufacturer || '',
            saleMonth: row.saleMonth,
            saleYear: row.saleYear,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
        })),
        antibioticRecords: antibioticRecords.map(record => ({
            recordId: String(record._id || ''),
            drugName: record.drugName,
            manufacturer: record.manufacturer || '',
            activeIngredient: record.activeIngredient || '',
            dosageForm: record.dosageForm || '',
            strength: record.strength || '',
        })),
    };
}


async function sendAntibioticRowsToAI(pharmacyId, sessionId, salesRows, antibioticRecords) {
    try {
        const payload = buildAntibioticPayload(
            pharmacyId,
            sessionId,
            salesRows,
            antibioticRecords,
        );

        const response = await axios.post(
            `${process.env.AI_SERVICE_URL}/api/antibiotic/match-sales`,
            payload,
            {
                headers: {
                    'x-api-key': process.env.AI_API_KEY,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            }
        );

        return response.data;
    } catch (err) {
        console.error('Antibiotic AI microservice error:', err.message);
        return null;
    }
}


module.exports = {
    buildAntibioticPayload,
    fetchAntibioticReferenceRecords,
    sendAntibioticRowsToAI,
};
