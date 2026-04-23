import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Box        from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button     from '@mui/material/Button';
import Chip       from '@mui/material/Chip';
import Divider    from '@mui/material/Divider';
import axiosInstance from '../axiosInstance';
import { useToast }  from '../utils/Toast';

const NAV = {
    admin: [
        { to: '/admin/dashboard',  label: 'Dashboard'      },
        { to: '/admin/pharmacies', label: 'Pharmacies'      },
        { to: '/admin/officers',   label: 'Officers'        },
        { to: '/admin/nsq',        label: 'NSQ Master List' },
        { to: '/admin/alerts',     label: 'Alerts'          },
        { to: '/admin/audit',      label: 'Audit Log'       },
    ],
    officer: [
        { to: '/officer/dashboard',  label: 'Dashboard'     },
        { to: '/officer/alerts',     label: 'My Alerts'     },
        { to: '/officer/pharmacies', label: 'My Pharmacies' },
    ],
    pharmacy: [
        { to: '/pharmacy/dashboard', label: 'Dashboard'        },
        { to: '/pharmacy/upload',    label: 'Upload Inventory'  },
        { to: '/pharmacy/uploads',   label: 'My Uploads'        },
    ],
};

const ROLE_COLORS = {
    admin:    { bg: '#dbeafe', color: '#2563eb' },
    officer:  { bg: '#fef3c7', color: '#d97706' },
    pharmacy: { bg: '#d1fae5', color: '#059669' },
};

const Sidebar = () => {
    const location  = useLocation();
    const navigate  = useNavigate();
    const showToast = useToast();
    const stored    = JSON.parse(localStorage.getItem('pharma_user') || '{}');
    const { role = '', name = '' } = stored;
    const links = NAV[role] || [];
    const rc    = ROLE_COLORS[role] || { bg: '#f3f4f6', color: '#6b7280' };

    const logout = async () => {
        try { await axiosInstance.post('/user/logout'); } catch (_) {}

        // Clear the stored user identity
        localStorage.removeItem('pharma_user');

        // replace: true replaces the current history entry so the Back button
        // cannot return to this dashboard page after logout.
        // The session cookie is already cleared by the server call above,
        // so any cached route that tries to load data will get a 401 and
        // redirect to login again anyway — but we prevent even the cached
        // HTML from being shown by removing it from the history stack.
        navigate('/login', { replace: true });

        showToast('Signed out successfully.');
    };

    return (
        <Box sx={{
            width: 240,
            flexShrink: 0,
            borderRight: '1px solid #f3f4f6',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'auto',
        }}>
            {/* Brand */}
            <Box sx={{ px: 2.5, pt: 2.5, pb: 2, borderBottom: '1px solid #f3f4f6' }}>
                <Typography sx={{
                    fontWeight: 800, fontSize: '0.95rem', color: '#111827',
                    letterSpacing: '-0.02em', display: 'block', mb: 0.5,
                }}>
                    PharmaSurveillance
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#9ca3af', mb: 1, lineHeight: 1.3 }}>
                    Drug Control Dept, Kerala
                </Typography>
                <Chip label={role.charAt(0).toUpperCase() + role.slice(1)} size="small"
                    sx={{ backgroundColor: rc.bg, color: rc.color, fontWeight: 600,
                          fontSize: '0.7rem', borderRadius: '999px', height: 20 }} />
            </Box>

            {/* Navigation links */}
            <Box sx={{ flex: 1, px: 1.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {links.map(l => {
                    const active =
                        location.pathname === l.to ||
                        (l.to !== '/admin/dashboard' &&
                         l.to !== '/officer/dashboard' &&
                         l.to !== '/pharmacy/dashboard' &&
                         location.pathname.startsWith(l.to));
                    return (
                        <Box key={l.to} component={Link} to={l.to}
                            sx={{
                                display: 'flex', alignItems: 'center',
                                px: 1.5, py: 1.1, borderRadius: '8px',
                                textDecoration: 'none', fontSize: '0.88rem',
                                fontWeight: active ? 600 : 500,
                                color: active ? '#111827' : '#6b7280',
                                backgroundColor: active ? '#f3f4f6' : 'transparent',
                                borderLeft: active ? '3px solid #1e3a5f' : '3px solid transparent',
                                transition: 'all 0.15s',
                                '&:hover': { backgroundColor: '#f9fafb', color: '#111827' },
                            }}>
                            {l.label}
                        </Box>
                    );
                })}
            </Box>

            <Divider />

            {/* Footer */}
            <Box sx={{ px: 2.5, py: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: '#9ca3af', mb: 1.5 }}>
                    {role} account
                </Typography>
                <Button fullWidth variant="outlined" size="small" onClick={logout}
                    sx={{ borderRadius: '10px', borderColor: '#e5e7eb', color: '#6b7280',
                          fontSize: '0.8rem', '&:hover': { borderColor: '#dc2626', color: '#dc2626' } }}>
                    Sign Out
                </Button>
            </Box>
        </Box>
    );
};

export default Sidebar;