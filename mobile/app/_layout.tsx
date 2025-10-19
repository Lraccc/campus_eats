import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, Text, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RestrictionModal from '../components/RestrictionModal';
import { isWithinGeofence } from '../utils/geofence';
import { crashReporter } from '../utils/crashReporter';
import { productionLogger } from '../utils/productionLogger';
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
          console.log('🚀 First app launch detected - showing splash screen');
        } else {
          setIsFirstLaunch(false);
          console.log('🔄 Subsequent app launch - skipping splash screen');
        }
      } catch (error) {
        console.error('Error checking first launch:', error);
        setIsFirstLaunch(false);
      }
    };
    checkFirstLaunch();
  }, []);

  // Handle deep links for authentication
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('🔗 Deep link received:', url);
      
      // Handle Microsoft authentication redirect
      if (url.startsWith('campuseats://auth')) {
        console.log('🔐 Authentication deep link detected');
        // The expo-auth-session will automatically handle this
        // We just need to log it for debugging
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

  // Initialize crash reporter and production logger
  useEffect(() => {
    const initializeLogging = async () => {
      // Initialize crash reporter with fallback
      try {
        console.log('🔧 Initializing crash reporter...');
        await crashReporter.init();
        console.log('✅ Crash reporter initialized');
      } catch (crashReporterError) {
        console.error('❌ Crash reporter failed to initialize:', crashReporterError);
      }

      // Initialize production logger with fallback
      try {
        console.log('🔧 Initializing production logger...');
        await productionLogger.init();
        console.log('✅ Production logger initialized');
      } catch (loggerError) {
        console.error('❌ Production logger failed to initialize:', loggerError);
      }

      console.log('🚀 Logging initialization complete');
    };
    
    // Use setTimeout to ensure this doesn't block the UI
    setTimeout(initializeLogging, 100);
  }, []);

  const checkLocation = useCallback(async () => {
    console.log('🔍 Starting location check...');
    
    // 1) Services
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    console.log('📍 GPS Services enabled:', servicesEnabled);
    if (!servicesEnabled) {
      lastPositionRef.current = null;
      setErrorType('services');
      setGranted(false);
      setIsInitializing(false);
      return;
    }
    
    // 2) Permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('🔐 Location permission status:', status);
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
      lastPositionRef.current = pos;
      console.log('📍 Current position:', pos.coords.latitude, pos.coords.longitude);
    } catch (error) {
      console.log('❌ Failed to get current position:', error);
      // For development, allow the app to continue without exact location
      console.log('⚠️ Proceeding without exact location - will assume valid area for development');
      
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
    
    console.log('🗺️ Distance from center:', Math.round(distance), 'meters');
    console.log('🎯 Geofence radius:', GEOFENCE_RADIUS, 'meters');
    console.log('✅ Inside geofence:', inside);
    
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
    console.log('🔄 Retry button pressed');
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
      console.log('⏰ Maximum initialization timeout reached - proceeding to app');
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
          <Stack.Screen name="debug" options={{ headerShown: true, title: 'Debug Panel' }} />
          </Stack>
        </ErrorBoundary>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});