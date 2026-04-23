import React, { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'; import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper'; import Button from '@mui/material/Button';
import Table from '@mui/material/Table'; import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell'; import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow'; import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog'; import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent'; import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import AppLayout from '../AppLayout'; import axiosInstance from '../../axiosInstance'; import { useToast } from '../../utils/Toast';

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#f9fafb' } };

const NSQMasterList = () => {
    const showToast  = useToast();
    const fileRef    = useRef();
    const [records, setRecords]     = useState([]);
    const [search, setSearch]       = useState('');
    const [showAdd, setShowAdd]     = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving]       = useState(false);
    const [apiErr, setApiErr]       = useState('');
    const [form, setForm] = useState({ drugName:'', batchNumber:'', manufacturer:'', reason:'', cdscoPdfRef:'', reportDate:'' });

    const load = () => axiosInstance.get('/nsq/all').then(r => setRecords(r.data.records || [])).catch(console.error);
    useEffect(() => { load(); }, []);

    const filtered = records.filter(r =>
        r.drugName.toLowerCase().includes(search.toLowerCase()) ||
        r.batchNumber.toLowerCase().includes(search.toLowerCase())
    );

    const addRecord = async () => {
        if (!form.drugName || !form.batchNumber || !form.reportDate) { setApiErr('Drug name, batch number and report date are required.'); return; }
        setSaving(true); setApiErr('');
        try {
            await axiosInstance.post('/nsq/add', form);
            showToast('NSQ record added.'); setShowAdd(false);
            setForm({ drugName:'', batchNumber:'', manufacturer:'', reason:'', cdscoPdfRef:'', reportDate:'' }); load();
        } catch (err) { setApiErr(err.response?.data?.message || 'Failed.'); }
        setSaving(false);
    };

    const deleteRecord = async (id, name) => {
        if (!window.confirm(`Delete "${name}" from the NSQ master list?`)) return;
        await axiosInstance.delete(`/nsq/${id}`);
        showToast('Record removed.'); load();
    };

    const uploadCSV = async () => {
        if (!uploadFile) return;
        setUploading(true); setApiErr('');
        const fd = new FormData(); fd.append('file', uploadFile);
        try {
            const r = await axiosInstance.post('/nsq/upload-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setUploadResult(r.data); load();
        } catch (err) { setApiErr(err.response?.data?.message || 'Upload failed.'); }
        setUploading(false);
    };

    return (
        <AppLayout>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5 }}>
                <Box><Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>NSQ Master List</Typography>
                    <Typography sx={{ color: '#6b7280', fontSize: '0.88rem', mt: 0.5 }}>CDSCO Not-of-Standard-Quality drug records</Typography></Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button variant="outlined" onClick={() => setShowUpload(true)}
                        sx={{ borderRadius: '999px', borderColor: '#e5e7eb', color: '#374151', fontSize: '0.85rem' }}>
                        ⬆ Upload CDSCO CSV
                    </Button>
                    <Button variant="contained" onClick={() => setShowAdd(true)}
                        sx={{ borderRadius: '999px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                        + Add Record
                    </Button>
                </Box>
            </Box>

            <TextField placeholder="Search drug name or batch number…" size="small" value={search}
                onChange={e => setSearch(e.target.value)} sx={{ mb: 2.5, width: 320, ...fieldSx }}
                InputProps={{ startAdornment: <InputAdornment position="start">🔍</InputAdornment> }} />

            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflowX: 'auto' }}>
                   <Table size="small" sx={{ minWidth: 900 }}>                    <TableHead><TableRow sx={{ backgroundColor: '#f9fafb' }}>
                        {['Drug Name','Batch No.','Manufacturer','Reason','CDSCO Ref','Report Date',''].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', py: 1.5 }}>{h}</TableCell>
                        ))}
                    </TableRow></TableHead>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 5, color: '#9ca3af' }}>
                                {search ? 'No results for your search.' : 'No NSQ records yet. Add manually or upload a CDSCO CSV.'}
                            </TableCell></TableRow>
                        ) : filtered.map(r => (
                            <TableRow key={r._id} sx={{ '&:hover': { backgroundColor: '#f9fafb' }, '&:last-child td': { border: 0 } }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.drugName}</TableCell>
                                <TableCell><Box sx={{ backgroundColor: '#fee2e2', color: '#dc2626', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, px: 1, py: 0.3, borderRadius: '4px', display: 'inline-block' }}>{r.batchNumber}</Box></TableCell>
                                <TableCell sx={{ color: '#6b7280', fontSize: '0.82rem' }}>{r.manufacturer || '—'}</TableCell>
                                <TableCell sx={{ color: '#6b7280', fontSize: '0.82rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '—'}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>{r.cdscoPdfRef || '—'}</TableCell>
                                <TableCell sx={{ fontSize: '0.78rem', color: '#9ca3af' }}>{r.reportDate ? new Date(r.reportDate).toLocaleDateString() : '—'}</TableCell>
                                <TableCell>
                                    <Button size="small" variant="outlined" onClick={() => deleteRecord(r._id, `${r.drugName} (${r.batchNumber})`)}
                                        sx={{ borderRadius: '999px', borderColor: '#dc2626', color: '#dc2626', fontSize: '0.72rem', '&:hover': { backgroundColor: '#fee2e2' } }}>Delete</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>

            {/* Add Record Dialog */}
            <Dialog open={showAdd} onClose={() => setShowAdd(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Add NSQ Record</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
                    {apiErr && <Box sx={{ backgroundColor: '#fee2e2', borderRadius: '8px', px: 2, py: 1 }}><Typography sx={{ color: '#dc2626', fontSize: '0.85rem' }}>{apiErr}</Typography></Box>}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField label="Drug Name *" value={form.drugName} onChange={e => setForm(p => ({ ...p, drugName: e.target.value }))} fullWidth sx={fieldSx} />
                        <TextField label="Batch Number *" value={form.batchNumber} onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value }))} fullWidth sx={fieldSx} />
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField label="Manufacturer" value={form.manufacturer} onChange={e => setForm(p => ({ ...p, manufacturer: e.target.value }))} fullWidth sx={fieldSx} />
                        <TextField label="Report Date *" type="date" value={form.reportDate} onChange={e => setForm(p => ({ ...p, reportDate: e.target.value }))} fullWidth sx={fieldSx} InputLabelProps={{ shrink: true }} />
                    </Box>
                    <TextField label="NSQ Reason" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} fullWidth sx={fieldSx} />
                    <TextField label="CDSCO PDF Reference" value={form.cdscoPdfRef} onChange={e => setForm(p => ({ ...p, cdscoPdfRef: e.target.value }))} fullWidth sx={fieldSx} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                    <Button onClick={() => setShowAdd(false)} sx={{ color: '#6b7280', borderRadius: '10px' }}>Cancel</Button>
                    <Button onClick={addRecord} disabled={saving} variant="contained"
                        sx={{ borderRadius: '10px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                        {saving ? 'Adding…' : 'Add Record'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Upload CSV Dialog */}
            <Dialog open={showUpload} onClose={() => { setShowUpload(false); setUploadResult(null); setUploadFile(null); }} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>{uploadResult ? 'Upload Complete' : 'Upload CDSCO NSQ List'}</DialogTitle>
                <DialogContent sx={{ pt: '16px !important' }}>
                    {uploadResult ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {[
                                { label: 'Records inserted', value: uploadResult.inserted, color: '#059669', bg: '#d1fae5' },
                                { label: 'Duplicates skipped', value: uploadResult.duplicatesSkipped, color: '#d97706', bg: '#fef3c7' },
                                { label: 'Invalid rows skipped', value: uploadResult.invalidRowsSkipped, color: '#dc2626', bg: '#fee2e2' },
                            ].map(item => (
                                <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1.5, backgroundColor: item.bg, borderRadius: '10px' }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.label}</Typography>
                                    <Typography sx={{ fontWeight: 700, color: item.color }}>{item.value}</Typography>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <>
                            {apiErr && <Box sx={{ backgroundColor: '#fee2e2', borderRadius: '8px', px: 2, py: 1, mb: 2 }}><Typography sx={{ color: '#dc2626', fontSize: '0.85rem' }}>{apiErr}</Typography></Box>}
                            <Typography sx={{ color: '#6b7280', fontSize: '0.85rem', mb: 2.5 }}>
                                Upload the official CDSCO NSQ drug list CSV. Accepted columns: Name of Product, Batch No, Manufactured By, NSQ Result, Reporting Source, Reporting Month &amp; Year
                            </Typography>
                            <Box
                                onClick={() => fileRef.current.click()}
                                sx={{ border: '2px dashed #e5e7eb', borderRadius: '12px', backgroundColor: '#f9fafb',
                                      p: 4, textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s',
                                      borderColor: uploadFile ? '#059669' : '#e5e7eb',
                                      '&:hover': { borderColor: '#111827' } }}>
                                <input ref={fileRef} type="file" accept=".csv,.xlsx" hidden onChange={e => setUploadFile(e.target.files[0])} />
                                <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>{uploadFile ? '✅' : '📄'}</Typography>
                                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                                    {uploadFile ? uploadFile.name : 'Drag your CSV here, or click to browse'}
                                </Typography>
                                <Typography sx={{ fontSize: '0.78rem', color: '#9ca3af', mt: 0.5 }}>.csv and .xlsx accepted · Max 10MB</Typography>
                            </Box>
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                    <Button onClick={() => { setShowUpload(false); setUploadResult(null); setUploadFile(null); }}
                        sx={{ color: '#6b7280', borderRadius: '10px' }}>{uploadResult ? 'Close' : 'Cancel'}</Button>
                    {!uploadResult && (
                        <Button onClick={uploadCSV} disabled={!uploadFile || uploading} variant="contained"
                            sx={{ borderRadius: '10px', backgroundColor: '#111827', '&:hover': { backgroundColor: '#1f2937' } }}>
                            {uploading ? 'Processing…' : 'Upload & Process'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </AppLayout>
    );
};

export default NSQMasterList;
