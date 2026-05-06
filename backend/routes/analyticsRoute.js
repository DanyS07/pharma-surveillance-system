const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const analytics = require('../controllers/analyticsController');

// Trend data endpoints
router.get('/sales-trend', verifyToken, analytics.getSalesTrend);
router.get('/nsq-detected-trend', verifyToken, analytics.getNsqDetectedTrend);
router.get('/alerts-trend', verifyToken, analytics.getAlertsTrend);
router.get('/antibiotic-trend', verifyToken, analytics.getAntibioticTrend);
router.get('/risk-forecast', verifyToken, analytics.getRiskForecast);

module.exports = router;
