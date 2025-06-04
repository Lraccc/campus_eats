import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
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

const DeliveryMap = ({ orderId, userType, height = 300 }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [location, setLocation] = useState(null);
  const [otherLocation, setOtherLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const userMarkerRef = useRef(null);
  const otherMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  const locationPollRef = useRef(null);
  const [distance, setDistance] = useState(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    setLoading(true);
    
    // Create map instance
    const map = L.map(mapRef.current).setView([10.295663, 123.880895], 9); // Default to Manila
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    mapInstance.current = map;
    setLoading(false);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [mapRef]);

  // Define location update handler
  const handleLocationUpdate = (locationData, error) => {
    if (error) {
      setErrorMsg(error);
      return;
    }
    
    // Convert strings to numbers if needed (fix for previous type mismatch issues)
    const processedLocation = {
      ...locationData,
      latitude: typeof locationData.latitude === 'string' ? parseFloat(locationData.latitude) : locationData.latitude,
      longitude: typeof locationData.longitude === 'string' ? parseFloat(locationData.longitude) : locationData.longitude,
      heading: typeof locationData.heading === 'string' ? parseFloat(locationData.heading) : locationData.heading,
      speed: typeof locationData.speed === 'string' ? parseFloat(locationData.speed) : locationData.speed,
    };
    
    setLocation(processedLocation);
  };

  // Call hook at component level
  const { startTracking, stopTracking } = useLocationTracking(handleLocationUpdate);

  // Track location changes
  useEffect(() => {
    if (!mapInstance.current) return;
    
    startTracking();

    return () => {
      stopTracking();
    };
  }, [mapInstance, startTracking, stopTracking]);

  // Poll for other user's location (dasher or customer)
  useEffect(() => {
    if (!orderId || !mapInstance.current) return;
    
    const otherType = userType === 'user' ? 'dasher' : 'user';
    
    const pollOtherLocation = async () => {
      try {
        const locationData = await getLocationFromServer(orderId, otherType);
        
        // Convert strings to numbers if needed
        const processedLocation = locationData ? {
          ...locationData,
          latitude: typeof locationData.latitude === 'string' ? parseFloat(locationData.latitude) : locationData.latitude,
          longitude: typeof locationData.longitude === 'string' ? parseFloat(locationData.longitude) : locationData.longitude,
          heading: typeof locationData.heading === 'string' ? parseFloat(locationData.heading) : locationData.heading,
          speed: typeof locationData.speed === 'string' ? parseFloat(locationData.speed) : locationData.speed,
        } : null;
        
        setOtherLocation(processedLocation);
      } catch (error) {
        console.error('Error fetching other location:', error);
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
  }, [orderId, userType, mapInstance.current]);

  // Send location updates to server
  useEffect(() => {
    if (!location || !orderId || !mapInstance.current) return;
    
    const sendLocationUpdate = async () => {
      try {
        // Ensure we send strings to the server (fix for previous API compatibility issues)
        const locationForServer = {
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          heading: location.heading.toString(),
          speed: location.speed.toString(),
          timestamp: new Date().toISOString()
        };
        
        await updateLocationOnServer(orderId, userType, locationForServer);
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
  }, [location, orderId, userType, mapInstance.current]);

  // Update markers and route on location changes
  useEffect(() => {
    if (!mapInstance.current) return;
    
    // Create or update user marker
    if (location) {
      const userLatLng = L.latLng(location.latitude, location.longitude);
      
      if (!userMarkerRef.current) {
        // Create custom marker for user
        const userIcon = L.divIcon({
          className: 'user-marker',
          html: '<div>U</div>',
          iconSize: [30, 30]
        });
        
        userMarkerRef.current = L.marker(userLatLng, { icon: userIcon }).addTo(mapInstance.current);
      } else {
        userMarkerRef.current.setLatLng(userLatLng);
      }
      
      // Center map on user location if no other location is available
      if (!otherLocation) {
        mapInstance.current.setView(userLatLng, 15);
      }
    }
    
    // Create or update other party marker
    if (otherLocation) {
      const otherLatLng = L.latLng(otherLocation.latitude, otherLocation.longitude);
      
      if (!otherMarkerRef.current) {
        // Create custom marker for other party
        const otherIcon = L.divIcon({
          className: 'dasher-marker',
          html: '<div>D</div>',
          iconSize: [30, 30]
        });
        
        otherMarkerRef.current = L.marker(otherLatLng, { icon: otherIcon }).addTo(mapInstance.current);
      } else {
        otherMarkerRef.current.setLatLng(otherLatLng);
      }
    }
    
    // Draw route line between markers if both exist
    if (location && otherLocation) {
      const userLatLng = L.latLng(location.latitude, location.longitude);
      const otherLatLng = L.latLng(otherLocation.latitude, otherLocation.longitude);
      
      // Remove existing route line
      if (routeLineRef.current) {
        mapInstance.current.removeLayer(routeLineRef.current);
      }
      
      // Create new route line
      routeLineRef.current = L.polyline([userLatLng, otherLatLng], {
        color: '#BC4A4D',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 10'
      }).addTo(mapInstance.current);
      
      // Fit bounds to show both markers
      mapInstance.current.fitBounds([userLatLng, otherLatLng], {
        padding: [50, 50]
      });
      
      // Calculate distance
      const distanceInMeters = userLatLng.distanceTo(otherLatLng);
      setDistance(distanceInMeters);
    }
    
  }, [location, otherLocation, mapInstance.current]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        if (userMarkerRef.current) mapInstance.current.removeLayer(userMarkerRef.current);
        if (otherMarkerRef.current) mapInstance.current.removeLayer(otherMarkerRef.current);
        if (routeLineRef.current) mapInstance.current.removeLayer(routeLineRef.current);
      }
    };
  }, []);

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
      </div>
    );
  }

  return (
    <div className="delivery-map-container" style={{ height }}>
      <div 
        ref={mapRef} 
        className="delivery-map" 
        style={{ height: '100%' }}
      />
      
      {loading && (
        <div className="delivery-map-loading">
          <div className="delivery-map-loading-spinner"></div>
        </div>
      )}
      
      {distance !== null && (
        <div className="delivery-status-info">
          <p><strong>Distance:</strong> {formatDistance(distance)}</p>
          {location && location.speed > 0 && (
            <p><strong>Speed:</strong> {Math.round(location.speed * 3.6)} km/h</p>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryMap;
