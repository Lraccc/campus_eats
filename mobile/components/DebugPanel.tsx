import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  Alert,
  Share,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { crashReporter } from '../utils/crashReporter';
import { productionLogger } from '../utils/productionLogger';
import { PersistenceTest } from '../utils/persistenceTest';
import { IS_PRODUCTION, API_URL, NODE_ENV } from '../config';

interface DebugInfo {
  crashes: any[];
  logs: string[];
  deviceInfo: any;
  appInfo: any;
}

export function DebugPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    crashes: [],
    logs: [],
    deviceInfo: {},
    appInfo: {}
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadDebugInfo();
    }
  }, [visible]);

  const loadDebugInfo = async () => {
    setLoading(true);
    try {
      // Get crash reports
      const crashes = await crashReporter.getCrashes();
      
      // Get console logs from production logger
      const logs = productionLogger.getLogs();
      
      // Get device/app info
      const deviceInfo = {
        platform: 'React Native',
        isProduction: IS_PRODUCTION,
        nodeEnv: NODE_ENV,
        apiUrl: API_URL,
        timestamp: new Date().toISOString()
      };

      setDebugInfo({
        crashes,
        logs,
        deviceInfo,
        appInfo: {
          version: '1.0.0',
          buildTime: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to load debug info:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportDebugData = async () => {
    try {
      const debugData = {
        timestamp: new Date().toISOString(),
        crashes: debugInfo.crashes,
        logs: debugInfo.logs.slice(-50), // Last 50 logs
        deviceInfo: debugInfo.deviceInfo,
        appInfo: debugInfo.appInfo
      };

      const debugString = JSON.stringify(debugData, null, 2);
      
      await Share.share({
        message: debugString,
        title: 'Campus Eats Debug Report'
      });
    } catch (error) {
      Alert.alert('Export Failed', error.message);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      'Clear Debug Data',
      'This will clear all crash reports and logs. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await crashReporter.clearCrashes();
            await productionLogger.clearLogs();
            await loadDebugInfo();
          }
        }
      ]
    );
  };

  const testCrash = () => {
    crashReporter.reportCrash({
      error: 'Test crash from debug panel',
      stack: 'Debug Panel Test',
      screen: 'DebugPanel',
      additionalInfo: { test: true, timestamp: Date.now() }
    });
    loadDebugInfo();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <View style={{ flex: 1, backgroundColor: '#000', padding: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
            🐛 Debug Panel
          </Text>
          <TouchableOpacity 
            onPress={onClose}
            style={{ backgroundColor: '#333', padding: 10, borderRadius: 5 }}
          >
            <Text style={{ color: '#fff' }}>Close</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={{ color: '#fff', textAlign: 'center' }}>Loading debug info...</Text>
        ) : (
          <ScrollView style={{ flex: 1 }}>
            {/* App Info */}
            <View style={{ backgroundColor: '#111', padding: 15, borderRadius: 8, marginBottom: 15 }}>
              <Text style={{ color: '#0f0', fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
                📱 App Info
              </Text>
              <Text style={{ color: '#fff', fontFamily: 'monospace' }}>
                Environment: {debugInfo.deviceInfo.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}
              </Text>
              <Text style={{ color: '#fff', fontFamily: 'monospace' }}>
                API URL: {debugInfo.deviceInfo.apiUrl}
              </Text>
              <Text style={{ color: '#fff', fontFamily: 'monospace' }}>
                Node ENV: {debugInfo.deviceInfo.nodeEnv}
              </Text>
              <Text style={{ color: '#fff', fontFamily: 'monospace' }}>
                Version: {debugInfo.appInfo.version}
              </Text>
            </View>

            {/* Crash Reports */}
            <View style={{ backgroundColor: '#111', padding: 15, borderRadius: 8, marginBottom: 15 }}>
              <Text style={{ color: '#f00', fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
                💥 Crash Reports ({debugInfo.crashes.length})
              </Text>
              {debugInfo.crashes.length === 0 ? (
                <Text style={{ color: '#888' }}>No crashes reported</Text>
              ) : (
                debugInfo.crashes.slice(-5).map((crash, index) => (
                  <View key={index} style={{ backgroundColor: '#222', padding: 10, borderRadius: 5, marginBottom: 10 }}>
                    <Text style={{ color: '#f00', fontWeight: 'bold' }}>
                      {crash.timestamp}
                    </Text>
                    <Text style={{ color: '#fff', marginTop: 5 }}>
                      Screen: {crash.screen || 'Unknown'}
                    </Text>
                    <Text style={{ color: '#fff', marginTop: 5 }}>
                      Error: {crash.error}
                    </Text>
                    {crash.additionalInfo && (
                      <Text style={{ color: '#888', marginTop: 5, fontSize: 12 }}>
                        Info: {JSON.stringify(crash.additionalInfo)}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* Console Logs */}
            <View style={{ backgroundColor: '#111', padding: 15, borderRadius: 8, marginBottom: 15 }}>
              <Text style={{ color: '#00f', fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
                📝 Console Logs ({debugInfo.logs.length})
              </Text>
              {debugInfo.logs.length === 0 ? (
                <Text style={{ color: '#888' }}>No logs captured</Text>
              ) : (
                debugInfo.logs.slice(-10).map((log, index) => (
                  <Text key={index} style={{ color: '#ccc', fontSize: 12, fontFamily: 'monospace', marginBottom: 2 }}>
                    {log}
                  </Text>
                ))
              )}
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
              <TouchableOpacity 
                onPress={exportDebugData}
                style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8, flex: 1, minWidth: 120 }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                  📤 Export Data
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={loadDebugInfo}
                style={{ backgroundColor: '#34C759', padding: 12, borderRadius: 8, flex: 1, minWidth: 120 }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                  🔄 Refresh
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={testCrash}
                style={{ backgroundColor: '#FF9500', padding: 12, borderRadius: 8, flex: 1, minWidth: 120 }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                  🧪 Test Crash
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={async () => {
                  await PersistenceTest.testLogPersistence();
                  Alert.alert('Persistence Test', 'Test data saved! Restart the app and check debug panel to verify persistence.');
                }}
                style={{ backgroundColor: '#5856D6', padding: 12, borderRadius: 8, flex: 1, minWidth: 120 }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                  🧪 Test Persist
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={clearAllData}
                style={{ backgroundColor: '#FF3B30', padding: 12, borderRadius: 8, flex: 1, minWidth: 120 }}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                  🗑️ Clear All
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}