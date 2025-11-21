import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, Text, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RestrictionModal from '../components/RestrictionModal';
import { isWithinGeofence } from '../utils/geofence';
import logger from '../utils/logger';
import ErrorBoundary from '../components/ErrorBoundary';
import { LOCATION_CONFIG, getLocationAccuracy } from '../utils/locationConfig';

const GEOFENCE_CENTER = { lat: 10.295663, lng: 123.880895 };
const GEOFENCE_RADIUS = 200000; // 200km radius - very generous for development
const APP_FIRST_LAUNCH_KEY = '@campus_eats_first_launch';

const ERROR_MESSAGES = {
  services: 'Please enable GPS services to continue.',
  permission: 'Please grant location permission to continue.',
  timeout: 'Unable to determine your location. Please try again.',
  outside: 'You must be within the service area to use this app.',
} as const;
type ErrorType = keyof typeof ERROR_MESSAGES;

export default function RootLayout() {
  const [granted, setGranted] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const lastPositionRef = useRef<Location.LocationObject | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  // Check if this is the first app launch
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasLaunched = await AsyncStorage.getItem(APP_FIRST_LAUNCH_KEY);
        if (hasLaunched === null) {
          // First launch ever
          setIsFirstLaunch(true);
          await AsyncStorage.setItem(APP_FIRST_LAUNCH_KEY, 'true');
              logger.log('🚀 First app launch detected - showing splash screen');
        } else {
          setIsFirstLaunch(false);
              logger.log('🔄 Subsequent app launch - skipping splash screen');
        }
      } catch (error) {
            logger.error('Error checking first launch:', error);
        setIsFirstLaunch(false);
      }
    };
    checkFirstLaunch();
  }, []);

  // Handle deep links for authentication
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      logger.log('🔗 Deep link received:', url);
      
      // Handle Microsoft authentication redirect
      if (url.startsWith('campuseats://auth') || url.startsWith('campus-eats://auth')) {
        logger.log('🔐 Authentication deep link detected');
        // The expo-auth-session will automatically handle this
        // We just need to log it for debugging
      }
      
      // Handle payment redirects
      if (url.includes('payment/success') || url.includes('payment/failed')) {
        logger.log('💳 Payment redirect detected:', url);
        // The app state listener in Checkout.tsx will handle verification
        // Just log for debugging
      }
    };

    // Handle deep links when app is already running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Handle deep links when app is launched from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Initialize logging
  useEffect(() => {
    logger.log('� App initialized');
  }, []);

  const lastLocationCheckRef = useRef<number>(0);
  const LOCATION_CHECK_MIN_MS = 5000; // minimum interval between checks
  const locationFailureCountRef = useRef<number>(0);

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (v: number) => v * (Math.PI / 180);
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const checkLocation = useCallback(async () => {
    const now = Date.now();
    if (now - lastLocationCheckRef.current < LOCATION_CHECK_MIN_MS) {
      // Too frequent; skip
      logger.log('Skipping frequent location check');
      return;
    }
    lastLocationCheckRef.current = now;
    logger.log('🔍 Starting location check...');

    // 1) Services
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    logger.log('📍 GPS Services enabled:', servicesEnabled);
    if (!servicesEnabled) {
      lastPositionRef.current = null;
      setErrorType('services');
      setGranted(false);
      setIsInitializing(false);
      return;
    }
    
    // 2) Permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    logger.log('🔐 Location permission status:', status);
    if (status !== 'granted') {
      lastPositionRef.current = null;
      setErrorType('permission');
      setGranted(false);
      return;
    }
    
    // 3) Get position
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Location request timed out')), 5000) // Reduced timeout to 5 seconds
      );
      
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: getLocationAccuracy(LOCATION_CONFIG.LOW_PRECISION.accuracy),
      });
      
      const pos = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;
      const posLat = pos.coords.latitude;
      const posLng = pos.coords.longitude;
      // Only log position if it changed significantly to reduce spam
      if (!lastPositionRef.current) {
        logger.log('📍 Current position:', posLat, posLng);
      } else {
        const prev = lastPositionRef.current.coords;
        const dist = haversine(prev.latitude, prev.longitude, posLat, posLng);
        if (dist > 50) {
          logger.log('📍 Current position (moved):', posLat, posLng, 'moved:', Math.round(dist));
        }
      }
      lastPositionRef.current = pos;
    } catch (error) {
      // Reduce repeated error noise: log first failure and then every 10th
      locationFailureCountRef.current += 1;
      if (locationFailureCountRef.current === 1 || locationFailureCountRef.current % 10 === 0) {
        logger.warn('❌ Failed to get current position:', error);
      }
      // For development, allow the app to continue without exact location
      logger.warn('⚠️ Proceeding without exact location - will assume valid area for development');
      
      // Set a default location within the geofence to allow the app to continue
      lastPositionRef.current = {
        coords: {
          latitude: GEOFENCE_CENTER.lat,
          longitude: GEOFENCE_CENTER.lng,
          altitude: null,
          accuracy: 1000,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as Location.LocationObject;
    }
    
    // 4) Geofence check
    const { latitude, longitude } = lastPositionRef.current!.coords;
    const inside = isWithinGeofence(
      latitude,
      longitude,
      GEOFENCE_CENTER.lat,
      GEOFENCE_CENTER.lng,
      GEOFENCE_RADIUS
    );
    
    // Calculate and log distance for debugging
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const R = 6371000; // Earth radius in meters
    const φ1 = toRadians(GEOFENCE_CENTER.lat);
    const φ2 = toRadians(latitude);
    const Δφ = toRadians(latitude - GEOFENCE_CENTER.lat);
    const Δλ = toRadians(longitude - GEOFENCE_CENTER.lng);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
  logger.log('🗺️ Distance from center:', Math.round(distance), 'meters');
  logger.log('🎯 Geofence radius:', GEOFENCE_RADIUS, 'meters');
  logger.log('✅ Inside geofence:', inside);
    
    if (!inside) {
      setErrorType('outside');
      setGranted(false);
    } else {
      setErrorType(null);
      setGranted(true);
    }
    
    // Set initialization complete after first check
    setIsInitializing(false);
  }, []);

  const startWatch = useCallback(async () => {
    watchRef.current?.remove();
    watchRef.current = await Location.watchPositionAsync(
      { 
        accuracy: getLocationAccuracy(LOCATION_CONFIG.LOW_PRECISION.accuracy), 
        timeInterval: LOCATION_CONFIG.LOW_PRECISION.timeInterval, 
        distanceInterval: LOCATION_CONFIG.LOW_PRECISION.distanceInterval 
      },
      () => checkLocation()
    );
  }, [checkLocation]);

  const retryHandler = useCallback(() => {
    logger.log('🔄 Retry button pressed');
    setErrorType(null);
    // Don't show splash screen on retry - only on first launch
    
    // Add a small delay to prevent immediate re-triggering
    setTimeout(() => {
      checkLocation();
      startWatch();
    }, 1000);
  }, [checkLocation, startWatch]);

  useEffect(() => {
    checkLocation();
    startWatch();
    
    // Add a maximum timeout for initialization to prevent indefinite blocking
    const maxInitTimeout = setTimeout(() => {
      logger.log('⏰ Maximum initialization timeout reached - proceeding to app');
      setIsInitializing(false);
      setGranted(true);
    }, 3000); // 3 seconds maximum for initialization
    
    // Poll servicesEnabled every 3s in case watch stops firing
    const pollId = setInterval(async () => {
      if (!(await Location.hasServicesEnabledAsync())) {
        lastPositionRef.current = null;
        setErrorType('services');
        setGranted(false);
      }
    }, 3000);

    return () => {
      watchRef.current?.remove();
      clearInterval(pollId);
      clearTimeout(maxInitTimeout);
      watchRef.current = null;
    };
  }, [checkLocation, startWatch]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        checkLocation();
        startWatch();
      } else {
        watchRef.current?.remove();
        watchRef.current = null;
      }
    });
    return () => sub.remove();
  }, [checkLocation, startWatch]);

  // Skip the first launch screen since it was removed
  // The app will proceed directly to the main layout

  return (
    <>
      <RestrictionModal
        visible={!isInitializing && !granted && errorType !== null}
        message={errorType ? ERROR_MESSAGES[errorType] : ''}
        onRetry={retryHandler}
      />
      <View style={styles.container} pointerEvents={(!isInitializing && granted) ? 'auto' : 'none'}>
        <ErrorBoundary>
          <Stack>
          <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="login" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="home" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="signup" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="cart" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="cart-preview" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="profile" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="order" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="verification-success" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="otp-verification" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="forgot-password" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="checkout" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="apply-shop" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="dasher" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="history-order" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="payment" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="auth" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="view-livestream" options={{ headerShown: false, animation: 'none' }} />
          </Stack>
        </ErrorBoundary>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});