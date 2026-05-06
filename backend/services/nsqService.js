const mongoose          = require('mongoose');
const axios             = require('axios');
const nsqDrugModel      = require('../models/nsqDrugModel');
const pharmacySaleModel = require('../models/pharmacySaleModel');
const alertModel        = require('../models/alertModel');
const userModel         = require('../models/userModel');

function sanitiseCell(value) {
    const str = String(value || '').trim();
    if (['=', '+', '-', '@'].includes(str[0])) return str.slice(1).trim();
    return str;
}

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

async function matchAgainstNSQMaster(uploadedRows) {
    const uniqueBatches = [...new Set(uploadedRows.map(r => r.batchNumber))];
    return nsqDrugModel.find({ batchNumber: { $in: uniqueBatches } });
}

function buildAIPayload(pharmacyId, sessionId, matchedRows, nsqRecords) {
    return {
        pharmacyId,
        sessionId,
        rows: matchedRows.map(r => ({
            batchNumber: r.batchNumber,
            drugName:    r.drugName,
        })),
        nsqRecords: nsqRecords.map(n => ({
            batchNumber:  n.batchNumber,
            drugName:     n.drugName,
            manufacturer: n.manufacturer,
            reportDate:   n.reportDate,
        })),
    };
}

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

function calculateRiskTier(result, similarityScore) {
    if (result === 'NSQ_CONFIRMED') return 'HIGH';
    if (result === 'PROBABLE_MATCH' && similarityScore >= 85) return 'MEDIUM';
    if (result === 'PROBABLE_MATCH') return 'LOW';
    return null;
}


// 🔧 FIXED FUNCTION
async function applyAIResults(aiResults, sessionId, pharmacyId, session = null) {
    const assignedOfficerQuery = userModel.findOne({
        role:               'officer',
        assignedPharmacies: pharmacyId,
    });
    const assignedOfficer = session ? await assignedOfficerQuery.session(session) : await assignedOfficerQuery;

    for (const result of aiResults) {

        // ✅ Relaxed match (batchNumber is primary key)
        await pharmacySaleModel.updateMany(
            {
                uploadSessionId: sessionId,
                batchNumber:     result.batchNumber,
            },
            {
                nsqStatus:        result.result,
                similarityScore:  result.similarityScore ?? null,
                nsqDrugName:      result.nsqDrugName || '',
                nsqManufacturer:  result.manufacturer || '',
                nsqBanDate:       result.reportDate || '',
            },
            session ? { session } : undefined
        );

        const shouldAlert = result.result === 'NSQ_CONFIRMED' || result.result === 'PROBABLE_MATCH';

        if (shouldAlert && assignedOfficer) {
            const saleRecordQuery = pharmacySaleModel.findOne({
                uploadSessionId: sessionId,
                batchNumber:     result.batchNumber,
            });
            const saleRecord = session ? await saleRecordQuery.session(session) : await saleRecordQuery;

            if (saleRecord) {
                const riskTier = calculateRiskTier(result.result, result.similarityScore);

                // 🔧 FIX: Safe upsert (handles duplicate key race)
                try {
                    await alertModel.updateOne(
                        { saleRecordId: saleRecord._id, alertType: result.result },
                        {
                            $setOnInsert: {
                                pharmacyId,
                                officerId:    assignedOfficer._id,
                                saleRecordId: saleRecord._id,
                                drugName:     result.drugName,
                                batchNumber:  result.batchNumber,
                                alertType:    result.result,
                                similarityScore: result.similarityScore ?? null,
                                nsqDrugName:     result.nsqDrugName     || '',
                                banDate:         result.reportDate      || '',
                                nsqManufacturer: result.manufacturer    || '',
                                riskTier,
                            },
                        },
                        session ? { session, upsert: true } : { upsert: true }
                    );
                } catch (e) {
                    if (e.code === 11000) {
                        console.warn('Duplicate alert avoided:', result.batchNumber);
                    } else {
                        throw e;
                    }
                }
            }
        }
    }

    await pharmacySaleModel.updateMany(
        { uploadSessionId: sessionId, nsqStatus: 'pending' },
        { nsqStatus: 'SAFE', similarityScore: null },
        session ? { session } : undefined
    );
}


// 🔧 Improved error logging
async function processAIResults(aiResults, sessionId, pharmacyId) {
    const enableTransactions = String(process.env.ENABLE_MONGO_TRANSACTIONS || '').toLowerCase() === 'true';

    if (!enableTransactions) {
        console.log(`[processAIResults] non-transaction mode for session ${sessionId}`);
        await applyAIResults(aiResults, sessionId, pharmacyId, null);
        return;
    }

    console.log(`[processAIResults] transaction mode for session ${sessionId}`);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await applyAIResults(aiResults, sessionId, pharmacyId, session);
        await session.commitTransaction();
    } catch (err) {

        try {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
        } catch (abortErr) {
            console.error('Transaction abort warning:', abortErr.message);
        }

        console.error('FULL ERROR:', err); // 🔥 important

        const txUnsupported =
            /Transaction numbers are only allowed on a replica set member or mongos/i.test(err.message) ||
            /Transaction with \{ txnNumber: .*\} has been aborted/i.test(err.message);

        if (txUnsupported) {
            console.warn('Retrying without transaction...');
            await applyAIResults(aiResults, sessionId, pharmacyId, null);
            return;
        }

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