import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from '../utils/axiosConfig';
import LoginSignUp from "./LoginSignUp";
const DasherRoute = ({ Component }) => {
  const { currentUser } = useAuth();
  const [accountType, setAccountType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (currentUser) {
        const fetchUserAccountType = async () => {
            try {
                const response = await axios.get(`/users/${currentUser.id}/accountType`);
                setAccountType(response.data); 
                console.log("admin route account type: ", response.data);
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
  console.log("Component name: ", Component.name);

  if (accountType === 'shop' && Component.name == 'DasherCashout') {
    return <Component/>
  }
  if (accountType === 'shop') {
      return <Navigate to="/shop-dashboard" replace />;
  }

  if (accountType === 'regular') {
      return <Navigate to="/home" replace />;
  }

  if(accountType === 'admin'){
    return <Navigate to="/admin-incoming-order" replace />;
  }

  if (accountType === 'dasher') {
    return <Component />;
  }



  return null;
};

export default DasherRoute;
