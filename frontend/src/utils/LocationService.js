const MIN_INTERVAL_MS = 10000;
const MIN_DISTANCE_M = 15;

let lastSent = 0;
let lastCoord = null;
let watchId = null;

const haversine = (a, b) => {
  if (!a || !b) return 999999;
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLon = (b.lng - a.lng) * Math.PI/180;
  const la1 = a.lat * Math.PI/180;
  const la2 = b.lat * Math.PI/180;
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  return R * c;
};

export const startThrottledTracking = ({ onLocalUpdate, onError, sendFn, geofence }) => {
  if (!navigator.geolocation) { onError && onError('Geolocation not supported'); return; }
  watchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude, speed, heading, accuracy } = pos.coords;
      const now = Date.now();
      const current = { lat: latitude, lng: longitude };
      const dist = haversine(lastCoord, current);
      const elapsed = now - lastSent;
      const payloadBase = { latitude, longitude, speed: speed || null, heading: heading || null, accuracy, timestamp: new Date().toISOString() };

      onLocalUpdate && onLocalUpdate({ ...payloadBase });

      // local hard geofence pre-check
      if (geofence) {
        const d = haversine({ lat: geofence.center.lat, lng: geofence.center.lng }, current);
        if (d > geofence.radius) {
          return; // suppress sends outside
        }
      }

      if (elapsed >= MIN_INTERVAL_MS || dist >= MIN_DISTANCE_M || lastCoord === null) {
        sendFn && sendFn(payloadBase);
        lastSent = now;
        lastCoord = current;
      }
    },
    err => { onError && onError(err.message || 'Tracking error'); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
  );
};

export const stopThrottledTracking = () => { if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; } };