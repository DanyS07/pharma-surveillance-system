import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead'; import TableRow from '@mui/material/TableRow';
import AppLayout from '../AppLayout'; import StatusBadge from '../StatusBadge'; import axiosInstance from '../../axiosInstance';

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

const SessionView = () => {
    const { sessionId } = useParams();
    const [records, setRecords] = useState([]);

    useEffect(() => { axiosInstance.get(`/inventory/session/${sessionId}`).then(r => setRecords(r.data.records || [])).catch(console.error); }, [sessionId]);

    const nsqCount  = records.filter(r => r.nsqStatus === 'NSQ_CONFIRMED').length;
    const sample    = records[0];
    const period    = sample?.saleMonth ? `${MONTHS[sample.saleMonth]} ${sample.saleYear}` : '';

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace', mb: 0.5 }}>
                        Session: {sessionId}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                        Inventory Session {period && `— ${period}`}
                    </Typography>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>
                        {records.length} rows ·{' '}
                        {nsqCount > 0
                            ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{nsqCount} NSQ CONFIRMED</span>
                            : <span style={{ color: '#059669' }}>All SAFE</span>}
                    </Typography>
                </Box>
                <Button variant="outlined" onClick={() => window.print()}
                    sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.85rem' }}>
                    🖨 Print / Export PDF
                </Button>
            </Box>

            {nsqCount > 0 && (
                <Box sx={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', px: 2.5, py: 1.8, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography sx={{ fontSize: '0.9rem', color: '#7f1d1d', fontWeight: 500 }}>
                        ⚠️ {nsqCount} drug batch{nsqCount !== 1 ? 'es' : ''} confirmed NSQ in this session. Immediate action required.
                    </Typography>
                </Box>
            )}

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                        {['Drug Name','Batch No.','Manufacturer','Expiry Date','Qty','NSQ Status'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                        ))}
                    </TableRow></TableHead>
                    <TableBody>
                        {records.length === 0 ? (
                            <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 5, color: '#9ca3af' }}>No records found.</TableCell></TableRow>
                        ) : records.map(r => (
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

export default SessionView;
