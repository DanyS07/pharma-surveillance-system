import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Box        from '@mui/material/Box';
import Paper      from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField  from '@mui/material/TextField';
import Button     from '@mui/material/Button';
import GovHeader  from './GovHeader';
import axiosInstance from '../axiosInstance';
import { useToast }  from '../utils/Toast';

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '12px', backgroundColor: '#f9fafb' } };

const DASH_ROUTES = {
    admin:    '/admin/dashboard',
    officer:  '/officer/dashboard',
    pharmacy: '/pharmacy/dashboard',
};

const Login = () => {
    const navigate  = useNavigate();
    const showToast = useToast();
    const [inputs, setInputs]   = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [showPw, setShowPw]   = useState(false);

    // If a session is still active (localStorage present), redirect immediately.
    // Prevents a logged-in user from seeing the login form if they navigate to /login.
    useEffect(() => {
        const stored = localStorage.getItem('pharma_user');
        if (!stored) return;

        let user;
        try {
            user = JSON.parse(stored);
        } catch (_) {
            localStorage.removeItem('pharma_user');
            return;
        }

        if (!DASH_ROUTES[user.role] || !user.id) {
            localStorage.removeItem('pharma_user');
            return;
        }

        let cancelled = false;
        axiosInstance.get(`/user/profile/${user.id}`)
            .then(() => {
                if (!cancelled) {
                    navigate(DASH_ROUTES[user.role], { replace: true });
                }
            })
            .catch(() => {
                if (!cancelled) {
                    localStorage.removeItem('pharma_user');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [navigate]);

    const handleChange = e => setInputs(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await axiosInstance.post('/user/login', inputs);
            localStorage.setItem('pharma_user', JSON.stringify({
                id:   res.data.userId,
                role: res.data.role,
                name: res.data.name,
                token: res.data.token,
            }));
            showToast(`Welcome back, ${res.data.name}!`);
            // replace: true removes /login from history so pressing Back
            // after a successful login does NOT return to the login form.
            navigate(DASH_ROUTES[res.data.role] || '/', { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        }
        setLoading(false);
    };

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            <GovHeader />
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 4 }}>
                <Paper elevation={0} sx={{ width: '100%', maxWidth: 420, border: '1px solid #e5e7eb',
                                           borderRadius: '16px', p: { xs: 3, sm: 5 } }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#111827', mb: 0.5, letterSpacing: '-0.02em' }}>
                        Sign in to your account
                    </Typography>
                    <Typography sx={{ color: '#6b7280', mb: 4, fontSize: '0.88rem' }}>
                        PharmaSurveillance Portal · Kerala Drug Control Department
                    </Typography>

                    {error && (
                        <Box sx={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5',
                                   borderRadius: '10px', px: 2, py: 1.2, mb: 2.5 }}>
                            <Typography sx={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</Typography>
                        </Box>
                    )}

                    <Box component="form" onSubmit={handleSubmit}
                        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                        <TextField label="Email address" name="email" type="email"
                            value={inputs.email} onChange={handleChange} required fullWidth sx={fieldSx} />
                        <TextField label="Password" name="password"
                            type={showPw ? 'text' : 'password'}
                            value={inputs.password} onChange={handleChange} required fullWidth sx={fieldSx}
                            InputProps={{ endAdornment: (
                                <Button size="small" onClick={() => setShowPw(p => !p)}
                                    sx={{ color: '#9ca3af', minWidth: 'auto', fontSize: '0.75rem' }}>
                                    {showPw ? 'Hide' : 'Show'}
                                </Button>
                            )}} />
                        <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}
                            sx={{ mt: 0.5, py: 1.4, borderRadius: '12px', backgroundColor: '#111827',
                                  fontSize: '1rem', '&:hover': { backgroundColor: '#1f2937' } }}>
                            {loading ? 'Signing in…' : 'Sign In'}
                        </Button>
                    </Box>

                    <Typography sx={{ mt: 3, textAlign: 'center', color: '#6b7280', fontSize: '0.88rem' }}>
                        Pharmacy not yet registered?{' '}
                        <Link to="/register" style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                            Apply here →
                        </Link>
                    </Typography>
                </Paper>
            </Box>
        </Box>
    );
};

export default Login;
