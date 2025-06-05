import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions, Modal, Alert, ActivityIndicator } from 'react-native';
import { useAuthentication } from '../services/authService';
import { API_URL } from '../config';
import axios from 'axios';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { cameraService, CameraConnectionStatus, CAMERA_CONFIG } from '../services/cameraService';
import V380CameraSettings from './V380CameraSettings';
import { v380CameraService } from '../services/v380CameraService';

interface LiveStreamBroadcasterProps {
  shopId: string;
  onEndStream: () => void;
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

const LiveStreamBroadcaster: React.FC<LiveStreamBroadcasterProps> = ({ shopId, onEndStream }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(true);
  const [pinnedProducts, setPinnedProducts] = useState<PinnedProduct[]>([]);
  const { getAccessToken } = useAuthentication();
  
  // Camera settings state
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showV380Modal, setShowV380Modal] = useState<boolean>(false);
  const [cameraIp, setCameraIp] = useState<string>(CAMERA_CONFIG.DEFAULT_IP);
  const [cameraPort, setCameraPort] = useState<string>(CAMERA_CONFIG.DEFAULT_PORT);
  const [username, setUsername] = useState<string>(CAMERA_CONFIG.DEFAULT_USERNAME);
  const [password, setPassword] = useState<string>(CAMERA_CONFIG.DEFAULT_PASSWORD);
  const [isConfiguring, setIsConfiguring] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<CameraConnectionStatus>(
    CameraConnectionStatus.DISCONNECTED
  );
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [cameraType, setCameraType] = useState<'standard' | 'v380'>('standard');

