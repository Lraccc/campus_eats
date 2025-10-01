import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

type Fix = { latitude: number; longitude: number; heading?: number; speed?: number };

export const useCurrentLocation = () => {
  const [location, setLocation] = useState<Fix | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let watchSub: Location.LocationSubscription | null = null;
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      // Fast initial fix
      const last = await Location.getLastKnownPositionAsync();
      if (mounted && last) {
        setLocation({
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          heading: last.coords.heading ?? 0,
          speed: last.coords.speed ?? 0,
        });
      }

      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          maximumAge: 10000,
          timeout: 5000,
        });
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

      // Lightweight watcher
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

// ---- Backend API helpers (shared by user/dasher maps) ----
const API_HOST =
  process.env.EXPO_PUBLIC_API_HOST ||
  (Platform.OS === "android" ? "http://10.0.2.2:8080" : "http://localhost:8080");

const API_BASE = `${API_HOST}/api/orders`;

// simple logger
const log = (label: string, orderId?: string) =>
  console.log(`[LocationService] ${label}`, { API_HOST, API_BASE, orderId });

// Print once on module load
log("INIT");

const withTimeout = async (input: any, init?: RequestInit, ms = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

const isAbort = (e: any) => e?.name === "AbortError";

// POST user location
export const updateUserLocationOnServer = async (orderId: string, locationData: any) => {
  log("POST user", orderId);
  try {
    const res = await withTimeout(`${API_BASE}/${encodeURIComponent(orderId)}/location/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ timestamp: new Date().toISOString(), ...locationData }),
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error("Failed to update user location");
    return await res.json();
  } catch (err) {
    if (isAbort(err)) return null;
    console.error("Error updating user location:", err);
    throw err;
  }
};

// POST dasher location
export const updateDasherLocationOnServer = async (orderId: string, locationData: any) => {
  log("POST dasher", orderId);
  try {
    const res = await withTimeout(`${API_BASE}/${encodeURIComponent(orderId)}/location/dasher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ timestamp: new Date().toISOString(), ...locationData }),
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error("Failed to update dasher location");
    return await res.json();
  } catch (err) {
    if (isAbort(err)) return null;
    console.error("Error updating dasher location:", err);
    throw err;
  }
};

// GET user location
export const getUserLocationFromServer = async (orderId: string) => {
  log("GET user", orderId);
  try {
    const res = await withTimeout(`${API_BASE}/${encodeURIComponent(orderId)}/location/user`);
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) throw new Error("Failed to fetch user location");
    return await res.json();
  } catch (err) {
    if (isAbort(err)) return null;
    console.error("Error fetching user location:", err);
    throw err;
  }
};

// GET dasher location
export const getDasherLocationFromServer = async (orderId: string) => {
  log("GET dasher", orderId);
  try {
    const res = await withTimeout(`${API_BASE}/${encodeURIComponent(orderId)}/location/dasher`);
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) throw new Error("Failed to fetch dasher location");
    return await res.json();
  } catch (err) {
    if (isAbort(err)) return null;
    console.error("Error fetching dasher location:", err);
    throw err;
  }
};