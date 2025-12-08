import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LatLng } from 'react-native-maps';
import { getUserLocationFromServer, updateDasherLocationOnServer, useCurrentLocation } from '../../services/LocationService';
import LeafletMap from './LeafletMap';

export interface DeliveryMapProps {
  orderId: string;
  height: number;
  currentUserId: string;
  userType?: 'dasher' | 'customer' | 'shop';
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({ orderId, height = 300 }) => {
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [statusText, setStatusText] = useState<string>('');

  const { location, errorMsg } = useCurrentLocation();
  const [customerLocation, setCustomerLocation] = useState<LatLng | null>(null);
  const locationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);

  // Poll customer location from backend
  useEffect(() => {
    if (!orderId) return;
    const pollUser = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const res = await getUserLocationFromServer(orderId);
        if (res && res.latitude != null && res.longitude != null) {
          const lat = typeof res.latitude === 'string' ? parseFloat(res.latitude) : res.latitude;
          const lng = typeof res.longitude === 'string' ? parseFloat(res.longitude) : res.longitude;
          setCustomerLocation({ latitude: lat, longitude: lng });
          setError(null);
        }
      } catch (e) {
        // ignore intermittent errors
      } finally {
        isPollingRef.current = false;
      }
    };

    locationPollRef.current = setInterval(pollUser, 4000);
    pollUser();

    return () => {
      if (locationPollRef.current) {
        clearInterval(locationPollRef.current);
        locationPollRef.current = null;
      }
    };
  }, [orderId]);

  // Send dasher (this device) location to backend
  useEffect(() => {
    if (!orderId || !location) return;
    (async () => {
      try {
        await updateDasherLocationOnServer(orderId, {
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading ?? 0,
          speed: location.speed ?? 0,
        });
      } catch {
        // ignore
      }
    })();
  }, [orderId, location?.latitude, location?.longitude]);

  // Compute status text
  useEffect(() => {
    if (!location || !customerLocation) {
      setStatusText('Waiting for customer location...');
      return;
    }
    const km = haversine(
      customerLocation.latitude, customerLocation.longitude,
      location.latitude, location.longitude
    );
    const approx = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
    setStatusText(`Dasher is approximately ${approx} away`);
  }, [location?.latitude, location?.longitude, customerLocation?.latitude, customerLocation?.longitude]);

  // Haversine (km)
  function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

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
          <Text style={styles.errorHelpText}>Make sure location services are enabled.</Text>
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

  const dasherCoords: LatLng = { latitude: location.latitude, longitude: location.longitude };
  const userCoords: LatLng = customerLocation ?? dasherCoords;

  return (
    <View style={[styles.container, { height: isExpanded ? 500 : height }]}>
      <LeafletMap
        height={isExpanded ? 500 : height}
        userLocation={userCoords}             // U marker (customer)
        dasherLocation={dasherCoords}         // D marker (dasher/device)
        focusOn="user"
      />

      {/* Status bar with text only */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{statusText || 'Tracking delivery...'}</Text>
      </View>

      {/* Floating expand/collapse button at lower-right over the map */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setIsExpanded(prev => !prev)}
      >
        <Ionicons
          name={isExpanded ? 'contract-outline' : 'expand-outline'}
          size={18}
          color="white"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.expandButtonText}>{isExpanded ? 'Collapse' : 'Expand'}</Text>
      </TouchableOpacity>

      {error && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorDialog}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="map-outline" size={30} color="white" />
            </View>
            <Text style={styles.errorText}>Map Error</Text>
            <Text style={styles.errorSubText}>{error}</Text>
            <View style={styles.errorButtonsContainer}>
              <TouchableOpacity 
                style={styles.dismissButton}
                onPress={() => setError(null)}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => setError(null)}
              >
                <Ionicons name="refresh-outline" size={18} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.retryButtonText}>Reload Map</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
    position: 'relative', // enable absolute positioning for floating button
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  statusText: { color: '#333', fontSize: 14, fontWeight: '500' },
  expandButtonText: { color: 'white', fontWeight: 'bold' },

  // Floating button
  floatingButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#BC4A4D',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
  },

  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  loadingText: {
    marginTop: 12,
    color: '#555',
    fontSize: 15,
    fontWeight: '500',
  },
  marker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  dasherMarker: { backgroundColor: '#3498db'},
  userMarker: { backgroundColor: '#BC4A4D' },
  markerText: { color: 'white', fontWeight: 'bold' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 999,
  },
  errorDialog: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
    elevation: 5,
  },
  errorIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#BC4A4D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorText: {
    color: '#333',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  errorSubText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 20,
  },
  errorHelpText: {
    color: '#888',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 16,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  errorButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#BC4A4D',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  dismissButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  retryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  dismissButtonText: { color: '#666', fontWeight: 'bold', fontSize: 15 },
});

export default DeliveryMap;