  useEffect(() => {
    const startStream = async () => {
      try {
        const token = await getAccessToken();
        const response = await axios.post(
          `${API_URL}/api/streams/start`,
          { shopId },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        setStreamId(response.data.streamId);
      } catch (error) {
        console.error('Error starting stream:', error);
      }
    };

    startStream();
    connectToCamera(); // Connect to camera when component mounts
  }, [shopId]);
  
  // Connect to camera with current settings
  const connectToCamera = async () => {
    try {
      setConnectionStatus(CameraConnectionStatus.CONNECTING);
      
      if (cameraType === 'standard') {
        // Configure camera with current settings
        cameraService.configureCamera(cameraIp, cameraPort, username, password);
        
        // Check connection with auto port detection
        console.log('Attempting to connect to camera with auto-detection...');
        const status = await cameraService.checkCameraConnection();
        setConnectionStatus(status);
        
        if (status === CameraConnectionStatus.CONNECTED) {
          // If connected, try to find a working stream URL
          console.log('Connected to camera, finding stream URL...');
          const workingUrl = await cameraService.findWorkingStreamUrl();
          
          if (workingUrl) {
            console.log('Found working stream URL:', workingUrl);
            setStreamUrl(workingUrl);
            
            // Update the port in UI if it was auto-detected
            setCameraPort(cameraService.getCameraPort());
          } else {
            // Fallback to default stream URL
            console.log('Using default stream URL');
            setStreamUrl(cameraService.getStreamUrl());
          }
        } else {
          Alert.alert(
            'Connection Failed',
            'Could not connect to the camera. Please check your settings and try again.',
            [{ text: 'OK' }]
          );
        }
      } else {
        // For V380 cameras, we'll use the V380CameraSettings component
        setShowV380Modal(true);
        // Reset connection status since V380 component will handle it
        setConnectionStatus(CameraConnectionStatus.DISCONNECTED);
      }
    } catch (error) {
      console.error('Camera connection error:', error);
      setConnectionStatus(CameraConnectionStatus.ERROR);
      Alert.alert('Error', 'Failed to connect to camera');
    }
  };
  
  // Handle V380 camera connection
  const handleV380Connected = (url: string) => {
    setStreamUrl(url);
    setConnectionStatus(CameraConnectionStatus.CONNECTED);
    setShowV380Modal(false);
  };

  const endStream = async () => {
    if (!streamId) return;

    try {
      const token = await getAccessToken();
      await axios.post(
        `${API_URL}/api/streams/${streamId}/end`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setIsStreaming(false);
      onEndStream();
    } catch (error) {
      console.error('Error ending stream:', error);
    }
  };

  const pinProduct = async (productId: string) => {
    try {
      const token = await getAccessToken();
      const response = await axios.post(
        `${API_URL}/api/streams/${streamId}/pin-product`,
        { productId },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setPinnedProducts(prev => [...prev, response.data]);
    } catch (error) {
      console.error('Error pinning product:', error);
    }
  };
  
  // Save camera settings and connect
  const saveSettings = async () => {
    setIsConfiguring(true);
    await connectToCamera();
    setIsConfiguring(false);
    
    // Only close the settings modal for standard cameras
    // V380 modal will be opened by connectToCamera if needed
    if (cameraType === 'standard') {
      setShowSettingsModal(false);
    }
  };
  
  // Switch camera type
  const switchCameraType = (type: 'standard' | 'v380') => {
    setCameraType(type);
    // Reset connection status when switching camera types
    setConnectionStatus(CameraConnectionStatus.DISCONNECTED);
    setStreamUrl('');
    
    // If switching to V380, we'll open the V380 settings directly
    if (type === 'v380' && showSettingsModal) {
      setShowSettingsModal(false);
      setTimeout(() => setShowV380Modal(true), 300); // Small delay for better UX
    }
  };
  
  // Render connection status indicator
  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case CameraConnectionStatus.CONNECTED:
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={[styles.statusText, { color: '#4CAF50' }]}>Connected</Text>
          </View>
        );
      case CameraConnectionStatus.CONNECTING:
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#FFC107" />
            <Text style={[styles.statusText, { color: '#FFC107' }]}>Connecting...</Text>
          </View>
        );
      case CameraConnectionStatus.ERROR:
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="alert-circle" size={16} color="#F44336" />
            <Text style={[styles.statusText, { color: '#F44336' }]}>Connection Error</Text>
          </View>
        );
      default:
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="radio-button-off" size={16} color="#9E9E9E" />
            <Text style={[styles.statusText, { color: '#9E9E9E' }]}>Disconnected</Text>
          </View>
        );
    }
  };

  // Camera settings modal component
  const renderSettingsModal = () => (
    <Modal
      visible={showSettingsModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowSettingsModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Camera Settings</Text>
          
          <View style={styles.cameraTypeSelector}>
            <TouchableOpacity 
              style={[styles.cameraTypeButton, cameraType === 'standard' && styles.cameraTypeButtonActive]}
              onPress={() => switchCameraType('standard')}
            >
              <Text style={[styles.cameraTypeText, cameraType === 'standard' && styles.cameraTypeTextActive]}>Standard IP Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.cameraTypeButton, cameraType === 'v380' && styles.cameraTypeButtonActive]}
              onPress={() => switchCameraType('v380')}
            >
              <Text style={[styles.cameraTypeText, cameraType === 'v380' && styles.cameraTypeTextActive]}>V380 Pro Camera</Text>
            </TouchableOpacity>
          </View>
          
          {cameraType === 'standard' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Camera IP"
                value={cameraIp}
                onChangeText={setCameraIp}
                keyboardType="numeric"
                editable={!isConfiguring}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Port"
                value={cameraPort}
                onChangeText={setCameraPort}
                keyboardType="numeric"
                editable={!isConfiguring}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                editable={!isConfiguring}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isConfiguring}
              />
            </>
          ) : (
            <View style={styles.v380InfoContainer}>
              <Text style={styles.v380InfoText}>
                V380 Pro cameras use a proprietary connection method. Click Connect to configure your V380 Pro camera.
              </Text>
              <View style={styles.v380InfoBox}>
                <Ionicons name="information-circle" size={24} color="#BC4A4D" style={styles.infoIcon} />
                <Text style={styles.v380Note}>
                  To use your V380 Pro camera, you'll need to enable RTSP/ONVIF in the V380 Pro app first.
                </Text>
              </View>
            </View>
          )}
          
          {renderConnectionStatus()}
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setShowSettingsModal(false)}
              disabled={isConfiguring}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={saveSettings}
              disabled={isConfiguring}
            >
              {isConfiguring ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.buttonText, { color: '#fff' }]}>Connect</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // V380 Camera Settings Modal
  const renderV380SettingsModal = () => (
    showV380Modal && (
      <V380CameraSettings 
        onClose={() => setShowV380Modal(false)} 
        onConnected={handleV380Connected} 
      />
    )
  );

  return (
    <View style={styles.container}>
      {/* Camera Settings Modal */}
      {renderSettingsModal()}
      
      {/* V380 Camera Settings Modal */}
      {renderV380SettingsModal()}
      
      {/* Stream View */}
      <View style={styles.streamContainer}>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettingsModal(true)}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
            <Text style={styles.settingsButtonText}>Camera Settings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.endButton} onPress={endStream}>
            <Ionicons name="close-circle" size={24} color="#BC4A4D" />
            <Text style={styles.endButtonText}>End Stream</Text>
          </TouchableOpacity>
        </View>
        
        {connectionStatus === CameraConnectionStatus.CONNECTED && streamUrl ? (
          <WebView
            source={{ uri: streamUrl }}
            style={styles.streamWebView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Loading stream...</Text>
              </View>
            )}
            onError={() => {
              Alert.alert('Stream Error', 'Failed to load camera stream');
            }}
          />
        ) : (
          <View style={styles.streamPlaceholder}>
            {renderConnectionStatus()}
            <Text style={styles.streamText}>
              {connectionStatus === CameraConnectionStatus.CONNECTING
                ? 'Connecting to camera...'
                : 'Camera not connected'}
            </Text>
            <TouchableOpacity 
              style={styles.connectButton} 
              onPress={() => setShowSettingsModal(true)}
            >
              <Text style={styles.connectButtonText}>Configure Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Pinned Products */}
      <View style={styles.pinnedProductsContainer}>
        <Text style={styles.sectionTitle}>Your Stocks</Text>
        <ScrollView horizontal style={styles.pinnedProductsScroll}>
          {pinnedProducts.map((product) => (
            <View key={product.id} style={styles.pinnedProduct}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>₱{product.price}</Text>
            </View>
          ))}
        </ScrollView>
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraTypeSelector: {
    flexDirection: 'row',
    marginBottom: 15,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cameraTypeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  cameraTypeButtonActive: {
    backgroundColor: '#BC4A4D',
  },
  cameraTypeText: {
    color: '#333',
    fontWeight: '500',
  },
  cameraTypeTextActive: {
    color: '#fff',
  },
  v380InfoContainer: {
    marginBottom: 15,
  },
  v380InfoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  v380InfoBox: {
    backgroundColor: '#f8f8f8',
    borderRadius: 5,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#BC4A4D',
  },
  infoIcon: {
    marginRight: 8,
  },
  v380Note: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    marginLeft: 5,
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 5,
    flex: 1,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    zIndex: 10,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 20,
  },
  settingsButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  streamWebView: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
  connectButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 5,
    marginTop: 20,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  streamContainer: {
    height: Dimensions.get('window').height * 0.4,
    backgroundColor: '#111',
    position: 'relative',
  },
  endButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 20,
  },
  endButtonText: {
    color: '#BC4A4D',
    marginLeft: 5,
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
  pinnedProductsContainer: {
    backgroundColor: '#fff',
    padding: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  pinnedProductsScroll: {
    flexDirection: 'row',
  },
  pinnedProduct: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginRight: 10,
    borderRadius: 8,
    minWidth: 120,
  },
  productName: {
    fontWeight: 'bold',
    color: '#333',
  },
  productPrice: {
    color: '#BC4A4D',
    marginTop: 4,
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
});

export default LiveStreamBroadcaster; 