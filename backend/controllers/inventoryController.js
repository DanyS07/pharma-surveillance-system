const { randomUUID }    = require('crypto');
const mongoose          = require('mongoose');
const XLSX              = require('xlsx');
const pharmacySaleModel = require('../models/pharmacySaleModel');
const { logAction }     = require('../services/auditService');
const {
    parseRows,
    matchAgainstNSQMaster,
    sendToAI,
    processAIResults,
} = require('../services/nsqService');
const {
    fetchAntibioticReferenceRecords,
    sendAntibioticRowsToAI,
} = require('../services/antibioticService');

const ALLOWED_EXTS  = ['.csv', '.xls', '.xlsx'];
const ALLOWED_MIMES = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
];

function isValidFile(file) {
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    return ALLOWED_EXTS.includes(ext) && ALLOWED_MIMES.includes(file.mimetype);
}


// ── POST /inventory/upload ───────────────────────────────────────
// Expects multipart/form-data with three fields:
//   file  — the CSV or XLSX inventory file
//   month — reporting period month as an integer string ("1" to "12")
//   year  — reporting period year as an integer string ("2024", "2025", etc.)
//
// The month and year are read from req.body (multer populates non-file
// form-data fields there). They are validated and stamped onto every
// parsed row — the CSV itself does not need a date column at all.
exports.uploadInventory = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        if (!isValidFile(req.file)) {
            return res.status(400).json({ message: 'Only .csv and .xlsx files are allowed' });
        }

        // ── Validate month and year from request body ────────────────
        const month = parseInt(req.body.month, 10);
        const year  = parseInt(req.body.year,  10);
        const currentYear = new Date().getFullYear();

        if (!req.body.month || isNaN(month) || month < 1 || month > 12) {
            return res.status(400).json({
                message: 'month is required and must be a number between 1 and 12.',
            });
        }

        if (!req.body.year || isNaN(year) || year < 2020 || year > currentYear) {
            return res.status(400).json({
                message: `year is required and must be between 2020 and ${currentYear}.`,
            });
        }

        // Prevent future month submissions for the current year.
        // A pharmacy cannot submit July's data in January.
        const now = new Date();
        if (year === currentYear && month > now.getMonth() + 1) {
            return res.status(400).json({
                message: `Cannot upload data for a future month. Selected: ${MONTH_NAMES[month - 1]} ${year}.`,
            });
        }

        const pharmacyId = req.user.id;

        // ── Duplicate upload guard ───────────────────────────────────
        // A pharmacy can only submit one file per reporting period.
        // In a regulatory system, double submissions for the same period
        // create ambiguity in the compliance record — block them explicitly.
        const existingUpload = await pharmacySaleModel.findOne({
            pharmacyId,
            saleMonth: month,
            saleYear:  year,
        });

        if (existingUpload) {
            return res.status(409).json({
                message: `You have already uploaded inventory for ${MONTH_NAMES[month - 1]} ${year}. Contact your Drug Control Officer if you need to correct this submission.`,
            });
        }

        // ── Parse the file ───────────────────────────────────────────
        const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawRows   = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rawRows.length === 0) {
            return res.status(400).json({ message: 'File is empty or has no readable rows' });
        }

        // ── Column validation ────────────────────────────────────────
        // Check for the minimum required columns in either naming convention.
        // We check the first row only — if the first row has the column, the
        // file is structurally valid. Row-level missing values are handled
        // gracefully by parseRows (defaults to empty string / 0).
        const firstRow = rawRows[0];

        const hasDrugName    = 'drug_name'     in firstRow || 'drugName'    in firstRow;
        const hasBatchNumber = 'batch_number'  in firstRow || 'batchNumber' in firstRow;
        const hasQuantity    = 'quantity_sold' in firstRow || 'quantity'    in firstRow;

        if (!hasDrugName) {
            return res.status(400).json({
                message: 'Missing required column: drug_name (or drugName). Check your file headers.',
            });
        }
        if (!hasBatchNumber) {
            return res.status(400).json({
                message: 'Missing required column: batch_number (or batchNumber). Check your file headers.',
            });
        }
        if (!hasQuantity) {
            return res.status(400).json({
                message: 'Missing required column: quantity_sold (or quantity). Check your file headers.',
            });
        }

        // ── Insert rows ──────────────────────────────────────────────
        const sessionId = randomUUID();

        // parseRows stamps saleMonth and saleYear from the validated request body
        // onto every row — the CSV does not need a date column
        const cleanRows = parseRows(rawRows, pharmacyId, sessionId, month, year);

        await pharmacySaleModel.insertMany(cleanRows);

        await logAction(
            req,
            'FILE_UPLOADED',
            sessionId,
            'uploadSession',
            `${cleanRows.length} rows for ${MONTH_NAMES[month - 1]} ${year} from pharmacy ${pharmacyId}`
        );

        // ── Step 1: Hybrid NSQ batch match ───────────────────────────
        // Fast $in query on the indexed batchNumber field.
        // Returns only master list records whose batch number appears in this upload.
        const nsqMatches = await matchAgainstNSQMaster(cleanRows);

        if (nsqMatches.length === 0) {
            await pharmacySaleModel.updateMany({ uploadSessionId: sessionId }, { nsqStatus: 'SAFE' });
            return res.status(200).json({
                message:       'File processed. No NSQ batch matches found. All rows marked SAFE.',
                sessionId,
                totalRows:     cleanRows.length,
                nsqMatchCount: 0,
                period:        `${MONTH_NAMES[month - 1]} ${year}`,
            });
        }

        // ── Step 2: AI NLP validation ────────────────────────────────
        // Only the batch-matched rows are sent to the Python AI service.
        // The AI confirms or rejects the match using drug name fuzzy matching.
        const matchedBatches = nsqMatches.map(n => String(n.batchNumber || '').trim().toUpperCase());
        const matchedBatchSet = new Set(matchedBatches);
        const rowsForAI = cleanRows.filter(
            r => matchedBatchSet.has(String(r.batchNumber || '').trim().toUpperCase())
        );
        const aiResults      = await sendToAI(pharmacyId, sessionId, rowsForAI, nsqMatches);

        if (!aiResults) {
            // AI is unreachable — upload is saved, matched rows stay 'pending'.
            // A retry mechanism (Redis queue, cron job) should reprocess pending rows.
            return res.status(200).json({
                message:   'File uploaded. NSQ check pending — AI service unreachable.',
                sessionId,
                totalRows: cleanRows.length,
                warning:   'Matched rows remain PENDING until the AI service recovers.',
                period:    `${MONTH_NAMES[month - 1]} ${year}`,
            });
        }

        // ── Step 3: Write AI results + create alerts ─────────────────
        // Runs inside a Mongoose transaction — all writes succeed or all roll back.
        await processAIResults(aiResults, sessionId, pharmacyId);

        const confirmedRows = aiResults.filter(r => r.result === 'NSQ_CONFIRMED');
        const confirmedBatchCount = new Set(
            confirmedRows.map(r => String(r.batchNumber || '').trim().toUpperCase())
        ).size;

        res.status(200).json({
            message:            'File processed. NSQ check complete.',
            sessionId,
            totalRows:          cleanRows.length,
            nsqMatchCount:      matchedBatchSet.size,
            confirmedNSQ:       confirmedBatchCount,
            period:             `${MONTH_NAMES[month - 1]} ${year}`,
        });

    } catch (err) {
        console.error('uploadInventory error:', err);
        res.status(500).json({ message: err.message || 'Upload error' });
    }
};


