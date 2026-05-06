const express           = require('express');
const router            = express.Router();
const userModel         = require('../models/userModel');
const pharmacySaleModel = require('../models/pharmacySaleModel');
const alertModel        = require('../models/alertModel');
const verifyToken       = require('../middleware/auth');
const authorize         = require('../middleware/authorize');

// These queries are simple enough to stay inline — no controller needed

// GET /pharmacy/all — admin: all pharmacies
router.get('/all', verifyToken, authorize('admin'), async (req, res) => {
    try {
        const pharmacies = await userModel
            .find({ role: 'pharmacy' })
            .select('-password -resetPasswordToken -resetPasswordExpiry')
            .sort({ createdAt: -1 });
        res.status(200).json({ message: 'Pharmacies fetched', pharmacies });
    } catch (err) {
        console.error('pharmacyRoute /all error:', err);
        res.status(500).json({ message: 'Error fetching pharmacies' });
    }
});

// GET /pharmacy/my-pharmacies — officer: only assigned pharmacies
router.get('/my-pharmacies', verifyToken, authorize('officer'), async (req, res) => {
    try {
        const officer = await userModel.findById(req.user.id)
            .populate('assignedPharmacies', '-password -resetPasswordToken -resetPasswordExpiry');
        if (!officer) return res.status(404).json({ message: 'Officer not found' });
        res.status(200).json({ message: 'Assigned pharmacies fetched', pharmacies: officer.assignedPharmacies });
    } catch (err) {
        console.error('pharmacyRoute /my-pharmacies error:', err);
        res.status(500).json({ message: 'Error fetching pharmacies' });
    }
});

// GET /pharmacy/:pharmacyId/inventory — admin or officer
router.get('/:pharmacyId/inventory', verifyToken, authorize('admin', 'officer'), async (req, res) => {
    try {
        if (req.query.summary === 'true') {
            const pharmacyId = userModel.db.base.Types.ObjectId.isValid(req.params.pharmacyId)
                ? new userModel.db.base.Types.ObjectId(req.params.pharmacyId)
                : req.params.pharmacyId;

            const sessions = await pharmacySaleModel.aggregate([
                { $match: { pharmacyId } },
                {
                    $group: {
                        _id: '$uploadSessionId',
                        sessionId: { $first: '$uploadSessionId' },
                        date: { $max: '$createdAt' },
                        rows: { $sum: 1 },
                        nsqCount: {
                            $sum: {
                                $cond: [{ $eq: ['$nsqStatus', 'NSQ_CONFIRMED'] }, 1, 0],
                            },
                        },
                        saleMonth: { $first: '$saleMonth' },
                        saleYear: { $first: '$saleYear' },
                    },
                },
                { $sort: { saleYear: -1, saleMonth: -1, date: -1 } },
            ]);

            return res.status(200).json({ message: 'Inventory sessions fetched', sessions });
        }

        const records = await pharmacySaleModel
            .find({ pharmacyId: req.params.pharmacyId })
            .sort({ createdAt: -1 })
            .limit(500);
        res.status(200).json({ message: 'Inventory fetched', records });
    } catch (err) {
        console.error('pharmacyRoute /inventory error:', err);
        res.status(500).json({ message: 'Error fetching inventory' });
    }
});

// GET /pharmacy/:pharmacyId/alerts — admin or officer
router.get('/:pharmacyId/alerts', verifyToken, authorize('admin', 'officer'), async (req, res) => {
    try {
        const alerts = await alertModel
            .find({ pharmacyId: req.params.pharmacyId })
            .populate('officerId',   'name email')
            .populate('saleRecordId', 'drugName batchNumber quantity')
            .sort({ createdAt: -1 });
        res.status(200).json({ message: 'Pharmacy alerts fetched', alerts });
    } catch (err) {
        console.error('pharmacyRoute /alerts error:', err);
        res.status(500).json({ message: 'Error fetching alerts' });
    }
});

module.exports = router;
