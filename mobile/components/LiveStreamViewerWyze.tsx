import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useAuthentication } from '../services/authService';
import { getStreamUrl } from '../services/wyzeCameraService';

interface LiveStreamViewerWyzeProps {
  shopId: string;
  onClose: () => void;
  shopName?: string;
}

const LiveStreamViewerWyze: React.FC<LiveStreamViewerWyzeProps> = ({ 
  shopId, 
  onClose, 
  shopName = 'Shop' 
}) => {
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStreamLoading, setIsStreamLoading] = useState(true);
  const [streamType, setStreamType] = useState<'rtsp' | 'hls' | 'http'>('hls');
  const { getAccessToken } = useAuthentication();
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    fetchStreamUrl();

    // Force hide loading after timeout
    const timeout = setTimeout(() => {
      if (isStreamLoading) {
        console.log('Force hiding loading after timeout');
        setIsStreamLoading(false);
      }
    }, 10000); // 10 seconds

    return () => clearTimeout(timeout);
  }, [shopId]);

  const fetchStreamUrl = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      console.log('Fetching stream URL for shopId:', shopId);

      const streamData = await getStreamUrl(shopId, token || '');

      if (streamData && streamData.rtspUrl) {
        console.log('Stream URL loaded:', streamData.type);
        
        // Prefer HLS over RTSP for better mobile compatibility
        const url = streamData.hlsUrl || streamData.rtspUrl;
        
        setStreamUrl(url);
        setStreamType(streamData.type);
        setIsStreamActive(true);
      } else {
        console.log('No stream configured for this shop');
        setError('This shop currently has no active stream');
        setIsStreamActive(false);
      }
    } catch (error: any) {
      console.error('Error fetching stream URL:', error);
      
      if (error.response?.status === 404) {
        setError('This shop currently has no active stream');
      } else {
        setError('Could not load stream. Please try again later.');
      }
      
      setIsStreamActive(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (isStreamLoading) {
        console.log('Video loaded and playing');
        setIsStreamLoading(false);
        setError(null);
      }
    } else {
      // Status is not loaded - could be an error
      console.error('Video playback error or not loaded');
      setIsStreamLoading(false);
      setError('Failed to load stream');
    }
  };

  const retryStream = async () => {
    setError(null);
    setIsStreamLoading(true);
    
    if (videoRef.current && streamUrl) {
      try {
        await videoRef.current.unloadAsync();
        await videoRef.current.loadAsync({ uri: streamUrl }, {}, false);
        await videoRef.current.playAsync();
      } catch (error) {
        console.error('Error retrying stream:', error);
        setError('Failed to reconnect. Please try again.');
        setIsStreamLoading(false);
      }
    } else {
      // Refetch stream URL
      await fetchStreamUrl();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>{shopName} - Live Stream</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stream Container */}
      <View style={styles.streamContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#BC4A4D" />
            <Text style={styles.loadingText}>Loading stream...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="videocam-off" size={64} color="#BC4A4D" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryStream}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : streamUrl && isStreamActive ? (
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
              <View style={[styles.loadingOverlay, StyleSheet.absoluteFill]}>
                <ActivityIndicator size="large" color="#BC4A4D" />
                <Text style={styles.loadingText}>Connecting to stream...</Text>
                <Text style={styles.loadingSubText}>
                  {streamType === 'rtsp' 
                    ? 'Loading RTSP stream...' 
                    : 'Loading HLS stream...'}
                </Text>
              </View>
            )}

            {/* Live Indicator */}
            {!isStreamLoading && !error && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.offlineContainer}>
            <Ionicons name="videocam-outline" size={64} color="#999" />
            <Text style={styles.offlineText}>Stream is not available</Text>
            <Text style={styles.offlineSubText}>
              The shop owner hasn't started streaming yet
            </Text>
          </View>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            {isStreamActive 
              ? 'You are viewing the live food display'
              : 'Live stream will appear when shop starts broadcasting'}
          </Text>
        </View>
        
        {streamType === 'rtsp' && isStreamActive && (
          <View style={styles.warningRow}>
            <Ionicons name="warning-outline" size={18} color="#FF9800" />
            <Text style={styles.warningText}>
              If stream doesn't load, the shop may need to enable HLS streaming
            </Text>
          </View>
        )}
      </View>

      {/* Close Button */}
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
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  streamContainer: {
    marginTop: 20,
    marginHorizontal: 15,
    height: Dimensions.get('window').height * 0.4,
    backgroundColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
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
  loadingSubText: {
    color: '#999',
    fontSize: 12,
    marginTop: 5,
  },
  loadingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 15,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
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
    padding: 20,
  },
  offlineText: {
    color: 'white',
    fontSize: 18,
    marginTop: 15,
  },
  offlineSubText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
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
  infoSection: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    color: '#E65100',
    fontSize: 12,
    lineHeight: 16,
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
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 24,
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

export default LiveStreamViewerWyze;
