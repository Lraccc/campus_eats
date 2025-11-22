import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AGORA_APP_ID, API_URL } from '../config';
import { useAuthentication, AUTH_TOKEN_KEY } from '../services/authService';
import axios from 'axios';
import LivestreamChat from './LivestreamChat';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// Conditional Agora import - only works in development builds, not Expo Go
let createAgoraRtcEngine: any = null;
let ChannelProfileType: any = null;
let ClientRoleType: any = null;
let RtcSurfaceView: any = null;
let VideoSourceType: any = null;

try {
  const AgoraModule = require('react-native-agora');
  createAgoraRtcEngine = AgoraModule.createAgoraRtcEngine;
  ChannelProfileType = AgoraModule.ChannelProfileType;
  ClientRoleType = AgoraModule.ClientRoleType;
  RtcSurfaceView = AgoraModule.RtcSurfaceView;
  VideoSourceType = AgoraModule.VideoSourceType;
} catch (error) {
  console.log('Agora SDK not available - running in Expo Go');
}

const isExpoGo = Constants.appOwnership === 'expo';

interface LiveStreamBroadcasterProps {
  shopId: string;
  onEndStream: () => void;
  shopName?: string;
}

interface LiveStreamBroadcasterProps {
  shopId: string;
  onEndStream: () => void;
  shopName?: string;
}

interface ConnectionState {
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';
  message: string;
}

