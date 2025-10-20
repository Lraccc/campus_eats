import type { LocationSubscription } from "expo-location";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

export type Fix = { latitude: number; longitude: number; heading?: number; speed?: number };

// Base URL: use EXPO_PUBLIC_API_BASE, fallback to live backend
const API_ROOT = (process.env.EXPO_PUBLIC_API_BASE ?? "https://campus-eats-backend.onrender.com").replace(/\/$/, "");
const API_BASE = `${API_ROOT}/api/orders`;

// ---------- REST API helpers (aligned with frontend LocationService.js) ----------

// POST user location
export const updateUserLocationOnServer = async (orderId: string, locationData: Fix) => {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(orderId)}/location/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ timestamp: new Date().toISOString(), ...locationData }),
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error("Failed to update user location");
    return await res.json();
  } catch (err) {
    console.error("Error updating user location:", err);
    throw err;
  }
};

// POST dasher location
export const updateDasherLocationOnServer = async (orderId: string, locationData: Fix) => {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(orderId)}/location/dasher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ timestamp: new Date().toISOString(), ...locationData }),
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error("Failed to update dasher location");
    return await res.json();
  } catch (err) {
    console.error("Error updating dasher location:", err);
    throw err;
  }
};

// GET user location
export const getUserLocationFromServer = async (orderId) => {
  try {
    const res = await fetch(`${API_BASE}/${orderId}/location/user`);
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) throw new Error("Failed to fetch user location");
    return await res.json();
  } catch (err) {
    console.error("Error fetching user location:", err);
    return null;
  }
};

// GET dasher location
export const getDasherLocationFromServer = async (orderId) => {
  try {
    const res = await fetch(`${API_BASE}/${orderId}/location/dasher`);
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) throw new Error("Failed to fetch dasher location");
    return await res.json();
  } catch (err) {
    console.error("Error fetching dasher location:", err);
    return null;
  }
};

// ---------- Device location hook (used by UserMap/DeliveryMap) ----------
export const useCurrentLocation = () => {
  const [location, setLocation] = useState<Fix | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let watchSub: LocationSubscription | null = null;
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (mounted && current) {
          setLocation({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            heading: current.coords.heading ?? 0,
            speed: current.coords.speed ?? 0,
          });
        }
      } catch {
        // ignore; watcher will update
      }

      watchSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 3000, distanceInterval: 10 },
        (pos) => {
          if (!mounted) return;
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading ?? 0,
            speed: pos.coords.speed ?? 0,
          });
        }
      );
    })();

    return () => {
      mounted = false;
      watchSub?.remove();
    };
  }, []);

  return { location, errorMsg };
};