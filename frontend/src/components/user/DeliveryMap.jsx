import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, Circle } from 'react-leaflet';
import RealtimeLocationClient from '../../utils/RealtimeLocationClient';
import { startThrottledTracking, stopThrottledTracking } from '../../utils/LocationService';
import '../css/DeliveryMap.css';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const GEOFENCE_CENTER = { lat: 10.295349085857447, lng: 123.88070205149705 };
const GEOFENCE_RADIUS = 370; // meters
const NEAR_MARGIN = 35; // meters

const haversine = (a, b) => {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLon = (b.lng - a.lng) * Math.PI/180;
  const la1 = a.lat * Math.PI/180;
  const la2 = b.lat * Math.PI/180;
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  return R * c;
};

const DeliveryMap = ({ orderId, userId, shopLocation, height = 300 }) => {
  const mapRef = useRef(null);
  const clientRef = useRef(null);
  const [selfLoc, setSelfLoc] = useState(null);
  const [lastInBoundsLoc, setLastInBoundsLoc] = useState(null);
  const [dasherLoc, setDasherLoc] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [nearBoundary, setNearBoundary] = useState(false);
  const [outside, setOutside] = useState(false);
  const [gpsDisabled, setGpsDisabled] = useState(false);

  const pushNotif = useCallback(n => setNotifications(prev => [...prev.slice(-4), { ...n, id: Date.now() + Math.random() }]), []);

  useEffect(() => {
    const client = new RealtimeLocationClient({
      sessionId: orderId,
      onLocation: data => {
        if (data.userId === userId && data.role === 'user') return; // ignore echo
        if (data.role === 'dasher') {
          setDasherLoc({ latitude: data.latitude, longitude: data.longitude, nearBoundary: data.nearBoundary });
        }
      },
      onNotification: n => {
        pushNotif(n);
        if (n.type === 'GEOFENCE_OUTSIDE_BLOCK') setOutside(true);
        if (n.type === 'GEOFENCE_RESUMED') setOutside(false);
        if (n.type === 'GPS_DISABLED') setGpsDisabled(true);
      }
    });
    clientRef.current = client;
    client.connect(localStorage.getItem('userToken')).catch(e => console.error('WS connect error', e));
    return () => client.disconnect();
  }, [orderId, userId, pushNotif]);

  useEffect(() => {
    startThrottledTracking({
      geofence: { center: GEOFENCE_CENTER, radius: GEOFENCE_RADIUS },
      onLocalUpdate: loc => {
        setSelfLoc(loc);
        const dist = haversine(GEOFENCE_CENTER, { lat: loc.latitude, lng: loc.longitude });
        const isOutside = dist > GEOFENCE_RADIUS;
        const isNear = !isOutside && dist > (GEOFENCE_RADIUS - NEAR_MARGIN);
        setNearBoundary(isNear);
        setOutside(isOutside);
        if (!isOutside) setLastInBoundsLoc(loc);
      },
      onError: msg => { setGpsDisabled(true); pushNotif({ type: 'GPS_DISABLED', message: msg }); },
      sendFn: payload => {
        if (outside || gpsDisabled) return; // local hard block
        clientRef.current?.sendUpdate({ ...payload, userId, role: 'user', sessionId: orderId });
      }
    });
    return () => stopThrottledTracking();
  }, [orderId, userId, outside, gpsDisabled, pushNotif]);

  const center = selfLoc ? [selfLoc.latitude, selfLoc.longitude] : [GEOFENCE_CENTER.lat, GEOFENCE_CENTER.lng];

  return (
    <div className="delivery-map-container" style={{ height }}>
      <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }} ref={mapRef}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Circle center={[GEOFENCE_CENTER.lat, GEOFENCE_CENTER.lng]} radius={GEOFENCE_RADIUS} pathOptions={{ color: '#BC4A4D22', fillOpacity: 0.05 }} />
        {selfLoc && (
          <Marker position={[selfLoc.latitude, selfLoc.longitude]} icon={L.divIcon({ className: 'user-marker-container', html: `<div class="user-marker-pulse"></div><div class="user-marker-core">U</div>`, iconSize: [40,40], iconAnchor:[20,20] })}>
            <Popup>Your location</Popup>
          </Marker>
        )}
        {dasherLoc && (
          <Marker position={[dasherLoc.latitude, dasherLoc.longitude]} icon={L.divIcon({ className: 'other-marker-container', html: `<div class="other-marker-core">D</div>`, iconSize:[30,30], iconAnchor:[15,15] })}>
            <Popup>Dasher</Popup>
          </Marker>
        )}
        {shopLocation && (
          <Marker position={shopLocation} icon={L.divIcon({ className: 'shop-marker-container', html: `<div class="other-marker-core">S</div>`, iconSize:[30,30], iconAnchor:[15,15] })}>
            <Popup>Shop</Popup>
          </Marker>
        )}
        {selfLoc && dasherLoc && (
          <Polyline positions={[[selfLoc.latitude, selfLoc.longitude],[dasherLoc.latitude, dasherLoc.longitude]]} color="#BC4A4D" weight={3} opacity={0.7} dashArray="5, 10" />
        )}
      </MapContainer>

      {nearBoundary && !outside && (
        <div className="geofence-warning-soft">Approaching boundary</div>
      )}
      {outside && (
        <div className="geofence-warning-hard">Outside geofence - tracking paused</div>
      )}
      {gpsDisabled && (
        <div className="geofence-warning-hard">GPS disabled - enable location services</div>
      )}

      <div className="delivery-map-notifs">
        {notifications.slice().reverse().map(n => (
          <div key={n.id} className="delivery-map-notif-item">{n.message}</div>
        ))}
      </div>
    </div>
  );
};

export default DeliveryMap;