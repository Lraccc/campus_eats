import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get config from app.config.js extra field (injected at build time from GitHub Secrets)
const extra = Constants.expoConfig?.extra || {};
const IS_PRODUCTION = Constants.executionEnvironment === 'standalone';
const API_URL = extra.apiUrl || 'http://localhost:8080';

interface RemoteLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRASH';
  message: string;
  screen?: string;
  userId?: string;
  deviceInfo?: any;
  stackTrace?: string;
  additionalData?: any;
}

class RemoteLogger {
  private static instance: RemoteLogger;
  private pendingLogs: RemoteLogEntry[] = [];
  private readonly MAX_PENDING = 100;
  private readonly BATCH_SIZE = 10;
  private readonly STORAGE_KEY = '@CampusEats:PendingLogs';
  private uploadTimer: NodeJS.Timeout | null = null;

  static getInstance(): RemoteLogger {
    if (!RemoteLogger.instance) {
      RemoteLogger.instance = new RemoteLogger();
    }
    return RemoteLogger.instance;
  }

  async init() {
    // Load pending logs
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.pendingLogs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load pending logs:', error);
    }

    // Start upload timer
    this.startUploadTimer();
  }

  private startUploadTimer() {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
    }
    
    // Upload logs every 30 seconds in production
    if (IS_PRODUCTION) {
      this.uploadTimer = setInterval(() => {
        this.uploadPendingLogs();
      }, 30000);
    }
  }

  async logInfo(message: string, screen?: string, additionalData?: any) {
    await this.addLog('INFO', message, screen, additionalData);
  }

  async logWarning(message: string, screen?: string, additionalData?: any) {
    await this.addLog('WARN', message, screen, additionalData);
  }

  async logError(message: string, screen?: string, error?: Error, additionalData?: any) {
    await this.addLog('ERROR', message, screen, {
      ...additionalData,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : undefined
    }, error?.stack);
  }

  async logCrash(message: string, screen?: string, error?: Error, additionalData?: any) {
    await this.addLog('CRASH', message, screen, {
      ...additionalData,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : undefined
    }, error?.stack);
    
    // Immediately try to upload crash logs
    this.uploadPendingLogs();
  }

  private async addLog(
    level: RemoteLogEntry['level'], 
    message: string, 
    screen?: string, 
    additionalData?: any,
    stackTrace?: string
  ) {
    const logEntry: RemoteLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      screen,
      stackTrace,
      additionalData,
      deviceInfo: {
        platform: 'React Native',
        environment: IS_PRODUCTION ? 'production' : 'development',
        apiUrl: API_URL
      }
    };

    // Get user ID if available
    try {
      const userData = await AsyncStorage.getItem('@CampusEats:UserData');
      if (userData) {
        const user = JSON.parse(userData);
        logEntry.userId = user.id || user.email || 'unknown';
      }
    } catch (error) {
      // Ignore user data errors
    }

    this.pendingLogs.push(logEntry);
    
    // Keep only the last MAX_PENDING logs
    if (this.pendingLogs.length > this.MAX_PENDING) {
      this.pendingLogs = this.pendingLogs.slice(-this.MAX_PENDING);
    }

    // Save to storage
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.pendingLogs));
    } catch (error) {
      console.error('Failed to save pending logs:', error);
    }

    // Log locally too
    console.log(`[${level}] ${message}`, additionalData);
  }

  private async uploadPendingLogs() {
    if (this.pendingLogs.length === 0) {
      return;
    }

    const logsToUpload = this.pendingLogs.splice(0, this.BATCH_SIZE);
    
    try {
      const response = await fetch(`${API_URL}/api/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CampusEats-Mobile/1.0.0'
        },
        body: JSON.stringify({
          logs: logsToUpload,
          appVersion: '1.0.0',
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log(`📡 Uploaded ${logsToUpload.length} logs successfully`);
        
        // Update storage with remaining logs
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.pendingLogs));
      } else {
        // Upload failed, put logs back
        this.pendingLogs.unshift(...logsToUpload);
        console.warn('Failed to upload logs:', response.status, response.statusText);
      }
    } catch (error) {
      // Upload failed, put logs back
      this.pendingLogs.unshift(...logsToUpload);
      console.warn('Log upload error:', error);
    }
  }

  async getPendingLogs(): Promise<RemoteLogEntry[]> {
    return [...this.pendingLogs];
  }

  async clearPendingLogs() {
    this.pendingLogs = [];
    await AsyncStorage.removeItem(this.STORAGE_KEY);
  }

  async forceUpload() {
    console.log('🚀 Force uploading all pending logs...');
    while (this.pendingLogs.length > 0) {
      await this.uploadPendingLogs();
      // Wait a bit between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Manual log export for debugging
  async exportLogs(): Promise<string> {
    const logs = await this.getPendingLogs();
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logs
    }, null, 2);
  }
}

export const remoteLogger = RemoteLogger.getInstance();