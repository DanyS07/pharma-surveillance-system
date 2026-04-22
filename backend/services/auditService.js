const auditLogModel = require('../models/auditLogModel');

// Instead of writing new auditLogModel().save() in every single route,
// every route calls this one function.
// This means if you ever change the audit log structure, you change it in one place.
//
// Usage in any route:
//   await logAction(req, 'PHARMACY_APPROVED', userId, 'user', 'Admin approved pharmacy X');

async function logAction(req, action, targetId = '', targetType = '', details = '') {
    try {
        await new auditLogModel({
            userId:     req.user?.id   || null,
            userRole:   req.user?.role || '',
            action,
            targetId:   String(targetId),
            targetType,
            details,
            ipAddress:  req.ip || '',
        }).save();
    } catch (err) {
        // Audit log failure should never crash the main request
        // Log the error but let the route continue
        console.log('Audit log failed:', err.message);
    }
}

module.exports = { logAction };