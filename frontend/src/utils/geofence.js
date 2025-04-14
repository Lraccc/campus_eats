export const isWithinGeofence = (userLat, userLng, centerLat, centerLng, radius) => {
    const toRadians = (degrees) => (degrees * Math.PI) / 180;
  
    const earthRadius = 6371000; // Earth's radius in meters
    const dLat = toRadians(centerLat - userLat);
    const dLng = toRadians(centerLng - userLng);
  
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(userLat)) *
        Math.cos(toRadians(centerLat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;
  
    return distance <= radius; // Returns true if within the geofence
  };