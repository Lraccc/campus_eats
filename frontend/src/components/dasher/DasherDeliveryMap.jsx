import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import axios from '../../utils/axiosConfig';
import { getLocationFromServer, updateLocationOnServer } from '../../utils/LocationService';
import '../css/DasherMap.css';

// Fix Leaflet marker icon issue in webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Use different colored default icons
const dasherIcon = DefaultIcon; // Blue for dasher

// Blue icon for dasher's current location
const blueIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

// Red icon for shop
const shopIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

// Green icon for customer
const customerIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

// Create a larger, more prominent green icon for the customer's real-time location
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: iconShadow,
  iconSize: [35, 57], // Larger size for better visibility
  iconAnchor: [17, 57],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'pulsing-marker' // Add a class for animation
});

// Simple route line component to connect two points
const SimpleLine = ({ from, to }) => {
  const map = useMap();
  const lineRef = useRef(null);
  
  useEffect(() => {
    // Only create line when both points exist
    if (from && to) {
      // Remove previous line if exists
      if (lineRef.current) {
        lineRef.current.remove();
      }
      
      // Create a simple line between the two points
      lineRef.current = L.polyline([from, to], {
        color: '#3388ff',
        weight: 3,
        opacity: 0.7
      }).addTo(map);
      
      // Fit map to show both points
      const bounds = L.latLngBounds([from, to]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Cleanup
    return () => {
      if (lineRef.current) {
        lineRef.current.remove();
      }
    };
  }, [map, from, to]);
  
  return null;
};

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
  shop, 
  deliveryAddress,
  height = 300 
}) => {
  const [dasherPosition, setDasherPosition] = useState(null);
  const [shopPosition, setShopPosition] = useState(null);
  const [customerPosition, setCustomerPosition] = useState(null);
  const [customerRealPosition, setCustomerRealPosition] = useState(null); // For real-time customer position
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const watchPositionId = useRef(null);
  const locationPollRef = useRef(null);
  const mapRef = useRef(null);
  const [distance, setDistance] = useState(null);
  
  // Calculate distance between two points in meters
  const calculateDistance = (point1, point2) => {
    if (!point1 || !point2) return null;
    
    // Convert to [lat, lng] format if needed
    const p1 = Array.isArray(point1) ? point1 : [point1.latitude, point1.longitude];
    const p2 = Array.isArray(point2) ? point2 : [point2.latitude, point2.longitude];
    
    // Use Leaflet's built-in distance calculation
    return L.latLng(p1[0], p1[1]).distanceTo(L.latLng(p2[0], p2[1]));
  };
  
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

  useEffect(() => {
    if (navigator.geolocation) {
      // Initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setDasherPosition([latitude, longitude]);
          setLoading(false);
          
          // Update location using the LocationService utility
          if (orderId) {
            const locationData = {
              latitude: latitude.toString(),
              longitude: longitude.toString(),
              accuracy: position.coords.accuracy.toString(),
              heading: (position.coords.heading || 0).toString(),
              speed: (position.coords.speed || 0).toString()
            };
            
            updateLocationOnServer(orderId, 'dasher', locationData)
              .catch(err => console.log('Initial location update error - continuing without updating server'));
          }
        },
        (err) => {
          console.error("Geolocation error:", err);
          setError("Error getting your location. Please check your device settings.");
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      
      // Continuous tracking
      watchPositionId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setDasherPosition([latitude, longitude]);
          
          // Update location using the LocationService utility
          if (orderId) {
            const locationData = {
              latitude: latitude.toString(),
              longitude: longitude.toString(),
              accuracy: position.coords.accuracy.toString(),
              heading: (position.coords.heading || 0).toString(),
              speed: (position.coords.speed || 0).toString()
            };
            
            updateLocationOnServer(orderId, 'dasher', locationData)
              .catch(err => console.log('Location update error - continuing without updating server'));
          }
        },
        (err) => {
          console.error("Geolocation watch error:", err);
        },
        { 
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 10000
        }
      );
    } else {
      setError("Geolocation is not supported by this browser");
      setLoading(false);
    }

    return () => {
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
      }
    };
  }, [orderId]);

  // Check if location is in Philippines (approximate boundaries)
  // const isInPhilippines = (position) => {
  //   if (!position) return false;
  //   const lat = Array.isArray(position) ? position[0] : parseFloat(position.latitude);
  //   const lng = Array.isArray(position) ? position[1] : parseFloat(position.longitude);
    
  //   // Philippines rough bounding box
  //   return lat >= 4.5 && lat <= 21.5 && lng >= 115 && lng <= 127;
  // };
  
  // Poll for customer's real-time location
  useEffect(() => {
  if (!orderId || orderStatus === 'toShop' || orderStatus === 'preparing') {
    return; // Don't poll for customer location during early stages
  }
  
  const pollCustomerLocation = async () => {
    try {
      const customerLocation = await getLocationFromServer(orderId, 'user');
      if (customerLocation && 
          customerLocation.latitude && 
          customerLocation.longitude) {
        const lat = parseFloat(customerLocation.latitude);
        const lng = parseFloat(customerLocation.longitude);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          setCustomerRealPosition([lat, lng]);
        }
      }
    } catch (error) {
      console.log('Error polling customer location:', error);
    }
  };
  
  // Poll immediately then every 10 seconds
  pollCustomerLocation();
  locationPollRef.current = setInterval(pollCustomerLocation, 10000);
  
  return () => {
    if (locationPollRef.current) {
      clearInterval(locationPollRef.current);
    }
  };
}, [orderId, orderStatus]);

  // Determine which position pairs to show based on order status
  const getRoutePairs = () => {
  switch (orderStatus) {
    case 'toShop':
    case 'preparing':
      // From dasher to shop
      return dasherPosition && shopPosition ? { from: dasherPosition, to: shopPosition } : null;
    case 'pickedUp':
    case 'onTheWay':
      // From dasher to customer - use real-time position if available
      if (dasherPosition) {
        if (customerRealPosition) {
          return { from: dasherPosition, to: customerRealPosition }; 
        } else if (customerPosition) {
          return { from: dasherPosition, to: customerPosition };
        }
      }
      return null;
    default:
      return null;
  }
};

  // Get the shop's location
  useEffect(() => {
    if (!shop) return;
    
    if (shop.location && shop.location.includes(',')) {
      // If shop has location coordinates already
      try {
        const [lat, lng] = shop.location.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          setShopPosition([lat, lng]);
          return;
        }
      } catch (err) {
        console.log('Error parsing shop coordinates:', err);
      }
    }
    
    // Fallback to geocoding if coordinates are not available or invalid
    if (shop.address) {
      geocodeAddress(shop.address, 'shop');
    }
  }, [shop]);

  // Get the customer's location from delivery address
  useEffect(() => {
    if (deliveryAddress) {
      geocodeAddress(deliveryAddress, 'customer');
    }
  }, [deliveryAddress]);

  // Function to geocode addresses to coordinates
  const geocodeAddress = async (address, type) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      );

      if (response.data && response.data.length > 0) {
        const { lat, lon } = response.data[0];
        const position = [parseFloat(lat), parseFloat(lon)];
        
        if (type === 'shop') {
          setShopPosition(position);
        } else if (type === 'customer') {
          setCustomerPosition(position);
        }
      } else {
        console.error(`Could not find ${type}'s location`);
      }
    } catch (err) {
      console.error(`Error geocoding ${type} address:`, err);
      setError(`Failed to find ${type} location`);
    }
  };

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
          console.log(`Position update. Accuracy: ${accuracy} meters, Heading: ${heading || 0}, Speed: ${speed || 0}`);

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
          enableHighAccuracy: true,  // Use GPS for highest accuracy when available
          maximumAge: 0,              // Always get fresh location data
          timeout: 15000              // Wait longer for more accurate fix
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
      if (locationPollRef.current) {
        clearInterval(locationPollRef.current);
        locationPollRef.current = null;
      }
    };
  }, [orderId, dasherPosition]);

  // Determine the map center based only on real positions
  const getMapCenter = () => {
    // First, check if both dasher and customer real positions are available - center between them
    if (dasherPosition && customerRealPosition && (orderStatus === 'pickedUp' || orderStatus === 'onTheWay')) {
      // Center the map to show both positions
      // Virtual center point between dasher and customer
      return [
        (dasherPosition[0] + customerRealPosition[0]) / 2,
        (dasherPosition[1] + customerRealPosition[1]) / 2
      ];
    }
    
    if (dasherPosition) return dasherPosition;
    if (customerRealPosition) return customerRealPosition; // Prioritize real-time customer position
    if (shopPosition) return shopPosition;
    if (customerPosition) return customerPosition;
    return null; // No default fallback
  };

  // Get route pair based on current state
  const routePair = getRoutePairs();

  if (loading && !dasherPosition && !shopPosition && !customerPosition && !customerRealPosition) {
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
        
        <div className="dm-marker-container">
          {dasherPosition && (
            <Marker 
              position={dasherPosition} 
              icon={blueIcon}
            >
              <Popup>
                Your current location
                <br />
                {routePair && routePair.destination && (
                  <span>Next stop is {routePair.description}</span>
                )}
              </Popup>
            </Marker>
          )}
          {shopPosition && (
            <Marker position={shopPosition} icon={shopIcon}>
              <Popup>
                {shop?.name || 'Shop location'}<br />
                {shop?.address || ''}
              </Popup>
            </Marker>
          )}
          
          {routePair && (
            <SimpleLine 
              from={routePair.from}
              to={routePair.to}
            />
          )}
        </div>
          
        <MapUpdater center={getMapCenter()} zoom={15} />
        </MapContainer>
      )}
      
      <div className="dm-navigation">
        {dasherPosition && shopPosition && orderStatus === "toShop" && (
          <a 
            href={`https://www.google.com/maps/dir/?api=1&destination=${shopPosition[0]},${shopPosition[1]}`}
            className="dm-navigate-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            Navigate to Shop in Google Maps
          </a>
        )}
        
        {dasherPosition && customerPosition && (orderStatus === "pickedUp" || orderStatus === "onTheWay") && (
          <a 
            href={`https://www.google.com/maps/dir/?api=1&destination=${customerPosition[0]},${customerPosition[1]}`}
            className="dm-navigate-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            Navigate to Customer in Google Maps
          </a>
        )}
      </div>
    </div>
  );
};

export default DasherDeliveryMap;
