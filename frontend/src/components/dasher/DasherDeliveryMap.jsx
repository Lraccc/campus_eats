import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Polyline, useMap } from 'react-leaflet';
import { connectSocket, emitLocationUpdate, joinRoom, onLocationBroadcast } from '../../services/socket';
import '../css/DasherMap.css';

// MapUpdater component to keep map centered between locations
const MapUpdater = ({ center, zoom, bounds }) => {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.length === 2) {
      // Auto-fit to show both markers with padding
      map.fitBounds(bounds, { padding: [20, 20] });
    } else if (center) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom, bounds]);
  
  return null;
};

const DasherDeliveryMap = ({ orderId, orderStatus, height = 300 }) => {
  const [dasherPosition, setDasherPosition] = useState(null);
  const [customerPosition, setCustomerPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const watchPositionId = useRef(null);
  const mapRef = useRef(null);

  // Socket setup
  useEffect(() => {
    if (!orderId) return;
    const SOCKET_URL = process.env.REACT_APP_TRACKING_SOCKET_URL || 'http://localhost:4001';
    const uid = localStorage.getItem('dasherId') || 'web-dasher';
    const name = localStorage.getItem('dasherName') || 'Dasher';

    connectSocket({ url: SOCKET_URL, userId: uid, name, role: 'dasher' });
    joinRoom(orderId);

    const handleBroadcast = (msg) => {
      if (msg.role === 'user' && typeof msg.lat === 'number' && typeof msg.lng === 'number') {
        setCustomerPosition([msg.lat, msg.lng]);
      }
    };

    onLocationBroadcast(handleBroadcast);
  }, [orderId]);

  // Track dasher geo and send via socket
  useEffect(() => {
    setLoading(true);

    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setDasherPosition([latitude, longitude]);
        emitLocationUpdate({ lat: latitude, lng: longitude, role: 'dasher' });
        setLoading(false);
      },
      (err) => {
        setError('Error getting initial position: ' + err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    watchPositionId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setDasherPosition([latitude, longitude]);
        emitLocationUpdate({ lat: latitude, lng: longitude, role: 'dasher' });
      },
      (err) => setError('Geolocation watch error: ' + err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => {
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
        watchPositionId.current = null;
      }
    };
  }, [orderId]);

  const getMapCenter = () => {
    if (dasherPosition && customerPosition) {
      return [(dasherPosition[0] + customerPosition[0]) / 2, (dasherPosition[1] + customerPosition[1]) / 2];
    }
    if (dasherPosition) return dasherPosition;
    if (customerPosition) return customerPosition;
    return [10.3157, 123.8854];
  };

  // Calculate bounds to fit both markers
  const getMapBounds = () => {
    if (dasherPosition && customerPosition) {
      return [dasherPosition, customerPosition];
    }
    return null;
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
        <MapContainer center={getMapCenter()} zoom={15} style={{ height: '100%', width: '100%' }} ref={mapRef}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />

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
                iconAnchor: [20, 20],
              })}
            >
              <Popup>Your current location</Popup>
            </Marker>
          )}

          {customerPosition && (
            <Marker
              position={customerPosition}
              icon={L.divIcon({
                className: 'other-marker-container',
                html: `<div class="other-marker-core">U</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              })}
            >
              <Popup>Customer location</Popup>
            </Marker>
          )}

          {/* Add polyline between dasher and customer */}
          {dasherPosition && customerPosition && (
            <Polyline
              positions={[dasherPosition, customerPosition]}
              color="#BC4A4D"
              weight={3}
              opacity={0.7}
              dashArray="5, 10"
            />
          )}

          <MapUpdater 
            center={getMapCenter()} 
            zoom={dasherPosition && customerPosition ? 13 : 15}
            bounds={getMapBounds()}
          />
        </MapContainer>
      )}
    </div>
  );
};

export default DasherDeliveryMap;