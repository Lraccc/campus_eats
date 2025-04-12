import React, { useEffect } from 'react';
import LandPage from '../screens/Home/LandingPage';
import { router } from 'expo-router';

export default function LandingRoute() {
  useEffect(() => {
    // Set a timer to navigate to login after 5 seconds
    const timer = setTimeout(() => {
      router.replace('/');
    }, 5000);

    // Clean up the timer if component unmounts
    return () => clearTimeout(timer);
  }, []);

  return <LandPage />;
} 