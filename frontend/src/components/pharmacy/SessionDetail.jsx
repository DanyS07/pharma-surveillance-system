import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { useToast } from '../../utils/Toast'

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December']

const SessionDetail = () => {
    const { sessionId } = useParams()
    const showToast = useToast()
    const [records, setRecords] = useState([])
    const [sliderValue, setSliderValue] = useState(30)
    const [downloadingReport, setDownloadingReport] = useState(false)

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

    const formatDate = (value) => {
        if (!value) return '-'
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
    }

    const getReportErrorMessage = async (err) => {
        const data = err.response?.data
        if (data instanceof Blob) {
            const text = await data.text()
            if (text.includes('Cannot GET /reports/nsq')) {
                return 'NSQ report route is not available on the running backend. Restart the backend server and try again.'
            }
            try {
                return JSON.parse(text).message || text
            } catch (_) {
                return text || 'Could not generate NSQ report. Please try again.'
            }
        }
        return data?.message || 'Could not generate NSQ report. Please try again.'
    }

    const saveReportBlob = (blob) => {
        const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `nsq_detection_${sample?.saleYear || 'session'}_${String(sample?.saleMonth || '').padStart(2, '0')}.pdf`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
    }

    const downloadReport = async () => {
        setDownloadingReport(true)
        try {
            try {
                const response = await axiosInstance.get(`/reports/nsq/session/${sessionId}`, {
                    responseType: 'blob',
                })
                saveReportBlob(response.data)
                return
            } catch (sessionErr) {
                if (!sample?.pharmacyId || !sample?.saleMonth || !sample?.saleYear) {
                    throw sessionErr
                }
            }

            const fallback = await axiosInstance.get('/reports/nsq', {
                params: {
                    pharmacyId: sample.pharmacyId,
                    month: sample.saleMonth,
                    year: sample.saleYear,
                },
                responseType: 'blob',
            })
            saveReportBlob(fallback.data)
        } catch (err) {
            console.error(err)
            showToast(await getReportErrorMessage(err), 'error')
        } finally {
            setDownloadingReport(false)
        }
    }

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box>
                    <Typography
                        component={Link}
                        to="/pharmacy/uploads"
                        sx={{ fontSize: '0.82rem', color: '#9ca3af', textDecoration: 'none', '&:hover': { color: '#111827' } }}
                    >
                        Back to uploads
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mt: 1 }}>
                        Session Detail {period && `- ${period}`}
                    </Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9ca3af', mt: 0.3 }}>
                        {sessionId}
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    onClick={downloadReport}
                    disabled={records.length === 0 || downloadingReport}
                    sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.85rem' }}
                >
                    {downloadingReport ? 'Preparing Report...' : 'Download Report'}
                </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                {[
                    { label: 'Total Rows', value: records.length, color: '#111827' },
                    { label: 'NSQ Confirmed', value: nsqCount, color: nsqCount > 0 ? '#dc2626' : '#059669' },
                    { label: 'Probable Match', value: probableCount, color: probableCount > 0 ? '#c2410c' : '#059669' },
                    { label: 'Safe', value: records.filter(r => r.nsqStatus === 'SAFE').length, color: '#059669' },
                ].map(card => (
                    <Paper
                        key={card.label}
                        elevation={0}
                        sx={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '12px', p: '16px 20px', textAlign: 'center' }}
                    >
                        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: card.color }}>
                            {card.value}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: '#9ca3af', mt: 0.3 }}>
                            {card.label}
                        </Typography>
                    </Paper>
                ))}
            </Box>

            {nsqCount > 0 && (
                <Box sx={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', px: 2.5, py: 1.8, mb: 3 }}>
                    <Typography sx={{ color: '#7f1d1d', fontSize: '0.9rem', fontWeight: 500 }}>
                        {nsqCount} batch{nsqCount !== 1 ? 'es' : ''} confirmed NSQ. Your Drug Control Officer has been notified.
                    </Typography>
                </Box>
            )}

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 2.5, mb: 3 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>
                    Match Filter
                </Typography>
                <Typography sx={{ color: '#6b7280', fontSize: '0.84rem', mb: 2 }}>
                    Always show NSQ confirmed rows. Show probable matches only when similarity score is at least {sliderValue}.
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
                            {['Drug Name', 'Batch No.', 'Manufacturer', 'Matched NSQ Drug', 'NSQ Ban Date', 'Qty', 'Score', 'NSQ Status'].map(header => (
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
                                <TableCell sx={{ fontSize: '0.82rem', color: '#374151' }}>{record.nsqDrugName || '-'}</TableCell>
                                <TableCell sx={{ fontSize: '0.82rem', color: '#9ca3af' }}>{formatDate(record.nsqBanDate)}</TableCell>
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

export default SessionDetail
