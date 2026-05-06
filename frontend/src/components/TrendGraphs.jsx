import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import axiosInstance from '../axiosInstance'
import { useToast } from '../utils/Toast'

const TrendGraphs = ({ sections = ['nsq', 'alerts', 'antibiotic', 'forecast'] }) => {
    const showToast = useToast()
    const [nsqData, setNsqData] = useState([])
    const [alertsData, setAlertsData] = useState([])
    const [antibioticData, setAntibioticData] = useState([])
    const [forecastData, setForecastData] = useState({ pharmacyResults: [], areaResults: [], summary: {} })
    const [loading, setLoading] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const visibleSections = new Set(sections)

    const riskChipStyles = {
        CRITICAL: { backgroundColor: '#fee2e2', color: '#991b1b' },
        HIGH: { backgroundColor: '#ffedd5', color: '#c2410c' },
        MEDIUM: { backgroundColor: '#fef3c7', color: '#b45309' },
        LOW: { backgroundColor: '#d1fae5', color: '#047857' },
    }

    const fetchTrendData = async () => {
        setLoading(true)
        try {
            const [nsq, alerts, antibiotic, forecast] = await Promise.all([
                axiosInstance.get('/analytics/nsq-detected-trend'),
                axiosInstance.get('/analytics/alerts-trend', { params: { month: 'all' } }),
                axiosInstance.get('/analytics/antibiotic-trend', { params: { month: 'all' } }),
                axiosInstance.get('/analytics/risk-forecast'),
            ])

            setNsqData(nsq.data.data || [])
            setAlertsData(alerts.data.data || [])
            setAntibioticData(antibiotic.data.data || [])
            setForecastData({
                pharmacyResults: forecast.data?.pharmacyResults || [],
                areaResults: forecast.data?.areaResults || [],
                summary: forecast.data?.summary || {},
            })
            setHasLoaded(true)
        } catch (err) {
            if (err.response?.status === 401) {
                showToast('Session check failed while loading trends. Please refresh or sign in again.', 'error')
                return
            }

            showToast(err.response?.data?.message || 'Error fetching trends', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTrendData()
    }, [])

    const TrendSection = ({ title, data, emptyMessage = 'No data available' }) => (
        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>{title}</Typography>

            {data && data.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '0.75rem' }} />
                        <YAxis stroke="#9ca3af" style={{ fontSize: '0.75rem' }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                            labelStyle={{ color: '#111827' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '0.85rem' }} />
                        {data[0]?.confirmed !== undefined && <Bar dataKey="confirmed" name="NSQ Confirmed" fill="#dc2626" />}
                        {data[0]?.probable !== undefined && <Bar dataKey="probable" name="Probable Match" fill="#f59e0b" />}
                        {data[0]?.quantity !== undefined && <Bar dataKey="quantity" name="Quantity Sold" fill="#2563eb" />}
                        {data[0]?.records !== undefined && <Bar dataKey="records" name="Sale Records" fill="#7c3aed" />}
                        {data[0]?.OPEN !== undefined && <Bar dataKey="OPEN" fill="#dc2626" />}
                        {data[0]?.INVESTIGATING !== undefined && <Bar dataKey="INVESTIGATING" fill="#d97706" />}
                        {data[0]?.RESOLVED !== undefined && <Bar dataKey="RESOLVED" fill="#059669" />}
                        {data[0]?.highRisk !== undefined && <Bar dataKey="highRisk" name="High Risk" fill="#dc2626" />}
                        {data[0]?.mediumRisk !== undefined && <Bar dataKey="mediumRisk" name="Medium Risk" fill="#f59e0b" />}
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: '#9ca3af' }}>
                    <Typography>{emptyMessage}</Typography>
                </Box>
            )}
        </Paper>
    )

    const ForecastSection = ({ title, rows, emptyMessage = 'No forecast data available' }) => (
        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 1 }}>{title}</Typography>
            <Typography sx={{ color: '#6b7280', fontSize: '0.85rem', mb: 2 }}>
                Forecasting uses historical sales periods to estimate near-term risk.
            </Typography>

            {rows && rows.length > 0 ? (
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase' }}>Pharmacy</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase' }}>Drug</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase' }}>Recent Avg</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase' }}>Forecast Avg</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase' }}>Risk</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row, index) => (
                            <TableRow key={`${row.pharmacy_id || 'area'}-${row.drug_name || 'drug'}-${index}`} sx={{ '&:last-child td': { border: 0 } }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{row.pharmacy_id || 'All Pharmacies'}</TableCell>
                                <TableCell sx={{ fontSize: '0.88rem' }}>{row.drug_name}</TableCell>
                                <TableCell sx={{ fontSize: '0.88rem', color: '#6b7280' }}>{Number(row.recent_avg || 0).toFixed(2)}</TableCell>
                                <TableCell sx={{ fontSize: '0.88rem', color: '#6b7280' }}>{Number(row.predicted_avg || 0).toFixed(2)}</TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        label={row.risk_level}
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: '0.72rem',
                                            borderRadius: '999px',
                                            ...riskChipStyles[row.risk_level],
                                        }}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: '#9ca3af' }}>
                    <Typography>{emptyMessage}</Typography>
                </Box>
            )}
        </Paper>
    )

    const ForecastOverview = () => {
        const riskDistribution = [
            { risk: 'Critical', count: forecastData.summary.criticalRisk || 0, fill: '#dc2626' },
            { risk: 'High', count: forecastData.summary.highRisk || 0, fill: '#f97316' },
            { risk: 'Medium', count: forecastData.summary.mediumRisk || 0, fill: '#f59e0b' },
            { risk: 'Low', count: forecastData.summary.lowRisk || 0, fill: '#059669' },
        ]

        const topAreaRisks = (forecastData.areaResults || [])
            .slice()
            .sort((a, b) => Number(b.predicted_avg || 0) - Number(a.predicted_avg || 0))
            .slice(0, 8)
            .map(row => ({
                drug: row.drug_name || row.drugName || row.drug || 'Unknown',
                predicted: Number(row.predicted_avg || row.predictedAvg || 0),
                risk: row.risk_level || row.risk || 'LOW',
            }))

        const hasRiskCounts = riskDistribution.some(item => item.count > 0)
        const hasTopRisks = topAreaRisks.length > 0

        return (
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.5 }}>Risk Forecast Overview</Typography>
                        <Typography sx={{ color: '#6b7280', fontSize: '0.85rem' }}>
                            Admin snapshot of predicted antibiotic risk across pharmacies.
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Box>
                            <Typography sx={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>Forecast Groups</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem' }}>{forecastData.summary.totalGroups || 0}</Typography>
                        </Box>
                        <Box>
                            <Typography sx={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>Monitor</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: '#d97706' }}>{forecastData.summary.monitored || 0}</Typography>
                        </Box>
                    </Box>
                </Box>

                {!hasRiskCounts && !hasTopRisks ? (
                    <Box sx={{ textAlign: 'center', py: 4, color: '#9ca3af' }}>
                        <Typography>No forecast overview data available.</Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.85fr 1.15fr' }, gap: 3 }}>
                        <Box sx={{ height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={riskDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="risk" stroke="#9ca3af" style={{ fontSize: '0.75rem' }} />
                                    <YAxis allowDecimals={false} stroke="#9ca3af" style={{ fontSize: '0.75rem' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                                        formatter={(value) => [value, 'Forecast groups']}
                                    />
                                    <Bar dataKey="count" name="Forecast Groups" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>

                        <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: 520 }}>
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                        {['Drug', 'Predicted Avg', 'Risk'].map(header => (
                                            <TableCell key={header} sx={{ fontWeight: 600, fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase' }}>{header}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {topAreaRisks.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} sx={{ textAlign: 'center', py: 4, color: '#9ca3af' }}>No area-wide forecast rows available.</TableCell>
                                        </TableRow>
                                    ) : topAreaRisks.map((row, index) => (
                                        <TableRow key={`${row.drug}-${index}`} sx={{ '&:last-child td': { border: 0 } }}>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '0.86rem' }}>{row.drug}</TableCell>
                                            <TableCell sx={{ color: '#6b7280', fontSize: '0.86rem' }}>{row.predicted.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={row.risk}
                                                    sx={{
                                                        fontWeight: 700,
                                                        fontSize: '0.72rem',
                                                        borderRadius: '999px',
                                                        ...riskChipStyles[row.risk],
                                                    }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    </Box>
                )}
            </Paper>
        )
    }

    return (
        <Box>
            {!hasLoaded && !loading ? null : loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {visibleSections.has('nsq') && <TrendSection title="NSQ Detected Trend" data={nsqData} />}
                    {visibleSections.has('alerts') && <TrendSection title="Alerts Trend" data={alertsData} />}
                    {visibleSections.has('antibiotic') && (
                        <TrendSection
                            title="Antibiotic Sales Trend"
                            data={antibioticData}
                            emptyMessage="No antibiotic matches found across uploaded sales."
                        />
                    )}
                    {visibleSections.has('forecastOverview') && <ForecastOverview />}
                    {visibleSections.has('forecast') && (
                        <>
                            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 1 }}>Risk Forecast Summary</Typography>
                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    <Box>
                                        <Typography sx={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Forecasted Groups</Typography>
                                        <Typography sx={{ fontWeight: 800, fontSize: '1.4rem' }}>{forecastData.summary.totalGroups || 0}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>High / Critical</Typography>
                                        <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#dc2626' }}>
                                            {(forecastData.summary.highRisk || 0) + (forecastData.summary.criticalRisk || 0)}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monitor</Typography>
                                        <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#d97706' }}>{forecastData.summary.monitored || 0}</Typography>
                                    </Box>
                                </Box>
                            </Paper>
                            <ForecastSection title="Per-Pharmacy Risk Forecast" rows={forecastData.pharmacyResults} />
                            <ForecastSection title="Area-Level Risk Forecast" rows={forecastData.areaResults} emptyMessage="No area-level forecast data available" />
                        </>
                    )}
                </>
            )}
        </Box>
    )
}

export default TrendGraphs
