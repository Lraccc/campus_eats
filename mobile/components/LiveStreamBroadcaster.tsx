import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Modal, ActivityIndicator, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthentication } from '../services/authService';
import { API_URL } from '../config';
import axios from 'axios';
import { Camera, CameraType } from 'expo-camera';

// Lazy load WebRTC to avoid Expo Go errors
let RTCView: any, RTCPeerConnection: any, RTCSessionDescription: any, RTCIceCandidate: any, mediaDevices: any, MediaStream: any;
let webrtcSignalingService: any;
let SignalingMessageType: any;
let isWebRTCAvailable = false;

try {
  const webrtc = require('react-native-webrtc');
  RTCView = webrtc.RTCView;
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  mediaDevices = webrtc.mediaDevices;
  MediaStream = webrtc.MediaStream;
  
  const signaling = require('../services/webrtcSignalingService');
  webrtcSignalingService = signaling.webrtcSignalingService;
  SignalingMessageType = signaling.SignalingMessage;
  
  isWebRTCAvailable = true;
} catch (e) {
  console.warn('WebRTC not available - using development build to enable live streaming');
}

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
  // Check if WebRTC is available (not in Expo Go)
  if (!isWebRTCAvailable) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={64} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Live Streaming Not Available</Text>
          <Text style={styles.errorMessage}>
            Live streaming requires a development build or production APK.{'\n\n'}
            Please build the app using GitHub workflows to enable this feature.
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onEndStream}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEndingStream, setIsEndingStream] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState<'back' | 'front'>('back');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const { getAccessToken } = useAuthentication();
  
  // WebRTC refs
  const peerConnections = useRef<Map<string, any>>(new Map());
  const cameraRef = useRef<any>(null);

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Request camera permissions on mount
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const audioStatus = await Camera.requestMicrophonePermissionsAsync();
      setHasPermission(status === 'granted' && audioStatus.status === 'granted');
    })();

    return () => {
      // Cleanup on unmount
      cleanup();
    };
  }, []);

  // Setup signaling when permissions granted
  useEffect(() => {
    if (hasPermission && shopId) {
      setupSignaling();
    }
  }, [hasPermission, shopId]);

  /**
   * Setup WebRTC signaling
   */
  const setupSignaling = async () => {
    try {
      setConnectionStatus('Connecting...');
      const token = await getAccessToken();
      
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      // Connect to signaling server
      await webrtcSignalingService.connect(token);
      
      // Setup callbacks
      webrtcSignalingService.onMessage(handleSignalingMessage);
      webrtcSignalingService.onConnectionChange((connected) => {
        setConnectionStatus(connected ? 'Connected' : 'Disconnected');
      });
      webrtcSignalingService.onViewerCountChange((count) => {
        setViewerCount(count);
      });

      setConnectionStatus('Ready');
    } catch (error) {
      console.error('Error setting up signaling:', error);
      setConnectionStatus('Error');
      Alert.alert('Connection Error', 'Failed to connect to signaling server');
    }
  };

  /**
   * Handle incoming signaling messages
   */
  const handleSignalingMessage = async (message: any) => {
    console.log('📨 Received signaling message:', message.type);

    switch (message.type) {
      case 'viewer-joined':
        if (message.viewerId) {
          await createPeerConnection(message.viewerId);
        }
        break;

      case 'answer':
        if (message.viewerId && message.data) {
          const pc = peerConnections.current.get(message.viewerId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(message.data));
          }
        }
        break;

      case 'ice-candidate':
        if (message.viewerId && message.data) {
          const pc = peerConnections.current.get(message.viewerId);
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(message.data));
          }
        }
        break;

      case 'viewer-left':
        if (message.viewerId) {
          closePeerConnection(message.viewerId);
        }
        break;
    }
  };

  /**
   * Create peer connection for a viewer
   */
  const createPeerConnection = async (viewerId: string) => {
    try {
      const pc = new RTCPeerConnection(iceServers);

      // Add local stream to peer connection
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          webrtcSignalingService.sendMessage({
            type: 'ice-candidate',
            data: event.candidate,
            shopId,
            viewerId,
          });
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      webrtcSignalingService.sendMessage({
        type: 'offer',
        data: offer,
        shopId,
        viewerId,
      });

      peerConnections.current.set(viewerId, pc);
      console.log('✅ Created peer connection for viewer:', viewerId);
    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  };

  /**
   * Close peer connection
   */
  const closePeerConnection = (viewerId: string) => {
    const pc = peerConnections.current.get(viewerId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(viewerId);
      console.log('🔌 Closed peer connection for viewer:', viewerId);
    }
  };

  /**
   * Start camera stream
   */
  const startCameraStream = async () => {
    try {
      const stream = await mediaDevices.getUserMedia({
        video: {
          facingMode: cameraType === 'back' ? 'environment' : 'user',
          width: 1280,
          height: 720,
        },
        audio: true,
      });

      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error starting camera:', error);
      Alert.alert('Camera Error', 'Failed to access camera');
      return null;
    }
  };

  /**
   * Start streaming
   */
  const startStream = async () => {
    try {
      setIsConnecting(true);
      const token = await getAccessToken();

      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      if (!hasPermission) {
        Alert.alert('Permission Required', 'Camera and microphone permissions are required');
        return;
      }

      // Start camera
      const stream = await startCameraStream();
      if (!stream) return;

      // Update backend streaming status
      await axios.post(
        `${API_URL}/api/shops/${shopId}/streaming-status`,
        { isStreaming: true },
        { headers: { Authorization: token } }
      );

      // Start stream on backend
      const response = await axios.post(
        `${API_URL}/api/streams/start`,
        { shopId },
        { headers: { Authorization: token } }
      );

      setStreamId(response.data.streamId);
      setIsStreaming(true);

      // Join as broadcaster
      webrtcSignalingService.joinAsBroadcaster(shopId);

      console.log('🎥 Stream started successfully');
    } catch (error) {
      console.error('Error starting stream:', error);
      Alert.alert('Error', 'Failed to start stream');
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * End streaming
   */
  const endStream = async () => {
    try {
      setIsEndingStream(true);
      const token = await getAccessToken();

      if (!token) {
        console.error('No authentication token available');
        return;
      }

      // Update backend
      await axios.post(
        `${API_URL}/api/shops/${shopId}/streaming-status`,
        { isStreaming: false },
        { headers: { Authorization: token } }
      );

      if (streamId) {
        await axios.post(
          `${API_URL}/api/streams/${streamId}/end`,
          {},
          { headers: { Authorization: token } }
        );
      }

      // Leave signaling
      webrtcSignalingService.leave();

      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }

      // Close all peer connections
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();

      setIsStreaming(false);
      setViewerCount(0);

      console.log('🛑 Stream ended successfully');
    } catch (error) {
      console.error('Error ending stream:', error);
      Alert.alert('Error', 'Failed to end stream');
    } finally {
      setIsEndingStream(false);
    }
  };

  /**
   * Cleanup resources
   */
  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    webrtcSignalingService.disconnect();
  };

  /**
   * Toggle camera
   */
  const toggleCamera = () => {
    setCameraType(current =>
      current === 'back' ? 'front' : 'back'
    );
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        </View>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color="#BC4A4D" />
          <Text style={styles.permissionText}>Requesting permissions...</Text>
        </View>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        </View>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-off" size={50} color="#BC4A4D" />
          <Text style={styles.permissionText}>Camera permission required</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={() => {
            Camera.requestCameraPermissionsAsync();
          }}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with shop name */}
      <View style={styles.header}>
        <Text style={styles.headerText}>{shopName} - Live Stream</Text>
      </View>

      {/* Control Buttons */}
      <View style={styles.buttonNavigation}>
        <View style={styles.statsContainer}>
          <View style={styles.statBadge}>
            <Ionicons name="eye" size={16} color="#fff" />
            <Text style={styles.statText}>{viewerCount}</Text>
          </View>
          <View style={[styles.statBadge, {
            backgroundColor: connectionStatus === 'Connected' ? '#10b981' : 
                           connectionStatus === 'Connecting...' ? '#f59e0b' : '#ef4444'
          }]}>
            <Text style={styles.statText}>{connectionStatus}</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          {isStreaming && (
            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <Ionicons name="camera-reverse" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.controlButton, { 
              backgroundColor: isStreaming ? '#BC4A4D' : '#10b981',
              paddingHorizontal: 20
            }]} 
            onPress={() => isStreaming ? endStream() : startStream()}
            disabled={isEndingStream || isConnecting}
          >
            <Ionicons 
              name={isStreaming ? "stop-circle-outline" : "play-circle-outline"} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.controlButtonText}>
              {isConnecting ? 'Starting...' : 
               isEndingStream ? 'Ending...' : 
               isStreaming ? 'End Stream' : 'Start Stream'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Camera View */}
      <View style={styles.streamContainer}>
        {isStreaming ? (
          localStream ? (
            <RTCView
              streamURL={(localStream as any).toURL()}
              style={styles.cameraView}
              objectFit="cover"
              mirror={cameraType === 'front'}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#BC4A4D" />
              <Text style={styles.loadingText}>Initializing camera...</Text>
            </View>
          )
        ) : (
          <View style={styles.streamPlaceholder}>
            <Ionicons name="videocam-off" size={64} color="#666" />
            <Text style={styles.streamText}>Stream not started</Text>
            <Text style={styles.configureText}>Tap "Start Stream" to begin broadcasting</Text>
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
    backgroundColor: '#DFD6C5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#333',
    fontSize: 16,
    marginTop: 15,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  streamContainer: {
    marginTop: 60,
    height: Dimensions.get('window').height * 0.28,
    backgroundColor: '#111',
    position: 'relative',
    overflow: 'hidden',
  },
  buttonNavigation: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    gap: 5,
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 5,
  },
  controlButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: 'bold',
  },
  cameraView: {
    flex: 1,
    width: '100%',
    height: '100%',
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
  streamPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamText: {
    color: 'white',
    fontSize: 18,
    marginTop: 15,
  },
  configureText: {
    color: '#999',
    fontSize: 14,
    marginTop: 10,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 22,
  },
  closeButton: {
    marginTop: 30,
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LiveStreamBroadcaster; 