import React from 'react';
import { useAuth } from '../utils/AuthContext';
import SuperAdminDashboard from './SuperAdminDashboard.tsx';

const SuperAdminDashboardWrapper = () => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Loading user information...
      </div>
    );
  }

  return <SuperAdminDashboard userId={currentUser.id} />;
};

export default SuperAdminDashboardWrapper;
