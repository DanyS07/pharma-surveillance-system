const mongoose          = require('mongoose');
const axios             = require('axios');
const nsqDrugModel      = require('../models/nsqDrugModel');
const pharmacySaleModel = require('../models/pharmacySaleModel');
const alertModel        = require('../models/alertModel');
const userModel         = require('../models/userModel');


// ── CELL SANITISER ────────────────────────────────────────────────
// Strips spreadsheet formula injection from CSV cell values.
// Cells starting with = + - @ can contain malicious formulas.
function sanitiseCell(value) {
    const str = String(value || '').trim();
    if (['=', '+', '-', '@'].includes(str[0])) return str.slice(1).trim();
    return str;
}


// ── PARSE ROWS ────────────────────────────────────────────────────
// Shapes raw XLSX rows into clean documents for DB insertion.
// saleMonth and saleYear come from validated request body (frontend dropdowns).
// No date parsing here — the CSV does not need a date column.
//
// Supports two CSV column naming conventions:
//   New format:    drug_name, batch_number, quantity_sold, unit_price, record_id
//   Legacy format: drugName,  batchNumber,  quantity
function parseRows(rawRows, pharmacyId, sessionId, saleMonth, saleYear) {
    return rawRows.map(row => {
        const drugName     = sanitiseCell(row.drug_name    || row.drugName    || '');
        const batchNumber  = sanitiseCell(row.batch_number || row.batchNumber || '').toUpperCase();
        const quantity     = Number(row.quantity_sold      || row.quantity    || 0);
        const unitPrice    = Number(row.unit_price         || 0);
        const recordId     = sanitiseCell(row.record_id    || '');
        const manufacturer = sanitiseCell(row.manufacturer || '');
        const expiryDate   = sanitiseCell(row.expiryDate   || row.expiry_date || '');

        return {
            pharmacyId,
            uploadSessionId:  sessionId,
            saleMonth,
            saleYear,
            drugName,
            batchNumber,
            manufacturer,
            expiryDate,
            quantity,
            unitPrice,
            pharmacyRecordId: recordId,
            nsqStatus:        'pending',
        };
    });
}


// ── NSQ MASTER LIST LOOKUP ────────────────────────────────────────
// Fast $in query on the indexed batchNumber field.
// Returns only NSQ master records whose batch number appears in this upload.
async function matchAgainstNSQMaster(uploadedRows) {
    const uniqueBatches = [...new Set(uploadedRows.map(r => r.batchNumber))];
    return nsqDrugModel.find({ batchNumber: { $in: uniqueBatches } });
}


// ── BUILD AI PAYLOAD ──────────────────────────────────────────────
// Constructs the minimal payload the AI service needs for NLP fuzzy matching.
//
// rows[]        → batchNumber + drugName only. AI matches drug names.
// nsqRecords[]  → batchNumber + drugName + manufacturer + reportDate.
//                 reportDate is sent as a Date object — simple, no conversion.
//
// NOT sent: pharmacyName, officerId, threshold, quantity, unitPrice, saleMonth.
// These are MERN data — the AI has no use for them for fuzzy name matching.
function buildAIPayload(pharmacyId, sessionId, matchedRows, nsqRecords) {
    return {
        pharmacyId,   // for tracing/logging on AI side only
        sessionId,    // for tracing/logging on AI side only
        rows: matchedRows.map(r => ({
            batchNumber: r.batchNumber,
            drugName:    r.drugName,
        })),
        nsqRecords: nsqRecords.map(n => ({
            batchNumber:  n.batchNumber,
            drugName:     n.drugName,
            manufacturer: n.manufacturer,
            reportDate:   n.reportDate,   // Date object — stored and sent as-is
        })),
    };
}


