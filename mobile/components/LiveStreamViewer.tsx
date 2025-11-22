import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

interface LiveStreamViewerProps {
  shopId: string;
  onClose: () => void;
  shopName?: string;
}

interface ConnectionState {
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';
  message: string;
}

const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({ 
  shopId, 
  onClose, 
  shopName = 'Shop' 
}) => {
  // Show Expo Go warning if Agora is not available
  if (!createAgoraRtcEngine || isExpoGo) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>{shopName} - Live Stream</Text>
          <View style={{ width: 28 }} />
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
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
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
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'idle',
    message: 'Connecting to stream...'
  });
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isStreamActive, setIsStreamActive] = useState(false);
  
  const { getAccessToken } = useAuthentication();

  // Channel name derived from shopId (must match broadcaster's channel)
  const channelName = `shop_${shopId}`;

  /**
   * Initialize Agora RTC Engine for viewer
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

      // Set client role to audience (viewer)
      await engine.setClientRole(ClientRoleType.ClientRoleAudience);

      // Register event handlers
      engine.addListener('onJoinChannelSuccess', (connection, elapsed) => {
        console.log('Successfully joined channel as viewer:', connection.channelId);
        setConnectionState({
          status: 'connected',
          message: 'Connected to livestream'
        });
        setIsConnected(true);
      });

      engine.addListener('onUserJoined', (connection, uid, elapsed) => {
        console.log('Broadcaster joined:', uid);
        setRemoteUid(uid);
        setIsStreamActive(true);
        setConnectionState({
          status: 'connected',
          message: 'Watching livestream'
        });
      });

      engine.addListener('onUserOffline', (connection, uid, reason) => {
        console.log('Broadcaster left:', uid, 'Reason:', reason);
        if (uid === remoteUid) {
          setRemoteUid(null);
          setIsStreamActive(false);
          setConnectionState({
            status: 'disconnected',
            message: 'Stream ended by broadcaster'
          });
        }
      });

      engine.addListener('onError', (error) => {
        console.error('🚨 Agora viewer error code:', error);
        console.error('🚨 Error details:', {
          errorCode: error,
          appId: AGORA_APP_ID.substring(0, 8) + '...',
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
      console.log('Agora engine initialized successfully for viewer');
    } catch (error) {
      console.error('Error initializing Agora:', error);
      Alert.alert('Initialization Error', 'Failed to initialize streaming viewer');
      setConnectionState({
        status: 'failed',
        message: 'Failed to initialize'
      });
    }
  };

  /**
   * Join livestream channel as viewer
   */
  const joinLiveStream = async () => {
    try {
      if (!agoraEngineRef.current) {
        throw new Error('Agora engine not initialized');
      }

      setConnectionState({
        status: 'connecting',
        message: 'Joining livestream...'
      });

      // Check if stream is active on backend
      const token = await getAccessToken();
      if (token) {
        try {
          const response = await axios.get(
            `${API_URL}/api/shops/${shopId}/streaming-status`,
            { headers: { Authorization: token } }
          );
          
          if (!response.data?.isStreaming) {
            setConnectionState({
              status: 'disconnected',
              message: 'Stream is not currently active'
            });
            setIsStreamActive(false);
            return;
          }
        } catch (error) {
          console.error('Error checking stream status:', error);
          // Continue anyway - stream might still be active
        }
      }

      // Get Agora RTC token from backend
      const authToken = await getAccessToken();
      let agoraToken = null;
      
      if (authToken) {
        try {
          console.log('📡 Requesting viewer token from backend...');
          const tokenResponse = await axios.post(
            `${API_URL}/api/agora/token/viewer`,
            { channelName, uid: 0 },
            { headers: { Authorization: authToken } }
          );
          
          agoraToken = tokenResponse.data.token;
          console.log('✅ Received viewer token from backend');
        } catch (error) {
          console.error('❌ Error getting Agora token:', error);
          Alert.alert('Token Error', 'Failed to get streaming token');
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

      // Join the Agora channel as audience with secure token
      console.log('🎯 Joining channel as viewer with secure token...');
      await agoraEngineRef.current.joinChannel(
        agoraToken, // Server-generated secure token
        channelName,
        0 // User ID (0 for auto-assignment)
      );

      console.log('Joining channel as viewer:', channelName);
    } catch (error) {
      console.error('Error joining livestream:', error);
      Alert.alert('Connection Error', 'Failed to join livestream');
      setConnectionState({
        status: 'failed',
        message: 'Failed to join stream'
      });
    }
  };

  /**
   * Leave livestream channel
   */
  const leaveLiveStream = async () => {
    try {
      if (!agoraEngineRef.current) {
        return;
      }

      await agoraEngineRef.current.leaveChannel();
      
      setIsConnected(false);
      setRemoteUid(null);
      setIsStreamActive(false);
      setConnectionState({
        status: 'disconnected',
        message: 'Left the livestream'
      });
      
      console.log('Left the livestream channel');
    } catch (error) {
      console.error('Error leaving livestream:', error);
    }
  };

  /**
   * Toggle audio mute/unmute for viewer
   */
  const toggleMute = async () => {
    try {
      if (!agoraEngineRef.current) {
        return;
      }

      const newMuteState = !isMuted;
      await agoraEngineRef.current.muteAllRemoteAudioStreams(newMuteState);
      setIsMuted(newMuteState);
      console.log('Audio', newMuteState ? 'muted' : 'unmuted');
    } catch (error) {
      console.error('Error toggling mute:', error);
      Alert.alert('Error', 'Failed to toggle audio');
    }
  };

  /**
   * Cleanup on component unmount
   */
  const cleanup = async () => {
    try {
      if (agoraEngineRef.current) {
        // Leave channel if still in one
        if (isConnected) {
          await agoraEngineRef.current.leaveChannel();
        }
        
        // Remove all listeners
        agoraEngineRef.current.removeAllListeners();
        
        // Destroy engine
        await agoraEngineRef.current.release();
        agoraEngineRef.current = null;
        
        console.log('Agora engine cleaned up');
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  /**
   * Initialize and join on component mount
   */
  useEffect(() => {
    const initialize = async () => {
      await initializeAgora();
      // Small delay to ensure engine is ready
      setTimeout(() => {
        joinLiveStream();
      }, 500);
    };

    initialize();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [shopId]);

  /**
   * Handle close with cleanup
   */
  const handleClose = async () => {
    await leaveLiveStream();
    onClose();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Video View */}
      <View style={styles.videoContainer}>
        {!isInitialized ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#BC4A4D" />
            <Text style={styles.loadingText}>Initializing...</Text>
          </View>
        ) : !isStreamActive && remoteUid === null ? (
          <View style={styles.offlineContainer}>
            {connectionState.status === 'connecting' ? (
              <>
                <ActivityIndicator size="large" color="#BC4A4D" />
                <Text style={styles.offlineText}>{connectionState.message}</Text>
              </>
            ) : connectionState.status === 'failed' ? (
              <>
                <Ionicons name="alert-circle" size={60} color="#FF6B6B" />
                <Text style={styles.offlineText}>Connection Failed</Text>
                <Text style={styles.offlineSubtext}>{connectionState.message}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => {
                    setConnectionState({
                      status: 'connecting',
                      message: 'Retrying...'
                    });
                    joinLiveStream();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="videocam-off" size={60} color="#888" />
                <Text style={styles.offlineText}>Stream Not Available</Text>
                <Text style={styles.offlineSubtext}>
                  {connectionState.message}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={joinLiveStream}>
                  <Text style={styles.retryButtonText}>Check Again</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <>
            {/* Remote video view (broadcaster's stream) */}
            {remoteUid !== null && (
              <RtcSurfaceView
                canvas={{
                  sourceType: VideoSourceType.VideoSourceRemote,
                  uid: remoteUid,
                }}
                style={styles.videoView}
              />
            )}
            
            {/* Live indicator */}
            {isStreamActive && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveRedDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.muteButton}
          onPress={toggleMute}
          disabled={!isStreamActive}
        >
          <Ionicons 
            name={isMuted ? 'volume-mute' : 'volume-high'} 
            size={28} 
            color={isStreamActive ? (isMuted ? '#FF0000' : '#fff') : '#666'} 
          />
          <Text style={styles.controlLabel}>
            {isMuted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeStreamButton} onPress={handleClose}>
          <Ionicons name="close-circle" size={24} color="#fff" />
          <Text style={styles.closeStreamButtonText}>Close</Text>
        </TouchableOpacity>
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
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 20,
  },
  offlineText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  offlineSubtext: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  liveIndicator: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  liveRedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF0000',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  controls: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  muteButton: {
    alignItems: 'center',
    padding: 10,
  },
  controlLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  closeStreamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  closeStreamButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
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

export default LiveStreamViewer;