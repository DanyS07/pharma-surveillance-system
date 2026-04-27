import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow'; import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog'; import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent'; import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField'; import MenuItem from '@mui/material/MenuItem';
import AppLayout from '../AppLayout'; import StatusBadge from '../StatusBadge';
import axiosInstance from '../../axiosInstance'; import { useToast } from '../../utils/Toast';

const FILTERS = ['all','active','pending','suspended'];

const AdminPharmacies = () => {
    const showToast = useToast();
    const [all, setAll]           = useState([]);
    const [officers, setOfficers] = useState([]);
    const [filter, setFilter]     = useState('all');
    const [confirm, setConfirm]   = useState(null); // { type, id, name }
    const [assignTarget, setAssignTarget] = useState(null);
    const [selectedOfficer, setSelectedOfficer] = useState('');

    const load = () => Promise.all([axiosInstance.get('/pharmacy/all'), axiosInstance.get('/user/officers')])
        .then(([p, o]) => { setAll(p.data.pharmacies || []); setOfficers(o.data.officers || []); })
        .catch(console.error);

    useEffect(() => { load(); }, []);

    const filtered = all.filter(p => filter === 'all' || p.status === filter);
    const pendingCount = all.filter(p => p.status === 'pending').length;

    const approve = async () => {
        await axiosInstance.put(`/user/approve/${confirm.id}`);
        showToast('Pharmacy approved.'); setConfirm(null); load();
    };
    const suspend = async () => {
        await axiosInstance.put(`/user/suspend/${confirm.id}`);
        showToast('Account suspended.'); setConfirm(null); load();
    };
    const assign = async () => {
        if (!selectedOfficer) return;
        await axiosInstance.put('/user/assign-pharmacy', { officerId: selectedOfficer, pharmacyId: assignTarget._id });
        showToast('Pharmacy assigned.'); setAssignTarget(null); setSelectedOfficer(''); load();
    };

    const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#f9fafb' } };

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Pharmacies</Typography>
                        {pendingCount > 0 && <Chip label={`Pending ${pendingCount}`} size="small" sx={{ backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 700 }} />}
                    </Box>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>Manage pharmacy registrations and approvals</Typography>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
                {FILTERS.map(f => (
                    <Button key={f} variant={filter === f ? 'contained' : 'outlined'} size="small" onClick={() => setFilter(f)}
                        sx={{ borderRadius: '999px', fontSize: '0.8rem', px: 2,
                              ...(filter === f ? { backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }
                                               : { borderColor: '#e5e7eb', color: '#6b7280' }) }}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                ))}
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                        {['Pharmacy','License No.','District','Status','Actions'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                        ))}
                    </TableRow></TableHead>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: '#9ca3af' }}>No pharmacies found.</TableCell></TableRow>
                        ) : filtered.map(p => (
                            <TableRow key={p._id} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.name}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>{p.licenseNumber}</TableCell>
                                <TableCell sx={{ fontSize: '0.85rem' }}>{p.district}</TableCell>
                                <TableCell><StatusBadge status={p.status} /></TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        {p.status === 'pending' && (
                                            <Button size="small" variant="outlined" onClick={() => setConfirm({ type: 'approve', id: p._id, name: p.name })}
                                                sx={{ borderRadius: '999px', borderColor: '#059669', color: '#059669', fontSize: '0.72rem', '&:hover': { backgroundColor: '#d1fae5' } }}>Approve</Button>
                                        )}
                                        {p.status === 'active' && (
                                            <>
                                                <Button component={Link} to={`/admin/pharmacies/${p._id}`} size="small" variant="outlined"
                                                    sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.72rem' }}>
                                                    View Inventory
                                                </Button>
                                                <Button size="small" variant="outlined" onClick={() => setAssignTarget(p)}
                                                    sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.72rem' }}>Assign Officer</Button>
                                                <Button size="small" variant="outlined" onClick={() => setConfirm({ type: 'suspend', id: p._id, name: p.name })}
                                                    sx={{ borderRadius: '999px', borderColor: '#dc2626', color: '#dc2626', fontSize: '0.72rem', '&:hover': { backgroundColor: '#fee2e2' } }}>Suspend</Button>
                                            </>
                                        )}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>

            {/* Approve / Suspend confirm */}
            <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>{confirm?.type === 'approve' ? 'Approve Pharmacy' : 'Suspend Account'}</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem' }}>
                        {confirm?.type === 'approve'
                            ? `Approve "${confirm?.name}"? They will be able to log in and upload inventory.`
                            : `Suspend "${confirm?.name}"? They will immediately lose access.`}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                    <Button onClick={() => setConfirm(null)} sx={{ color: '#6b7280', borderRadius: '10px' }}>Cancel</Button>
                    <Button onClick={confirm?.type === 'approve' ? approve : suspend} variant="contained"
                        sx={{ borderRadius: '10px', backgroundColor: confirm?.type === 'approve' ? '#059669' : '#dc2626',
                              '&:hover': { backgroundColor: confirm?.type === 'approve' ? '#047857' : '#b91c1c' } }}>
                        {confirm?.type === 'approve' ? 'Approve' : 'Suspend'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Assign officer modal */}
            <Dialog open={!!assignTarget} onClose={() => setAssignTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Assign Officer</DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mb: 2.5 }}>
                        Select an officer to assign to <strong>{assignTarget?.name}</strong>.
                    </Typography>
                    <TextField label="Officer *" select fullWidth value={selectedOfficer}
                        onChange={e => setSelectedOfficer(e.target.value)} sx={fieldSx}>
                        {officers.map(o => <MenuItem key={o._id} value={o._id}>{o.name} ({o.email})</MenuItem>)}
                    </TextField>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                    <Button onClick={() => setAssignTarget(null)} sx={{ color: '#6b7280', borderRadius: '10px' }}>Cancel</Button>
                    <Button onClick={assign} variant="contained"
                        sx={{ borderRadius: '10px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                        Assign
                    </Button>
                </DialogActions>
            </Dialog>
        </AppLayout>
    );
};

export default AdminPharmacies;
