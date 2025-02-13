import React from "react";
// import { Route, useNavigate } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import LoginSignUp from "./LoginSignUp";

const ProfileRoute = ({Component}) => {
    const {currentUser} = useAuth();
    // const navigate = useNavigate();

     if (!currentUser) {
    return <LoginSignUp />;
  }

  // Handle different account types
  switch (currentUser.accountType) {
    case 'regular':
      return <Component />;
    case 'dasher':
    return <Component/>;
    case 'shop':
    return <Component/>;
    case 'admin':
    return <Component/>;
    default:
         return <Navigate to="/Home" replace />;
 // Fallback for unknown account type
  }



}

export default ProfileRoute;