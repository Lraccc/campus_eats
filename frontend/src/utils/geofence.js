export const isWithinGeofence = (userLat, userLng, centerLat, centerLng, radius) => {
  // Validate inputs
  if (isNaN(userLat)) throw new Error(`Invalid userLat: ${userLat}`);
  if (isNaN(userLng)) throw new Error(`Invalid userLng: ${userLng}`);
  
  console.log(`Checking geofence:
  - Center: (${centerLat}, ${centerLng})
  - User: (${userLat}, ${userLng})
  - Radius: ${radius} meters`);

  const toRadians = degrees => degrees * (Math.PI / 180);
  
  const R = 6371000; // Earth radius in meters
  const φ1 = toRadians(centerLat);
  const φ2 = toRadians(userLat);
  const Δφ = toRadians(userLat - centerLat);
  const Δλ = toRadians(userLng - centerLng);

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  console.log(`Calculated distance: ${distance.toFixed(2)} meters`);
  
  // Add 5% buffer for GPS inaccuracy
  const isWithin = distance <= radius * 1.05;
  
  console.log(`Is within geofence: ${isWithin}`);
  return isWithin;
};