const pharmacySaleModel = require('../models/pharmacySaleModel');
const alertModel = require('../models/alertModel');
const userModel = require('../models/userModel');
const antibioticTrendMatchModel = require('../models/antibioticTrendMatchModel');
const { fetchRiskForecast } = require('../services/riskForecastService');
const {
    fetchAntibioticReferenceRecords,
    findAntibioticReferenceMatch,
} = require('../services/antibioticService');

const parseMonthYear = (query) => {
    const month = query.month && query.month !== 'all' ? Number(query.month) : null;
    const year = query.year ? Number(query.year) : null;
    return {
        month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
        year: Number.isInteger(year) ? year : null,
    };
};

const monthDateRange = (month, year) => {
    if (!month || !year) return null;
    return {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 1),
    };
};

const addSalePeriodFilter = (query, month, year) => {
    if (month && year) {
        query.saleMonth = month;
        query.saleYear = year;
    }
};

const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

/**
 * GET /analytics/sales-trend
 * Returns sales trend data based on month/year query params
 * Role-aware: officers see assigned pharmacies only, pharmacies see own data
 */
exports.getSalesTrend = async (req, res) => {
    try {
        const { pharmacyId } = req.query;
        const { month, year } = parseMonthYear(req.query);
        const role = req.user?.role || 'pharmacy';
        
        // Build query based on role
        let query = {};
        
        if (role === 'pharmacy') {
            query.pharmacyId = req.user.id;
        } else if (role === 'officer') {
            const officer = await userModel.findById(req.user.id).lean();
            if (officer?.assignedPharmacies) {
                query.pharmacyId = { $in: officer.assignedPharmacies };
            }
        } else if (role === 'admin' && pharmacyId) {
            query.pharmacyId = pharmacyId;
        }

        addSalePeriodFilter(query, month, year);

        // Fetch sales data
        const sales = await pharmacySaleModel.find(query).lean();

        // Aggregate by reporting month. A selected month returns one total bucket
        // across all pharmacies; All Months returns the full available trend.
        const hasAnyUnitPrice = sales.some(sale => Number(sale.unitPrice || 0) > 0);
        const trends = {};
        sales.forEach(sale => {
            const dateKey = monthKey(sale.saleYear, sale.saleMonth);

            if (!trends[dateKey]) {
                trends[dateKey] = { date: dateKey, quantity: 0, records: 0 };
                if (hasAnyUnitPrice) {
                    trends[dateKey].salesValue = 0;
                }
            }
            if (hasAnyUnitPrice) {
                trends[dateKey].salesValue += sale.quantity * (sale.unitPrice || 0);
            }
            trends[dateKey].quantity += sale.quantity;
            trends[dateKey].records++;
        });

        const data = Object.values(trends).sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({
            message: 'Sales trend fetched',
            granularity: 'monthly',
            data,
            summary: {
                totalRecords: sales.length,
                totalQuantity: sales.reduce((sum, s) => sum + (s.quantity || 0), 0),
                totalValue: sales.reduce((sum, s) => sum + (s.quantity * (s.unitPrice || 0)), 0),
                hasSalesValue: hasAnyUnitPrice,
            }
        });
    } catch (err) {
        console.error('getSalesTrend error:', err);
        res.status(500).json({ message: 'Error fetching sales trend' });
    }
};

/**
 * GET /analytics/nsq-detected-trend
 * Returns NSQ detections over all available reporting months.
 */
