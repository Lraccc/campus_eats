import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Alert, 
  TextInput,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';

interface RTSPCameraViewerProps {
  onClose: () => void;
}

const RTSPCameraViewer: React.FC<RTSPCameraViewerProps> = ({ onClose }) => {
  // Either direct RTSP URL or converted HLS URL
  const [videoUrl, setVideoUrl] = useState('rtsp://192.168.1.45/live/ch00_1');
  // Store the original RTSP URL for editing
  const [rtspUrl, setRtspUrl] = useState('rtsp://192.168.1.45/live/ch00_1');
  // For MJPEG fallback
  const [mjpegUrl, setMjpegUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [usingMjpeg, setUsingMjpeg] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const playerRef = useRef(null);
  
  // Convert RTSP URL to potentially compatible format or try MJPEG as fallback
  const handleConnect = () => {
    if (!rtspUrl.startsWith('rtsp://')) {
      Alert.alert('Invalid URL', 'Please enter a valid RTSP URL');
      return;
    }

    setIsLoading(true);
    setIsEditing(false);

    // Try these approaches in sequence:
    // 1. First try HLS if camera supports it (some IP cameras can serve RTSP as HLS)
    const ipAddress = rtspUrl.split('/')[2];
    const hlsUrl = `http://${ipAddress}/streaming/channels/1/hls.m3u8`;
    
    // 2. Prepare MJPEG URL as fallback
    const possibleMjpegUrl = `http://${ipAddress}/video.mjpg`;
    setMjpegUrl(possibleMjpegUrl);

    // For now, we'll try to use the direct RTSP URL with Expo AV
    // This may work for some cameras but not all
    setVideoUrl(rtspUrl);
    setIsConnected(true);
    setIsLoading(false);
  };
  
  const handleError = () => {
    setIsConnected(false);
    
    // If normal video fails, try MJPEG
    if (!usingMjpeg && mjpegUrl) {
      setUsingMjpeg(true);
      setIsConnected(true);
      return;
    }
    
    Alert.alert(
      'Connection Error',
      'Failed to connect to the camera. Please check the URL, ensure the camera is online, or try a different streaming format.',
      [{ text: 'Edit URL', onPress: () => setIsEditing(true) }]
    );
  };
  
  const handleEditUrl = () => {
    setIsConnected(false);
    setUsingMjpeg(false);
    setIsEditing(true);
  };
  
  const refreshStream = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CCTV Live Feed</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close-circle" size={32} color="#BC4A4D" />
        </TouchableOpacity>
      </View>
      
      {isEditing ? (
        <View style={styles.configContainer}>
          <Text style={styles.label}>RTSP Stream URL:</Text>
          <TextInput
            style={styles.input}
            value={rtspUrl}
            onChangeText={setRtspUrl}
            placeholder="rtsp://camera-ip-address/stream-path"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>
            Note: For V380 Pro cameras, the URL format is typically:
            rtsp://[camera-ip-address]/live/ch00_1
          </Text>
          <Text style={styles.helpText}>
            If direct RTSP streaming doesn't work, try adding an RTSP-to-HLS gateway
            or check if your camera supports MJPEG streaming.
          </Text>
        </View>
      ) : (
        <View style={styles.videoContainer}>
          {isLoading ? (
            <View style={styles.placeholderContainer}>
              <ActivityIndicator size="large" color="#BC4A4D" />
              <Text style={styles.placeholderText}>Connecting to camera...</Text>
            </View>
          ) : isConnected ? (
            usingMjpeg ? (
              // MJPEG fallback - refreshes the image periodically
              <Image
                key={`mjpeg-${refreshKey}`}
                source={{ uri: mjpegUrl }}
                style={styles.video}
                resizeMode="contain"
                onError={handleError}
              />
            ) : (
              // Try using Expo AV - may work for some RTSP streams but not reliable
              <Video
                ref={playerRef}
                style={styles.video}
                source={{ uri: videoUrl }}
                useNativeControls
                resizeMode="contain"
                isLooping
                onError={handleError}
                shouldPlay
              />
            )
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>Camera disconnected</Text>
              <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
                <Text style={styles.connectButtonText}>Connect to Camera</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
      {isConnected && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={handleEditUrl}>
            <Ionicons name="settings-outline" size={24} color="#BC4A4D" />
            <Text style={styles.controlButtonText}>Edit Camera URL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={refreshStream}>
            <MaterialIcons name="refresh" size={24} color="#BC4A4D" />
            <Text style={styles.controlButtonText}>Refresh Stream</Text>
          </TouchableOpacity>
          {usingMjpeg && (
            <View style={styles.modeIndicator}>
              <MaterialIcons name="photo-camera" size={18} color="#666" />
              <Text style={styles.modeText}>MJPEG Mode</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#BC4A4D',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 4,
  },
  videoContainer: {
    height: Dimensions.get('window').height * 0.5,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  placeholderText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 20,
  },
  controls: {
    padding: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  controlButtonText: {
    marginLeft: 8,
    color: '#333',
    fontSize: 14,
  },
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eee',
    padding: 8,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  modeText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#666',
  },
  configContainer: {
    padding: 20,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: '#BC4A4D',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  connectButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  }
});

export default RTSPCameraViewer;
