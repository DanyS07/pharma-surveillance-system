import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Box        from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper      from '@mui/material/Paper';
import Button     from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import AppLayout    from '../AppLayout';
import StatusBadge  from '../StatusBadge';
import axiosInstance from '../../axiosInstance';

const StatCard = ({ label, value, sub, color }) => (
    <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: '20px 24px', flex: 1, minWidth: 160 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>{label}</Typography>
        <Typography sx={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: color || '#111827' }}>{value}</Typography>
        {sub && <Typography sx={{ fontSize: '0.75rem', color, mt: 0.5 }}>{sub}</Typography>}
    </Paper>
);

const AdminDashboard = () => {
    const [data, setData] = useState({ pending: [], alerts: [], officers: [], pharmCount: 0, nsqCount: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            axiosInstance.get('/user/pending'),
            axiosInstance.get('/alert/all'),
            axiosInstance.get('/user/officers'),
            axiosInstance.get('/pharmacy/all'),
            axiosInstance.get('/nsq/all'),
        ]).then(([p, al, off, ph, nsq]) => setData({
            pending:    p.data.pharmacies  || [],
            alerts:     al.data.alerts     || [],
            officers:   off.data.officers  || [],
            pharmCount: (ph.data.pharmacies || []).filter(x => x.status === 'active').length,
            nsqCount:   (nsq.data.records  || []).length,
        })).catch(console.error).finally(() => setLoading(false));
    }, []);

    const openAlerts = data.alerts.filter(a => a.status === 'OPEN').length;

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box><Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Admin Dashboard</Typography>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>Drug Control Department — Kerala</Typography></Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
                <StatCard label="Active Pharmacies" value={data.pharmCount} sub="registered & active" color="#059669" />
                <StatCard label="Pending Approvals" value={data.pending.length} sub="awaiting review" color={data.pending.length > 0 ? '#d97706' : '#059669'} />
                <StatCard label="Open Alerts" value={openAlerts} sub="require action" color={openAlerts > 0 ? '#dc2626' : '#059669'} />
                <StatCard label="NSQ Records" value={data.nsqCount} sub="in master list" color="#6b7280" />
            </Box>

            {data.pending.length > 0 && (
                <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>⚠️ Pending Approvals</Typography>
                        <Typography component={Link} to="/admin/pharmacies" sx={{ fontSize: '0.82rem', color: '#6b7280', textDecoration: 'none', '&:hover': { color: '#111827' } }}>View all →</Typography>
                    </Box>
                    <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                        <Table size="small">
                            <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                {['Pharmacy Name','License No.','District','Submitted',''].map(h => (
                                    <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                                ))}
                            </TableRow></TableHead>
                            <TableBody>
                                {data.pending.map(p => (
                                    <TableRow key={p._id} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.name}</TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>{p.licenseNumber}</TableCell>
                                        <TableCell sx={{ fontSize: '0.85rem' }}>{p.district}</TableCell>
                                        <TableCell sx={{ fontSize: '0.78rem', color: '#9ca3af' }}>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell><Button component={Link} to="/admin/pharmacies" size="small" variant="outlined"
                                            sx={{ borderRadius: '999px', borderColor: '#059669', color: '#059669', fontSize: '0.75rem', '&:hover': { backgroundColor: '#d1fae5' } }}>Review</Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Box>
            )}

            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Recent Alerts</Typography>
                    <Typography component={Link} to="/admin/alerts" sx={{ fontSize: '0.82rem', color: '#6b7280', textDecoration: 'none', '&:hover': { color: '#111827' } }}>View all →</Typography>
                </Box>
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                            {['Drug','Batch No.','Pharmacy','Officer','Status','Date'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                            ))}
                        </TableRow></TableHead>
                        <TableBody>
                            {data.alerts.length === 0 ? (
                                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: '#9ca3af', fontSize: '0.88rem' }}>No alerts yet.</TableCell></TableRow>
                            ) : data.alerts.slice(0, 10).map(a => (
                                <TableRow key={a._id} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{a.drugName}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{a.batchNumber}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{a.pharmacyId?.name || '—'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem', color: '#6b7280' }}>{a.officerId?.name || '—'}</TableCell>
                                    <TableCell><StatusBadge status={a.status} /></TableCell>
                                    <TableCell sx={{ fontSize: '0.78rem', color: '#9ca3af' }}>{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            </Box>

            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Officers</Typography>
                    <Typography component={Link} to="/admin/officers" sx={{ fontSize: '0.82rem', color: '#6b7280', textDecoration: 'none', '&:hover': { color: '#111827' } }}>Manage →</Typography>
                </Box>
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                            {['Officer','Email','Pharmacies Assigned'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                            ))}
                        </TableRow></TableHead>
                        <TableBody>
                            {data.officers.length === 0 ? (
                                <TableRow><TableCell colSpan={3} sx={{ textAlign: 'center', py: 4, color: '#9ca3af', fontSize: '0.88rem' }}>No officers created yet.</TableCell></TableRow>
                            ) : data.officers.map(o => (
                                <TableRow key={o._id} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{o.name}</TableCell>
                                    <TableCell sx={{ color: '#6b7280', fontSize: '0.85rem' }}>{o.email}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{o.assignedPharmacies?.length || 0}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            </Box>
        </AppLayout>
    );
};

export default AdminDashboard;
