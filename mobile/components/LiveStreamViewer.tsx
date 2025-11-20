import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useAuthentication } from '../services/authService';
import { API_URL } from '../config';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { RTCView, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import { webrtcSignalingService, SignalingMessage } from '../services/webrtcSignalingService';

interface LiveStreamViewerProps {
  shopId: string;
  onClose: () => void;
  shopName?: string;
}

const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({ shopId, onClose, shopName = 'Shop' }) => {
  const [isStreamActive, setIsStreamActive] = useState(false);
  const { getAccessToken } = useAuthentication();
  const [viewerId] = useState<string>('viewer-' + Math.random().toString(36).substring(2, 9));
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    initializeViewer();

    return () => {
      cleanup();
    };
  }, [shopId]);

  /**
   * Initialize viewer connection
   */
  const initializeViewer = async () => {
    try {
      setIsLoading(true);
      const token = await getAccessToken();

      if (!token) {
        setError('Authentication required');
        setIsLoading(false);
        return;
      }

      // Check if shop is streaming
      const statusResponse = await axios.get(
        `${API_URL}/api/shops/${shopId}/streaming-status`,
        { headers: { Authorization: token } }
      );

      if (!statusResponse.data?.isStreaming) {
        setError('This shop is not currently streaming');
        setIsLoading(false);
        return;
      }

      // Setup signaling
      await setupSignaling(token);
    } catch (error: any) {
      console.error('Error initializing viewer:', error);
      setError(error.response?.status === 404 
        ? 'Stream not available' 
        : 'Failed to connect to stream');
      setIsLoading(false);
    }
  };

  /**
   * Setup WebRTC signaling
   */
  const setupSignaling = async (token: string) => {
    try {
      // Connect to signaling server
      await webrtcSignalingService.connect(token);

      // Setup callbacks
      webrtcSignalingService.onMessage(handleSignalingMessage);
      webrtcSignalingService.onConnectionChange((connected) => {
        setConnectionStatus(connected ? 'Connected' : 'Disconnected');
        if (!connected) {
          setError('Connection lost');
        }
      });

      // Join as viewer
      webrtcSignalingService.joinAsViewer(shopId, viewerId);

      // Create peer connection
      await createPeerConnection();

      setIsLoading(false);
    } catch (error) {
      console.error('Error setting up signaling:', error);
      setError('Failed to connect to signaling server');
      setIsLoading(false);
    }
  };

  /**
   * Handle incoming signaling messages
   */
  const handleSignalingMessage = async (message: SignalingMessage) => {
    console.log('📨 Viewer received:', message.type);

    switch (message.type) {
      case 'offer':
        if (message.data && peerConnection.current) {
          await handleOffer(message.data);
        }
        break;

      case 'ice-candidate':
        if (message.data && peerConnection.current) {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(message.data)
          );
        }
        break;

      case 'stream-ended':
        setError('Stream has ended');
        setIsStreamActive(false);
        cleanup();
        break;
    }
  };

  /**
   * Create peer connection
   */
  const createPeerConnection = async () => {
    try {
      const pc = new RTCPeerConnection(iceServers);

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📹 Received remote track');
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          setIsStreamActive(true);
          setConnectionStatus('Streaming');
        }
      };

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

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setConnectionStatus('Connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnectionStatus('Disconnected');
          setError('Connection lost');
        }
      };

      peerConnection.current = pc;
      console.log('✅ Created peer connection');
    } catch (error) {
      console.error('Error creating peer connection:', error);
      setError('Failed to setup connection');
    }
  };

  /**
   * Handle offer from broadcaster
   */
  const handleOffer = async (offer: any) => {
    try {
      if (!peerConnection.current) return;

      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      webrtcSignalingService.sendMessage({
        type: 'answer',
        data: answer,
        shopId,
        viewerId,
      });

      console.log('📤 Sent answer to broadcaster');
    } catch (error) {
      console.error('Error handling offer:', error);
      setError('Failed to establish connection');
    }
  };

  /**
   * Cleanup resources
   */
  const cleanup = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    webrtcSignalingService.leave();
    webrtcSignalingService.disconnect();
    setRemoteStream(null);
  };
  
  /**
   * Retry connection
   */
  const retryConnection = () => {
    setError(null);
    setIsLoading(true);
    cleanup();
    initializeViewer();
  };

  return (
    <View style={styles.container}>
      {/* Header with shop name */}
      <View style={styles.header}>
        <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, {
            backgroundColor: connectionStatus === 'Streaming' || connectionStatus === 'Connected' 
              ? '#10b981' 
              : '#ef4444'
          }]} />
          <Text style={styles.statusText}>{connectionStatus}</Text>
        </View>
      </View>
      
      {/* Stream View */}
      <View style={styles.streamContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#BC4A4D" />
            <Text style={styles.loadingText}>Connecting to stream...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={50} color="#FFA500" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={retryConnection}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : remoteStream && isStreamActive ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.videoView}
            objectFit="cover"
          />
        ) : (
          <View style={styles.offlineContainer}>
            <Ionicons name="videocam-off" size={50} color="#666" />
            <Text style={styles.offlineText}>Waiting for stream...</Text>
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
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  videoView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
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
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: 'white',
    fontSize: 18,
    marginTop: 15,
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