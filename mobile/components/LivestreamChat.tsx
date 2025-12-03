import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { useAuthentication, AUTH_TOKEN_KEY } from '../services/authService';
import axios from 'axios';
import { filterBadWords } from '../utils/badWordFilter';

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
  const subscriptionRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const isSendingRef = useRef(false);

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
      console.log('📚 [CHAT] Loading chat history for:', channelName);
      
      // Fetch existing messages from backend
      const token = await getAccessToken();
      const response = await axios.get(`${API_URL}/api/livestream/${channelName}/messages`, {
        headers: {
          'Authorization': token || ''
        }
      });
      
      if (response.data && Array.isArray(response.data)) {
        console.log(`✅ [CHAT] Loaded ${response.data.length} existing messages`);
        
        // Filter bad words from historical messages
        const filteredMessages = response.data.map((msg: ChatMessage) => ({
          ...msg,
          message: filterBadWords(msg.message)
        }));
        
        setMessages(filteredMessages);
        
        // Auto-scroll to bottom after loading history
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      } else {
        console.log('📭 [CHAT] No existing messages found, starting fresh');
        setMessages([]);
      }
    } catch (error) {
      console.error('❌ [CHAT] Error loading chat history:', error);
      // Start with empty messages if we can't load history
      setMessages([]);
    }
  };

  /**
   * Connect to WebSocket for real-time messages
   */
  const connectWebSocket = async () => {
    console.log('🔌 [CHAT] Connecting to WebSocket for channel:', channelName);
    
    // Prevent duplicate connections
    if (stompClientRef.current?.connected) {
      console.log('⚠️ [CHAT] Already connected, skipping connection');
      return;
    }
    
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

        // Unsubscribe from any existing subscription first
        if (subscriptionRef.current) {
          console.log('⚠️ [CHAT] Unsubscribing from previous subscription to prevent duplicates');
          try {
            subscriptionRef.current.unsubscribe();
          } catch (err) {
            console.log('⚠️ [CHAT] Error unsubscribing:', err);
          }
          subscriptionRef.current = null;
        }

        // Subscribe to chat messages for this channel and store the subscription
        subscriptionRef.current = client.subscribe(`/topic/livestream/${channelName}/chat`, (message) => {
          console.log('📨 [CHAT] Message received from WebSocket:', message.body);
          const chatMessage: ChatMessage = JSON.parse(message.body);
          
          // Filter bad words from the message
          const originalMessage = chatMessage.message;
          chatMessage.message = filterBadWords(chatMessage.message);
          
          if (originalMessage !== chatMessage.message) {
            console.log('🚫 [CHAT] Bad words filtered in message:', chatMessage.id);
          }
          
          // Prevent duplicate messages by checking if message ID already exists
          setMessages(prev => {
            const isDuplicate = prev.some(msg => msg.id === chatMessage.id);
            if (isDuplicate) {
              console.log('⚠️ [CHAT] Duplicate message detected, ignoring:', chatMessage.id);
              return prev;
            }
            console.log('✅ [CHAT] Adding new message:', chatMessage.id);
            return [...prev, chatMessage];
          });
          
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
    console.log('🔌 [CHAT] Disconnecting chat...');
    
    // Unsubscribe first
    if (subscriptionRef.current) {
      console.log('📤 [CHAT] Unsubscribing from chat topic');
      try {
        subscriptionRef.current.unsubscribe();
      } catch (err) {
        console.log('⚠️ [CHAT] Error unsubscribing:', err);
      }
      subscriptionRef.current = null;
    }
    
    // Then deactivate client
    if (stompClientRef.current) {
      console.log('🔌 [CHAT] Deactivating STOMP client');
      try {
        stompClientRef.current.deactivate();
      } catch (err) {
        console.log('⚠️ [CHAT] Error deactivating client:', err);
      }
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
    console.log('   - Is already sending:', isSendingRef.current);
    
    if (!inputMessage.trim() || isBroadcaster || isSendingRef.current) {
      console.log('❌ [CHAT] Message blocked - empty, broadcaster, or already sending');
      return;
    }

    // Prevent duplicate sends
    isSendingRef.current = true;

    try {
      console.log('📡 [CHAT] Fetching user data...');
      const userData = await getUserData();
      console.log('   - User data:', userData);
      
      if (!userData) {
        console.error('❌ [CHAT] No user data available');
        isSendingRef.current = false;
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
        
        // Reset sending flag after a short delay
        setTimeout(() => {
          isSendingRef.current = false;
        }, 500);
      } else {
        console.error('❌ [CHAT] WebSocket not connected, cannot send message');
        isSendingRef.current = false;
      }
    } catch (error) {
      console.error('❌ [CHAT] Error sending message:', error);
      isSendingRef.current = false;
    }
  };

  /**
   * Format timestamp to local time
   */
  const formatTimestamp = (timestamp: string) => {
    try {
      // Backend now sends Instant (UTC) as ISO-8601 string
      // JavaScript Date will automatically convert to local timezone
      const date = new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid timestamp:', timestamp);
        return new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      
      // This will display in user's local timezone
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
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
          {formatTimestamp(item.timestamp)}
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
