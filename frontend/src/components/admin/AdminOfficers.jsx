import React, { useState, useEffect } from 'react'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow'; import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog'; import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent'; import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import AppLayout from '../AppLayout'; import axiosInstance from '../../axiosInstance'; import { useToast } from '../../utils/Toast';

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#f9fafb' } };

const AdminOfficers = () => {
    const showToast = useToast();
    const [officers, setOfficers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving]   = useState(false);
    const [form, setForm]       = useState({ name: '', email: '', password: '' });
    const [errors, setErrors]   = useState({});
    const [apiErr, setApiErr]   = useState('');

    const load = () => axiosInstance.get('/user/officers').then(r => setOfficers(r.data.officers || [])).catch(console.error);
    useEffect(() => { load(); }, []);

    const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })); };

    const validate = () => {
        const e = {};
        if (!form.name.trim())  e.name = 'Required';
        if (!form.email.trim()) e.email = 'Required';
        if (form.password.length < 8) e.password = 'Min 8 characters';
        setErrors(e); return Object.keys(e).length === 0;
    };

    const create = async () => {
        if (!validate()) return;
        setSaving(true); setApiErr('');
        try {
            await axiosInstance.post('/user/create-officer', form);
            showToast('Officer created.'); setShowModal(false);
            setForm({ name: '', email: '', password: '' }); load();
        } catch (err) { setApiErr(err.response?.data?.message || 'Failed.'); }
        setSaving(false);
    };

    const suspend = async (id, name) => {
        if (!window.confirm(`Suspend ${name}?`)) return;
        await axiosInstance.put(`/user/suspend/${id}`);
        showToast('Officer suspended.'); load();
    };

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box><Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Officers</Typography>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>Drug Control Officers and assigned pharmacies</Typography></Box>
                <Button variant="contained" onClick={() => setShowModal(true)}
                    sx={{ borderRadius: '999px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                    + Create Officer
                </Button>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                        {['Officer','Email','Pharmacies Assigned','Created','Actions'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                        ))}
                    </TableRow></TableHead>
                    <TableBody>
                        {officers.length === 0 ? (
                            <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: '#9ca3af' }}>No officers yet. Create one to begin.</TableCell></TableRow>
                        ) : officers.map(o => (
                            <TableRow key={o._id} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{o.name}</TableCell>
                                <TableCell sx={{ color: '#6b7280', fontSize: '0.85rem' }}>{o.email}</TableCell>
                                <TableCell>
                                    {(o.assignedPharmacies || []).slice(0, 2).map(p => (
                                        <Chip key={p._id} label={p.name || p.licenseNumber} size="small"
                                            sx={{ mr: 0.5, mb: 0.5, backgroundColor: '#dbeafe', color: '#2563eb', fontSize: '0.68rem' }} />
                                    ))}
                                    {o.assignedPharmacies?.length === 0 && <Typography sx={{ color: '#9ca3af', fontSize: '0.8rem' }}>None</Typography>}
                                </TableCell>
                                <TableCell sx={{ fontSize: '0.78rem', color: '#9ca3af' }}>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <Button size="small" variant="outlined" onClick={() => suspend(o._id, o.name)}
                                        sx={{ borderRadius: '999px', borderColor: '#dc2626', color: '#dc2626', fontSize: '0.72rem', '&:hover': { backgroundColor: '#fee2e2' } }}>Suspend</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>

            <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Create Officer Account</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
                    {apiErr && <Box sx={{ backgroundColor: '#fee2e2', borderRadius: '8px', px: 2, py: 1 }}>
                        <Typography sx={{ color: '#dc2626', fontSize: '0.85rem' }}>{apiErr}</Typography></Box>}
                    <TextField label="Full Name *" value={form.name} onChange={e => set('name', e.target.value)} fullWidth sx={fieldSx} error={!!errors.name} helperText={errors.name} />
                    <TextField label="Email *" type="email" value={form.email} onChange={e => set('email', e.target.value)} fullWidth sx={fieldSx} error={!!errors.email} helperText={errors.email} />
                    <TextField label="Password *" type="password" value={form.password} onChange={e => set('password', e.target.value)} fullWidth sx={fieldSx} error={!!errors.password} helperText={errors.password || 'Min 8 characters'} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                    <Button onClick={() => setShowModal(false)} sx={{ color: '#6b7280', borderRadius: '10px' }}>Cancel</Button>
                    <Button onClick={create} disabled={saving} variant="contained"
                        sx={{ borderRadius: '10px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                        {saving ? 'Creating…' : 'Create Account'}
                    </Button>
                </DialogActions>
            </Dialog>
        </AppLayout>
    );
};

export default AdminOfficers;
