import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead'; import TableRow from '@mui/material/TableRow';
import AppLayout from '../AppLayout'; import axiosInstance from '../../axiosInstance';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const PharmacyUploads = () => {
    const [uploads, setUploads] = useState([]);
    useEffect(() => {
        axiosInstance.get('/inventory/my-uploads')
            .then(r => {
                if (Array.isArray(r.data.uploads)) {
                    setUploads(r.data.uploads);
                    return;
                }

                const sessions = {};
                (r.data.records || []).forEach(row => {
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
                setUploads(Object.values(sessions));
            })
            .catch(console.error);
    }, []);

    const list = [...uploads].sort((a, b) =>
        (b.year - a.year) ||
        (b.month - a.month) ||
        (new Date(b.date) - new Date(a.date))
    );

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box><Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>My Uploads</Typography>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>All inventory submissions</Typography></Box>
                <Button variant="contained" component={Link} to="/pharmacy/upload"
                    sx={{ borderRadius: '999px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                    + New Upload
                </Button>
            </Box>
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                        {['Period','Upload Date','Session ID','Rows','NSQ Matches','Actions'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                        ))}
                    </TableRow></TableHead>
                    <TableBody>
                        {list.length === 0 ? (
                            <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, color: '#9ca3af' }}>
                                No uploads yet.
                                <Button component={Link} to="/pharmacy/upload" sx={{ display: 'block', mx: 'auto', mt: 1.5, color: '#111827', fontWeight: 600, fontSize: '0.85rem' }}>
                                    Upload your first inventory →
                                </Button>
                            </TableCell></TableRow>
                        ) : list.map(s => (
                            <TableRow key={s.sid} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                                    {s.month ? `${MONTHS[s.month]} ${s.year}` : '—'}
                                </TableCell>
                                <TableCell sx={{ fontSize: '0.82rem', color: '#6b7280' }}>{new Date(s.date).toLocaleDateString()}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#9ca3af' }}>{s.sid.slice(0, 20)}…</TableCell>
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
        </AppLayout>
    );
};

export default PharmacyUploads;
