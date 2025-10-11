import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { router } from 'expo-router';
import { useAuthentication } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hook to secure navigation and prevent unauthorized access
 * - Prevents back navigation to authenticated screens after logout
 * - Redirects to login if trying to access protected routes while not authenticated
 */
export const useNavigationSecurity = () => {
  const { isLoggedIn, authState } = useAuthentication();

  useEffect(() => {
    const handleBackPress = () => {
      // If user is not logged in, prevent going back to authenticated screens
      if (!isLoggedIn && !authState) {
        // Force navigation to login page
        router.replace('/');
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => backHandler.remove();
  }, [isLoggedIn, authState]);
};

/**
 * Hook to protect individual screens from unauthorized access
 * More conservative approach - only redirects when we're certain user is not authenticated
 */
export const useProtectedRoute = () => {
  const { isLoggedIn, authState, isLoading } = useAuthentication();
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [hasStoredAuth, setHasStoredAuth] = useState(false);

  // Check for stored authentication on mount
  useEffect(() => {
    const checkStoredAuth = async () => {
      try {
        const storedAuthState = await AsyncStorage.getItem('@CampusEats:Auth');
        const storedToken = await AsyncStorage.getItem('@CampusEats:AuthToken');
        
        const hasAuth = !!(storedAuthState || storedToken);
        setHasStoredAuth(hasAuth);
        setHasCheckedStorage(true);
        
        console.log('🔍 Auth check:', {
          isLoggedIn,
          hasAuthState: !!authState,
          hasStoredAuth: hasAuth,
          isLoading
        });
      } catch (error) {
        console.error('Error checking stored auth:', error);
        setHasCheckedStorage(true);
      }
    };

    checkStoredAuth();
  }, [isLoggedIn, authState, isLoading]);

  const isAuthenticated = isLoggedIn || !!authState || hasStoredAuth;
  const isStillLoading = isLoading || !hasCheckedStorage;

  useEffect(() => {
    // Only redirect if we've checked everything and user is definitely not authenticated
    if (!isStillLoading && !isAuthenticated) {
      console.log('🚫 Definitely not authenticated, redirecting to login');
      const timeoutId = setTimeout(() => {
        router.replace('/');
      }, 300); // Longer delay to ensure all checks are complete

      return () => clearTimeout(timeoutId);
    } else if (!isStillLoading && isAuthenticated) {
      console.log('✅ User is authenticated, allowing access');
    }
  }, [isAuthenticated, isStillLoading]);

  return { 
    isAuthenticated,
    isLoading: isStillLoading
  };
};