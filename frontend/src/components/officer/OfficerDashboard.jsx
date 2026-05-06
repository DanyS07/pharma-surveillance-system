import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField'; import Collapse from '@mui/material/Collapse';
import AppLayout from '../AppLayout'; import StatusBadge from '../StatusBadge';
import TrendGraphs from '../TrendGraphs';
import axiosInstance from '../../axiosInstance'; import { useToast } from '../../utils/Toast';

const StatCard = ({ label, value, color }) => (
    <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: '20px 24px', flex: 1, minWidth: 140 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>{label}</Typography>
        <Typography sx={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: color || '#111827' }}>{value}</Typography>
    </Paper>
);

// Inline-expandable alert card — identical interaction pattern to Mentii's booking dialog
// but stays within the card rather than opening a separate dialog
const AlertCard = ({ alert, onUpdated }) => {
    const showToast    = useToast();
    const [open, setOpen]   = useState(false);
    const [status, setStatus] = useState(alert.status);
    const [notes, setNotes]   = useState(alert.officerNotes || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await axiosInstance.put(`/alert/status/${alert._id}`, { status, officerNotes: notes });
            showToast('Alert updated.'); setOpen(false); onUpdated();
        } catch (err) { showToast(err.response?.data?.message || 'Update failed.', 'error'); }
        setSaving(false);
    };

    const dotColor = { OPEN: '#dc2626', INVESTIGATING: '#d97706', RESOLVED: '#059669' }[alert.status] || '#9ca3af';

    return (
        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden',
                                    transition: 'border-color 0.15s', '&:hover': { borderColor: '#d1d5db' } }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', p: 2.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0, mt: 0.6 }} />
                <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{alert.pharmacyId?.name || 'Unknown Pharmacy'}</Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: '#9ca3af', mb: 0.8 }}>{alert.pharmacyId?.district || ''}</Typography>
                    <Typography sx={{ fontSize: '0.88rem', color: '#374151' }}>
                        <strong>{alert.drugName}</strong>
                        {' — Batch: '}
                        <Box component="span" sx={{ fontFamily: 'monospace', backgroundColor: '#fee2e2', color: '#dc2626',
                                                     px: 0.8, py: 0.2, borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                            {alert.batchNumber}
                        </Box>
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#9ca3af', mt: 0.5 }}>
                        {new Date(alert.createdAt).toLocaleString()}
                    </Typography>
                    {alert.officerNotes && !open && (
                        <Typography sx={{ fontSize: '0.8rem', color: '#6b7280', mt: 0.8, fontStyle: 'italic' }}>
                            Note: {alert.officerNotes}
                        </Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5, flexShrink: 0 }}>
                    <StatusBadge status={alert.status} />
                    {alert.status !== 'RESOLVED' && (
                        <Button size="small" variant="outlined" onClick={() => setOpen(p => !p)}
                            sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.75rem',
                                  minWidth: 110 }}>
                            {open ? 'Cancel' : 'Update Status'}
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Inline expand — no modal */}
            <Collapse in={open}>
                <Box sx={{ borderTop: '1px solid #f3f4f6', backgroundColor: '#f9fafb', px: 2.5, py: 2 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', mb: 1.2 }}>Update Status</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                        {['OPEN','INVESTIGATING','RESOLVED'].map(s => {
                            const colors = { OPEN: { sel: '#dc2626', selBg: '#fee2e2' }, INVESTIGATING: { sel: '#d97706', selBg: '#fef3c7' }, RESOLVED: { sel: '#059669', selBg: '#d1fae5' } };
                            const c = colors[s];
                            const active = status === s;
                            return (
                                <Button key={s} size="small" onClick={() => setStatus(s)}
                                    sx={{ borderRadius: '999px', fontSize: '0.75rem', px: 2,
                                          border: `1.5px solid ${c.sel}`, color: active ? 'white' : c.sel,
                                          backgroundColor: active ? c.sel : 'transparent',
                                          '&:hover': { backgroundColor: active ? c.sel : c.selBg } }}>
                                    {s}
                                </Button>
                            );
                        })}
                    </Box>
                    <TextField label="Officer Notes" value={notes} onChange={e => setNotes(e.target.value)}
                        fullWidth multiline rows={2} size="small"
                        placeholder="Describe the investigation steps taken…"
                        sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: 'white' } }} />
                    <Button variant="contained" size="small" onClick={save} disabled={saving}
                        sx={{ borderRadius: '999px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                        {saving ? 'Saving…' : 'Save Update'}
                    </Button>
                </Box>
            </Collapse>
        </Paper>
    );
};

