import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TextInput, TouchableOpacity, Keyboard, Modal, ActivityIndicator, Animated, Alert, Platform, FlatList, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthentication } from '../services/authService';
import { API_URL } from '../config';
import axios from 'axios';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

// WebRTC - only available in production builds, not Expo Go
let RTCPeerConnection: any = null;
let RTCView: any = null;
let mediaDevices: any = null;
let RTCIceCandidate: any = null;
let RTCSessionDescription: any = null;
let isWebRTCAvailable = false;

try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCView = webrtc.RTCView;
  mediaDevices = webrtc.mediaDevices;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  isWebRTCAvailable = true;
  console.log('✅ WebRTC available (Production Build)');
} catch (e) {
  console.log('⚠️ WebRTC not available (Expo Go - will work in production build)');
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
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEndingStream, setIsEndingStream] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [localStream, setLocalStream] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const cameraRef = useRef<any>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const stompClient = useRef<Client | null>(null);
  const chatScrollRef = useRef<FlatList>(null);
  const { getAccessToken } = useAuthentication();

  // WebRTC configuration with STUN servers
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    // Check camera permissions on mount
    if (!permission) {
      return;
    }
    
    if (!permission.granted) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      disconnectChat();
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
      }
    };
  }, [localStream]);

  useEffect(() => {
    if (isStreaming) {
      connectChat();
    } else {
      disconnectChat();
    }
  }, [isStreaming]);

  const connectChat = () => {
    try {
      const socket = new SockJS(`${API_URL}/ws`);
      const client = new Client({
        webSocketFactory: () => socket as any,
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      client.onConnect = () => {
        console.log('💬 Broadcaster chat connected');
        
        // Subscribe to chat messages
        client.subscribe(`/topic/stream/${shopId}/chat`, (message) => {
          const chatMessage = JSON.parse(message.body);
          console.log('💬 Broadcaster received message:', chatMessage);
          
          const newMessage = {
            id: Date.now().toString() + Math.random(),
            userId: chatMessage.userId,
            username: chatMessage.username,
            message: chatMessage.message,
            timestamp: new Date(chatMessage.timestamp)
          };
          
          console.log('➕ Broadcaster adding message:', newMessage);
          
          setMessages(prev => {
            const updated = [...prev, newMessage];
            console.log('📊 Broadcaster total messages:', updated.length);
            return updated;
          });
          
          // Auto-scroll
          setTimeout(() => {
            chatScrollRef.current?.scrollToEnd({ animated: true });
          }, 100);
        });
      };

      client.onStompError = (frame) => {
        console.error('Chat error:', frame);
      };

      client.activate();
      stompClient.current = client;
    } catch (error) {
      console.error('Error connecting chat:', error);
    }
  };

  const disconnectChat = () => {
    if (stompClient.current) {
      stompClient.current.deactivate();
      stompClient.current = null;
    }
    setMessages([]);
  };
  
  // Toggle camera between front and back
  const toggleCameraType = () => {
    setCameraType(current => (current === 'back' ? 'front' : 'back'));
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
      
      // Close peer connection
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }

      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
        setLocalStream(null);
      }
      
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

        // Remove WebRTC offer from signaling server
        await axios.delete(
          `${API_URL}/api/webrtc/offer/${shopId}`,
          { headers: { Authorization: token } }
        );
        
        console.log('Stream instance ended');
      }
      
      // Notify parent component
      onEndStream();
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

  // Start the livestream
  const startStream = async () => {
    try {
      // Check if WebRTC is available (production build)
      if (!isWebRTCAvailable) {
        Alert.alert(
          'Development Mode',
          'Live streaming with WebRTC requires a production build. This feature will work when you deploy the app via GitHub Actions.\n\nFor now, the stream status will be updated without video transmission.',
          [{ text: 'OK' }]
        );
        // Continue with status update only
      }

      // Check camera permissions first
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permission Required', 'Camera permission is required to start streaming.');
          return;
        }
      }

      const token = await getAccessToken();
      
      if (!token) {
        console.error('No authentication token available');
        Alert.alert('Error', 'Authentication required to start streaming.');
        return;
      }
      
      console.log('Starting stream with shopId:', shopId);
      
      // Only setup WebRTC if available (production build)
      if (isWebRTCAvailable && mediaDevices && RTCPeerConnection) {
        // Get camera media stream
        const stream = await mediaDevices.getUserMedia({
          video: {
            facingMode: cameraType === 'front' ? 'user' : 'environment',
            width: 1280,
            height: 720,
          },
          audio: true,
        });
        
        console.log('✅ Got media stream:', stream.id);
        setLocalStream(stream);

        // Create peer connection
        const pc = new RTCPeerConnection(configuration);
        peerConnection.current = pc;

        // Add stream tracks to peer connection
        stream.getTracks().forEach((track: any) => {
          pc.addTrack(track, stream);
          console.log('Added track:', track.kind);
        });

        // Handle ICE candidates
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            console.log('🧊 New ICE candidate:', event.candidate);
            try {
              await axios.post(
                `${API_URL}/api/webrtc/ice-candidate/broadcaster`,
                {
                  shopId,
                  candidate: {
                    candidate: event.candidate.candidate,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    sdpMid: event.candidate.sdpMid,
                  },
                },
                { headers: { Authorization: token } }
              );
            } catch (error) {
              console.error('Error sending ICE candidate:', error);
            }
          }
        };

        // Create and send offer
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        
        await pc.setLocalDescription(offer);
        console.log('📡 Created offer:', offer.type);
        
        // Send WebRTC offer to signaling server
        await axios.post(
          `${API_URL}/api/webrtc/offer`,
          {
            shopId,
            streamId: response.data.streamId,
            offer: {
              type: offer.type,
              sdp: offer.sdp,
            },
          },
          { headers: { Authorization: token } }
        );

        console.log('✅ WebRTC offer sent to server');
      } else {
        console.log('⚠️ WebRTC not available - status-only mode');
      }
      
      // Update the streaming status in the backend
      await axios.post(
        `${API_URL}/api/shops/${shopId}/streaming-status`,
        { isStreaming: true },
        { headers: { Authorization: token } }
      );
      
      // Start the stream session
      const response = await axios.post(
        `${API_URL}/api/streams/start`,
        { shopId, streamType: 'phone-camera' },
        { headers: { Authorization: token } }
      );
      
      console.log('Stream started successfully, response:', response.data);
      setStreamId(response.data.streamId);
      setIsStreaming(true);
      
      Alert.alert('Success', 'Live stream started! Your camera is now broadcasting.');
    } catch (error) {
      console.error('Error starting stream:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      Alert.alert('Error', 'Failed to start the stream. Please try again.');
    }
  };

  // Handle camera permission states
  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        </View>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color="#BC4A4D" />
          <Text style={styles.permissionText}>Loading camera...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        </View>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#BC4A4D" />
          <Text style={styles.permissionText}>Camera permission is required</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with shop name and controls */}
      <View style={styles.header}>
        <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        <View style={styles.headerButtons}>
          {isStreaming && (
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={endStream}
              disabled={isEndingStream}
            >
              <Ionicons name="stop-circle" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={onEndStream}
          >
            <Ionicons name="close-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Camera Stream View */}
      <View style={styles.streamContainer}>
        {isStreaming ? (
          <View style={styles.cameraContainer}>
            {isWebRTCAvailable && localStream && RTCView ? (
              <RTCView
                streamURL={localStream.toURL()}
                style={styles.camera}
                objectFit="cover"
                mirror={cameraType === 'front'}
              />
            ) : (
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={cameraType}
                onCameraReady={() => setIsCameraReady(true)}
              />
            )}
            {/* Live Indicator */}
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>

            {/* Camera Controls Overlay */}
            <View style={styles.cameraControls}>
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={toggleCameraType}
              >
                <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.controlButton, styles.chatButton]} 
                onPress={() => setShowChat(!showChat)}
              >
                <Ionicons name="chatbubbles" size={24} color="#fff" />
                {messages.length > 0 && (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>{messages.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            
            {/* Chat Overlay */}
            {showChat && (
              <View style={styles.chatOverlay}>
                <View style={styles.chatHeader}>
                  <Ionicons name="chatbubbles" size={18} color="#fff" />
                  <Text style={styles.chatHeaderText}>Live Chat ({messages.length})</Text>
                  <TouchableOpacity onPress={() => setShowChat(false)}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                {messages.length === 0 ? (
                  <View style={styles.emptyChatContainer}>
                    <Text style={styles.emptyChatText}>No messages yet</Text>
                  </View>
                ) : (
                  <FlatList
                    ref={chatScrollRef}
                    data={messages}
                    renderItem={({ item }) => (
                      <View style={styles.chatMessage}>
                        <Text style={styles.chatUsername}>{item.username}</Text>
                        <Text style={styles.chatMessageText}>{item.message}</Text>
                      </View>
                    )}
                    keyExtractor={item => item.id}
                    style={styles.chatMessages}
                    contentContainerStyle={{ paddingBottom: 10 }}
                    onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
                  />
                )}
              </View>
            )}
            
            {!isWebRTCAvailable && (
              <View style={styles.devModeIndicator}>
                <Text style={styles.devModeText}>Development Mode - No Video Transmission</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.streamPlaceholder}>
            <Ionicons name="videocam-off-outline" size={64} color="#999" />
            <Text style={styles.streamText}>Stream Not Active</Text>
            <Text style={styles.configureText}>Press "Start Stream" to begin broadcasting</Text>
          </View>
        )}
      </View>

      {/* Start Stream Button - Only show when not streaming */}
      {!isStreaming && (
        <View style={styles.buttonNavigation}>
          <TouchableOpacity 
            style={[styles.streamControlButton, styles.startButton]} 
            onPress={startStream}
          >
            <Ionicons name="play-circle" size={24} color="#fff" />
            <Text style={styles.controlButtonText}>Start Stream</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  streamContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  liveIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
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
  cameraControls: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  streamText: {
    color: '#999',
    fontSize: 18,
    marginTop: 20,
    fontWeight: '600',
  },
  configureText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  buttonNavigation: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  streamControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  controlButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
  devModeIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 165, 0, 0.9)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  devModeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  chatButton: {
    marginTop: 10,
    position: 'relative',
  },
  chatBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chatOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    maxHeight: 300,
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  chatHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  chatMessages: {
    maxHeight: 250,
  },
  emptyChatContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyChatText: {
    color: '#999',
    fontSize: 14,
  },
  chatMessage: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  chatUsername: {
    color: '#BC4A4D',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  chatMessageText: {
    color: '#fff',
    fontSize: 13,
  },
});

export default LiveStreamBroadcaster; 