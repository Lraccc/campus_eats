import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

interface CrashReport {
  timestamp: string;
  error: string;
  stack?: string;
  screen?: string;
  userAgent?: string;
  additionalInfo?: any;
}

class CrashReporter {
  private static instance: CrashReporter;
  private crashes: CrashReport[] = [];
  private readonly MAX_CRASHES = 50;
  private readonly STORAGE_KEY = '@CampusEats:CrashReports';

  static getInstance(): CrashReporter {
    if (!CrashReporter.instance) {
      CrashReporter.instance = new CrashReporter();
    }
    return CrashReporter.instance;
  }

  async init() {
    // Load existing crash reports
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.crashes = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load crash reports:', error);
    }

    // Set up global error handlers
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    // Catch unhandled JavaScript errors
    const originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      this.reportCrash({
        error: error.message || error.toString(),
        stack: error.stack,
        screen: 'Unknown',
        additionalInfo: { isFatal }
      });

      // Call original handler
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    });

    // Catch unhandled promise rejections
    const originalRejectionHandler = require('react-native/Libraries/Core/ExceptionsManager').default.handleException;
    require('react-native/Libraries/Core/ExceptionsManager').default.handleException = (error: any, isFatal: boolean) => {
      this.reportCrash({
        error: error.message || error.toString(),
        stack: error.stack,
        screen: 'Promise Rejection',
        additionalInfo: { isFatal, type: 'unhandledRejection' }
      });

      originalRejectionHandler(error, isFatal);
    };
  }

  async reportCrash(crash: Omit<CrashReport, 'timestamp'>) {
    const crashReport: CrashReport = {
      ...crash,
      timestamp: new Date().toISOString(),
      userAgent: 'React Native Production'
    };

    console.error('🚨 CRASH REPORTED:', crashReport);

    // Add to crashes array
    this.crashes.unshift(crashReport);
    
    // Keep only the latest crashes
    if (this.crashes.length > this.MAX_CRASHES) {
      this.crashes = this.crashes.slice(0, this.MAX_CRASHES);
    }

    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.crashes));
    } catch (error) {
      console.error('Failed to save crash report:', error);
    }

    // Show alert in development or if debug mode is enabled
    if (__DEV__ || crash.additionalInfo?.showAlert) {
      Alert.alert(
        'App Error Detected',
        `Error: ${crash.error}\n\nScreen: ${crash.screen}`,
        [
          { text: 'Dismiss' },
          { 
            text: 'View Details', 
            onPress: () => this.showCrashDetails(crashReport)
          }
        ]
      );
    }
  }

  private showCrashDetails(crash: CrashReport) {
    Alert.alert(
      'Crash Details',
      `Time: ${crash.timestamp}\nError: ${crash.error}\nStack: ${crash.stack?.substring(0, 200)}...`,
      [{ text: 'OK' }]
    );
  }

  async getCrashes(): Promise<CrashReport[]> {
    return this.crashes;
  }

  async clearCrashes() {
    this.crashes = [];
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear crash reports:', error);
    }
  }

  // Manual crash reporting for component errors
  reportComponentError(error: Error, componentName: string, additionalInfo?: any) {
    this.reportCrash({
      error: error.message || error.toString(),
      stack: error.stack,
      screen: componentName,
      additionalInfo: { ...additionalInfo, type: 'componentError' }
    });
  }

  // Navigation error reporting
  reportNavigationError(error: Error, fromScreen: string, toScreen: string) {
    this.reportCrash({
      error: error.message || error.toString(),
      stack: error.stack,
      screen: `Navigation: ${fromScreen} -> ${toScreen}`,
      additionalInfo: { type: 'navigationError', fromScreen, toScreen }
    });
  }
}

export const crashReporter = CrashReporter.getInstance();
export default CrashReporter;