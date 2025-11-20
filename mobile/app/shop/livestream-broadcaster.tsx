import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import LiveStreamBroadcaster from '../../components/LiveStreamBroadcaster';

export default function LiveStreamBroadcasterScreen() {
  const { shopId, shopName } = useLocalSearchParams<{ shopId: string; shopName?: string }>();
  const router = useRouter();

  const handleEndStream = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={handleEndStream}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <LiveStreamBroadcaster
        shopId={shopId as string}
        onEndStream={handleEndStream}
        shopName={shopName as string}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    padding: 10,
  },
});
