import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { useAuthentication, AUTH_TOKEN_KEY } from '../services/authService';
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
    console.log('🚀 [CHAT] Initializing chat component');
    console.log('   - Channel:', channelName);
    console.log('   - Is broadcaster:', isBroadcaster);
    
    try {
      // Load existing messages
      await loadChatHistory();

      // Connect to WebSocket
      connectWebSocket();
    } catch (error) {
      console.error('❌ [CHAT] Error initializing chat:', error);
    }
  };

  /**
   * Load chat history from backend
   */
  const loadChatHistory = async () => {
    try {
      // Don't load old messages - each livestream session should start fresh
      console.log('📚 [CHAT] Starting fresh chat session for:', channelName);
      setMessages([]);
    } catch (error) {
      console.error('❌ [CHAT] Error initializing chat:', error);
    }
  };

  /**
   * Connect to WebSocket for real-time messages
   */
  const connectWebSocket = async () => {
    console.log('🔌 [CHAT] Connecting to WebSocket for channel:', channelName);
    
    // Get authentication token (same as working shop orders WebSocket)
    let token;
    try {
      token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }
      if (!token) {
        console.log('❌ [CHAT] No token available for WebSocket connection');
        return;
      }
    } catch (error) {
      console.error('❌ [CHAT] Error getting token:', error);
      return;
    }

    // Use SockJS like the working shop orders WebSocket
    const wsUrl = API_URL + '/ws';
    console.log('🔗 [CHAT] WebSocket URL:', wsUrl);
    const socket = new SockJS(wsUrl);
    
    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        'Authorization': token
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      
      // Enable debug logging
      debug: (str) => {
        if (str.includes('connected') || str.includes('error') || str.includes('disconnect')) {
          console.log('🔧 [CHAT] STOMP Debug:', str);
        }
      },
      
      onConnect: () => {
        console.log('✅ [CHAT] WebSocket connected successfully');
        console.log('   - Subscribing to /topic/livestream/' + channelName + '/chat');
        setIsConnected(true);

        // Subscribe to chat messages for this channel
        client.subscribe(`/topic/livestream/${channelName}/chat`, (message) => {
          console.log('📨 [CHAT] Message received from WebSocket:', message.body);
          const chatMessage: ChatMessage = JSON.parse(message.body);
          setMessages(prev => [...prev, chatMessage]);
          
          // Auto-scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        });
        
        console.log('✅ [CHAT] Subscribed to chat topic');
      },
      
      onDisconnect: () => {
        console.log('❌ [CHAT] WebSocket disconnected');
        setIsConnected(false);
      },
      
      onStompError: (frame) => {
        console.error('❌ [CHAT] WebSocket STOMP error:', frame);
        console.error('   - Headers:', frame.headers);
        console.error('   - Body:', frame.body);
        setIsConnected(false);
      },
      
      onWebSocketError: (event) => {
        console.error('❌ [CHAT] WebSocket connection error:', event);
      },
      
      onWebSocketClose: (event) => {
        console.log('🔌 [CHAT] WebSocket closed:', event.code, event.reason);
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
    console.log('💬 [CHAT] Send message called');
    console.log('   - Input message:', inputMessage);
    console.log('   - Is broadcaster:', isBroadcaster);
    
    if (!inputMessage.trim() || isBroadcaster) {
      console.log('❌ [CHAT] Message blocked - empty or broadcaster');
      return;
    }

    try {
      console.log('📡 [CHAT] Fetching user data...');
      const userData = await getUserData();
      console.log('   - User data:', userData);
      
      if (!userData) {
        console.error('❌ [CHAT] No user data available');
        return;
      }

      const messagePayload = {
        userId: userData.id,
        username: userData.username,
        message: inputMessage.trim(),
        profilePictureUrl: userData.profilePictureUrl
      };
      
      console.log('📦 [CHAT] Message payload:', messagePayload);
      console.log('🔌 [CHAT] WebSocket connected:', stompClientRef.current?.connected);

      // Send via WebSocket
      if (stompClientRef.current?.connected) {
        console.log('📤 [CHAT] Publishing to /app/livestream/' + channelName + '/chat');
        stompClientRef.current.publish({
          destination: `/app/livestream/${channelName}/chat`,
          body: JSON.stringify(messagePayload)
        });
        console.log('✅ [CHAT] Message published successfully');

        // Clear input immediately but don't add to messages yet
        // Wait for WebSocket to broadcast back to avoid duplicates
        setInputMessage('');
      } else {
        console.error('❌ [CHAT] WebSocket not connected, cannot send message');
      }
    } catch (error) {
      console.error('❌ [CHAT] Error sending message:', error);
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
      {/* Compact Chat Header */}
      <View style={styles.header}>
        <Ionicons name="chatbubbles" size={16} color="#fff" />
        <Text style={styles.headerText}>
          {isBroadcaster ? 'Chat (View Only)' : 'Chat'}
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
        inverted={false}
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
              onPress={() => {
                console.log('🔘 [CHAT] Send button pressed');
                sendMessage();
              }}
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
    maxHeight: 300,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
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
    maxHeight: 200,
  },
  messagesContent: {
    padding: 8,
    paddingBottom: 4,
  },
  messageContainer: {
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 6,
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
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
