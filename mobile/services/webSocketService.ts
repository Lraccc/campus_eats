import AsyncStorage from '@react-native-async-storage/async-storage';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { API_URL } from '../config';
import { AUTH_TOKEN_KEY } from './authService';
import { walletService, WalletData } from './walletService';

interface WebSocketMessage {
    type: 'WALLET_UPDATE' | 'PROFILE_UPDATE' | 'ORDER_UPDATE' | 'STREAMING_STATUS';
    userId?: string;
    shopId?: string;
    data: any;
}

/**
 * WebSocket service for real-time notifications using STOMP
 */
export class WebSocketService {
    private static instance: WebSocketService;
    private stompClient: Client | null = null;
    private subscriptions: StompSubscription[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000; // Start with 1 second
    private isConnecting = false;
    private currentUserId: string | null = null;
    private currentAccountType: string | null = null;

    private constructor() {}

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    /**
     * Connect to WebSocket server
     */
    public async connect(userId: string, accountType: string): Promise<void> {
        if (this.isConnecting || (this.stompClient && this.stompClient.connected)) {
            return;
        }

        this.isConnecting = true;
        this.currentUserId = userId;
        this.currentAccountType = accountType;

        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) {
                console.warn('No authentication token found');
            }

            // Convert HTTP URL to WebSocket URL for SockJS
            const sockJSUrl = API_URL + '/ws';
            console.log('Connecting to WebSocket via SockJS:', sockJSUrl);

            // Create STOMP client with SockJS
            this.stompClient = new Client({
                webSocketFactory: () => new SockJS(sockJSUrl),
                connectHeaders: token ? {
                    Authorization: token,
                } : {},
                debug: (str) => {
                    console.log('STOMP Debug:', str);
                },
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
            });

            // Set up connection handlers
            this.stompClient.onConnect = (frame) => {
                console.log('STOMP connected:', frame);
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;

                // Subscribe to user-specific updates
                this.subscribeToUpdates(userId, accountType);
            };

            this.stompClient.onStompError = (frame) => {
                console.error('STOMP error:', frame);
                this.isConnecting = false;
            };

            this.stompClient.onWebSocketClose = (event) => {
                console.log('WebSocket closed:', event);
                this.isConnecting = false;
                
                // Attempt to reconnect if not a manual close
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            };

            this.stompClient.onWebSocketError = (event) => {
                console.error('WebSocket error:', event);
                this.isConnecting = false;
            };

            // Activate the client
            this.stompClient.activate();

        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            this.isConnecting = false;
        }
    }

    /**
     * Subscribe to user-specific updates
     */
    private subscribeToUpdates(userId: string, accountType: string): void {
        if (!this.stompClient || !this.stompClient.connected) {
            return;
        }

        // Clear existing subscriptions
        this.unsubscribeAll();

        // Subscribe to wallet updates for the specific user
        const walletSubscription = this.stompClient.subscribe(
            `/topic/wallet/${userId}`,
            (message) => {
                try {
                    const data = JSON.parse(message.body);
                    console.log('Received wallet update:', data);
                    
                    // The backend sends message with userId, accountType, newBalance, etc.
                    this.handleWalletUpdate({
                        type: 'WALLET_UPDATE',
                        userId: data.userId || userId,
                        data: data
                    });
                } catch (error) {
                    console.error('Error parsing wallet update message:', error);
                }
            }
        );

        // Subscribe to profile updates for the specific user
        const profileSubscription = this.stompClient.subscribe(
            `/topic/profile/${userId}`,
            (message) => {
                try {
                    const data = JSON.parse(message.body);
                    console.log('Received profile update:', data);
                    this.handleProfileUpdate({
                        type: 'PROFILE_UPDATE',
                        userId: userId,
                        data: data
                    });
                } catch (error) {
                    console.error('Error parsing profile update message:', error);
                }
            }
        );

        // Subscribe to order updates for the specific user
        const orderSubscription = this.stompClient.subscribe(
            `/topic/orders/${userId}`,
            (message) => {
                try {
                    const data = JSON.parse(message.body);
                    console.log('Received order update:', data);
                    this.handleOrderUpdate({
                        type: 'ORDER_UPDATE',
                        userId: userId,
                        data: data
                    });
                } catch (error) {
                    console.error('Error parsing order update message:', error);
                }
            }
        );

        // Subscribe to streaming status updates (global - all shops)
        const streamingStatusSubscription = this.stompClient.subscribe(
            `/topic/streaming/status`,
            (message) => {
                try {
                    const data = JSON.parse(message.body);
                    console.log('Received streaming status update:', data);
                    this.handleStreamingStatusUpdate({
                        type: 'STREAMING_STATUS',
                        shopId: data.shopId,
                        data: data
                    });
                } catch (error) {
                    console.error('Error parsing streaming status message:', error);
                }
            }
        );

        let additionalSubscriptions: StompSubscription[] = [];

        // Additional subscriptions for dashers
        if (accountType === 'dasher') {
            console.log('Setting up additional dasher subscriptions for order updates...');
            
            // Subscribe to general order status updates (for ready for pickup orders)
            const generalOrderSubscription = this.stompClient.subscribe(
                `/topic/orders/status-updates`,
                (message) => {
                    try {
                        const data = JSON.parse(message.body);
                        console.log('Received general order status update:', data);
                        
                        // Only process orders that are ready for pickup or relevant to dashers
                        if (data.status === 'active_ready_for_pickup' || 
                            data.status === 'active_waiting_for_dasher' ||
                            data.status === 'active_out_for_delivery' ||
                            data.dasherId === userId) {
                            console.log('Processing dasher-relevant order update:', data);
                            this.handleOrderUpdate({
                                type: 'ORDER_UPDATE',
                                userId: userId,
                                data: data
                            });
                        }
                    } catch (error) {
                        console.error('Error parsing general order status update:', error);
                    }
                }
            );

            // Subscribe to ready-for-pickup specific topic
            const readyForPickupSubscription = this.stompClient.subscribe(
                `/topic/orders/ready-for-pickup`,
                (message) => {
                    try {
                        const data = JSON.parse(message.body);
                        console.log('Received ready-for-pickup order update:', data);
                        this.handleOrderUpdate({
                            type: 'ORDER_UPDATE',
                            userId: userId,
                            data: data
                        });
                    } catch (error) {
                        console.error('Error parsing ready-for-pickup message:', error);
                    }
                }
            );

            // Subscribe to all order updates (fallback)
            const allOrdersSubscription = this.stompClient.subscribe(
                `/topic/orders/all`,
                (message) => {
                    try {
                        const data = JSON.parse(message.body);
                        console.log('Received all-orders update:', data);
                        
                        // Filter for dasher-relevant updates
                        if (data.status === 'active_ready_for_pickup' || 
                            data.status === 'active_waiting_for_dasher' ||
                            data.dasherId === userId ||
                            !data.dasherId) { // Orders without assigned dasher
                            console.log('Processing relevant order from all-orders topic:', data);
                            this.handleOrderUpdate({
                                type: 'ORDER_UPDATE',
                                userId: userId,
                                data: data
                            });
                        }
                    } catch (error) {
                        console.error('Error parsing all-orders message:', error);
                    }
                }
            );

            additionalSubscriptions = [generalOrderSubscription, readyForPickupSubscription, allOrdersSubscription];
        }

        // Store subscriptions for cleanup
        this.subscriptions.push(walletSubscription, profileSubscription, orderSubscription, streamingStatusSubscription, ...additionalSubscriptions);
        
        console.log('Subscribed to updates for user:', userId, 'accountType:', accountType);
    }

    /**
     * Unsubscribe from all current subscriptions
     */
    private unsubscribeAll(): void {
        this.subscriptions.forEach(subscription => {
            try {
                subscription.unsubscribe();
            } catch (error) {
                console.error('Error unsubscribing:', error);
            }
        });
        this.subscriptions = [];
    }

    /**
     * Handle wallet update messages
     */
    private handleWalletUpdate(message: WebSocketMessage): void {
        if (message.userId === this.currentUserId && this.currentAccountType) {
            // Extract wallet balance from the backend message format
            const newBalance = message.data.newBalance || message.data.wallet || 0;
            
            const walletData: WalletData = {
                wallet: newBalance,
                accountType: this.currentAccountType,
                userId: message.userId
            };

            console.log('Updating wallet from WebSocket:', walletData);

            // Notify the wallet service about the update
            walletService.notifyWalletChange(walletData);
        }
    }

    /**
     * Handle profile update messages
     */
    private handleProfileUpdate(message: WebSocketMessage): void {
        console.log('Profile update received:', message.data);
        // Handle profile updates here if needed
    }

    /**
     * Handle order update messages
     */
    private handleOrderUpdate(message: WebSocketMessage): void {
        console.log('Order update received:', message.data);
        
        // Enhanced logging for dasher-specific updates
        if (this.currentAccountType === 'dasher') {
            console.log(`🚛 Dasher ${this.currentUserId} received order update:`, {
                orderId: message.data.id || message.data.orderId,
                status: message.data.status,
                dasherId: message.data.dasherId,
                isReadyForPickup: message.data.status === 'active_ready_for_pickup'
            });
        }
        
        // Emit events for both web and React Native
        if (typeof window !== 'undefined') {
            // Web environment
            const orderUpdateEvent = new CustomEvent('orderUpdate', {
                detail: {
                    userId: message.userId,
                    data: message.data,
                    accountType: this.currentAccountType
                }
            });
            window.dispatchEvent(orderUpdateEvent);
        }
        
        // React Native environment - emit using DeviceEventEmitter
        try {
            // Import DeviceEventEmitter dynamically to avoid issues in web environment
            const { DeviceEventEmitter } = require('react-native');
            DeviceEventEmitter.emit('orderUpdate', {
                userId: message.userId,
                accountType: this.currentAccountType,
                timestamp: new Date().toISOString(),
                ...message.data
            });
            
            // Special event for ready-for-pickup orders for dashers
            if (this.currentAccountType === 'dasher' && message.data.status === 'active_ready_for_pickup') {
                console.log('🎯 Emitting special ready-for-pickup event for dasher');
                DeviceEventEmitter.emit('orderReadyForPickup', {
                    userId: message.userId,
                    orderId: message.data.id || message.data.orderId,
                    status: message.data.status,
                    timestamp: new Date().toISOString(),
                    ...message.data
                });
            }
        } catch (error) {
            // DeviceEventEmitter not available (likely in web environment)
            console.log('DeviceEventEmitter not available, using web events only');
        }
    }

    /**
     * Handle streaming status update messages
     */
    private handleStreamingStatusUpdate(message: WebSocketMessage): void {
        console.log('Streaming status update received:', message.data);
        
        // Emit events for React Native
        try {
            const { DeviceEventEmitter } = require('react-native');
            DeviceEventEmitter.emit('streamingStatusUpdate', {
                shopId: message.shopId || message.data.shopId,
                isStreaming: message.data.isStreaming,
                hasStreamUrl: message.data.hasStreamUrl,
                timestamp: new Date().toISOString()
            });
            console.log('📡 Emitted streamingStatusUpdate event for shop:', message.shopId || message.data.shopId);
        } catch (error) {
            console.log('DeviceEventEmitter not available for streaming status');
        }
    }

    /**
     * Manually broadcast an order status update (useful for ensuring dashers get updates)
     */
    public broadcastOrderUpdate(orderData: any): void {
        console.log('📢 Manual broadcast of order update:', orderData);
        
        if (this.stompClient && this.stompClient.connected) {
            try {
                // Send to multiple topics to ensure dashers receive the update
                const topics = [
                    '/topic/orders/status-updates',
                    '/topic/orders/ready-for-pickup',
                    '/topic/orders/all'
                ];

                topics.forEach(topic => {
                    this.stompClient?.publish({
                        destination: topic,
                        body: JSON.stringify(orderData)
                    });
                    console.log(`📤 Sent order update to ${topic}`);
                });
            } catch (error) {
                console.error('Error broadcasting order update:', error);
            }
        } else {
            console.warn('WebSocket not connected, cannot broadcast order update');
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect(): void {
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

        console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

        setTimeout(() => {
            if (this.currentUserId && this.currentAccountType) {
                this.connect(this.currentUserId, this.currentAccountType);
            }
        }, delay);
    }

    /**
     * Disconnect from WebSocket
     */
    public disconnect(): void {
        if (this.stompClient) {
            this.unsubscribeAll();
            this.stompClient.deactivate();
            this.stompClient = null;
        }
        this.currentUserId = null;
        this.currentAccountType = null;
        this.reconnectAttempts = 0;
    }

    /**
     * Check if WebSocket is connected
     */
    public isConnected(): boolean {
        return this.stompClient !== null && this.stompClient.connected;
    }

    /**
     * Send a message through WebSocket
     */
    public sendMessage(destination: string, message: any): void {
        if (this.stompClient && this.stompClient.connected) {
            this.stompClient.publish({
                destination: destination,
                body: JSON.stringify(message)
            });
        } else {
            console.warn('STOMP client is not connected. Cannot send message:', message);
        }
    }
}

// Export singleton instance
export const webSocketService = WebSocketService.getInstance();