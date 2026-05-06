const PDFDocument = require('pdfkit');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const pharmacySaleModel = require('../models/pharmacySaleModel');
const alertModel = require('../models/alertModel');
const userModel = require('../models/userModel');

const resolveRequestUser = (req) => {
    if (req.user?.id) {
        return req.user;
    }

    const token = req.cookies?.token;
    if (!token) {
        return null;
    }

    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
        return null;
    }
};

const normalizeId = (id) => String(id || '').trim();

const toObjectId = (id) => {
    const value = normalizeId(id);
    return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : value;
};

const toQueryIds = (ids) => ids.map(toObjectId);

// Helper: Get pharmacies accessible by user
const getAccessiblePharmacies = async (userId, role) => {
    if (role === 'admin') {
        // Admin sees all pharmacies
        return await pharmacySaleModel.distinct('pharmacyId');
    } else if (role === 'officer') {
        // Officer sees assigned pharmacies
        const officer = await userModel.findById(userId);
        return officer?.assignedPharmacies || [];
    } else {
        // Pharmacy user sees own data
        return [userId];
    }
};

// Helper: Get sales data with aggregation
const getSalesSummary = async (pharmacyIds, startDate, endDate) => {
    const queryPharmacyIds = toQueryIds(pharmacyIds);

    // Accept rows that either have a createdAt timestamp inside the range
    // OR have a reporting period defined by saleYear+saleMonth that falls inside the range.
    const salesData = await pharmacySaleModel.aggregate([
        {
            $match: {
                pharmacyId: { $in: queryPharmacyIds },
                $or: [
                    { createdAt: { $gte: startDate, $lte: endDate } },
                    { $expr: {
                        $and: [
                            { $gte: [ { $dateFromParts: { year: '$saleYear', month: '$saleMonth', day: 1 } }, startDate ] },
                            { $lte: [ { $dateFromParts: { year: '$saleYear', month: '$saleMonth', day: 1 } }, endDate ] }
                        ]
                    } }
                ]
            }
        },
        {
            $group: {
                _id: '$drugName',
                totalQuantity: { $sum: '$quantity' },
                avgUnitPrice: { $avg: '$unitPrice' },
                transactions: { $sum: 1 }
            }
        },
        { $sort: { totalQuantity: -1 } }
    ]);

    const totalQuantity = salesData.reduce((sum, item) => sum + item.totalQuantity, 0);
    
    // Reuse a matching filter for the summary count to keep results consistent.
    const summaryMatch = {
        pharmacyId: { $in: queryPharmacyIds },
        $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { $expr: {
                $and: [
                    { $gte: [ { $dateFromParts: { year: '$saleYear', month: '$saleMonth', day: 1 } }, startDate ] },
                    { $lte: [ { $dateFromParts: { year: '$saleYear', month: '$saleMonth', day: 1 } }, endDate ] }
                ]
            } }
        ]
    };

    return {
        summary: {
            totalTransactions: await pharmacySaleModel.countDocuments(summaryMatch),
            totalQuantity,
            uniqueDrugs: salesData.length
        },
        topDrugs: salesData.slice(0, 10),
        allDrugs: salesData
    };
};

