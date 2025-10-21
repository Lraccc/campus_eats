import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { getDasherLocationFromServer, updateUserLocationOnServer } from '../../utils/LocationService';
import '../css/DeliveryMap.css';

// Fix Leaflet marker icon issue in webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// MapUpdater component to keep map centered on the selected location
const MapUpdater = ({ user, dasher, fallbackCenter, fallbackZoom = 17 }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Always make sure map tiles layout correctly after container size changes
    setTimeout(() => map.invalidateSize(), 0);

    // If both points exist, fit bounds with padding and a reasonable max zoom
    if (user && dasher) {
      const bounds = L.latLngBounds(
        [user.latitude, user.longitude],
        [dasher.latitude, dasher.longitude]
      );
      map.fitBounds(bounds.pad(0.25), {
        animate: true,
        padding: [40, 40],
        maxZoom: 18,
      });
      return;
    }

    // If only one exists, center on it
    if (user) {
      map.setView([user.latitude, user.longitude], Math.min(map.getZoom() || fallbackZoom, 18), { animate: true });
      return;
    }
    if (dasher) {
      map.setView([dasher.latitude, dasher.longitude], Math.min(map.getZoom() || fallbackZoom, 18), { animate: true });
      return;
    }

    // Fallback (no points yet)
    if (fallbackCenter) {
      map.setView(fallbackCenter, fallbackZoom, { animate: true });
    }
  }, [
    map,
    user?.latitude,
    user?.longitude,
    dasher?.latitude,
    dasher?.longitude,
    fallbackCenter?.[0],
    fallbackCenter?.[1],
    fallbackZoom,
  ]);

  return null;
};

