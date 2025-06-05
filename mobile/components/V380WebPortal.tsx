import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { v380CameraService, V380_CONFIG } from '../services/v380CameraService';
import { CameraConnectionStatus } from '../services/cameraService';

interface V380WebPortalProps {
  onClose: () => void;
  onConnected: (streamUrl: string) => void;
}

const V380WebPortal: React.FC<V380WebPortalProps> = ({ onClose, onConnected }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [showLoginForm, setShowLoginForm] = useState<boolean>(true);
  const [v380Username, setV380Username] = useState<string>('');
  const [v380Password, setV380Password] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<CameraConnectionStatus>(
    CameraConnectionStatus.DISCONNECTED
  );
  const [webViewUrl, setWebViewUrl] = useState<string>('');
  
  const webViewRef = useRef<WebView>(null);
  
  // Handle login to V380 portal
  const handleLogin = async () => {
    try {
      if (!v380Username || !v380Password) {
        Alert.alert('Error', 'Please enter your V380 account username and password');
        return;
      }
      
      setIsLoggingIn(true);
      setConnectionStatus(CameraConnectionStatus.CONNECTING);
      
      // Configure V380 account credentials
      v380CameraService.configureV380Account(v380Username, v380Password);
      
      // Try to login
      const success = await v380CameraService.loginToV380Portal();
      
      if (success) {
        // Get device list
        const devices = await v380CameraService.getV380DeviceList();
        
        if (devices.length > 0) {
          setConnectionStatus(CameraConnectionStatus.CONNECTED);
          setShowLoginForm(false);
          
          // Load the direct live view URL in WebView
          setWebViewUrl(v380CameraService.getDirectLiveViewUrl());
          
          // Notify parent component that we're connected
          onConnected(v380CameraService.getDirectLiveViewUrl());
        } else {
          Alert.alert('No Devices', 'No V380 cameras found in your account');
          setConnectionStatus(CameraConnectionStatus.ERROR);
        }
      } else {
        Alert.alert('Login Failed', 'Could not login to V380 portal. Please check your credentials.');
        setConnectionStatus(CameraConnectionStatus.ERROR);
      }
    } catch (error) {
      console.error('V380 login error:', error);
      Alert.alert('Error', 'Failed to connect to V380 portal');
      setConnectionStatus(CameraConnectionStatus.ERROR);
    } finally {
      setIsLoggingIn(false);
    }
  };
  
  // Handle WebView load end
  const handleLoadEnd = () => {
    setLoading(false);
  };
  
  // Handle WebView error
  const handleError = () => {
    setLoading(false);
    Alert.alert('Connection Error', 'Failed to load V380 web portal');
  };
  
  // Inject JavaScript to handle authentication
  const injectJavaScript = `
    // This would contain JavaScript to handle V380 web portal authentication
    // In a real implementation, we would inject credentials or handle login flow
    console.log('V380 WebView loaded');
    true;
  `;
  
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
  
  // Render login form
  const renderLoginForm = () => (
    <View style={styles.loginFormContainer}>
      <Text style={styles.loginTitle}>V380 Pro Account Login</Text>
      
      <Text style={styles.label}>V380 Username/Email</Text>
      <TextInput
        style={styles.input}
        value={v380Username}
        onChangeText={setV380Username}
        placeholder="Your V380 account email or username"
        autoCapitalize="none"
        editable={!isLoggingIn}
      />
      
      <Text style={styles.label}>V380 Password</Text>
      <TextInput
        style={styles.input}
        value={v380Password}
        onChangeText={setV380Password}
        placeholder="Your V380 account password"
        secureTextEntry
        editable={!isLoggingIn}
      />
      
      <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>
      
      <View style={styles.helpTextContainer}>
        <Ionicons name="information-circle" size={20} color="#666" style={styles.infoIcon} />
        <Text style={styles.helpText}>
          Log in with your V380 Pro app account credentials to access your camera.
        </Text>
      </View>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={onClose}
          disabled={isLoggingIn}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={handleLogin}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={styles.directLinkButton}
        onPress={() => {
          setShowLoginForm(false);
          setWebViewUrl(V380_CONFIG.WEB_PORTAL_URL);
        }}
      >
        <Text style={styles.directLinkText}>Open V380 Web Portal Directly</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render WebView
  const renderWebView = () => (
    <View style={styles.webViewContainer}>
      <View style={styles.webViewHeader}>
        <TouchableOpacity onPress={() => setShowLoginForm(true)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      <WebView
        ref={webViewRef}
        source={{ uri: webViewUrl }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        injectedJavaScript={injectJavaScript}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#BC4A4D" />
            <Text style={styles.loadingText}>Loading V380 Portal...</Text>
          </View>
        )}
      />
    </View>
  );
  
  return (
    <Modal
      visible={true}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {showLoginForm ? renderLoginForm() : renderWebView()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loginFormContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
  },
  helpTextContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#BC4A4D',
    padding: 12,
    borderRadius: 5,
    flex: 1,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 16,
  },
  directLinkButton: {
    marginTop: 20,
    padding: 10,
    alignItems: 'center',
  },
  directLinkText: {
    color: '#BC4A4D',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  webViewContainer: {
    flex: 1,
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
  },
  backButtonText: {
    marginLeft: 5,
    fontSize: 16,
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    color: '#333',
  },
});

export default V380WebPortal;
