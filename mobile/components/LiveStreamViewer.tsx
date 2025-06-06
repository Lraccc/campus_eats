import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, ActivityIndicator, Modal, Alert } from 'react-native';
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

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
}

const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({ shopId, onClose, shopName = 'Shop' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
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
        
        // Endpoint for the stream URL - using the correct endpoint
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

  const sendMessage = async () => {
    if (!newMessage.trim() || !userId) return;

    try {
      const token = await getAccessToken();
      // In a real implementation, you would send the message to a chat service
      // For now, just add it locally
      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        userId,
        username: 'You',
        message: newMessage,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };
  
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
      {/* Header with shop name and close button */}
      <View style={styles.header}>
        <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
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
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#666"
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Ionicons name="send" size={24} color="#BC4A4D" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#BC4A4D',
    paddingVertical: 10,
    paddingHorizontal: 15,
    paddingTop: 40, // Add extra padding for status bar
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
    height: Dimensions.get('window').height * 0.4,
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
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    color: '#333',
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
});

export default LiveStreamViewer; 