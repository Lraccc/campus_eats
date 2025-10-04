import React, { useEffect } from 'react';
import FirstLaunchScreen from '@/screens/User/FirstLaunchScreen';
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

  return <FirstLaunchScreen />;
} 