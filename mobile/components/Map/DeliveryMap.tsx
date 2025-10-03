import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { getUserLocation, LocationData, updateUserLocation, useCurrentLocation } from '../../services/LocationService';
import { LOCATION_CONFIG } from '../../utils/locationConfig';

interface DeliveryMapProps {
  orderId: string;
  userType: 'user' | 'dasher';
  currentUserId: string;
  otherUserId?: string;
  height?: number;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({ 
  orderId, 
  userType,
  currentUserId,
  otherUserId,
  height = 300 
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { location, errorMsg } = useCurrentLocation();
  const [otherLocation, setOtherLocation] = useState<LocationData | null>(null);
  const locationPollRef = useRef<NodeJS.Timeout | null>(null);

  const otherUserType = userType === 'user' ? 'dasher' : 'user';
  const staticDestination = [10.2944327, 123.8802167]; // Static destination position

  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'MAP_READY') {
        setIsMapReady(true);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const updateMapLocations = () => {
    if (!webViewRef.current || !isMapReady) return;
    
    const message = {
      type: 'UPDATE_LOCATIONS',
      userLocation: userType === 'user' ? location : otherLocation,
      dasherLocation: userType === 'dasher' ? location : otherLocation,
      userType: userType // Pass user type to customize markers
    };
    
    webViewRef.current.postMessage(JSON.stringify(message));
  };

  useEffect(() => {
    if (!orderId || !otherUserId || !currentUserId) return;
    
    const pollOtherLocation = async () => {
      try {
        const targetUserId = otherUserId || `${otherUserType}-${orderId}`;
        const fetchedLocation = await getUserLocation(targetUserId, currentUserId);
        if (fetchedLocation) {
          setOtherLocation(fetchedLocation);
          setError(null);
        }
      } catch (error) {
        console.error('Error polling location:', error);
      }
    };
    
    pollOtherLocation();
    locationPollRef.current = setInterval(pollOtherLocation, LOCATION_CONFIG.MAP_UPDATE.pollInterval);
    
    return () => {
      if (locationPollRef.current) {
        clearInterval(locationPollRef.current);
      }
    };
  }, [orderId, otherUserType, otherUserId, currentUserId]);

  useEffect(() => {
    if (!location || !currentUserId || !orderId) return;
    
    const sendLocationUpdate = async () => {
      try {
        const userId = `${userType}-${orderId}`;
        const sharingConfig = {
          isSharing: true,
          shareWithUserIds: otherUserId ? [otherUserId] : [`${otherUserType}-${orderId}`, currentUserId]
        };
        
        const locationWithoutUserId = {
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading,
          speed: location.speed,
          timestamp: location.timestamp
        };
        
        await updateUserLocation(userId, locationWithoutUserId, sharingConfig);
      } catch (error) {
        console.error('Error updating location on server:', error);
      }
    };
    
    sendLocationUpdate();
  }, [location, orderId, userType, currentUserId, otherUserId, otherUserType]);

  // Debounce map updates to prevent flickering
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateMapLocations();
    }, LOCATION_CONFIG.MAP_UPDATE.debounceDelay);

    return () => clearTimeout(timeoutId);
  }, [location, otherLocation, isMapReady]);

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
            onPress={() => useCurrentLocation()}
          >
            <Ionicons name="refresh-outline" size={18} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <Text style={styles.errorHelpText}>Having trouble? Make sure location services are enabled in your device settings.</Text>
        </View>
      </View>
    );
  }

  const htmlContent = createLeafletMapTemplate(
    location?.latitude.toString() || '0',
    location?.longitude.toString() || '0',
    otherLocation?.latitude.toString() || null,
    otherLocation?.longitude.toString() || null,
    userType
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
                onPress={() => {
                  setError(null);
                  webViewRef.current?.reload();
                }}
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
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
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
    marginTop: 12,
    color: '#555',
    fontSize: 15,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 24,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 999,
  },
  errorDialog: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
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
    paddingHorizontal: 10,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  dismissButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 15,
  },
});

const createLeafletMapTemplate = (
  userLatitude: string,
  userLongitude: string,
  otherLatitude: string | null = null,
  otherLongitude: string | null = null,
  userType: 'user' | 'dasher'
): string => {
  const staticDestination = [10.2944327, 123.8802167];
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Delivery Tracking Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    body {
      padding: 0;
      margin: 0;
    }
    html, body, #map {
      height: 100%;
      width: 100%;
    }
    .info-box {
      padding: 10px;
      background: white;
      border-radius: 5px;
      box-shadow: 0 0 15px rgba(0,0,0,0.2);
      position: absolute;
      bottom: 10px;
      left: 10px;
      z-index: 1000;
      max-width: 200px;
      font-family: Arial, sans-serif;
    }
    .info-title {
      font-weight: bold;
      margin-bottom: 5px;
      color: #BC4A4D;
    }
    .info-content {
      font-size: 14px;
      color: #333;
    }
    /* Marker containers */
    .marker-container {
      position: relative;
    }
    
    /* Marker cores */
    .marker-core {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      color: white;
      font-weight: bold;
      text-align: center;
      line-height: 30px;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      z-index: 2;
      position: relative;
    }
    
    .user-marker {
      background-color: #BC4A4D;
    }
    
    .dasher-marker {
      background-color: #3498db;
    }
    
    .destination-marker {
      background-color: ${userType === 'dasher' ? '#BC4A4D' : '#3498db'};
    }
  </style>
