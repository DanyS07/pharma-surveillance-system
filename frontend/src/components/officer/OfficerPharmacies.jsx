import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead'; import TableRow from '@mui/material/TableRow';
import AppLayout from '../AppLayout'; import StatusBadge from '../StatusBadge'; import axiosInstance from '../../axiosInstance';

const OfficerPharmacies = () => {
    const [pharmacies, setPharmacies] = useState([]);
    useEffect(() => { axiosInstance.get('/pharmacy/my-pharmacies').then(r => setPharmacies(r.data.pharmacies || [])).catch(console.error); }, []);

    return (
        <AppLayout>
            <Box sx={{ mb: 3.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>My Pharmacies</Typography>
                <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>Pharmacies assigned to your account</Typography>
            </Box>
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                        {['Pharmacy Name','License No.','District','Status','Actions'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                        ))}
                    </TableRow></TableHead>
                    <TableBody>
                        {pharmacies.length === 0 ? (
                            <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: '#9ca3af' }}>No pharmacies assigned yet.</TableCell></TableRow>
                        ) : pharmacies.map(p => (
                            <TableRow key={p._id} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.name}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#6b7280' }}>{p.licenseNumber}</TableCell>
                                <TableCell sx={{ fontSize: '0.85rem' }}>{p.district}</TableCell>
                                <TableCell><StatusBadge status={p.status} /></TableCell>
                                <TableCell>
                                    <Button component={Link} to={`/officer/pharmacies/${p._id}`} size="small" variant="outlined"
                                        sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.75rem' }}>
                                        View Inventory
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

export default OfficerPharmacies;