// ── GET /inventory/my-uploads ────────────────────────────────────
exports.getMyUploads = async (req, res) => {
    try {
        const pharmacyId = mongoose.Types.ObjectId.isValid(req.user.id)
            ? new mongoose.Types.ObjectId(req.user.id)
            : req.user.id;

        const uploads = await pharmacySaleModel.aggregate([
            { $match: { pharmacyId } },
            {
                $group: {
                    _id: '$uploadSessionId',
                    sid: { $first: '$uploadSessionId' },
                    date: { $max: '$createdAt' },
                    rows: { $sum: 1 },
                    nsq: {
                        $sum: {
                            $cond: [{ $eq: ['$nsqStatus', 'NSQ_CONFIRMED'] }, 1, 0],
                        },
                    },
                    month: { $first: '$saleMonth' },
                    year: { $first: '$saleYear' },
                },
            },
            { $sort: { year: -1, month: -1, date: -1 } },
        ]);

        res.status(200).json({ message: 'Uploads fetched', uploads });
    } catch (err) {
        console.error('getMyUploads error:', err);
        res.status(500).json({ message: 'Error fetching uploads' });
    }
};


// ── GET /inventory/session/:sessionId ────────────────────────────
exports.getSession = async (req, res) => {
    try {
        const records = await pharmacySaleModel.find({ uploadSessionId: req.params.sessionId });
        if (records.length === 0) {
            return res.status(404).json({ message: 'No records found for this session' });
        }
        res.status(200).json({ message: 'Session fetched', records });
    } catch (err) {
        console.error('getSession error:', err);
        res.status(500).json({ message: 'Error fetching session' });
    }
};


// GET /inventory/session/:sessionId/antibiotic-matches
// Runs the antibiotic-sales fuzzy matcher on an uploaded pharmacy session.
// Returns JSON plus CSV-ready rows so downstream Python jobs can persist directly.
exports.getAntibioticMatchesForSession = async (req, res) => {
    try {
        const salesRows = await pharmacySaleModel.find({
            uploadSessionId: req.params.sessionId,
        }).lean();

        if (salesRows.length === 0) {
            return res.status(404).json({ message: 'No records found for this session' });
        }

        const antibioticRecords = await fetchAntibioticReferenceRecords();

        if (antibioticRecords.length === 0) {
            return res.status(404).json({
                message: 'No antibiotic reference records found in antibiotic_master.',
            });
        }

        const aiResponse = await sendAntibioticRowsToAI(
            String(salesRows[0].pharmacyId),
            req.params.sessionId,
            salesRows,
            antibioticRecords,
        );

        if (!aiResponse) {
            return res.status(503).json({
                message: 'Antibiotic matching is temporarily unavailable.',
            });
        }

        res.status(200).json({
            message: 'Antibiotic matching complete.',
            ...aiResponse,
        });
    } catch (err) {
        console.error('getAntibioticMatchesForSession error:', err);
        res.status(500).json({ message: 'Error running antibiotic matching' });
    }
};
