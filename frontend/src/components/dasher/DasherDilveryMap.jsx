import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import axios from '../../utils/axiosConfig';
import '../css/DasherMap.css';

// Custom icons for markers
const dasherIcon = new L.Icon({
  iconUrl: '/Assets/dasher-marker.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

const customerIcon = new L.Icon({
  iconUrl: '/Assets/customer-marker.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

// RoutingControl component to show directions
const RoutingControl = ({ dasherPosition, customerPosition }) => {
  const map = useMap();
  
  useEffect(() => {
    if (dasherPosition && customerPosition) {
      // Create routing control instance
      const routingControl = L.Routing.control({
        waypoints: [
          L.latLng(dasherPosition[0], dasherPosition[1]),
          L.latLng(customerPosition[0], customerPosition[1])
        ],
        routeWhileDragging: false,
        showAlternatives: false,
        lineOptions: {
          styles: [{ color: '#BC4A4D', opacity: 0.7, weight: 5 }]
        },
        createMarker: () => { return null; } // Don't create default markers
      }).addTo(map);

      // Clean up
      return () => {
        map.removeControl(routingControl);
      };
    }
  }, [map, dasherPosition, customerPosition]);

  return null;
};

const DasherDeliveryMap = ({ orderId, height = 400 }) => {
  const [dasherPosition, setDasherPosition] = useState(null);
  const [customerPosition, setCustomerPosition] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const watchPositionId = useRef(null);

  // Fetch order details to get customer location
  useEffect(() => {
    const fetchOrderLocation = async () => {
      try {
        const response = await axios.get(`/orders/${orderId}`);
        if (response.status === 200) {
          const orderData = response.data;
          setOrder(orderData);
          
          // Parse customer location (assuming it's stored in order.customerLocation)
          if (orderData.customerLocation) {
            const [lat, lng] = orderData.customerLocation.split(',').map(Number);
            setCustomerPosition([lat, lng]);
          } else {
            // If no explicit location, need to geocode the delivery address
            const geocodeResponse = await axios.get(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(orderData.deliverTo)}`
            );
            if (geocodeResponse.data && geocodeResponse.data.length > 0) {
              setCustomerPosition([
                parseFloat(geocodeResponse.data[0].lat),
                parseFloat(geocodeResponse.data[0].lon)
              ]);
            } else {
              setError("Could not find customer's location");
            }
          }
        }
      } catch (err) {
        setError("Failed to load order location");
        console.error("Error fetching order:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderLocation();
  }, [orderId]);

  // Track dasher's current position
  useEffect(() => {
    const startLocationTracking = () => {
      if (navigator.geolocation) {
        watchPositionId.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setDasherPosition([latitude, longitude]);
            
            // Update dasher's location in the database
            axios.post('/dashers/update-location', {
              dasherId: localStorage.getItem('dasherId'), // Adjust based on how you store dasherId
              orderId: orderId,
              latitude: latitude,
              longitude: longitude
            }).catch(err => console.error("Failed to update location:", err));
          },
          (err) => {
            setError("Error accessing location: " + err.message);
            console.error("Geolocation error:", err);
          },
          { 
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
          }
        );
      } else {
        setError("Geolocation is not supported by this browser");
      }
    };

    startLocationTracking();

    // Cleanup function
    return () => {
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
      }
    };
  }, [orderId]);

  if (loading) {
    return <div className="dm-loading">Loading map...</div>;
  }

  if (error) {
    return <div className="dm-error">{error}</div>;
  }

  // Default to a central location if no positions are available yet
  const mapCenter = customerPosition || dasherPosition || [10.3156, 123.8854]; // Default: Cebu City

  return (
    <div className="dm-container" style={{ height: `${height}px` }}>
      <MapContainer 
        center={mapCenter} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {dasherPosition && (
          <Marker position={dasherPosition} icon={dasherIcon}>
            <Popup>
              Your current location
            </Popup>
          </Marker>
        )}
        
        {customerPosition && (
          <Marker position={customerPosition} icon={customerIcon}>
            <Popup>
              Customer delivery location<br />
              {order?.deliverTo}
            </Popup>
          </Marker>
        )}
        
        {dasherPosition && customerPosition && (
          <RoutingControl 
            dasherPosition={dasherPosition}
            customerPosition={customerPosition}
          />
        )}
      </MapContainer>
      
      <div className="dm-navigation">
        {customerPosition && (
          <a 
            href={`https://www.google.com/maps/dir/?api=1&destination=${customerPosition[0]},${customerPosition[1]}`}
            className="dm-navigate-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            Navigate in Google Maps
          </a>
        )}
      </div>
    </div>
  );
};

export default DasherDeliveryMap;