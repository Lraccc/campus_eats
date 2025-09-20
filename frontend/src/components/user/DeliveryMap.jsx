import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import { connectSocket, emitLocationUpdate, joinRoom, onLocationBroadcast } from '../../services/socket';
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
  const [location, setLocation] = useState(null);
  const [dasherLocation, setDasherLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dasherOffline, setDasherOffline] = useState(false);

  // --- Socket setup ---
  useEffect(() => {
    if (!orderId) return;
    const SOCKET_URL = process.env.REACT_APP_TRACKING_SOCKET_URL || 'http://localhost:4001';

    const uid = localStorage.getItem('userId') || 'web-user';
    const name = localStorage.getItem('userName') || 'User';

    connectSocket({ url: SOCKET_URL, userId: uid, name, role: 'user' });
    joinRoom(orderId);

    const handleBroadcast = (msg) => {
      if (msg.role === 'dasher' && typeof msg.lat === 'number' && typeof msg.lng === 'number') {
        setDasherLocation({ latitude: msg.lat, longitude: msg.lng });
        setDasherOffline(false);
      }
    };

    onLocationBroadcast(handleBroadcast);

    return () => {
      // no-op: keep socket connection
    };
  }, [orderId]);

  // --- Geolocation: watch and emit via socket ---
  useEffect(() => {
    setLoading(true);
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    let watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const current = {
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
          timestamp: position.timestamp,
        };
        setLocation(current);
        emitLocationUpdate({ lat: latitude, lng: longitude, role: 'user' });
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [orderId]);

  const getMapCenter = () => {
    if (location && dasherLocation) {
      return [
        (location.latitude + dasherLocation.latitude) / 2,
        (location.longitude + dasherLocation.longitude) / 2,
      ];
    }
    if (location) return [location.latitude, location.longitude];
    if (dasherLocation) return [dasherLocation.latitude, dasherLocation.longitude];
    return [10.3157, 123.8854];
  };

  return (
    <div className="delivery-map-container" style={{ height }}>
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
                iconAnchor: [20, 20],
              })}
            >
              <Popup>Your location</Popup>
            </Marker>
          )}

          {dasherLocation && (
            <Marker
              position={[dasherLocation.latitude, dasherLocation.longitude]}
              icon={L.divIcon({
                className: dasherOffline ? 'offline-marker-container' : 'other-marker-container',
                html: `<div class="${dasherOffline ? 'offline-marker-core' : 'other-marker-core'}">D</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              })}
            >
              <Popup>Dasher location</Popup>
            </Marker>
          )}

          {location && dasherLocation && (
            <Polyline
              positions={[
                [location.latitude, location.longitude],
                [dasherLocation.latitude, dasherLocation.longitude],
              ]}
              color="#BC4A4D"
              weight={3}
              opacity={0.7}
              dashArray="5, 10"
            />
          )}
        </MapContainer>
      )}

      {loading && !location && (
        <div className="delivery-map-loading">
          <div className="delivery-map-loading-spinner"></div>
          <p>Loading map...</p>
        </div>
      )}
    </div>
  );
};

export default DeliveryMap;