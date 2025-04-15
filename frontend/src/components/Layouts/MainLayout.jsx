import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import { isWithinGeofence } from "../../utils/geofence";
import Navbar from "../Navbar/Navbar";
import "../css/Modal.css";

const MainLayout = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [accessStatus, setAccessStatus] = useState({
    granted: true,
    locationEnabled: true,
    inServiceArea: true
  });
  const [showModal, setShowModal] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0); // Used to trigger re-renders

  // Geofence configuration
  const geofenceCenter = { lat: 10.295663, lng: 123.880895 }; // Center of Geofence
  const geofenceRadius = 50000; // 50km in meters

  const checkLocationAccess = async () => {
    if (!navigator.geolocation) {
      console.error("Geolocation not supported");
      return {
        granted: false,
        locationEnabled: false,
        inServiceArea: false
      };
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      });

      const { latitude, longitude, accuracy } = position.coords;
      console.log(`Current position: 
        Lat: ${latitude}, Lng: ${longitude}
        Accuracy: ±${accuracy} meters`);

      // Verify coordinates are valid
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        throw new Error("Invalid coordinates received");
      }

      const inServiceArea = await isWithinGeofence(
        latitude,
        longitude,
        geofenceCenter.lat,
        geofenceCenter.lng,
        geofenceRadius
      );

      return {
        granted: inServiceArea,
        locationEnabled: true,
        inServiceArea,
        accuracy
      };
    } catch (error) {
      console.error("Location error:", error);
      const permissionDenied = error.code === error.PERMISSION_DENIED;
      return {
        granted: false,
        locationEnabled: !permissionDenied,
        inServiceArea: false,
        accuracy: null
      };
    }
  };

  // Enhanced location monitoring with strict enforcement
  useEffect(() => {
    if (!currentUser) return;

    let watchId;
    let intervalId;
    let isMounted = true;

    const verifyAccess = async () => {
      const status = await checkLocationAccess();
      if (!isMounted) return;
      
      setAccessStatus(status);
      setShowModal(!status.granted);
      
      // Force UI update if access was revoked
      if (!status.granted && accessStatus.granted) {
        setForceUpdate(prev => prev + 1);
      }
    };

    // Immediate check
    verifyAccess();

    // Watch for location changes
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        () => verifyAccess(),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            verifyAccess();
          }
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }

    // Fallback interval check every 5 seconds
    intervalId = setInterval(verifyAccess, 5000);

    return () => {
      isMounted = false;
      if (watchId) navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  }, [currentUser, forceUpdate]);

  const handleCheckLocation = async () => {
    const status = await checkLocationAccess();
    setAccessStatus(status);
    setShowModal(!status.granted);
    if (!status.granted) {
      setForceUpdate(prev => prev + 1); // Force re-render
    }
  };

  // Strict service blocking
  const blockService = currentUser && !accessStatus.granted;

  return (
    <div>
      {blockService && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content">
            <h2>Access Restricted</h2>
            <p>
              {accessStatus.locationEnabled
                ? "You must be within the service area to use this app."
                : "Please enable your location services to use this app."}
            </p>
            <button onClick={handleCheckLocation}>Check Location</button>
          </div>
        </div>
      )}
      
      {/* Strict UI blocking */}
      <div style={blockService ? { 
        pointerEvents: 'none', 
        opacity: 0.5,
        filter: 'blur(2px)',
        userSelect: 'none'
      } : null}>
        {location.pathname !== "/verification-success" &&
          location.pathname !== "/verification-failed" && <Navbar />}
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;