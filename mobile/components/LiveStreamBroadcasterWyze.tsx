import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TextInput, TouchableOpacity, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useAuthentication } from '../services/authService';
import { API_URL } from '../config';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateWyzeRTSPUrl,
  saveWyzeCameraConfig,
  getStreamUrl,
  isValidRTSPUrl,
  isValidHLSUrl,
  WyzeCameraConfig,
  WYZE_DEFAULTS
} from '../services/wyzeCameraService';

interface LiveStreamBroadcasterWyzeProps {
  shopId: string;
  onEndStream: () => void;
  shopName?: string;
}

const LiveStreamBroadcasterWyze: React.FC<LiveStreamBroadcasterWyzeProps> = ({ 
  shopId, 
  onEndStream, 
  shopName = 'Shop' 
}) => {
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(true);
  const [isEndingStream, setIsEndingStream] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isStreamLoaded, setIsStreamLoaded] = useState<boolean>(false);
  const [isStreamLoading, setIsStreamLoading] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [streamType, setStreamType] = useState<'rtsp' | 'hls' | 'http'>('hls');
  const { getAccessToken } = useAuthentication();
  
  // Wyze camera configuration
  const [cameraConfig, setCameraConfig] = useState<WyzeCameraConfig>({
    cameraId: '',
    cameraName: 'Food Display Camera',
    username: 'admin',
    password: '',
    ipAddress: '',
    port: WYZE_DEFAULTS.port,
    streamPath: WYZE_DEFAULTS.streamPath
  });
  
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    loadStreamConfiguration();
  }, [shopId]);

  const loadStreamConfiguration = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('No authentication token available');
        setShowSettings(true);
        return;
      }

      // Try to get stream URL from backend
      const streamData = await getStreamUrl(shopId, token);
      
      if (streamData && streamData.rtspUrl) {
        console.log('Loaded stream URL from backend:', streamData.rtspUrl);
        
        // Use HLS if available (better for mobile), otherwise use RTSP
        const url = streamData.hlsUrl || streamData.rtspUrl;
        setStreamUrl(url);
        setStreamType(streamData.type);
        
        await startStream();
      } else {
        // No stream configured, show settings
        console.log('No stream configured, showing setup');
        setShowSettings(true);
        setIsStreamLoading(false);
      }
    } catch (error) {
      console.error('Error loading stream configuration:', error);
      setShowSettings(true);
      setIsStreamLoading(false);
    }
  };

  const startStream = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('No authentication token available');
        return;
      }

      console.log('Starting stream with shopId:', shopId);
      
      // Update streaming status in backend
      await axios.post(
        `${API_URL}/api/shops/${shopId}/streaming-status`,
        { isStreaming: true },
        { headers: { Authorization: token } }
      );

      // Start stream session
      const response = await axios.post(
        `${API_URL}/api/streams/start`,
        { shopId },
        { headers: { Authorization: token } }
      );
      
      console.log('Stream started successfully, response:', response.data);
      setStreamId(response.data.streamId);
      setIsStreaming(true);
    } catch (error) {
      console.error('Error starting stream:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
    }
  };

  const endStream = async () => {
    try {
      setIsEndingStream(true);
      const token = await getAccessToken();
      
      if (!token) {
        console.error('No authentication token available');
        return;
      }

      console.log('Ending stream for shopId:', shopId);

      // Update streaming status
      await axios.post(
        `${API_URL}/api/shops/${shopId}/streaming-status`,
        { isStreaming: false },
        { headers: { Authorization: token } }
      );

      console.log('Stream ended successfully');
      setIsStreaming(false);

      // End stream session if active
      if (streamId) {
        await axios.post(
          `${API_URL}/api/streams/${streamId}/end`,
          {},
          { headers: { Authorization: token } }
        );
        console.log('Stream instance ended');
      }

      // Stop video playback
      if (videoRef.current) {
        await videoRef.current.stopAsync();
      }

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

  const saveConfiguration = async () => {
    try {
      // Validate inputs
      if (!cameraConfig.ipAddress) {
        Alert.alert('Missing Information', 'Please enter the camera IP address');
        return;
      }

      if (!cameraConfig.password) {
        Alert.alert('Missing Information', 'Please enter the RTSP password');
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        Alert.alert('Error', 'Authentication token not available');
        return;
      }

      // Save to backend
      await saveWyzeCameraConfig(shopId, cameraConfig, token);

      // Generate and test URL
      const rtspUrl = generateWyzeRTSPUrl(cameraConfig);
      console.log('Generated RTSP URL:', rtspUrl.replace(cameraConfig.password, '****'));

      // Save locally
      await AsyncStorage.setItem(`wyze-camera-${shopId}`, JSON.stringify(cameraConfig));

      setStreamUrl(rtspUrl);
      setStreamType('rtsp');
      setShowSettings(false);
      setIsStreamLoading(true);
      setStreamError(false);

      // Start streaming
      await startStream();

      Alert.alert(
        'Success',
        'Wyze camera configured successfully!\n\nNote: If using RTSP directly, make sure your camera is on the same network. For best results, ask your backend admin to set up HLS conversion.'
      );
    } catch (error) {
      console.error('Error saving configuration:', error);
      Alert.alert('Error', 'Failed to save camera configuration. Please check your settings and try again.');
    }
  };

  const handleVideoPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (!isStreamLoaded) {
        console.log('Video loaded successfully');
        setIsStreamLoaded(true);
        setIsStreamLoading(false);
        setStreamError(false);
      }
    } else if (status.error) {
      console.error('Video playback error:', status.error);
      setStreamError(true);
      setIsStreamLoading(false);
      setErrorMessage(status.error || 'Failed to load stream');
    }
  };

  const retryStream = async () => {
    setIsStreamLoading(true);
    setStreamError(false);
    setErrorMessage('');
    
    if (videoRef.current) {
      try {
        await videoRef.current.unloadAsync();
        await videoRef.current.loadAsync({ uri: streamUrl }, {}, false);
        await videoRef.current.playAsync();
      } catch (error) {
        console.error('Error retrying stream:', error);
        setStreamError(true);
        setIsStreamLoading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stream Container */}
      <View style={styles.streamContainer}>
        {streamUrl && !streamError ? (
          <>
            <Video
              ref={videoRef}
              source={{ uri: streamUrl }}
              style={styles.video}
              useNativeControls={false}
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              shouldPlay
              onPlaybackStatusUpdate={handleVideoPlaybackStatusUpdate}
            />
            
            {isStreamLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#BC4A4D" />
                <Text style={styles.loadingText}>Connecting to camera...</Text>
                <Text style={styles.loadingSubText}>
                  {streamType === 'rtsp' ? 'Using RTSP stream' : 'Using HLS stream'}
                </Text>
              </View>
            )}
          </>
        ) : streamError ? (
          <View style={styles.errorOverlay}>
            <Ionicons name="videocam-off" size={64} color="#BC4A4D" />
            <Text style={styles.errorText}>Stream Connection Failed</Text>
            <Text style={styles.errorSubText}>{errorMessage || 'Unable to connect to camera'}</Text>
            <Text style={styles.errorHint}>
              {streamType === 'rtsp' 
                ? 'RTSP streams may not work on all networks. Contact your admin to set up HLS conversion for better compatibility.'
                : 'Please check your camera settings and network connection.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryStream}>
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingsButtonInError} 
              onPress={() => setShowSettings(true)}
            >
              <Text style={styles.retryButtonText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noStreamOverlay}>
            <Ionicons name="videocam-outline" size={64} color="#999" />
            <Text style={styles.noStreamText}>No Camera Configured</Text>
            <TouchableOpacity 
              style={styles.setupButton} 
              onPress={() => setShowSettings(true)}
            >
              <Text style={styles.setupButtonText}>Setup Wyze Camera</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stream Status Indicator */}
        {isStreaming && isStreamLoaded && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSettings}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Wyze Cam v3 Setup</Text>
                <TouchableOpacity onPress={() => setShowSettings(false)}>
                  <Ionicons name="close" size={28} color="#333" />
                </TouchableOpacity>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#4A90E2" />
                <Text style={styles.infoText}>
                  Enable RTSP in your Wyze app: Settings → Advanced Settings → Enable RTSP
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Camera Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Food Display Camera"
                  value={cameraConfig.cameraName}
                  onChangeText={(text) => setCameraConfig({...cameraConfig, cameraName: text})}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Camera IP Address *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 192.168.1.100"
                  value={cameraConfig.ipAddress}
                  onChangeText={(text) => setCameraConfig({...cameraConfig, ipAddress: text})}
                  keyboardType="numeric"
                />
                <Text style={styles.hint}>Find in router settings or Wyze app</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>RTSP Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Default: admin"
                  value={cameraConfig.username}
                  onChangeText={(text) => setCameraConfig({...cameraConfig, username: text})}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>RTSP Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Set in Wyze app RTSP settings"
                  value={cameraConfig.password}
                  onChangeText={(text) => setCameraConfig({...cameraConfig, password: text})}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Port (Advanced)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="8554"
                  value={cameraConfig.port?.toString()}
                  onChangeText={(text) => setCameraConfig({...cameraConfig, port: parseInt(text) || 8554})}
                  keyboardType="numeric"
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={saveConfiguration}>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save & Start Streaming</Text>
              </TouchableOpacity>

              <View style={styles.helpSection}>
                <Text style={styles.helpTitle}>Troubleshooting:</Text>
                <Text style={styles.helpText}>• Ensure camera is on same WiFi network</Text>
                <Text style={styles.helpText}>• Verify RTSP is enabled in Wyze app</Text>
                <Text style={styles.helpText}>• Check IP address hasn't changed</Text>
                <Text style={styles.helpText}>• For best results, use backend HLS conversion</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity 
          style={[styles.endStreamButton, isEndingStream && styles.buttonDisabled]}
          onPress={endStream}
          disabled={isEndingStream}
        >
          {isEndingStream ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="stop-circle" size={24} color="#fff" />
              <Text style={styles.endStreamButtonText}>End Stream</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeButton} onPress={onEndStream}>
          <Ionicons name="close-circle" size={24} color="#fff" />
          <Text style={styles.closeButtonText}>Close</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 8,
  },
  streamContainer: {
    marginTop: 20,
    height: Dimensions.get('window').height * 0.4,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 15,
    borderRadius: 10,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
  },
  loadingSubText: {
    color: '#999',
    fontSize: 12,
    marginTop: 5,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 20,
  },
  errorText: {
    color: '#BC4A4D',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
  },
  errorSubText: {
    color: 'white',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorHint: {
    color: '#999',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  settingsButtonInError: {
    backgroundColor: '#555',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 10,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  noStreamOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  noStreamText: {
    color: '#999',
    fontSize: 16,
    marginTop: 15,
  },
  setupButton: {
    backgroundColor: '#BC4A4D',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  setupButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  liveIndicator: {
    position: 'absolute',
    top: 15,
    left: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(188, 74, 77, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    margin: 15,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    color: '#1976D2',
    fontSize: 13,
    lineHeight: 18,
  },
  inputGroup: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#BC4A4D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  helpSection: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  endStreamButton: {
    backgroundColor: '#BC4A4D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  closeButton: {
    backgroundColor: '#666',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  endStreamButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
});

export default LiveStreamBroadcasterWyze;
