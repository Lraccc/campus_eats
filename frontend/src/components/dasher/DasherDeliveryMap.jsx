import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { getLocationFromServer, updateLocationOnServer } from '../../utils/LocationService';
import '../css/DasherMap.css';

// Fix Leaflet marker icon issue in webpack

// MapUpdater component to keep map centered on the selected location
const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom]);
  
  return null;
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
  const mapRef = useRef(null);
  const customerPollRef = useRef(null);
  const routeLineRef = useRef(null);
  const [distance, setDistance] = useState(null);
  
  // Check if two coordinates are reasonably close (within Philippines)
  const areLocationsReasonablyClose = (loc1, loc2, maxDistanceKm = 100) => {
    if (!loc1 || !loc2) return false;
    const p1 = Array.isArray(loc1) ? loc1 : [parseFloat(loc1.latitude), parseFloat(loc1.longitude)]; 
    const p2 = Array.isArray(loc2) ? loc2 : [parseFloat(loc2.latitude), parseFloat(loc2.longitude)];
    
    // Use Leaflet's built-in distance calculation
    const distanceInMeters = L.latLng(p1[0], p1[1]).distanceTo(L.latLng(p2[0], p2[1])); 
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
    if (!mapRef.current || !dasherPosition || !customerPosition) return;
    
    const map = mapRef.current.leafletElement;
    
    // Create latLng objects for calculations
    const dasherLatLng = L.latLng(dasherPosition[0], dasherPosition[1]);
    const customerLatLng = L.latLng(customerPosition[0], customerPosition[1]);
    
    // Calculate distance
    const distanceInMeters = dasherLatLng.distanceTo(customerLatLng);
    setDistance(distanceInMeters);
    
    // Update route line if both points exist
    if (routeLineRef.current && map) {
      map.removeLayer(routeLineRef.current);
    }
    
    routeLineRef.current = L.polyline([dasherLatLng, customerLatLng], {
      color: '#BC4A4D',
      weight: 3,
      opacity: 0.7,
      dashArray: '5, 10'
    }).addTo(map);
    
  }, [dasherPosition, customerPosition]);

  // Determine best map center
  const getMapCenter = () => {
    if (dasherPosition && customerPosition) {
      // Calculate midpoint to show both markers
      return [(dasherPosition[0] + customerPosition[0]) / 2, 
              (dasherPosition[1] + customerPosition[1]) / 2];
    }
    if (dasherPosition) return dasherPosition;
    if (customerPosition) return customerPosition;
    return null;
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
    <div className="dm-container" style={{ height: `${height}px` }}>
      {getMapCenter() && (
        <MapContainer 
          center={getMapCenter()} 
          zoom={15} 
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* Dasher marker with pulsing effect */}
          {dasherPosition && (
            <Marker 
              position={dasherPosition} 
              icon={L.divIcon({
                className: 'user-marker-container',
                html: `
                  <div class="user-marker-pulse"></div>
                  <div class="user-marker-core">D</div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
              })}
            >
              <Popup>
                Your current location
              </Popup>
            </Marker>
          )}
          
          {/* Customer marker */}
          {customerPosition && (
            <Marker 
              position={customerPosition}
              icon={L.divIcon({
                className: 'other-marker-container',
                html: `<div class="other-marker-core">U</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
              })}
            >
              <Popup>
                Customer location
              </Popup>
            </Marker>
          )}
          
          {/* Static marker */}
          <Marker 
            position={[10.2944327, 123.8802167]}
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
              User Location
            </Popup>
          </Marker>
          
          <MapUpdater 
            center={getMapCenter()} 
            zoom={customerPosition && dasherPosition ? 13 : 15} 
          />
        </MapContainer>
      )}
      
      {/* Display distance between dasher and customer */}
      {distance !== null && (
        <div className="delivery-status-info">
          <p><strong>Distance to customer:</strong> {formatDistance(distance)}</p>
        </div>
      )}
    </div>
  );
};

export default DasherDeliveryMap;