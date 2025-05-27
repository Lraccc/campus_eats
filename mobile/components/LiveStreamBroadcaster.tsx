import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions } from 'react-native';
import { useAuthentication } from '../services/authService';
import { API_URL } from '../config';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

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
  }, [shopId]);

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

  return (
    <View style={styles.container}>
      {/* Stream View */}
      <View style={styles.streamContainer}>
        <TouchableOpacity style={styles.endButton} onPress={endStream}>
          <Ionicons name="close-circle" size={32} color="#BC4A4D" />
          <Text style={styles.endButtonText}>End Stream</Text>
        </TouchableOpacity>
        <View style={styles.streamPlaceholder}>
          <Text style={styles.streamText}>Live Stream</Text>
        </View>
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