</head>
<body>
  <div id="map"></div>
  

  <script>
    // Parse initial coordinates
    const userLatitude = parseFloat('${userLatitude}');
    const userLongitude = parseFloat('${userLongitude}');
    let otherLatitude = ${otherLatitude ? `parseFloat('${otherLatitude}')` : 'null'};
    let otherLongitude = ${otherLongitude ? `parseFloat('${otherLongitude}')` : 'null'};
    const userType = '${userType}';
    const staticDestination = ${JSON.stringify(staticDestination)};
    
    // Initialize map centered on user
    const map = L.map('map').setView([userLatitude, userLongitude], 15);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Create custom markers
    function createUserMarker() {
      return L.divIcon({
        className: 'marker-container',
        html: '<div class="marker-core user-marker">U</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
    }
    
    function createDasherMarker() {
      return L.divIcon({
        className: 'marker-container',
        html: '<div class="marker-core dasher-marker">D</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
    }
    
    function createDestinationMarker() {
      return L.divIcon({
        className: 'marker-container',
        html: '<div class="marker-core destination-marker"> ${userType === 'dasher' ? 'U' : 'D'}</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
    }
    
    // Add current user marker (with pulse if user, without if dasher)
    const currentUserMarker = L.marker([userLatitude, userLongitude], {
      icon: userType === 'user' ? createUserMarker() : createDasherMarker()
    }).addTo(map).bindPopup(userType === 'user' ? 'Your Location' : 'Dasher Location');
    
    // Add static destination marker
    const destinationMarker = L.marker(staticDestination, {
      icon: createDestinationMarker()
    }).addTo(map).bindPopup('Destination');
    
    // Add other user marker if coordinates available
    let otherMarker;
    if (otherLatitude && otherLongitude) {
      const otherType = userType === 'user' ? 'dasher' : 'user';
      otherMarker = L.marker([otherLatitude, otherLongitude], {
        icon: otherType === 'dasher' ? createDasherMarker() : createUserMarker()
      }).addTo(map).bindPopup(otherType === 'dasher' ? 'Dasher Location' : 'User Location');
      
      // Draw lines between points
      const userOtherLine = L.polyline(
        [[userLatitude, userLongitude], [otherLatitude, otherLongitude]],
        {color: '#BC4A4D', weight: 3, opacity: 0.7, dashArray: '10, 10'}
      ).addTo(map);
      
      const destinationLine = L.polyline(
        [[otherLatitude, otherLongitude], staticDestination],
        {color: '#2ecc71', weight: 3, opacity: 0.7, dashArray: '10, 10'}
      ).addTo(map);
      
      // Calculate distance
      const distance = calculateDistance(
        userLatitude, userLongitude,
        otherLatitude, otherLongitude
      );
      
      document.getElementById('status-info').innerText = 
        \`\${otherType === 'dasher' ? 'Dasher' : 'User'} is approximately \${distance.toFixed(1)} km away\`;
    } else {
      document.getElementById('status-info').innerText = 
        \`Waiting for \${userType === 'user' ? 'dasher' : 'user'} location...\`;
    }
    
    // Function to calculate distance in kilometers
    function calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }
    
    // Handle updates from React Native
    window.addEventListener('message', function(event) {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'UPDATE_LOCATIONS') {
          // Update current user location
          if (message.userLocation) {
            const newUserLat = parseFloat(message.userLocation.latitude);
            const newUserLng = parseFloat(message.userLocation.longitude);
            currentUserMarker.setLatLng([newUserLat, newUserLng]);
          }
          
          // Update other user location
          if (message.dasherLocation) {
            const newOtherLat = parseFloat(message.dasherLocation.latitude);
            const newOtherLng = parseFloat(message.dasherLocation.longitude);
            const otherType = message.userType === 'user' ? 'dasher' : 'user';
            
            if (!otherMarker) {
              otherMarker = L.marker([newOtherLat, newOtherLng], {
                icon: otherType === 'dasher' ? createDasherMarker() : createUserMarker()
              }).addTo(map).bindPopup(otherType === 'dasher' ? 'Dasher Location' : 'User Location');
            } else {
              otherMarker.setLatLng([newOtherLat, newOtherLng]);
            }
            
            // Update route lines
            const userPos = currentUserMarker.getLatLng();
            const userOtherLine = L.polyline(
              [[userPos.lat, userPos.lng], [newOtherLat, newOtherLng]],
              {color: '#BC4A4D', weight: 3, opacity: 0.7, dashArray: '10, 10'}
            ).addTo(map);
            
            const destinationLine = L.polyline(
              [[newOtherLat, newOtherLng], staticDestination],
              {color: '#2ecc71', weight: 3, opacity: 0.7, dashArray: '10, 10'}
            ).addTo(map);
            
            // Update distance
            const distance = calculateDistance(
              userPos.lat, userPos.lng,
              newOtherLat, newOtherLng
            );
            
            document.getElementById('status-info').innerText = 
              \`\${otherType === 'dasher' ? 'Dasher' : 'User'} is approximately \${distance.toFixed(1)} km away\`;
            
            // Update map view to include all markers
            const bounds = L.latLngBounds(
              L.latLng(userPos.lat, userPos.lng),
              L.latLng(newOtherLat, newOtherLng),
              L.latLng(staticDestination[0], staticDestination[1])
            );
            map.fitBounds(bounds, {padding: [50, 50]});
          }
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    });
    
    // Signal that the map is ready
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'MAP_READY'
    }));
  </script>
</body>
</html>
  `;
  
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
      {error && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorDialog}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="map-outline" size={30} color="white" />
            </View>
            <Text style={styles.errorText}>Map Error</Text>
            <Text style={styles.errorSubText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => setError(null)}
            >
              <Ionicons name="refresh-outline" size={18} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default React.memo(DeliveryMap);