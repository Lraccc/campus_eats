import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { API_URL, AUTH_TOKEN_KEY } from '../config';
import { smoothLocationUpdate } from '../utils/locationSmoothing';
import { LOCATION_CONFIG, getLocationAccuracy } from '../utils/locationConfig';

// Define location data interface
export interface LocationData {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  userId: string; // Added to identify which user this location belongs to
}

// Define location sharing configuration
export interface LocationSharingConfig {
  shareWithUserIds: string[]; // List of user IDs to share location with
  isSharing: boolean; // Whether location sharing is currently active
}

// Hook to get and track current location
export const useCurrentLocation = (trackingInterval = 10000) => { // Increased default from 5s to 10s
  const [location, setLocation] = useState<LocationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        // Get initial location
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: getLocationAccuracy(LOCATION_CONFIG.DEFAULT.accuracy),
        });
        
        if (isMounted) {
          const locationData: LocationData = {
            latitude: initialLocation.coords.latitude,
            longitude: initialLocation.coords.longitude,
            heading: initialLocation.coords.heading,
            speed: initialLocation.coords.speed,
            timestamp: initialLocation.timestamp,
            userId: '', // Will be set when updating to server
          };
          setLocation(locationData);
        }

        // Subscribe to location updates
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: getLocationAccuracy(LOCATION_CONFIG.DEFAULT.accuracy),
            distanceInterval: LOCATION_CONFIG.DEFAULT.distanceInterval,
            timeInterval: Math.max(trackingInterval, LOCATION_CONFIG.DEFAULT.timeInterval),
          },
          (newLocation) => {
            if (isMounted) {
              const locationData: LocationData = {
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
                heading: newLocation.coords.heading,
                speed: newLocation.coords.speed,
                timestamp: newLocation.timestamp,
                userId: '', // Will be set when updating to server
              };
              
              // Apply location smoothing to reduce flickering
              const smoothedLocation = smoothLocationUpdate('current_user', locationData, {
                minDistance: LOCATION_CONFIG.MAP_UPDATE.minDistance,
                minTimeInterval: LOCATION_CONFIG.DEFAULT.timeInterval / 2, // Allow updates between location service updates
                smoothingFactor: LOCATION_CONFIG.MAP_UPDATE.smoothingFactor
              });
              if (smoothedLocation) {
                setLocation(smoothedLocation);
              }
            }
          }
        );
      } catch (error) {
        if (isMounted) {
          setErrorMsg('Error getting location: ' + (error instanceof Error ? error.message : String(error)));
        }
      }
    };

    startLocationTracking();

    return () => {
      isMounted = false;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [trackingInterval]);

  return { location, errorMsg };
};

// Function to update location on the server
export const updateUserLocation = async (
  userId: string,
  location: Omit<LocationData, 'userId'>,
  sharingConfig?: LocationSharingConfig
): Promise<boolean> => {
  try {
    // Check if we should use mock data mode for development
    const useMockData = true; // Set to false when backend is ready
    
    if (useMockData) {
      // In mock mode, store the location data in AsyncStorage
      try {
        const locationWithUserId: LocationData = {
          ...location,
          userId
        };
        
        // Store the user's location
        await AsyncStorage.setItem(
          `MOCK_LOCATION_${userId}`,
          JSON.stringify(locationWithUserId)
        );
        
        // If sharing config is provided, store who can access this location
        if (sharingConfig) {
          await AsyncStorage.setItem(
            `MOCK_LOCATION_SHARING_${userId}`,
            JSON.stringify(sharingConfig)
          );
        }
        
        console.log(`Mock location update stored for user ${userId}`);
      } catch (storageError) {
        console.error('Error storing mock location:', storageError);
      }
      return true;
    }
    
    // Normal API call when backend is ready
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      console.error('Authentication token not found');
      return false;
    }

    const payload = {
      location: {
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        heading: location.heading !== null ? String(location.heading) : null,
        speed: location.speed !== null ? String(location.speed) : null,
        timestamp: String(location.timestamp),
      },
      sharingConfig
    };

    await axios.put(
      `${API_URL}/api/location/${userId}`,
      payload,
      {
        headers: { 'Authorization': token }
      }
    );
    
    return true;
  } catch (error) {
    console.error('Error updating location:', error);
    return false;
  }
};

