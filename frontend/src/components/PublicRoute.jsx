import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from '../utils/axiosConfig';
import Home from "./user/Home";


const PublicRoute = ({ Component }) => {
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
                } 
            }
                setLoading(false);
        };
        
        fetchUserAccountType();
    }, [currentUser]);

    if (loading) {
        return <div>Loading...</div>;
    }

    // Redirect based on account type
    if (accountType === 'admin') {
        return <Navigate to="/admin-incoming-order" replace />;
    }
    if (accountType === 'dasher') {
        return <Navigate to="/dasher-orders" replace />;
    }
    if (accountType === 'shop') {
        return <Navigate to="/shop-dashboard" replace />;
    }

    // Check localStorage as a fallback for currentUser
    const user = currentUser || (() => {
        const stored = localStorage.getItem('currentUser');
        return stored ? JSON.parse(stored) : null;
    })();

    return user ? <Home /> : <Component />;
};

export default PublicRoute;
