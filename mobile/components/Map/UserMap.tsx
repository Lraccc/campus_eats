import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LatLng } from 'react-native-maps';
import { getDasherLocationFromServer, updateUserLocationOnServer, useCurrentLocation } from '../../services/LocationService';
import LeafletMap from './LeafletMap';

interface UserMapProps {
  orderId: string;
  height?: number;
}

const UserMap: React.FC<UserMapProps> = ({ orderId, height = 300 }) => {
  const locationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);
  const { location, errorMsg } = useCurrentLocation();
  const [dasherLocation, setDasherLocation] = useState<LatLng | null>(null);

  // Post user location to backend
  useEffect(() => {
    if (!orderId || !location) return;
    (async () => {
      try {
        await updateUserLocationOnServer(orderId, {
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading ?? 0,
          speed: location.speed ?? 0,
        });
      } catch {}
    })();
  }, [orderId, location]);

  // Poll dasher location
  useEffect(() => {
    if (!orderId) return;
    const pollDasher = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const res = await getDasherLocationFromServer(orderId);
        if (res && res.latitude != null && res.longitude != null) {
          const lat = typeof res.latitude === 'string' ? parseFloat(res.latitude) : res.latitude;
          const lng = typeof res.longitude === 'string' ? parseFloat(res.longitude) : res.longitude;
          setDasherLocation({ latitude: lat, longitude: lng });
        }
      } finally {
        isPollingRef.current = false;
      }
    };
    pollDasher();
    locationPollRef.current = setInterval(pollDasher, 5000);
    return () => { if (locationPollRef.current) clearInterval(locationPollRef.current); };
  }, [orderId]);

  if (errorMsg) {
    return (
      <View style={[styles.container, height ? { height } : undefined]}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="location-outline" size={30} color="white" />
          </View>
          <Text style={styles.errorText}>Location Error</Text>
          <Text style={styles.errorSubText}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => Linking.openSettings()}
          >
            <Ionicons name="refresh-outline" size={18} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={[styles.container, height ? { height } : undefined, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#BC4A4D" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  const userCoords: LatLng = { latitude: location.latitude, longitude: location.longitude };

  return (
    <View style={[styles.container, height ? { height } : undefined]}>
      <LeafletMap
        height={height}
        userLocation={userCoords}             // U marker (you)
        dasherLocation={dasherLocation}       // D marker (dasher)
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9',
  },
  loadingText: { marginTop: 12, color: '#555', fontSize: 15, fontWeight: '500' },
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 24,
  },
  errorIconContainer: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#BC4A4D',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  errorText: { color: '#333', fontSize: 18, fontWeight: 'bold', marginTop: 8 },
  errorSubText: { color: '#666', textAlign: 'center', fontSize: 14, marginTop: 12, marginBottom: 16 },
  retryButton: {
    backgroundColor: '#BC4A4D', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  retryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  markerCoreUser: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#BC4A4D',
    justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3,
  },
  markerCoreDasher: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#3498db',
    justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3,
  },
  markerText: { color: '#fff', fontWeight: 'bold' },
});

export default UserMap;