import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, ActivityIndicator, Modal, Alert, Animated } from 'react-native';
import { useAuthentication } from '../services/authService';
import { API_URL } from '../config';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

// WebRTC - only available in production builds
let RTCPeerConnection: any = null;
let RTCView: any = null;
let RTCIceCandidate: any = null;
let RTCSessionDescription: any = null;
let isWebRTCAvailable = false;

try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCView = webrtc.RTCView;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  isWebRTCAvailable = true;
} catch (e) {
  console.log('⚠️ WebRTC not available in viewer (Expo Go)');
}

interface LiveStreamViewerProps {
  shopId: string;
  onClose: () => void;
  shopName?: string;
  hideHeader?: boolean;
  hideCloseButton?: boolean;
}

const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({ shopId, onClose, shopName = 'Shop', hideHeader = false, hideCloseButton = false }) => {
  const [isStreamActive, setIsStreamActive] = useState(false);
  const { getAccessToken } = useAuthentication();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string>('phone-camera');
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  // WebRTC configuration
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    // Use a generic user ID for tracking
    const viewerId = 'viewer-' + Math.random().toString(36).substring(2, 7);
    setUserId(viewerId);
    
    // Check if stream is active and connect to WebRTC
    checkStreamStatus();
    
    // Start pulse animation for live indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Cleanup on unmount
    return () => {
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
    };
  }, [shopId]);
  
  const checkStreamStatus = async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      console.log('Checking stream status for shopId:', shopId);
      
      // Check if the shop is currently streaming
      const response = await axios.get(
        `${API_URL}/api/shops/${shopId}/streaming-status`,
        { headers: token ? { Authorization: token } : {} }
      );
      
      console.log('Stream status response:', response.data);
      
      if (response.data && response.data.isStreaming) {
        setIsStreamActive(true);
        setStreamType(response.data.streamType || 'phone-camera');
        
        // Get WebRTC offer and start connection
        await connectToStream(token);
      } else {
        setIsStreamActive(false);
        setError('This shop is not currently streaming');
      }
    } catch (error: any) {
      console.error('Error checking stream status:', error);
      setError('Unable to check stream status');
      setIsStreamActive(false);
    } finally {
      setIsLoading(false);
    }
  };

  const connectToStream = async (token: string | null) => {
    if (!isWebRTCAvailable || !RTCPeerConnection) {
      console.log('⚠️ WebRTC not available - status only mode');
      setError('WebRTC requires production build. Stream status shown only.');
      return;
    }

    try {
      console.log('🔌 Connecting to WebRTC stream for shop:', shopId);

      // Get the WebRTC offer from the broadcaster
      const offerResponse = await axios.get(
        `${API_URL}/api/webrtc/offer/${shopId}`,
        { headers: token ? { Authorization: token } : {} }
      );

      if (!offerResponse.data.success || !offerResponse.data.offer) {
        console.log('❌ No WebRTC offer available');
        setError('Stream is not available yet');
        return;
      }

      console.log('📡 Received WebRTC offer');

      // Create peer connection
      const pc = new RTCPeerConnection(configuration);
      peerConnection.current = pc;

      // Handle incoming stream
      pc.onaddstream = (event: any) => {
        console.log('📹 Received remote stream!');
        setRemoteStream(event.stream);
      };

      // Handle ICE candidates from broadcaster
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('🧊 Sending viewer ICE candidate');
          try {
            await axios.post(
              `${API_URL}/api/webrtc/ice-candidate/viewer`,
              {
                shopId,
                viewerId: userId,
                candidate: {
                  candidate: event.candidate.candidate,
                  sdpMLineIndex: event.candidate.sdpMLineIndex,
                  sdpMid: event.candidate.sdpMid,
                },
              },
              { headers: token ? { Authorization: token } : {} }
            );
          } catch (error) {
            console.error('Error sending ICE candidate:', error);
          }
        }
      };

      // Set remote description (offer)
      const offer = new RTCSessionDescription(offerResponse.data.offer);
      await pc.setRemoteDescription(offer);

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('📡 Sending answer to broadcaster');

      // Send answer to broadcaster
      await axios.post(
        `${API_URL}/api/webrtc/answer`,
        {
          shopId,
          viewerId: userId,
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
        },
        { headers: token ? { Authorization: token } : {} }
      );

      console.log('✅ WebRTC connection established');
    } catch (error) {
      console.error('Error connecting to stream:', error);
      setError('Failed to connect to stream');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with shop name */}
      {!hideHeader && (
        <View style={styles.header}>
          <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        </View>
      )}
      
      {/* Stream View */}
      <View style={styles.streamContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#BC4A4D" />
            <Text style={styles.loadingText}>Checking stream status...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="videocam-off" size={64} color="#999" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={checkStreamStatus}
            >
              <Text style={styles.retryButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : isStreamActive ? (
          <View style={styles.activeStreamContainer}>
            {/* Live indicator with animation */}
            <View style={styles.liveIndicatorContainer}>
              <Animated.View 
                style={[
                  styles.livePulse, 
                  { transform: [{ scale: pulseAnim }] }
                ]} 
              />
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>

            {/* Video Stream or Placeholder */}
            {isWebRTCAvailable && remoteStream && RTCView ? (
              <RTCView
                streamURL={remoteStream.toURL()}
                style={styles.videoStream}
                objectFit="cover"
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <View style={styles.cameraIconContainer}>
                  <Ionicons name="videocam" size={120} color="rgba(188, 74, 77, 0.3)" />
                  <View style={styles.recordingIndicator}>
                    <Animated.View 
                      style={[
                        styles.recordingDot,
                        { opacity: pulseAnim.interpolate({
                          inputRange: [1, 1.2],
                          outputRange: [0.5, 1]
                        }) }
                      ]} 
                    />
                  </View>
                </View>
                
                <Text style={styles.streamActiveText}>{shopName} is Live!</Text>
                <Text style={styles.streamTypeText}>
                  📱 Streaming from {streamType === 'phone-camera' ? 'Shop Owner\'s Phone' : 'Camera'}
                </Text>
                
                {!isWebRTCAvailable && (
                  <View style={styles.devModeBox}>
                    <Ionicons name="information-circle" size={24} color="#FFA500" />
                    <Text style={styles.devModeText}>
                      Video streaming requires a production build.{' '}\n
                      This will work when deployed via GitHub Actions.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.offlineContainer}>
            <Ionicons name="videocam-off-outline" size={64} color="#666" />
            <Text style={styles.offlineText}>Stream is offline</Text>
            <Text style={styles.offlineSubText}>
              The shop is not currently broadcasting
            </Text>
          </View>
        )}
      </View>
      
      {/* Bottom Close Button */}
      {!hideCloseButton && (
        <View style={styles.closeButtonContainer}>
          <TouchableOpacity style={styles.closeStreamButton} onPress={onClose}>
            <Ionicons name="close-circle" size={24} color="#fff" />
            <Text style={styles.closeStreamButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  streamContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeStreamContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  liveIndicatorContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  livePulse: {
    position: 'absolute',
    width: 100,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
    top: 0,
    left: 0,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  liveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  streamContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  videoStream: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cameraIconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  streamActiveText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  streamTypeText: {
    color: '#999',
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  infoBox: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.3)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: '100%',
  },
  infoIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    color: '#FFA500',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  featureStatus: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  featureText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  offlineText: {
    color: '#999',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
  },
  offlineSubText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  closeButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeStreamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  closeStreamButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  devModeBox: {
    marginTop: 30,
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.4)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    maxWidth: '90%',
  },
  devModeText: {
    color: '#FFA500',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
});

export default LiveStreamViewer;