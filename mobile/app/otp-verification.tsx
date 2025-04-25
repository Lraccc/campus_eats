import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import OtpVerification from '../screens/auth/OtpVerification';

export default function OtpVerificationRoute() {
  const { email } = useLocalSearchParams<{ email: string }>();
  
  if (!email) {
    // Handle missing email parameter
    return null;
  }

  return <OtpVerification email={email} />;
} 