const argon2        = require('argon2');
const userModel     = require('../models/userModel');
const { logAction } = require('../services/auditService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ARGON2_OPTIONS = {
    type:        argon2.argon2id,
    memoryCost:  65536,
    timeCost:    3,
    parallelism: 4,
};


// ── GET /user/pending ────────────────────────────────────────────
exports.getPendingPharmacies = async (req, res) => {
    try {
        const pending = await userModel
            .find({ role: 'pharmacy', status: 'pending' })
            .select('-password -resetPasswordToken -resetPasswordExpiry')
            .sort({ createdAt: 1 });
        res.status(200).json({ message: 'Pending pharmacies fetched', pharmacies: pending });
    } catch (err) {
        console.error('getPendingPharmacies error:', err);
        res.status(500).json({ message: 'Error fetching pending pharmacies' });
    }
};


// ── PUT /user/approve/:userId ────────────────────────────────────
exports.approvePharmacy = async (req, res) => {
    try {
        const user = await userModel.findOneAndUpdate(
            { _id: req.params.userId, role: 'pharmacy' },
            { status: 'active' },
            { new: true }
        );
        if (!user) return res.status(404).json({ message: 'Pharmacy not found' });

        await logAction(req, 'PHARMACY_APPROVED', user._id, 'user', `Approved: ${user.name}`);
        res.status(200).json({ message: 'Pharmacy approved successfully' });
    } catch (err) {
        console.error('approvePharmacy error:', err);
        res.status(500).json({ message: 'Error approving pharmacy' });
    }
};


// ── PUT /user/suspend/:userId ────────────────────────────────────
exports.suspendUser = async (req, res) => {
    try {
        const user = await userModel.findByIdAndUpdate(
            req.params.userId,
            { status: 'suspended' },
            { new: true }
        );
        if (!user) return res.status(404).json({ message: 'User not found' });

        await logAction(req, 'ACCOUNT_SUSPENDED', user._id, 'user', `Suspended: ${user.name}`);
        res.status(200).json({ message: 'Account suspended' });
    } catch (err) {
        console.error('suspendUser error:', err);
        res.status(500).json({ message: 'Error suspending account' });
    }
};


// ── POST /user/create-officer ────────────────────────────────────
exports.createOfficer = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name?.trim() || !email?.trim() || !password) {
            return res.status(400).json({ message: 'name, email and password are required' });
        }
        if (!EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Invalid email address' });
        if (password.length < 8)      return res.status(400).json({ message: 'Password must be at least 8 characters' });

        const existing = await userModel.findOne({ email: email.toLowerCase().trim() });
        if (existing) return res.status(409).json({ message: 'Email already registered' });

        const saved = await new userModel({
            name:     name.trim(),
            email:    email.toLowerCase().trim(),
            password: await argon2.hash(password, ARGON2_OPTIONS),
            role:     'officer',
            status:   'active',
        }).save();

        await logAction(req, 'OFFICER_CREATED', saved._id, 'user', `Created officer: ${name}`);
        res.status(201).json({ message: 'Officer account created', userId: saved._id });
    } catch (err) {
        console.error('createOfficer error:', err);
        res.status(500).json({ message: 'Error creating officer' });
    }
};


// ── PUT /user/assign-pharmacy ────────────────────────────────────
exports.assignPharmacy = async (req, res) => {
    try {
        const { officerId, pharmacyId } = req.body;
        if (!officerId || !pharmacyId) {
            return res.status(400).json({ message: 'officerId and pharmacyId are required' });
        }

        const officer  = await userModel.findOne({ _id: officerId,  role: 'officer'  });
        const pharmacy = await userModel.findOne({ _id: pharmacyId, role: 'pharmacy' });

        if (!officer)  return res.status(404).json({ message: 'Officer not found'  });
        if (!pharmacy) return res.status(404).json({ message: 'Pharmacy not found' });

        // $addToSet silently ignores duplicate assignments
        await userModel.findByIdAndUpdate(officerId, { $addToSet: { assignedPharmacies: pharmacyId } });

        await logAction(req, 'PHARMACY_ASSIGNED', officerId, 'user', `Pharmacy ${pharmacyId} → officer ${officerId}`);
        res.status(200).json({ message: 'Pharmacy assigned to officer' });
    } catch (err) {
        console.error('assignPharmacy error:', err);
        res.status(500).json({ message: 'Error assigning pharmacy' });
    }
};


// ── GET /user/officers ───────────────────────────────────────────
exports.getOfficers = async (req, res) => {
    try {
        const officers = await userModel
            .find({ role: 'officer' })
            .select('-password -resetPasswordToken -resetPasswordExpiry')
            .populate('assignedPharmacies', 'name district licenseNumber');
        res.status(200).json({ message: 'Officers fetched', officers });
    } catch (err) {
        console.error('getOfficers error:', err);
        res.status(500).json({ message: 'Error fetching officers' });
    }
};