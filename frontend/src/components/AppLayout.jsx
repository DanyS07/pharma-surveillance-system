import React from 'react'
import Box from '@mui/material/Box';
import GovHeader from './GovHeader';
import Sidebar   from './Sidebar';

// Authenticated page wrapper — gov header + sidebar + scrollable content area
const AppLayout = ({ children }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <GovHeader />
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <Sidebar />
            <Box sx={{ flex: 1, overflowY: 'auto', backgroundColor: '#f9fafb' }}>
                <Box sx={{ maxWidth: 1080, mx: 'auto', px: 3, py: 4 }}>
                    {children}
                </Box>
            </Box>
        </Box>
    </Box>
);

export default AppLayout;