const LiveStreamBroadcaster: React.FC<LiveStreamBroadcasterProps> = ({ 
  shopId, 
  onEndStream, 
  shopName = 'Shop' 
}) => {
  // Show Expo Go warning if Agora is not available
  if (!createAgoraRtcEngine || isExpoGo) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerText}>Live Stream</Text>
          </View>
        </View>
        <View style={styles.expoGoWarning}>
          <Ionicons name="warning-outline" size={64} color="#FFA726" />
          <Text style={styles.expoGoTitle}>Development Build Required</Text>
          <Text style={styles.expoGoMessage}>
            Live streaming requires native modules that are not available in Expo Go.
          </Text>
          <Text style={styles.expoGoMessage}>
            To test this feature:
          </Text>
          <View style={styles.instructionsList}>
            <Text style={styles.instructionItem}>1. Build the app using GitHub Actions</Text>
            <Text style={styles.instructionItem}>2. Download and install the APK on your device</Text>
            <Text style={styles.instructionItem}>3. Or run: npx expo run:android</Text>
          </View>
          <TouchableOpacity style={styles.backButton} onPress={onEndStream}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Agora engine reference
  const agoraEngineRef = useRef<any>(null);
  const viewerWebSocketRef = useRef<Client | null>(null);
  
  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'idle',
    message: 'Ready to start streaming'
  });
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamId, setStreamId] = useState<string | null>(null);
  
  const { getAccessToken } = useAuthentication();

  // Channel name derived from shopId (must be unique per shop)
  const channelName = `shop_${shopId}`;

  /**
   * Request camera and microphone permissions
   */
  const requestPermissions = async () => {
    try {
      // Request camera permission
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      
      // Request microphone permission
      const audioPermission = await Audio.requestPermissionsAsync();
      
      if (cameraPermission.status === 'granted' && audioPermission.status === 'granted') {
        setHasPermissions(true);
        return true;
      } else {
        Alert.alert(
          'Permissions Required',
          'Camera and microphone permissions are required for live streaming.',
          [{ text: 'OK' }]
        );
        setHasPermissions(false);
        return false;
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions');
      return false;
    }
  };

  /**
   * Initialize Agora RTC Engine
   */
  const initializeAgora = async () => {
    try {
      if (agoraEngineRef.current) {
        console.log('Agora engine already initialized');
        return;
      }

      if (!createAgoraRtcEngine) {
        throw new Error('Agora SDK not loaded');
      }

      // Create Agora RTC Engine instance using modern API
      console.log('🎬 Creating Agora engine with APP ID:', AGORA_APP_ID.substring(0, 8) + '...');
      const engine = createAgoraRtcEngine();
      console.log('🎬 Initializing Agora SDK...');
      await engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      console.log('✅ Agora SDK initialized successfully');
      agoraEngineRef.current = engine;

      // Enable video module
      await engine.enableVideo();
      
      // Enable audio module
      await engine.enableAudio();

      // Set client role to broadcaster
      await engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      // Register event handlers
      engine.addListener('onJoinChannelSuccess', (connection, elapsed) => {
        console.log('Successfully joined channel:', connection.channelId);
        setConnectionState({
          status: 'connected',
          message: 'Live streaming started'
        });
        setIsStreaming(true);
      });

      engine.addListener('onUserJoined', (connection, remoteUid, elapsed) => {
        console.log('User joined:', remoteUid);
        setViewerCount(prev => prev + 1);
      });

      engine.addListener('onUserOffline', (connection, remoteUid, reason) => {
        console.log('User left:', remoteUid);
        setViewerCount(prev => Math.max(0, prev - 1));
      });

      engine.addListener('onError', (error) => {
        console.error('🚨 Agora error code:', error);
        console.error('🚨 Error details:', {
          errorCode: error,
          appId: AGORA_APP_ID,
          message: error === 110 ? 'ERR_NOT_INITIALIZED or INVALID_APP_ID - Check Agora Console' : 
                   error === 17 ? 'ERR_JOIN_CHANNEL_REJECTED - Token required or invalid' :
                   `Error code: ${error}`
        });
        console.error('Agora error:', error);
        setConnectionState({
          status: 'failed',
          message: `Error: ${error}`
        });
      });

      engine.addListener('onConnectionStateChanged', (connection, state, reason) => {
        console.log('Connection state changed:', state, 'Reason:', reason);
      });

      setIsInitialized(true);
      console.log('Agora engine initialized successfully');
    } catch (error) {
      console.error('Error initializing Agora:', error);
      Alert.alert('Initialization Error', 'Failed to initialize streaming engine');
      setConnectionState({
        status: 'failed',
        message: 'Failed to initialize'
      });
    }
  };

  /**
   * Start livestream - join Agora channel
   */
  const startLiveStream = async () => {
    try {
      if (!agoraEngineRef.current) {
        throw new Error('Agora engine not initialized');
      }

      setConnectionState({
        status: 'connecting',
        message: 'Starting livestream...'
      });

      // Notify backend that stream is starting and get Agora token
      const token = await getAccessToken();
      let agoraToken = null;
      
      if (token) {
        try {
          // Get Agora RTC token from backend
          console.log('📡 Requesting Agora token from backend...');
          const tokenResponse = await axios.post(
            `${API_URL}/api/agora/token/broadcaster`,
            { channelName, uid: 0 },
            { headers: { Authorization: token } }
          );
          
          agoraToken = tokenResponse.data.token;
          console.log('✅ Received Agora token from backend');
          
          // Update streaming status in backend
          await axios.post(
            `${API_URL}/api/shops/${shopId}/streaming-status`,
            { isStreaming: true },
            { headers: { Authorization: token } }
          );
          console.log('✅ Backend notified of stream start');
        } catch (error) {
          console.error('❌ Error getting Agora token:', error);
          Alert.alert('Token Error', 'Failed to get streaming token. Please try again.');
          setConnectionState({
            status: 'failed',
            message: 'Failed to get token'
          });
          return;
        }
      } else {
        Alert.alert('Authentication Error', 'Please log in again');
        return;
      }

      // Join the Agora channel with server-generated token
      console.log('🎯 Joining channel with secure token...');
      await agoraEngineRef.current.joinChannel(
        agoraToken, // Server-generated secure token
        channelName,
        0 // User ID (0 for auto-assignment)
      );

      console.log('Joining channel:', channelName);

      // Connect WebSocket for viewer count updates
      connectViewerCountWebSocket();
    } catch (error) {
      console.error('Error starting livestream:', error);
      Alert.alert('Stream Error', 'Failed to start livestream');
      setConnectionState({
        status: 'failed',
        message: 'Failed to start stream'
      });
    }
  };

  /**
   * Connect WebSocket to listen for viewer count updates
   */
  const connectViewerCountWebSocket = async () => {
    console.log('📊 [VIEWER COUNT] Connecting to WebSocket for channel:', channelName);
    
    // Get authentication token (same as working shop orders WebSocket)
    let token;
    try {
      token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }
      if (!token) {
        console.log('❌ [VIEWER COUNT] No token available for WebSocket connection');
        return;
      }
    } catch (error) {
      console.error('❌ [VIEWER COUNT] Error getting token:', error);
      return;
    }

    // Use SockJS like the working shop orders WebSocket
    const wsUrl = API_URL + '/ws';
    console.log('🔗 [VIEWER COUNT] WebSocket URL:', wsUrl);
    const socket = new SockJS(wsUrl);
    
    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        'Authorization': token
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      
      onConnect: () => {
        console.log('📊 Viewer count WebSocket connected');
        
        // Subscribe to viewer count updates for this channel
        client.subscribe(`/topic/livestream/${channelName}/viewers`, (message) => {
          const data = JSON.parse(message.body);
          setViewerCount(data.viewerCount);
          console.log('Updated viewer count:', data.viewerCount);
        });
      },
      
      onDisconnect: () => {
        console.log('📊 Viewer count WebSocket disconnected');
      },
      
      onStompError: (frame) => {
        console.error('Viewer count WebSocket error:', frame);
      }
    });

    client.activate();
    viewerWebSocketRef.current = client;
  };

  /**
   * Disconnect viewer count WebSocket
   */
  const disconnectViewerCountWebSocket = () => {
    if (viewerWebSocketRef.current) {
      viewerWebSocketRef.current.deactivate();
      viewerWebSocketRef.current = null;
    }
  };

  /**
   * Stop livestream - leave Agora channel
   */
  const stopLiveStream = async () => {
    try {
      if (!agoraEngineRef.current) {
        return;
      }

      setConnectionState({
        status: 'disconnected',
        message: 'Stopping stream...'
      });

      // Leave the channel
      await agoraEngineRef.current.leaveChannel();
      
      // Disconnect viewer count WebSocket
      disconnectViewerCountWebSocket();
      
      // Notify backend that stream has ended
      const token = await getAccessToken();
      if (token) {
        try {
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
          console.log('Backend notified of stream end');
        } catch (error) {
          console.error('Error notifying backend:', error);
        }
      }

      setIsStreaming(false);
      setViewerCount(0);
      setConnectionState({
        status: 'idle',
        message: 'Stream ended'
      });
      
      // Call parent callback
      onEndStream();
    } catch (error) {
      console.error('Error stopping livestream:', error);
      Alert.alert('Error', 'Failed to stop livestream properly');
    }
  };

  /**
   * Toggle between front and back camera
   */
  const toggleCamera = async () => {
    try {
      if (!agoraEngineRef.current) {
        return;
      }

      await agoraEngineRef.current.switchCamera();
      setIsFrontCamera(!isFrontCamera);
      console.log('Camera switched to:', !isFrontCamera ? 'front' : 'back');
    } catch (error) {
      console.error('Error switching camera:', error);
      Alert.alert('Error', 'Failed to switch camera');
    }
  };

  /**
   * Toggle microphone mute/unmute
   */
  const toggleMute = async () => {
    try {
      if (!agoraEngineRef.current) {
        return;
      }

      const newMuteState = !isMuted;
      await agoraEngineRef.current.muteLocalAudioStream(newMuteState);
      setIsMuted(newMuteState);
      console.log('Microphone', newMuteState ? 'muted' : 'unmuted');
    } catch (error) {
      console.error('Error toggling mute:', error);
      Alert.alert('Error', 'Failed to toggle microphone');
    }
  };

  /**
   * Cleanup on component unmount
   */
  const cleanup = async () => {
    try {
      if (agoraEngineRef.current) {
        // Leave channel if still in one
        if (isStreaming) {
          await agoraEngineRef.current.leaveChannel();
        }
        
        // Remove all listeners
        agoraEngineRef.current.removeAllListeners();
        
        // Release and destroy engine
        await agoraEngineRef.current.release();
        agoraEngineRef.current = null;
        
        console.log('Agora engine cleaned up');
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  /**
   * Initialize on component mount
   */
  useEffect(() => {
    const initialize = async () => {
      const permissionsGranted = await requestPermissions();
      if (permissionsGranted) {
        await initializeAgora();
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  /**
   * Handle end stream confirmation
   */
  const handleEndStream = () => {
    Alert.alert(
      'End Livestream',
      'Are you sure you want to end this livestream?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Stream', 
          style: 'destructive',
          onPress: stopLiveStream 
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: isStreaming ? '#FF0000' : '#666' }
          ]} />
          <Text style={styles.headerText}>
            {isStreaming ? 'LIVE' : shopName}
          </Text>
        </View>
        <View style={styles.headerControls}>
          <View style={styles.viewerCount}>
            <Ionicons name="eye" size={20} color="#fff" />
            <Text style={styles.viewerCountText}>{viewerCount}</Text>
          </View>
          
          {/* Camera flip button */}
          {isStreaming && (
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={toggleCamera}
            >
              <Ionicons name="camera-reverse" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          
          {/* Mute button */}
          {isStreaming && (
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={toggleMute}
            >
              <Ionicons 
                name={isMuted ? 'mic-off' : 'mic'} 
                size={24} 
                color={isMuted ? '#FF0000' : '#fff'} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Video Preview */}
      <View style={styles.videoContainer}>
        {!hasPermissions ? (
          <View style={styles.permissionContainer}>
            <Ionicons name="videocam-off" size={60} color="#BC4A4D" />
            <Text style={styles.permissionText}>Camera and microphone permissions required</Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
              <Text style={styles.permissionButtonText}>Grant Permissions</Text>
            </TouchableOpacity>
          </View>
        ) : !isInitialized ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#BC4A4D" />
            <Text style={styles.loadingText}>Initializing camera...</Text>
          </View>
        ) : (
          <>
            {/* Local video view (broadcaster's camera) */}
            <RtcSurfaceView
              canvas={{
                sourceType: VideoSourceType.VideoSourceCameraPrimary,
                uid: 0,
              }}
              style={styles.videoView}
            />
            
            {/* Connection status overlay */}
            {connectionState.status === 'connecting' && (
              <View style={styles.statusOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.statusText}>{connectionState.message}</Text>
              </View>
            )}
            
            {/* End Stream button - upper right corner */}
            {isStreaming && (
              <TouchableOpacity 
                style={styles.endStreamButton}
                onPress={handleEndStream}
              >
                <Ionicons name="stop-circle" size={28} color="#fff" />
                <Text style={styles.endStreamText}>End Stream</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Chat at bottom (only when streaming) */}
      {isStreaming && (
        <View style={styles.chatContainer}>
          <LivestreamChat 
            channelName={channelName}
            isBroadcaster={true}
            shopName={shopName}
          />
        </View>
      )}

      {/* Start/Stop streaming button */}
      {!isStreaming && (
        <View style={styles.controls}>
          <View style={styles.mainControlContainer}>
            <TouchableOpacity
              style={[styles.mainButton, styles.startButton]}
              onPress={startLiveStream}
              disabled={!isInitialized || !hasPermissions}
            >
              <Ionicons name="play-circle" size={32} color="#fff" />
              <Text style={styles.mainButtonText}>Start Livestream</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  viewerCountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoView: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endStreamButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 20 : 16,
    right: 16,
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
  },
  endStreamText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chatContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  controls: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 20,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  mainControlContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    minWidth: 200,
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusMessage: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
  },
  expoGoWarning: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1a1a1a',
  },
  expoGoTitle: {
    color: '#FFA726',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
  },
  expoGoMessage: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  instructionsList: {
    marginTop: 16,
    marginBottom: 24,
    alignSelf: 'stretch',
    paddingHorizontal: 20,
  },
  instructionItem: {
    color: '#ddd',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LiveStreamBroadcaster; 