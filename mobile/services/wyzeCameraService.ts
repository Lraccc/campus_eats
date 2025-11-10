/**
 * Wyze Camera Service
 * Handles Wyze Cam v3 integration for Campus Eats
 * 
 * Wyze Cam v3 Setup Guide:
 * 1. Download Wyze app and setup your camera
 * 2. Enable RTSP in camera settings (Settings > Advanced Settings > Enable RTSP)
 * 3. Set RTSP credentials (username/password)
 * 4. Get your camera's local IP address from router
 * 5. Use the generated RTSP URL in this app
 */

import axios from 'axios';
import { API_URL } from '../config';

export interface WyzeCameraConfig {
  cameraId: string;
  cameraName: string;
  username: string;
  password: string;
  ipAddress: string;
  port?: number; // Default 8554 for RTSP
  streamPath?: string; // Default /live
}

export interface StreamUrl {
  rtspUrl: string;
  hlsUrl?: string; // If backend converts RTSP to HLS
  type: 'rtsp' | 'hls' | 'http';
}

/**
 * Generate RTSP URL for Wyze Cam v3
 * Format: rtsp://username:password@ip:port/live
 */
export const generateWyzeRTSPUrl = (config: WyzeCameraConfig): string => {
  const port = config.port || 8554;
  const path = config.streamPath || '/live';
  
  return `rtsp://${config.username}:${config.password}@${config.ipAddress}:${port}${path}`;
};

/**
 * Validate RTSP URL format
 */
export const isValidRTSPUrl = (url: string): boolean => {
  const rtspPattern = /^rtsp:\/\/.+:.+@.+:\d+\/.+$/;
  return rtspPattern.test(url);
};

/**
 * Validate HLS URL format
 */
export const isValidHLSUrl = (url: string): boolean => {
  return url.endsWith('.m3u8') || url.includes('.m3u8?');
};

/**
 * Save Wyze camera configuration to backend
 */
export const saveWyzeCameraConfig = async (
  shopId: string,
  config: WyzeCameraConfig,
  token: string
): Promise<boolean> => {
  try {
    const rtspUrl = generateWyzeRTSPUrl(config);
    
    console.log('Saving Wyze camera config for shop:', shopId);
    
    const response = await axios.post(
      `${API_URL}/api/shops/${shopId}/stream-url`,
      {
        streamUrl: rtspUrl,
        cameraType: 'wyze-v3',
        cameraName: config.cameraName,
        streamType: 'rtsp'
      },
      {
        headers: { Authorization: token }
      }
    );
    
    console.log('Wyze camera config saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving Wyze camera config:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response:', error.response?.data);
    }
    throw error;
  }
};

/**
 * Get stream URL from backend
 * Backend may convert RTSP to HLS for better mobile compatibility
 */
export const getStreamUrl = async (
  shopId: string,
  token: string
): Promise<StreamUrl | null> => {
  try {
    const response = await axios.get(
      `${API_URL}/api/shops/${shopId}/stream-url`,
      {
        headers: { Authorization: token }
      }
    );
    
    if (response.data && response.data.streamUrl) {
      const url = response.data.streamUrl;
      
      // Determine stream type
      let type: 'rtsp' | 'hls' | 'http' = 'http';
      if (url.startsWith('rtsp://')) {
        type = 'rtsp';
      } else if (isValidHLSUrl(url)) {
        type = 'hls';
      }
      
      return {
        rtspUrl: url,
        hlsUrl: response.data.hlsUrl, // Backend may provide HLS conversion
        type
      };
    }
    
    return null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.log('No stream configured for shop:', shopId);
      return null;
    }
    console.error('Error fetching stream URL:', error);
    throw error;
  }
};

/**
 * Test RTSP connection (basic check)
 * Note: Full RTSP testing requires native implementation or backend proxy
 */
export const testRTSPConnection = async (rtspUrl: string): Promise<boolean> => {
  try {
    // In production, this should call your backend to test the RTSP stream
    // Backend can use FFmpeg or similar to verify stream is accessible
    
    if (!isValidRTSPUrl(rtspUrl)) {
      throw new Error('Invalid RTSP URL format');
    }
    
    // For now, just validate format
    console.log('RTSP URL format is valid:', rtspUrl);
    return true;
  } catch (error) {
    console.error('RTSP connection test failed:', error);
    return false;
  }
};

/**
 * Common Wyze Cam v3 RTSP configurations
 */
export const WYZE_DEFAULTS = {
  port: 8554,
  streamPath: '/live',
  defaultUsername: 'admin', // Users should change this
  // Common resolutions
  resolutions: {
    HD: '1920x1080',
    SD: '640x360'
  }
};

/**
 * Helper to extract credentials from RTSP URL
 */
export const parseRTSPUrl = (rtspUrl: string): Partial<WyzeCameraConfig> | null => {
  try {
    const pattern = /rtsp:\/\/([^:]+):([^@]+)@([^:]+):(\d+)(\/.*)/;
    const match = rtspUrl.match(pattern);
    
    if (match) {
      return {
        username: match[1],
        password: match[2],
        ipAddress: match[3],
        port: parseInt(match[4]),
        streamPath: match[5]
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing RTSP URL:', error);
    return null;
  }
};
