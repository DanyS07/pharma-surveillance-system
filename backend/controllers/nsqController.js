const XLSX             = require('xlsx');
const nsqDrugModel     = require('../models/nsqDrugModel');
const { logAction }    = require('../services/auditService');
const { sanitiseCell } = require('../services/nsqService');

const ALLOWED_EXTS  = ['.csv', '.xls', '.xlsx'];
const ALLOWED_MIMES = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function isValidFile(file) {
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    return ALLOWED_EXTS.includes(ext) && ALLOWED_MIMES.includes(file.mimetype);
}

// Parses the CDSCO CSV date column into a proper JavaScript Date object.
//
// CDSCO CSV format: "01-01-2020" (DD-MM-YYYY)
// Also handles:
//   Excel serial numbers → converted via XLSX.SSF.parse_date_code
//   Any other parseable date string → new Date(str) as fallback
//
// Returns null if unparseable — row is skipped with a clear reason.
function parseCSVDate(raw) {
    if (!raw && raw !== 0) return null;

    // Excel serial number (e.g. 43831)
    if (typeof raw === 'number' || (!isNaN(raw) && !String(raw).includes('-'))) {
        const parsed = XLSX.SSF.parse_date_code(Number(raw));
        if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
        return null;
    }

    const str = String(raw).trim();

    // DD-MM-YYYY (primary CDSCO format: "01-01-2020")
    const ddmmyyyy = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyy) {
        const d = new Date(
            parseInt(ddmmyyyy[3], 10),   // year
            parseInt(ddmmyyyy[2], 10) - 1, // month (0-indexed)
            parseInt(ddmmyyyy[1], 10)    // day
        );
        if (!isNaN(d.getTime())) return d;
    }

    // Fallback: let JavaScript parse any other recognisable format
    const fallback = new Date(str);
    if (!isNaN(fallback.getTime())) return fallback;

    return null;
}


// ── POST /nsq/add ────────────────────────────────────────────────
// Admin adds a single NSQ record manually.
exports.addNSQRecord = async (req, res) => {
    try {
        const { drugName, batchNumber, manufacturer, reason, cdscoPdfRef, reportDate } = req.body;

        if (!drugName?.trim())    return res.status(400).json({ message: 'Drug name is required' });
        if (!batchNumber?.trim()) return res.status(400).json({ message: 'Batch number is required' });
        if (!reportDate)          return res.status(400).json({ message: 'Report date is required (format: DD-MM-YYYY e.g. 01-01-2020)' });

        const parsedDate = parseCSVDate(reportDate);
        if (!parsedDate) {
            return res.status(400).json({ message: 'Could not parse reportDate. Use format: DD-MM-YYYY (e.g. 01-01-2020)' });
        }

        const saved = await new nsqDrugModel({
            drugName:     drugName.trim(),
            batchNumber:  batchNumber.trim().toUpperCase(),
            manufacturer: manufacturer || '',
            reason:       reason       || '',
            cdscoPdfRef:  cdscoPdfRef  || '',
            reportDate:   parsedDate,
        }).save();

        await logAction(req, 'NSQ_RECORD_ADDED', saved._id, 'nsq_drug', `Added: ${drugName} | Batch: ${batchNumber}`);
        res.status(201).json({ message: 'NSQ record added', record: saved });
    } catch (err) {
        console.error('addNSQRecord error:', err);
        res.status(500).json({ message: 'Error adding NSQ record' });
    }
};


