import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { createDeliveryMapTemplate } from './DeliveryMapTemplate';
import { LocationData, useCurrentLocation, getLocationFromServer, updateLocationOnServer } from '../../services/LocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';

interface DeliveryMapProps {
  orderId: string;
  userType: 'user' | 'dasher';
  height?: number; // Only allow number for height to avoid type errors
}

interface WebViewMessage {
  type: string;
  [key: string]: any;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({ 
  orderId, 
  userType,
  height = 300 
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { location, errorMsg } = useCurrentLocation();
  const [otherLocation, setOtherLocation] = useState<LocationData | null>(null);
  const locationPollRef = useRef<NodeJS.Timeout | null>(null);

  // Determine the other user type (if user, then dasher; if dasher, then user)
  const otherUserType = userType === 'user' ? 'dasher' : 'user';

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'MAP_READY') {
        setIsMapReady(true);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  // Update locations in the WebView
  const updateMapLocations = () => {
    if (!webViewRef.current || !isMapReady) return;
    
    const message = {
      type: 'UPDATE_LOCATIONS',
      userLocation: userType === 'user' ? location : otherLocation,
      dasherLocation: userType === 'dasher' ? location : otherLocation
    };
    
    webViewRef.current.postMessage(JSON.stringify(message));
  };

  // Poll for the other user's location
  useEffect(() => {
    if (!orderId) return;
    
    const pollOtherLocation = async () => {
      try {
        const fetchedLocation = await getLocationFromServer(orderId, otherUserType);
        if (fetchedLocation) {
          setOtherLocation(fetchedLocation);
          // Clear any previous error since we got data successfully
          setError(null);
        }
      } catch (error) {
        console.error('Error polling location:', error);
        // Don't set error UI as the LocationService now provides fallback data
      }
    };
    
    // Initial poll
    pollOtherLocation();
    
    // Set up polling interval
    locationPollRef.current = setInterval(pollOtherLocation, 5000);
    
    return () => {
      if (locationPollRef.current) {
        clearInterval(locationPollRef.current);
      }
    };
  }, [orderId, otherUserType]);

  // Update server with our location when it changes
  useEffect(() => {
    if (!location || !orderId) return;
    
    const sendLocationUpdate = async () => {
      try {
        await updateLocationOnServer(orderId, location, userType);
      } catch (error) {
        console.error('Error updating location on server:', error);
      }
    };
    
    sendLocationUpdate();
  }, [location, orderId, userType]);

  // Update map when locations change
  useEffect(() => {
    updateMapLocations();
  }, [location, otherLocation, isMapReady]);

  // Show error if location permission was denied
  if (errorMsg) {
    return (
      <View style={[styles.container, height ? { height } : undefined]}>
        <Text style={styles.errorText}>
          {errorMsg}
        </Text>
      </View>
    );
  }

  // Create HTML content for the map
  const htmlContent = createDeliveryMapTemplate(
    location?.latitude.toString() || '0',
    location?.longitude.toString() || '0',
    otherLocation?.latitude.toString() || null,
    otherLocation?.longitude.toString() || null
  );

  return (
    <View style={[styles.container, height ? { height } : undefined]}>
      {!location ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BC4A4D" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webView}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#BC4A4D" />
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setError(`WebView error: ${nativeEvent.description}`);
          }}
        />
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  loadingText: {
    marginTop: 10,
    color: '#555',
    fontSize: 14,
  },
  errorText: {
    color: '#BC4A4D',
    textAlign: 'center',
    padding: 10,
  },
});

export default DeliveryMap;
