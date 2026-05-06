const pharmacySaleModel = require('../models/pharmacySaleModel');
const alertModel = require('../models/alertModel');
const userModel = require('../models/userModel');
const mongoose = require('mongoose');
const antibioticTrendMatchModel = require('../models/antibioticTrendMatchModel');
const { sendToAntibioticService } = require('../services/antibioticService');

async function saveAntibioticTrendMatches(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return 0;

    const recordIds = rows
        .map(row => row.record_id || row._id || row.saleRecordId)
        .filter(id => mongoose.Types.ObjectId.isValid(String(id)))
        .map(id => new mongoose.Types.ObjectId(String(id)));

    if (recordIds.length === 0) return 0;

    const saleRows = await pharmacySaleModel.find({ _id: { $in: recordIds } }).lean();
    const saleRowsById = new Map(saleRows.map(row => [String(row._id), row]));

    const operations = rows.reduce((ops, row) => {
        const recordId = String(row.record_id || row._id || row.saleRecordId || '');
        const saleRow = saleRowsById.get(recordId);
        if (!saleRow) return ops;

        const matchName = String(
            row.antibioticMatch ||
            row.matched_name ||
            row.standard_name ||
            saleRow.antibioticMatch ||
            ''
        ).trim();
        const antibioticClass = String(
            row.antibioticClass ||
            row.antibiotic_class ||
            saleRow.antibioticClass ||
            ''
        ).trim();
        const hasValidClass = antibioticClass && antibioticClass.toLowerCase() !== 'unknown';

        if (!matchName && !hasValidClass) return ops;

        ops.push({
            updateOne: {
                filter: { saleRecordId: saleRow._id },
                update: {
                    $set: {
                        pharmacyId: saleRow.pharmacyId,
                        uploadSessionId: saleRow.uploadSessionId || '',
                        drugName: saleRow.drugName,
                        batchNumber: saleRow.batchNumber || '',
                        saleMonth: saleRow.saleMonth,
                        saleYear: saleRow.saleYear,
                        quantity: saleRow.quantity || 0,
                        unitPrice: saleRow.unitPrice || 0,
                        antibioticMatch: matchName,
                        antibioticClass: antibioticClass || 'unknown',
                        antibioticScore: row.antibioticScore || row.similarity_score || saleRow.antibioticScore || null,
                    },
                },
                upsert: true,
            },
        });

        return ops;
    }, []);

    if (operations.length === 0) return 0;

    const result = await antibioticTrendMatchModel.bulkWrite(operations, { ordered: false });
    return (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0);
}

/**
 * POST /api/antibiotic/analyze
 * Body:
 * {
 *   sessionId?: string,
 *   similarityThreshold?: number
 * }
 *
 * Flow:
 * 1) Load sales rows (optionally by sessionId)
 * 2) Filter only rows matched to antibiotic reference list
 * 3) Send to AI service (role-aware)
 * 4) Create/Update alerts (deduplicated)
 */
