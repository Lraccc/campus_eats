const API_URL = process.env.REACT_APP_TRACKING_API_URL || process.env.REACT_APP_TRACKING_SOCKET_URL || 'http://localhost:4001';

export async function fetchGeofences() {
  const res = await fetch(`${API_URL}/api/geofences`);
  if (!res.ok) throw new Error('Failed to load geofences');
  return res.json();
}

export async function createGeofence({ name, coordinates }) {
  const res = await fetch(`${API_URL}/api/geofences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, coordinates })
  });
  if (!res.ok) throw new Error('Failed to create geofence');
  return res.json();
}
