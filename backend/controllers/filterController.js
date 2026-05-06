const axios = require('axios');
const userModel = require('../models/userModel');
const pharmacySaleModel = require('../models/pharmacySaleModel');
const {
    fetchAntibioticReferenceRecords,
    findAntibioticReferenceMatch,
} = require('../services/antibioticService');

const VALID_CATEGORIES = new Set(['ANTIBIOTIC']);

function getReferenceDrugName(record) {
    return String(record.standard_name || record.drugName || record.activeIngredient || '').trim();
}

function parseThreshold(value, role) {
    if (value === undefined || value === null || value === '' || value === 'full') {
        return null;
    }

    if (role === 'admin' && value === 'full') return null;

    const threshold = Number(value);
    if (!Number.isFinite(threshold)) {
        return null;
    }

    return Math.min(100, Math.max(50, threshold));
}

async function getAllowedPharmacyIds(req) {
    const role = req.user?.role;
    const requestedPharmacyId = req.body.pharmacyId ? String(req.body.pharmacyId) : '';

    if (role === 'admin') {
        return requestedPharmacyId ? [requestedPharmacyId] : [];
    }

    const officer = await userModel.findById(req.user.id).select('assignedPharmacies').lean();
    const assignedIds = (officer?.assignedPharmacies || []).map(id => String(id));

    if (requestedPharmacyId && !assignedIds.includes(requestedPharmacyId)) {
        const err = new Error('You can only access pharmacies assigned to you.');
        err.statusCode = 403;
        throw err;
    }

    return requestedPharmacyId ? [requestedPharmacyId] : assignedIds;
}

async function fetchScoredCandidates(category, pharmacyIds) {
    try {
        const response = await axios.post(
            `${process.env.AI_SERVICE_URL}/api/scoring/candidates`,
            { category, pharmacyIds },
            {
                headers: {
                    'x-api-key': process.env.AI_API_KEY,
                    'Content-Type': 'application/json',
                },
                // Increase timeout: scoring may scan many records on first run
                timeout: 60000,
            }
        );

        return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
        console.error('fetchScoredCandidates error:', err.message);
        if (err.response) {
            console.error('AI response:', err.response.status, err.response.data);
        }
        // Surface a helpful error to caller
        const e = new Error('AI scoring service unavailable or timed out');
        e.statusCode = 503;
        throw e;
    }
}

async function fetchLocalAntibioticCandidates(req, pharmacyIds) {
    const query = {};

    if (pharmacyIds.length > 0) {
        query.pharmacyId = { $in: pharmacyIds };
    }

    const month = Number(req.body.month || req.body.saleMonth);
    const year = Number(req.body.year || req.body.saleYear);

    if (Number.isInteger(month) && month >= 1 && month <= 12) {
        query.saleMonth = month;
    }

    if (Number.isInteger(year)) {
        query.saleYear = year;
    }

    const rows = await pharmacySaleModel
        .find(query)
        .select('drugName batchNumber quantity unitPrice pharmacyId saleMonth saleYear antibioticMatch antibioticClass antibioticScore')
        .lean();

    const antibioticRecords = await fetchAntibioticReferenceRecords();

    return rows.map(row => {
        const referenceMatch = findAntibioticReferenceMatch(row.drugName, antibioticRecords);
        if (!referenceMatch && !String(row.antibioticMatch || '').trim()) return null;

        return {
        record_id: String(row._id),
        drug_name: row.drugName,
        drugName: row.drugName,
        batch_number: row.batchNumber,
        batchNumber: row.batchNumber,
        quantity_sold: row.quantity,
        quantity: row.quantity,
        unit_price: row.unitPrice || 0,
        unitPrice: row.unitPrice || 0,
        pharmacy_id: String(row.pharmacyId),
        pharmacyId: String(row.pharmacyId),
        month: row.saleMonth,
        year: row.saleYear,
        saleMonth: row.saleMonth,
        saleYear: row.saleYear,
        antibioticMatch: row.antibioticMatch || referenceMatch?.matchedName || '',
        antibioticClass: row.antibioticClass || referenceMatch?.antibioticClass || '',
        antibioticScore: row.antibioticScore || referenceMatch?.score || null,
        similarity_score: row.antibioticScore || referenceMatch?.score || 100,
        };
    }).filter(Boolean);
}

// POST /api/filter
// AI returns scored candidates. Backend applies role-aware slider filtering.
exports.filterCandidates = async (req, res) => {
    try {
        const role = req.user?.role;
        const category = String(req.body.category || '').trim().toUpperCase();

        if (!VALID_CATEGORIES.has(category)) {
            return res.status(400).json({
                message: 'category must be ANTIBIOTIC.',
            });
        }

        const threshold = parseThreshold(req.body.threshold, role);
        const pharmacyIds = await getAllowedPharmacyIds(req);

        if (role === 'officer' && pharmacyIds.length === 0) {
            return res.status(200).json({
                message: 'No assigned pharmacies available for filtering.',
                role,
                category,
                threshold: threshold === null ? 'full' : threshold,
                pharmacyScope: [],
                totalCandidates: 0,
                filteredCount: 0,
                results: [],
            });
        }

        const localCandidates = await fetchLocalAntibioticCandidates(req, pharmacyIds);
        const candidates = localCandidates.length > 0
            ? localCandidates
            : await fetchScoredCandidates(category, pharmacyIds);
        const filtered = threshold === null
            ? candidates
            : candidates.filter(item => Number(item.similarity_score || 0) >= threshold);

        res.status(200).json({
            message: 'Filtered results fetched.',
            role,
            category,
            threshold: threshold === null ? 'full' : threshold,
            pharmacyScope: pharmacyIds.length > 0 ? pharmacyIds : 'all',
            totalCandidates: candidates.length,
            filteredCount: filtered.length,
            results: filtered,
        });
    } catch (err) {
        console.error('filterCandidates error:', err.message);
        if (err.statusCode) {
            return res.status(err.statusCode).json({ message: err.message });
        }
        res.status(503).json({
            message: 'Unable to fetch scored candidates from AI service.',
        });
    }
};

// GET /api/antibiotic/reference
// Returns antibiotic reference drugs for frontend selectors.
exports.getAntibioticReferenceOptions = async (req, res) => {
    try {
        const records = await fetchAntibioticReferenceRecords();
        const seen = new Set();
        const drugs = [];

        records.forEach(record => {
            const name = getReferenceDrugName(record);
            if (!name) return;

            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);

            drugs.push({
                id: String(record._id || key),
                drugName: name,
                antibioticClass: record.antibiotic_class || record.antibioticClass || record.activeIngredient || '',
                manufacturer: record.manufacturer || '',
                dosageForm: record.dosageForm || '',
                strength: record.strength || '',
            });
        });

        drugs.sort((a, b) => a.drugName.localeCompare(b.drugName));

        res.status(200).json({
            message: 'Antibiotic reference drugs fetched.',
            drugs,
        });
    } catch (err) {
        console.error('getAntibioticReferenceOptions error:', err.message);
        res.status(500).json({ message: 'Error fetching antibiotic reference drugs' });
    }
};
