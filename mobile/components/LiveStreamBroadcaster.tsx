import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, Modal, Alert } from 'react-native';
import { useAuthentication } from '../services/authService';
import { API_URL } from '../config';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LiveStreamBroadcasterProps {
  shopId: string;
  onEndStream: () => void;
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

const LiveStreamBroadcaster: React.FC<LiveStreamBroadcasterProps> = ({ shopId, onEndStream }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(true);
  const [pinnedProducts, setPinnedProducts] = useState<PinnedProduct[]>([]);
  const [ipCameraUrl, setIpCameraUrl] = useState<string>('');
  const [tempIpCameraUrl, setTempIpCameraUrl] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isStreamLoaded, setIsStreamLoaded] = useState<boolean>(false);
  const [isStreamLoading, setIsStreamLoading] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const { getAccessToken } = useAuthentication();

  useEffect(() => {
    // First load the saved camera URL, then start the stream
    loadSavedIpCameraUrl().then(() => startStream());
  }, [shopId]);
  
  // Load camera URL from backend first, then fallback to AsyncStorage
  const loadSavedIpCameraUrl = async () => {
    try {
      // First try to get the stream URL from the backend
      const token = await getAccessToken();
      console.log('Fetching stream URL from backend for shop:', shopId);
      
      if (token) {
        try {
          const response = await axios.get(`${API_URL}/api/shops/${shopId}/stream-url`, {
            headers: { Authorization: token }
          });
          
          if (response.data && response.data.streamUrl) {
            console.log('Retrieved stream URL from backend:', response.data.streamUrl);
            setIpCameraUrl(response.data.streamUrl);
            setTempIpCameraUrl(response.data.streamUrl);
            
            // Also save to AsyncStorage for future use
            await AsyncStorage.setItem(`ip-camera-url-${shopId}`, response.data.streamUrl);
            
            return response.data.streamUrl;
          }
        } catch (apiError) {
          // If backend has no URL (404) or other error, continue to check AsyncStorage
          console.log('Could not get stream URL from backend, checking local storage instead');
        }
      }
      
      // Fallback: Check AsyncStorage
      const savedUrl = await AsyncStorage.getItem(`ip-camera-url-${shopId}`);
      if (savedUrl) {
        console.log('Loaded saved camera URL from AsyncStorage:', savedUrl);
        setIpCameraUrl(savedUrl);
        setTempIpCameraUrl(savedUrl);
        return savedUrl;
      }
      
      // No saved URL anywhere, set to empty and let user configure
      console.log('No saved camera URL found, please configure in settings');
      return null;
    } catch (error) {
      console.error('Error loading IP camera URL:', error);
      return null;
    }
  };
  
  // Start the livestream and send URL to backend
  const startStream = async () => {
    try {
      const token = await getAccessToken();
      
      if (!token) {
        console.error('No authentication token available');
        return;
      }
      
      console.log('Starting stream with shopId:', shopId);
      
      // First update the stream URL in the backend
      if (ipCameraUrl) {
        try {
          // Use POST to store the stream URL in the backend
          await axios.post(
            `${API_URL}/api/shops/${shopId}/stream-url`,
            { streamUrl: ipCameraUrl },
            { headers: { Authorization: token } }
          );
          console.log('Stream URL sent to backend via POST request');
        } catch (urlError) {
          console.error('Error updating stream URL:', urlError);
          // Continue anyway - the stream might still work
        }
      }
      
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
      // Fix TypeScript errors by checking if error is an AxiosError
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
    }
  };

  // Function was moved above

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
      
      // Update local state and force WebView to refresh by temporarily clearing the URL
      // This is needed because sometimes WebView doesn't properly refresh when the source URL changes
      setIpCameraUrl(''); // Clear URL first
      setShowSettings(false);
      setStreamError(false);
      setErrorMessage('');
      setIsStreamLoaded(false);
      setIsStreamLoading(true);
      
      // Small delay then set the new URL to force WebView to completely refresh
      setTimeout(() => {
        setIpCameraUrl(tempIpCameraUrl);
        console.log('Camera URL updated to:', tempIpCameraUrl);
      }, 100);
    } catch (error) {
      console.error('Error saving IP camera URL:', error);
      Alert.alert('Error', 'Failed to save the camera URL');
    }
  };

  const endStream = async () => {
    if (!streamId) return;

    try {
      const token = await getAccessToken();
      await axios.post(
        `${API_URL}/api/streams/${streamId}/end`,
        {},
        {
          headers: { Authorization: token }
        }
      );
      setIsStreaming(false);
      onEndStream();
    } catch (error) {
      console.error('Error ending stream:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      } else {
        console.error('Unknown error:', error);
      }
    }
  };

  const pinProduct = async (productId: string) => {
    try {
      const token = await getAccessToken();
      const response = await axios.post(
        `${API_URL}/api/streams/${streamId}/pin-product`,
        { productId },
        {
          headers: { Authorization: token }
        }
      );
      setPinnedProducts(prev => [...prev, response.data]);
    } catch (error) {
      console.error('Error pinning product:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      } else {
        console.error('Unknown error:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* IP Camera Settings Modal */}
      <Modal
        visible={showSettings}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>IP Camera Settings</Text>
            
            <Text style={styles.inputLabel}>Camera Stream URL:</Text>
            <TextInput
              style={styles.urlInput}
              value={tempIpCameraUrl}
              onChangeText={setTempIpCameraUrl}
              placeholder="http://192.168.1.14:8080/video"
              placeholderTextColor="#999"
            />
            
            <Text style={styles.helpText}>
              Enter the URL of your IP webcam. Example format: http://192.168.1.14:8080/video
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
                  setTempIpCameraUrl(ipCameraUrl); // Reset to current URL
                  setShowSettings(false);
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
          </View>
        </View>
      </Modal>
      {/* Stream View */}
      <View style={styles.streamContainer}>
        <TouchableOpacity style={styles.endButton} onPress={endStream}>
          <Ionicons name="close-circle" size={32} color="#BC4A4D" />
          <Text style={styles.endButtonText}>End Stream</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(true)}>
          <Ionicons name="settings-outline" size={24} color="#fff" />
          <Text style={styles.settingsButtonText}>Settings</Text>
        </TouchableOpacity>
        
        {ipCameraUrl ? (
          <View style={styles.webViewContainer}>
            {isStreamLoading && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading stream...</Text>
              </View>
            )}
            <WebView
              source={{ uri: ipCameraUrl }}
              style={styles.webView}
              onLoadStart={() => {
                setIsStreamLoading(true);
              }}
              onLoadEnd={() => {
                // Use a short timeout to ensure the stream has time to actually display
                setTimeout(() => {
                  setIsStreamLoading(false);
                  setIsStreamLoaded(true);
                  setStreamError(false);
                  setErrorMessage('');
                }, 1000); // 1 second timeout to ensure stream is visible
              }}
              onLoad={() => {
                setIsStreamLoaded(true);
                // Keep loading screen a bit longer to ensure stream is actually visible
                setTimeout(() => {
                  setIsStreamLoading(false);
                }, 1000);
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                setStreamError(true);
                setIsStreamLoading(false);
                setErrorMessage(`${nativeEvent.description || ''} (Code: ${nativeEvent.code || 'unknown'})`);
                console.log('WebView connection issue:', nativeEvent.description, nativeEvent.code);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                setStreamError(true);
                setIsStreamLoading(false);
                setErrorMessage(`HTTP Error (${nativeEvent.statusCode})`);
                console.log('WebView HTTP status:', nativeEvent.statusCode);
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowingReadAccessToURL={ipCameraUrl}
              mediaPlaybackRequiresUserAction={false}
              startInLoadingState={true}
              renderLoading={() => <View />} // Don't use WebView's built-in loading indicator
            />
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
          </View>
        ) : (
          <View style={styles.streamPlaceholder}>
            <Text style={styles.streamText}>No stream URL configured</Text>
            <TouchableOpacity onPress={() => setShowSettings(true)}>
              <Text style={styles.configureText}>Tap to configure</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Pinned Products */}
      <View style={styles.pinnedProductsContainer}>
        <Text style={styles.sectionTitle}>Your Stocks</Text>
        <ScrollView horizontal style={styles.pinnedProductsScroll}>
          {pinnedProducts.map((product) => (
            <View key={product.id} style={styles.pinnedProduct}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>₱{product.price}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Chat Section */}
      <View style={styles.chatContainer}>
        <ScrollView style={styles.messagesContainer}>
          {messages.map((msg) => (
            <View key={msg.id} style={styles.messageContainer}>
              <Text style={styles.username}>{msg.username}</Text>
              <Text style={styles.message}>{msg.message}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  streamContainer: {
    height: Dimensions.get('window').height * 0.4,
    backgroundColor: '#111',
    position: 'relative',
  },
  endButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 20,
  },
  endButtonText: {
    color: '#BC4A4D',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  settingsButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 20,
  },
  settingsButtonText: {
    color: '#fff',
    marginLeft: 5,
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  pinnedProductsContainer: {
    backgroundColor: '#fff',
    padding: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  pinnedProductsScroll: {
    flexDirection: 'row',
  },
  pinnedProduct: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginRight: 10,
    borderRadius: 8,
    minWidth: 120,
  },
  productName: {
    fontWeight: 'bold',
    color: '#333',
  },
  productPrice: {
    color: '#BC4A4D',
    marginTop: 4,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messagesContainer: {
    flex: 1,
    padding: 10,
  },
  messageContainer: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  username: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#BC4A4D',
  },
  message: {
    color: '#333',
  },
});

export default LiveStreamBroadcaster; 