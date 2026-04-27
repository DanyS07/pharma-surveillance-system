import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead'; import TableRow from '@mui/material/TableRow';
import AppLayout from '../AppLayout'; import StatusBadge from '../StatusBadge'; import axiosInstance from '../../axiosInstance';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const PharmacyDetail = () => {
    const { id } = useParams();
    const [inventory, setInventory] = useState([]);
    const [alerts, setAlerts]       = useState([]);

    useEffect(() => {
        Promise.all([axiosInstance.get(`/pharmacy/${id}/inventory`), axiosInstance.get(`/pharmacy/${id}/alerts`)])
            .then(([inv, al]) => { setInventory(inv.data.records || []); setAlerts(al.data.alerts || []); })
            .catch(console.error);
    }, [id]);

    // Group rows by session
    const sessions = {};
    inventory.forEach(r => {
        if (!sessions[r.uploadSessionId]) sessions[r.uploadSessionId] = { sessionId: r.uploadSessionId, rows: [], date: r.createdAt };
        sessions[r.uploadSessionId].rows.push(r);
    });
    const sessionList = Object.values(sessions).sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <AppLayout>
            <Box sx={{ mb: 3.5 }}>
                <Typography component={Link} to="/officer/pharmacies"
                    sx={{ fontSize: '0.82rem', color: '#9ca3af', textDecoration: 'none', '&:hover': { color: '#111827' } }}>
                    ← Back to pharmacies
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mt: 1 }}>Pharmacy Inventory</Typography>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>Upload Sessions</Typography>
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                            {['Session ID','Period','Rows','NSQ Matches','Actions'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                            ))}
                        </TableRow></TableHead>
                        <TableBody>
                            {sessionList.length === 0 ? (
                                <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: '#9ca3af' }}>No inventory uploaded yet.</TableCell></TableRow>
                            ) : sessionList.map(s => {
                                const nsqCount = s.rows.filter(r => r.nsqStatus === 'NSQ_CONFIRMED').length;
                                const sample   = s.rows[0];
                                const period   = sample?.saleMonth ? `${MONTHS[sample.saleMonth]} ${sample.saleYear}` : new Date(s.date).toLocaleDateString();
                                return (
                                    <TableRow key={s.sessionId} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9ca3af' }}>{s.sessionId.slice(0, 18)}…</TableCell>
                                        <TableCell sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{period}</TableCell>
                                        <TableCell sx={{ fontSize: '0.85rem' }}>{s.rows.length}</TableCell>
                                        <TableCell>
                                            {nsqCount > 0
                                                ? <Typography sx={{ color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>⚠️ {nsqCount} NSQ</Typography>
                                                : <Typography sx={{ color: '#059669', fontSize: '0.85rem' }}>0 — Safe</Typography>}
                                        </TableCell>
                                        <TableCell>
                                            <Button component={Link} to={`/officer/session/${s.sessionId}`} size="small" variant="outlined"
                                                sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.75rem' }}>
                                                View Session
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            </Box>

            <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>Alerts for this Pharmacy</Typography>
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                            {['Drug','Batch No.','Status','Date'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                            ))}
                        </TableRow></TableHead>
                        <TableBody>
                            {alerts.length === 0 ? (
                                <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: '#9ca3af' }}>No alerts for this pharmacy.</TableCell></TableRow>
                            ) : alerts.map(a => (
                                <TableRow key={a._id} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{a.drugName}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{a.batchNumber}</TableCell>
                                    <TableCell><StatusBadge status={a.status} /></TableCell>
                                    <TableCell sx={{ fontSize: '0.78rem', color: '#9ca3af' }}>{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            </Box>
        </AppLayout>
    );
};

export default PharmacyDetail;
