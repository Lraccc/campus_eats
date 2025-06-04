import axios from './axiosConfig';

/**
 * Retrieves the current location using browser's Geolocation API
 * @param {Object} options - Geolocation options
 * @returns {Promise<Object>} - Location data
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    };

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
        reject(new Error(`Error getting location: ${error.message}`));
      },
      options
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
      callback(null, 'Geolocation is not supported by your browser');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    };

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
      (error) => {
        callback(null, `Error tracking location: ${error.message}`);
      },
      options
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
    const token = localStorage.getItem('userToken');
    const response = await axios.post(
      `/api/orders/${orderId}/location/${userType}`,
      location,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating location on server:', error);
    throw error;
  }
};

/**
 * Gets location data from the server for the other party
 * @param {string} orderId - Order ID
 * @param {string} userType - User type to retrieve (user or dasher)
 * @returns {Promise<Object>} - Location data
 */
export const getLocationFromServer = async (orderId, userType) => {
  try {
    const token = localStorage.getItem('userToken');
    const response = await axios.get(
      `/api/orders/${orderId}/location/${userType}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting location from server:', error);
    throw error;
  }
};
