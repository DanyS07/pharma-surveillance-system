import React, { createContext, useContext, useState, useCallback } from 'react'
import Snackbar from '@mui/material/Snackbar';
import Alert   from '@mui/material/Alert';
import Slide   from '@mui/material/Slide';

const ToastContext = createContext(null);

function SlideUp(props) { return <Slide {...props} direction="up" />; }

export const ToastProvider = ({ children }) => {
    const [state, setState] = useState({ open: false, message: '', severity: 'success' });
    const showToast = useCallback((message, severity = 'success') => {
        setState({ open: true, message, severity });
    }, []);
    const handleClose = (_, reason) => {
        if (reason === 'clickaway') return;
        setState(p => ({ ...p, open: false }));
    };
    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <Snackbar open={state.open} autoHideDuration={3500} onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                TransitionComponent={SlideUp}>
                <Alert onClose={handleClose} severity={state.severity} variant="filled"
                    sx={{ borderRadius: '10px', fontWeight: 500, fontSize: '0.9rem',
                          boxShadow: '0px 8px 32px rgba(0,0,0,0.15)', minWidth: 280 }}>
                    {state.message}
                </Alert>
            </Snackbar>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
    return ctx;
};
