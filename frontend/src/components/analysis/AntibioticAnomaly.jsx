import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import AppLayout from '../AppLayout'
import axiosInstance from '../../axiosInstance'

// ReportBuilder removed — reports are generated automatically or via Download button
const AntibioticAnomaly = () => {
    const stored = JSON.parse(localStorage.getItem('pharma_user') || '{}')
    const role = stored.role || ''
    const [pharmacies, setPharmacies] = useState([])
    const [pharmacyId, setPharmacyId] = useState('')
    const [loading, setLoading] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [error, setError] = useState('')
    const [data, setData] = useState({ results: [], totalCandidates: 0, filteredCount: 0 })
    const [analysis, setAnalysis] = useState(null)
    const [expandSales, setExpandSales] = useState(false)
    const [expandTrend, setExpandTrend] = useState(false)
    const [selectedMonth, setSelectedMonth] = useState('')
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [reportGenerating, setReportGenerating] = useState(false)
    const [thresholdHigh, setThresholdHigh] = useState(75)
    const [thresholdMedium, setThresholdMedium] = useState(50)

    const pharmacyNameMap = new Map(
        (pharmacies || []).map(p => {
            const id = String(p._id || p.id || '').trim()
            const name = p.name || p.pharmacy_name || p.pharmacyName || ''
            return [id.toLowerCase(), name] // Key: lowercase version
        })
    )

    // Helper to get pharmacy name
    const getPharmacyName = (pharmacyId) => {
        if (!pharmacyId) return '-'
        const cleanId = String(pharmacyId || '').trim()
        // Try exact match first (lowercase)
        const name = pharmacyNameMap.get(cleanId.toLowerCase())
        if (name) return name
        // If not found, show the ID as fallback
        return cleanId || '-'
    }

    const anomalyScoreMap = new Map()
    ;(analysis?.scored_rows || []).forEach(row => {
        const key = [
            String(row.drug_name || row.drugName || '').toLowerCase().trim(),
            String(row.pharmacy_id || row.pharmacyId || '').toLowerCase().trim(),
        ].join('|')

        const score = Number(row.anomaly_score ?? row.isolation_score ?? 0)
        if (!anomalyScoreMap.has(key) || score > anomalyScoreMap.get(key)) {
            anomalyScoreMap.set(key, score)
        }
    })

    useEffect(() => {
        const endpoint = role === 'admin' ? '/pharmacy/all' : '/pharmacy/my-pharmacies'
        axiosInstance.get(endpoint)
            .then(response => setPharmacies(response.data.pharmacies || []))
            .catch(console.error)
    }, [role])

    useEffect(() => {
        if (!pharmacyId && pharmacies.length > 0) {
            setPharmacyId(role === 'admin' ? '' : String(pharmacies[0]._id || ''))
        }
    }, [pharmacies, pharmacyId, role])

    useEffect(() => {
        setData({ results: [], totalCandidates: 0, filteredCount: 0 })
        setAnalysis(null)
    }, [pharmacyId, selectedMonth, selectedYear])

    const runAnalysis = async () => {
        if (!pharmacyId) {
            setError('Please select a pharmacy first.')
            return
        }

        setAnalyzing(true)
        setLoading(true)
        setError('')
        try {
            const candidatesResponse = await axiosInstance.post('/api/filter', {
                category: 'ANTIBIOTIC',
                pharmacyId,
                month: selectedMonth || undefined,
                year: selectedYear || undefined,
            })
            const candidateData = candidatesResponse.data || { results: [], totalCandidates: 0, filteredCount: 0 }
            const filteredResults = candidateData.results || []
            setData(candidateData)

            const response = await axiosInstance.post('/api/antibiotic/analyze', {
                results: filteredResults,
            })
            const responseData = response.data || {}

            setAnalysis({
                ...responseData,
                scored_rows: Array.isArray(responseData.scored_rows) ? responseData.scored_rows : [],
                anomalies: Array.isArray(responseData.anomalies) ? responseData.anomalies : [],
            })
        } catch (err) {
            setError(err.response?.data?.message || 'Could not run antibiotic anomaly detection.')
        } finally {
            setAnalyzing(false)
            setLoading(false)
        }
    }

    const generateAndDownloadReport = async ({ scope, pharmacyId, startDate, endDate }) => {
        setReportGenerating(true)
        try {
            // Send the current analysis and visible data to the backend so the PDF matches the UI
            const body = {
                scope,
                pharmacyId,
                startDate,
                endDate,
                analysis: analysis,
                data: data,
            }

            const resp = await axiosInstance.post('/reports/generate', body, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([resp.data]))
            const a = document.createElement('a')
            a.href = url
            a.setAttribute('download', `antibiotic_report_${new Date().getTime()}.pdf`)
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch (e) {
            console.error('Error generating report:', e)
            setError(e.response?.data?.message || e.message || 'Failed to generate report')
        } finally {
            setReportGenerating(false)
        }
    }

    const getAnomalyExplanation = row => {
        const parts = []

        // Add drug-specific factors
        if (row.antibiotic_class) {
            parts.push(`Class: ${row.antibiotic_class}`)
        }
        if (row.total_qty) {
            parts.push(`Qty: ${row.total_qty}`)
        }
        if (row.unit_price) {
            parts.push(`Unit Price: ${row.unit_price.toFixed(2)}`)
        }

        // Add drug-level rule score if available (per-drug risk)
        if (row.drug_rule_score && row.drug_rule_score > 0) {
            parts.push(`Drug Risk: ${row.drug_rule_score.toFixed(0)}`)
        }

        // Add action
        if (row.action) parts.push(`Action: ${row.action}`)

        return parts.length > 0 ? parts.join(' | ') : 'Statistical anomaly detected from sales pattern.'
    }

    // Extract pharmacy-level flags (shown once above the table)
    const getPharmacyLevelFlags = () => {
        if (!analysis?.anomalies || analysis.anomalies.length === 0) return ''
        const firstRow = analysis.anomalies[0]
        const pharmacyFlags = firstRow.pharmacy_flags || firstRow.flags || firstRow.rule_flags
        if (pharmacyFlags && pharmacyFlags !== 'none') {
            return String(pharmacyFlags)
                .split('|')
                .map(flag => flag.trim())
                .filter(Boolean)
                .join(' | ')
        }
        return ''
    }

    const getScoreStyles = score => {
        if (score === null) {
            return { color: '#6b7280', backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }
        }
        if (score >= 70) {
            return { color: '#991b1b', backgroundColor: '#fee2e2', borderColor: '#fecaca' }
        }
        if (score >= 40) {
            return { color: '#92400e', backgroundColor: '#fef3c7', borderColor: '#fde68a' }
        }
        return { color: '#065f46', backgroundColor: '#d1fae5', borderColor: '#a7f3d0' }
    }

    const getRiskLabel = row => {
        const score = Number(row.anomaly_score ?? row.isolation_score ?? 0)
        if (score >= Number(thresholdHigh)) return 'HIGH'
        if (score >= Number(thresholdMedium)) return 'MEDIUM'
        if (score > 0) return 'LOW'
        return 'NORMAL'
    }

    const getPharmacySalesData = () => {
        let sales = data.results || []
        
        if (selectedMonth || selectedYear) {
            sales = sales.filter(row => {
                const month = Number(row.month || row.saleMonth)
                const year = Number(row.year || row.saleYear)
                
                if (selectedMonth && month !== parseInt(selectedMonth)) return false
                if (selectedYear && year !== parseInt(selectedYear)) return false
                
                return true
            })
        }
        
        // Group by drug and sum quantities
        const grouped = {}
        sales.forEach(row => {
            const drug = row.drug_name || row.drugName || 'Unknown'
            if (!grouped[drug]) {
                grouped[drug] = { name: drug, quantity: 0, count: 0, avgPrice: 0, prices: [] }
            }
            grouped[drug].quantity += Number(row.quantity_sold || row.quantity || 0)
            grouped[drug].count += 1
            grouped[drug].prices.push(Number(row.unit_price || row.unitPrice || 0))
        })
        
        // Calculate average price
        Object.keys(grouped).forEach(drug => {
            const prices = grouped[drug].prices
            grouped[drug].avgPrice = prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : 0
        })
        
        return Object.values(grouped).sort((a, b) => b.quantity - a.quantity)
    }

    const getTopTenAntibiotics = () => {
        const salesData = getPharmacySalesData()
        return salesData.slice(0, 10)
    }

    const allMonths = Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: new Date(2026, i).toLocaleString('default', { month: 'long' })
    }))
    
    const allYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5, gap: 2 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Antibiotic Anomaly Detection</Typography>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.9rem', mt: 0.5 }}>
                        Select a pharmacy, month, and year, then click GO to view anomalies and sales data.
                    </Typography>
                </Box>
                <Box>
                    <Button
                        onClick={async () => {
                            const start = selectedMonth ? new Date(Number(selectedYear), Number(selectedMonth) - 1, 1) : new Date(Number(selectedYear), 0, 1)
                            const end = selectedMonth ? new Date(Number(selectedYear), Number(selectedMonth), 0) : new Date(Number(selectedYear), 11, 31)
                            await generateAndDownloadReport({ scope: 'pharmacy-specific', pharmacyId, startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] })
                        }}
                        variant="outlined"
                        disabled={!pharmacyId || reportGenerating}
                        sx={{ whiteSpace: 'nowrap' }}
                    >
                        {reportGenerating ? <CircularProgress size={18} /> : 'Download Report'}
                    </Button>
                </Box>
            </Box>
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '16px', p: 2.5, mb: 3 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '3fr 1fr 1fr 1fr auto' }, gap: 2, alignItems: 'end', mb: 2.5 }}>
                    <TextField select size="small" label="Pharmacy" value={pharmacyId} onChange={event => setPharmacyId(event.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#f9fafb' } }}>
                        {pharmacies.map(pharmacy => <MenuItem key={pharmacy._id} value={pharmacy._id}>{pharmacy.name}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#f9fafb' } }}>
                        <MenuItem value="">All Months</MenuItem>
                        {allMonths.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Year" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#f9fafb' } }}>
                        {allYears.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </TextField>
                    <Button variant="contained" onClick={runAnalysis} disabled={analyzing || loading || !pharmacyId}
                        sx={{ borderRadius: '10px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' }, minWidth: '100px' }}>
                        {analyzing ? 'Loading...' : 'GO'}
                    </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                    <TextField size="small" label="High ≥" type="number" value={thresholdHigh} onChange={e => setThresholdHigh(e.target.value)} sx={{ width: 120 }} />
                    <TextField size="small" label="Medium ≥" type="number" value={thresholdMedium} onChange={e => setThresholdMedium(e.target.value)} sx={{ width: 120 }} />
                    <Typography sx={{ color: '#6b7280', fontSize: '0.85rem' }}>Tip: risk is based on Anomaly Score.</Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
                    {[
                        { label: 'Antibiotic Records', value: data.totalCandidates || 0 },
                        { label: 'Filtered Records', value: data.filteredCount || 0 },
                    ].map(item => (
                        <Paper key={item.label} elevation={0} sx={{ border: '1px solid #eef2f7', borderRadius: '12px', p: 1.5, backgroundColor: '#fafafa' }}>
                            <Typography sx={{ fontSize: '1.1rem', fontWeight: 800 }}>{item.value}</Typography>
                            <Typography sx={{ color: '#9ca3af', fontSize: '0.72rem', mt: 0.2 }}>{item.label}</Typography>
                        </Paper>
                    ))}
                </Box>
            </Paper>

            {/* Pharmacy Sales Section */}
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', mb: 3, overflow: 'hidden' }}>
                <Box 
                    onClick={() => setExpandSales(!expandSales)}
                    sx={{ 
                        p: 2, 
                        backgroundColor: '#f9fafb', 
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        '&:hover': { backgroundColor: '#f3f4f6' }
                    }}
                >
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Pharmacy Antibiotic Sales</Typography>
                    <Typography sx={{ fontSize: '1.5rem', color: '#6b7280' }}>{expandSales ? '▼' : '▶'}</Typography>
                </Box>
                {expandSales && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                        {getPharmacySalesData().length === 0 ? (
                            <Typography sx={{ color: '#6b7280' }}>No sales data available for the selected period.</Typography>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                        {['Drug Name', 'Total Quantity', 'Transactions', 'Avg Price (₹)'].map(h => (
                                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase' }}>{h}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {getPharmacySalesData().map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</TableCell>
                                            <TableCell sx={{ fontSize: '0.85rem' }}>{item.quantity}</TableCell>
                                            <TableCell sx={{ fontSize: '0.85rem' }}>{item.count}</TableCell>
                                            <TableCell sx={{ fontSize: '0.85rem' }}>{item.avgPrice}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Box>
                )}
            </Paper>

            {/* Sales Trend - Top 10 Section */}
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', mb: 3, overflow: 'hidden' }}>
                <Box 
                    onClick={() => setExpandTrend(!expandTrend)}
                    sx={{ 
                        p: 2, 
                        backgroundColor: '#f9fafb', 
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        '&:hover': { backgroundColor: '#f3f4f6' }
                    }}
                >
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Top 10 Antibiotics - Sales Trend</Typography>
                    <Typography sx={{ fontSize: '1.5rem', color: '#6b7280' }}>{expandTrend ? '▼' : '▶'}</Typography>
                </Box>
                {expandTrend && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                        {getTopTenAntibiotics().length === 0 ? (
                            <Typography sx={{ color: '#6b7280' }}>No sales data available for the selected period.</Typography>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                        {['Rank', 'Drug Name', 'Total Quantity', 'Transactions', 'Avg Price (₹)', 'Market Share %'].map(h => (
                                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase' }}>{h}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(() => {
                                        const topTen = getTopTenAntibiotics()
                                        const totalQty = topTen.reduce((sum, item) => sum + item.quantity, 0)
                                        return topTen.map((item, idx) => (
                                            <TableRow key={idx} sx={{ backgroundColor: idx % 2 === 0 ? '#f9fafb' : 'white' }}>
                                                <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{idx + 1}</TableCell>
                                                <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</TableCell>
                                                <TableCell sx={{ fontSize: '0.85rem' }}>{item.quantity}</TableCell>
                                                <TableCell sx={{ fontSize: '0.85rem' }}>{item.count}</TableCell>
                                                <TableCell sx={{ fontSize: '0.85rem' }}>{item.avgPrice}</TableCell>
                                                <TableCell sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                                    {totalQty > 0 ? ((item.quantity / totalQty) * 100).toFixed(1) : 0}%
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    })()}
                                </TableBody>
                            </Table>
                        )}
                    </Box>
                )}
            </Paper>

            {error && <Box sx={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '12px', px: 2, py: 1.5, mb: 3 }}>
                <Typography sx={{ color: '#b91c1c', fontSize: '0.86rem' }}>{error}</Typography>
            </Box>}

            {analysis && (!analysis.anomalies || analysis.anomalies.length === 0) && (
                <Box sx={{ mb: 3 }}>
                    <Paper elevation={0} sx={{ backgroundColor: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '12px', p: 2 }}>
                        <Typography sx={{ color: '#065f46', fontWeight: 700 }}>No anomalies detected</Typography>
                        <Typography sx={{ color: '#065f46', fontSize: '0.9rem' }}>No suspicious antibiotic sales were found for the selected pharmacy.</Typography>
                    </Paper>
                </Box>
            )}

            {analysis?.anomalies?.length > 0 && (
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflowX: 'auto', mt: 3 }}>
                    <Box sx={{ px: 2, pt: 2 }}>
                        <Typography sx={{ color: '#6b7280', fontSize: '0.85rem' }}>
                            Anomaly Score indicates how strongly a row deviates from normal sales patterns. Higher scores indicate greater anomaly.
                        </Typography>
                    </Box>
                    {/* Anomaly summary banner */}
                    {(() => {
                        const scores = (analysis.anomalies || []).map(r => Number(r.anomaly_score ?? r.isolation_score ?? 0))
                        const highest = scores.length > 0 ? Math.max(...scores) : 0
                        if (!analysis.anomalies || analysis.anomalies.length === 0) return null
                        if (highest >= 70) {
                            return (
                                <Box sx={{ px: 2, pt: 1 }}>
                                    <Paper elevation={0} sx={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '12px', p: 1.5, mb: 1 }}> 
                                        <Typography sx={{ color: '#991b1b', fontWeight: 700 }}>Anomaly Detected</Typography>
                                        <Typography sx={{ color: '#7f1d1d', fontSize: '0.9rem' }}>{analysis.anomalies.length} suspicious record(s) found. Highest anomaly score: {highest.toFixed(2)}</Typography>
                                    </Paper>
                                </Box>
                            )
                        }
                        if (highest >= 40) {
                            return (
                                <Box sx={{ px: 2, pt: 1 }}>
                                    <Paper elevation={0} sx={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', p: 1.5, mb: 1 }}> 
                                        <Typography sx={{ color: '#92400e', fontWeight: 700 }}>Suspicious Activity</Typography>
                                        <Typography sx={{ color: '#78350f', fontSize: '0.9rem' }}>{analysis.anomalies.length} record(s) flagged for review. Highest anomaly score: {highest.toFixed(2)}</Typography>
                                    </Paper>
                                </Box>
                            )
                        }
                        return (
                            <Box sx={{ px: 2, pt: 1 }}>
                                <Paper elevation={0} sx={{ backgroundColor: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '12px', p: 1.5, mb: 1 }}> 
                                    <Typography sx={{ color: '#065f46', fontWeight: 700 }}>Anomalies Detected</Typography>
                                    <Typography sx={{ color: '#065f46', fontSize: '0.9rem' }}>{analysis.anomalies.length} record(s) found. Review the table for details.</Typography>
                                </Paper>
                            </Box>
                        )
                    })()}
                    {/* Pharmacy-level flags (shown once) */}
                    {(() => {
                        const flags = getPharmacyLevelFlags()
                        if (!flags) return null
                        return (
                            <Box sx={{ px: 2, pt: 1, pb: 2 }}>
                                <Paper elevation={0} sx={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '12px', p: 1.5 }}>
                                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Pharmacy-Level Risk Factors</Typography>
                                    <Typography sx={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5 }}>{flags}</Typography>
                                </Paper>
                            </Box>
                        )
                    })()}
                    <Table size="small" sx={{ minWidth: 1080 }}>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                {['Drug Name', 'Pharmacy', 'Risk', 'Anomaly Score', 'Explanation'].map(header => (
                                    <TableCell key={header} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{header}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {analysis.anomalies.map((row, index) => (
                                <TableRow key={`${row.record_id}-${index}`} sx={{ '&:hover': { backgroundColor: '#f9fafb' } }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{row.drug_name || row.drugName || '-'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.82rem', color: '#374151', fontWeight: 500 }}>
                                        {getPharmacyName(row.pharmacy_id || row.pharmacyId)}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 700 }}>
                                        {(() => {
                                            const label = getRiskLabel(row)
                                            const score = Number(row.anomaly_score ?? row.isolation_score ?? 0)
                                            const styles = getScoreStyles(score)
                                            return (
                                                <Chip label={label} size="small" sx={{ fontWeight: 800, backgroundColor: styles.backgroundColor, color: styles.color, border: '1px solid', borderColor: styles.borderColor }} />
                                            )
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        {(() => {
                                            const score = Number(row.anomaly_score || row.isolation_score || 0)
                                            const styles = getScoreStyles(score)
                                            return (
                                                <Box sx={{ fontFamily: 'monospace', fontSize: '0.8rem', display: 'inline-block', px: 1, py: 0.5, borderRadius: '8px', backgroundColor: styles.backgroundColor, color: styles.color, border: '1px solid', borderColor: styles.borderColor }}>{score.toFixed(2)}</Box>
                                            )
                                        })()}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem', color: '#374151', maxWidth: 520, whiteSpace: 'normal' }}>{getAnomalyExplanation(row)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}
            {/* ReportBuilder removed — generation is automatic after analysis or via Download Report button */}
        </AppLayout>
    )
}

export default AntibioticAnomaly
