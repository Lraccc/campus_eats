import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import RestrictionModal from '../components/RestrictionModal';
import { isWithinGeofence } from '../utils/geofence';

const GEOFENCE_CENTER = { lat: 10.295663, lng: 123.880895 };
const GEOFENCE_RADIUS = 5000000;

const ERROR_MESSAGES = {
  services: 'Please enable GPS services to continue.',
  permission: 'Please grant location permission to continue.',
  timeout: 'Unable to determine your location. Please try again.',
  outside: 'You must be within the service area to use this app.',
} as const;
type ErrorType = keyof typeof ERROR_MESSAGES;

export default function RootLayout() {
  const [granted, setGranted] = useState(true);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const lastPositionRef = useRef<Location.LocationObject | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const checkLocation = useCallback(async () => {
    // 1) Services
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      lastPositionRef.current = null;
      setErrorType('services');
      setGranted(false);
      return;
    }
    // 2) Permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      lastPositionRef.current = null;
      setErrorType('permission');
      setGranted(false);
      return;
    }
    // 3) Get position
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        timeout: 10000,
      });
      lastPositionRef.current = pos;
    } catch {
      // fallback to last known only if still enabled
      if (!lastPositionRef.current) {
        setErrorType('timeout');
        setGranted(false);
        return;
      }
    }
    // 4) Geofence
    const { latitude, longitude } = lastPositionRef.current!.coords;
    const inside = isWithinGeofence(
      latitude,
      longitude,
      GEOFENCE_CENTER.lat,
      GEOFENCE_CENTER.lng,
      GEOFENCE_RADIUS
    );
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
    setGranted(true);
    setErrorType(null);
    checkLocation();
    startWatch();
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
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="apply-shop" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/index" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/add-item" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/items" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/update" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/[id]" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="shop/incoming-orders" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="dasher" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="history-order" options={{ headerShown: false, animation: 'none' }} />
        </Stack>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});