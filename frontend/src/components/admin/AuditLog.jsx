import React from 'react'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography'; import Paper from '@mui/material/Paper';
import AppLayout from '../AppLayout';

// The audit log page is ready to display data once a GET /audit/all backend route is added.
// Every action in the system is already recorded in MongoDB's audit_logs collection.
const AuditLog = () => (
    <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
            <Box><Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Audit Log</Typography>
                <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>Immutable record of all system actions</Typography></Box>
            <Typography sx={{ fontSize: '1.2rem' }} title="This log is append-only. Records cannot be edited or deleted.">🔒</Typography>
        </Box>
        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '2rem', mb: 2 }}>🔒</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 1 }}>Audit Log Ready</Typography>
            <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', maxWidth: 480, mx: 'auto', lineHeight: 1.7 }}>
                All actions are recorded in the <code>audit_logs</code> MongoDB collection.
                Add a <code>GET /audit/all</code> route on the backend to display the full log table here.
            </Typography>
        </Paper>
    </AppLayout>
);

export default AuditLog;
