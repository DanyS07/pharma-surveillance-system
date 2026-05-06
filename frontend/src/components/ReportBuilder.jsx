import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    RadioGroup,
    FormControlLabel,
    Radio,
    Select,
    MenuItem,
    TextField,
    CircularProgress,
    Alert
} from '@mui/material';
import axiosInstance from '../axiosInstance';
import { useToast } from '../utils/Toast';

const ReportBuilder = ({ open, onClose }) => {
    const showToast = useToast();
    const [scope, setScope] = useState('overall');
    const [pharmacyId, setPharmacyId] = useState('');
    const [pharmacies, setPharmacies] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [pharmaciesLoading, setPharmaciesLoading] = useState(false);
    const [error, setError] = useState('');

    // Set default dates (last 30 days)
    useEffect(() => {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        setEndDate(today.toISOString().split('T')[0]);
        setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    }, []);

    // Fetch available pharmacies
    useEffect(() => {
        if (open && scope === 'pharmacy-specific') {
            fetchPharmacies();
        }
    }, [open, scope]);

    const fetchPharmacies = async () => {
        setPharmaciesLoading(true);
        try {
            const response = await axiosInstance.get('/reports/pharmacies');
            setPharmacies(response.data.pharmacies || []);
            if (response.data.pharmacies?.length > 0) {
                setPharmacyId(response.data.pharmacies[0]._id);
            }
        } catch (err) {
            console.error('Error fetching pharmacies:', err);
            showToast('Failed to fetch pharmacies', 'error');
        } finally {
            setPharmaciesLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        // Validation
        if (scope === 'pharmacy-specific' && !pharmacyId) {
            setError('Please select a pharmacy');
            return;
        }

        if (!startDate || !endDate) {
            setError('Please select date range');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            setError('Start date must be before end date');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const payload = {
                scope,
                pharmacyId: scope === 'pharmacy-specific' ? pharmacyId : undefined,
                startDate,
                endDate
            };

            const response = await axiosInstance.get('/reports/generate', {
                params: payload,
                responseType: 'blob'
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `antibiotic_report_${new Date().getTime()}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('Report generated successfully', 'success');
            onClose();
        } catch (err) {
            console.error('Error generating report:', err);
            setError(err.response?.data?.message || 'Failed to generate report');
            showToast('Failed to generate report', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                Generate Antibiotic Report
            </DialogTitle>

            <DialogContent sx={{ pt: 2 }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {/* Scope Selection */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Report Scope
                    </Typography>
                    <RadioGroup
                        value={scope}
                        onChange={(e) => {
                            setScope(e.target.value);
                            setError('');
                        }}
                    >
                        <FormControlLabel
                            value="overall"
                            control={<Radio />}
                            label="Overall (All Assigned Pharmacies)"
                        />
                        <FormControlLabel
                            value="pharmacy-specific"
                            control={<Radio />}
                            label="Pharmacy-Specific"
                        />
                    </RadioGroup>
                </Box>

                {/* Pharmacy Selector - only show for pharmacy-specific */}
                {scope === 'pharmacy-specific' && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Select Pharmacy
                        </Typography>
                        {pharmaciesLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                <CircularProgress size={24} />
                            </Box>
                        ) : (
                            <Select
                                value={pharmacyId}
                                onChange={(e) => setPharmacyId(e.target.value)}
                                fullWidth
                                disabled={pharmacies.length === 0}
                            >
                                {pharmacies.map((pharmacy) => (
                                    <MenuItem key={pharmacy._id} value={pharmacy._id}>
                                        {pharmacy.name} {pharmacy.district ? `(${pharmacy.district})` : ''}
                                    </MenuItem>
                                ))}
                            </Select>
                        )}
                        {!pharmaciesLoading && pharmacies.length === 0 && (
                            <Typography variant="caption" color="textSecondary">
                                No pharmacies available
                            </Typography>
                        )}
                    </Box>
                )}

                {/* Date Range */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Date Range
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            label="Start Date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
                        <TextField
                            label="End Date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
                    </Box>
                    <Typography variant="caption" sx={{ color: '#9ca3af', mt: 0.5, display: 'block' }}>
                        Default: Last 30 days
                    </Typography>
                </Box>

                {/* Summary */}
                <Box sx={{
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    p: 2
                }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Report Summary
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', mb: 0.5 }}>
                        Scope: <strong>{scope === 'overall' ? 'Overall' : `Pharmacy-Specific`}</strong>
                    </Typography>
                    {scope === 'pharmacy-specific' && pharmacyId && (
                        <Typography variant="body2" sx={{ color: '#6b7280', mb: 0.5 }}>
                            Pharmacy: <strong>{pharmacies.find(p => p._id === pharmacyId)?.name}</strong>
                        </Typography>
                    )}
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                        Period: <strong>{startDate} to {endDate}</strong>
                    </Typography>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleGenerateReport}
                    variant="contained"
                    disabled={loading}
                    sx={{ backgroundColor: '#059669', '&:hover': { backgroundColor: '#047857' } }}
                >
                    {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                    {loading ? 'Generating...' : 'Generate Report'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ReportBuilder;
