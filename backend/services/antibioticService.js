const axios = require('axios');
const mongoose = require('mongoose');
const antibioticDrugModel = require('../models/antibioticDrugModel');

async function fetchAntibioticReferenceRecords() {
    try {
        let records = await antibioticDrugModel.find({}).lean();

        if (!records || records.length === 0) {
            const db = mongoose.connection.db;
            if (db) {
                records = await db.collection('antibiotic_reference').find({}).toArray();
            }
        }

        return records || [];
    } catch (err) {
        console.error('Error fetching antibiotic reference records:', err.message);
        return [];
    }
}

function normalizeDrugText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function splitReferenceTerms(value) {
    if (Array.isArray(value)) {
        return value.flatMap(splitReferenceTerms);
    }

    return String(value || '')
        .split(/[,;|/]+/)
        .map(normalizeDrugText)
        .filter(term => term.length >= 4);
}

function getAntibioticReferenceTerms(record) {
    return [
        record.standard_name,
        record.drugName,
        record.activeIngredient,
        record.brand_names,
        record.synonyms,
    ].flatMap(splitReferenceTerms);
}

function findAntibioticReferenceMatch(drugName, antibioticRecords) {
    const normalizedDrugName = normalizeDrugText(drugName);
    if (!normalizedDrugName) return null;

    for (const record of antibioticRecords || []) {
        const terms = getAntibioticReferenceTerms(record);
        const matchedTerm = terms.find(term =>
            normalizedDrugName === term ||
            normalizedDrugName.includes(term) ||
            (normalizedDrugName.length >= 4 && term.includes(normalizedDrugName))
        );

        if (matchedTerm) {
            return {
                matchedName: record.standard_name || record.drugName || matchedTerm,
                antibioticClass: record.antibiotic_class || record.antibioticClass || record.activeIngredient || 'unknown',
                score: normalizedDrugName === matchedTerm ? 100 : 90,
            };
        }
    }

    return null;
}

async function sendAntibioticRowsToAI(pharmacyId, sessionId, salesRows) {
    try {
        const salesData = salesRows.map(row => ({
            drug_name: row.drugName || '',
            quantity_sold: row.quantity || 0,
            month: row.saleMonth || null,
            year: row.saleYear || null,
            batch_number: row.batchNumber || '',
            unit_price: row.unitPrice || 0,
            pharmacy_id: String(row.pharmacyId),
        }));

        const response = await axios.post(
            `${process.env.AI_SERVICE_URL}/api/antibiotic/analyze`,
            {
                sales: salesData,
                role: 'pharmacy',
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.AI_API_KEY || '',
                },
                timeout: 30000,
            }
        );

        const anomalies = response.data?.anomalies || [];

        return {
            success: true,
            input_records: salesRows.length,
            total_anomalies: anomalies.length,
            anomalies,
        };
    } catch (err) {
        console.error('Antibiotic AI service error:', err.message);
        return {
            success: false,
            input_records: 0,
            total_anomalies: 0,
            anomalies: [],
        };
    }
}

async function sendToAntibioticService(payload) {
    try {
        const { sales, role } = payload;

        const response = await axios.post(
            `${process.env.AI_SERVICE_URL}/api/antibiotic/analyze`,
            {
                sales,
                role,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.AI_API_KEY || '',
                },
                timeout: 30000,
            }
        );

        return response.data;
    } catch (err) {
        console.error('Antibiotic AI service error:', err.message);
        return {
            success: false,
            anomalies: [],
        };
    }
}

module.exports = {
    fetchAntibioticReferenceRecords,
    findAntibioticReferenceMatch,
    sendAntibioticRowsToAI,
    sendToAntibioticService,
};
