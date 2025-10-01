import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import RestrictionModal from '../components/RestrictionModal';
import { isWithinGeofence } from '../utils/geofence';
import { crashReporter } from '../utils/crashReporter';
import { productionLogger } from '../utils/productionLogger';
import ErrorBoundary from '../components/ErrorBoundary';

const GEOFENCE_CENTER = { lat: 10.295663, lng: 123.880895 };
const GEOFENCE_RADIUS = 100000; // 100km radius - more reasonable for campus area

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
  const lastPositionRef = useRef<Location.LocationObject | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

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
      try {
        await crashReporter.init();
        await productionLogger.init();
        console.log('🚀 Logging systems initialized');
      } catch (error) {
        console.error('Failed to initialize logging systems:', error);
      }
    };
    
    initializeLogging();
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
        setTimeout(() => reject(new Error('Location request timed out')), 10000) // Increased timeout
      );
      
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Changed from Highest to Balanced for faster response
      });
      
      const pos = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;
      lastPositionRef.current = pos;
      console.log('📍 Current position:', pos.coords.latitude, pos.coords.longitude);
    } catch (error) {
      console.log('❌ Failed to get current position:', error);
      // fallback to last known only if still enabled
      if (!lastPositionRef.current) {
        setErrorType('timeout');
        setGranted(false);
        return;
      }
      console.log('📍 Using last known position:', lastPositionRef.current.coords.latitude, lastPositionRef.current.coords.longitude);
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
  }, []);

  const startWatch = useCallback(async () => {
    watchRef.current?.remove();
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      () => checkLocation()
    );
  }, [checkLocation]);

  const retryHandler = useCallback(() => {
    console.log('🔄 Retry button pressed');
    setErrorType(null);
    
    // Add a small delay to prevent immediate re-triggering
    setTimeout(() => {
      checkLocation();
      startWatch();
    }, 1000);
  }, [checkLocation, startWatch]);

  useEffect(() => {
    checkLocation();
    startWatch();
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

  return (
    <>
      <RestrictionModal
        visible={!granted}
        message={errorType ? ERROR_MESSAGES[errorType] : ''}
        onRetry={retryHandler}
      />
      <View style={styles.container} pointerEvents={granted ? 'auto' : 'none'}>
        <ErrorBoundary>
          <Stack>
          <Stack.Screen name="landing" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="home" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="signup" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="cart" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="profile" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="order" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="verification-success" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="otp-verification" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="forgot-password" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="(tabs)/checkout" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="(tabs)/edit-profile" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="apply-shop" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/index" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/add-item" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/items" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/update" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/[id]" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/incoming-orders" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/cashout" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/edit-item/[id]" options={{ headerShown: false, animation: 'none' }} />
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