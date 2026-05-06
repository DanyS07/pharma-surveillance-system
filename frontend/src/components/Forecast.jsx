import React, { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import axiosInstance from '../axiosInstance'
import { useToast } from '../utils/Toast'
import AppLayout from './AppLayout'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
} from 'recharts'

const RISK_STYLES = {
    CRITICAL: { backgroundColor: '#fee2e2', color: '#991b1b' },
    HIGH: { backgroundColor: '#ffedd5', color: '#c2410c' },
    MEDIUM: { backgroundColor: '#fef3c7', color: '#92400e' },
    LOW: { backgroundColor: '#d1fae5', color: '#047857' },
}

const CADENCES = ['Auto', 'Daily', 'Monthly']
const RISK_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const formatAxisDate = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
}

const formatTimestamp = (value) => {
    if (!value) return 'Never run'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Never run'
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

const formatQuantity = (value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '-'
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const getRiskLevel = (row) => row?.risk_level || row?.risk || row?.riskLevel || 'LOW'
const getDrugName = (row) => row?.drug_name || row?.drugName || row?.drug || '-'
const getPharmacyId = (row) => row?.pharmacy_id || row?.pharmacyId || row?.pharmacy || ''
const getModelName = (row) => row?.model || row?.model_name || row?.algorithm || 'ARIMA'
const getCadence = (row, fallback) => row?.cadence || fallback || 'Auto'
const getHorizon = (row) => row?.forecast_horizon || row?.horizon || row?.forecastHorizon || '-'

const normalizeChartPoints = (row) => {
    const points = []

    ;(row?.history || row?.historical || []).forEach((point) => {
        points.push({
            date: point.date || point.period || point.month,
            historical: Number(point.value ?? point.quantity ?? point.quantity_sold) || 0,
            forecast: null,
        })
    })

    ;(row?.forecast_points || row?.forecast || row?.forecastPoints || []).forEach((point) => {
        points.push({
            date: point.date || point.period || point.month,
            historical: null,
            forecast: Number(point.value ?? point.quantity ?? point.predicted) || 0,
        })
    })

    return points
        .filter((point) => point.date)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
}

const RiskBadge = ({ level }) => (
    <Chip
        size="small"
        label={level}
        sx={{
            minWidth: 74,
            borderRadius: '999px',
            fontWeight: 800,
            fontSize: '0.7rem',
            ...RISK_STYLES[level],
        }}
    />
)

const EmptyRow = ({ colSpan, message }) => (
    <TableRow>
        <TableCell colSpan={colSpan} sx={{ textAlign: 'center', py: 4, color: '#9ca3af', fontSize: '0.88rem' }}>
            {message}
        </TableCell>
    </TableRow>
)

const Forecast = () => {
    const stored = JSON.parse(localStorage.getItem('pharma_user') || '{}')
    const role = stored.role || ''
    const isAdmin = role === 'admin'
    const isOfficer = role === 'officer'
    const showToast = useToast()

    const [loading, setLoading] = useState(false)
    const [pharmacies, setPharmacies] = useState([])
    const [antibioticReferences, setAntibioticReferences] = useState([])
    const [selectedPharmacyScope, setSelectedPharmacyScope] = useState('')
    const [cadence, setCadence] = useState('Auto')
    const [runState, setRunState] = useState({ status: 'Idle', lastRunAt: null })
    const [data, setData] = useState({ pharmacyResults: [], areaResults: [], summary: {} })
    const [filters, setFilters] = useState({ drug: '', risk: '' })
    const [selectedRowKey, setSelectedRowKey] = useState('')

    useEffect(() => {
        const loadPharmacies = async () => {
            try {
                if (isAdmin) {
                    const response = await axiosInstance.get('/pharmacy/all')
                    setPharmacies(response.data.pharmacies || [])
                } else if (isOfficer) {
                    const response = await axiosInstance.get('/pharmacy/my-pharmacies')
                    setPharmacies(response.data.pharmacies || [])
                }
            } catch (err) {
                showToast(err.response?.data?.message || 'Failed to load pharmacies', 'error')
            }
        }

        loadPharmacies()
    }, [isAdmin, isOfficer, showToast])

    useEffect(() => {
        const loadAntibioticReferences = async () => {
            try {
                const response = await axiosInstance.get('/api/antibiotic/reference')
                setAntibioticReferences(response.data.drugs || [])
            } catch (err) {
                showToast(err.response?.data?.message || 'Failed to load antibiotic reference drugs', 'error')
            }
        }

        loadAntibioticReferences()
    }, [showToast])

    const pharmacyNameMap = useMemo(() => {
        const map = new Map()
        ;(pharmacies || []).forEach((pharmacy) => {
            map.set(String(pharmacy._id || '').toLowerCase(), pharmacy.name || '')
        })
        if (stored?.id && stored?.name) {
            map.set(String(stored.id).toLowerCase(), stored.name)
        }
        return map
    }, [pharmacies, stored?.id, stored?.name])

    const resolvePharmacyName = (pharmacyId) => {
        const key = String(pharmacyId || '').toLowerCase()
        return pharmacyNameMap.get(key) || String(pharmacyId || '-')
    }

    const rowKey = (row, index) => `${getPharmacyId(row) || 'area'}-${getDrugName(row)}-${index}`

    const runForecast = async () => {
        setLoading(true)
        setRunState((prev) => ({ ...prev, status: 'Running' }))

        try {
            const params = {
                cadence: cadence.toLowerCase(),
            }

            if ((isAdmin || isOfficer) && selectedPharmacyScope) {
                params.pharmacyId = selectedPharmacyScope
            }

            const response = await axiosInstance.get('/analytics/risk-forecast', { params })
            const pharmacyResults = response.data.pharmacyResults || []
            const areaResults = response.data.areaResults || []

            setData({
                pharmacyResults,
                areaResults,
                summary: response.data.summary || {},
            })
            setRunState({ status: 'Done', lastRunAt: response.data.generatedAt || new Date().toISOString() })
            setSelectedRowKey(pharmacyResults.length > 0 ? rowKey(pharmacyResults[0], 0) : '')
        } catch (err) {
            setRunState({ status: 'Failed', lastRunAt: new Date().toISOString() })
            showToast(err.response?.data?.message || 'Forecast run failed', 'error')
        } finally {
            setLoading(false)
        }
    }

    const filteredRows = useMemo(() => {
        return data.pharmacyResults.filter((row) => {
            const drugMatches = !filters.drug ||
                getDrugName(row).toLowerCase().includes(filters.drug.toLowerCase()) ||
                String(row.antibioticMatch || '').toLowerCase().includes(filters.drug.toLowerCase())
            const riskMatches = !filters.risk || getRiskLevel(row) === filters.risk
            return drugMatches && riskMatches
        })
    }, [data.pharmacyResults, filters])

    const selectedRow = useMemo(() => {
        if (!selectedRowKey) return filteredRows[0] || null
        return filteredRows.find((row, index) => rowKey(row, index) === selectedRowKey) || filteredRows[0] || null
    }, [filteredRows, selectedRowKey])

    const chartData = useMemo(() => normalizeChartPoints(selectedRow), [selectedRow])
    const statusColor = runState.status === 'Failed' ? '#dc2626' : runState.status === 'Running' ? '#d97706' : '#059669'

    const summaryItems = [
        { label: 'Forecasted Groups', value: data.summary.totalGroups || filteredRows.length, color: '#111827' },
        { label: 'Critical / High', value: (data.summary.criticalRisk || 0) + (data.summary.highRisk || 0), color: '#dc2626' },
        { label: 'Monitor', value: data.summary.monitored || 0, color: '#d97706' },
    ]

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, mb: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Forecast Dashboard</Typography>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>
                        {isAdmin ? 'All-pharmacy risk forecast view' : 'Assigned pharmacies risk forecast view'}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel id="forecast-cadence-label">Cadence</InputLabel>
                        <Select
                            labelId="forecast-cadence-label"
                            value={cadence}
                            label="Cadence"
                            onChange={(event) => setCadence(event.target.value)}
                        >
                            {CADENCES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button
                        variant="contained"
                        onClick={runForecast}
                        disabled={loading}
                        sx={{ minHeight: 40, borderRadius: '10px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}
                    >
                        {loading ? 'Running...' : 'Run Forecast'}
                    </Button>
                </Box>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 2.5, mb: 3 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr)) auto' }, gap: 2, alignItems: 'center' }}>
                    {summaryItems.map((item) => (
                        <Box key={item.label}>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{item.label}</Typography>
                            <Typography sx={{ fontSize: '1.55rem', fontWeight: 800, color: item.color }}>{item.value}</Typography>
                        </Box>
                    ))}
                    <Box>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Last Run</Typography>
                        <Typography sx={{ fontSize: '0.86rem', fontWeight: 700 }}>{formatTimestamp(runState.lastRunAt)}</Typography>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: statusColor }}>{runState.status}</Typography>
                    </Box>
                </Box>
            </Paper>

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', mb: 3 }}>
                <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                    <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>Risk Summary</Typography>
                        <Typography sx={{ color: '#6b7280', fontSize: '0.84rem' }}>
                            {isAdmin ? 'Admin access includes all pharmacies.' : 'Officer access is scoped to assigned pharmacies.'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {(isAdmin || isOfficer) && (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel id="forecast-scope-label">Run Scope</InputLabel>
                                <Select
                                    labelId="forecast-scope-label"
                                    value={selectedPharmacyScope}
                                    label="Run Scope"
                                    displayEmpty
                                    renderValue={(selected) => {
                                        if (!selected) return isOfficer ? 'All Assigned Pharmacies' : 'All Pharmacies'
                                        const match = pharmacies.find((pharmacy) => String(pharmacy._id) === String(selected))
                                        return match?.name || (isOfficer ? 'All Assigned Pharmacies' : 'All Pharmacies')
                                    }}
                                    onChange={(event) => setSelectedPharmacyScope(event.target.value)}
                                >
                                    <MenuItem value="">{isOfficer ? 'All Assigned Pharmacies' : 'All Pharmacies'}</MenuItem>
                                    {pharmacies.map((pharmacy) => (
                                        <MenuItem key={pharmacy._id} value={pharmacy._id}>{pharmacy.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                        <FormControl size="small" sx={{ minWidth: 240 }}>
                            <InputLabel id="forecast-drug-filter-label">Drug Name</InputLabel>
                            <Select
                                labelId="forecast-drug-filter-label"
                                value={filters.drug}
                                label="Drug Name"
                                onChange={(event) => setFilters((prev) => ({ ...prev, drug: event.target.value }))}
                            >
                                <MenuItem value="">All Reference Drugs</MenuItem>
                                {antibioticReferences.map((drug) => (
                                    <MenuItem key={drug.id || drug.drugName} value={drug.drugName}>
                                        {drug.drugName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel id="forecast-risk-filter-label">Risk</InputLabel>
                            <Select
                                labelId="forecast-risk-filter-label"
                                value={filters.risk}
                                label="Risk"
                                onChange={(event) => setFilters((prev) => ({ ...prev, risk: event.target.value }))}
                            >
                                <MenuItem value="">All Risks</MenuItem>
                                {RISK_LEVELS.map((risk) => <MenuItem key={risk} value={risk}>{risk}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setFilters({ drug: '', risk: '' })}
                            disabled={!filters.drug && !filters.risk}
                            sx={{ minHeight: 40, borderRadius: '10px', borderColor: '#e5e7eb', color: '#6b7280' }}
                        >
                            Clear Filters
                        </Button>
                    </Box>
                </Box>

                <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #e5e7eb', backgroundColor: '#fcfcfd' }}>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.82rem' }}>
                        Showing {filteredRows.length} of {data.pharmacyResults.length} forecast rows
                    </Typography>
                </Box>

                <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 1040 }}>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                {['Pharmacy', 'Drug', 'Recent Avg', 'Predicted Avg', 'Risk', 'Model', 'Cadence', 'Horizon'].map((header) => (
                                    <TableCell key={header} sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', py: 1.5 }}>{header}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={22} /></TableCell>
                                </TableRow>
                            ) : filteredRows.length === 0 ? (
                                <EmptyRow colSpan={8} message="No forecast rows match the selected filters." />
                            ) : filteredRows.map((row, index) => {
                                const key = rowKey(row, index)
                                const active = selectedRow && key === rowKey(selectedRow, filteredRows.indexOf(selectedRow))
                                return (
                                    <TableRow
                                        key={key}
                                        hover
                                        onClick={() => setSelectedRowKey(key)}
                                        sx={{
                                            cursor: 'pointer',
                                            backgroundColor: active ? '#f9fafb' : 'transparent',
                                            '&:last-child td': { border: 0 },
                                        }}
                                    >
                                        <TableCell sx={{ fontWeight: 700 }}>{resolvePharmacyName(getPharmacyId(row))}</TableCell>
                                        <TableCell>{getDrugName(row)}</TableCell>
                                        <TableCell>{formatQuantity(row.recent_avg ?? row.recentAvg)}</TableCell>
                                        <TableCell>{formatQuantity(row.predicted_avg ?? row.predictedAvg)}</TableCell>
                                        <TableCell><RiskBadge level={getRiskLevel(row)} /></TableCell>
                                        <TableCell>{getModelName(row)}</TableCell>
                                        <TableCell>{getCadence(row, cadence)}</TableCell>
                                        <TableCell>{getHorizon(row)}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </Box>
            </Paper>

            {(isAdmin || isOfficer) && (
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', mb: 3 }}>
                    <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>Area-Wide Combined Forecast</Typography>
                        <Typography sx={{ color: '#6b7280', fontSize: '0.84rem' }}>
                            {isAdmin ? 'Combined risk across all visible pharmacies.' : 'Read-only combined view for assigned pharmacies.'}
                        </Typography>
                    </Box>
                    <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 820 }}>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                    {['Drug', 'Predicted Avg', 'Risk', 'Model', 'Cadence', 'Horizon'].map((header) => (
                                        <TableCell key={header} sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', py: 1.5 }}>{header}</TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.areaResults.length === 0 ? (
                                    <EmptyRow colSpan={6} message="No combined forecast rows available." />
                                ) : data.areaResults.map((row, index) => {
                                    const risk = getRiskLevel(row)
                                    return (
                                        <TableRow key={`${getDrugName(row)}-${index}`} sx={{ '&:last-child td': { border: 0 } }}>
                                            <TableCell sx={{ fontWeight: 700 }}>{getDrugName(row)}</TableCell>
                                            <TableCell>{formatQuantity(row.predicted_avg ?? row.predictedAvg)}</TableCell>
                                            <TableCell><RiskBadge level={risk} /></TableCell>
                                            <TableCell>{getModelName(row)}</TableCell>
                                            <TableCell>{getCadence(row, cadence)}</TableCell>
                                            <TableCell>{getHorizon(row)}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </Box>
                </Paper>
            )}

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: { xs: 2, md: 2.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, mb: 2 }}>
                    <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>Forecast Chart</Typography>
                        <Typography sx={{ color: '#6b7280', fontSize: '0.84rem' }}>
                            {selectedRow ? `${resolvePharmacyName(getPharmacyId(selectedRow))} - ${getDrugName(selectedRow)}` : 'Select a risk row to inspect the trend.'}
                        </Typography>
                    </Box>
                    {selectedRow && <RiskBadge level={getRiskLevel(selectedRow)} />}
                </Box>

                {chartData.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center', color: '#9ca3af' }}>
                        <Typography>No chart points available for the selected pharmacy and drug.</Typography>
                    </Box>
                ) : (
                    <Box sx={{ width: '100%', height: { xs: 300, md: 430 } }}>
                        <ResponsiveContainer>
                            <LineChart data={chartData} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" />
                                <XAxis dataKey="date" tickFormatter={formatAxisDate} minTickGap={32} />
                                <YAxis />
                                <Tooltip
                                    labelFormatter={(label) => formatAxisDate(label)}
                                    formatter={(value, name) => [formatQuantity(value), name === 'historical' ? 'Historical Quantity' : 'ARIMA Forecast']}
                                    contentStyle={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="historical" name="Historical Quantity" stroke="#2563eb" strokeWidth={3} dot={false} connectNulls={false} />
                                <Line type="monotone" dataKey="forecast" name="ARIMA Forecast" stroke="#dc2626" strokeWidth={3} strokeDasharray="8 6" dot={false} connectNulls={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </Box>
                )}
            </Paper>
        </AppLayout>
    )
}

export default Forecast