// ── SEND TO AI MICROSERVICE ───────────────────────────────────────
// POSTs the minimal payload to Python AI at POST /api/nsq/validate-nsq.
// Returns the results array on success, null if AI is unreachable.
//
// AI returns per row:
//   { batchNumber, drugName, result, nsqDrugName, similarityScore, reportDate, manufacturer }
// result values: NSQ_CONFIRMED | PROBABLE_MATCH | SAFE | MISMATCH
async function sendToAI(pharmacyId, sessionId, matchedRows, nsqRecords) {
    try {
        const payload  = buildAIPayload(pharmacyId, sessionId, matchedRows, nsqRecords);
        const response = await axios.post(
            `${process.env.AI_SERVICE_URL}/api/nsq/validate-nsq`,
            payload,
            {
                headers: {
                    'x-api-key':    process.env.AI_API_KEY,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );
        return response.data.results || [];
    } catch (err) {
        console.error('AI microservice error:', err.message);
        return null;
    }
}


// ── RISK TIER CALCULATION ─────────────────────────────────────────
// Calculates regulatory enforcement tier from raw AI similarity score.
// This is business logic — lives in MERN, not in the AI service.
//
// HIGH   → NSQ_CONFIRMED (immediate action — product seizure)
// MEDIUM → PROBABLE_MATCH, similarityScore >= 85 (investigate within 48h)
// LOW    → PROBABLE_MATCH, similarityScore < 85  (log and monitor)
function calculateRiskTier(result, similarityScore) {
    if (result === 'NSQ_CONFIRMED') return 'HIGH';
    if (result === 'PROBABLE_MATCH' && similarityScore >= 85) return 'MEDIUM';
    if (result === 'PROBABLE_MATCH') return 'LOW';
    return null;
}


// ── PROCESS AI RESULTS ────────────────────────────────────────────
// Writes AI classifications back to pharmacy_sales records.
// Creates alerts for NSQ_CONFIRMED and PROBABLE_MATCH rows.
// Wrapped in a Mongoose transaction — all writes succeed or all roll back.
async function processAIResults(aiResults, sessionId, pharmacyId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const assignedOfficer = await userModel.findOne({
            role:               'officer',
            assignedPharmacies: pharmacyId,
        }).session(session);

        for (const result of aiResults) {
            await pharmacySaleModel.updateMany(
                {
                    uploadSessionId: sessionId,
                    batchNumber:     result.batchNumber,
                    drugName:        result.drugName,
                },
                {
                    nsqStatus: result.result,
                    similarityScore: result.similarityScore ?? null,
                },
                { session }
            );

            const shouldAlert = result.result === 'NSQ_CONFIRMED' || result.result === 'PROBABLE_MATCH';

            if (shouldAlert && assignedOfficer) {
                const saleRecord = await pharmacySaleModel.findOne({
                    uploadSessionId: sessionId,
                    batchNumber:     result.batchNumber,
                }).session(session);

                if (saleRecord) {
                    const riskTier = calculateRiskTier(result.result, result.similarityScore);

                    await new alertModel({
                        pharmacyId,
                        officerId:    assignedOfficer._id,
                        saleRecordId: saleRecord._id,
                        drugName:     result.drugName,
                        batchNumber:  result.batchNumber,
                        alertType:    result.result,

                        // Raw AI outputs stored for officer context
                        similarityScore: result.similarityScore || null,
                        nsqDrugName:     result.nsqDrugName     || '',
                        banDate:         result.reportDate       || '',
                        nsqManufacturer: result.manufacturer     || '',

                        // Risk tier calculated by MERN
                        riskTier,
                    }).save({ session });
                }
            }
        }

        // Rows AI did not return a result for = no name match = SAFE
        await pharmacySaleModel.updateMany(
            { uploadSessionId: sessionId, nsqStatus: 'pending' },
            { nsqStatus: 'SAFE', similarityScore: null },
            { session }
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
}


module.exports = {
    parseRows,
    matchAgainstNSQMaster,
    sendToAI,
    processAIResults,
    sanitiseCell,
};
