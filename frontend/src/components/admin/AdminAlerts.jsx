import React, { useState, useEffect } from 'react'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead'; import TableRow from '@mui/material/TableRow';
import AppLayout from '../AppLayout'; import StatusBadge from '../StatusBadge'; import axiosInstance from '../../axiosInstance';

const AdminAlerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [filter, setFilter] = useState('all');

    useEffect(() => { axiosInstance.get('/alert/all').then(r => setAlerts(r.data.alerts || [])).catch(console.error); }, []);

    const filtered = alerts.filter(a => filter === 'all' || a.status === filter);

    return (
        <AppLayout>
            <Box sx={{ mb: 3.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>All Alerts</Typography>
                <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>System-wide NSQ alerts</Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
                {['all','OPEN','INVESTIGATING','RESOLVED'].map(f => (
                    <Button key={f} size="small" variant={filter === f ? 'contained' : 'outlined'} onClick={() => setFilter(f)}
                        sx={{ borderRadius: '999px', fontSize: '0.8rem', px: 2,
                              ...(filter === f ? { backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }
                                               : { borderColor: '#e5e7eb', color: '#6b7280' }) }}>
                        {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                    </Button>
                ))}
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                        {['Drug','Batch No.','Pharmacy','District','Officer','Matched NSQ','NSQ Manufacturer','Ban Date','Similarity','Status','Date'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                        ))}
                    </TableRow></TableHead>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={11} sx={{ textAlign: 'center', py: 5, color: '#9ca3af' }}>No alerts found.</TableCell></TableRow>
                        ) : filtered.map(a => (
                            <TableRow key={a._id} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.88rem' }}>
                                    {a.status === 'OPEN' && <span style={{ color: '#dc2626', marginRight: 6 }}>●</span>}
                                    {a.drugName}
                                </TableCell>
                                <TableCell><Box sx={{ backgroundColor: '#fee2e2', color: '#dc2626', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, px: 1, py: 0.3, borderRadius: '4px', display: 'inline-block' }}>{a.batchNumber}</Box></TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.pharmacyId?.name || '—'}</TableCell>
                                <TableCell sx={{ color: '#6b7280', fontSize: '0.82rem' }}>{a.pharmacyId?.district || '—'}</TableCell>
                                <TableCell sx={{ color: '#6b7280', fontSize: '0.82rem' }}>{a.officerId?.name || '—'}</TableCell>
                                <TableCell sx={{ fontSize: '0.82rem', color: '#374151' }}>{a.nsqDrugName || '—'}</TableCell>
                                <TableCell sx={{ fontSize: '0.82rem', color: '#6b7280' }}>{a.nsqManufacturer || '—'}</TableCell>
                                <TableCell sx={{ fontSize: '0.82rem', color: '#9ca3af' }}>{a.banDate ? new Date(a.banDate).toLocaleDateString() : '—'}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{typeof a.similarityScore === 'number' ? a.similarityScore.toFixed(2) : '—'}</TableCell>
                                <TableCell><StatusBadge status={a.status} /></TableCell>
                                <TableCell sx={{ fontSize: '0.78rem', color: '#9ca3af' }}>{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </AppLayout>
    );
};

export default AdminAlerts;