// Helper: Get anomaly summary
const getAnomalySummary = async (pharmacyIds, startDate, endDate) => {
    const queryPharmacyIds = toQueryIds(pharmacyIds);

    const anomalies = await alertModel.find({
        pharmacyId: { $in: queryPharmacyIds },
        createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: -1 });

    const byStatus = {
        OPEN: anomalies.filter(a => a.status === 'OPEN').length,
        INVESTIGATING: anomalies.filter(a => a.status === 'INVESTIGATING').length,
        RESOLVED: anomalies.filter(a => a.status === 'RESOLVED').length
    };

    const byDrug = {};
    anomalies.forEach(a => {
        if (!byDrug[a.drugName]) byDrug[a.drugName] = 0;
        byDrug[a.drugName]++;
    });

    return {
        totalAnomalies: anomalies.length,
        byStatus,
        topAnomalies: Object.entries(byDrug)
            .map(([drug, count]) => ({ drug, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        recentAnomalies: anomalies.slice(0, 10)
    };
};

// Helper: Get trend data (aggregated by date)
const getTrendData = async (pharmacyIds, startDate, endDate, granularity = 'daily') => {
    const queryPharmacyIds = toQueryIds(pharmacyIds);

    const dateFormat = granularity === 'daily' 
        ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        : { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
    // For trend data, derive a grouping key either from createdAt or from saleYear/saleMonth.
    // We'll add a synthetic `periodDate` field that uses createdAt when available, otherwise the first day
    // of the saleMonth/saleYear. Then group by that `periodDate` formatted according to granularity.
    return await pharmacySaleModel.aggregate([
        {
            $match: {
                pharmacyId: { $in: queryPharmacyIds },
                $or: [
                    { createdAt: { $gte: startDate, $lte: endDate } },
                    { $expr: {
                        $and: [
                            { $gte: [ { $dateFromParts: { year: '$saleYear', month: '$saleMonth', day: 1 } }, startDate ] },
                            { $lte: [ { $dateFromParts: { year: '$saleYear', month: '$saleMonth', day: 1 } }, endDate ] }
                        ]
                    } }
                ]
            }
        },
        {
            $addFields: {
                periodDate: {
                    $cond: [
                        { $and: [ { $gte: [ '$createdAt', startDate ] }, { $lte: [ '$createdAt', endDate ] } ] },
                        '$createdAt',
                        { $dateFromParts: { year: '$saleYear', month: '$saleMonth', day: 1 } }
                    ]
                }
            }
        },
        {
            $group: {
                _id: granularity === 'daily' ? { $dateToString: { format: '%Y-%m-%d', date: '$periodDate' } } : { $dateToString: { format: '%Y-%m', date: '$periodDate' } },
                quantity: { $sum: '$quantity' },
                transactions: { $sum: 1 },
                avgPrice: { $avg: '$unitPrice' }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

// Helper: Get pharmacy details
const getPharmacyDetails = async (pharmacyIds) => {
    const queryPharmacyIds = toQueryIds(pharmacyIds);

    return await userModel.find(
        { _id: { $in: queryPharmacyIds }, role: 'pharmacy' },
        { name: 1, email: 1, district: 1, licenseNumber: 1 }
    );
};

// Generate PDF Report
const generatePDFReport = async (data) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40,
            bufferPages: true
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Helper: add section
        const addSection = (title) => {
            doc.fontSize(14).font('Helvetica-Bold').text(title, { underline: true });
            doc.moveDown(0.5);
        };

        const addSubsection = (title) => {
            doc.fontSize(11).font('Helvetica-Bold').text(title);
            doc.moveDown(0.3);
        };

        // Cover Page (official-style)
        doc.fontSize(28).font('Helvetica-Bold').text('Antibiotic Sales & Anomaly Detection Report', { align: 'center' });
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica').text(`Scope: ${data.scope}`, { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(12).text(`Reporting Period: ${data.dateRange || ''}`, { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(12).text(`Prepared by: ${data.generatedBy || 'System'}`, { align: 'center' });
        doc.moveDown(4);
        doc.fontSize(10).text('Confidential — For internal monitoring purposes only.', { align: 'center' });
        doc.addPage();

        // Header Section (on content pages)
        doc.fontSize(16).font('Helvetica-Bold').text('Antibiotic Sales & Anomaly Detection Report', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.fontSize(9).text(`Role: ${data.role}`, { align: 'center' });
        doc.fontSize(9).text(`Scope: ${data.scope}`, { align: 'center' });
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(1);

        // Pharmacy Details
        if (data.pharmacies && data.pharmacies.length > 0) {
            addSection('Pharmacy Details');
            data.pharmacies.forEach(pharm => {
                doc.fontSize(10).font('Helvetica-Bold').text(pharm.name || 'Unknown');
                if (pharm.district) doc.fontSize(9).text(`Location: ${pharm.district}`);
                if (pharm.licenseNumber) doc.fontSize(9).text(`License: ${pharm.licenseNumber}`);
                doc.moveDown(0.3);
            });
            doc.moveDown(0.5);
        }
        
        // Executive summary (official report style)
        addSection('Executive Summary');
        doc.fontSize(10).font('Helvetica');
        try {
            const totalTx = data.sales?.summary?.totalTransactions || 0;
            const totalQty = data.sales?.summary?.totalQuantity || 0;
            const uniqueDrugs = data.sales?.summary?.uniqueDrugs || 0;
            const totalAnom = data.anomalies?.totalAnomalies || 0;
            const topDrug = data.sales?.topDrugs?.[0]?._id || 'N/A';

            doc.text(`Period: ${data.dateRange || ''}`);
            doc.text(`Total Transactions: ${totalTx}`);
            doc.text(`Total Quantity Sold: ${totalQty} units`);
            doc.text(`Unique Drugs Sold: ${uniqueDrugs}`);
            doc.text(`Total Anomalies Detected: ${totalAnom}`);
            doc.text(`Top Selling Antibiotic: ${topDrug}`);
            doc.moveDown(0.5);
        } catch (e) {
            // keep going even if summary assembly fails
        }
        // Sales Summary
        if (data.sales) {
            addSection('Sales Summary');
            const { summary, topDrugs } = data.sales;
            
            doc.fontSize(10);
            doc.text(`Total Transactions: ${summary.totalTransactions}`);
            doc.text(`Total Quantity Sold: ${summary.totalQuantity} units`);
            doc.text(`Unique Drugs: ${summary.uniqueDrugs}`);
            doc.moveDown(0.5);

            if (topDrugs.length > 0) {
                addSubsection('Top Antibiotics by Sales');
                doc.fontSize(8).font('Helvetica');
                const table = {
                    headers: ['Drug Name', 'Quantity', 'Transactions', 'Avg Price'],
                    rows: topDrugs.slice(0, 8).map(d => [
                        d._id.substring(0, 25),
                        d.totalQuantity.toString(),
                        d.transactions.toString(),
                        `₹${d.avgUnitPrice.toFixed(2)}`
                    ])
                };
                drawTable(doc, table, 40, doc.y);
                doc.moveDown(1);
            }
        }

        // Anomaly Detection Summary
        if (data.anomalies) {
            addSection('Anomaly Detection Summary');
            const { totalAnomalies, byStatus, topAnomalies } = data.anomalies;
            
            doc.fontSize(10);
            doc.text(`Total Anomalies Detected: ${totalAnomalies}`);
            doc.text(`  • Open: ${byStatus.OPEN} | Investigating: ${byStatus.INVESTIGATING} | Resolved: ${byStatus.RESOLVED}`);
            doc.moveDown(0.5);

            if (topAnomalies.length > 0) {
                addSubsection('Most Flagged Antibiotics');
                doc.fontSize(8).font('Helvetica');
                const anomTable = {
                    headers: ['Drug Name', 'Flag Count'],
                    rows: topAnomalies.slice(0, 10).map(a => [
                        a.drug.substring(0, 35),
                        a.count.toString()
                    ])
                };
                drawTable(doc, anomTable, 40, doc.y);
                doc.moveDown(1);
            }
        }

        // Check if we need a new page
        if (doc.y > 700) {
            doc.addPage();
        }

        // Top Insights
        if (data.insights) {
            addSection('Key Insights');
            doc.fontSize(9).font('Helvetica');
            data.insights.forEach(insight => {
                doc.text(`• ${insight}`, { width: 500 });
            });
            doc.moveDown(0.5);
        }

        // Footer
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(0.3);
        doc.fontSize(8).font('Helvetica').text('Pharma Surveillance System', { align: 'center' });
        doc.text(`Report generated by: ${data.generatedBy || 'System'}`, { align: 'center' });
        doc.text('Disclaimer: This report is for internal monitoring purposes only.', { align: 'center' });

        doc.end();
    });
};

// Helper: Draw a simple table
const drawTable = (doc, table, x, y) => {
    const rowHeight = 20;
    const totalWidth = 520;
    const colCount = table.headers.length || 1;
    const baseWidth = Math.floor(totalWidth / colCount);
    const colWidths = table.headers.map((_, i) => baseWidth + (i === 0 ? totalWidth - baseWidth * colCount : 0));
    
    // Headers
    doc.font('Helvetica-Bold').fontSize(8);
    let xPos = x;
    table.headers.forEach((header, i) => {
        doc.text(header, xPos, y, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
    });
    
    y += rowHeight;
    doc.moveTo(x, y).lineTo(x + totalWidth, y).strokeColor('#dddddd').stroke();
    y += 5;
    
    // Rows
    doc.font('Helvetica').fontSize(7);
    table.rows.forEach(row => {
        xPos = x;
        row.forEach((cell, i) => {
            const w = colWidths[i] || baseWidth;
            doc.text(cell, xPos, y, { width: w, align: i === 0 ? 'left' : 'right' });
            xPos += w;
        });
        y += rowHeight;
    });
    
    doc.y = y;
};

const REPORT_PAGE = {
    left: 48,
    right: 547,
    top: 48,
    bottom: 780,
    width: 499,
};

const cleanReportText = (value, fallback = 'N/A') => {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return text || fallback;
};

const truncateReportText = (value, max = 70, fallback = 'N/A') => {
    const text = cleanReportText(value, fallback);
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
};

const formatReportNumber = value => Number(value || 0).toLocaleString('en-IN');

const getAnomalyScore = row => {
    const score = row?.anomaly_score ?? row?.anomalyScore ?? row?.isolation_score ?? row?.similarityScore ?? null;
    return Number.isFinite(Number(score)) ? Number(score).toFixed(2) : 'N/A';
};

const getAnomalyRisk = row => {
    const explicit = row?.risk ?? row?.riskLevel ?? row?.riskTier ?? row?.severity;
    if (explicit) return cleanReportText(explicit).toUpperCase();
    const score = Number(row?.anomaly_score ?? row?.anomalyScore ?? row?.isolation_score ?? 0);
    if (score >= 75) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    if (score > 0) return 'LOW';
    return 'N/A';
};

const getAnomalyExplanation = row => {
    const parts = [];
    const antibioticClass = row?.antibiotic_class || row?.antibioticClass;
    const quantity = row?.total_qty ?? row?.quantity_sold ?? row?.quantity;
    const drugRisk = row?.drug_rule_score ?? row?.drugRisk;
    const action = row?.action;

    if (antibioticClass) parts.push(`Class: ${cleanReportText(antibioticClass)}`);
    if (quantity !== undefined && quantity !== null && quantity !== '') parts.push(`Qty: ${formatReportNumber(quantity)}`);
    if (drugRisk !== undefined && drugRisk !== null && drugRisk !== '') parts.push(`Drug Risk: ${Number(drugRisk).toFixed(0)}`);
    if (action) parts.push(`Action: ${cleanReportText(action)}`);

    return truncateReportText(
        parts.length > 0
            ? parts.join(' | ')
            : row?.explanation || row?.reason || row?.officerNotes || 'Statistical anomaly detected from sales pattern.',
        95
    );
};

const normalizeAnomalyRows = rows => {
    const seen = new Set();
    return (rows || [])
        .filter(row => {
            const status = cleanReportText(row?.status, '').toUpperCase();
            const alertType = cleanReportText(row?.alertType || row?.alert_type || row?.type, '');
            return status !== 'SAFE' && alertType.toUpperCase() !== 'SAFE';
        })
        .filter((row, index) => {
            const rawSaleRecordId = row?.saleRecordId || row?.sale_record_id || row?.record_id || row?._id || row?.id;
            const alertType = cleanReportText(row?.alertType || row?.alert_type || row?.type, 'ANTIBIOTIC_ANOMALY');
            if (!rawSaleRecordId) {
                return true;
            }
            const saleRecordId = cleanReportText(rawSaleRecordId, `row-${index}`);
            const key = `${saleRecordId}|${alertType}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const getSalesRows = data => {
    return (data.sales?.allDrugs || data.sales?.topDrugs || [])
        .map(item => ({
            name: truncateReportText(item?._id || item?.drugName || item?.drug_name || item?.name, 76),
            quantity: Number(item?.totalQuantity ?? item?.quantity ?? item?.total_qty ?? 0),
        }))
        .sort((a, b) => b.quantity - a.quantity);
};

const getPharmacyRows = pharmacies => {
    const seen = new Set();
    return (pharmacies || [])
        .map(pharm => ({
            name: truncateReportText(pharm?.name || pharm?.pharmacyName || pharm?.pharmacy_name, 58),
            district: truncateReportText(pharm?.district || pharm?.location, 40),
        }))
        .filter(pharm => {
            const key = `${pharm.name}|${pharm.district}`.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const ensureReportSpace = (doc, height) => {
    if (doc.y + height <= REPORT_PAGE.bottom) return;
    doc.addPage();
    doc.y = REPORT_PAGE.top;
};

const drawReportSection = (doc, title) => {
    ensureReportSpace(doc, 32);
    doc.moveDown(0.45);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(title, REPORT_PAGE.left, doc.y);
    doc.moveDown(0.25);
    doc.strokeColor('#cbd5e1').lineWidth(0.7).moveTo(REPORT_PAGE.left, doc.y).lineTo(REPORT_PAGE.right, doc.y).stroke();
    doc.moveDown(0.45);
};

const drawReportTable = (doc, headers, widths, rows) => {
    const headerHeight = 22;
    const minRowHeight = 24;
    const verticalPadding = 14;
    ensureReportSpace(doc, headerHeight + minRowHeight);

    let y = doc.y;
    const drawHeader = () => {
        doc.rect(REPORT_PAGE.left, y, REPORT_PAGE.width, headerHeight).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(REPORT_PAGE.left, y, REPORT_PAGE.width, headerHeight).stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827');
        let x = REPORT_PAGE.left;
        headers.forEach((header, index) => {
            doc.text(header, x + 6, y + 7, { width: widths[index] - 12, align: index === 1 && headers.length === 2 ? 'right' : 'left' });
            x += widths[index];
        });
        y += headerHeight;
    };

    const getRowHeight = row => {
        doc.font('Helvetica').fontSize(8.2);
        const maxCellHeight = row.reduce((max, cell, index) => {
            const height = doc.heightOfString(cleanReportText(cell), {
                width: widths[index] - 12,
                lineGap: 1,
            });
            return Math.max(max, height);
        }, 0);
        return Math.max(minRowHeight, maxCellHeight + verticalPadding);
    };

    drawHeader();
    rows.forEach(row => {
        const rowHeight = getRowHeight(row);
        if (y + rowHeight > REPORT_PAGE.bottom) {
            doc.addPage();
            y = REPORT_PAGE.top;
            drawHeader();
        }

        doc.rect(REPORT_PAGE.left, y, REPORT_PAGE.width, rowHeight).fill('#ffffff');
        doc.strokeColor('#e2e8f0').lineWidth(0.45).rect(REPORT_PAGE.left, y, REPORT_PAGE.width, rowHeight).stroke();
        doc.font('Helvetica').fontSize(8.2).fillColor('#111827');
        let x = REPORT_PAGE.left;
        row.forEach((cell, index) => {
            doc.text(cleanReportText(cell), x + 6, y + 7, {
                width: widths[index] - 12,
                align: index === 1 && headers.length === 2 ? 'right' : 'left',
                lineGap: 1,
            });
            x += widths[index];
        });
        y += rowHeight;
    });
    doc.y = y + 8;
};

const addReportFooter = doc => {
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i += 1) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
            .text(`Page ${i + 1} of ${pageRange.count}`, REPORT_PAGE.left, 806, { width: REPORT_PAGE.width, align: 'right' });
    }
};

const generateOfficialPDFReport = async (data) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: REPORT_PAGE.top, bottom: 52, left: REPORT_PAGE.left, right: 48 },
            bufferPages: true,
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const generatedOn = new Date().toLocaleString('en-IN', { hour12: true });
        const pharmacyRows = getPharmacyRows(data.pharmacies);
        const salesRows = getSalesRows(data);
        const anomalyRows = normalizeAnomalyRows(data.anomalies?.recentAnomalies || data.anomalies?.rows || data.anomalies?.anomalies);
        const insights = (data.insights || []).map(item => truncateReportText(item, 110)).filter(Boolean);
        if (insights.length === 0 && salesRows.length > 0) {
            insights.push(`Highest sold antibiotic: ${salesRows[0].name} (${formatReportNumber(salesRows[0].quantity)} units).`);
        }
        if (insights.length === 0 && anomalyRows.length > 0) {
            insights.push(`${formatReportNumber(anomalyRows.length)} anomaly record(s) require review.`);
        }

        doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827')
            .text('Antibiotic Sales & Anomaly Detection Report', REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width });
        doc.moveDown(0.35);
        doc.font('Helvetica').fontSize(9).fillColor('#475569')
            .text(`Generated: ${generatedOn} | Role: ${cleanReportText(data.role)} | Scope: ${cleanReportText(data.scope)}`, REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width });
        doc.moveDown(0.7);

        drawReportSection(doc, '1. Pharmacy Details');
        if (pharmacyRows.length > 0) {
            drawReportTable(
                doc,
                ['Pharmacy Name', 'Location'],
                [300, 199],
                pharmacyRows.map(pharm => [pharm.name, pharm.district])
            );
        } else {
            doc.font('Helvetica').fontSize(9).fillColor('#475569').text('Pharmacy details not available.');
            doc.moveDown(0.4);
        }

        drawReportSection(doc, '2. Antibiotic Sales Summary');
        if (salesRows.length > 0) {
            drawReportTable(
                doc,
                ['Antibiotic Name', 'Total Quantity Sold'],
                [340, 159],
                salesRows.map(row => [row.name, formatReportNumber(row.quantity)])
            );
        } else {
            doc.font('Helvetica').fontSize(9).fillColor('#475569').text('No antibiotic sales data available for this period.');
            doc.moveDown(0.4);
        }

        drawReportSection(doc, '3. Detected Anomalies');
        if (anomalyRows.length > 0) {
            drawReportTable(
                doc,
                ['Detected Drug Name', 'Risk', 'Anomaly Score', 'Explanation'],
                [150, 65, 82, 202],
                anomalyRows.map(row => [
                    truncateReportText(row?.drugName || row?.drug_name || row?.drug || row?.nsqDrugName, 34),
                    getAnomalyRisk(row),
                    getAnomalyScore(row),
                    getAnomalyExplanation(row),
                ])
            );
        } else {
            doc.font('Helvetica').fontSize(9).fillColor('#475569').text('No anomalies detected in this period');
            doc.moveDown(0.4);
        }

        if (insights.length > 0) {
            drawReportSection(doc, '4. Key Insights');
            insights.forEach((insight, index) => {
                ensureReportSpace(doc, 18);
                doc.font('Helvetica').fontSize(9).fillColor('#111827')
                    .text(`${index + 1}. ${insight}`, REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width, lineGap: 1 });
                doc.moveDown(0.25);
            });
        }

        addReportFooter(doc);
        doc.end();
    });
};

const getMonthName = month => {
    const names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return names[Number(month)] || 'N/A';
};

const generateNSQDetectionPDFReport = async (data) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: REPORT_PAGE.top, bottom: 52, left: REPORT_PAGE.left, right: 48 },
            bufferPages: true,
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const generatedOn = new Date().toLocaleString('en-IN', { hour12: true });
        const pharmacy = data.pharmacy || {};
        const period = `${getMonthName(data.month)} ${data.year}`;
        const detectedRows = data.detectedRows || [];
        const safeRows = data.safeRows || [];
        const pendingRows = data.pendingRows || [];
        const alerts = data.alerts || [];

        doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827')
            .text('OFFICE REPORT', REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width, align: 'center' });
        doc.moveDown(0.25);
        doc.font('Helvetica-Bold').fontSize(13)
            .text('NSQ Detection Report', REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width, align: 'center' });
        doc.moveDown(0.25);
        doc.font('Helvetica').fontSize(8.5).fillColor('#475569')
            .text('Drug Control Department, Kerala', REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width, align: 'center' });
        doc.moveDown(0.8);

        doc.font('Helvetica').fontSize(9).fillColor('#111827')
            .text(`Reference No.: PSS/NSQ/${data.year}/${String(data.month).padStart(2, '0')}/${cleanReportText(pharmacy.licenseNumber, 'NA')}`, REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width / 2 });
        doc.text(`Generated: ${generatedOn}`, REPORT_PAGE.left, doc.y - 11, { width: REPORT_PAGE.width, align: 'right' });
        doc.moveDown(0.8);

        drawReportSection(doc, '1. Subject');
        doc.font('Helvetica').fontSize(9).fillColor('#111827')
            .text(`NSQ detection report for ${cleanReportText(pharmacy.name, 'selected pharmacy')} for the reporting month ${period}.`, REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width, lineGap: 1 });
        doc.moveDown(0.35);

        drawReportSection(doc, '2. Pharmacy Details');
        drawReportTable(
            doc,
            ['Field', 'Details'],
            [160, 339],
            [
                ['Pharmacy Name', pharmacy.name || 'N/A'],
                ['License Number', pharmacy.licenseNumber || 'N/A'],
                ['District', pharmacy.district || 'N/A'],
                ['Email', pharmacy.email || 'N/A'],
                ['Reporting Period', period],
                ['Generated By', data.generatedBy || 'System'],
            ]
        );

        drawReportSection(doc, '3. Detection Summary');
        drawReportTable(
            doc,
            ['Metric', 'Count'],
            [340, 159],
            [
                ['Total inventory rows reviewed', formatReportNumber(data.totalRows)],
                ['Confirmed NSQ rows', formatReportNumber(data.confirmedCount)],
                ['Probable NSQ matches', formatReportNumber(data.probableCount)],
                ['Mismatch rows requiring manual review', formatReportNumber(data.mismatchCount)],
                ['Safe rows', formatReportNumber(safeRows.length)],
                ['Pending rows', formatReportNumber(pendingRows.length)],
                ['Alerts generated', formatReportNumber(alerts.length)],
            ]
        );

        drawReportSection(doc, '4. NSQ Detection Details');
        if (detectedRows.length === 0) {
            doc.font('Helvetica').fontSize(9).fillColor('#475569')
                .text('No confirmed/probable NSQ detections were found for this reporting month.', REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width });
            doc.moveDown(0.4);
        } else {
            drawReportTable(
                doc,
                ['Drug', 'Batch No.', 'Status', 'Score', 'Matched NSQ / Manufacturer'],
                [126, 78, 86, 50, 159],
                detectedRows.map(row => [
                    truncateReportText(row.drugName, 38),
                    row.batchNumber || 'N/A',
                    row.nsqStatus || 'N/A',
                    row.similarityScore !== null && row.similarityScore !== undefined ? Number(row.similarityScore).toFixed(2) : 'N/A',
                    truncateReportText(`${row.nsqDrugName || 'N/A'} / ${row.nsqManufacturer || 'N/A'}`, 55),
                ])
            );
        }

        drawReportSection(doc, '5. Officer Action Status');
        if (alerts.length === 0) {
            doc.font('Helvetica').fontSize(9).fillColor('#475569')
                .text('No alert records were generated for this reporting month.', REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width });
            doc.moveDown(0.4);
        } else {
            drawReportTable(
                doc,
                ['Drug', 'Batch No.', 'Alert Type', 'Status', 'Officer Notes'],
                [120, 78, 88, 76, 137],
                alerts.map(alert => [
                    truncateReportText(alert.drugName, 34),
                    alert.batchNumber || 'N/A',
                    alert.alertType || 'N/A',
                    alert.status || 'N/A',
                    truncateReportText(alert.officerNotes || '-', 48),
                ])
            );
        }

        drawReportSection(doc, '6. Remarks');
        const remarks = detectedRows.length > 0
            ? 'Detected NSQ/probable rows should be verified against official records and handled as per departmental procedure. Open alerts require follow-up by the assigned officer.'
            : 'No NSQ detection requiring action was observed for this pharmacy in the selected reporting month.';
        doc.font('Helvetica').fontSize(9).fillColor('#111827')
            .text(remarks, REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width, lineGap: 1 });
        doc.moveDown(1.2);

        ensureReportSpace(doc, 78);
        doc.font('Helvetica').fontSize(9).fillColor('#111827')
            .text('Prepared by:', REPORT_PAGE.left, doc.y, { width: 180 })
            .text('Verified by:', REPORT_PAGE.left + 300, doc.y - 11, { width: 180 });
        doc.moveDown(2.4);
        doc.text('Drug Control Officer', REPORT_PAGE.left, doc.y, { width: 180 })
            .text('Authorised Signatory', REPORT_PAGE.left + 300, doc.y - 11, { width: 180 });
        doc.moveDown(0.5);
        doc.fontSize(7.5).fillColor('#64748b')
            .text('This report is generated from Pharma Surveillance System records and is intended for official departmental review.', REPORT_PAGE.left, doc.y, { width: REPORT_PAGE.width, align: 'center' });

        addReportFooter(doc);
        doc.end();
    });
};

const generateNSQReportForPeriod = async ({ req, res, pharmacyId, month, year }) => {
    try {
        const { id: userId, role, name } = resolveRequestUser(req) || {};

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const reportMonth = Number(month);
        const reportYear = Number(year);

        if (!pharmacyId) {
            return res.status(400).json({ message: 'Pharmacy ID is required' });
        }

        if (!Number.isInteger(reportMonth) || reportMonth < 1 || reportMonth > 12 || !Number.isInteger(reportYear)) {
            return res.status(400).json({ message: 'Valid month and year are required' });
        }

        const accessible = await getAccessiblePharmacies(userId, role);
        const accessibleIds = accessible.map(normalizeId);
        if (!accessibleIds.includes(normalizeId(pharmacyId))) {
            return res.status(403).json({ message: 'Access denied to this pharmacy' });
        }

        const pharmacyDetails = await getPharmacyDetails([pharmacyId]);
        const pharmacy = pharmacyDetails[0];
        if (!pharmacy) {
            return res.status(404).json({ message: 'Pharmacy not found' });
        }

        const pharmacyObjectId = toObjectId(pharmacyId);
        const rows = await pharmacySaleModel
            .find({ pharmacyId: pharmacyObjectId, saleMonth: reportMonth, saleYear: reportYear })
            .sort({ nsqStatus: 1, drugName: 1 })
            .lean();

        const detectedRows = rows.filter(row => ['NSQ_CONFIRMED', 'PROBABLE_MATCH', 'MISMATCH'].includes(row.nsqStatus));
        const safeRows = rows.filter(row => row.nsqStatus === 'SAFE');
        const pendingRows = rows.filter(row => row.nsqStatus === 'pending');
        const confirmedCount = rows.filter(row => row.nsqStatus === 'NSQ_CONFIRMED').length;
        const probableCount = rows.filter(row => row.nsqStatus === 'PROBABLE_MATCH').length;
        const mismatchCount = rows.filter(row => row.nsqStatus === 'MISMATCH').length;

        const saleRecordIds = rows.map(row => row._id);
        const alerts = await alertModel
            .find({
                pharmacyId: pharmacyObjectId,
                saleRecordId: { $in: saleRecordIds },
                alertType: { $in: ['NSQ_CONFIRMED', 'PROBABLE_MATCH'] },
            })
            .sort({ createdAt: -1 })
            .lean();

        const pdfBuffer = await generateNSQDetectionPDFReport({
            pharmacy,
            month: reportMonth,
            year: reportYear,
            totalRows: rows.length,
            detectedRows,
            safeRows,
            pendingRows,
            confirmedCount,
            probableCount,
            mismatchCount,
            alerts,
            generatedBy: name || req.user?.name || 'System',
        });

        const filename = `nsq_detection_${cleanReportText(pharmacy.name, 'pharmacy').replace(/[^a-z0-9]+/gi, '_')}_${reportYear}_${String(reportMonth).padStart(2, '0')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('NSQ report generation error:', error);
        res.status(500).json({ message: 'NSQ report generation failed', error: error.message });
    }
};

exports.generateNSQReport = async (req, res) => {
    return generateNSQReportForPeriod({
        req,
        res,
        pharmacyId: req.query.pharmacyId,
        month: req.query.month,
        year: req.query.year,
    });
};

exports.generateNSQSessionReport = async (req, res) => {
    try {
        const rows = await pharmacySaleModel
            .find({ uploadSessionId: req.params.sessionId })
            .select('pharmacyId saleMonth saleYear')
            .lean();

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No records found for this session' });
        }

        const sample = rows[0];
        return generateNSQReportForPeriod({
            req,
            res,
            pharmacyId: sample.pharmacyId,
            month: sample.saleMonth,
            year: sample.saleYear,
        });
    } catch (error) {
        console.error('NSQ session report generation error:', error);
        res.status(500).json({ message: 'NSQ session report generation failed', error: error.message });
    }
};

// Main controller function
exports.generateReport = async (req, res) => {
    try {
        const input = req.method === 'GET' ? req.query : req.body;
        const { scope, pharmacyId, startDate, endDate } = input;
        const { id: userId, role } = resolveRequestUser(req) || {};
        
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Validate scope
        if (!['pharmacy-specific', 'overall'].includes(scope)) {
            return res.status(400).json({ message: 'Invalid scope' });
        }

        // Determine pharmacies to include
        let pharmacyIds = [];
        let selectedPharmacyId = null;

        if (scope === 'pharmacy-specific') {
            if (!pharmacyId) {
                return res.status(400).json({ message: 'Pharmacy ID required for pharmacy-specific report' });
            }
            
            const accessible = await getAccessiblePharmacies(userId, role);
            const accessibleIds = accessible.map(normalizeId);
            if (!accessibleIds.includes(normalizeId(pharmacyId))) {
                return res.status(403).json({ message: 'Access denied to this pharmacy' });
            }
            
            pharmacyIds = [pharmacyId];
            selectedPharmacyId = pharmacyId;
        } else {
            // Overall report
            pharmacyIds = await getAccessiblePharmacies(userId, role);
        }

        if (pharmacyIds.length === 0) {
            return res.status(400).json({ message: 'No pharmacies found' });
        }

        // Date range defaults: last 30 days
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        // If the client POSTed analysis results, use them directly to build the PDF
        if (req.method === 'POST' && input.analysis) {
            const analysis = input.analysis || {};

            // Build the report sales summary from all rows currently visible in the UI.
            // Fall back to scored_rows when older clients do not send data.results.
            const scored = Array.isArray(analysis.scored_rows) ? analysis.scored_rows : [];
            const visibleRows = Array.isArray(input.data?.results) && input.data.results.length > 0
                ? input.data.results
                : scored;
            const salesMap = {};
            visibleRows.forEach(r => {
                const name = r.drug_name || r.drugName || 'Unknown';
                const qty = Number(r.total_qty ?? r.quantity_sold ?? r.quantity ?? 0);
                const price = Number(r.unit_price ?? r.unitPrice ?? 0) || 0;
                if (!salesMap[name]) salesMap[name] = { totalQuantity: 0, transactions: 0, prices: [] };
                salesMap[name].totalQuantity += qty;
                salesMap[name].transactions += 1;
                if (price > 0) salesMap[name].prices.push(price);
            });

            const topDrugs = Object.keys(salesMap).map(name => {
                const entry = salesMap[name];
                const avgUnitPrice = entry.prices.length > 0 ? entry.prices.reduce((a, b) => a + b, 0) / entry.prices.length : 0;
                return { _id: name, totalQuantity: entry.totalQuantity, transactions: entry.transactions, avgUnitPrice };
            }).sort((a, b) => b.totalQuantity - a.totalQuantity);

            const salesData = {
                summary: {
                    totalTransactions: visibleRows.length,
                    totalQuantity: topDrugs.reduce((s, d) => s + d.totalQuantity, 0),
                    uniqueDrugs: topDrugs.length
                },
                topDrugs,
                allDrugs: topDrugs
            };

            // Build anomaly summary from analysis.anomalies if present
            const anomaliesList = Array.isArray(analysis.anomalies) ? analysis.anomalies : [];
            const byDrug = {};
            anomaliesList.forEach(a => { const name = a.drug_name || a.drugName || a.drug || 'Unknown'; byDrug[name] = (byDrug[name] || 0) + 1 });
            const anomalyData = {
                totalAnomalies: anomaliesList.length,
                byStatus: { OPEN: anomaliesList.filter(a => a.status === 'OPEN').length, INVESTIGATING: anomaliesList.filter(a => a.status === 'INVESTIGATING').length, RESOLVED: anomaliesList.filter(a => a.status === 'RESOLVED').length },
                topAnomalies: Object.entries(byDrug).map(([drug, count]) => ({ drug, count })).sort((a, b) => b.count - a.count),
                recentAnomalies: anomaliesList
            };

            const pharmacyDetails = [];
            if (pharmacyId) {
                try {
                    const pd = await getPharmacyDetails([pharmacyId]);
                    pharmacyDetails.push(...pd);
                } catch (_) {}
            }

            const pdfBuffer = await generateOfficialPDFReport({
                role,
                scope: scope === 'pharmacy-specific' ? `Pharmacy-Specific (${pharmacyDetails[0]?.name || pharmacyId || 'N/A'})` : (scope || 'Overall'),
                pharmacies: pharmacyDetails,
                sales: salesData,
                anomalies: anomalyData,
                insights: analysis.insights || [],
                generatedBy: req.user?.name || 'System',
                dateRange: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="antibiotic_report_${Date.now()}.pdf"`);
            return res.send(pdfBuffer);
        }

        // Aggregate data
        const [pharmacyDetails, salesData, anomalyData, trendData] = await Promise.all([
            getPharmacyDetails(pharmacyIds),
            getSalesSummary(pharmacyIds, start, end),
            getAnomalySummary(pharmacyIds, start, end),
            getTrendData(pharmacyIds, start, end, 'daily')
        ]);

        // Generate insights
        const insights = [];
        if (salesData.topDrugs.length > 0) {
            insights.push(`Top selling antibiotic: ${salesData.topDrugs[0]._id} (${salesData.topDrugs[0].totalQuantity} units)`);
        }
        if (anomalyData.totalAnomalies > 0) {
            insights.push(`${anomalyData.totalAnomalies} anomalies detected during this period`);
        }
        if (anomalyData.topAnomalies.length > 0) {
            insights.push(`Most flagged drug: ${anomalyData.topAnomalies[0].drug} (${anomalyData.topAnomalies[0].count} flags)`);
        }
        if (salesData.summary.totalQuantity > 1000) {
            insights.push(`High sales volume: ${salesData.summary.totalQuantity} units in ${pharmacyIds.length} location(s)`);
        }

        // Generate PDF
        const pdfBuffer = await generateOfficialPDFReport({
            role,
            scope: scope === 'pharmacy-specific' ? `Pharmacy-Specific (${pharmacyDetails[0]?.name || 'N/A'})` : 'Overall',
            pharmacies: pharmacyDetails,
            sales: salesData,
            anomalies: anomalyData,
            insights,
            generatedBy: req.user?.name || 'System',
            dateRange: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
        });

        // Return PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="antibiotic_report_${Date.now()}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).json({ message: 'Report generation failed', error: error.message });
    }
};

// Get available pharmacies for report builder
exports.getPharmaciesForReport = async (req, res) => {
    try {
        const { id: userId, role } = resolveRequestUser(req) || {};

        const pharmacyIds = await getAccessiblePharmacies(userId, role);
        const pharmacies = await getPharmacyDetails(pharmacyIds);

        res.json({
            pharmacies: pharmacies.map(p => ({
                _id: p._id,
                name: p.name,
                district: p.district,
                email: p.email
            }))
        });

    } catch (error) {
        console.error('Error fetching pharmacies:', error);
        res.status(500).json({ message: 'Failed to fetch pharmacies', error: error.message });
    }
};
