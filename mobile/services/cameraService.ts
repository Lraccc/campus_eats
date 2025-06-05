import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

// Camera configuration constants
export const CAMERA_CONFIG = {
  // Default camera IP address and port (can be updated during setup)
  DEFAULT_IP: '192.168.1.45',
  DEFAULT_PORT: '80',  // Changed to 80 as it's the most common default HTTP port
  DEFAULT_USERNAME: 'admin',
  DEFAULT_PASSWORD: 'admin',
  
  // Common ports to try if the default fails
  COMMON_PORTS: ['80', '8080', '8000', '554', '443', '8899', '37777', '37778', '9000'],
  
  // HTTP stream path for V3800 Pro
  HTTP_STREAM_PATH: '/video/mjpg/1',
  
  // Alternative stream paths to try
  ALTERNATIVE_STREAM_PATHS: [
    '/video/mjpg/1',
    '/videostream.cgi',
    '/mjpg/video.mjpg',
    '/cgi-bin/mjpg/video.cgi',
    '/live/ch0',
    '/live',
    '/live/stream',
    '/onvif/media_service',
    '/cam/realmonitor'
  ],
  
  // API endpoints for camera control
  ENDPOINTS: {
    PTZ_CONTROL: '/ptz/control',
    PRESET: '/ptz/preset',
    SETTINGS: '/settings',
    REBOOT: '/system/reboot',
    STATUS: '/system/status',
    SNAPSHOT: '/snapshot.jpg'
  }
};

// Camera connection status
export enum CameraConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

// Camera control commands
export enum PTZCommand {
  PAN_LEFT = 'left',
  PAN_RIGHT = 'right',
  TILT_UP = 'up',
  TILT_DOWN = 'down',
  ZOOM_IN = 'zoom_in',
  ZOOM_OUT = 'zoom_out',
  STOP = 'stop'
}

// Camera service class
class CameraService {
  private cameraIP: string = CAMERA_CONFIG.DEFAULT_IP;
  private cameraPort: string = CAMERA_CONFIG.DEFAULT_PORT;
  private username: string = CAMERA_CONFIG.DEFAULT_USERNAME;
  private password: string = CAMERA_CONFIG.DEFAULT_PASSWORD;
  private connectionStatus: CameraConnectionStatus = CameraConnectionStatus.DISCONNECTED;

  // Get the base URL for camera API
  private getBaseUrl(): string {
    return `http://${this.cameraIP}:${this.cameraPort}`;
  }

  // Working stream path
  private workingStreamPath: string = CAMERA_CONFIG.HTTP_STREAM_PATH;

  // Get the HTTP stream URL
  public getStreamUrl(): string {
    return `${this.getBaseUrl()}${this.workingStreamPath}`;
  }
  
  // Find a working stream URL
  public async findWorkingStreamUrl(): Promise<string | null> {
    // Check connection status
    if (this.connectionStatus !== CameraConnectionStatus.CONNECTED) {
      const status = await this.checkCameraConnection();
      if (status !== CameraConnectionStatus.CONNECTED) {
        return null;
      }
    }
    
    // Try each stream path
    for (const path of CAMERA_CONFIG.ALTERNATIVE_STREAM_PATHS) {
      try {
        console.log(`Trying stream path: ${path}`);
        const streamUrl = `${this.getBaseUrl()}${path}`;
        
        // Try to fetch the stream URL with a short timeout
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(streamUrl, {
          method: 'HEAD',  // Just check if the URL is valid, don't download content
          headers: this.getAuthHeader(),
          signal: controller.signal
        });
        
        clearTimeout(id);
        
        if (response.ok || response.status === 200) {
          console.log(`Found working stream path: ${path}`);
          this.workingStreamPath = path;
          return streamUrl;
        }
      } catch (error: any) {
        console.log(`Stream path ${path} failed: ${error?.message || 'Unknown error'}`);
      }
    }
    
    // If we get here, we couldn't find a working stream URL
    console.log('Could not find a working stream URL');
    return null;
  }
  
  // Get snapshot URL
  public getSnapshotUrl(): string {
    return `${this.getBaseUrl()}${CAMERA_CONFIG.ENDPOINTS.SNAPSHOT}`;
  }

  // Configure camera connection settings
  public configureCamera(ip: string, port: string, username: string, password: string): void {
    this.cameraIP = ip;
    this.cameraPort = port;
    this.username = username;
    this.password = password;
  }
  
  // Get current camera port
  public getCameraPort(): string {
    return this.cameraPort;
  }

  // Get authorization header
  private getAuthHeader(): Headers {
    const headers = new Headers();
    const auth = 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');
    headers.append('Authorization', auth);
    return headers;
  }

  // Check if the camera is on the same network
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

