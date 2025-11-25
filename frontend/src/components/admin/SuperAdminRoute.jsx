import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import axios from '../../utils/axiosConfig';
import LoginSignUp from "../LoginSignUp";

const SuperAdminRoute = ({ Component }) => {
  const { currentUser } = useAuth();
  const [accountType, setAccountType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAccountType = async () => {
      if (currentUser) {
        try {
          setLoading(true);
          const response = await axios.get(`/users/${currentUser.id}/accountType`);
          setAccountType(response.data);
          console.log("Fetched account type: ", response.data);
        } catch (error) {
          console.error('Error fetching user account type:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUserAccountType();
  }, [currentUser]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem'
      }}>
        Checking superadmin permissions...
      </div>
    );
  }

  // If user is not authenticated
  if (!currentUser) {
    return <LoginSignUp />;
  }

  // Only allow superadmin access
  if (accountType === 'superadmin') {
    return <Component />;
  }

  // Redirect based on account type
  switch (accountType) {
    case 'admin':
      return <Navigate to="/admin-analytics" replace />;
    case 'dasher':
      return <Navigate to="/dasher-orders" replace />;
    case 'shop':
      return <Navigate to="/shop-dashboard" replace />;
    default:
      return <Navigate to="/home" replace />;
  }
};

export default SuperAdminRoute;
