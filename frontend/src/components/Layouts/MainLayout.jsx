import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext"; // Import authentication context
import { isWithinGeofence } from "../../utils/geofence";
import Navbar from "../Navbar/Navbar";

const MainLayout = () => {
  const location = useLocation();
  const { currentUser } = useAuth(); // Get the current user from the AuthContext
  const [isInsideGeofence, setIsInsideGeofence] = useState(true);

  // Define the geofence center and radius
  const geofenceCenter = { lat: 10.295663, lng: 123.880895 }; // Labangon, Cebu City
  const geofenceRadius = 5000; // 5 km radius

  useEffect(() => {
    // Only check geofence if the user is logged in
    if (currentUser) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const insideGeofence = isWithinGeofence(
              latitude,
              longitude,
              geofenceCenter.lat,
              geofenceCenter.lng,
              geofenceRadius
            );
            setIsInsideGeofence(insideGeofence);
          },
          (error) => {
            console.error("Error getting location:", error);
            setIsInsideGeofence(false); // Default to outside geofence if location is unavailable
          }
        );
      } else {
        console.error("Geolocation is not supported by this browser.");
        setIsInsideGeofence(false);
      }
    }
  }, [currentUser]); // Run geofence check only when the user logs in

  // Restrict access if the user is logged in but outside the geofence
  if (currentUser && !isInsideGeofence) {
    return (
      <div>
        <h1>Access Restricted</h1>
        <p>You must be within the service area to use this app.</p>
      </div>
    );
  }

  return (
    <div>
      {location.pathname !== "/verification-success" &&
        location.pathname !== "/verification-failed" && <Navbar />}
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;