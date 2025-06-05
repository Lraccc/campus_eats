import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  Alert,
  ActivityIndicator,
  ScrollView,
  Clipboard
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { v380CameraService, V380_CONFIG } from '../services/v380CameraService';
import { CameraConnectionStatus } from '../services/cameraService';
import V380WebPortal from './V380WebPortal';

interface V380CameraSettingsProps {
  onClose: () => void;
  onConnected: (streamUrl: string) => void;
}

const V380CameraSettings: React.FC<V380CameraSettingsProps> = ({ onClose, onConnected }) => {
  // ceshi.ini template for enabling RTSP
  const ceshiIniTemplate = '[CONST_PARAM]\nrtsp=1';
  const [cameraIp, setCameraIp] = useState<string>('');
  const [username, setUsername] = useState<string>(V380_CONFIG.DEFAULT_USERNAME);
  const [password, setPassword] = useState<string>(V380_CONFIG.DEFAULT_PASSWORD);
  const [deviceId, setDeviceId] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [isConfiguring, setIsConfiguring] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<CameraConnectionStatus>(
    CameraConnectionStatus.DISCONNECTED
  );
  const [connectionMethod, setConnectionMethod] = useState<'ip' | 'qr' | 'web'>('ip');
  const [showWebPortal, setShowWebPortal] = useState<boolean>(false);

  // Parse QR code when entered
  useEffect(() => {
    if (qrCode && qrCode.startsWith('V380^')) {
      const success = v380CameraService.parseQRCode(qrCode);
      if (success) {
        setDeviceId(v380CameraService.getDeviceId());
      }
    }
  }, [qrCode]);

  // Connect to camera with current settings
  const connectToCamera = async () => {
    try {
      setIsConfiguring(true);
      setConnectionStatus(CameraConnectionStatus.CONNECTING);
      
      if (connectionMethod === 'ip') {
        // Configure camera with IP settings
        v380CameraService.configureCamera(cameraIp, username, password);
        
        // Check connection
        const status = await v380CameraService.checkCameraConnection();
        setConnectionStatus(status);
        
        if (status === CameraConnectionStatus.CONNECTED) {
          // If connected, get stream URL
          const rtspUrl = v380CameraService.getRtspUrl();
          const httpUrl = v380CameraService.getHttpStreamUrl();
          
          // For now, we'll use HTTP URL as it's more compatible with WebView
          onConnected(httpUrl);
          Alert.alert('Success', 'Connected to camera successfully!');
        } else {
          Alert.alert(
            'Connection Failed',
            'Could not connect to the camera. Please check your settings and try again.',
            [{ text: 'OK' }]
          );
        }
      } else if (connectionMethod === 'qr') {
        // QR code method - in a real implementation, this would connect to the V380 cloud
        Alert.alert(
          'V380 Cloud Connection',
          'To connect using the V380 cloud service, you need to enable RTSP/ONVIF on your camera first.\n\n' +
          'Please follow these steps:\n' +
          '1. In the V380 Pro app, go to your camera settings\n' +
          '2. Look for "Advanced Settings" or "Device Settings"\n' +
          '3. Within Advanced Settings, look for "Protocol Settings", "Network Protocol", or "RTSP/ONVIF"\n' +
          '4. Enable the RTSP/ONVIF toggle (may require camera restart)\n\n' +
          'Once enabled, use the IP connection method with these settings:\n' +
          '   - IP: The IP address shown in Advanced Settings\n' +
          '   - Username: admin\n' +
          '   - Password: Your V380 app password',
          [{ text: 'OK' }]
        );
        setConnectionStatus(CameraConnectionStatus.DISCONNECTED);
      } else if (connectionMethod === 'web') {
        // Web portal method - open the V380 web portal
        setShowWebPortal(true);
      }
    } catch (error) {
      console.error('Camera connection error:', error);
      setConnectionStatus(CameraConnectionStatus.ERROR);
      Alert.alert('Error', 'Failed to connect to camera');
    } finally {
      setIsConfiguring(false);
    }
  };
  
  // Handle web portal connection
  const handleWebPortalConnected = (streamUrl: string) => {
    onConnected(streamUrl);
    setShowWebPortal(false);
    onClose();
  };

  // Get status indicator color
  const getStatusColor = () => {
    switch (connectionStatus) {
      case CameraConnectionStatus.CONNECTED:
        return '#4CAF50'; // Green
      case CameraConnectionStatus.CONNECTING:
        return '#FFC107'; // Yellow
      case CameraConnectionStatus.ERROR:
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Gray
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (connectionStatus) {
      case CameraConnectionStatus.CONNECTED:
        return 'Connected';
      case CameraConnectionStatus.CONNECTING:
        return 'Connecting...';
      case CameraConnectionStatus.ERROR:
        return 'Connection Error';
      default:
        return 'Disconnected';
    }
  };
  
  // Show SD card RTSP enablement instructions
  const showRtspEnableInstructions = () => {
    Alert.alert(
      'Enable RTSP on V380 Camera',
      'Follow these steps to enable RTSP streaming:\n\n' +
      '1. Prepare a MicroSD Card:\n' +
      '   • Format it to FAT32\n' +
      '   • Create a file named "ceshi.ini"\n' +
      '   • Copy this content to the file:\n\n' +
      '[CONST_PARAM]\n' +
      'rtsp=1\n\n' +
      '2. Insert & Activate:\n' +
      '   • Power off the camera\n' +
      '   • Insert the SD card\n' +
      '   • Power on and wait 5 minutes\n\n' +
      '3. Clean Up:\n' +
      '   • Remove SD card and delete ceshi.ini\n\n' +
      '4. Use RTSP URL:\n' +
      '   rtsp://admin:password@camera_ip:554/live/ch00_0\n\n' +
      'To revert to normal, reset the camera to factory settings.',
      [
        { 
          text: 'Copy ceshi.ini Template', 
          onPress: () => {
            Clipboard.setString(ceshiIniTemplate);
            Alert.alert('Copied', 'Template copied to clipboard. Paste it into a text file named "ceshi.ini"');
          } 
        },
        { text: 'OK' }
      ]
    );
  };

  // Render web portal if active
  if (showWebPortal) {
    return (
      <V380WebPortal
        onClose={() => setShowWebPortal(false)}
        onConnected={handleWebPortalConnected}
      />
    );
  }

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>V380 Pro Camera Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollView}>
            <View style={styles.connectionTypeSelector}>
              <TouchableOpacity 
                style={[
                  styles.connectionTypeButton, 
                  connectionMethod === 'ip' && styles.connectionTypeButtonActive
                ]}
                onPress={() => setConnectionMethod('ip')}
              >
                <Text style={[
                  styles.connectionTypeText,
                  connectionMethod === 'ip' && styles.connectionTypeTextActive
                ]}>IP Address</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.connectionTypeButton, 
                  connectionMethod === 'qr' && styles.connectionTypeButtonActive
                ]}
                onPress={() => setConnectionMethod('qr')}
              >
                <Text style={[
                  styles.connectionTypeText,
                  connectionMethod === 'qr' && styles.connectionTypeTextActive
                ]}>QR Code</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.connectionTypeButton, 
                  connectionMethod === 'web' && styles.connectionTypeButtonActive
                ]}
                onPress={() => setConnectionMethod('web')}
              >
                <Text style={[
                  styles.connectionTypeText,
                  connectionMethod === 'web' && styles.connectionTypeTextActive
                ]}>Web Portal</Text>
              </TouchableOpacity>
            </View>

            {connectionMethod === 'ip' ? (
              <View>
                <Text style={styles.label}>Camera IP Address</Text>
                <TextInput
                  style={styles.input}
                  value={cameraIp}
                  onChangeText={setCameraIp}
                  placeholder="192.168.1.100"
                  keyboardType="numeric"
                  editable={!isConfiguring}
                />
                
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="admin"
                  autoCapitalize="none"
                  editable={!isConfiguring}
                />
                
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="admin"
                  secureTextEntry
                  editable={!isConfiguring}
                />
                
                <View style={styles.helpTextContainer}>
                  <Ionicons name="information-circle" size={20} color="#666" style={styles.infoIcon} />
                  <Text style={styles.helpText}>
                    Note: To use direct IP connection, RTSP/ONVIF must be enabled on your V380 camera.
                    Look for this setting in the V380 Pro app under Advanced Settings → Protocol Settings or Network Protocol.
                  </Text>
                  <TouchableOpacity onPress={showRtspEnableInstructions}>
                    <Text style={styles.linkText}>Can't find RTSP settings? Click here for SD card method</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : connectionMethod === 'qr' ? (
              <View>
                <Text style={styles.label}>V380 QR Code</Text>
                <TextInput
                  style={styles.input}
                  value={qrCode}
                  onChangeText={setQrCode}
                  placeholder="V380^DEVICE_ID^MODEL^..."
                  multiline
                  numberOfLines={3}
                  editable={!isConfiguring}
                />
                
                {deviceId ? (
                  <View style={styles.deviceIdContainer}>
                    <Text style={styles.deviceIdLabel}>Device ID:</Text>
                    <Text style={styles.deviceIdValue}>{deviceId}</Text>
                  </View>
                ) : null}
                
                <View style={styles.helpTextContainer}>
                  <Ionicons name="information-circle" size={20} color="#666" style={styles.infoIcon} />
                  <Text style={styles.helpText}>
                    Scan the QR code from your V380 Pro app or camera packaging.
                    In the V380 Pro app, you can find the QR code in camera settings → Device Information or by tapping the Share button.
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <View style={styles.helpTextContainer}>
                  <Ionicons name="information-circle" size={20} color="#666" style={styles.infoIcon} />
                  <Text style={styles.helpText}>
                    Connect directly to the V380 web portal using your V380 account credentials.
                    This is the recommended method if direct IP connection is not working.
                  </Text>
                </View>
                
                <View style={styles.webPortalInfo}>
                  <MaterialIcons name="cloud" size={24} color="#BC4A4D" style={styles.webIcon} />
                  <Text style={styles.webPortalText}>
                    You will be redirected to the V380 web portal to log in with your V380 account.
                    Make sure you have a V380 account and your camera is registered in the V380 app.
                  </Text>
                </View>
              </View>
            )}
            
            <View style={styles.statusContainer}>
              <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
              <Text style={styles.statusText}>{getStatusText()}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.connectButton}
              onPress={connectToCamera}
              disabled={isConfiguring}
            >
              {isConfiguring ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>
                  {connectionMethod === 'web' ? 'Open Web Portal' : 'Connect'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  scrollView: {
    maxHeight: '90%',
  },
  connectionTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  connectionTypeButton: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  connectionTypeButtonActive: {
    backgroundColor: '#BC4A4D',
  },
  connectionTypeText: {
    color: '#333',
    fontWeight: '500',
  },
  connectionTypeTextActive: {
    color: '#fff',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
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
  helpTextContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  helpText: {
    flex: 1,
    color: '#666',
    fontSize: 14,
  },
  deviceIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#e8f4fd',
    borderRadius: 5,
  },
  deviceIdLabel: {
    fontWeight: 'bold',
    marginRight: 5,
    color: '#333',
  },
  deviceIdValue: {
    color: '#0066cc',
    fontFamily: 'monospace',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    color: '#333',
  },
  connectButton: {
    backgroundColor: '#BC4A4D',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  webPortalInfo: {
    flexDirection: 'row',
    backgroundColor: '#f8f0f1',
    padding: 15,
    borderRadius: 5,
    marginBottom: 15,
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#BC4A4D',
  },
  webIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  webPortalText: {
    flex: 1,
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
  },
  linkText: {
    color: '#BC4A4D',
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 8,
    fontWeight: '500',
  },
});

export default V380CameraSettings;