      // First try with the current port
      try {
        console.log(`Trying to connect with IP: ${this.cameraIP}, Port: ${this.cameraPort}`);
        const response = await this.testConnection(this.cameraPort);
        if (response) {
          console.log(`Successfully connected with port: ${this.cameraPort}`);
          this.connectionStatus = CameraConnectionStatus.CONNECTED;
          return this.connectionStatus;
        }
      } catch (err: any) {
        console.log(`Failed to connect with port ${this.cameraPort}: ${err?.message || 'Unknown error'}`);
      }

      // If the current port fails, try common ports
      console.log('Trying alternative ports...');
      for (const port of CAMERA_CONFIG.COMMON_PORTS) {
        if (port === this.cameraPort) continue; // Skip the port we already tried
        
        try {
          console.log(`Trying port: ${port}`);
          const response = await this.testConnection(port);
          if (response) {
            console.log(`Successfully connected with port: ${port}`);
            this.cameraPort = port; // Update the port to the working one
            this.connectionStatus = CameraConnectionStatus.CONNECTED;
            return this.connectionStatus;
          }
        } catch (err: any) {
          console.log(`Failed to connect with port ${port}: ${err?.message || 'Unknown error'}`);
        }
      }

      // If we get here, all connection attempts failed
      console.log('All connection attempts failed');
      this.connectionStatus = CameraConnectionStatus.ERROR;
    } catch (error) {
      console.error('Camera connection error:', error);
      this.connectionStatus = CameraConnectionStatus.ERROR;
    }
    
    return this.connectionStatus;
  }

  // Test connection to camera with a specific port
  private async testConnection(port: string): Promise<boolean> {
    try {
      const timeout = 3000; // 3 seconds timeout
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      const baseUrl = `http://${this.cameraIP}:${port}`;
      const response = await fetch(`${baseUrl}${CAMERA_CONFIG.ENDPOINTS.STATUS}`, {
        method: 'GET',
        headers: this.getAuthHeader(),
        signal: controller.signal
      });

      clearTimeout(id);
      return response.ok;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Connection timed out');
      }
      throw error;
    }
  }

  // Take a snapshot and save it
  public async takeSnapshot(): Promise<string | null> {
    try {
      if (this.connectionStatus !== CameraConnectionStatus.CONNECTED) {
        await this.checkCameraConnection();
        if (this.connectionStatus === CameraConnectionStatus.DISCONNECTED || 
            this.connectionStatus === CameraConnectionStatus.CONNECTING || 
            this.connectionStatus === CameraConnectionStatus.ERROR) {
          return null;
        }
      }

      const snapshotUrl = this.getSnapshotUrl();
      const timestamp = new Date().getTime();
      const fileName = `v3800_snapshot_${timestamp}.jpg`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      // Download the snapshot
      const downloadResult = await FileSystem.downloadAsync(
        snapshotUrl,
        fileUri,
        {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
          }
        }
      );
      
      if (downloadResult.status === 200) {
        return fileUri;
      }
      return null;
    } catch (error) {
      console.error('Snapshot error:', error);
      return null;
    }
  }

  // Send PTZ command to the camera
  public async sendPTZCommand(command: PTZCommand, speed: number = 5): Promise<boolean> {
    try {
      if (this.connectionStatus !== CameraConnectionStatus.CONNECTED) {
        await this.checkCameraConnection();
        if (this.connectionStatus === CameraConnectionStatus.DISCONNECTED || 
            this.connectionStatus === CameraConnectionStatus.CONNECTING || 
            this.connectionStatus === CameraConnectionStatus.ERROR) {
          return false;
        }
      }

      const response = await fetch(`${this.getBaseUrl()}${CAMERA_CONFIG.ENDPOINTS.PTZ_CONTROL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
        },
        body: JSON.stringify({
          command,
          speed
        })
      });

      return response.ok;
    } catch (error) {
      console.error('PTZ command error:', error);
      return false;
    }
  }

  // Set a preset position
  public async setPreset(presetName: string, presetNumber: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}${CAMERA_CONFIG.ENDPOINTS.PRESET}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
        },
        body: JSON.stringify({
          action: 'set',
          name: presetName,
          number: presetNumber
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Set preset error:', error);
      return false;
    }
  }

  // Go to a preset position
  public async goToPreset(presetNumber: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}${CAMERA_CONFIG.ENDPOINTS.PRESET}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
        },
        body: JSON.stringify({
          action: 'goto',
          number: presetNumber
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Go to preset error:', error);
      return false;
    }
  }

  // Reboot the camera
  public async rebootCamera(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}${CAMERA_CONFIG.ENDPOINTS.REBOOT}`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Reboot camera error:', error);
      return false;
    }
  }

  // Update camera settings
  public async updateSettings(settings: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}${CAMERA_CONFIG.ENDPOINTS.SETTINGS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
        },
        body: JSON.stringify(settings)
      });

      return response.ok;
    } catch (error) {
      console.error('Update settings error:', error);
      return false;
    }
  }

  // Get current connection status
  public getConnectionStatus(): CameraConnectionStatus {
    return this.connectionStatus;
  }
}

// Export a singleton instance
export const cameraService = new CameraService();
