import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from '../utils/axiosConfig';
import LoginSignUp from "./LoginSignUp";

const AdminRoute = ({ Component }) => {
  const { currentUser } = useAuth();
  const [accountType, setAccountType] = useState('');
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchUserAccountType = async () => {
      if (currentUser) {
        try {
          // Start loading
          setLoading(true);
          const response = await axios.get(`/users/${currentUser.id}/accountType`);
          setAccountType(response.data); // Assuming response.data is the account type (e.g., 'admin', 'dasher', 'shop')
          console.log("Fetched account type: ", response.data);
        } catch (error) {
          console.error('Error fetching user account type:', error);
        } finally {
          // Stop loading after fetching
          setLoading(false);
        }
      } else {
        // Handle case where currentUser is null (like when the user is logged out)
        setLoading(false);
      }
    };

    fetchUserAccountType();
  }, [currentUser]);

  if (loading) {
    return <div>Checking permissions...</div>; // You could add a loading spinner here
  }

  // If user is not authenticated
  if (!currentUser) {
    return <LoginSignUp />;
  }

  // Handle different account types
  switch (accountType) {
    case 'admin':
      return <Component />;
    case 'dasher':
    return <Navigate to="/dasher-orders" replace />;
    case 'shop':
    return <Navigate to="/shop-dashboard" replace />;
    default:
         return <Navigate to="/Home" replace />;
 // Fallback for unknown account type
  }
};

export default AdminRoute;
