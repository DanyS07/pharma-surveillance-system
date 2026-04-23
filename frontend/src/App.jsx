import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastProvider } from './utils/Toast';

// Public pages
import Home     from './components/Home';
import Login    from './components/Login';
import Register from './components/Register';

// Admin pages
import AdminDashboard  from './components/admin/AdminDashboard';
import AdminPharmacies from './components/admin/AdminPharmacies';
import AdminOfficers   from './components/admin/AdminOfficers';
import NSQMasterList   from './components/admin/NSQMasterList';
import AdminAlerts     from './components/admin/AdminAlerts';
import AuditLog        from './components/admin/AuditLog';

// Officer pages
import OfficerDashboard  from './components/officer/OfficerDashboard';
import OfficerAlerts     from './components/officer/OfficerAlerts';
import OfficerPharmacies from './components/officer/OfficerPharmacies';
import PharmacyDetail    from './components/officer/PharmacyDetail';
import SessionView       from './components/officer/SessionView';

// Pharmacy pages
import PharmacyDashboard from './components/pharmacy/PharmacyDashboard';
import PharmacyUpload    from './components/pharmacy/PharmacyUpload';
import PharmacyUploads   from './components/pharmacy/PharmacyUploads';
import SessionDetail     from './components/pharmacy/SessionDetail';

// Guards + Utility
import PrivateRoutes from './components/PrivateRoutes';
import NotFound  from './components/NotFound';
import Forbidden from './components/Forbidden';

// Theme — mirrors Mentii exactly, using Inter font per design spec
const theme = createTheme({
    palette: {
        background: { default: '#f9fafb' },
        primary:    { main: '#111827' },
        text:       { primary: '#111827', secondary: '#6b7280' },
    },
    typography: { fontFamily: '"Inter", sans-serif' },
    shape:      { borderRadius: 12 },
    components: {
        MuiCard:   { styleOverrides: { root: { boxShadow: 'none', border: '1px solid #f3f4f6' } } },
        MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { boxShadow: 'none' } } } },
        MuiPaper:  { styleOverrides: { root: { boxShadow: 'none' } } },
        MuiDialog: { styleOverrides: { paper: { borderRadius: '16px', border: '1px solid #f3f4f6' } } },
        MuiTableCell: { styleOverrides: { root: { borderColor: '#f3f4f6' } } },
    },
});

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <ToastProvider>
                <Routes>
                    {/* Public */}
                    <Route path="/"         element={<Home />} />
                    <Route path="/login"    element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Admin */}
                    <Route element={<PrivateRoutes allowedRoles={['admin']} />}>
                        <Route path="/admin/dashboard"  element={<AdminDashboard />} />
                        <Route path="/admin/pharmacies" element={<AdminPharmacies />} />
                        <Route path="/admin/officers"   element={<AdminOfficers />} />
                        <Route path="/admin/nsq"        element={<NSQMasterList />} />
                        <Route path="/admin/alerts"     element={<AdminAlerts />} />
                        <Route path="/admin/audit"      element={<AuditLog />} />
                    </Route>

                    {/* Officer */}
                    <Route element={<PrivateRoutes allowedRoles={['officer']} />}>
                        <Route path="/officer/dashboard"          element={<OfficerDashboard />} />
                        <Route path="/officer/alerts"             element={<OfficerAlerts />} />
                        <Route path="/officer/pharmacies"         element={<OfficerPharmacies />} />
                        <Route path="/officer/pharmacies/:id"     element={<PharmacyDetail />} />
                        <Route path="/officer/session/:sessionId" element={<SessionView />} />
                    </Route>

                    {/* Pharmacy */}
                    <Route element={<PrivateRoutes allowedRoles={['pharmacy']} />}>
                        <Route path="/pharmacy/dashboard"            element={<PharmacyDashboard />} />
                        <Route path="/pharmacy/upload"               element={<PharmacyUpload />} />
                        <Route path="/pharmacy/uploads"              element={<PharmacyUploads />} />
                        <Route path="/pharmacy/uploads/:sessionId"   element={<SessionDetail />} />
                    </Route>

                    {/* Utility */}
                    <Route path="/403" element={<Forbidden />} />
                    <Route path="*"    element={<NotFound />} />
                </Routes>
            </ToastProvider>
        </ThemeProvider>
    );
}

export default App;
