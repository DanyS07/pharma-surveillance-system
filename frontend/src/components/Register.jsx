import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Box        from '@mui/material/Box';
import Paper      from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField  from '@mui/material/TextField';
import Button     from '@mui/material/Button';
import MenuItem   from '@mui/material/MenuItem';
import GovHeader  from './GovHeader';
import axiosInstance from '../axiosInstance';
import { useToast }  from '../utils/Toast';

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '12px', backgroundColor: '#f9fafb' } };

const DISTRICTS = ['Thiruvananthapuram','Kollam','Pathanamthitta','Alappuzha','Kottayam',
    'Idukki','Ernakulam','Thrissur','Palakkad','Malappuram','Kozhikode','Wayanad','Kannur','Kasaragod'];

const Register = () => {
    const showToast = useToast();
    const [step, setStep] = useState(1);
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState('');
    const [form, setForm] = useState({
        name:'', email:'', password:'', confirmPassword:'',
        pharmacyName:'', licenseNumber:'', pharmacistRegNumber:'',
        address:'', district:'', state:'Kerala',
    });
    const [errors, setErrors] = useState({});

    const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })); };

    const validateStep1 = () => {
        const e = {};
        if (!form.name.trim())           e.name = 'Full name is required';
        if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
        if (form.password.length < 8)    e.password = 'Minimum 8 characters';
        if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
        setErrors(e); return Object.keys(e).length === 0;
    };

    const validateStep2 = () => {
        const e = {};
        if (!form.pharmacyName.trim())        e.pharmacyName = 'Required';
        if (!form.licenseNumber.trim())       e.licenseNumber = 'Required';
        if (!form.pharmacistRegNumber.trim()) e.pharmacistRegNumber = 'Required';
        if (!form.address.trim())             e.address = 'Required';
        if (!form.district)                   e.district = 'Select a district';
        setErrors(e); return Object.keys(e).length === 0;
    };

    const submit = async () => {
        if (!validateStep2()) return;
        setLoading(true); setApiError('');
        try {
            await axiosInstance.post('/user/register', {
                name: form.name, email: form.email, password: form.password,
                licenseNumber: form.licenseNumber, pharmacistRegNumber: form.pharmacistRegNumber,
                address: form.address, district: form.district, state: form.state,
            });
            setDone(true);
        } catch (err) {
            setApiError(err.response?.data?.message || 'Registration failed. Try again.');
        }
        setLoading(false);
    };

    // Step indicator
    const StepIndicator = () => (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            {[1, 2].map((s, i) => (
                <React.Fragment key={s}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex',
                                   alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700,
                                   backgroundColor: step > s ? '#059669' : step === s ? '#111827' : '#f3f4f6',
                                   color: step >= s ? 'white' : '#9ca3af' }}>
                            {step > s ? '✓' : s}
                        </Box>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600,
                                          color: step === s ? '#111827' : '#9ca3af' }}>
                            {s === 1 ? 'Account Details' : 'Pharmacy Details'}
                        </Typography>
                    </Box>
                    {i === 0 && <Box sx={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb', mx: 1.5 }} />}
                </React.Fragment>
            ))}
        </Box>
    );

    if (done) return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            <GovHeader />
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
                <Paper elevation={0} sx={{ maxWidth: 480, width: '100%', border: '1px solid #e5e7eb',
                                           borderRadius: '16px', p: 5, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '3rem', mb: 2 }}>✅</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#111827', mb: 1.5 }}>Application Submitted</Typography>
                    <Typography sx={{ color: '#6b7280', lineHeight: 1.7, fontSize: '0.9rem', mb: 3 }}>
                        Your registration is under review by the Drug Control Department.
                        You will be notified once your account is approved. This typically takes 1–2 working days.
                    </Typography>
                    <Button component={Link} to="/" variant="outlined"
                        sx={{ borderRadius: '999px', borderColor: '#111827', color: '#111827', px: 4 }}>
                        Return to Home
                    </Button>
                </Paper>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            <GovHeader />
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 4 }}>
                <Paper elevation={0} sx={{ width: '100%', maxWidth: 560, border: '1px solid #e5e7eb',
                                           borderRadius: '16px', p: { xs: 3, sm: 5 } }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#111827', mb: 0.5 }}>
                        Register Your Pharmacy
                    </Typography>
                    <Typography sx={{ color: '#6b7280', mb: 4, fontSize: '0.88rem' }}>
                        Submit your application for Drug Control Department approval.
                    </Typography>

                    <StepIndicator />

                    {apiError && (
                        <Box sx={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px',
                                   px: 2, py: 1.2, mb: 2.5 }}>
                            <Typography sx={{ color: '#dc2626', fontSize: '0.85rem' }}>{apiError}</Typography>
                        </Box>
                    )}

                    {step === 1 && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                            <TextField label="Full Name (Authorised Pharmacist) *" value={form.name}
                                onChange={e => set('name', e.target.value)} fullWidth sx={fieldSx}
                                error={!!errors.name} helperText={errors.name} />
                            <TextField label="Email Address *" type="email" value={form.email}
                                onChange={e => set('email', e.target.value)} fullWidth sx={fieldSx}
                                error={!!errors.email} helperText={errors.email} />
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                <TextField label="Password *" type="password" value={form.password}
                                    onChange={e => set('password', e.target.value)} fullWidth sx={fieldSx}
                                    helperText={errors.password || 'Min 8 characters'} error={!!errors.password} />
                                <TextField label="Confirm Password *" type="password" value={form.confirmPassword}
                                    onChange={e => set('confirmPassword', e.target.value)} fullWidth sx={fieldSx}
                                    error={!!errors.confirmPassword} helperText={errors.confirmPassword} />
                            </Box>
                            <Button variant="contained" fullWidth size="large"
                                onClick={() => validateStep1() && setStep(2)}
                                sx={{ py: 1.4, borderRadius: '12px', backgroundColor: '#111827',
                                      '&:hover': { backgroundColor: '#1f2937' } }}>
                                Continue to Pharmacy Details →
                            </Button>
                        </Box>
                    )}

                    {step === 2 && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                            <TextField label="Pharmacy Name *" value={form.pharmacyName}
                                onChange={e => set('pharmacyName', e.target.value)} fullWidth sx={fieldSx}
                                error={!!errors.pharmacyName} helperText={errors.pharmacyName} />
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                <TextField label="License Number *" value={form.licenseNumber}
                                    onChange={e => set('licenseNumber', e.target.value)} fullWidth sx={fieldSx}
                                    error={!!errors.licenseNumber} helperText={errors.licenseNumber} />
                                <TextField label="Pharmacist Reg. No. *" value={form.pharmacistRegNumber}
                                    onChange={e => set('pharmacistRegNumber', e.target.value)} fullWidth sx={fieldSx}
                                    error={!!errors.pharmacistRegNumber} helperText={errors.pharmacistRegNumber} />
                            </Box>
                            <TextField label="Address *" value={form.address} multiline rows={3}
                                onChange={e => set('address', e.target.value)} fullWidth sx={fieldSx}
                                error={!!errors.address} helperText={errors.address} />
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                <TextField label="District *" select value={form.district}
                                    onChange={e => set('district', e.target.value)} fullWidth sx={fieldSx}
                                    error={!!errors.district} helperText={errors.district}>
                                    {DISTRICTS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                                </TextField>
                                <TextField label="State" value="Kerala" disabled fullWidth sx={fieldSx} />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                                <Button variant="outlined" onClick={() => setStep(1)} sx={{ flex: 1, py: 1.4, borderRadius: '12px', borderColor: '#e5e7eb', color: '#6b7280' }}>
                                    ← Back
                                </Button>
                                <Button variant="contained" onClick={submit} disabled={loading} sx={{ flex: 2, py: 1.4, borderRadius: '12px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                                    {loading ? 'Submitting…' : 'Submit Application'}
                                </Button>
                            </Box>
                        </Box>
                    )}

                    <Typography sx={{ mt: 3, textAlign: 'center', color: '#6b7280', fontSize: '0.88rem' }}>
                        Already registered?{' '}
                        <Link to="/login" style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
                    </Typography>
                </Paper>
            </Box>
        </Box>
    );
};

export default Register;
