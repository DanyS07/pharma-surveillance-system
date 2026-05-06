const jwt = require('jsonwebtoken');

// This is the same verifyToken concept from Mentii — but with one key difference.
// Mentii read the token from req.headers.token (localStorage on the frontend).
// This project uses HttpOnly cookies instead, so the token is in req.cookies.token.
// The frontend never touches the token — the browser sends the cookie automatically.

function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const token = req.cookies.token || bearerToken;
        if (!token) throw 'No token provided';

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        console.log('verifyToken', { method: req.method, path: req.path, hasCookie: !!req.cookies.token, hasBearer: !!bearerToken, payload });
        req.user = payload; // { id, role }
        next();
    } catch (error) {
        res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }
}

module.exports = verifyToken;
