import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Dimensions,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';
import { 
  cameraService, 
  CameraConnectionStatus, 
  PTZCommand,
  CAMERA_CONFIG
} from '../services/cameraService';
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

interface CameraViewProps {
  onClose?: () => void;
  showControls?: boolean;
  showSettings?: boolean;
}

const CameraView: React.FC<CameraViewProps> = ({ 
  onClose, 
  showControls = true,
  showSettings = true
}) => {
  // Stream state
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<CameraConnectionStatus>(
    CameraConnectionStatus.DISCONNECTED
  );
  const [snapshotUri, setSnapshotUri] = useState<string | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState<boolean>(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  // Camera settings
  const [cameraIp, setCameraIp] = useState<string>(CAMERA_CONFIG.DEFAULT_IP);
  const [cameraPort, setCameraPort] = useState<string>(CAMERA_CONFIG.DEFAULT_PORT);
  const [username, setUsername] = useState<string>(CAMERA_CONFIG.DEFAULT_USERNAME);
  const [password, setPassword] = useState<string>(CAMERA_CONFIG.DEFAULT_PASSWORD);
  
  // UI state
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [isConfiguring, setIsConfiguring] = useState<boolean>(false);
  const [presetName, setPresetName] = useState<string>('');
  const [presetNumber, setPresetNumber] = useState<string>('1');
  const [ptzSpeed, setPtzSpeed] = useState<string>('5');

  // Initialize camera connection and check permissions
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === 'granted');
      connectToCamera();
    })();
  }, []);

  // Connect to camera with current settings
  const connectToCamera = async () => {
    try {
      setConnectionStatus(CameraConnectionStatus.CONNECTING);
      
      // Configure camera with current settings
      cameraService.configureCamera(cameraIp, cameraPort, username, password);
      
      // Check connection
      const status = await cameraService.checkCameraConnection();
      setConnectionStatus(status);
      
      if (status === CameraConnectionStatus.CONNECTED) {
        // Set stream URL for HTTP streaming
        setStreamUrl(cameraService.getStreamUrl());
        setIsStreaming(true);
        // Take initial snapshot
        takeSnapshot();
      } else {
        Alert.alert(
          'Connection Failed',
          'Could not connect to the camera. Please check your settings and try again.',
          [{ text: 'OK' }]
        );
        setIsStreaming(false);
      }
    } catch (error) {
      console.error('Camera connection error:', error);
      setConnectionStatus(CameraConnectionStatus.ERROR);
      setIsStreaming(false);
      Alert.alert('Error', 'Failed to connect to camera');
    }
  };
  
  // Take a snapshot from the camera
  const takeSnapshot = async () => {
    try {
      setIsLoadingSnapshot(true);
      const uri = await cameraService.takeSnapshot();
      setSnapshotUri(uri);
    } catch (error) {
      console.error('Snapshot error:', error);
      Alert.alert('Error', 'Failed to take snapshot');
    } finally {
      setIsLoadingSnapshot(false);
    }
  };

  // Save camera settings
  const saveSettings = async () => {
    setIsConfiguring(true);
    try {
      cameraService.configureCamera(cameraIp, cameraPort, username, password);
      await connectToCamera();
      setShowSettingsModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save camera settings');
    } finally {
      setIsConfiguring(false);
    }
  };

  // Handle PTZ control
  const handlePTZControl = async (command: PTZCommand) => {
    try {
      const speed = parseInt(ptzSpeed, 10) || 5;
      const success = await cameraService.sendPTZCommand(command, speed);
      
      if (!success) {
        Alert.alert('PTZ Control Failed', 'Could not send command to camera');
      }
      
      // Auto-stop after movement (optional)
      if (command !== PTZCommand.STOP) {
        setTimeout(async () => {
          await cameraService.sendPTZCommand(PTZCommand.STOP);
        }, 1000);
      }
    } catch (error) {
      console.error('PTZ control error:', error);
      Alert.alert('Error', 'Failed to control camera');
    }
  };

  // Handle preset operations
  const handlePreset = async (action: 'set' | 'goto') => {
    try {
      const presetNum = parseInt(presetNumber, 10) || 1;
      
      if (action === 'set') {
        if (!presetName.trim()) {
          Alert.alert('Error', 'Please enter a preset name');
          return;
        }
        
        const success = await cameraService.setPreset(presetName, presetNum);
        if (success) {
          Alert.alert('Success', `Preset ${presetNum} saved`);
        } else {
          Alert.alert('Error', 'Failed to save preset');
        }
      } else {
        const success = await cameraService.goToPreset(presetNum);
        if (!success) {
          Alert.alert('Error', 'Failed to go to preset');
        }
      }
    } catch (error) {
      console.error('Preset operation error:', error);
      Alert.alert('Error', 'Failed to perform preset operation');
    }
  };

  // Render connection status
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

  // Render settings modal
  const renderSettingsModal = () => (
    <Modal
      visible={showSettingsModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowSettingsModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Camera Settings</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowSettingsModal(false)}
            >
              <Ionicons name="close" size={24} color="#BC4A4D" />
            </TouchableOpacity>
          </View>
          
          <ScrollView>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Camera IP Address</Text>
              <TextInput
                style={styles.input}
                value={cameraIp}
                onChangeText={setCameraIp}
                placeholder="192.168.1.100"
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Port</Text>
              <TextInput
                style={styles.input}
                value={cameraPort}
                onChangeText={setCameraPort}
                placeholder="8080"
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="admin"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="admin"
                secureTextEntry
              />
            </View>
            
            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveSettings}
              disabled={isConfiguring}
            >
              {isConfiguring ? (
                <ActivityIndicator size="small" color="#FFFAF1" />
              ) : (
                <Text style={styles.saveButtonText}>Save & Connect</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.rebootButton}
              onPress={async () => {
                const confirmed = await new Promise((resolve) => {
                  Alert.alert(
                    'Reboot Camera',
                    'Are you sure you want to reboot the camera?',
                    [
                      { text: 'Cancel', onPress: () => resolve(false) },
                      { text: 'Reboot', onPress: () => resolve(true) }
                    ]
                  );
                });
                
                if (confirmed) {
                  try {
                    const success = await cameraService.rebootCamera();
                    if (success) {
                      Alert.alert('Success', 'Camera is rebooting. Please wait about 60 seconds before reconnecting.');
                      setShowSettingsModal(false);
                      setConnectionStatus(CameraConnectionStatus.DISCONNECTED);
                      setIsStreaming(false);
                    } else {
                      Alert.alert('Error', 'Failed to reboot camera');
                    }
                  } catch (error) {
                    Alert.alert('Error', 'Failed to reboot camera');
                  }
                }
              }}
            >
              <Text style={styles.rebootButtonText}>Reboot Camera</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>V3800 Pro Camera</Text>
        {renderConnectionStatus()}
        <View style={styles.headerButtons}>
          {showSettings && (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setShowSettingsModal(true)}
            >
              <Ionicons name="settings-outline" size={24} color="#BC4A4D" />
            </TouchableOpacity>
          )}
          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#BC4A4D" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Camera Stream */}
      <View style={styles.streamContainer}>
        {isStreaming ? (
          <View style={styles.streamContent}>
            <WebView
              source={{ uri: streamUrl }}
              style={styles.streamView}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#000',
                }}>
                  <ActivityIndicator size="large" color="#BC4A4D" />
                  <Text style={{
                    marginTop: 10,
                    fontSize: 16,
                    color: '#BC4A4D',
                  }}>Loading stream...</Text>
                </View>
              )}
              onError={() => {
                // Fallback to snapshot if streaming fails
                setIsStreaming(false);
              }}
            />
            <TouchableOpacity 
              style={styles.snapshotButton}
              onPress={takeSnapshot}
            >
              <Ionicons name="camera" size={24} color="#FFFAF1" />
            </TouchableOpacity>
          </View>
        ) : snapshotUri ? (
          <View style={styles.streamContent}>
            <Image
              source={{ uri: snapshotUri }}
              style={styles.streamView}
              resizeMode="contain"
            />
            {isLoadingSnapshot ? (
              <View style={styles.snapshotOverlay}>
                <ActivityIndicator size="large" color="#BC4A4D" />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={takeSnapshot}
              >
                <Ionicons name="refresh" size={24} color="#FFFAF1" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.reconnectButton}
              onPress={connectToCamera}
            >
              <Text style={styles.reconnectButtonText}>Try Stream</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noStreamContainer}>
            <Ionicons name="videocam-off" size={48} color="#BBB4A" />
            <Text style={styles.noStreamText}>No camera stream available</Text>
            <TouchableOpacity
              style={styles.reconnectButton}
              onPress={connectToCamera}
            >
              <Text style={styles.reconnectButtonText}>Connect</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* PTZ Controls */}
      {showControls && (
        <View style={styles.controlsContainer}>
          <View style={styles.ptzControls}>
            <View style={styles.ptzRow}>
              <TouchableOpacity
                style={styles.ptzButton}
                onPress={() => handlePTZControl(PTZCommand.TILT_UP)}
              >
                <Ionicons name="chevron-up" size={24} color="#FFFAF1" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.ptzRow}>
              <TouchableOpacity
                style={styles.ptzButton}
                onPress={() => handlePTZControl(PTZCommand.PAN_LEFT)}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFAF1" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.ptzButton}
                onPress={() => handlePTZControl(PTZCommand.STOP)}
              >
                <Ionicons name="stop" size={24} color="#FFFAF1" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.ptzButton}
                onPress={() => handlePTZControl(PTZCommand.PAN_RIGHT)}
              >
                <Ionicons name="chevron-forward" size={24} color="#FFFAF1" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.ptzRow}>
              <TouchableOpacity
                style={styles.ptzButton}
                onPress={() => handlePTZControl(PTZCommand.TILT_DOWN)}
              >
                <Ionicons name="chevron-down" size={24} color="#FFFAF1" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.zoomControls}>
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={() => handlePTZControl(PTZCommand.ZOOM_IN)}
            >
              <Ionicons name="add" size={24} color="#FFFAF1" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={() => handlePTZControl(PTZCommand.ZOOM_OUT)}
            >
              <Ionicons name="remove" size={24} color="#FFFAF1" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.speedContainer}>
            <Text style={styles.speedLabel}>Speed:</Text>
            <TextInput
              style={styles.speedInput}
              value={ptzSpeed}
              onChangeText={setPtzSpeed}
              keyboardType="numeric"
              maxLength={2}
            />
          </View>
          
          <View style={styles.presetContainer}>
            <View style={styles.presetInputRow}>
              <TextInput
                style={styles.presetNameInput}
                value={presetName}
                onChangeText={setPresetName}
                placeholder="Preset Name"
              />
              
              <TextInput
                style={styles.presetNumberInput}
                value={presetNumber}
                onChangeText={setPresetNumber}
                keyboardType="numeric"
                maxLength={2}
                placeholder="#"
              />
            </View>
            
            <View style={styles.presetButtonRow}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => handlePreset('set')}
              >
                <Text style={styles.presetButtonText}>Save Preset</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => handlePreset('goto')}
              >
                <Text style={styles.presetButtonText}>Go To Preset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Settings Modal */}
      {renderSettingsModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFAF1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFAF1',
    borderBottomWidth: 1,
    borderBottomColor: '#BBB4A',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#BC4A4D',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    marginLeft: 4,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  settingsButton: {
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  },
  streamContainer: {
    height: 300,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamContent: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  streamView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  snapshotButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(188, 74, 77, 0.8)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(188, 74, 77, 0.8)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  snapshotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noStreamContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noStreamText: {
    color: '#BBB4A',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  reconnectButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  reconnectButtonText: {
    color: '#FFFAF1',
    fontSize: 14,
    fontWeight: '600',
  },
  controlsContainer: {
    padding: 16,
  },
  ptzControls: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ptzRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 4,
  },
  ptzButton: {
    backgroundColor: '#BC4A4D',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  zoomButton: {
    backgroundColor: '#BC4A4D',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  speedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  speedLabel: {
    fontSize: 16,
    color: '#BC4A4D',
    marginRight: 8,
  },
  speedInput: {
    backgroundColor: '#FFFAF1',
    borderWidth: 1,
    borderColor: '#BBB4A',
    borderRadius: 8,
    padding: 8,
    width: 50,
    textAlign: 'center',
  },
  presetContainer: {
    marginTop: 8,
  },
  presetInputRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  presetNameInput: {
    flex: 3,
    backgroundColor: '#FFFAF1',
    borderWidth: 1,
    borderColor: '#BBB4A',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  presetNumberInput: {
    flex: 1,
    backgroundColor: '#FFFAF1',
    borderWidth: 1,
    borderColor: '#BBB4A',
    borderRadius: 8,
    padding: 8,
    textAlign: 'center',
  },
  presetButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presetButton: {
    flex: 1,
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  presetButtonText: {
    color: '#FFFAF1',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFAF1',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#BC4A4D',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#BC4A4D',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFAF1',
    borderWidth: 1,
    borderColor: '#BBB4A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#BC4A4D',
  },
  saveButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveButtonText: {
    color: '#FFFAF1',
    fontSize: 16,
    fontWeight: '600',
  },
  rebootButton: {
    backgroundColor: '#BBB4A',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rebootButtonText: {
    color: '#FFFAF1',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CameraView;
