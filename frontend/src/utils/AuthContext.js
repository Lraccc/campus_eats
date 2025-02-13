import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from './axiosConfig';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
 const [currentUser, setCurrentUser] = useState(() => {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    });    const navigate = useNavigate();

    useEffect(() => {
        const user = localStorage.getItem('currentUser');
        if (user) {
            setCurrentUser(JSON.parse(user));
        }
    }, []);

    const login = async (email, password) => {
        try {
            const response = await axios.post('/users/authenticate', { usernameOrEmail: email, password });

            if (!response.data) {
                throw new Error('Login failed');
            }
            const user = response.data.user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            setCurrentUser(user);
            console.log('Login successful', response.data);

            if(user && user.accountType === 'regular'){
                navigate('/home');
            } else if(user && user.accountType === 'dasher'){
                navigate('/dasher-orders');
            } else if(user && user.accountType === 'shop'){
                navigate('/shop-dashboard')
            }else {
                navigate('/admin-analytics');
            }
        } catch (error) {
            console.error('Login failed', error);
            throw error;
        }
    };
    

    const signup = async (email, password, username, firstname, lastname) => {
        try {
            const response = await axios.post('/users/signup', { email, password, username, firstname, lastname });
    
            if (!response.data) {
                return { success: false, message: 'Signup failed' };
            }
    
            console.log('Signup successful', response.data);
            return { success: true, data: response.data }; // Return success and the data
        } catch (error) {
            console.error('Signup failed', error);
            return { success: false, message: error.response?.data?.error || 'An error occurred during signup' }; // Return error message
        }
    };
    

    const logout = async () => {
        if (currentUser?.accountType === 'dasher') {
            
            try {
                await axios.put(`/dashers/update/${currentUser.id}/status`, null, {
                    params: { status: 'offline' }
                });
            } catch (error) {
                console.error('Error updating dasher status:', error);
            }
            
        }
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
        navigate('/login');
    };

    const updatePassword = async (userId, oldPassword, newPassword) => {
        try {
            await axios.put(`/users/${userId}/updatePassword`, { oldPassword, newPassword });
            console.log('Password updated successfully');
        } catch (error) {
            console.error('Error updating password', error);
            throw error;
        }
    };

    const value = {
        currentUser,
        login,
        logout,
        signup,
        updatePassword
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export { AuthContext };

