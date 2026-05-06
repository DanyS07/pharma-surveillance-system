import React, { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import AppLayout from '../AppLayout'
import StatusBadge from '../StatusBadge'
import axiosInstance from '../../axiosInstance'

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PharmacyDetail = () => {
    const { id } = useParams()
    const location = useLocation()
    const [sessionList, setSessionList] = useState([])
    const [alerts, setAlerts] = useState([])
    const isAdminView = location.pathname.startsWith('/admin')
    const backPath = isAdminView ? '/admin/pharmacies' : '/officer/pharmacies'
    const sessionBasePath = isAdminView ? '/admin/session' : '/officer/session'

    useEffect(() => {
        Promise.all([
            axiosInstance.get(`/pharmacy/${id}/inventory`, { params: { summary: true } }),
            axiosInstance.get(`/pharmacy/${id}/alerts`),
        ])
            .then(([inv, al]) => {
                setSessionList(inv.data.sessions || [])
                setAlerts(al.data.alerts || [])
            })
            .catch(console.error)
    }, [id])

    return (
        <AppLayout>
            <Box sx={{ mb: 3.5 }}>
                <Typography
                    component={Link}
                    to={backPath}
                    sx={{ fontSize: '0.82rem', color: '#9ca3af', textDecoration: 'none', '&:hover': { color: '#111827' } }}
                >
                    Back to pharmacies
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mt: 1 }}>
                    Pharmacy Inventory
                </Typography>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>
                    Upload Sessions
                </Typography>
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                {['Session ID', 'Period', 'Rows', 'NSQ Matches', 'Actions'].map(header => (
                                    <TableCell
                                        key={header}
                                        sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}
                                    >
                                        {header}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sessionList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: '#9ca3af' }}>
                                        No inventory uploaded yet.
                                    </TableCell>
                                </TableRow>
                            ) : sessionList.map(session => {
                                const period = session.saleMonth
                                    ? `${MONTHS[session.saleMonth]} ${session.saleYear}`
                                    : new Date(session.date).toLocaleDateString()

                                return (
                                    <TableRow key={session.sessionId} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9ca3af' }}>
                                            {session.sessionId.slice(0, 18)}...
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{period}</TableCell>
                                        <TableCell sx={{ fontSize: '0.85rem' }}>{session.rows}</TableCell>
                                        <TableCell>
                                            {session.nsqCount > 0
                                                ? <Typography sx={{ color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>{session.nsqCount} NSQ</Typography>
                                                : <Typography sx={{ color: '#059669', fontSize: '0.85rem' }}>0 - Safe</Typography>}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                component={Link}
                                                to={`${sessionBasePath}/${session.sessionId}`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.75rem' }}
                                            >
                                                View Session
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            </Box>

            <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>
                    Alerts for this Pharmacy
                </Typography>
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                {['Drug', 'Batch No.', 'Status', 'Date'].map(header => (
                                    <TableCell
                                        key={header}
                                        sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}
                                    >
                                        {header}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {alerts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: '#9ca3af' }}>
                                        No alerts for this pharmacy.
                                    </TableCell>
                                </TableRow>
                            ) : alerts.map(alert => (
                                <TableRow key={alert._id} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{alert.drugName}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{alert.batchNumber}</TableCell>
                                    <TableCell><StatusBadge status={alert.status} /></TableCell>
                                    <TableCell sx={{ fontSize: '0.78rem', color: '#9ca3af' }}>{new Date(alert.createdAt).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            </Box>
        </AppLayout>
    )
}

export default PharmacyDetail
