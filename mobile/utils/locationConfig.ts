// Location configuration to optimize for different scenarios and reduce flickering

export const LOCATION_CONFIG = {
  // Default location tracking settings
  DEFAULT: {
    accuracy: 'Balanced', // Use Balanced instead of Highest to reduce battery drain and flickering
    distanceInterval: 20, // 20 meters minimum movement
    timeInterval: 10000, // 10 seconds minimum time between updates
  },
  
  // High precision for critical operations (delivery tracking)
  HIGH_PRECISION: {
    accuracy: 'High', // Still not Highest to balance precision with stability
    distanceInterval: 10, // 10 meters minimum movement
    timeInterval: 8000, // 8 seconds
  },
  
  // Low precision for background operations (geofence checking)
  LOW_PRECISION: {
    accuracy: 'Balanced',
    distanceInterval: 50, // 50 meters minimum movement
    timeInterval: 15000, // 15 seconds
  },
  
  // Map update settings
  MAP_UPDATE: {
    pollInterval: 10000, // Poll other user locations every 10 seconds
    debounceDelay: 1000, // 1 second debounce for map updates
    smoothingFactor: 0.3, // Light smoothing for location updates
    minDistance: 5, // 5 meters minimum movement to trigger map update
  },
  
  // Mock data settings for development
  MOCK_DATA: {
    randomMovementThreshold: 30000, // Only add random movement after 30 seconds
    maxRandomMovement: 0.0001, // Reduce random movement to prevent flickering
    speedVariation: 0.2, // Reduce speed variation
    headingVariation: 2, // Reduce heading variation
  }
};

// Utility function to get location accuracy enum from string
export const getLocationAccuracy = (accuracyLevel: string) => {
  const Location = require('expo-location');
  switch (accuracyLevel) {
    case 'Lowest':
      return Location.Accuracy.Lowest;
    case 'Low':
      return Location.Accuracy.Low;
    case 'Balanced':
      return Location.Accuracy.Balanced;
    case 'High':
      return Location.Accuracy.High;
    case 'Highest':
      return Location.Accuracy.Highest;
    case 'BestForNavigation':
      return Location.Accuracy.BestForNavigation;
    default:
      return Location.Accuracy.Balanced;
  }
};