import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';

export const ProtectedRoute = ({ children, module, permission }) => {
  const { isAuthenticated, loading, canAccessModule, hasPermission, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader fullPage message="Authenticating session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isSuperAdmin) {
    if (permission && !hasPermission(permission)) {
      return <Navigate to="/dashboard" replace />;
    }
    if (module && !canAccessModule(module)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