// Function to get a user's location from the server
export const getUserLocation = async (
  userId: string,
  requestingUserId: string // ID of the user making the request
): Promise<LocationData | null> => {
  try {
    // Check if we should use mock location data for development
    const useMockData = true; // Set to false when backend is ready
    
    if (useMockData) {
      // First check if the requesting user has permission
      try {
        const sharingConfigStr = await AsyncStorage.getItem(`MOCK_LOCATION_SHARING_${userId}`);
        if (sharingConfigStr) {
          const sharingConfig: LocationSharingConfig = JSON.parse(sharingConfigStr);
          
          // Check if sharing is enabled and if the requesting user is allowed
          if (sharingConfig.isSharing && 
              (sharingConfig.shareWithUserIds.includes(requestingUserId) || 
               sharingConfig.shareWithUserIds.includes('*'))) {
               
            // Get the stored location
            const storedLocation = await AsyncStorage.getItem(`MOCK_LOCATION_${userId}`);
            if (storedLocation) {
              const parsedLocation: LocationData = JSON.parse(storedLocation);
              
              // Only add small random movement if location is very old to reduce flickering
              if (Date.now() - parsedLocation.timestamp > LOCATION_CONFIG.MOCK_DATA.randomMovementThreshold) {
                return {
                  ...parsedLocation,
                  latitude: parsedLocation.latitude + (Math.random() * LOCATION_CONFIG.MOCK_DATA.maxRandomMovement - LOCATION_CONFIG.MOCK_DATA.maxRandomMovement/2),
                  longitude: parsedLocation.longitude + (Math.random() * LOCATION_CONFIG.MOCK_DATA.maxRandomMovement - LOCATION_CONFIG.MOCK_DATA.maxRandomMovement/2),
                  heading: parsedLocation.heading !== null ? 
                    parsedLocation.heading + (Math.random() * LOCATION_CONFIG.MOCK_DATA.headingVariation - LOCATION_CONFIG.MOCK_DATA.headingVariation/2) : Math.random() * 360,
                  speed: parsedLocation.speed !== null ? 
                    Math.max(0, parsedLocation.speed + (Math.random() * LOCATION_CONFIG.MOCK_DATA.speedVariation - LOCATION_CONFIG.MOCK_DATA.speedVariation/2)) : Math.random() * 2,
                  timestamp: Date.now(),
                };
              }
              return parsedLocation;
            }
          }
        }
      } catch (storageError) {
        console.log('Could not retrieve stored location or sharing config', storageError);
      }
      
      // If no permission or no stored location, return null
      return null;
    }
    
    // Normal API call when backend is ready
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      console.error('Authentication token not found');
      return null;
    }

    const response = await axios.get(
      `${API_URL}/api/location/${userId}`,
      {
        headers: { 
          'Authorization': token,
          'X-Requesting-User': requestingUserId 
        }
      }
    );

    if (response.data) {
      // Convert string values back to numbers
      return {
        latitude: Number(response.data.latitude),
        longitude: Number(response.data.longitude),
        heading: response.data.heading !== null ? Number(response.data.heading) : null,
        speed: response.data.speed !== null ? Number(response.data.speed) : null,
        timestamp: Number(response.data.timestamp),
        userId: response.data.userId,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user location:', error);
    return null;
  }
};

// Function to get multiple users' locations
export const getMultipleUserLocations = async (
  userIds: string[],
  requestingUserId: string
): Promise<Record<string, LocationData>> => {
  try {
    // Check if we should use mock location data for development
    const useMockData = true; // Set to false when backend is ready
    
    if (useMockData) {
      const results: Record<string, LocationData> = {};
      
      for (const userId of userIds) {
        const location = await getUserLocation(userId, requestingUserId);
        if (location) {
          results[userId] = location;
        }
      }
      
      return results;
    }
    
    // Normal API call when backend is ready
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      console.error('Authentication token not found');
      return {};
    }

    const response = await axios.post(
      `${API_URL}/api/location/batch`,
      { userIds },
      {
        headers: { 
          'Authorization': token,
          'X-Requesting-User': requestingUserId 
        }
      }
    );

    if (response.data) {
      // Convert the response data to our expected format
      const locations: Record<string, LocationData> = {};
      
      for (const [id, locData] of Object.entries(response.data)) {
        const location = locData as any;
        locations[id] = {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          heading: location.heading !== null ? Number(location.heading) : null,
          speed: location.speed !== null ? Number(location.speed) : null,
          timestamp: Number(location.timestamp),
          userId: id,
        };
      }
      
      return locations;
    }
    
    return {};
  } catch (error) {
    console.error('Error getting multiple user locations:', error);
    return {};
  }
};