const OfficerDashboard = () => {
    const [alerts, setAlerts]         = useState([]);
    const [pharmacies, setPharmacies] = useState([]);

    const load = () => Promise.all([
        axiosInstance.get('/alert/my-alerts'),
        axiosInstance.get('/pharmacy/my-pharmacies'),
    ]).then(([a, p]) => { setAlerts(a.data.alerts || []); setPharmacies(p.data.pharmacies || []); })
      .catch(console.error);

    useEffect(() => { load(); }, []);

    const open         = alerts.filter(a => a.status === 'OPEN').length;
    const investigating = alerts.filter(a => a.status === 'INVESTIGATING').length;
    const resolved     = alerts.filter(a => a.status === 'RESOLVED').length;
    const active       = alerts.filter(a => a.status !== 'RESOLVED');

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box><Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Officer Dashboard</Typography>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>Monitor assigned pharmacies and resolve NSQ alerts</Typography></Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
                <StatCard label="Open Alerts"   value={open}         color={open > 0 ? '#dc2626' : '#059669'} />
                <StatCard label="Investigating" value={investigating} color={investigating > 0 ? '#d97706' : '#6b7280'} />
                <StatCard label="Resolved"      value={resolved}     color="#059669" />
            </Box>

            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                        ⚠️ Action Required
                    </Typography>
                    <Typography component={Link} to="/officer/alerts"
                        sx={{ fontSize: '0.82rem', color: '#6b7280', textDecoration: 'none', '&:hover': { color: '#111827' } }}>
                        View all →
                    </Typography>
                </Box>
                {active.length === 0 ? (
                    <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 4, textAlign: 'center' }}>
                        <Typography sx={{ color: '#9ca3af', fontSize: '0.9rem' }}>No open alerts. All caught up.</Typography>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {active.slice(0, 5).map(a => <AlertCard key={a._id} alert={a} onUpdated={load} />)}
                    </Box>
                )}
            </Box>

            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>My Pharmacies</Typography>
                    <Typography component={Link} to="/officer/pharmacies"
                        sx={{ fontSize: '0.82rem', color: '#6b7280', textDecoration: 'none', '&:hover': { color: '#111827' } }}>
                        View all →
                    </Typography>
                </Box>
                {pharmacies.length === 0 ? (
                    <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 4, textAlign: 'center' }}>
                        <Typography sx={{ color: '#9ca3af', fontSize: '0.9rem' }}>No pharmacies assigned yet.</Typography>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1.5 }}>
                        {pharmacies.map(p => (
                            <Paper key={p._id} elevation={0}
                                sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 2.5,
                                      display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.name}</Typography>
                                <Typography sx={{ fontSize: '0.78rem', color: '#9ca3af' }}>{p.district}</Typography>
                                <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280' }}>{p.licenseNumber}</Typography>
                                <Button component={Link} to={`/officer/pharmacies/${p._id}`} size="small" variant="outlined"
                                    sx={{ mt: 1, borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.75rem' }}>
                                    View Inventory →
                                </Button>
                            </Paper>
                        ))}
                    </Box>
                )}
            </Box>

            {/* Trend Graphs Section */}
            <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid #e5e7eb' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', mb: 3 }}>📈 Analytics & Trends</Typography>
                <TrendGraphs sections={['nsq', 'alerts', 'antibiotic']} />
            </Box>
        </AppLayout>
    );
};

export default OfficerDashboard;
