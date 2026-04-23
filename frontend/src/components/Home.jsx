import React, { useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import Box        from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button     from '@mui/material/Button';
import Card       from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import AppBar     from '@mui/material/AppBar';
import Toolbar    from '@mui/material/Toolbar';
import Grid       from '@mui/material/Grid';
import GovHeader  from './GovHeader';

const FEATURES = [
    { icon: '🛡', title: 'NSQ Detection',       body: 'Upload your monthly inventory. Our system cross-references every batch number against the CDSCO NSQ master list automatically.' },
    { icon: '🔔', title: 'Instant Alerts',      body: 'Confirmed NSQ matches generate immediate alerts to your assigned Drug Control Officer. No manual reporting needed.' },
    { icon: '📊', title: 'Compliance Tracking', body: 'Every upload, approval, and enforcement action is permanently logged for regulatory audit.' },
];

const DASH_ROUTES = {
    admin:    '/admin/dashboard',
    officer:  '/officer/dashboard',
    pharmacy: '/pharmacy/dashboard',
};

const Home = () => {
    const navigate = useNavigate();
    const stored   = localStorage.getItem('pharma_user');
    const user     = stored ? JSON.parse(stored) : null;

    // Authenticated users are immediately redirected to their dashboard.
    // replace: true removes '/' from history so the browser Back button
    // cannot return them to the public landing page.
    // This is the standard SPA pattern — the public page is never rendered
    // for a logged-in user even for a single frame visible to the eye.
    useEffect(() => {
        if (user?.role && DASH_ROUTES[user.role]) {
            navigate(DASH_ROUTES[user.role], { replace: true });
        }
    }, [user, navigate]);

    // Render nothing while the redirect fires (prevents flash of public content)
    if (user) return null;

    return (
        <Box sx={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
            <GovHeader />

            <AppBar position="sticky" elevation={0}
                sx={{ backgroundColor: '#ffffff', borderBottom: '1px solid #f3f4f6', color: '#111827', zIndex: 1100 }}>
                <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 6 }, minHeight: '56px !important' }}>
                    <Typography component={Link} to="/"
                        sx={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em',
                              color: '#111827', textDecoration: 'none', '&:hover': { color: '#1e3a5f' } }}>
                        PharmaSurveillance Portal
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <Button component={Link} to="/register" variant="outlined"
                            sx={{ borderRadius: '999px', borderColor: '#111827', color: '#111827',
                                  fontSize: '0.85rem', px: 2.5, '&:hover': { borderColor: '#1e3a5f', color: '#1e3a5f' } }}>
                            Register your Pharmacy
                        </Button>
                        <Button component={Link} to="/login" variant="text"
                            sx={{ color: '#6b7280', fontWeight: 500, fontSize: '0.85rem' }}>
                            Sign In
                        </Button>
                    </Box>
                </Toolbar>
            </AppBar>

            <Box sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 6, md: 8 }, px: 3, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                                  letterSpacing: '0.12em', color: '#9ca3af', mb: 2 }}>
                    Drug Control Department · Government of Kerala
                </Typography>
                <Typography variant="h2" sx={{ fontWeight: 800, fontSize: { xs: '2.2rem', md: '3.4rem' },
                                               color: '#111827', lineHeight: 1.12, letterSpacing: '-0.03em', mb: 2.5 }}>
                    Drug Surveillance.<br />
                    
                </Typography>
                <Typography sx={{ color: '#6b7280', fontSize: '1.05rem', fontWeight: 300,
                                  lineHeight: 1.7, maxWidth: 480, mx: 'auto', mb: 4 }}>
                    A secure platform for retail pharmacy inventory monitoring and NSQ drug detection across Kerala.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button variant="contained" onClick={() => navigate('/register')}
                        sx={{ borderRadius: '999px', px: 4, py: 1.3, backgroundColor: '#1e3a5f',
                              fontSize: '0.95rem', '&:hover': { backgroundColor: '#162d4a' } }}>
                        Register Your Pharmacy →
                    </Button>
                    <Button variant="outlined" onClick={() => navigate('/login')}
                        sx={{ borderRadius: '999px', px: 4, py: 1.3,
                              borderColor: '#111827', color: '#111827', fontSize: '0.95rem' }}>
                        Sign In
                    </Button>
                </Box>
            </Box>

            <Box sx={{ borderTop: '1px solid #f3f4f6' }} />

            <Box sx={{ maxWidth: 1080, mx: 'auto', px: 3, py: { xs: 6, md: 10 } }}>
                <Grid container spacing={3} sx={{ mb: 8 }}>
                    {FEATURES.map(f => (
                        <Grid item xs={12} md={4} key={f.title}>
                            <Card sx={{ height: '100%', border: '1px solid #f3f4f6', transition: 'border-color 0.15s',
                                        '&:hover': { borderColor: '#d1d5db', boxShadow: '0px 4px 16px rgba(0,0,0,0.06)' } }}>
                                <CardContent sx={{ p: 3.5 }}>
                                    <Typography sx={{ fontSize: '1.8rem', mb: 2 }}>{f.icon}</Typography>
                                    <Typography sx={{ fontWeight: 700, mb: 1, color: '#111827', fontSize: '0.95rem' }}>{f.title}</Typography>
                                    <Typography sx={{ color: '#6b7280', lineHeight: 1.7, fontSize: '0.88rem', fontWeight: 300 }}>{f.body}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                <Grid container spacing={4}>
                    {[
                        { title: 'For Pharmacies', items: [
                            'Register and upload monthly drug sales data for NSQ screening',
                            'Get instant feedback when a drug batch matches the CDSCO NSQ list',
                            'Maintain a transparent compliance record with the Department',
                        ]},
                        { title: 'For Officers', items: [
                            'Receive real-time alerts when NSQ drugs are detected in assigned pharmacies',
                            'Monitor all assigned pharmacies from a single enforcement dashboard',
                            'Track investigation status and maintain permanent enforcement records',
                        ]},
                    ].map(col => (
                        <Grid item xs={12} md={6} key={col.title}>
                            <Typography sx={{ fontWeight: 700, mb: 2, color: '#111827', fontSize: '1rem' }}>{col.title}</Typography>
                            <Box component="ul" sx={{ pl: 0, m: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {col.items.map(item => (
                                    <Box component="li" key={item} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                        <Typography sx={{ color: '#9ca3af', flexShrink: 0 }}>→</Typography>
                                        <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', lineHeight: 1.6 }}>{item}</Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Box>

            <Box sx={{ borderTop: '1px solid #f3f4f6', backgroundColor: '#f9fafb', py: 4, px: 3, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 0.5 }}>PharmaSurveillance Portal</Typography>
                <Typography sx={{ color: '#6b7280', fontSize: '0.8rem', mb: 0.5 }}>
                    Drug Control Department, Government of Kerala
                </Typography>
                <Typography sx={{ color: '#9ca3af', fontSize: '0.75rem', mb: 2 }}>
                    Under the Ministry of Health & Family Welfare · Powered by NIC Kerala
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap', mb: 1.5 }}>
                    {['Privacy Policy', 'Terms of Use', 'Contact', 'Accessibility', 'Screen Reader Access'].map(l => (
                        <Typography key={l} component="a" href="#"
                            sx={{ fontSize: '0.75rem', color: '#9ca3af', textDecoration: 'none', '&:hover': { color: '#111827' } }}>
                            {l}
                        </Typography>
                    ))}
                </Box>
                <Typography sx={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                    © {new Date().getFullYear()} Government of Kerala. All rights reserved.
                    &nbsp;|&nbsp; Last Updated: {new Date().toLocaleDateString('en-IN')}
                </Typography>
            </Box>
        </Box>
    );
};

export default Home;