// Function to manage location sharing settings
export const updateLocationSharing = async (
  userId: string,
  sharingConfig: LocationSharingConfig
): Promise<boolean> => {
  try {
    // Check if we should use mock data mode for development
    const useMockData = true; // Set to false when backend is ready
    
    if (useMockData) {
      try {
        await AsyncStorage.setItem(
          `MOCK_LOCATION_SHARING_${userId}`,
          JSON.stringify(sharingConfig)
        );
        console.log(`Updated sharing settings for user ${userId}`);
        return true;
      } catch (storageError) {
        console.error('Error storing sharing settings:', storageError);
        return false;
      }
    }
    
    // Normal API call when backend is ready
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      console.error('Authentication token not found');
      return false;
    }

    await axios.put(
      `${API_URL}/api/location/${userId}/sharing`,
      sharingConfig,
      {
        headers: { 'Authorization': token }
      }
    );
    
    return true;
  } catch (error) {
    console.error('Error updating location sharing settings:', error);
    return false;
  }
}

export interface LocationPermissionState {
  isLocationEnabled: boolean;
  hasPermission: boolean;
  isChecking: boolean;
  error?: string;
}

export class LocationService {
  private static instance: LocationService;
  private currentState: LocationPermissionState = {
    isLocationEnabled: false,
    hasPermission: false,
    isChecking: true,
  };

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async initialize(): Promise<LocationPermissionState> {
    try {
      this.currentState.isChecking = true;

      // Check if location services are enabled on the device
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      
      // Check permissions
      const { status } = await Location.getForegroundPermissionsAsync();
      const hasPermission = status === 'granted';

      this.currentState = {
        isLocationEnabled,
        hasPermission,
        isChecking: false,
      };

      return this.currentState;
    } catch (error) {
      this.currentState = {
        isLocationEnabled: false,
        hasPermission: false,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      return this.currentState;
    }
  }

  async requestPermissions(): Promise<LocationPermissionState> {
    try {
      this.currentState.isChecking = true;

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      const hasPermission = status === 'granted';

      // Re-check if location services are enabled
      const isLocationEnabled = await Location.hasServicesEnabledAsync();

      this.currentState = {
        isLocationEnabled,
        hasPermission,
        isChecking: false,
      };

      return this.currentState;
    } catch (error) {
      this.currentState = {
        isLocationEnabled: false,
        hasPermission: false,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      return this.currentState;
    }
  }

  getCurrentState(): LocationPermissionState {
    return { ...this.currentState };
  }

  async recheckLocationStatus(): Promise<LocationPermissionState> {
    return this.initialize();
  }
}

export const locationService = LocationService.getInstance();