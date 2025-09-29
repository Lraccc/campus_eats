/* eslint-disable no-unused-vars */
import 'leaflet/dist/leaflet.css';
/* eslint-enable no-unused-vars */
import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { getLocationFromServer, updateLocationOnServer } from '../../utils/LocationService';
import '../css/DasherMap.css';

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

const DasherDeliveryMap = ({ 
  orderId, 
  orderStatus, 
  height = 300 
}) => {
  const [dasherPosition, setDasherPosition] = useState(null);
  const [customerPosition, setCustomerPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const watchPositionId = useRef(null);
  const customerPollRef = useRef(null);
  const [distance, setDistance] = useState(null);
  
  // Check if two coordinates are reasonably close (within Philippines)
  const areLocationsReasonablyClose = (loc1, loc2, maxDistanceKm = 100) => {
    if (!loc1 || !loc2) return false;
    const p1 = Array.isArray(loc1) ? loc1 : [parseFloat(loc1.latitude), parseFloat(loc1.longitude)]; 
    const p2 = Array.isArray(loc2) ? loc2 : [parseFloat(loc2.latitude), parseFloat(loc2.longitude)];
    // Use Haversine instead of Leaflet
    const distanceInMeters = haversineDistance(p1[0], p1[1], p2[0], p2[1]);
    const distanceInKm = distanceInMeters / 1000;
    
    console.log(`Distance between positions: ${distanceInKm.toFixed(2)} km`);
    return distanceInKm <= maxDistanceKm;
  };

  // Poll for customer's location
  useEffect(() => {
    if (!orderId) return;
    
    const pollCustomerLocation = async () => {
      try {
        const locationData = await getLocationFromServer(orderId, 'user');
        
        if (locationData) {
          // Convert string coordinates to numbers if needed
          const customerPos = [
            typeof locationData.latitude === 'string' ? parseFloat(locationData.latitude) : locationData.latitude,
            typeof locationData.longitude === 'string' ? parseFloat(locationData.longitude) : locationData.longitude
          ];
          
          setCustomerPosition(customerPos);
        }
      } catch (error) {
        console.error('Error fetching customer location:', error);
      }
    };
    
    // Initial poll
    pollCustomerLocation();
    
    // Set up polling interval
    customerPollRef.current = setInterval(pollCustomerLocation, 5000);
    
    return () => {
      if (customerPollRef.current) {
        clearInterval(customerPollRef.current);
      }
    };
  }, [orderId]);

  // Track dasher's current position with high accuracy settings
  useEffect(() => {
    console.log('Starting real-time location tracking...');
    setLoading(true);
    
    // Immediately start location tracking
    if (navigator.geolocation) {
      // Get initial position quickly
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log(`Initial position acquired. Accuracy: ${accuracy} meters`);
          setDasherPosition([latitude, longitude]);
          setLoading(false);
          
          // Update location for sharing
          if (orderId) {
            try {
              const locationData = {
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                accuracy: accuracy.toString(),
                heading: '0',
                speed: '0',
                timestamp: new Date().toISOString()
              };
              
              // Update location in server/localStorage
              updateLocationOnServer(orderId, 'dasher', locationData);
            } catch (err) {
              console.log('Error updating initial location:', err);
            }
          }
        },
        (err) => {
          console.error("Error getting initial position:", err);
          // Continue with watch position even if initial position fails
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
      
      // Set up continuous tracking with high accuracy
      watchPositionId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, heading, speed } = position.coords;

          // Check if this position is reasonably close to the previous position if we have one
          if (dasherPosition) {
            // If new position is more than 50km from previous position and accuracy is poor, reject it
            if (!areLocationsReasonablyClose([latitude, longitude], dasherPosition, 50) && accuracy > 100) {
              console.warn('New position unreasonably far from previous position with poor accuracy');
              return;
            }
          }
          
          // Position passed validation
          setDasherPosition([latitude, longitude]);
          setLoading(false);
          
          // Update location for sharing
          if (orderId) {
            try {
              const locationData = {
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                accuracy: accuracy.toString(),
                heading: (heading || 0).toString(),
                speed: (speed || 0).toString(),
                timestamp: new Date().toISOString()
              };
              
              // Update location in server/localStorage
              updateLocationOnServer(orderId, 'dasher', locationData);
            } catch (err) {
              console.log('Error updating location:', err);
            }
          }
        },
        (err) => {
          setError("Error tracking location: " + err.message);
          console.error("Geolocation watch error:", err);
          // Don't set loading to false if we still don't have any position
          if (dasherPosition) setLoading(false);
        },
        { 
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000
        }
      );
    } else {
      setError("Geolocation is not supported by this browser");
      setLoading(false);
    }

    // Cleanup function
    return () => {
      console.log('Cleaning up location tracking...');
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
        watchPositionId.current = null;
      }
    };
  }, [orderId, dasherPosition]);

  // Update route and calculate distance when positions change
  useEffect(() => {
    if (dasherPosition && customerPosition) {
      const d = haversineDistance(
        dasherPosition[0],
        dasherPosition[1],
        customerPosition[0],
        customerPosition[1]
      );
      setDistance(d);
    } else {
      setDistance(null);
    }
  }, [dasherPosition, customerPosition]);

  // Format distance for display
  const formatDistance = (meters) => {
    if (meters === null) return 'Calculating...';
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(2)} km`;
    }
  };

  if (loading && !dasherPosition) {
    return (
      <div className="dm-loading">
        <div className="dm-spinner"></div>
        <p>Locating you...</p>
      </div>
    );
  }

  if (error && !dasherPosition) {
    return <div className="dm-error">{error}</div>;
  }

  return (
    <div style={{ height: `${height}px`, padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Delivery Tracking</div>
      {orderId && (
        <div style={{ marginBottom: 8 }}>
          <div><strong>Order ID:</strong> {orderId}</div>
          {orderStatus && <div><strong>Status:</strong> {orderStatus}</div>}
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        <div><strong>Dasher location:</strong> {dasherPosition ? `${dasherPosition[0].toFixed(6)}, ${dasherPosition[1].toFixed(6)}` : 'Locating...'}</div>
        <div><strong>Customer location:</strong> {customerPosition ? `${customerPosition[0].toFixed(6)}, ${customerPosition[1].toFixed(6)}` : 'Waiting...'}</div>
      </div>
      {distance !== null && (
        <div style={{ marginTop: 8 }}>
          <strong>Distance to customer:</strong> {formatDistance(distance)}
        </div>
      )}
    </div>
  );
};

export default DasherDeliveryMap;

DasherDeliveryMap.propTypes = {
  orderId: PropTypes.string,
  orderStatus: PropTypes.string,
  height: PropTypes.number,
};

DasherDeliveryMap.defaultProps = {
  orderId: undefined,
  orderStatus: undefined,
  height: 300,
};