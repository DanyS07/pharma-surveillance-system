import React, { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField'; import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead'; import TableRow from '@mui/material/TableRow';
import AppLayout from '../AppLayout'; import axiosInstance from '../../axiosInstance'; import { useToast } from '../../utils/Toast';

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#f9fafb' } };

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2019 }, (_, i) => 2020 + i).reverse();

const COLUMNS = [
    { col: 'drug_name',    req: true,  desc: 'Name of the drug (also accepts: drugName)' },
    { col: 'batch_number', req: true,  desc: 'Batch number as on packaging (also accepts: batchNumber)' },
    { col: 'quantity_sold',req: true,  desc: 'Units sold (also accepts: quantity)' },
    { col: 'manufacturer', req: false, desc: 'Manufacturer name' },
    { col: 'expiryDate',   req: false, desc: 'Expiry date' },
    { col: 'unit_price',   req: false, desc: 'Price per unit' },
    { col: 'record_id',    req: false, desc: 'Your internal record reference (e.g. REC0001)' },
];

const PharmacyUpload = () => {
    const showToast = useToast();
    const fileRef   = useRef();
    const [step, setStep]     = useState(1);
    const [file, setFile]     = useState(null);
    const [month, setMonth]   = useState('');
    const [year, setYear]     = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]   = useState('');

    const StepIndicator = () => (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            {[{ n: 1, label: 'Upload File' }, { n: 2, label: 'Review Results' }].map(({ n, label }, i) => (
                <React.Fragment key={n}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex',
                                   alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700,
                                   backgroundColor: step > n ? '#059669' : step === n ? '#111827' : '#f3f4f6',
                                   color: step >= n ? 'white' : '#9ca3af' }}>
                            {step > n ? '✓' : n}
                        </Box>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: step === n ? '#111827' : '#9ca3af' }}>{label}</Typography>
                    </Box>
                    {i === 0 && <Box sx={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb', mx: 1.5 }} />}
                </React.Fragment>
            ))}
        </Box>
    );

    const upload = async () => {
        if (!file)  { setError('Please select a file.'); return; }
        if (!month) { setError('Please select the reporting month.'); return; }
        if (!year)  { setError('Please select the reporting year.'); return; }
        setError(''); setLoading(true);
        const fd = new FormData();
        fd.append('file',  file);
        fd.append('month', month);   // integer string "1"–"12"
        fd.append('year',  year);    // four-digit string e.g. "2026"
        try {
            const r = await axiosInstance.post('/inventory/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setResult(r.data); setStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'Upload failed. Please try again.');
        }
        setLoading(false);
    };

    return (
        <AppLayout>
            <Box sx={{ mb: 3.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Upload Inventory</Typography>
                <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>Submit monthly drug sales data for NSQ analysis</Typography>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '16px', p: { xs: 3, md: 4 } }}>
                <StepIndicator />

                {step === 1 && (
                    <>
                        {/* Reporting period — dropdowns, not a date from the CSV */}
                        <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', mb: 1.5, color: '#374151' }}>
                            Reporting Period <span style={{ color: '#dc2626' }}>*</span>
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                            <TextField label="Month *" select value={month} onChange={e => setMonth(e.target.value)} fullWidth sx={fieldSx}>
                                {MONTH_NAMES.map((m, i) => <MenuItem key={i+1} value={String(i+1)}>{m}</MenuItem>)}
                            </TextField>
                            <TextField label="Year *" select value={year} onChange={e => setYear(e.target.value)} fullWidth sx={fieldSx}>
                                {YEARS.map(y => <MenuItem key={y} value={String(y)}>{y}</MenuItem>)}
                            </TextField>
                        </Box>

                        {/* File drop zone */}
                        <Box onClick={() => fileRef.current.click()}
                            sx={{ border: '2px dashed #e5e7eb', borderRadius: '12px', backgroundColor: '#f9fafb',
                                  p: 4, textAlign: 'center', cursor: 'pointer', mb: 3,
                                  borderColor: file ? '#059669' : '#e5e7eb',
                                  transition: 'border-color 0.15s', '&:hover': { borderColor: '#111827' } }}>
                            <input ref={fileRef} type="file" accept=".csv,.xlsx" hidden
                                onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
                            <Typography sx={{ fontSize: '2rem', mb: 1 }}>{file ? '✅' : '📄'}</Typography>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: '#374151' }}>
                                {file ? file.name : 'Drag your CSV or Excel file here, or click to browse'}
                            </Typography>
                            <Typography sx={{ fontSize: '0.78rem', color: '#9ca3af', mt: 0.5 }}>
                                {file ? `${(file.size / 1024).toFixed(1)} KB` : '.csv and .xlsx accepted · Max 10MB'}
                            </Typography>
                        </Box>

                        {error && (
                            <Box sx={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', px: 2, py: 1.2, mb: 2.5 }}>
                                <Typography sx={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</Typography>
                            </Box>
                        )}

                        <Button variant="contained" fullWidth size="large" onClick={upload} disabled={loading}
                            sx={{ py: 1.4, borderRadius: '12px', backgroundColor: '#111827', fontSize: '1rem',
                                  '&:hover': { backgroundColor: '#1f2937' } }}>
                            {loading ? 'Processing…' : 'Upload & Process'}
                        </Button>

                        {/* Required columns reference */}
                        <Box sx={{ mt: 3.5 }}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#6b7280', mb: 1.5 }}>
                                CSV column reference:
                            </Typography>
                            <Paper elevation={0} sx={{ border: '1px solid #f3f4f6', borderRadius: '10px', overflow: 'hidden' }}>
                                <Table size="small">
                                    <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                        {['Column','Required','Description'].map(h => (
                                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', py: 1.2 }}>{h}</TableCell>
                                        ))}
                                    </TableRow></TableHead>
                                    <TableBody>
                                        {COLUMNS.map(c => (
                                            <TableRow key={c.col} sx={{ '&:last-child td': { border: 0 } }}>
                                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>{c.col}</TableCell>
                                                <TableCell>{c.req
                                                    ? <Typography sx={{ color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>✓ Required</Typography>
                                                    : <Typography sx={{ color: '#9ca3af', fontSize: '0.72rem' }}>Optional</Typography>}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '0.78rem', color: '#6b7280' }}>{c.desc}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Paper>
                        </Box>
                    </>
                )}

                {step === 2 && result && (
                    <>
                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                            <Typography sx={{ fontSize: '3rem', mb: 1 }}>{result.confirmedNSQ > 0 ? '⚠️' : '✅'}</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
                                {result.confirmedNSQ > 0 ? 'NSQ Drugs Detected' : 'Upload Complete'}
                            </Typography>
                            {result.period && (
                                <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>Reporting period: {result.period}</Typography>
                            )}
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1.5, backgroundColor: '#f9fafb', borderRadius: '10px' }}>
                                <Typography sx={{ fontSize: '0.88rem' }}>Total rows processed</Typography>
                                <Typography sx={{ fontWeight: 700 }}>{result.totalRows}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1.5, borderRadius: '10px',
                                        backgroundColor: (result.nsqMatchCount || 0) > 0 ? '#fef3c7' : '#d1fae5' }}>
                                <Typography sx={{ fontSize: '0.88rem' }}>NSQ batch matches found</Typography>
                                <Typography sx={{ fontWeight: 700, color: (result.nsqMatchCount || 0) > 0 ? '#d97706' : '#059669' }}>{result.nsqMatchCount || 0}</Typography>
                            </Box>
                            {result.confirmedNSQ !== undefined && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1.5, borderRadius: '10px',
                                            backgroundColor: result.confirmedNSQ > 0 ? '#fee2e2' : '#d1fae5',
                                            border: result.confirmedNSQ > 0 ? '1px solid #fca5a5' : 'none' }}>
                                    <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>NSQ Confirmed</Typography>
                                    <Typography sx={{ fontWeight: 800, color: result.confirmedNSQ > 0 ? '#dc2626' : '#059669' }}>{result.confirmedNSQ}</Typography>
                                </Box>
                            )}
                        </Box>

                        {result.confirmedNSQ > 0 && (
                            <Box sx={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', px: 2.5, py: 1.8, mb: 3 }}>
                                <Typography sx={{ color: '#7f1d1d', fontSize: '0.88rem', fontWeight: 500 }}>
                                    ⚠️ {result.confirmedNSQ} drug batch{result.confirmedNSQ !== 1 ? 'es' : ''} matched CDSCO NSQ records.
                                    Your assigned Drug Control Officer has been notified automatically.
                                </Typography>
                            </Box>
                        )}

                        {result.warning && (
                            <Box sx={{ backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '12px', px: 2.5, py: 1.8, mb: 3 }}>
                                <Typography sx={{ color: '#92400e', fontSize: '0.88rem' }}>{result.warning}</Typography>
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                            <Button variant="contained" component={Link} to={`/pharmacy/uploads/${result.sessionId}`}
                                sx={{ borderRadius: '999px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                                View Session Details →
                            </Button>
                            <Button variant="outlined" onClick={() => { setStep(1); setFile(null); setResult(null); setMonth(''); setYear(''); }}
                                sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151' }}>
                                Upload Another File
                            </Button>
                        </Box>
                    </>
                )}
            </Paper>
        </AppLayout>
    );
};

export default PharmacyUpload;
