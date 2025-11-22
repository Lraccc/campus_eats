import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Client } from '@stomp/stompjs';
import { API_URL } from '../config';
import { useAuthentication } from '../services/authService';
import axios from 'axios';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
  profilePictureUrl?: string;
}

interface LivestreamChatProps {
  channelName: string;
  isBroadcaster: boolean;
  shopName?: string;
}

const LivestreamChat: React.FC<LivestreamChatProps> = ({ 
  channelName, 
  isBroadcaster,
  shopName 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const { getAccessToken, getUserData } = useAuthentication();
  const stompClientRef = useRef<Client | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    initializeChat();
    return () => {
      disconnectChat();
    };
  }, [channelName]);

  /**
   * Initialize WebSocket connection and load chat history
   */
  const initializeChat = async () => {
    try {
      // Load existing messages
      await loadChatHistory();

      // Connect to WebSocket
      connectWebSocket();
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  };

  /**
   * Load chat history from backend
   */
  const loadChatHistory = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/livestream/${channelName}/messages`
      );
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  /**
   * Connect to WebSocket for real-time messages
   */
  const connectWebSocket = () => {
    const wsUrl = API_URL.replace('http', 'ws') + '/ws';
    
    const client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      
      onConnect: () => {
        console.log('💬 Chat WebSocket connected');
        setIsConnected(true);

        // Subscribe to chat messages for this channel
        client.subscribe(`/topic/livestream/${channelName}/chat`, (message) => {
          const chatMessage: ChatMessage = JSON.parse(message.body);
          setMessages(prev => [...prev, chatMessage]);
          
          // Auto-scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        });
      },
      
      onDisconnect: () => {
        console.log('💬 Chat WebSocket disconnected');
        setIsConnected(false);
      },
      
      onStompError: (frame) => {
        console.error('Chat WebSocket error:', frame);
        setIsConnected(false);
      }
    });

    client.activate();
    stompClientRef.current = client;
  };

  /**
   * Disconnect WebSocket
   */
  const disconnectChat = () => {
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
      stompClientRef.current = null;
    }
  };

  /**
   * Send a chat message (viewers only)
   */
  const sendMessage = async () => {
    if (!inputMessage.trim() || isBroadcaster) return;

    try {
      const userData = await getUserData();
      if (!userData) return;

      const messagePayload = {
        userId: userData.id,
        username: userData.username,
        message: inputMessage.trim(),
        profilePictureUrl: userData.profilePictureUrl
      };

      // Send via WebSocket
      if (stompClientRef.current?.connected) {
        stompClientRef.current.publish({
          destination: `/app/livestream/${channelName}/chat`,
          body: JSON.stringify(messagePayload)
        });

        setInputMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  /**
   * Render a single chat message
   */
  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.messageContainer}>
      <View style={styles.messageHeader}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
      <Text style={styles.messageText}>{item.message}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Chat Header */}
      <View style={styles.header}>
        <Ionicons name="chatbubbles" size={20} color="#fff" />
        <Text style={styles.headerText}>
          {isBroadcaster ? 'Chat (View Only)' : 'Live Chat'}
        </Text>
        <View style={[styles.statusDot, isConnected && styles.statusConnected]} />
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input (Viewers Only) */}
      {!isBroadcaster && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputMessage}
              onChangeText={setInputMessage}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              maxLength={200}
              multiline
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputMessage.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!inputMessage.trim()}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Broadcaster Info */}
      {isBroadcaster && (
        <View style={styles.broadcasterInfo}>
          <Ionicons name="eye-off" size={16} color="#666" />
          <Text style={styles.broadcasterInfoText}>
            You can view chat but cannot send messages
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
  },
  statusConnected: {
    backgroundColor: '#4CAF50',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
  },
  messageContainer: {
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 8,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  username: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  timestamp: {
    color: '#999',
    fontSize: 10,
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 14,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#666',
  },
  broadcasterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 152, 0, 0.3)',
  },
  broadcasterInfoText: {
    color: '#FF9800',
    fontSize: 12,
    marginLeft: 8,
  },
});

export default LivestreamChat;
