import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import { AGORA_APP_ID, API_URL } from '../config';
import { useAuthentication } from '../services/authService';
import axios from 'axios';

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
      const engine = createAgoraRtcEngine();
      await engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
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

      // Notify backend that stream is starting
      const token = await getAccessToken();
      if (token) {
        try {
          // Update streaming status in backend
          await axios.post(
            `${API_URL}/api/shops/${shopId}/streaming-status`,
            { isStreaming: true },
            { headers: { Authorization: token } }
          );

          // Start stream session
          const response = await axios.post(
            `${API_URL}/api/streams/start`,
            { shopId, channelName },
            { headers: { Authorization: token } }
          );
          
          setStreamId(response.data.streamId);
          console.log('Backend notified of stream start');
        } catch (error) {
          console.error('Error notifying backend:', error);
          // Continue with stream even if backend notification fails
        }
      }

      // Join the Agora channel
      // For production, generate token on server-side
      // For development, passing null works if App Certificate is not enforced
      await agoraEngineRef.current.joinChannel(
        null, // Token (null for testing, use server-generated token in production)
        channelName,
        0 // User ID (0 for auto-assignment)
      );

      console.log('Joining channel:', channelName);
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
            {shopName} - {isStreaming ? 'LIVE' : 'Not Streaming'}
          </Text>
        </View>
        <View style={styles.viewerCount}>
          <Ionicons name="eye" size={20} color="#fff" />
          <Text style={styles.viewerCountText}>{viewerCount}</Text>
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
          </>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.topControls}>
          {/* Camera flip button */}
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={toggleCamera}
            disabled={!isStreaming}
          >
            <Ionicons 
              name="camera-reverse" 
              size={28} 
              color={isStreaming ? '#fff' : '#666'} 
            />
            <Text style={styles.controlLabel}>Flip</Text>
          </TouchableOpacity>

          {/* Mute button */}
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={toggleMute}
            disabled={!isStreaming}
          >
            <Ionicons 
              name={isMuted ? 'mic-off' : 'mic'} 
              size={28} 
              color={isStreaming ? (isMuted ? '#FF0000' : '#fff') : '#666'} 
            />
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
        </View>

        {/* Start/Stop streaming button */}
        <View style={styles.mainControlContainer}>
          {!isStreaming ? (
            <TouchableOpacity
              style={[styles.mainButton, styles.startButton]}
              onPress={startLiveStream}
              disabled={!isInitialized || !hasPermissions}
            >
              <Ionicons name="play-circle" size={32} color="#fff" />
              <Text style={styles.mainButtonText}>Start Livestream</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.mainButton, styles.stopButton]}
              onPress={handleEndStream}
            >
              <Ionicons name="stop-circle" size={32} color="#fff" />
              <Text style={styles.mainButtonText}>End Livestream</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status message */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusMessage}>{connectionState.message}</Text>
        </View>
      </View>
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
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  controlButton: {
    alignItems: 'center',
    padding: 10,
  },
  controlLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
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