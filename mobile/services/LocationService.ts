import * as Location from 'expo-location';
import { useState, useEffect } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    console.error('Error updating location:', error);
    return false;
  }
};

// Function to get location from the server
export const getLocationFromServer = async (
  orderId: string,
  userType: 'dasher' | 'user'
): Promise<LocationData | null> => {
  try {
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
    console.error('Error getting location:', error);
    return null;
  }
};
