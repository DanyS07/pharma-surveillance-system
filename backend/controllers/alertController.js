const alertModel    = require('../models/alertModel');
const { logAction } = require('../services/auditService');

const VALID_STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED'];


// ── GET /alert/my-alerts ─────────────────────────────────────────
exports.getMyAlerts = async (req, res) => {
    try {
        const alerts = await alertModel
            .find({ officerId: req.user.id })
            .populate('pharmacyId',   'name district licenseNumber')
            .populate('saleRecordId', 'drugName batchNumber quantity uploadSessionId')
            .sort({ createdAt: -1 });
        res.status(200).json({ message: 'Alerts fetched', alerts });
    } catch (err) {
        console.error('getMyAlerts error:', err);
        res.status(500).json({ message: 'Error fetching alerts' });
    }
};


// ── GET /alert/all ───────────────────────────────────────────────
exports.getAllAlerts = async (req, res) => {
    try {
        const alerts = await alertModel
            .find()
            .populate('pharmacyId', 'name district licenseNumber')
            .populate('officerId',  'name email')
            .sort({ createdAt: -1 });
        res.status(200).json({ message: 'All alerts fetched', alerts });
    } catch (err) {
        console.error('getAllAlerts error:', err);
        res.status(500).json({ message: 'Error fetching all alerts' });
    }
};


// ── PUT /alert/status/:alertId ───────────────────────────────────
exports.updateAlertStatus = async (req, res) => {
    try {
        const { status, officerNotes } = req.body;

        if (!status) return res.status(400).json({ message: 'status is required' });
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ message: 'status must be: OPEN, INVESTIGATING, or RESOLVED' });
        }

        const alert = await alertModel.findById(req.params.alertId);
        if (!alert) return res.status(404).json({ message: 'Alert not found' });

        // Officers can only update alerts assigned to them
        if (alert.officerId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'This alert is not assigned to you' });
        }

        const updated = await alertModel.findByIdAndUpdate(
            req.params.alertId,
            { status, officerNotes: officerNotes || '' },
            { new: true }
        );

        await logAction(req, 'ALERT_STATUS_UPDATED', alert._id, 'alert', `→ ${status}. Notes: ${officerNotes || 'none'}`);
        res.status(200).json({ message: 'Alert updated', alert: updated });
    } catch (err) {
        console.error('updateAlertStatus error:', err);
        res.status(500).json({ message: 'Error updating alert' });
    }
};