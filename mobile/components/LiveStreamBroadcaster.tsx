import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TextInput, TouchableOpacity, Keyboard, Modal, ActivityIndicator, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthentication } from '../services/authService';
import { API_URL } from '../config';
import axios from 'axios';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

interface LiveStreamBroadcasterProps {
  shopId: string;
  onEndStream: () => void;
  shopName?: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
}

interface PinnedProduct {
  id: string;
  name: string;
  price: number;
  image: string;
}

const LiveStreamBroadcaster: React.FC<LiveStreamBroadcasterProps> = ({ shopId, onEndStream, shopName = 'Shop' }) => {
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(true);
  const [isEndingStream, setIsEndingStream] = useState(false);
  const [webViewKey, setWebViewKey] = useState<string>(Date.now().toString());
  const [ipCameraUrl, setIpCameraUrl] = useState<string>('');
  const [tempIpCameraUrl, setTempIpCameraUrl] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isStreamLoaded, setIsStreamLoaded] = useState<boolean>(false);
  const [isStreamLoading, setIsStreamLoading] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [settingsAnimation] = useState(new Animated.Value(0));
  const { getAccessToken } = useAuthentication();

  useEffect(() => {
    // First try to get URL from backend, then from local storage, then start stream
    fetchStreamUrlFromBackend()
      .then(backendUrl => {
        if (!backendUrl) {
          // If no backend URL, try local storage
          return loadSavedIpCameraUrl();
        }
        return backendUrl;
      })
      .then(() => fetchStreamingStatus())
      .then(isActive => {
        if (isActive) {
          return startStream();
        }
      });
      
    // Clean up any timeouts when component unmounts
    return () => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [shopId]);
  
  // Fetch streaming status from backend
  const fetchStreamingStatus = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('No authentication token available');
        return true; // Default to true if we can't check
      }
      
      const response = await axios.get(
        `${API_URL}/api/shops/${shopId}/streaming-status`,
        { headers: { Authorization: token } }
      );
      
      const isActive = response.data?.isStreaming ?? true;
      console.log('Loaded streaming status from backend:', isActive);
      setIsStreaming(isActive);
      return isActive;
    } catch (error) {
      console.error('Error fetching streaming status from backend:', error);
      // Not a critical error - assume streaming is on
      return true;
    }
  };
  
  // First try to fetch the stream URL from backend
  const fetchStreamUrlFromBackend = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('No authentication token available');
        return null;
      }
      
      const response = await axios.get(
        `${API_URL}/api/shops/${shopId}/stream-url`,
        { headers: { Authorization: token } }
      );
      
      if (response.data && response.data.streamUrl) {
        console.log('Loaded stream URL from backend:', response.data.streamUrl);
        setIpCameraUrl(response.data.streamUrl);
        setTempIpCameraUrl(response.data.streamUrl);
        return response.data.streamUrl;
      }
      return null;
    } catch (error) {
      console.error('Error fetching stream URL from backend:', error);
      // Not a critical error - we'll try local storage next
      return null;
    }
  };
  
  // Load saved camera URL from AsyncStorage
  const loadSavedIpCameraUrl = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem(`ip-camera-url-${shopId}`);
      if (savedUrl) {
        console.log('Loaded saved camera URL from storage:', savedUrl);
        setIpCameraUrl(savedUrl);
        setTempIpCameraUrl(savedUrl);
        return savedUrl;
      }
      // If no saved URL either, set default URL
      const defaultUrl = 'https://campus-eats-backend.onrender.com/video';
      console.log('No saved URL found, using default:', defaultUrl);
      setIpCameraUrl(defaultUrl);
      setTempIpCameraUrl(defaultUrl);
      return defaultUrl;
    } catch (error) {
      console.error('Error loading saved IP camera URL:', error);
      // Set default URL on error
      const defaultUrl = 'https://campus-eats-backend.onrender.com/video';
      setIpCameraUrl(defaultUrl);
      setTempIpCameraUrl(defaultUrl);
      return defaultUrl;
    }
  };
  
  // End the livestream by updating streaming status in the backend
  const endStream = async () => {
    try {
      setIsEndingStream(true);
      const token = await getAccessToken();
      
      if (!token) {
        console.error('No authentication token available');
        return;
      }
      
      console.log('Ending stream for shopId:', shopId);
      
      // Update the streaming status in the backend
      await axios.post(
        `${API_URL}/api/shops/${shopId}/streaming-status`,
        { isStreaming: false },
        { headers: { Authorization: token } }
      );
      
      console.log('Stream ended successfully');
      setIsStreaming(false);
      
      // If we have an active stream ID, also call the end stream endpoint
      if (streamId) {
        await axios.post(
          `${API_URL}/api/streams/${streamId}/end`,
          {},
          { headers: { Authorization: token } }
        );
        console.log('Stream instance ended');
      }
      
      // Notify parent component if needed
      // onEndStream();
    } catch (error) {
      console.error('Error ending stream:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      Alert.alert('Error', 'Failed to end the stream. Please try again.');
    } finally {
      setIsEndingStream(false);
    }
  };

  // Start the livestream and send URL to backend if needed
  const startStream = async () => {
    try {
      const token = await getAccessToken();
      
      if (!token) {
        console.error('No authentication token available');
        return;
      }
      
      console.log('Starting stream with shopId:', shopId);
      // URL is already updated in the backend either by our fetch or save operations
      
      // Update the streaming status in the backend
      await axios.post(
        `${API_URL}/api/shops/${shopId}/streaming-status`,
        { isStreaming: true },
        { headers: { Authorization: token } }
      );
      
      // Then start the stream
      const response = await axios.post(
        `${API_URL}/api/streams/start`,
        { shopId },
        { headers: { Authorization: token } }
      );
      console.log('Stream started successfully, response:', response.data);
      setStreamId(response.data.streamId);
    } catch (error) {
      console.error('Error starting stream:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
    }
  };

  // Test IP camera connection
  const testConnection = async () => {
    setIsTesting(true);
    setStreamError(false);
    setErrorMessage('');
    
    try {
      // Use fetch with a timeout to test connection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(tempIpCameraUrl, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        Alert.alert('Success', 'Connection to camera successful!');
      } else {
        setStreamError(true);
        setErrorMessage(`Connection failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setStreamError(true);
      if (error instanceof Error) {
        setErrorMessage(error.message);
        Alert.alert('Connection Error', `Failed to connect: ${error.message}

Common issues:
- Wrong IP address/port
- Device not on same network
- Camera app not running`);
      } else {
        setErrorMessage('Connection failed - unknown error');
        Alert.alert('Connection Error', `Failed to connect: Unknown error

Common issues:
- Wrong IP address/port
- Device not on same network
- Camera app not running`);
      }
    } finally {
      setIsTesting(false);
    }
  };
  
  // Save IP camera URL to AsyncStorage and backend
  const saveIpCameraUrl = async () => {
    try {
      if (!tempIpCameraUrl.startsWith('http://') && !tempIpCameraUrl.startsWith('https://')) {
        Alert.alert('Invalid URL', 'URL must start with http:// or https://');
        return;
      }
      
      // Save locally to AsyncStorage
      await AsyncStorage.setItem(`ip-camera-url-${shopId}`, tempIpCameraUrl);
      
      // Send to backend
      console.log('Sending stream URL to backend:', tempIpCameraUrl);
      const token = await getAccessToken();
      if (token) {
        try {
          // Send the URL to the backend API using POST
          await axios.post(
            `${API_URL}/api/shops/${shopId}/stream-url`,
            { streamUrl: tempIpCameraUrl },
            { headers: { Authorization: token } }
          );
          console.log('Stream URL sent to backend via POST request');
        } catch (apiError) {
          if (axios.isAxiosError(apiError)) {
            console.error('Failed to save URL to backend:', apiError.response?.status);
            console.error('Error details:', apiError.response?.data);
          } else {
            console.error('Unknown error saving URL to backend:', apiError);
          }
          // Continue even if backend save fails - we have the URL locally
        }
      }
      
      // Update local state and force the stream to reload
      setIpCameraUrl(tempIpCameraUrl);
      setShowSettings(false);
      setStreamError(false);
      setErrorMessage('');
      setIsStreamLoaded(false);
      setIsStreamLoading(true);
      
      // Force WebView to reload by setting a key time value
      setWebViewKey(Date.now().toString());
    } catch (error) {
      console.error('Error saving IP camera URL:', error);
      Alert.alert('Error', 'Failed to save the camera URL');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with shop name */}
      <View style={styles.header}>
        <Text style={styles.headerText}>{shopName} - Live Streams</Text>
      </View>

      {/* IP Camera Settings Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={showSettings}
        onRequestClose={() => {
          // Animate settings panel sliding down
          Animated.timing(settingsAnimation, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setShowSettings(false);
          });
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, {
            transform: [{
              translateY: settingsAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [300, 0], // Slide up 300px
              }),
            }],
          }]}>
            <Text style={styles.modalTitle}>IP Camera Settings</Text>
            
            <Text style={styles.inputLabel}>Camera Stream URL:</Text>
            <TextInput
              style={styles.urlInput}
              value={tempIpCameraUrl}
              onChangeText={setTempIpCameraUrl}
              placeholder="https://campus-eats-backend.onrender.com/video"
              placeholderTextColor="#999"
            />
            
            <Text style={styles.helpText}>
              Enter the URL of your IP webcam. Example format: https://campus-eats-backend.onrender.com/video
            </Text>
            
            <Text style={styles.troubleshootText}>
              Common issues:
              - Make sure both devices are on the same WiFi network
              - Check that the IP camera app is running on the other phone
              - Verify the IP address and port are correct
              - Try using the test connection button below
            </Text>
            
            <TouchableOpacity 
              style={styles.testButton}
              onPress={testConnection}
              disabled={isTesting}
            >
              <Text style={styles.testButtonText}>Test Connection</Text>
              {isTesting && <Text style={styles.testingText}> (Testing...)</Text>}
            </TouchableOpacity>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  // Animate settings panel sliding down
                  Animated.timing(settingsAnimation, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                  }).start(() => {
                    setTempIpCameraUrl(ipCameraUrl); // Reset to current URL
                    setShowSettings(false);
                  });
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.saveButton]}
                onPress={saveIpCameraUrl}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
      {/* Stream View */}
      <View style={styles.buttonNavigation}>
        <TouchableOpacity style={styles.controlButton} onPress={() => {
          setShowSettings(true);
          // Animate settings panel sliding up
          Animated.timing(settingsAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }}>
          <Ionicons name="settings-outline" size={24} color="#fff" />
          <Text style={styles.controlButtonText}>Settings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.controlButton, { backgroundColor: isStreaming ? '#BC4A4D' : '#888' }]} 
          onPress={() => isStreaming ? endStream() : startStream()}
          disabled={isEndingStream}
        >
          <Ionicons name={isStreaming ? "stop-circle-outline" : "play-circle-outline"} size={24} color="#fff" />
          <Text style={styles.controlButtonText}>
            {isEndingStream ? 'Processing...' : (isStreaming ? 'End Stream' : 'Start Stream')}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.streamContainer}>
        {ipCameraUrl && isStreaming ? (
          <View style={styles.webViewContainer}>
            <WebView
              key={webViewKey}
              source={{ uri: ipCameraUrl }}
              style={styles.webView}
              onLoadStart={() => {
                console.log('Stream WebView loading started with URL:', ipCameraUrl);
                setIsStreamLoading(true);
                
                // Clear any existing timeout
                if (loadingTimeout) {
                  clearTimeout(loadingTimeout);
                }
                
                // Set a timeout to hide the loading indicator after 5 seconds
                // even if onLoadEnd doesn't fire properly
                const timeout = setTimeout(() => {
                  console.log('Loading timeout reached, forcing loading indicator to hide');
                  setIsStreamLoading(false);
                }, 5000);
                
                setLoadingTimeout(timeout);
              }}
              onLoadEnd={() => {
                console.log('Stream WebView loading ended');
                
                // Clear the timeout since load ended naturally
                if (loadingTimeout) {
                  clearTimeout(loadingTimeout);
                  setLoadingTimeout(null);
                }
                
                setIsStreamLoading(false);
                // Logging status of WebView
                console.log('WebView should now be visible -', 
                          'Stream loaded:', isStreamLoaded, 
                          'Stream loading:', isStreamLoading, 
                          'Stream error:', streamError);
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                // Just log the error without showing any error UI
                console.log('(NOBRIDGE) ERROR  WebView error:', nativeEvent);
                // Don't set error state variables
                setIsStreamLoading(false);
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback={true}
              originWhitelist={['*']}
            />
            {isStreamLoading && (
              <View style={[styles.loadingOverlay, StyleSheet.absoluteFill]}>
                <Text style={styles.loadingText}>Connecting to stream...</Text>
              </View>
            )}

            {streamError && (
              <View style={styles.errorOverlay}>
                <Text style={styles.errorText}>Failed to load stream</Text>
                <Text style={styles.errorSubText}>{errorMessage || 'Connection refused. Please check the URL in settings'}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => {
                    setIsStreamLoaded(false);
                    setIsStreamLoading(true);
                    setStreamError(false);
                    setErrorMessage('');
                    // Force WebView to reload
                    setIpCameraUrl('');
                    setTimeout(() => setIpCameraUrl(tempIpCameraUrl), 100);
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry Connection</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.settingsButtonInError}
                  onPress={() => setShowSettings(true)}
                >
                  <Text style={styles.retryButtonText}>Open Settings</Text>
                </TouchableOpacity>
              </View>
            )}
          </View> //yow
        ) : (
          <View style={styles.streamPlaceholder}>
            <Text style={styles.streamText}>No stream URL configured</Text>
            <Text style={[styles.configureText, {color: 'white'}]}>Use settings to configure stream URL</Text>
          </View>
        )}
      </View>
      
      {/* Bottom Close Stream Button */}
      <View style={styles.closeButtonContainer}>
        <TouchableOpacity style={styles.closeStreamButton} onPress={onEndStream}>
          <Ionicons name="close-circle" size={24} color="#fff" />
          <Text style={styles.closeStreamButtonText}>Close Stream</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DFD6C5', // Match background color with other screens
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#BC4A4D', // Match header color with other screens
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },


  streamContainer: {
    marginTop: 60,
    height: Dimensions.get('window').height * 0.28, // Reduced height for better fit in modal
    backgroundColor: '#111',
    position: 'relative',
    overflow: 'hidden',
  },
  buttonNavigation: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  controlButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: 'bold',
  },
  webViewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 15,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  errorText: {
    color: '#BC4A4D',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorSubText: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
    maxWidth: '80%',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 15,
  },
  settingsButtonInError: {
    backgroundColor: '#555',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: '#6a5acd',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  testButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  testingText: {
    color: 'white',
    fontStyle: 'italic',
  },
  troubleshootText: {
    fontSize: 12,
    color: '#555',
    marginBottom: 15,
    lineHeight: 18,
  },
  streamPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeStreamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#BC4A4D',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  closeStreamButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  streamText: {
    color: 'white',
    fontSize: 18,
  },
  configureText: {
    color: '#4A90E2',
    fontSize: 14,
    marginTop: 10,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 12,
    color: '#777',
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  productName: {
    fontWeight: 'bold',
    color: '#333',
  },
  productPrice: {
    color: '#BC4A4D',
    marginTop: 4,
  },
  username: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#BC4A4D',
  },
});

export default LiveStreamBroadcaster; 