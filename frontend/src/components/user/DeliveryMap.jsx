import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
/* eslint-disable no-unused-vars */
/* eslint-enable no-unused-vars */
import { getLocationFromServer, updateLocationOnServer, useLocationTracking } from '../../utils/LocationService';
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

// Haversine distance in meters
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const DeliveryMap = ({ orderId, userType, height = 300 }) => {
  const [location, setLocation] = useState(null);
  const [dasherLocation, setDasherLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const locationPollRef = useRef(null);
  const [distance, setDistance] = useState(null);
  const [lastDasherUpdate, setLastDasherUpdate] = useState(null);
  const [dasherOffline, setDasherOffline] = useState(false);

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

  // Call hook at component level to track user location
  const { startTracking, stopTracking } = useLocationTracking(handleLocationUpdate);

  // Track location changes for user
  useEffect(() => {
    startTracking();
    setLoading(true);
    
    return () => {
      stopTracking();
    };
  }, [startTracking, stopTracking]);

  // Poll for dasher's location with enhanced reliability
  useEffect(() => {
    if (!orderId) return;
    
    const pollDasherLocation = async () => {
      try {
        const locationData = await getLocationFromServer(orderId, 'dasher');
        
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
        
        await updateLocationOnServer(orderId, 'user', locationForServer);
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

  // Update distance when both positions exist
  useEffect(() => {
    if (location && dasherLocation) {
      const d = haversineDistance(
        location.latitude,
        location.longitude,
        dasherLocation.latitude,
        dasherLocation.longitude
      );
      setDistance(d);
    } else {
      setDistance(null);
    }
  }, [location, dasherLocation]);

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

  // Compute distance label for display
  const computeDistanceLabel = () => {
    if (distance === null) return 'Calculating...';
    if (distance < 1000) return `${Math.round(distance)} m`;
    return `${(distance / 1000).toFixed(2)} km`;
  };
  const distanceLabel = computeDistanceLabel();

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
    <div className="delivery-map-container" style={{ height, padding: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Delivery Tracking</div>
      <div style={{ display: 'grid', gap: 4 }}>
        <div>
          <strong>Your location:</strong>{' '}
          {location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'Locating...'}
        </div>
        <div>
          <strong>Dasher location:</strong>{' '}
          {dasherLocation ? `${dasherLocation.latitude.toFixed(6)}, ${dasherLocation.longitude.toFixed(6)}` : 'Waiting...'}
          {lastDasherUpdate && (
            <span style={{ marginLeft: 8, color: '#666' }}>updated {formatTimeSince(lastDasherUpdate)}</span>
          )}
          {dasherOffline && (
            <span style={{ marginLeft: 8, color: '#b45309' }}>(possibly offline)</span>
          )}
        </div>
        <div>
          <strong>Distance:</strong> {distanceLabel}
        </div>
      </div>
      {loading && !location && (
        <div className="delivery-map-loading" style={{ marginTop: 12 }}>
          <div className="delivery-map-loading-spinner"></div>
          <p>Locating...</p>
        </div>
      )}
    </div>
  );
};

export default DeliveryMap;