exports.getNsqDetectedTrend = async (req, res) => {
    try {
        const { pharmacyId } = req.query;
        const role = req.user?.role || 'pharmacy';

        let query = {
            nsqStatus: { $in: ['NSQ_CONFIRMED', 'PROBABLE_MATCH'] },
        };

        if (role === 'pharmacy') {
            query.pharmacyId = req.user.id;
        } else if (role === 'officer') {
            const officer = await userModel.findById(req.user.id).lean();
            if (officer?.assignedPharmacies) {
                query.pharmacyId = { $in: officer.assignedPharmacies };
            }
        } else if (role === 'admin' && pharmacyId) {
            query.pharmacyId = pharmacyId;
        }

        addSalePeriodFilter(query, null, null);

        const detections = await pharmacySaleModel.find(query).lean();

        const trends = {};
        detections.forEach(item => {
            const dateKey = monthKey(item.saleYear, item.saleMonth);

            if (!trends[dateKey]) {
                trends[dateKey] = {
                    date: dateKey,
                    confirmed: 0,
                    probable: 0,
                    quantity: 0,
                    total: 0,
                };
            }

            if (item.nsqStatus === 'NSQ_CONFIRMED') {
                trends[dateKey].confirmed++;
            } else if (item.nsqStatus === 'PROBABLE_MATCH') {
                trends[dateKey].probable++;
            }

            trends[dateKey].quantity += item.quantity || 0;
            trends[dateKey].total++;
        });

        const data = Object.values(trends).sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({
            message: 'NSQ detected trend fetched',
            granularity: 'monthly',
            data,
            summary: {
                totalDetected: detections.length,
                confirmed: detections.filter(d => d.nsqStatus === 'NSQ_CONFIRMED').length,
                probable: detections.filter(d => d.nsqStatus === 'PROBABLE_MATCH').length,
                totalQuantity: detections.reduce((sum, d) => sum + (d.quantity || 0), 0),
            }
        });
    } catch (err) {
        console.error('getNsqDetectedTrend error:', err);
        res.status(500).json({ message: 'Error fetching NSQ detected trend' });
    }
};

/**
 * GET /analytics/alerts-trend
 * Returns alert count trends over time
 */
exports.getAlertsTrend = async (req, res) => {
    try {
        const { month, year } = parseMonthYear(req.query);
        const role = req.user?.role || 'pharmacy';

        // Build query
        let query = {};
        if (role === 'officer') {
            query.officerId = req.user.id;
        } else if (role === 'pharmacy') {
            query.pharmacyId = req.user.id;
        }

        const range = monthDateRange(month, year);
        if (range) {
            query.createdAt = { $gte: range.start, $lt: range.end };
        }

        // Fetch alerts
        const alerts = await alertModel.find(query).lean();

        // Aggregate by date and status
        const trends = {};
        alerts.forEach(alert => {
            const date = new Date(alert.createdAt);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!trends[dateKey]) {
                trends[dateKey] = { date: dateKey, OPEN: 0, INVESTIGATING: 0, RESOLVED: 0, total: 0 };
            }
            trends[dateKey][alert.status || 'OPEN']++;
            trends[dateKey].total++;
        });

        const data = Object.values(trends).sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({
            message: 'Alerts trend fetched',
            granularity: 'monthly',
            data,
            summary: {
                totalAlerts: alerts.length,
                open: alerts.filter(a => a.status === 'OPEN').length,
                investigating: alerts.filter(a => a.status === 'INVESTIGATING').length,
                resolved: alerts.filter(a => a.status === 'RESOLVED').length,
            }
        });
    } catch (err) {
        console.error('getAlertsTrend error:', err);
        res.status(500).json({ message: 'Error fetching alerts trend' });
    }
};

/**
 * GET /analytics/antibiotic-trend
 * Returns antibiotic anomaly detections over time
 */
