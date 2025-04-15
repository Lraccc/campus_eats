import { isWithinGeofence } from "./geofence.js";

const testGeofence = () => {
  const userLat = 10.260492; // Example user latitude
  const userLng = 123.841853; // Example user longitude
  const centerLat = 10.295663; // Geofence center latitude
  const centerLng = 123.880895; // Geofence center longitude
  const radius = 50000; // Geofence radius in meters

  const result = isWithinGeofence(userLat, userLng, centerLat, centerLng, radius);
  console.log(`Is user within geofence: ${result}`);
};

// To test got to terminal then - cd frontend\src\utils
// then run -                     node geofenceTest.js
// Expected output              - Is user within geofence: true
testGeofence();