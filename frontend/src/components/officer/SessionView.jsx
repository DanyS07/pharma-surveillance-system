import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Slider from '@mui/material/Slider'
import AppLayout from '../AppLayout'
import StatusBadge from '../StatusBadge'
import axiosInstance from '../../axiosInstance'

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December']

const SessionView = () => {
    const { sessionId } = useParams()
    const [records, setRecords] = useState([])
    const [sliderValue, setSliderValue] = useState(30)

    useEffect(() => {
        axiosInstance.get(`/inventory/session/${sessionId}`)
            .then(r => setRecords(r.data.records || []))
            .catch(console.error)
    }, [sessionId])

    const nsqCount = records.filter(r => r.nsqStatus === 'NSQ_CONFIRMED').length
    const probableCount = records.filter(r => r.nsqStatus === 'PROBABLE_MATCH').length
    const sample = records[0]
    const period = sample?.saleMonth ? `${MONTHS[sample.saleMonth]} ${sample.saleYear}` : ''
    const visibleRecords = records.filter(r =>
        r.nsqStatus === 'NSQ_CONFIRMED' ||
        (r.nsqStatus === 'PROBABLE_MATCH' && Number(r.similarityScore || 0) >= sliderValue)
    )

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace', mb: 0.5 }}>
                        Session: {sessionId}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                        Inventory Session {period && `- ${period}`}
                    </Typography>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>
                        {records.length} rows · {nsqCount > 0
                            ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{nsqCount} NSQ CONFIRMED</span>
                            : <span style={{ color: '#059669' }}>All SAFE</span>}
                        {probableCount > 0 && <span style={{ color: '#c2410c' }}> · {probableCount} PROBABLE MATCH</span>}
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    onClick={() => window.print()}
                    sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.85rem' }}
                >
                    Print / Export PDF
                </Button>
            </Box>

            {nsqCount > 0 && (
                <Box sx={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', px: 2.5, py: 1.8, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography sx={{ fontSize: '0.9rem', color: '#7f1d1d', fontWeight: 500 }}>
                        {nsqCount} drug batch{nsqCount !== 1 ? 'es' : ''} confirmed NSQ in this session. Immediate action required.
                    </Typography>
                </Box>
            )}

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 2.5, mb: 3 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>
                    Match Filter
                </Typography>
                <Typography sx={{ color: '#6b7280', fontSize: '0.84rem', mb: 2 }}>
                    NSQ confirmed rows stay visible. Probable matches are shown only when similarity score is at least {sliderValue}.
                </Typography>
                <Slider
                    min={30}
                    max={100}
                    step={1}
                    value={sliderValue}
                    onChange={(_, value) => setSliderValue(value)}
                    valueLabelDisplay="auto"
                    marks={[{ value: 30, label: '30' }, { value: 80, label: '80' }, { value: 100, label: '100' }]}
                />
                <Typography sx={{ color: '#9ca3af', fontSize: '0.78rem', mt: 1 }}>
                    Visible results: {visibleRecords.length}
                </Typography>
            </Paper>

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                            {['Drug Name', 'Batch No.', 'Manufacturer', 'Expiry Date', 'Qty', 'Score', 'NSQ Status'].map(header => (
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
                        {visibleRecords.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 5, color: '#9ca3af' }}>
                                    No NSQ confirmed or probable matches meet the current slider filter.
                                </TableCell>
                            </TableRow>
                        ) : visibleRecords.map(record => (
                            <TableRow
                                key={record._id}
                                sx={{
                                    backgroundColor: record.nsqStatus === 'NSQ_CONFIRMED' ? '#fff5f5' : 'inherit',
                                    '&:hover': { backgroundColor: record.nsqStatus === 'NSQ_CONFIRMED' ? '#fee2e2' : '#f9fafb' },
                                    '&:last-child td': { border: 0 },
                                }}
                            >
                                <TableCell sx={{ fontWeight: record.nsqStatus === 'NSQ_CONFIRMED' ? 700 : 400, fontSize: '0.88rem' }}>
                                    {record.drugName}
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{record.batchNumber}</TableCell>
                                <TableCell sx={{ color: '#6b7280', fontSize: '0.82rem' }}>{record.manufacturer || '-'}</TableCell>
                                <TableCell sx={{ fontSize: '0.78rem', color: '#9ca3af' }}>{record.expiryDate || '-'}</TableCell>
                                <TableCell sx={{ fontSize: '0.85rem' }}>{record.quantity}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                    {typeof record.similarityScore === 'number' ? record.similarityScore.toFixed(2) : '-'}
                                </TableCell>
                                <TableCell><StatusBadge status={record.nsqStatus} /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </AppLayout>
    )
}

export default SessionView