exports.getAntibioticTrend = async (req, res) => {
    try {
        const { pharmacyId } = req.query;
        const { month, year } = parseMonthYear(req.query);
        const role = req.user?.role || 'pharmacy';

        let query = {};
        let cachedQuery = {};
        let candidateQuery = {};
        
        if (role === 'pharmacy') {
            query.pharmacyId = req.user.id;
            cachedQuery.pharmacyId = req.user.id;
            candidateQuery.pharmacyId = req.user.id;
        } else if (role === 'officer') {
            const officer = await userModel.findById(req.user.id).lean();
            if (officer?.assignedPharmacies) {
                query.pharmacyId = { $in: officer.assignedPharmacies };
                cachedQuery.pharmacyId = { $in: officer.assignedPharmacies };
                candidateQuery.pharmacyId = { $in: officer.assignedPharmacies };
            }
        } else if (role === 'admin' && pharmacyId) {
            query.pharmacyId = pharmacyId;
            cachedQuery.pharmacyId = pharmacyId;
            candidateQuery.pharmacyId = pharmacyId;
        }

        // Filter: only antibiotics with matches
        query.antibioticMatch = { $exists: true, $ne: '' };

        addSalePeriodFilter(query, month, year);
        addSalePeriodFilter(cachedQuery, month, year);
        addSalePeriodFilter(candidateQuery, month, year);

        const [persistedMatches, cachedMatches, candidateRows] = await Promise.all([
            pharmacySaleModel.find(query).lean(),
            antibioticTrendMatchModel.find(cachedQuery).lean(),
            pharmacySaleModel.find(candidateQuery).lean(),
        ]);
        const antibioticRecords = await fetchAntibioticReferenceRecords();

        const rowsBySaleRecord = new Map();

        persistedMatches.forEach(row => {
            rowsBySaleRecord.set(String(row._id), row);
        });

        cachedMatches.forEach(row => {
            const key = String(row.saleRecordId || row._id);
            if (!rowsBySaleRecord.has(key)) {
                rowsBySaleRecord.set(key, row);
            }
        });

        candidateRows.forEach(row => {
            const referenceMatch = findAntibioticReferenceMatch(row.drugName, antibioticRecords);
            if (!referenceMatch && !String(row.antibioticMatch || '').trim()) return;

            const key = String(row._id);
            if (!rowsBySaleRecord.has(key)) {
                rowsBySaleRecord.set(key, {
                    ...row,
                    antibioticClass: row.antibioticClass || referenceMatch?.antibioticClass || 'unknown',
                    antibioticMatch: row.antibioticMatch || referenceMatch?.matchedName || row.drugName,
                });
            }
        });

        const antibiotics = Array.from(rowsBySaleRecord.values());

        // Aggregate by date and class
        const trends = {};
        antibiotics.forEach(item => {
            const dateKey = monthKey(item.saleYear, item.saleMonth);

            if (!trends[dateKey]) {
                trends[dateKey] = { 
                    date: dateKey, 
                    total: 0, 
                    highRisk: 0,
                    mediumRisk: 0,
                    quantity: 0 
                };
            }

            trends[dateKey].total++;
            trends[dateKey].quantity += item.quantity || 0;

            // Risk based on antibiotic class
            const classLower = (item.antibioticClass || '').toLowerCase();
            if (['carbapenem', 'glycopeptide', 'oxazolidinone'].includes(classLower)) {
                trends[dateKey].highRisk++;
            } else {
                trends[dateKey].mediumRisk++;
            }
        });

        const data = Object.values(trends).sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({
            message: 'Antibiotic trend fetched',
            granularity: 'monthly',
            data,
            summary: {
                totalDetected: antibiotics.length,
                highRisk: antibiotics.filter(a => {
                    const cls = (a.antibioticClass || '').toLowerCase();
                    return ['carbapenem', 'glycopeptide', 'oxazolidinone'].includes(cls);
                }).length,
                totalQuantity: antibiotics.reduce((sum, a) => sum + (a.quantity || 0), 0),
            }
        });
    } catch (err) {
        console.error('getAntibioticTrend error:', err);
        res.status(500).json({ message: 'Error fetching antibiotic trend' });
    }
};

/**
 * GET /analytics/risk-forecast
 * Returns forecasted pharmacy-drug risk levels for the current user scope.
 */
