import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '../config';
import * as FileSystem from 'expo-file-system';

// Camera configuration constants
export const CAMERA_CONFIG = {
  // Default camera IP address and port (can be updated during setup)
  DEFAULT_IP: '192.168.1.100',
  DEFAULT_PORT: '8080',
  DEFAULT_USERNAME: 'admin',
  DEFAULT_PASSWORD: 'admin',
  
  // HTTP stream path for V3800 Pro
  HTTP_STREAM_PATH: '/video/mjpg/1',
  
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

  // Get the HTTP stream URL
  public getStreamUrl(): string {
    return `${this.getBaseUrl()}${CAMERA_CONFIG.HTTP_STREAM_PATH}`;
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
        return this.connectionStatus;
      }

      // Try to connect to camera status endpoint
      const response = await fetch(`${this.getBaseUrl()}${CAMERA_CONFIG.ENDPOINTS.STATUS}`, {
        method: 'GET',
        headers: this.getAuthHeader()
      });

      if (response.ok) {
        this.connectionStatus = CameraConnectionStatus.CONNECTED;
      } else {
        this.connectionStatus = CameraConnectionStatus.ERROR;
      }
    } catch (error) {
      console.error('Camera connection error:', error);
      this.connectionStatus = CameraConnectionStatus.ERROR;
    }
    
    return this.connectionStatus;
  }

  // Take a snapshot and save it
  public async takeSnapshot(): Promise<string | null> {
    try {
      if (this.connectionStatus !== CameraConnectionStatus.CONNECTED) {
        await this.checkCameraConnection();
        if (this.connectionStatus !== CameraConnectionStatus.CONNECTED) {
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
        if (this.connectionStatus !== CameraConnectionStatus.CONNECTED) {
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
