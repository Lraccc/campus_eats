import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from "../utils/axiosConfig";
import LoginSignUp from "./LoginSignUp";


const ShopRoute = ({ Component }) => {
  const { currentUser } = useAuth();
  const [accountType, setAccountType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    console.log("shop route current user: ", currentUser);
    if (currentUser) {
        const fetchUserAccountType = async () => {
            try {
                const response = await axios.get(`/users/${currentUser.id}/accountType`);
                setAccountType(response.data); 
                console.log("shop route account type: ", response.data);
                // Directly setting the response data since it's a plain string
            } catch (error) {
                console.error('Error fetching user account type:', error);
            }
        };
    
        fetchUserAccountType();
    }
    setLoading(false);
    
}, [currentUser]);

  if (loading) {
    return <div>Checking permissions...</div>; // Or a loading spinner
  }

  if (!currentUser) {
    return <LoginSignUp />;
  }

  if (accountType === 'shop') {
    return <Component />;
  }

  if (accountType === 'regular') {
    return <Navigate to="/home" replace />;
  }

  if(accountType === 'admin'){
    return <Navigate to="/admin-incoming-order" replace />;
  }

  if (accountType === 'dasher') {
    return <Navigate to="/dasher-orders" replace />;
  }


  return null
};

export default ShopRoute;
