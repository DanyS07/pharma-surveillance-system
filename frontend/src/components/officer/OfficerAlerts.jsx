import React, { useState, useEffect } from 'react'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField'; import Collapse from '@mui/material/Collapse';
import AppLayout from '../AppLayout'; import StatusBadge from '../StatusBadge';
import axiosInstance from '../../axiosInstance'; import { useToast } from '../../utils/Toast';

const OfficerAlerts = () => {
    const showToast = useToast();
    const [alerts, setAlerts]     = useState([]);
    const [filter, setFilter]     = useState('all');
    const [expanded, setExpanded] = useState(null);
    const [selStatus, setSelStatus] = useState('');
    const [notes, setNotes]         = useState('');
    const [saving, setSaving]       = useState(false);

    const load = () => axiosInstance.get('/alert/my-alerts')
        .then(r => setAlerts(r.data.alerts || [])).catch(console.error);
    useEffect(() => { load(); }, []);

    const openExpand = (alert) => {
        setExpanded(alert._id); setSelStatus(alert.status); setNotes(alert.officerNotes || '');
    };

    const save = async (alertId) => {
        setSaving(true);
        try {
            await axiosInstance.put(`/alert/status/${alertId}`, { status: selStatus, officerNotes: notes });
            showToast('Alert updated.'); setExpanded(null); load();
        } catch (err) { showToast(err.response?.data?.message || 'Update failed.', 'error'); }
        setSaving(false);
    };

    const filtered = alerts.filter(a => filter === 'all' || a.status === filter);

    return (
        <AppLayout>
            <Box sx={{ mb: 3.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>My Alerts</Typography>
                <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>NSQ alerts assigned to your account</Typography>
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

            {filtered.length === 0 ? (
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 5, textAlign: 'center' }}>
                    <Typography sx={{ color: '#9ca3af' }}>No alerts found.</Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {filtered.map(a => {
                        const dotColor = { OPEN: '#dc2626', INVESTIGATING: '#d97706', RESOLVED: '#059669' }[a.status] || '#9ca3af';
                        const isOpen = expanded === a._id;
                        return (
                            <Paper key={a._id} elevation={0}
                                sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden',
                                      transition: 'border-color 0.15s', '&:hover': { borderColor: '#d1d5db' } }}>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', p: 2.5 }}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0, mt: 0.6 }} />
                                    <Box sx={{ flex: 1 }}>
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{a.pharmacyId?.name || 'Unknown'}</Typography>
                                        <Typography sx={{ fontSize: '0.78rem', color: '#9ca3af', mb: 0.8 }}>{a.pharmacyId?.district || ''}</Typography>
                                        <Typography sx={{ fontSize: '0.88rem', color: '#374151' }}>
                                            <strong>{a.drugName}</strong>{' — Batch: '}
                                            <Box component="span" sx={{ fontFamily: 'monospace', backgroundColor: '#fee2e2', color: '#dc2626', px: 0.8, py: 0.2, borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                                                {a.batchNumber}
                                            </Box>
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: '#9ca3af', mt: 0.5 }}>{new Date(a.createdAt).toLocaleString()}</Typography>
                                        {a.officerNotes && !isOpen && (
                                            <Typography sx={{ fontSize: '0.8rem', color: '#6b7280', mt: 0.8, fontStyle: 'italic' }}>Note: {a.officerNotes}</Typography>
                                        )}
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5, flexShrink: 0 }}>
                                        <StatusBadge status={a.status} />
                                        {a.status !== 'RESOLVED' && (
                                            <Button size="small" variant="outlined"
                                                onClick={() => isOpen ? setExpanded(null) : openExpand(a)}
                                                sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.75rem', minWidth: 80 }}>
                                                {isOpen ? 'Cancel' : 'Update'}
                                            </Button>
                                        )}
                                    </Box>
                                </Box>
                                <Collapse in={isOpen}>
                                    <Box sx={{ borderTop: '1px solid #f3f4f6', backgroundColor: '#f9fafb', px: 2.5, py: 2 }}>
                                        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                                            {[
                                                { s: 'OPEN', col: '#dc2626', bg: '#fee2e2' },
                                                { s: 'INVESTIGATING', col: '#d97706', bg: '#fef3c7' },
                                                { s: 'RESOLVED', col: '#059669', bg: '#d1fae5' },
                                            ].map(({ s, col, bg }) => (
                                                <Button key={s} size="small" onClick={() => setSelStatus(s)}
                                                    sx={{ borderRadius: '999px', fontSize: '0.75rem', px: 2,
                                                          border: `1.5px solid ${col}`, color: selStatus === s ? 'white' : col,
                                                          backgroundColor: selStatus === s ? col : 'transparent',
                                                          '&:hover': { backgroundColor: selStatus === s ? col : bg } }}>
                                                    {s}
                                                </Button>
                                            ))}
                                        </Box>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5, mb: 2 }}>
                                            <Typography sx={{ fontSize: '0.85rem', color: '#374151' }}><strong>Matched NSQ:</strong> {a.nsqDrugName || '-'}</Typography>
                                            <Typography sx={{ fontSize: '0.85rem', color: '#374151' }}><strong>NSQ Manufacturer:</strong> {a.nsqManufacturer || '-'}</Typography>
                                            <Typography sx={{ fontSize: '0.85rem', color: '#374151' }}><strong>Ban Date:</strong> {a.banDate ? new Date(a.banDate).toLocaleDateString() : '-'}</Typography>
                                            <Typography sx={{ fontSize: '0.85rem', color: '#374151' }}><strong>Similarity:</strong> {typeof a.similarityScore === 'number' ? a.similarityScore.toFixed(2) : '-'}</Typography>
                                        </Box>
                                        <TextField label="Officer Notes" value={notes} onChange={e => setNotes(e.target.value)}
                                            fullWidth multiline rows={2} size="small"
                                            placeholder="Describe investigation steps taken…"
                                            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: 'white' } }} />
                                        <Button variant="contained" size="small" onClick={() => save(a._id)} disabled={saving}
                                            sx={{ borderRadius: '999px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                                            {saving ? 'Saving…' : 'Save Update'}
                                        </Button>
                                    </Box>
                                </Collapse>
                            </Paper>
                        );
                    })}
                </Box>
            )}
        </AppLayout>
    );
};

export default OfficerAlerts;
