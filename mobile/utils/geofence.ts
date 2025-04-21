export const isWithinGeofence = (
    userLat: number,
    userLng: number,
    centerLat: number,
    centerLng: number,
    radius: number
  ): boolean => {
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  
    const R = 6371000; // Earth radius in meters
    const φ1 = toRadians(centerLat);
    const φ2 = toRadians(userLat);
    const Δφ = toRadians(userLat - centerLat);
    const Δλ = toRadians(userLng - centerLng);
  
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
  
    // Add 5% buffer for GPS inaccuracy
    return distance <= radius * 1.05;
  };