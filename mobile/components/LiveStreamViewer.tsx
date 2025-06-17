import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, ActivityIndicator, Modal, Alert, Animated } from 'react-native';
import { useAuthentication } from '../services/authService';
import { API_URL } from '../config';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

interface LiveStreamViewerProps {
  shopId: string;
  onClose: () => void;
  shopName?: string;
}

const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({ shopId, onClose, shopName = 'Shop' }) => {
  const [isStreamActive, setIsStreamActive] = useState(true);
  const { getAccessToken } = useAuthentication();
  const [userId, setUserId] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStreamLoading, setIsStreamLoading] = useState(true);

  useEffect(() => {
    // Use a generic user ID for chat functionality
    setUserId('viewer-' + Math.random().toString(36).substring(2, 7));
    
    // Force hide loading indicator after a timeout even if events don't fire
    const forceHideLoadingTimeout = setTimeout(() => {
      console.log('Force hiding loading indicator after timeout');
      setIsStreamLoading(false);
    }, 5000);
    
    // Fetch the stream URL
    const fetchStreamUrl = async () => {
      setIsLoading(true);
      try {
        const token = await getAccessToken();
        console.log('Fetching stream URL for shopId:', shopId);
        
        // Endpoint for the stream URL - using the correct endpointf
        let streamEndpoint = `${API_URL}/api/shops/${shopId}/stream-url`;
        console.log('Stream URL endpoint:', streamEndpoint);
        
        // Make the API request
        const response = await axios.get(streamEndpoint, {
          headers: token ? { Authorization: token } : {}
        });
        
        console.log('Stream URL response:', response.data);
        
        if (response.data && response.data.streamUrl) {
          console.log('Setting stream URL from backend:', response.data.streamUrl);
          setStreamUrl(response.data.streamUrl);
          setIsStreamActive(true);
        } else {
          // If backend returns empty data, log a specific message
          console.warn('Backend returned empty stream URL data. Response:', response.data);
          // Fallback for development/testing: use a sample stream URL
          console.log('Using sample stream as fallback');
          setStreamUrl('https://multiplatform-f.akamaihd.net/i/multi/will/bunny/big_buck_bunny_,640x360_400,640x360_700,640x360_1000,950x540_1500,.f4v.csmil/master.m3u8');
          setIsStreamActive(true);
        }
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null) {
          const axiosError = error as any;
          
          // Handle 404 errors specially (shop doesn't have a stream URL configured)
          if (axiosError.response && axiosError.response.status === 404) {
            // This is an expected case - shop doesn't have stream configured
            console.log('Shop does not have streaming configured (404)');
            setError('This shop currently has no active stream');
            setIsStreamActive(false);
          } else {
            // For other errors, log details for debugging
            console.error('Error fetching stream URL:', typeof error === 'object' && error !== null && 'response' in error ? axiosError.response?.status : 'Unknown error');
            
            if (axiosError.response) {
              console.error('Response data:', axiosError.response.data);
              console.error('Response status:', axiosError.response.status);
            } else if (axiosError.request) {
              console.error('No response received:', axiosError.request);
            } else if ('message' in axiosError) {
              console.error('Error message:', axiosError.message);
            }
          }
        }
        
        // Fallback for development: use a sample stream URL
        console.log('Error fetching stream, using sample stream for demonstration');
        setStreamUrl('https://multiplatform-f.akamaihd.net/i/multi/will/bunny/big_buck_bunny_,640x360_400,640x360_700,640x360_1000,950x540_1500,.f4v.csmil/master.m3u8');
        setIsStreamActive(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStreamUrl();
    
    // Clear timeout on component unmount
    return () => clearTimeout(forceHideLoadingTimeout);
  }, [shopId]);
  
  const handleLoadStart = () => {
    setIsStreamLoading(true);
  };

  const handleLoadEnd = () => {
    setIsStreamLoading(false);
  };
  
  const handleError = (e: any) => {
    console.error('WebView error:', e.nativeEvent);
    setError(`Connection error: ${e.nativeEvent?.description || 'Could not connect to stream'}`);
    setIsStreamLoading(false);
  };

  return (
    <View style={styles.container}>
      {/* Header with shop name */}
      <View style={styles.header}>
        <Text style={styles.headerText}>{shopName} - Live Stream</Text>
      </View>
      
      {/* Stream View */}
      <View style={styles.streamContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#BC4A4D" />
            <Text style={styles.loadingText}>Loading stream...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={50} color="#FFA500" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setIsLoading(true);
                // Re-fetch the stream URL
                const fetchStreamUrl = async () => {
                  try {
                    const token = await getAccessToken();
                    const response = await axios.get(`${API_URL}/api/shops/${shopId}/stream-url`, {
                      headers: { Authorization: token }
                    });
                    
                    if (response.data && response.data.streamUrl) {
                      setStreamUrl(response.data.streamUrl);
                      setIsStreamActive(true);
                    } else {
                      setError('No active stream found for this shop');
                      setIsStreamActive(false);
                    }
                  } catch (error) {
                    console.error('Error fetching stream URL:', error);
                    setError('Could not load stream');
                    setIsStreamActive(false);
                  } finally {
                    setIsLoading(false);
                  }
                };
                fetchStreamUrl();
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : streamUrl && isStreamActive ? (
          <>
            <WebView
              source={{ uri: streamUrl }}
              style={{ flex: 1 }}
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback={true}
            />
            {isStreamLoading && (
              <View style={[styles.loadingOverlay, StyleSheet.absoluteFill]}>
                <ActivityIndicator size="large" color="#BC4A4D" />
                <Text style={styles.loadingText}>Connecting to stream...</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.offlineContainer}>
            <Text style={styles.offlineText}>Stream is not available</Text>
          </View>
        )}
      </View>
      
      {/* Bottom Close Stream Button */}
      <View style={styles.closeButtonContainer}>
        <TouchableOpacity style={styles.closeStreamButton} onPress={onClose}>
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
    backgroundColor: '#DFD6C5',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#BC4A4D',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  streamContainer: {
    marginTop: 60,
    height: Dimensions.get('window').height * 0.28,
    backgroundColor: '#111',
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
  },
  loadingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: 'white',
    fontSize: 18,
  },
  username: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#BC4A4D',
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
});

export default LiveStreamViewer;