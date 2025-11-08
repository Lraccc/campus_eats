import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Determine if we're in production based on execution environment
const IS_PRODUCTION = Constants.executionEnvironment === 'standalone';

class ProductionLogger {
  private static instance: ProductionLogger;
  private logs: string[] = [];
  private readonly MAX_LOGS = 200;
  private readonly STORAGE_KEY = '@CampusEats:ConsoleLogs';

  static getInstance(): ProductionLogger {
    if (!ProductionLogger.instance) {
      ProductionLogger.instance = new ProductionLogger();
    }
    return ProductionLogger.instance;
  }

  async init() {
    // Load existing logs
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load stored logs:', error);
    }

    // Override console methods in production
    if (IS_PRODUCTION) {
      this.overrideConsoleMethods();
    }
  }

  private overrideConsoleMethods() {
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    console.log = (...args) => {
      this.addLog('LOG', args);
      originalConsole.log(...args);
    };

    console.error = (...args) => {
      this.addLog('ERROR', args);
      originalConsole.error(...args);
    };

    console.warn = (...args) => {
      this.addLog('WARN', args);
      originalConsole.warn(...args);
    };

    console.info = (...args) => {
      this.addLog('INFO', args);
      originalConsole.info(...args);
    };
  }

  private addLog(level: string, args: any[]) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    const logEntry = `[${timestamp}] ${level}: ${message}`;
    
    this.logs.push(logEntry);
    
    // Keep only the last MAX_LOGS entries
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }

    // Save to storage (debounced)
    this.debouncedSave();
  }

  private saveTimeout: NodeJS.Timeout | null = null;
  private debouncedSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.logs));
      } catch (error) {
        console.error('Failed to save logs:', error);
      }
    }, 1000);
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  async clearLogs() {
    this.logs = [];
    await AsyncStorage.removeItem(this.STORAGE_KEY);
  }

  // Add specific navigation logging
  logNavigation(action: string, path: string, success: boolean, error?: any) {
    const logData = {
      action,
      path,
      success,
      timestamp: new Date().toISOString(),
      error: error ? (error.message || error.toString()) : undefined
    };
    
    this.addLog('NAVIGATION', [JSON.stringify(logData)]);
  }

  // Add component lifecycle logging
  logComponent(component: string, lifecycle: string, props?: any) {
    const logData = {
      component,
      lifecycle,
      props: props ? Object.keys(props) : undefined,
      timestamp: new Date().toISOString()
    };
    
    this.addLog('COMPONENT', [JSON.stringify(logData)]);
  }

  // Add API call logging
  logApiCall(url: string, method: string, status?: number, error?: any) {
    const logData = {
      url,
      method,
      status,
      success: !error && status && status < 400,
      error: error ? (error.message || error.toString()) : undefined,
      timestamp: new Date().toISOString()
    };
    
    this.addLog('API', [JSON.stringify(logData)]);
  }
}

export const productionLogger = ProductionLogger.getInstance();