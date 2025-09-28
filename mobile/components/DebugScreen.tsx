import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styled } from 'nativewind';
import { API_URL, AUTH_TOKEN_KEY } from '../config';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface DebugInfo {
  [key: string]: any;
}

export default function DebugScreen() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    collectDebugInfo();
    
    // Override console to capture logs
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      originalLog(...args);
      setLogs(prev => [...prev.slice(-49), `[LOG] ${args.join(' ')}`]);
    };
    
    console.error = (...args) => {
      originalError(...args);
      setLogs(prev => [...prev.slice(-49), `[ERROR] ${args.join(' ')}`]);
    };
    
    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  const collectDebugInfo = async () => {
    try {
      const info: DebugInfo = {
        timestamp: new Date().toISOString(),
        apiUrl: API_URL,
        nodeEnv: process.env.NODE_ENV || 'unknown',
      };

      // Get AsyncStorage data
      try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        info.hasToken = !!token;
        info.tokenLength = token?.length || 0;
        
        const userData = await AsyncStorage.getItem('userData');
        info.hasUserData = !!userData;
        
        const dasherStatus = await AsyncStorage.getItem('dasherStatus');
        info.dasherStatus = dasherStatus;
        
        // Get all AsyncStorage keys
        const allKeys = await AsyncStorage.getAllKeys();
        info.asyncStorageKeys = allKeys;
        
      } catch (storageError) {
        info.storageError = storageError.toString();
      }

      // Get device info
      info.platform = 'React Native';
      info.userAgent = navigator?.userAgent || 'unknown';
      
      setDebugInfo(info);
    } catch (error) {
      console.error('Failed to collect debug info:', error);
    }
  };

  const clearAsyncStorage = async () => {
    Alert.alert(
      'Clear Storage',
      'This will clear all app data. Continue?',
      [
        { text: 'Cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Success', 'Storage cleared');
              collectDebugInfo();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear storage');
            }
          }
        }
      ]
    );
  };

  const testApiConnection = async () => {
    try {
      const response = await fetch(API_URL);
      Alert.alert('API Test', `Status: ${response.status}`);
    } catch (error) {
      Alert.alert('API Test Failed', error.toString());
    }
  };

  return (
    <StyledView className="flex-1 bg-white p-4">
      <StyledText className="text-2xl font-bold mb-4">Debug Information</StyledText>
      
      <StyledScrollView className="flex-1">
        <StyledView className="mb-6">
          <StyledText className="text-lg font-semibold mb-2">App Info</StyledText>
          {Object.entries(debugInfo).map(([key, value]) => (
            <StyledView key={key} className="mb-1">
              <StyledText className="text-sm">
                <StyledText className="font-semibold">{key}:</StyledText> {JSON.stringify(value)}
              </StyledText>
            </StyledView>
          ))}
        </StyledView>

        <StyledView className="mb-6">
          <StyledText className="text-lg font-semibold mb-2">Recent Logs</StyledText>
          {logs.slice(-10).map((log, index) => (
            <StyledText key={index} className="text-xs mb-1 font-mono">
              {log}
            </StyledText>
          ))}
        </StyledView>

        <StyledView className="gap-3">
          <StyledTouchableOpacity
            className="bg-blue-500 p-3 rounded"
            onPress={collectDebugInfo}
          >
            <StyledText className="text-white text-center font-semibold">
              Refresh Debug Info
            </StyledText>
          </StyledTouchableOpacity>

          <StyledTouchableOpacity
            className="bg-green-500 p-3 rounded"
            onPress={testApiConnection}
          >
            <StyledText className="text-white text-center font-semibold">
              Test API Connection
            </StyledText>
          </StyledTouchableOpacity>

          <StyledTouchableOpacity
            className="bg-red-500 p-3 rounded"
            onPress={clearAsyncStorage}
          >
            <StyledText className="text-white text-center font-semibold">
              Clear AsyncStorage
            </StyledText>
          </StyledTouchableOpacity>
        </StyledView>
      </StyledScrollView>
    </StyledView>
  );
}