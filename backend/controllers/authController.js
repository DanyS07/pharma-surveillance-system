const argon2        = require('argon2');
const jwt           = require('jsonwebtoken');
const userModel     = require('../models/userModel');
const { logAction } = require('../services/auditService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ARGON2_OPTIONS = {
    type:        argon2.argon2id,
    memoryCost:  65536,
    timeCost:    3,
    parallelism: 4,
};

// A real argon2id hash of a dummy string.
// Used in login so argon2.verify always runs whether the email exists or not.
// Without this, an attacker can tell if an email is registered by measuring
// response time — valid email takes ~300ms (hash verify), invalid takes ~0ms.
// With this, both paths take ~300ms. Timing attack prevented.
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG';

function attachTokenCookie(res, token) {
    res.cookie('token', token, {
        httpOnly: true,
        secure:   process.env.COOKIE_SECURE === 'true',
        sameSite: 'strict',
        maxAge:   7 * 24 * 60 * 60 * 1000,  // 7 days
    });
}


// ── POST /user/register ──────────────────────────────────────────
exports.register = async (req, res) => {
    try {
        const {
            name, email, password,
            licenseNumber, pharmacistRegNumber,
            address, district, state,
        } = req.body;

        if (!name?.trim())                return res.status(400).json({ message: 'Name is required' });
        if (!email?.trim())               return res.status(400).json({ message: 'Email is required' });
        if (!EMAIL_REGEX.test(email))     return res.status(400).json({ message: 'Invalid email address' });
        if (!password || password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
        if (!licenseNumber?.trim())       return res.status(400).json({ message: 'Pharmacy license number is required' });
        if (!pharmacistRegNumber?.trim()) return res.status(400).json({ message: 'Pharmacist registration number is required' });

        const existing = await userModel.findOne({ email: email.toLowerCase().trim() });
        if (existing) return res.status(409).json({ message: 'Email already registered' });

        const saved = await new userModel({
            name:                name.trim(),
            email:               email.toLowerCase().trim(),
            password:            await argon2.hash(password, ARGON2_OPTIONS),
            role:                'pharmacy',
            status:              'pending',
            licenseNumber:       licenseNumber?.trim()       || '',
            pharmacistRegNumber: pharmacistRegNumber?.trim() || '',
            address:             address?.trim()             || '',
            district:            district?.trim()            || '',
            state:               state?.trim()               || '',
        }).save();

        res.status(201).json({ message: 'Registration submitted. Await admin approval.', userId: saved._id });
    } catch (err) {
        console.error('register error:', err);
        res.status(500).json({ message: 'Registration error' });
    }
};


// ── POST /user/login ─────────────────────────────────────────────
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

        const user = await userModel.findOne({ email: email.toLowerCase().trim() });

        // Always run argon2.verify — uses dummy hash if user not found
        // Ensures response time is identical whether email exists or not
        const hashToVerify  = user ? user.password : DUMMY_HASH;
        let   passwordValid = false;
        try { passwordValid = await argon2.verify(hashToVerify, password); }
        catch (_) { passwordValid = false; }

        if (!user || !passwordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (user.status === 'pending')   return res.status(403).json({ message: 'Your account is pending approval' });
        if (user.status === 'suspended') return res.status(403).json({ message: 'Your account has been suspended' });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        attachTokenCookie(res, token);
        await logAction(req, 'USER_LOGIN', user._id, 'user', `${user.name} logged in`);

        res.status(200).json({ message: 'Login successful', userId: user._id, role: user.role, name: user.name });
    } catch (err) {
        console.error('login error:', err);
        res.status(500).json({ message: 'Login error' });
    }
};


// ── POST /user/logout ────────────────────────────────────────────
exports.logout = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure:   process.env.COOKIE_SECURE === 'true',
        sameSite: 'strict',
    });
    res.status(200).json({ message: 'Logged out successfully' });
};


// ── GET /user/profile/:userId ────────────────────────────────────
// Users can only view their own profile. Admin can view any.
// Reset token fields are stripped from the response always.
exports.getProfile = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.params.userId !== req.user.id) {
            return res.status(403).json({ message: 'You can only view your own profile' });
        }
        const user = await userModel.findById(req.params.userId)
            .select('-password -resetPasswordToken -resetPasswordExpiry');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ user });
    } catch (err) {
        console.error('getProfile error:', err);
        res.status(500).json({ message: 'Error fetching profile' });
    }
};

// ── FUTURE: Change password / forgot password ────────────────────
// userModel already has resetPasswordToken and resetPasswordExpiry fields.
// When you are ready to build this, the three routes needed are:
//   POST /user/forgot-password  → generate token, hash it, store in DB, email plain token to user
//   POST /user/reset-password   → verify submitted token against stored hash, check expiry, update password
//   PUT  /user/change-password  → for logged-in users who know their current password
// You will need to install: nodemailer (or a provider like Resend / SendGrid)