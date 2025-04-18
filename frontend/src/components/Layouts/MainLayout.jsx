import { useEffect, useRef, useState } from "react";
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
    inServiceArea: true,
    errorType: null,
    accuracy: null
  });
  const [showModal, setShowModal] = useState(false);
  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);

  // Geofence configuration
  const geofenceCenter = { lat: 10.295663, lng: 123.880895 };
  const geofenceRadius = 50000;

  const getFallbackPosition = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return {
        coords: {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 50000,
        }
      };
    } catch (error) {
      console.error("Fallback location failed:", error);
      return null;
    }
  };

  const checkLocationPermission = async () => {
    if (!navigator.permissions) return true; // Can't check, assume granted
    
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return status.state === 'granted';
    } catch {
      return true; // If query fails, assume granted
    }
  };

  const getLocationWithRetry = async (retries = 2) => {
    for (let i = 0; i < retries; i++) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        });
        return position;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(res => setTimeout(res, 1000));
      }
    }
  };

  const checkLocationAccess = async () => {
    if (!navigator.geolocation) {
      return {
        granted: false,
        locationEnabled: false,
        inServiceArea: false,
        errorType: 'unsupported'
      };
    }

    const hasPermission = await checkLocationPermission();
    if (!hasPermission) {
      return {
        granted: false,
        locationEnabled: false,
        inServiceArea: false,
        errorType: 'permission'
      };
    }

    try {
      const position = await getLocationWithRetry();
      lastPositionRef.current = position;

      const { latitude, longitude, accuracy } = position.coords;
      
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
        accuracy,
        errorType: null
      };
    } catch (error) {
      console.error("Location error:", error);
      
      // If we have a recent position, use that
      if (lastPositionRef.current) {
        const { latitude, longitude } = lastPositionRef.current.coords;
        const inServiceArea = await isWithinGeofence(
          latitude,
          longitude,
          geofenceCenter.lat,
          geofenceCenter.lng,
          geofenceRadius
        );
        
        return {
          granted: inServiceArea,
          locationEnabled: false,
          inServiceArea,
          accuracy: lastPositionRef.current.coords.accuracy,
          errorType: 'position_unavailable'
        };
      }

      const permissionDenied = error.code === error.PERMISSION_DENIED;
      const timeoutError = error.code === error.TIMEOUT;
      
      return {
        granted: false,
        locationEnabled: !permissionDenied,
        inServiceArea: false,
        accuracy: null,
        errorType: permissionDenied ? 'permission' : timeoutError ? 'timeout' : 'other'
      };
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const verifyAccess = async () => {
      const status = await checkLocationAccess();
      setAccessStatus(status);
      setShowModal(!status.granted);
    };

    // Immediate check
    verifyAccess();

    // Watch for location changes and permission changes
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          lastPositionRef.current = position;
          verifyAccess();
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            // Immediate block when permission is revoked
            setAccessStatus({
              granted: false,
              locationEnabled: false,
              inServiceArea: false,
              errorType: 'permission',
              accuracy: null
            });
            setShowModal(true);
          } else {
            verifyAccess();
          }
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }

    // Permission change listener (for browsers that support permissions API)
    let permissionStatus;
    if (navigator.permissions) {
      try {
        permissionStatus = navigator.permissions.query({ name: 'geolocation' });
        permissionStatus.then(status => {
          status.onchange = () => {
            if (status.state === 'denied') {
              // Immediate block when permission is revoked
              setAccessStatus({
                granted: false,
                locationEnabled: false,
                inServiceArea: false,
                errorType: 'permission',
                accuracy: null
              });
              setShowModal(true);
            } else {
              verifyAccess();
            }
          };
        });
      } catch (e) {
        console.log("Permissions API not fully supported");
      }
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (permissionStatus && permissionStatus.onchange) {
        permissionStatus.onchange = null;
      }
    };
  }, [currentUser]);

  const handleCheckLocation = async () => {
    const status = await checkLocationAccess();
    setAccessStatus(status);
    setShowModal(!status.granted);
  };

  const blockService = currentUser && !accessStatus.granted;

  return (
    <div>
      {blockService && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content">
            <h2>Access Restricted</h2>
            {accessStatus.errorType === 'permission' ? (
              <>
                <p>Location access has been disabled.</p>
                <p>Please enable location permissions to continue using the service.</p>
              </>
            ) : accessStatus.errorType === 'timeout' ? (
              <>
                <p>We couldn't determine your location.</p>
                <p>Please check your GPS signal and try again.</p>
              </>
            ) : accessStatus.errorType === 'unsupported' ? (
              <p>Your browser doesn't support geolocation services.</p>
            ) : (
              <p>You must be within the service area to use this app.</p>
            )}
          </div>
        </div>
      )}

      <div
        style={
          blockService
            ? {
                pointerEvents: "none",
                opacity: 0.5,
                filter: "blur(2px)",
                userSelect: "none",
                position: 'relative'
              }
            : null
        }
      >
        {blockService && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
            backgroundColor: 'transparent'
          }} />
        )}
        
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