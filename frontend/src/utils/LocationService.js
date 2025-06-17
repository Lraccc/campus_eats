import axios from './axiosConfig';

/**
 * Retrieves the current location using browser's Geolocation API
 * @returns {Promise<Object>} - Location data
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, heading, speed, accuracy } = position.coords;
        resolve({
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
          accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
};

/**
 * Starts tracking location changes
 * @param {Function} callback - Function to call with updated location
 * @returns {Object} - Methods to start and stop tracking
 */
export const useLocationTracking = (callback) => {
  let watchId = null;

  const startTracking = () => {
    if (!navigator.geolocation) {
      callback(null, 'Geolocation not supported');
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed, accuracy } = position.coords;
        callback({
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
          accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => callback(null, `Tracking error: ${error.message}`),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };

  return { startTracking, stopTracking };
};

/**
 * Updates location data on the server
 * @param {string} orderId - Order ID
 * @param {string} userType - User type (user or dasher)
 * @param {Object} location - Location data
 * @returns {Promise<Object>} - Server response
 */
export const updateLocationOnServer = async (orderId, userType, location) => {
  try {
    // Store in local storage for fallback
    const locationData = { ...location, timestamp: new Date().toISOString() };
    localStorage.setItem(`location_${orderId}_${userType}`, JSON.stringify(locationData));
    
    // Skip API if previously marked unavailable
    if (localStorage.getItem('locationApiUnavailable') === 'true') {
      return { success: true, fromLocalStorage: true };
    }
    
    const token = localStorage.getItem('userToken');
    const response = await axios.post(
      `/orders/${orderId}/location/${userType}`,
      location,
      { headers: { Authorization: `Bearer ${token}` }}
    );
    
    return response.data;
  } catch (error) {
    // Mark API unavailable if auth errors
    if (error.response && (error.response.status === 401 || error.response.status === 405)) {
      localStorage.setItem('locationApiUnavailable', 'true');
    }
    return { success: false, fromLocalStorage: true };
  }
};

/**
 * Gets location data from the server for the other party
 * @param {string} orderId - Order ID
 * @param {string} userType - User type to retrieve (user or dasher)
 * @returns {Promise<Object>} - Location data
 */
export const getLocationFromServer = async (orderId, userType) => {
  // Check if coordinates are valid
  const isValidLocation = (lat, lng) => {
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) < 0.001 || Math.abs(lng) < 0.001) {
      return false;
    }
    // Philippines rough boundaries
    return lat >= 4.5 && lat <= 21.5 && lng >= 115 && lng <= 127;
  };

  try {
    // Try API first if not marked unavailable
    if (localStorage.getItem('locationApiUnavailable') !== 'true') {
      const token = localStorage.getItem('userToken');
      const response = await axios.get(
        `/orders/${orderId}/location/${userType}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );

      if (response.data && response.data.latitude && response.data.longitude) {
        const lat = parseFloat(response.data.latitude);
        const lng = parseFloat(response.data.longitude);
        
        if (isValidLocation(lat, lng)) {
          // Save valid data to localStorage
          localStorage.setItem(
            `location_${orderId}_${userType}`, 
            JSON.stringify({
              ...response.data,
              timestamp: new Date().toISOString()
            })
          );
          
          // Reset API unavailable flag
          localStorage.removeItem('locationApiUnavailable');
          return response.data;
        }
      }
    }
  } catch (error) {
    // Mark API as unavailable for auth errors
    if (error.response && (error.response.status === 401 || error.response.status === 405)) {
      localStorage.setItem('locationApiUnavailable', 'true');
    }
  }
  
  // Fall back to localStorage
  const storedLocation = localStorage.getItem(`location_${orderId}_${userType}`);
  if (storedLocation) {
    const locationData = JSON.parse(storedLocation);
    const timestamp = new Date(locationData.timestamp);
    
    // Only return if less than 2 minutes old
    if ((new Date() - timestamp) < 120000) {
      return locationData;
    }
  }
  
  return null;
};
