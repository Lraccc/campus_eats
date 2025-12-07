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
import axios from 'axios';
import { API_BASE_URL } from '../config';

// Default fallback geofence (used if campus not loaded yet)
const DEFAULT_GEOFENCE_CENTER = { lat: 10.295663, lng: 123.880895 };
const DEFAULT_GEOFENCE_RADIUS = 200000; // 200km radius - very generous for development
const APP_FIRST_LAUNCH_KEY = '@campus_eats_first_launch';

const ERROR_MESSAGES = {
  services: 'Please enable GPS services to continue.',
  permission: 'Please grant location permission to continue.',
  timeout: 'Unable to determine your location. Please try again.',
  outside: 'You must be within the service area to use this app.',
} as const;
type ErrorType = keyof typeof ERROR_MESSAGES;

export default function RootLayout() {
  console.log('🚀 RootLayout component rendering');
  const [granted, setGranted] = useState(false); // Start with false to block until location verified
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [isInitializing, setIsInitializing] = useState(true); // Start with true - block until first check
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [geofenceCenter, setGeofenceCenter] = useState(DEFAULT_GEOFENCE_CENTER);
  const [geofenceRadius, setGeofenceRadius] = useState(DEFAULT_GEOFENCE_RADIUS);
  const lastPositionRef = useRef<Location.LocationObject | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  // Fetch user's campus geofence settings
  useEffect(() => {
    const loadCampusGeofence = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        const campusId = await AsyncStorage.getItem('campusId');
        
        if (!campusId) {
          logger.log('📍 No campus assigned yet, using default geofence');
          return;
        }

        // Fetch campus details
        const response = await axios.get(`${API_BASE_URL}/api/campuses/${campusId}`);
        const campus = response.data;

        if (campus && campus.centerLatitude && campus.centerLongitude && campus.geofenceRadius) {
          setGeofenceCenter({
            lat: campus.centerLatitude,
            lng: campus.centerLongitude
          });
          setGeofenceRadius(campus.geofenceRadius);
          logger.log(`📍 Loaded campus geofence: ${campus.name}`, {
            center: `${campus.centerLatitude}, ${campus.centerLongitude}`,
            radius: `${campus.geofenceRadius}m`
          });
        }
      } catch (error) {
        logger.error('Failed to load campus geofence, using default:', error);
      }
    };

    loadCampusGeofence();
  }, []);

  // Check if this is the first app launch
  useEffect(() => {
    console.log('🔄 Checking first launch status');
    const checkFirstLaunch = async () => {
      try {
        const hasLaunched = await AsyncStorage.getItem(APP_FIRST_LAUNCH_KEY);
        console.log('📦 First launch check result:', hasLaunched);
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
        console.error('❌ First launch check error:', error);
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
      logger.log('❌ GPS disabled - blocking app access');
      return;
    }
    
    // 2) Permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    logger.log('🔐 Location permission status:', status);
    if (status !== 'granted') {
      lastPositionRef.current = null;
      setErrorType('permission');
      setGranted(false);
      setIsInitializing(false);
      logger.log('❌ Permission denied - blocking app access');
      return;
    }
    
    // 3) Get position
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Location request timed out')), 10000) // 10 seconds for better accuracy
      );
      
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: getLocationAccuracy(LOCATION_CONFIG.HIGH_PRECISION.accuracy),
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
        logger.error('❌ Failed to get current position:', error);
      }
      
      // Block access if we can't get location
      setErrorType('timeout');
      setGranted(false);
      setIsInitializing(false);
      logger.log('❌ Cannot get location - blocking app access');
      return;
    }
    
    // 4) Geofence check
    const { latitude, longitude } = lastPositionRef.current!.coords;
    const inside = isWithinGeofence(
      latitude,
      longitude,
      geofenceCenter.lat,
      geofenceCenter.lng,
      geofenceRadius
    );
    
    // Calculate and log distance for debugging
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const R = 6371000; // Earth radius in meters
    const φ1 = toRadians(geofenceCenter.lat);
    const φ2 = toRadians(latitude);
    const Δφ = toRadians(latitude - geofenceCenter.lat);
    const Δλ = toRadians(longitude - geofenceCenter.lng);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    logger.log('🗺️ Distance from center:', Math.round(distance), 'meters');
    logger.log('🎯 Geofence radius:', geofenceRadius, 'meters');
    logger.log('✅ Inside geofence:', inside);
    
    if (!inside) {
      setErrorType('outside');
      setGranted(false);
      logger.log('❌ User outside geofence - blocking app access');
    } else {
      setErrorType(null);
      setGranted(true);
      logger.log('✅ User inside geofence - allowing app access');
    }
    
    // Set initialization complete after first check
    setIsInitializing(false);
  }, [geofenceCenter, geofenceRadius]); // Add geofence dependencies

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
    console.log('🏁 Starting location check and watch');
    
    // Block app access until location is verified
    setIsInitializing(true);
    
    checkLocation().catch(err => {
      console.error('❌ Location check error:', err);
      logger.error('Location check failed:', err);
      setErrorType('timeout');
      setGranted(false);
      setIsInitializing(false);
    });
    
    startWatch().catch(err => {
      console.error('❌ Watch start error:', err);
      logger.error('Location watch failed:', err);
    });
    
    // Poll servicesEnabled every 10s (less frequent to reduce overhead)
    const pollId = setInterval(async () => {
      if (!(await Location.hasServicesEnabledAsync())) {
        console.log('⚠️ GPS services disabled');
        lastPositionRef.current = null;
        setErrorType('services');
        setGranted(false);
      }
    }, 10000);

    return () => {
      console.log('🧹 Cleaning up location watch');
      watchRef.current?.remove();
      clearInterval(pollId);
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

  console.log('📊 Render state - isInitializing:', isInitializing, 'granted:', granted, 'errorType:', errorType);

  return (
    <>
      <RestrictionModal
        visible={!isInitializing && !granted && errorType !== null}
        message={errorType ? ERROR_MESSAGES[errorType] : ''}
        onRetry={retryHandler}
      />
      <View style={styles.container} pointerEvents={granted ? 'auto' : 'none'}>
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
          <Stack.Screen name="noshow-reports-history" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="payment" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="auth" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="view-livestream" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="application" options={{ headerShown: false, animation: 'none' }} />
          </Stack>
        </ErrorBoundary>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});