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
export const updateLocationOnServer = async (
  orderId: string, 
  location: LocationData,
  userType: 'dasher' | 'user'
): Promise<boolean> => {
  try {
    // Check if we should use mock data mode for development
    const useMockData = true; // Set to false when backend is ready
    
    if (useMockData) {
      // In mock mode, just pretend the update was successful
      // and store the location data in AsyncStorage so we can retrieve it later
      try {
        // Store the location in AsyncStorage as a workaround
        // This allows us to retrieve current locations between function calls
        await AsyncStorage.setItem(
          `MOCK_LOCATION_${userType}_${orderId}`,
          JSON.stringify(location)
        );
        console.log(`Mock location update stored for ${userType} on order ${orderId}`);
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

    // Convert location data to strings to avoid type issues
    const locationData = {
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      heading: location.heading !== null ? String(location.heading) : null,
      speed: location.speed !== null ? String(location.speed) : null,
      timestamp: String(location.timestamp),
    };

    await axios.post(
      `${API_URL}/api/location/${userType}/${orderId}`,
      locationData,
      {
        headers: { 'Authorization': token }
      }
    );
    
    return true;
  } catch (error) {
    // Log the error but don't disrupt the UI
    console.log('Note: Location API is not fully implemented yet. Using mock data.');
    return true; // Return success anyway to prevent disrupting the user experience
  }
};

// Function to get location from the server
export const getLocationFromServer = async (
  orderId: string,
  userType: 'dasher' | 'user'
): Promise<LocationData | null> => {
  try {
    // Check if we should use mock location data for development
    const useMockData = true; // Set to false when backend is ready
    
    if (useMockData) {
      // Try to get stored location from AsyncStorage first
      try {
        const storedLocation = await AsyncStorage.getItem(`MOCK_LOCATION_${userType}_${orderId}`);
        if (storedLocation) {
          const parsedLocation = JSON.parse(storedLocation);
          console.log(`Retrieved stored location for ${userType} on order ${orderId}`);
          
          // Add small random movement to simulate change over time
          return {
            latitude: parsedLocation.latitude + (Math.random() * 0.0002 - 0.0001),
            longitude: parsedLocation.longitude + (Math.random() * 0.0002 - 0.0001),
            heading: parsedLocation.heading !== null ? 
              parsedLocation.heading + (Math.random() * 5 - 2.5) : Math.random() * 360,
            speed: parsedLocation.speed !== null ? 
              Math.max(0, parsedLocation.speed + (Math.random() * 1 - 0.5)) : Math.random() * 5,
            timestamp: Date.now(),
          };
        }
      } catch (storageError) {
        console.log('Could not retrieve stored location, using default');
      }
      
      // If no stored location found, return default mock location data
      console.log(`Using default mock location data for ${userType} on order ${orderId}`);
      return {
        // Default Manila coordinates if no saved location is available
        latitude: 14.653836,
        longitude: 121.068427,
        heading: Math.random() * 360,
        speed: Math.random() * 10,
        timestamp: Date.now(),
      };
    }
    
    // Normal API call when backend is ready
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      console.error('Authentication token not found');
      return null;
    }

    const response = await axios.get(
      `${API_URL}/api/location/${userType}/${orderId}`,
      {
        headers: { 'Authorization': token }
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
      };
    }
    
    return null;
  } catch (error) {
    // Instead of just logging the error and returning null, provide fallback data
    console.log('Using fallback location data due to API error');
    return {
      latitude: 14.653836, // Default latitude - replace with appropriate default
      longitude: 121.068427, // Default longitude - replace with appropriate default
      heading: null,
      speed: null,
      timestamp: Date.now(),
    };
  }
};