const DeliveryMap = ({ orderId, userType, height = 300 }) => {
  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [dasherLocation, setDasherLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const locationPollRef = useRef(null);
  const [distance, setDistance] = useState(null);
  const [lastDasherUpdate, setLastDasherUpdate] = useState(null);
  const [dasherOffline, setDasherOffline] = useState(false);
  const userWatchIdRef = useRef(null); // <-- add


  // Define location update handler
  const handleLocationUpdate = (locationData, error) => {
    if (error) {
      setErrorMsg(error);
      return;
    }
    
    // Convert strings to numbers if needed
    const processedLocation = {
      ...locationData,
      latitude: typeof locationData.latitude === 'string' ? parseFloat(locationData.latitude) : locationData.latitude,
      longitude: typeof locationData.longitude === 'string' ? parseFloat(locationData.longitude) : locationData.longitude,
      heading: typeof locationData.heading === 'string' ? parseFloat(locationData.heading) : locationData.heading,
      speed: typeof locationData.speed === 'string' ? parseFloat(locationData.speed) : locationData.speed,
    };
    
    setLocation(processedLocation);
  };

  // Poll for dasher's location with enhanced reliability
  useEffect(() => {
    if (!orderId) return;
    
    const pollDasherLocation = async () => {
      try {
        const locationData = await getDasherLocationFromServer(orderId);

        if (locationData) {
          // Convert strings to numbers if needed
          const processedLocation = {
            ...locationData,
            latitude: typeof locationData.latitude === 'string' ? parseFloat(locationData.latitude) : locationData.latitude,
            longitude: typeof locationData.longitude === 'string' ? parseFloat(locationData.longitude) : locationData.longitude,
            heading: typeof locationData.heading === 'string' ? parseFloat(locationData.heading) : locationData.heading,
            speed: typeof locationData.speed === 'string' ? parseFloat(locationData.speed) : locationData.speed,
          };
          
          // Check if there's a timestamp in the data
          if (locationData.timestamp) {
            // Parse the timestamp (assuming ISO format)
            const updateTime = new Date(locationData.timestamp);
            const now = new Date();
            const minutesSinceUpdate = (now - updateTime) / (1000 * 60);
            
            setLastDasherUpdate(updateTime);
            
            // If the last update is more than 2 minutes old, consider the dasher offline
            if (minutesSinceUpdate > 2) {
              console.warn(`Dasher location is stale (${Math.round(minutesSinceUpdate)} minutes old)`);
              setDasherOffline(true);
            } else {
              setDasherOffline(false);
            }
          }
          
          setDasherLocation(processedLocation);
        } else {
          console.log('No dasher location data available yet');
        }
      } catch (error) {
        console.error('Error fetching dasher location:', error);
      }
    };
    
    // Initial poll
    pollDasherLocation();
    
    // Set up polling interval - poll more frequently to catch dasher updates
    locationPollRef.current = setInterval(pollDasherLocation, 3000);
    
    return () => {
      if (locationPollRef.current) {
        clearInterval(locationPollRef.current);
      }
    };
  }, [orderId]);

    // Recompute distance when both points exist (optional)
  useEffect(() => {
    if (!location || !dasherLocation) return;
    const meters = L.latLng(location.latitude, location.longitude)
      .distanceTo(L.latLng(dasherLocation.latitude, dasherLocation.longitude));
    setDistance(meters);
  }, [location, dasherLocation]);
  
  // Start/track user's device location
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setErrorMsg('Geolocation not supported');
      setLoading(false);
      return;
    }

    const onSuccess = (pos) => {
      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      handleLocationUpdate({
        latitude,
        longitude,
        accuracy: accuracy ?? 0,
        heading: heading ?? 0,
        speed: speed ?? 0,
        timestamp: new Date().toISOString()
      });
      setLoading(false);
    };

    const onError = (err) => {
      setErrorMsg(err.message || 'Failed to get location');
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 0
    });

    userWatchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true, timeout: 15000, maximumAge: 0
    });

    return () => {
      if (userWatchIdRef.current) {
        navigator.geolocation.clearWatch(userWatchIdRef.current);
        userWatchIdRef.current = null;
      }
    };
  }, [orderId]);

  // Send location updates to server
  useEffect(() => {
    if (!location || !orderId) return;
    
    const sendLocationUpdate = async () => {
      try {
        // Ensure we send strings to the server
        const locationForServer = {
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          heading: location.heading ? location.heading.toString() : '0',
          speed: location.speed ? location.speed.toString() : '0',
          timestamp: new Date().toISOString()
        };
        
        await updateUserLocationOnServer(orderId, locationForServer);
      } catch (error) {
        console.error('Error updating location on server:', error);
      }
    };

    sendLocationUpdate();
    
    // Update every 5 seconds
    const updateInterval = setInterval(sendLocationUpdate, 5000);
    
    return () => {
      clearInterval(updateInterval);
    };
  }, [location, orderId]);

  // Determine best map center
  const getMapCenter = () => {
    if (location && dasherLocation) {
      // Calculate midpoint to show both markers
      return [
        (location.latitude + dasherLocation.latitude) / 2, 
        (location.longitude + dasherLocation.longitude) / 2
      ];
    }
    if (location) return [location.latitude, location.longitude];
    if (dasherLocation) return [dasherLocation.latitude, dasherLocation.longitude];
    return null;
  };

  // Format time since last update
  const formatTimeSince = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  // Format distance for display
  const formatDistance = (meters) => {
    if (meters === null) return 'Calculating...';
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(2)} km`;
    }
  };

  if (errorMsg) {
    return (
      <div className="delivery-map-error" style={{ height }}>
        <p>Error: {errorMsg}</p>
        <button 
          className="dm-retry-btn"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="delivery-map-container" style={{ height }}>
      {getMapCenter() && (
        <MapContainer 
          center={getMapCenter()} 
          zoom={17} 
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* User marker with pulsing effect */}
          {location && (
            <Marker 
              position={[location.latitude, location.longitude]} 
              icon={L.divIcon({
                className: 'user-marker-container',
                html: `
                  <div class="user-marker-pulse"></div>
                  <div class="user-marker-core">U</div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
              })}
            >
              <Popup>
                Your location
              </Popup>
            </Marker>
          )}
          
          {/* Dasher marker */}
          {dasherLocation && (
            <Marker 
              position={[dasherLocation.latitude, dasherLocation.longitude]}
              icon={L.divIcon({
                className: dasherOffline ? 'offline-marker-container' : 'other-marker-container',
                html: `<div class="${dasherOffline ? 'offline-marker-core' : 'other-marker-core'}">D</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
              })}
            >
              <Popup>
                <div>
                  <strong>Dasher location</strong>
                  {lastDasherUpdate && (
                    <div className="dasher-last-update">
                      Updated: {formatTimeSince(lastDasherUpdate)}
                    </div>
                  )}
                  {dasherOffline && (
                    <div className="dasher-offline-notice">
                      Dasher may be temporarily offline
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Add a polyline between user and dasher */}
          {location && dasherLocation && (
            <Polyline 
              positions={[
                [location.latitude, location.longitude],
                [dasherLocation.latitude, dasherLocation.longitude]
              ]}
              color="#BC4A4D"
              weight={3}
              opacity={0.7}
              dashArray="5, 10"
            />
          )}
          
          <MapUpdater
            user={location}
            dasher={dasherLocation}
            fallbackCenter={getMapCenter()}
            fallbackZoom={18}
          />
        </MapContainer>
      )}
      
      {loading && !location && (
        <div className="delivery-map-loading">
          <div className="delivery-map-loading-spinner"></div>
          <p>Loading map...</p>
        </div>
      )}
      
      {/* Distance info please */}
      
    </div>
  );
};

export default DeliveryMap;