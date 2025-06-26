import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { API_URL, AUTH_TOKEN_KEY } from '../config';

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
export const useCurrentLocation = (trackingInterval = 5000) => {
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
          accuracy: Location.Accuracy.Highest,
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
            accuracy: Location.Accuracy.Highest,
            distanceInterval: 10, // Update if moved by 10 meters
            timeInterval: trackingInterval, // Update every X ms
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
              setLocation(locationData);
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
              
              // Add small random movement to simulate change over time if location is old
              if (Date.now() - parsedLocation.timestamp > 5000) {
                return {
                  ...parsedLocation,
                  latitude: parsedLocation.latitude + (Math.random() * 0.0002 - 0.0001),
                  longitude: parsedLocation.longitude + (Math.random() * 0.0002 - 0.0001),
                  heading: parsedLocation.heading !== null ? 
                    parsedLocation.heading + (Math.random() * 5 - 2.5) : Math.random() * 360,
                  speed: parsedLocation.speed !== null ? 
                    Math.max(0, parsedLocation.speed + (Math.random() * 1 - 0.5)) : Math.random() * 5,
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
};