import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { LocationData, getMultipleUserLocations, updateUserLocation, useCurrentLocation } from '../../services/LocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SharedLocationsMapProps {
  currentUserId: string;
  userIdsToTrack: string[]; // IDs of users whose locations to display
  height?: number;
  title?: string;
  autoShareLocation?: boolean; // Whether to automatically share current user's location
}

interface WebViewMessage {
  type: string;
  [key: string]: any;
}

const SharedLocationsMap: React.FC<SharedLocationsMapProps> = ({
  currentUserId,
  userIdsToTrack,
  height = 300,
  title = 'Shared Locations',
  autoShareLocation = true
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { location, errorMsg } = useCurrentLocation();
  const [otherLocations, setOtherLocations] = useState<Record<string, LocationData>>({});
  const locationPollRef = useRef<NodeJS.Timeout | null>(null);

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
    
    const allLocations: Record<string, LocationData> = { ...otherLocations };
    
    // Add current user's location if available
    if (location) {
      allLocations[currentUserId] = {
        ...location,
        userId: currentUserId
      };
    }
    
    const message = {
      type: 'UPDATE_ALL_LOCATIONS',
      locations: allLocations
    };
    
    webViewRef.current.postMessage(JSON.stringify(message));
  };

  // Poll for all tracked users' locations
  useEffect(() => {
    if (!currentUserId || userIdsToTrack.length === 0) return;
    
    const pollLocations = async () => {
      try {
        const fetchedLocations = await getMultipleUserLocations(userIdsToTrack, currentUserId);
        if (Object.keys(fetchedLocations).length > 0) {
          setOtherLocations(fetchedLocations);
          setError(null);
        }
      } catch (error) {
        console.error('Error polling locations:', error);
      }
    };
    
    // Initial poll
    pollLocations();
    
    // Set up polling interval
    locationPollRef.current = setInterval(pollLocations, 5000);
    
    return () => {
      if (locationPollRef.current) {
        clearInterval(locationPollRef.current);
      }
    };
  }, [currentUserId, userIdsToTrack]);

  // Share our location when it changes (if autoShareLocation is true)
  useEffect(() => {
    if (!location || !currentUserId || !autoShareLocation) return;
    
    const shareLocation = async () => {
      try {
        const locationWithoutUserId = {
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading,
          speed: location.speed,
          timestamp: location.timestamp
        };
        
        // Share with all users being tracked, plus a wildcard option for admins
        await updateUserLocation(currentUserId, locationWithoutUserId, {
          isSharing: true,
          shareWithUserIds: [...userIdsToTrack, '*']
        });
      } catch (error) {
        console.error('Error sharing location:', error);
      }
    };
    
    shareLocation();
  }, [location, currentUserId, autoShareLocation, userIdsToTrack]);

  // Update map when locations change
  useEffect(() => {
    updateMapLocations();
  }, [location, otherLocations, isMapReady]);

  // Show error if location permission was denied
  if (errorMsg && autoShareLocation) {
    return (
      <View style={[styles.container, height ? { height } : undefined]}>
        <Text style={styles.errorText}>
          {errorMsg}
        </Text>
      </View>
    );
  }

  // Create HTML content for the map
  const createSharedLocationsMapTemplate = () => {
    // Default to current location or Manila if not available
    const centerLat = location?.latitude.toString() || '14.653836';
    const centerLng = location?.longitude.toString() || '121.068427';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <title>${title}</title>
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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="info-box">
        <div class="info-title">${title}</div>
        <div class="info-content" id="status-info">Tracking locations...</div>
      </div>

      <script>
        // Initialize map centered on specified coordinates
        const map = L.map('map').setView([${centerLat}, ${centerLng}], 15);
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Store markers by user ID
        const userMarkers = {};
        
        // Create custom user-style marker for destination
        const destinationIcon = L.divIcon({
          className: 'user-marker',
          html: '<div class="user-marker-circle"><div class="user-marker-dot"></div></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        
        // Add the static destination marker
        const destinationMarker = L.marker([10.2944327, 123.8812167], {icon: destinationIcon})
          .addTo(map)
          .bindPopup('Destination');
        
        // Custom marker icon colors (will rotate through these for different users)
        const markerColors = [
          'blue', 'red', 'green', 'orange', 'yellow', 'violet', 
          'grey', 'black', 'gold', 'darkred', 'darkblue'
        ];
        
        // Create a marker icon with a specific color
        function createMarkerIcon(colorIndex) {
          const color = markerColors[colorIndex % markerColors.length];
          return L.icon({
            iconUrl: \`https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-\${color}.png\`,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            shadowSize: [41, 41]
          });
        }
        
        // Function to update markers for all users
        function updateMarkers(locations) {
          const userIds = Object.keys(locations);
          const bounds = [];
          
          // Update status message
          document.getElementById('status-info').innerText = 
            userIds.length > 0 ? \`Tracking \${userIds.length} users\` : 'Waiting for location data...';
          
          userIds.forEach((userId, index) => {
            const location = locations[userId];
            const position = [location.latitude, location.longitude];
            
            // Add position to bounds for map centering
            bounds.push(position);
            
            if (userMarkers[userId]) {
              // Update existing marker
              userMarkers[userId].setLatLng(position);
            } else {
              // Create new marker with unique color based on index
              userMarkers[userId] = L.marker(position, {
                icon: createMarkerIcon(index)
              })
              .addTo(map)
              .bindPopup(\`User: \${userId}\`);
            }
          });
          
          // Add static destination to bounds
          bounds.push([10.3120896, 123.9154688]);
          
          // Adjust map to show all markers
          if (bounds.length > 0) {
            map.fitBounds(L.latLngBounds(bounds), {
              padding: [50, 50],
              maxZoom: 15
            });
          }
        }
        
        // Setup message listener for updates from React Native
        window.addEventListener('message', function(event) {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'UPDATE_ALL_LOCATIONS') {
              // Update markers when locations are received
              if (message.locations) {
                updateMarkers(message.locations);
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
  };

  return (
    <View style={[styles.container, height ? { height } : undefined]}>
      {autoShareLocation && !location ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BC4A4D" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: createSharedLocationsMapTemplate() }}
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

export default SharedLocationsMap;
