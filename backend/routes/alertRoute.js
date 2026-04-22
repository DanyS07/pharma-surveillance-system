const express     = require('express');
const router      = express.Router();
const verifyToken = require('../middleware/auth');
const authorize   = require('../middleware/authorize');
const alert       = require('../controllers/alertController');

router.get('/my-alerts',           verifyToken, authorize('officer'), alert.getMyAlerts);
router.get('/all',                 verifyToken, authorize('admin'),   alert.getAllAlerts);
router.put('/status/:alertId',     verifyToken, authorize('officer'), alert.updateAlertStatus);

module.exports = router;