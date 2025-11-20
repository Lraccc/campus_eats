import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, StatusBar, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import LiveStreamViewer from '../components/LiveStreamViewer';
import { API_URL } from '../config';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
}

export default function ViewLiveStreamScreen() {
  const params = useLocalSearchParams();
  const shopId = params.shopId as string;
  const shopName = params.shopName as string || 'Shop';
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [username, setUsername] = useState('Viewer');
  const [userId, setUserId] = useState('');
  const stompClient = useRef<Client | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadUserData();
    connectWebSocket();
    
    return () => {
      disconnectWebSocket();
    };
  }, [shopId]);

  const loadUserData = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      const storedUsername = await AsyncStorage.getItem('username');
      
      console.log('📝 Loaded user data:', { userId: storedUserId, username: storedUsername });
      
      if (storedUserId) setUserId(storedUserId);
      if (storedUsername) setUsername(storedUsername);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const connectWebSocket = () => {
    try {
      const socket = new SockJS(`${API_URL}/ws`);
      const client = new Client({
        webSocketFactory: () => socket as any,
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      client.onConnect = () => {
        console.log('💬 Chat WebSocket connected for shop:', shopId);
        console.log('🔌 WebSocket connection state:', client.connected);
        
        // Subscribe to chat messages for this shop's stream
        const subscription = client.subscribe(`/topic/stream/${shopId}/chat`, (message) => {
          console.log('📨 Received chat message:', message.body);
          const chatMessage = JSON.parse(message.body);
          console.log('✅ Parsed message:', chatMessage);
          
          const newMessage = {
            id: Date.now().toString() + Math.random(),
            userId: chatMessage.userId,
            username: chatMessage.username,
            message: chatMessage.message,
            timestamp: new Date(chatMessage.timestamp)
          };
          
          console.log('➕ Adding message to state:', newMessage);
          
          setMessages(prev => {
            const updated = [...prev, newMessage];
            console.log('📊 Total messages now:', updated.length);
            return updated;
          });
          
          // Auto-scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        });
      };

      client.onStompError = (frame) => {
        console.error('Chat WebSocket error:', frame);
      };

      client.activate();
      stompClient.current = client;
    } catch (error) {
      console.error('Error connecting to chat:', error);
    }
  };

  const disconnectWebSocket = () => {
    if (stompClient.current) {
      stompClient.current.deactivate();
      stompClient.current = null;
    }
  };

  const sendMessage = () => {
    console.log('🔵 Send message called:', { input: messageInput, connected: stompClient.current?.connected });
    
    if (!messageInput.trim()) {
      console.log('⚠️ Empty message, not sending');
      return;
    }
    
    if (!stompClient.current?.connected) {
      console.log('❌ WebSocket not connected');
      return;
    }

    const chatMessage = {
      userId: userId || 'anonymous',
      username: username || 'Viewer',
      message: messageInput.trim(),
      timestamp: new Date().toISOString(),
    };

    console.log('📤 Sending message:', chatMessage);
    console.log('📍 To destination:', `/app/stream/${shopId}/chat`);

    stompClient.current.publish({
      destination: `/app/stream/${shopId}/chat`,
      body: JSON.stringify(chatMessage),
    });

    setMessageInput('');
    console.log('✅ Message sent and input cleared');
  };

  const handleClose = () => {
    router.back();
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.userId === userId;
    
    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessage]}>
        <Text style={styles.messageUsername}>{item.username}</Text>
        <Text style={styles.messageText}>{item.message}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>{shopName} - Live</Text>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Live Stream Video */}
      <View style={styles.videoContainer}>
        <LiveStreamViewer 
          shopId={shopId}
          onClose={handleClose}
          shopName={shopName}
          hideHeader={true}
          hideCloseButton={true}
        />
      </View>

      {/* Chat Section */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatSection}
        keyboardVerticalOffset={90}
      >
        <View style={styles.chatHeader}>
          <Ionicons name="chatbubbles" size={20} color="#fff" />
          <Text style={styles.chatHeaderText}>Live Chat</Text>
          <Text style={styles.viewerCount}>{messages.length} messages</Text>
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-outline" size={40} color="#666" />
            <Text style={styles.emptyChatText}>No messages yet</Text>
            <Text style={styles.emptyChatSubtext}>Be the first to say something!</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            value={messageInput}
            onChangeText={setMessageInput}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity 
            style={[styles.sendButton, !messageInput.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!messageInput.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#BC4A4D',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 4,
  },
  headerText: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  videoContainer: {
    height: 300,
    backgroundColor: '#000',
  },
  chatSection: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  chatHeaderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  viewerCount: {
    color: '#999',
    fontSize: 12,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 12,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyChatText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyChatSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  messageContainer: {
    backgroundColor: '#2a2a2a',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#BC4A4D',
  },
  messageUsername: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  messageTime: {
    color: '#999',
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 14,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#BC4A4D',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#555',
  },
});
