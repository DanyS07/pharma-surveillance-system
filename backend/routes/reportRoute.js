const express = require('express');
const { generateReport, generateNSQReport, generateNSQSessionReport, getPharmaciesForReport } = require('../controllers/reportController');
const verifyToken = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

// Generate report (accessible to admin, officer, and pharmacy users for their own data)
router.get('/generate', verifyToken, authorize('admin', 'officer', 'pharmacy'), generateReport);
router.post('/generate', verifyToken, authorize('admin', 'officer', 'pharmacy'), generateReport);
router.get('/nsq', verifyToken, authorize('admin', 'officer', 'pharmacy'), generateNSQReport);
router.get('/nsq/session/:sessionId', verifyToken, authorize('admin', 'officer', 'pharmacy'), generateNSQSessionReport);

// Get available pharmacies for report builder
router.get('/pharmacies', verifyToken, authorize('admin', 'officer', 'pharmacy'), getPharmaciesForReport);

module.exports = router;
