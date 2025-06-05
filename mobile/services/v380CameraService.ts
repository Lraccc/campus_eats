import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { CameraConnectionStatus } from './cameraService';
import axios from 'axios';

// V380 Pro camera configuration
export const V380_CONFIG = {
  // Default camera settings
  DEFAULT_USERNAME: 'admin',
  DEFAULT_PASSWORD: 'admin',
  
  // RTSP port is typically 554
  RTSP_PORT: '554',
  
  // Common RTSP paths for V380 cameras
  RTSP_PATHS: [
    '/live/ch0',
    '/live/ch00_0',
    '/live',
    '/onvif1',
    '/cam/realmonitor',
    '/h264Preview_01_main',
    '/stream1',
    '/ch0_0.h264',
    '/live/main'
  ],
  
  // QR code prefix for V380 cameras
  QR_PREFIX: 'V380',
  
  // V380 web portal URLs
  WEB_PORTAL_URL: 'https://www.linkv380.com/',
  WEB_PORTAL_DIRECT: 'https://www.linkv380.com/wap/live/index',
  
  // V380 API endpoints
  API_BASE_URL: 'https://api.linkv380.com',
  LOGIN_ENDPOINT: '/api/v1/user/login',
  DEVICE_LIST_ENDPOINT: '/api/v1/device/list'
};

// V380 Camera service class
class V380CameraService {
  private cameraIP: string = '';
  private username: string = V380_CONFIG.DEFAULT_USERNAME;
  private password: string = V380_CONFIG.DEFAULT_PASSWORD;
  private deviceId: string = '';
  private connectionStatus: CameraConnectionStatus = CameraConnectionStatus.DISCONNECTED;
  private workingRtspPath: string = V380_CONFIG.RTSP_PATHS[0];
  
  // V380 web portal credentials
  private v380Username: string = '';
  private v380Password: string = '';
  private v380Token: string = '';
  private v380DeviceList: any[] = [];

  // Parse V380 QR code
  public parseQRCode(qrData: string): boolean {
    try {
      // Check if this is a V380 QR code
      if (!qrData.startsWith(V380_CONFIG.QR_PREFIX)) {
        console.log('Not a V380 QR code');
        return false;
      }
      
      // Format: V380^deviceId^model^...
      const parts = qrData.split('^');
      if (parts.length < 2) {
        console.log('Invalid QR code format');
        return false;
      }
      
      // Extract device ID
      this.deviceId = parts[1];
      console.log(`Parsed V380 device ID: ${this.deviceId}`);
      return true;
    } catch (error) {
      console.error('Error parsing QR code:', error);
      return false;
    }
  }
  
  // Configure camera connection settings
  public configureCamera(ip: string, username: string, password: string): void {
    this.cameraIP = ip;
    this.username = username;
    this.password = password;
  }
  
  // Configure V380 web portal credentials
  public configureV380Account(username: string, password: string): void {
    this.v380Username = username;
    this.v380Password = password;
  }
  
  // Login to V380 web portal
  public async loginToV380Portal(): Promise<boolean> {
    try {
      console.log('Attempting to login to V380 web portal...');
      
      if (!this.v380Username || !this.v380Password) {
        console.log('V380 credentials not provided');
        return false;
      }
      
      const response = await axios.post(
        `${V380_CONFIG.API_BASE_URL}${V380_CONFIG.LOGIN_ENDPOINT}`,
        {
          username: this.v380Username,
          password: this.v380Password
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.token) {
        this.v380Token = response.data.token;
        console.log('Successfully logged in to V380 portal');
        return true;
      } else {
        console.log('Failed to login to V380 portal: No token received');
        return false;
      }
    } catch (error: any) {
      console.error('V380 login error:', error?.response?.data || error?.message || error);
      return false;
    }
  }
  
  // Get device list from V380 portal
  public async getV380DeviceList(): Promise<any[]> {
    try {
      if (!this.v380Token) {
        const loggedIn = await this.loginToV380Portal();
        if (!loggedIn) {
          console.log('Not logged in to V380 portal');
          return [];
        }
      }
      
      const response = await axios.get(
        `${V380_CONFIG.API_BASE_URL}${V380_CONFIG.DEVICE_LIST_ENDPOINT}`,
        {
          headers: {
            'Authorization': `Bearer ${this.v380Token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.devices) {
        this.v380DeviceList = response.data.devices;
        console.log(`Found ${this.v380DeviceList.length} V380 devices`);
        return this.v380DeviceList;
      } else {
        console.log('No devices found in V380 account');
        return [];
      }
    } catch (error: any) {
      console.error('Error getting V380 device list:', error?.response?.data || error?.message || error);
      return [];
    }
  }
  
  // Get web portal URL with embedded auth
  public getWebPortalUrl(): string {
    // For direct embedding, we'll use the web portal URL
    // In a real implementation, we would include auth tokens
    return V380_CONFIG.WEB_PORTAL_URL;
  }
  
  // Get direct live view URL
  public getDirectLiveViewUrl(): string {
    return V380_CONFIG.WEB_PORTAL_DIRECT;
  }
  
  // Get RTSP URL for streaming
  public getRtspUrl(): string {
    return `rtsp://${this.username}:${this.password}@${this.cameraIP}:${V380_CONFIG.RTSP_PORT}${this.workingRtspPath}`;
  }
  
  // Get HTTP URL for WebView streaming (if RTSP is not supported)
  public getHttpStreamUrl(): string {
    return `http://${this.cameraIP}/videostream.cgi?user=${this.username}&pwd=${this.password}`;
  }
  
  // Check camera connection
  public async checkCameraConnection(): Promise<CameraConnectionStatus> {
    try {
      this.connectionStatus = CameraConnectionStatus.CONNECTING;
      
      // Check network connectivity first
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        this.connectionStatus = CameraConnectionStatus.DISCONNECTED;
        console.log('Network not connected');
        return this.connectionStatus;
      }
      
      // If we don't have an IP address, we can't connect directly
      if (!this.cameraIP) {
        console.log('No camera IP provided');
        this.connectionStatus = CameraConnectionStatus.ERROR;
        return this.connectionStatus;
      }
      
      // Try to ping the camera
      const pingResult = await this.pingCamera();
      if (pingResult) {
        this.connectionStatus = CameraConnectionStatus.CONNECTED;
      } else {
        this.connectionStatus = CameraConnectionStatus.ERROR;
      }
      
      return this.connectionStatus;
    } catch (error: any) {
      console.error('Camera connection error:', error);
      this.connectionStatus = CameraConnectionStatus.ERROR;
      return this.connectionStatus;
    }
  }
  
  // Simple ping to check if camera is reachable
  private async pingCamera(): Promise<boolean> {
    try {
      const timeout = 5000;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      
      // Try a simple HTTP request to the camera
      const response = await fetch(`http://${this.cameraIP}`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(id);
      return response.status < 400; // Any response is good enough to confirm the camera exists
    } catch (error: any) {
      console.log(`Ping failed: ${error?.message || 'Unknown error'}`);
      return false;
    }
  }
  
  // Find working RTSP path
  public async findWorkingRtspPath(): Promise<string | null> {
    // This would require actual RTSP testing which is complex in React Native
    // For now, we'll just return the default path
    console.log('Using default RTSP path:', this.workingRtspPath);
    return this.getRtspUrl();
  }
  
  // Get device ID from QR code
  public getDeviceId(): string {
    return this.deviceId;
  }
}

export const v380CameraService = new V380CameraService();
export default v380CameraService;