exports.getRiskForecast = async (req, res) => {
    try {
        const { pharmacyId } = req.query;
        const selectedDrugName = String(req.query.drugName || '').trim().toLowerCase();
        const role = req.user?.role || 'pharmacy';
        const similarityThreshold = Number(req.query.similarityThreshold || 80);
        const monthRaw = req.query.month;
        const yearRaw = req.query.year;
        const month = monthRaw && monthRaw !== 'all' ? Number(monthRaw) : null;
        const year = yearRaw && yearRaw !== 'all' ? Number(yearRaw) : null;
        let pharmacyIds = [];

        if (role === 'pharmacy') {
            pharmacyIds = [req.user.id];
        } else if (role === 'officer') {
            const officer = await userModel.findById(req.user.id).lean();
            const assignedPharmacyIds = (officer?.assignedPharmacies || []).map(id => String(id));

            if (pharmacyId) {
                if (!assignedPharmacyIds.includes(String(pharmacyId))) {
                    return res.status(403).json({ message: 'You can only forecast pharmacies assigned to you.' });
                }
                pharmacyIds = [String(pharmacyId)];
            } else {
                pharmacyIds = assignedPharmacyIds;
            }

            if (pharmacyIds.length === 0) {
                return res.status(200).json({
                    message: 'Risk forecast fetched',
                    success: true,
                    generatedAt: new Date().toISOString(),
                    summary: {
                        totalGroups: 0,
                        highRisk: 0,
                        mediumRisk: 0,
                        criticalRisk: 0,
                        lowRisk: 0,
                        monitored: 0,
                    },
                    pharmacyResults: [],
                    areaResults: [],
                });
            }
        } else if (role === 'admin') {
            if (pharmacyId) {
                pharmacyIds = [pharmacyId];
            } else {
                pharmacyIds = [];
            }
        }

        let scopeQuery = {};
        if (role === 'pharmacy') {
            scopeQuery.pharmacyId = req.user.id;
        } else if (role === 'officer') {
            scopeQuery.pharmacyId = { $in: pharmacyIds };
        } else if (role === 'admin' && pharmacyId) {
            scopeQuery.pharmacyId = pharmacyId;
        }

        if (Number.isInteger(month) && month >= 1 && month <= 12) {
            scopeQuery.saleMonth = month;
        }

        if (Number.isInteger(year)) {
            scopeQuery.saleYear = year;
        }

        const rows = await pharmacySaleModel.find(scopeQuery).lean();
        const antibioticRecords = await fetchAntibioticReferenceRecords();

        let matchedRows = rows.map((row) => {
            const referenceMatch = findAntibioticReferenceMatch(row.drugName, antibioticRecords);
            const resolvedMatch = String(row.antibioticMatch || referenceMatch?.matchedName || '').trim();
            const resolvedClass = String(row.antibioticClass || referenceMatch?.antibioticClass || '').trim();
            const resolvedScore = Number(row.antibioticScore ?? referenceMatch?.score);

            const hasMatchedAntibiotic = Boolean(resolvedMatch);
            const hasValidClass = Boolean(resolvedClass) && resolvedClass.toLowerCase() !== 'unknown';
            const passesScore = Number.isFinite(resolvedScore) && resolvedScore >= similarityThreshold;

            if (!hasMatchedAntibiotic || !hasValidClass || !passesScore) {
                return null;
            }

            return {
                ...row,
                antibioticMatch: resolvedMatch,
                antibioticClass: resolvedClass,
                antibioticScore: resolvedScore,
            };
        }).filter(Boolean);

        if (selectedDrugName) {
            matchedRows = matchedRows.filter(row => {
                const saleDrug = String(row.drugName || row.drug_name || '').trim().toLowerCase();
                const matchedDrug = String(row.antibioticMatch || '').trim().toLowerCase();

                return saleDrug === selectedDrugName ||
                    matchedDrug === selectedDrugName ||
                    saleDrug.includes(selectedDrugName) ||
                    matchedDrug.includes(selectedDrugName);
            });
        }

        const toAntibioticSale = (row) => ({
            drug_name: row.drugName || row.drug_name || '',
            quantity_sold: row.quantity || row.quantity_sold || 0,
            month: row.saleMonth || row.month || null,
            year: row.saleYear || row.year || null,
            pharmacy_id: String(row.pharmacyId || row.pharmacy_id || ''),
            batch_number: row.batchNumber || row.batch_number || '',
            unit_price: row.unitPrice || row.unit_price || 0,
        });

        const fetchedAntibiotics = matchedRows.map((row) => ({
            pharmacyId: String(row.pharmacyId || row.pharmacy_id || ''),
            drugName: row.drugName || row.drug_name || '',
            antibioticMatch: row.antibioticMatch || '',
            antibioticClass: row.antibioticClass || '',
            antibioticScore: Number(row.antibioticScore || 0),
            quantity: Number(row.quantity || row.quantity_sold || 0),
            batchNumber: row.batchNumber || row.batch_number || '',
            month: row.saleMonth || row.month || null,
            year: row.saleYear || row.year || null,
        }));

        const forecast = await fetchRiskForecast({
            pharmacyIds,
            top: 20,
            sales: matchedRows.map(toAntibioticSale),
        });

        res.status(200).json({
            message: 'Risk forecast fetched',
            inputRows: rows.length,
            matchedAntibioticRows: matchedRows.length,
            fetchedAntibiotics,
            filters: {
                pharmacyId: pharmacyId || null,
                drugName: selectedDrugName || null,
                month: Number.isInteger(month) ? month : null,
                year: Number.isInteger(year) ? year : null,
                similarityThreshold,
            },
            ...forecast,
        });
    } catch (err) {
        console.error('getRiskForecast error:', err);
        res.status(500).json({ message: 'Error fetching risk forecast' });
    }
};
