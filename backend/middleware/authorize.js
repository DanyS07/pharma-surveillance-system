// Used after verifyToken to restrict a route to specific roles.
// Usage: router.get('/route', verifyToken, authorize('admin'), handler)
// Multiple roles: authorize('admin', 'officer')

function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
}

module.exports = authorize;