const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const filter = require('../controllers/filterController');
const antibioticAnalysis = require('../controllers/antibioticAnalysisController');

router.post('/filter', verifyToken, authorize('officer', 'admin'), filter.filterCandidates);
router.get(
    '/antibiotic/reference',
    verifyToken,
    authorize('officer', 'admin', 'pharmacy'),
    filter.getAntibioticReferenceOptions
);
router.post(
    '/antibiotic/analyze',
    verifyToken,
    authorize('officer', 'admin'),
    antibioticAnalysis.analyzeAntibioticCandidates
);

module.exports = router;
