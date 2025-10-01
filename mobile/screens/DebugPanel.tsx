import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Share, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styled } from 'nativewind';
import { crashReporter } from '../utils/crashReporter';
import { API_URL, AUTH_TOKEN_KEY } from '../config';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function DebugPanel() {
  const [crashes, setCrashes] = useState([]);
  const [debugInfo, setDebugInfo] = useState({});
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadDebugData();
    
    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      originalLog(...args);
      setLogs(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] LOG: ${args.join(' ')}`]);
    };
    
    console.error = (...args) => {
      originalError(...args);
      setLogs(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ERROR: ${args.join(' ')}`]);
    };
    
    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  const loadDebugData = async () => {
    try {
      // Get crash reports
      const crashData = await crashReporter.getCrashes();
      setCrashes(crashData);

      // Get debug info
      const info = {
        timestamp: new Date().toISOString(),
        apiUrl: API_URL,
        hasAuthToken: !!(await AsyncStorage.getItem(AUTH_TOKEN_KEY)),
        hasUserData: !!(await AsyncStorage.getItem('userData')),
        dasherStatus: await AsyncStorage.getItem('dasherStatus'),
        storageKeys: await AsyncStorage.getAllKeys(),
      };
      
      setDebugInfo(info);
    } catch (error) {
      console.error('Failed to load debug data:', error);
    }
  };

  const shareDebugInfo = async () => {
    try {
      const debugReport = {
        crashes: crashes.slice(0, 5), // Latest 5 crashes
        debugInfo,
        recentLogs: logs.slice(-10), // Latest 10 logs
      };
      
      await Share.share({
        message: `Campus Eats Debug Report\n\n${JSON.stringify(debugReport, null, 2)}`,
        title: 'Debug Report'
      });
    } catch (error) {
      Alert.alert('Share Failed', error.toString());
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      'Clear Debug Data',
      'This will clear all crashes and reset debug info. Continue?',
      [
        { text: 'Cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            await crashReporter.clearCrashes();
            setLogs([]);
            setCrashes([]);
            loadDebugData();
            Alert.alert('Success', 'Debug data cleared');
          }
        }
      ]
    );
  };

  const testNavigation = () => {
    try {
      console.log('Testing navigation...');
      // This will help identify navigation issues
      Alert.alert('Navigation Test', 'Check console for navigation logs');
    } catch (error) {
      console.error('Navigation test failed:', error);
    }
  };

  const testDeepLink = async () => {
    try {
      console.log('Testing deep link handling...');
      
      // Test if the app can handle its own deep link scheme
      const testUrl = 'campuseats://auth?test=true';
      
      Alert.alert(
        'Deep Link Test',
        `Testing deep link: ${testUrl}\n\nThis will test if the app can handle authentication redirects.`,
        [
          { text: 'Cancel' },
          {
            text: 'Test',
            onPress: async () => {
              try {
                const canOpen = await Linking.canOpenURL(testUrl);
                console.log('Can open deep link:', canOpen);
                
                if (canOpen) {
                  await Linking.openURL(testUrl);
                  console.log('Deep link opened successfully');
                } else {
                  Alert.alert('Deep Link Failed', 'App cannot handle campuseats:// scheme');
                }
              } catch (error) {
                console.error('Deep link test error:', error);
                Alert.alert('Deep Link Error', error.toString());
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Deep link test failed:', error);
    }
  };

  return (
    <StyledView className="flex-1 bg-gray-50 p-4">
      <StyledText className="text-2xl font-bold mb-4 text-center">🐛 Debug Panel</StyledText>
      
      <StyledScrollView className="flex-1">
        {/* Crash Reports Section */}
        <StyledView className="bg-white rounded-lg p-4 mb-4 shadow">
          <StyledText className="text-lg font-semibold mb-2 text-red-600">
            🚨 Crashes ({crashes.length})
          </StyledText>
          {crashes.length === 0 ? (
            <StyledText className="text-gray-500 italic">No crashes reported</StyledText>
          ) : (
            crashes.slice(0, 3).map((crash, index) => (
              <StyledView key={index} className="border-l-4 border-red-500 pl-3 mb-2">
                <StyledText className="text-sm font-medium">{crash.screen}</StyledText>
                <StyledText className="text-xs text-gray-600">{crash.error}</StyledText>
                <StyledText className="text-xs text-gray-400">{crash.timestamp}</StyledText>
              </StyledView>
            ))
          )}
        </StyledView>

        {/* Debug Info Section */}
        <StyledView className="bg-white rounded-lg p-4 mb-4 shadow">
          <StyledText className="text-lg font-semibold mb-2 text-blue-600">
            ℹ️ App State
          </StyledText>
          {Object.entries(debugInfo).map(([key, value]) => (
            <StyledView key={key} className="flex-row justify-between py-1">
              <StyledText className="text-sm font-medium">{key}:</StyledText>
              <StyledText className="text-sm text-gray-600 flex-1 text-right">
                {JSON.stringify(value)}
              </StyledText>
            </StyledView>
          ))}
        </StyledView>

        {/* Recent Logs Section */}
        <StyledView className="bg-white rounded-lg p-4 mb-4 shadow">
          <StyledText className="text-lg font-semibold mb-2 text-green-600">
            📝 Recent Logs ({logs.length})
          </StyledText>
          {logs.length === 0 ? (
            <StyledText className="text-gray-500 italic">No logs captured</StyledText>
          ) : (
            logs.slice(-5).map((log, index) => (
              <StyledText key={index} className="text-xs font-mono mb-1 text-gray-700">
                {log}
              </StyledText>
            ))
          )}
        </StyledView>

        {/* Action Buttons */}
        <StyledView className="gap-3">
          <StyledTouchableOpacity
            className="bg-blue-500 p-4 rounded-lg"
            onPress={loadDebugData}
          >
            <StyledText className="text-white text-center font-semibold">
              🔄 Refresh Debug Data
            </StyledText>
          </StyledTouchableOpacity>

          <StyledTouchableOpacity
            className="bg-green-500 p-4 rounded-lg"
            onPress={shareDebugInfo}
          >
            <StyledText className="text-white text-center font-semibold">
              📤 Share Debug Report
            </StyledText>
          </StyledTouchableOpacity>

          <StyledTouchableOpacity
            className="bg-purple-500 p-4 rounded-lg"
            onPress={testNavigation}
          >
            <StyledText className="text-white text-center font-semibold">
              🧪 Test Navigation
            </StyledText>
          </StyledTouchableOpacity>

          <StyledTouchableOpacity
            className="bg-orange-500 p-4 rounded-lg"
            onPress={testDeepLink}
          >
            <StyledText className="text-white text-center font-semibold">
              🔗 Test Deep Link
            </StyledText>
          </StyledTouchableOpacity>

          <StyledTouchableOpacity
            className="bg-red-500 p-4 rounded-lg"
            onPress={clearAllData}
          >
            <StyledText className="text-white text-center font-semibold">
              🗑️ Clear Debug Data
            </StyledText>
          </StyledTouchableOpacity>
        </StyledView>
      </StyledScrollView>
    </StyledView>
  );
}