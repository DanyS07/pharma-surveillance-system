import React from 'react'
import { Navigate, Outlet } from 'react-router-dom';

// Reads user info from localStorage.
// The actual JWT is in an HttpOnly cookie — JS never sees it.
// localStorage stores only { id, role, name } for UI display and route protection.
const PrivateRoutes = ({ allowedRoles }) => {
    const stored = localStorage.getItem('pharma_user');
    if (!stored) return <Navigate to="/login" replace />;
    const user = JSON.parse(stored);
    if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/403" replace />;
    return <Outlet />;
};

export default PrivateRoutes;
