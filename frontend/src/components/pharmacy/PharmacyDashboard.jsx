import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead'; import TableRow from '@mui/material/TableRow';
import AppLayout from '../AppLayout'; 
import TrendGraphs from '../TrendGraphs';
import axiosInstance from '../../axiosInstance';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const normalizeUploads = (payload) => {
    if (Array.isArray(payload?.uploads)) {
        return payload.uploads;
    }

    const sessions = {};
    (payload?.records || []).forEach(row => {
        if (!sessions[row.uploadSessionId]) {
            sessions[row.uploadSessionId] = {
                sid: row.uploadSessionId,
                date: row.createdAt,
                rows: 0,
                nsq: 0,
                month: row.saleMonth,
                year: row.saleYear,
            };
        }
        sessions[row.uploadSessionId].rows++;
        if (row.nsqStatus === 'NSQ_CONFIRMED') sessions[row.uploadSessionId].nsq++;
    });

    return Object.values(sessions);
};

const StatCard = ({ label, value, color }) => (
    <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: '20px 24px', flex: 1 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>{label}</Typography>
        <Typography sx={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', color: color || '#111827' }}>{value}</Typography>
    </Paper>
);

const PharmacyDashboard = () => {
    const stored  = JSON.parse(localStorage.getItem('pharma_user') || '{}');
    const [profile, setProfile]   = useState(null);
    const [uploads, setUploads]   = useState([]);

    useEffect(() => {
        Promise.all([
            axiosInstance.get(`/user/profile/${stored.id}`),
            axiosInstance.get('/inventory/my-uploads'),
        ]).then(([p, u]) => { setProfile(p.data.user); setUploads(normalizeUploads(u.data)); })
          .catch(console.error);
    }, [stored.id]);

    const sessionList = [...uploads].sort((a, b) =>
        (b.year - a.year) ||
        (b.month - a.month) ||
        (new Date(b.date) - new Date(a.date))
    );
    const nsqTotal = uploads.reduce((sum, upload) => sum + (upload.nsq || 0), 0);
    const lastUpload = sessionList.length > 0 ? new Date(sessionList[0].date).toLocaleDateString() : '—';

    const StatusBanner = () => {
        if (!profile) return null;
        if (profile.status === 'pending') return (
            <Box sx={{ backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '12px',
                        px: 2.5, py: 1.8, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: '0.9rem', color: '#92400e', fontWeight: 500 }}>
                    ⏳ Your account is under review. You cannot upload inventory until approved by the Drug Control Department.
                </Typography>
            </Box>
        );
        if (profile.status === 'suspended') return (
            <Box sx={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px',
                        px: 2.5, py: 1.8, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: '0.9rem', color: '#7f1d1d', fontWeight: 500 }}>
                    🚫 Your account has been suspended. Contact the Drug Control Department for assistance.
                </Typography>
            </Box>
        );
        return null;
    };

    return (
        <AppLayout>
            <Box sx={{ mb: 3.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Dashboard</Typography>
                <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>{profile?.name || stored.name}</Typography>
            </Box>

            <StatusBanner />

            {profile?.status === 'active' && (
                <>
                    <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
                        <StatCard label="Total Uploads"  value={sessionList.length} />
                        <StatCard label="NSQ Confirmed"  value={nsqTotal} color={nsqTotal > 0 ? '#dc2626' : '#059669'} />
                        <StatCard label="Last Upload"    value={lastUpload} />
                    </Box>

                    {/* Upload prompt card — prominent dashed box */}
                    <Paper elevation={0} onClick={() => window.location.href = '/pharmacy/upload'}
                        sx={{ border: '2px dashed #e5e7eb', borderRadius: '16px', p: 5, textAlign: 'center',
                              cursor: 'pointer', mb: 4, transition: 'border-color 0.15s',
                              '&:hover': { borderColor: '#111827' } }}>
                        <Typography sx={{ fontSize: '2rem', mb: 1.5 }}>📋</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827', mb: 1 }}>
                            Upload Monthly Inventory
                        </Typography>
                        <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', fontWeight: 300, lineHeight: 1.7, mb: 2.5, maxWidth: 420, mx: 'auto' }}>
                            Upload your pharmacy's monthly drug sales and inventory CSV. Required by Drug Control Department regulations.
                        </Typography>
                        <Button variant="contained" component={Link} to="/pharmacy/upload"
                            sx={{ borderRadius: '999px', backgroundColor: '#111827', px: 4, '&:hover': { backgroundColor: '#1f2937' } }}
                            onClick={e => e.stopPropagation()}>
                            Upload Now →
                        </Button>
                    </Paper>
                </>
            )}

            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Recent Uploads</Typography>
                    <Typography component={Link} to="/pharmacy/uploads"
                        sx={{ fontSize: '0.82rem', color: '#6b7280', textDecoration: 'none', '&:hover': { color: '#111827' } }}>
                        View all →
                    </Typography>
                </Box>
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                            {['Period','Upload Date','Rows','NSQ Matches','Actions'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                            ))}
                        </TableRow></TableHead>
                        <TableBody>
                            {sessionList.length === 0 ? (
                                <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: '#9ca3af' }}>No uploads yet.</TableCell></TableRow>
                            ) : sessionList.slice(0, 10).map(s => (
                                <TableRow key={s.sid} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                                        {s.month ? `${MONTHS[s.month]} ${s.year}` : '—'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.82rem', color: '#6b7280' }}>{new Date(s.date).toLocaleDateString()}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{s.rows}</TableCell>
                                    <TableCell>
                                        {s.nsq > 0
                                            ? <Typography sx={{ color: '#dc2626', fontWeight: 700, fontSize: '0.82rem' }}>⚠️ {s.nsq} NSQ</Typography>
                                            : <Typography sx={{ color: '#059669', fontSize: '0.82rem' }}>0 — SAFE</Typography>}
                                    </TableCell>
                                    <TableCell>
                                        <Button component={Link} to={`/pharmacy/uploads/${s.sid}`} size="small" variant="outlined"
                                            sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.75rem' }}>
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            </Box>

            {/* Trend Graphs Section */}
            <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid #e5e7eb' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', mb: 3 }}>Your NSQ Detection Trend</Typography>
                <TrendGraphs sections={['nsq']} />
            </Box>
        </AppLayout>
    );
};

export default PharmacyDashboard;