async function analyzeAntibioticCandidates(req, res) {
    try {
        const { sessionId, similarityThreshold = 80, results = [] } = req.body || {};
        const role = req.user?.role || 'pharmacy';
        const hasProvidedResults = Array.isArray(results) && results.length > 0;

        if (hasProvidedResults) {
            await saveAntibioticTrendMatches(results);

            const analysis = await sendToAntibioticService({
                sales: results.map(row => ({
                    drug_name: row.drug_name || row.drugName || '',
                    quantity_sold: row.quantity_sold || row.quantity || 0,
                    month: row.month ?? null,
                    year: row.year ?? null,
                    pharmacy_id: String(row.pharmacy_id || row.pharmacyId || ''),
                    batch_number: row.batch_number || row.batchNumber || '',
                    unit_price: row.unit_price || row.unitPrice || 0,
                })),
                role,
            });

            const scoredRows = Array.isArray(analysis?.scored_rows) && analysis.scored_rows.length > 0
                ? analysis.scored_rows
                : results.map(row => ({
                    ...row,
                    anomaly_score: null,
                    isolation_score: null,
                    final_score: null,
                    classification: 'NORMAL',
                    action: 'No action needed',
                }));

            return res.status(200).json({
                message: 'Antibiotic anomaly analysis complete',
                roleUsed: role,
                inputRows: results.length,
                matchedAntibioticRows: results.length,
                anomaliesDetected: analysis?.anomalies?.length || 0,
                scored_rows: scoredRows,
                anomalies: analysis?.anomalies || [],
            });
        }

        // ─────────────────────────────────────────────
        // 1) LOAD SALES ROWS
        // ─────────────────────────────────────────────
        let query = {};
        if (sessionId) {
            query.uploadSessionId = sessionId;
        }

        // Officers see only their assigned pharmacies
        if (role === 'officer') {
            const officer = await userModel.findById(req.user.id).lean();
            if (!officer) {
                return res.status(404).json({ message: 'Officer not found' });
            }
            query.pharmacyId = { $in: officer.assignedPharmacies || [] };
        }

        // Pharmacies see only their own data
        if (role === 'pharmacy') {
            query.pharmacyId = req.user.id;
        }

        const rows = await pharmacySaleModel.find(query).lean();

        if (!rows || rows.length === 0) {
            return res.status(200).json({
                message: 'No data found for analysis',
                inputRows: 0,
                anomaliesCreated: 0,
                anomaliesUpdated: 0,
                anomalies: []
            });
        }

        // ─────────────────────────────────────────────
        // 2) FILTER TO MATCHED ANTIBIOTICS ONLY
        // Uses upload-time antibiotic fuzzy matching fields.
        // Excludes non-antibiotics (e.g., multivitamins) from anomaly analysis.
        // ─────────────────────────────────────────────
        const scopedRows = rows.filter(r => {
            const hasMatchedAntibiotic = Boolean(String(r.antibioticMatch || '').trim());
            const hasValidClass = Boolean(String(r.antibioticClass || '').trim())
                && String(r.antibioticClass || '').toLowerCase() !== 'unknown';
            const score = Number(r.antibioticScore);
            const passesScore = Number.isFinite(score) && score >= Number(similarityThreshold || 0);

            return hasMatchedAntibiotic && hasValidClass && passesScore;
        });

        if (scopedRows.length === 0) {
            return res.status(200).json({
                message: 'No matched antibiotic rows found for anomaly analysis',
                roleUsed: role,
                inputRows: rows.length,
                matchedAntibioticRows: 0,
                anomaliesDetected: 0,
                anomaliesCreated: 0,
                anomaliesUpdated: 0,
                anomalies: [],
            });
        }

        // Map to payload expected by Python service
        function toAntibioticSale(row) {
            return {
                drug_name: row.drugName || row.drug_name || '',
                quantity_sold: row.quantity || row.quantity_sold || 0,
                month: row.saleMonth || row.month || null,
                year: row.saleYear || row.year || null,
                pharmacy_id: String(row.pharmacyId || row.pharmacy_id || ''),
                batch_number: row.batchNumber || row.batch_number || '',
                unit_price: row.unitPrice || row.unit_price || 0
            };
        }

        // ─────────────────────────────────────────────
        // 3) CALL AI SERVICE (ROLE-AWARE)
        // ─────────────────────────────────────────────
        const analysis = await sendToAntibioticService({
            sales: scopedRows.map(toAntibioticSale),
            role
        });

        const scoredRows = Array.isArray(analysis?.scored_rows) && analysis.scored_rows.length > 0
            ? analysis.scored_rows
            : scopedRows.map(row => ({
                ...row,
                anomaly_score: null,
                isolation_score: null,
                final_score: null,
                classification: 'NORMAL',
                action: 'No action needed',
            }));
        const anomalies = analysis?.anomalies || [];

        // ─────────────────────────────────────────────
        // 4) FIND ASSIGNED OFFICER (for alert assignment)
        // ─────────────────────────────────────────────
        // If admin runs this, still assign alerts to the officer responsible for that pharmacy
        // We pick officer by the pharmacy of the first row (all rows are same pharmacy if session-based)
        let assignedOfficer = null;
        if (scopedRows.length > 0) {
            assignedOfficer = await userModel.findOne({
                role: 'officer',
                assignedPharmacies: scopedRows[0].pharmacyId
            }).lean();
        }

        let createdCount = 0;
        let updatedCount = 0;

        // ─────────────────────────────────────────────
        // 5) CREATE / UPDATE ALERTS (DEDUPLICATED)
        // ─────────────────────────────────────────────
        for (const anomaly of anomalies) {

            // Find related sale record (by drug + period)
            const saleRecord = await pharmacySaleModel.findOne({
                drugName: anomaly.drug_name,
                saleMonth: anomaly.month,
                saleYear: anomaly.year,
                ...(sessionId ? { uploadSessionId: sessionId } : {})
            });

            if (!saleRecord || !assignedOfficer) continue;

            const riskTier =
                anomaly.classification === 'HIGH' ? 'HIGH' :
                anomaly.classification === 'MEDIUM' ? 'MEDIUM' :
                'LOW';

            // Use atomic upsert to avoid duplicates in concurrent runs
            const upsertResult = await alertModel.updateOne(
                { saleRecordId: saleRecord._id, alertType: 'ANTIBIOTIC_ANOMALY' },
                {
                    $set: {
                        pharmacyId: saleRecord.pharmacyId,
                        officerId: assignedOfficer._id,
                        drugName: anomaly.drug_name,
                        batchNumber: saleRecord.batchNumber,
                        similarityScore: anomaly.final_score,
                        riskTier,
                        officerNotes: `Flags: ${anomaly.flags || ''}`,
                    },
                    $setOnInsert: {
                        saleRecordId: saleRecord._id,
                        createdAt: new Date(),
                    }
                },
                { upsert: true }
            );

            if (upsertResult.upsertedCount && upsertResult.upsertedCount > 0) {
                createdCount += 1;
            } else {
                updatedCount += 1;
            }
        }

        // ─────────────────────────────────────────────
        // 6) RESPONSE
        // ─────────────────────────────────────────────
        return res.status(200).json({
            message: 'Antibiotic anomaly analysis complete',
            roleUsed: role,
            totalRowsLoaded: rows.length,
            matchedAntibioticRows: scopedRows.length,
            inputRows: scopedRows.length,
            anomaliesDetected: anomalies.length,
            anomaliesCreated: createdCount,
            anomaliesUpdated: updatedCount,
            scored_rows: scoredRows,
            anomalies
        });

    } catch (err) {
        console.error('antibioticAnalysisController error:', err);
        return res.status(500).json({
            message: 'Error during antibiotic anomaly analysis'
        });
    }
}

module.exports = {
    analyzeAntibioticCandidates
};
