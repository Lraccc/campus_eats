import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import RestrictionModal from '../components/RestrictionModal';
import { isWithinGeofence } from '../utils/geofence';

export default function RootLayout() {
  const [accessState, setAccessState] = useState({
    granted: null as boolean | null,
    locationEnabled: false,
    inServiceArea: false,
    errorType: null as string | null,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const geofenceCenter = { lat: 10.295663, lng: 123.880895 };
  const geofenceRadius = 50000;

  const getErrorMessage = (errorType: string | null) => {
    switch (errorType) {
      case 'permission':
        return 'Location access has been disabled. Please enable location permissions to continue.';
      case 'gps':
        return 'Location services are disabled. Please enable GPS to continue.';
      case 'outside':
        return 'You must be within the service area to use this app.';
      case 'timeout':
        return 'Unable to determine your location. Please check your GPS signal and try again.';
      default:
        return 'Unable to determine your location. Please check your GPS settings and try again.';
    }
  };

  const checkGeofence = async () => {
    try {
      // Check and request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAccessState({
          granted: false,
          locationEnabled: false,
          inServiceArea: false,
          errorType: 'permission',
        });
        setModalMessage(getErrorMessage('permission'));
        setModalVisible(true);
        return false;
      }

      // Check if location services are enabled
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        setAccessState({
          granted: false,
          locationEnabled: false,
          inServiceArea: false,
          errorType: 'gps',
        });
        setModalMessage(getErrorMessage('gps'));
        setModalVisible(true);
        return false;
      }

      // Get current position with timeout
      let location: Location.LocationObject;
      try {
        location = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 10000)
          ),
        ]);
      } catch (error: any) {
        console.error('Location error:', error);
        setAccessState({
          granted: false,
          locationEnabled: true,
          inServiceArea: false,
          errorType: error.message === 'timeout' ? 'timeout' : 'other',
        });
        setModalMessage(getErrorMessage(error.message === 'timeout' ? 'timeout' : 'other'));
        setModalVisible(true);
        return false;
      }

      // Check if within geofence
      const isInside = isWithinGeofence(
        location.coords.latitude,
        location.coords.longitude,
        geofenceCenter.lat,
        geofenceCenter.lng,
        geofenceRadius
      );

      setAccessState({
        granted: isInside,
        locationEnabled: true,
        inServiceArea: isInside,
        errorType: isInside ? null : 'outside',
      });

      if (!isInside) {
        setModalMessage(getErrorMessage('outside'));
        setModalVisible(true);
      } else {
        setModalVisible(false);
      }
      
      return isInside;
    } catch (error) {
      console.error('Unexpected error:', error);
      setAccessState({
        granted: false,
        locationEnabled: false,
        inServiceArea: false,
        errorType: 'other',
      });
      setModalMessage(getErrorMessage('other'));
      setModalVisible(true);
      return false;
    }
  };

  const startWatching = async () => {
    // Clear any existing watcher
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }

    try {
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 100,
          timeInterval: 10000,
        },
        (location: Location.LocationObject) => {
          const isInside = isWithinGeofence(
            location.coords.latitude,
            location.coords.longitude,
            geofenceCenter.lat,
            geofenceCenter.lng,
            geofenceRadius
          );

          setAccessState((prev) => ({
            ...prev,
            granted: isInside,
            inServiceArea: isInside,
            errorType: isInside ? null : 'outside',
          }));

          if (!isInside) {
            setModalMessage(getErrorMessage('outside'));
            setModalVisible(true);
          } else if (modalVisible) {
            setModalVisible(false);
          }
        },
        (error) => {
          // This callback handles watcher errors
          console.error('Location watcher error:', error);
          if (error.code === 'E_LOCATION_PERMISSION_DENIED') {
            // Permission was revoked while watching
            setAccessState({
              granted: false,
              locationEnabled: false,
              inServiceArea: false,
              errorType: 'permission',
            });
            setModalMessage(getErrorMessage('permission'));
            setModalVisible(true);
          }
        }
      );
    } catch (error) {
      console.error('Failed to start location watcher:', error);
    }
  };

  useEffect(() => {
    // Initial check
    checkGeofence().then((granted) => {
      if (granted) {
        startWatching();
      }
    });

    // Set up periodic permission checks (every 1 second)
    checkIntervalRef.current = setInterval(() => {
      checkGeofence();
    }, 1000);

    // Listen for app state changes (when app comes to foreground)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkGeofence();
      }
    });

    // Clean up on unmount
    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      subscription.remove();
    };
  }, []);

  const handleRetry = async () => {
    const granted = await checkGeofence();
    if (granted) {
      startWatching();
    }
  };

  if (accessState.granted === null) {
    return (
      <View style={styles.loadingContainer}>
        {/* Add your loading indicator here */}
      </View>
    );
  }

  return (
    <>
      <RestrictionModal
        visible={modalVisible}
        message={modalMessage}
      />

      {/* Block interaction when restricted */}
      <View style={[styles.container, !accessState.granted && styles.blocked]}>
        <Stack>
          <Stack.Screen name="landing" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="home" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="signup" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="restricted" options={{ headerShown: false, animation: 'none' }} />
        </Stack>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blocked: {
    opacity: 0.5,
    pointerEvents: 'none',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});