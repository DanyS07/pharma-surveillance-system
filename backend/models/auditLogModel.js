const mongoose = require('mongoose');

// Append-only. Nothing is ever deleted from here.
// Every state-changing action in the system is recorded.
// targetId + targetType tell you WHICH record was acted on — required for compliance audits.

const auditLogSchema = new mongoose.Schema({
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    userRole:   { type: String, default: '' },
    action:     { type: String, required: true },  // e.g. 'PHARMACY_APPROVED', 'FILE_UPLOADED'
    targetId:   { type: String, default: '' },     // ID of the record that was acted on
    targetType: { type: String, default: '' },     // e.g. 'user', 'alert', 'uploadSession'
    details:    { type: String, default: '' },     // human-readable summary
    ipAddress:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('audit_logs', auditLogSchema);