// ── POST /nsq/upload-csv ─────────────────────────────────────────
// Admin uploads the official CDSCO NSQ list CSV.
//
// Accepted CDSCO column names:
//   "Name of Product"        → drugName
//   "Batch No"               → batchNumber
//   "Manufactured By"        → manufacturer
//   "NSQ Result"             → reason
//   "Reporting Source"       → cdscoPdfRef
//   "Reporting Month & Year" → reportDate (parsed as Date, CDSCO provides DD-MM-YYYY)
//
// All rows are inserted — no duplicate skipping.
// The unique index has been removed from nsq_drugs because the same batch number
// can legitimately appear across multiple CDSCO reports (different months/years).
exports.uploadNSQCsv = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        if (!isValidFile(req.file)) {
            return res.status(400).json({ message: 'Only .csv and .xlsx files are allowed' });
        }

        const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawRows   = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rawRows.length === 0) {
            return res.status(400).json({ message: 'File is empty or has no readable rows' });
        }

        const firstRow = rawRows[0];
        const isCDSCO  = 'Name of Product' in firstRow;
        const isCustom = 'drugName'         in firstRow;

        if (!isCDSCO && !isCustom) {
            return res.status(400).json({
                message: 'Unrecognised columns. File must have CDSCO columns ("Name of Product", "Batch No", "Reporting Month & Year") or custom columns ("drugName", "batchNumber", "reportDate").',
            });
        }

        const validRows   = [];
        const skippedRows = [];

        for (const row of rawRows) {
            let drugName, batchNumber, manufacturer, reason, cdscoPdfRef, reportDate;

            if (isCDSCO) {
                drugName     = sanitiseCell(row['Name of Product']);
                batchNumber  = sanitiseCell(row['Batch No']);
                manufacturer = sanitiseCell(row['Manufactured By']    || '');
                reason       = sanitiseCell(row['NSQ Result']         || '');
                cdscoPdfRef  = sanitiseCell(row['Reporting Source']   || '');
                reportDate   = parseCSVDate(row['Reporting Month & Year']);
            } else {
                drugName     = sanitiseCell(row.drugName);
                batchNumber  = sanitiseCell(row.batchNumber);
                manufacturer = sanitiseCell(row.manufacturer || '');
                reason       = sanitiseCell(row.reason       || '');
                cdscoPdfRef  = sanitiseCell(row.cdscoPdfRef  || '');
                reportDate   = parseCSVDate(row.reportDate);
            }

            // Only skip rows missing drugName or reportDate
            // batchNumber is required — skip if missing (these are the 2 rows you saw)
            if (!drugName || !batchNumber || !reportDate) {
                skippedRows.push({
                    row:    isCDSCO ? row['Name of Product'] : row.drugName,
                    reason: !drugName    ? 'Missing drug name'                  :
                            !batchNumber ? 'Missing batch number'               :
                                           'Missing or unparseable report date',
                });
                continue;
            }

            validRows.push({
                drugName:    drugName,
                batchNumber: batchNumber.toUpperCase(),
                manufacturer,
                reason,
                cdscoPdfRef,
                reportDate,  // Date object
            });
        }

        if (validRows.length === 0) {
            return res.status(400).json({
                message:      'No valid rows found. Check required columns have data.',
                skippedCount: skippedRows.length,
                skippedRows,
            });
        }

        // Insert all valid rows — no ordered: false needed since there is no unique index
        // Every row gets inserted regardless of whether the same drug+batch appeared before
        const result = await nsqDrugModel.insertMany(validRows);

        await logAction(
            req, 'NSQ_CSV_UPLOADED', 'bulk', 'nsq_drug',
            `Bulk: ${result.length} inserted, ${skippedRows.length} invalid rows skipped`
        );

        res.status(200).json({
            message:           'NSQ CSV processed',
            inserted:           result.length,
            invalidRowsSkipped: skippedRows.length,
            totalRowsInFile:    rawRows.length,
            skippedDetails:     skippedRows.length > 0 ? skippedRows : undefined,
        });
    } catch (err) {
        console.error('uploadNSQCsv error:', err);
        res.status(500).json({ message: 'Error processing NSQ CSV' });
    }
};


// ── GET /nsq/all ─────────────────────────────────────────────────
exports.getAllNSQ = async (req, res) => {
    try {
        const records = await nsqDrugModel.find().sort({ createdAt: -1 });
        res.status(200).json({ message: 'NSQ records fetched', records });
    } catch (err) {
        console.error('getAllNSQ error:', err);
        res.status(500).json({ message: 'Error fetching NSQ records' });
    }
};


// ── DELETE /nsq/:recordId ────────────────────────────────────────
exports.deleteNSQRecord = async (req, res) => {
    try {
        const deleted = await nsqDrugModel.findByIdAndDelete(req.params.recordId);
        if (!deleted) return res.status(404).json({ message: 'Record not found' });

        await logAction(req, 'NSQ_RECORD_DELETED', deleted._id, 'nsq_drug', `Removed: ${deleted.drugName} | Batch: ${deleted.batchNumber}`);
        res.status(200).json({ message: 'NSQ record removed' });
    } catch (err) {
        console.error('deleteNSQRecord error:', err);
        res.status(500).json({ message: 'Error deleting NSQ record' });
    }
};