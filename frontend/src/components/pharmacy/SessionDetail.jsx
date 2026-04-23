import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead'; import TableRow from '@mui/material/TableRow';
import AppLayout from '../AppLayout'; import StatusBadge from '../StatusBadge'; import axiosInstance from '../../axiosInstance';

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

const SessionDetail = () => {
    const { sessionId } = useParams();
    const [records, setRecords] = useState([]);
    useEffect(() => { axiosInstance.get(`/inventory/session/${sessionId}`).then(r => setRecords(r.data.records || [])).catch(console.error); }, [sessionId]);

    const nsqCount = records.filter(r => r.nsqStatus === 'NSQ_CONFIRMED').length;
    const sample   = records[0];
    const period   = sample?.saleMonth ? `${MONTHS[sample.saleMonth]} ${sample.saleYear}` : '';

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box>
                    <Typography component={Link} to="/pharmacy/uploads"
                        sx={{ fontSize: '0.82rem', color: '#9ca3af', textDecoration: 'none', '&:hover': { color: '#111827' } }}>
                        ← Back to uploads
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mt: 1 }}>
                        Session Detail {period && `— ${period}`}
                    </Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9ca3af', mt: 0.3 }}>{sessionId}</Typography>
                </Box>
                <Button variant="outlined" onClick={() => window.print()}
                    sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.85rem' }}>
                    🖨 Print / Export PDF
                </Button>
            </Box>

            {/* Summary cards */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                {[
                    { label: 'Total Rows', value: records.length, color: '#111827' },
                    { label: 'NSQ Confirmed', value: nsqCount, color: nsqCount > 0 ? '#dc2626' : '#059669' },
                    { label: 'Safe', value: records.filter(r => r.nsqStatus === 'SAFE').length, color: '#059669' },
                ].map(c => (
                    <Paper key={c.label} elevation={0} sx={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '12px', p: '16px 20px', textAlign: 'center' }}>
                        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: c.color }}>{c.value}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: '#9ca3af', mt: 0.3 }}>{c.label}</Typography>
                    </Paper>
                ))}
            </Box>

            {nsqCount > 0 && (
                <Box sx={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', px: 2.5, py: 1.8, mb: 3 }}>
                    <Typography sx={{ color: '#7f1d1d', fontSize: '0.9rem', fontWeight: 500 }}>
                        ⚠️ {nsqCount} batch{nsqCount !== 1 ? 'es' : ''} confirmed NSQ. Your Drug Control Officer has been notified.
                    </Typography>
                </Box>
            )}

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                        {['Drug Name','Batch No.','Manufacturer','Expiry','Qty','NSQ Status'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                        ))}
                    </TableRow></TableHead>
                    <TableBody>
                        {records.map(r => (
                            <TableRow key={r._id}
                                sx={{ backgroundColor: r.nsqStatus === 'NSQ_CONFIRMED' ? '#fff5f5' : 'inherit',
                                      '&:hover': { backgroundColor: r.nsqStatus === 'NSQ_CONFIRMED' ? '#fee2e2' : '#f9fafb' },
                                      '&:last-child td': { border: 0 } }}>
                                <TableCell sx={{ fontWeight: r.nsqStatus === 'NSQ_CONFIRMED' ? 700 : 400, fontSize: '0.88rem' }}>{r.drugName}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.batchNumber}</TableCell>
                                <TableCell sx={{ color: '#6b7280', fontSize: '0.82rem' }}>{r.manufacturer || '—'}</TableCell>
                                <TableCell sx={{ fontSize: '0.78rem', color: '#9ca3af' }}>{r.expiryDate || '—'}</TableCell>
                                <TableCell sx={{ fontSize: '0.85rem' }}>{r.quantity}</TableCell>
                                <TableCell><StatusBadge status={r.nsqStatus} /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </AppLayout>
    );
};

export default SessionDetail;
