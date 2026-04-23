import React from 'react'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography'; import Button from '@mui/material/Button';
import GovHeader from './GovHeader';

const Forbidden = () => (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
        <GovHeader />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 2 }}>
            <Typography sx={{ fontSize: '8rem', fontWeight: 800, color: '#fee2e2', lineHeight: 1, letterSpacing: '-0.03em', mb: 2 }}>403</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Access Denied</Typography>
            <Typography sx={{ color: '#6b7280', maxWidth: 400, mb: 3.5, lineHeight: 1.7, fontSize: '0.9rem' }}>
                Your account role does not have permission to view this page.
            </Typography>
            <Button component={Link} to="/" variant="contained"
                sx={{ borderRadius: '999px', backgroundColor: '#111827', px: 4, '&:hover': { backgroundColor: '#1f2937' } }}>
                Go to Home
            </Button>
        </Box>
    </Box>
);

export default Forbidden;
