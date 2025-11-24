import { LocationData } from '../services/LocationService';

interface SmoothedLocationState {
  lastLocation: LocationData | null;
  lastUpdateTime: number;
}

const locationStates: Map<string, SmoothedLocationState> = new Map();

/**
 * Smooths location updates to prevent flickering by filtering out
 * small movements and applying simple smoothing algorithms
 */
export const smoothLocationUpdate = (
  userId: string,
  newLocation: LocationData,
  options: {
    minDistance?: number; // Minimum distance in meters to trigger update
    minTimeInterval?: number; // Minimum time in ms between updates
    smoothingFactor?: number; // 0-1, higher values = more smoothing
  } = {}
): LocationData | null => {
  const {
    minDistance = 5, // 5 meters minimum movement
    minTimeInterval = 3000, // 3 seconds minimum between updates
    smoothingFactor = 0.3 // Light smoothing
  } = options;

  const currentTime = Date.now();
  const state = locationStates.get(userId) || { lastLocation: null, lastUpdateTime: 0 };

  // If this is the first location update, save it and return
  if (!state.lastLocation) {
    const updatedState = { lastLocation: newLocation, lastUpdateTime: currentTime };
    locationStates.set(userId, updatedState);
    return newLocation;
  }

  // Check if enough time has passed
  if (currentTime - state.lastUpdateTime < minTimeInterval) {
    return null; // Don't update yet
  }

  // Calculate distance moved
  const distance = calculateDistance(
    state.lastLocation.latitude,
    state.lastLocation.longitude,
    newLocation.latitude,
    newLocation.longitude
  );

  // If movement is too small, don't update
  if (distance < minDistance) {
    return null;
  }

  // Apply smoothing to coordinates
  const smoothedLocation: LocationData = {
    ...newLocation,
    latitude: applySmoothing(state.lastLocation.latitude, newLocation.latitude, smoothingFactor),
    longitude: applySmoothing(state.lastLocation.longitude, newLocation.longitude, smoothingFactor),
    heading: newLocation.heading !== null && state.lastLocation.heading !== null 
      ? applySmoothing(state.lastLocation.heading, newLocation.heading, smoothingFactor)
      : newLocation.heading,
    speed: newLocation.speed !== null && state.lastLocation.speed !== null
      ? applySmoothing(state.lastLocation.speed, newLocation.speed, smoothingFactor)
      : newLocation.speed,
  };

  // Update state
  const updatedState = { lastLocation: smoothedLocation, lastUpdateTime: currentTime };
  locationStates.set(userId, updatedState);

  return smoothedLocation;
};

/**
 * Calculate distance between two coordinates in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Apply simple exponential smoothing
 */
function applySmoothing(oldValue: number, newValue: number, factor: number): number {
  return oldValue + factor * (newValue - oldValue);
}

/**
 * Clear smoothing state for a user (useful for logout or reset)
 */
export const clearLocationSmoothing = (userId: string): void => {
  locationStates.delete(userId);
};

/**
 * Reset all location smoothing states
 */
export const resetAllLocationSmoothing = (): void => {
  locationStates.clear();
};