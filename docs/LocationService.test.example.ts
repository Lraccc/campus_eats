/**
 * Example test file for LocationService
 * This demonstrates how to test the location functionality
 * 
 * To use this in the project:
 * 1. Copy to mobile/__tests__/services/LocationService.test.ts
 * 2. Run: npm test
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import {
  useCurrentLocation,
  updateUserLocationOnServer,
  updateDasherLocationOnServer,
  getUserLocationFromServer,
  getDasherLocationFromServer,
} from '../services/LocationService';

// Mock expo-location
jest.mock('expo-location');

// Mock fetch
global.fetch = jest.fn();

describe('LocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  describe('useCurrentLocation', () => {
    it('should request location permissions', async () => {
      const mockRequestPermissions = jest.fn().mockResolvedValue({ status: 'granted' });
      (Location.requestForegroundPermissionsAsync as jest.Mock) = mockRequestPermissions;
      
      const mockGetLastKnown = jest.fn().mockResolvedValue(null);
      (Location.getLastKnownPositionAsync as jest.Mock) = mockGetLastKnown;

      const mockGetCurrent = jest.fn().mockResolvedValue({
        coords: { latitude: 10.0, longitude: 120.0, heading: 0, speed: 0 },
        timestamp: Date.now(),
      });
      (Location.getCurrentPositionAsync as jest.Mock) = mockGetCurrent;

      const mockWatch = jest.fn().mockResolvedValue({ remove: jest.fn() });
      (Location.watchPositionAsync as jest.Mock) = mockWatch;

      renderHook(() => useCurrentLocation());

      await waitFor(() => {
        expect(mockRequestPermissions).toHaveBeenCalled();
      });
    });

    it('should set error message when permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const { result } = renderHook(() => useCurrentLocation());

      await waitFor(() => {
        expect(result.current.errorMsg).toBe('Permission to access location was denied');
      });
    });

    it('should get current location', async () => {
      const mockLocation = {
        coords: { latitude: 10.2944327, longitude: 123.8812167, heading: 0, speed: 0 },
        timestamp: Date.now(),
      };

      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue(null);
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockLocation);
      (Location.watchPositionAsync as jest.Mock).mockResolvedValue({ remove: jest.fn() });

      const { result } = renderHook(() => useCurrentLocation());

      await waitFor(() => {
        expect(result.current.location).toEqual({
          latitude: 10.2944327,
          longitude: 123.8812167,
          heading: 0,
          speed: 0,
        });
      });
    });
  });

  describe('updateUserLocationOnServer', () => {
    it('should successfully send location to server', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ orderId: 'order123', latitude: 10.0, longitude: 120.0 }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await updateUserLocationOnServer('order123', {
        latitude: 10.0,
        longitude: 120.0,
        heading: 0,
        speed: 0,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders/order123/location/user'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toBeDefined();
    });

    it('should validate latitude range', async () => {
      const result = await updateUserLocationOnServer('order123', {
        latitude: 91.0, // Invalid: > 90
        longitude: 120.0,
      });

      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should validate longitude range', async () => {
      const result = await updateUserLocationOnServer('order123', {
        latitude: 10.0,
        longitude: 181.0, // Invalid: > 180
      });

      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await updateUserLocationOnServer('order123', {
        latitude: 10.0,
        longitude: 120.0,
      });

      expect(result).toBeNull(); // Should not throw
    });

    it('should retry failed requests', async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ orderId: 'order123' }),
        });

      const result = await updateUserLocationOnServer('order123', {
        latitude: 10.0,
        longitude: 120.0,
      });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });
  });

  describe('getUserLocationFromServer', () => {
    it('should fetch user location successfully', async () => {
      const mockLocationData = {
        orderId: 'order123',
        userType: 'user',
        latitude: 10.0,
        longitude: 120.0,
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockLocationData,
      });

      const result = await getUserLocationFromServer('order123');

      expect(result).toEqual(mockLocationData);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders/order123/location/user')
      );
    });

    it('should return null when location not found', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await getUserLocationFromServer('order123');

      expect(result).toBeNull();
    });

    it('should validate received data', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ orderId: 'order123', latitude: 'invalid', longitude: 120.0 }),
      });

      const result = await getUserLocationFromServer('order123');

      expect(result).toBeNull(); // Should reject invalid data
    });
  });

  describe('updateDasherLocationOnServer', () => {
    it('should successfully send dasher location', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ orderId: 'order123', latitude: 10.0, longitude: 120.0 }),
      });

      const result = await updateDasherLocationOnServer('order123', {
        latitude: 10.0,
        longitude: 120.0,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders/order123/location/dasher'),
        expect.any(Object)
      );
      expect(result).toBeDefined();
    });
  });

  describe('getDasherLocationFromServer', () => {
    it('should fetch dasher location successfully', async () => {
      const mockLocationData = {
        orderId: 'order123',
        userType: 'dasher',
        latitude: 10.0,
        longitude: 120.0,
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockLocationData,
      });

      const result = await getDasherLocationFromServer('order123');

      expect(result).toEqual(mockLocationData);
    });
  });
});
