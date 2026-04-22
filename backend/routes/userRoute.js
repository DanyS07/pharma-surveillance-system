const express     = require('express');
const router      = express.Router();
const rateLimit   = require('express-rate-limit');
const verifyToken = require('../middleware/auth');
const authorize   = require('../middleware/authorize');
const auth        = require('../controllers/authController');
const admin       = require('../controllers/adminController');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      5,
    message:  { message: 'Too many login attempts. Try again in 15 minutes.' },
    validate: false,
});

// Auth
router.post('/register',         auth.register);
router.post('/login',            loginLimiter, auth.login);
router.post('/logout',           auth.logout);
router.get('/profile/:userId',   verifyToken, auth.getProfile);

// Admin
router.get('/pending',           verifyToken, authorize('admin'), admin.getPendingPharmacies);
router.put('/approve/:userId',   verifyToken, authorize('admin'), admin.approvePharmacy);
router.put('/suspend/:userId',   verifyToken, authorize('admin'), admin.suspendUser);
router.post('/create-officer',   verifyToken, authorize('admin'), admin.createOfficer);
router.put('/assign-pharmacy',   verifyToken, authorize('admin'), admin.assignPharmacy);
router.get('/officers',          verifyToken, authorize('admin'), admin.getOfficers);

module.exports = router;