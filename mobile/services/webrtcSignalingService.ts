import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { API_URL } from '../config';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'viewer-joined' | 'viewer-left' | 'stream-started' | 'stream-ended';
  data?: any;
  shopId?: string;
  viewerId?: string;
  broadcasterId?: string;
}

export interface ViewerInfo {
  id: string;
  joinedAt: Date;
}

/**
 * WebRTC Signaling Service
 * Manages WebSocket connections for WebRTC signaling between broadcasters and viewers
 */
class WebRTCSignalingService {
  private stompClient: Client | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  
  // Callbacks
  private onMessageCallback: ((message: SignalingMessage) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;
  private onViewerCountChangeCallback: ((count: number) => void) | null = null;
  
  // Current session info
  private currentShopId: string | null = null;
  private currentRole: 'broadcaster' | 'viewer' | null = null;
  private viewers: Map<string, ViewerInfo> = new Map();

  /**
   * Initialize WebSocket connection for signaling
   */
  public connect(authToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Clean up any existing connection
        this.disconnect();

        const wsUrl = API_URL.replace(/^http/, 'ws') + '/ws';
        console.log('🔌 Connecting to WebRTC signaling server:', wsUrl);

        this.stompClient = new Client({
          webSocketFactory: () => new SockJS(wsUrl),
          connectHeaders: {
            Authorization: authToken,
          },
          debug: (str) => {
            console.log('STOMP Debug:', str);
          },
          reconnectDelay: this.reconnectDelay,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
        });

        this.stompClient.onConnect = () => {
          console.log('✅ WebRTC signaling connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          if (this.onConnectionChangeCallback) {
            this.onConnectionChangeCallback(true);
          }
          
          resolve();
        };

        this.stompClient.onStompError = (frame) => {
          console.error('❌ STOMP error:', frame.headers['message']);
          this.isConnected = false;
          
          if (this.onConnectionChangeCallback) {
            this.onConnectionChangeCallback(false);
          }
          
          reject(new Error(frame.headers['message']));
        };

        this.stompClient.onWebSocketClose = () => {
          console.log('🔌 WebSocket connection closed');
          this.isConnected = false;
          
          if (this.onConnectionChangeCallback) {
            this.onConnectionChangeCallback(false);
          }
          
          this.handleReconnect();
        };

        this.stompClient.activate();
      } catch (error) {
        console.error('Error connecting to signaling server:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        if (this.stompClient && !this.isConnected) {
          this.stompClient.activate();
        }
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  /**
   * Join as a broadcaster
   */
  public joinAsBroadcaster(shopId: string): void {
    if (!this.isConnected || !this.stompClient) {
      console.error('Not connected to signaling server');
      return;
    }

    this.currentShopId = shopId;
    this.currentRole = 'broadcaster';
    this.viewers.clear();

    // Subscribe to broadcaster-specific topics
    this.stompClient.subscribe(`/topic/webrtc/shop/${shopId}/broadcaster`, (message) => {
      const data: SignalingMessage = JSON.parse(message.body);
      console.log('📨 Broadcaster received:', data.type);
      
      // Handle viewer joined/left
      if (data.type === 'viewer-joined' && data.viewerId) {
        this.viewers.set(data.viewerId, {
          id: data.viewerId,
          joinedAt: new Date(),
        });
        this.notifyViewerCountChange();
      } else if (data.type === 'viewer-left' && data.viewerId) {
        this.viewers.delete(data.viewerId);
        this.notifyViewerCountChange();
      }
      
      if (this.onMessageCallback) {
        this.onMessageCallback(data);
      }
    });

    // Notify server that broadcaster is ready
    this.sendMessage({
      type: 'stream-started',
      shopId,
      broadcasterId: shopId,
    });

    console.log('🎥 Joined as broadcaster for shop:', shopId);
  }

  /**
   * Join as a viewer
   */
  public joinAsViewer(shopId: string, viewerId: string): void {
    if (!this.isConnected || !this.stompClient) {
      console.error('Not connected to signaling server');
      return;
    }

    this.currentShopId = shopId;
    this.currentRole = 'viewer';

    // Subscribe to viewer-specific topics
    this.stompClient.subscribe(`/topic/webrtc/shop/${shopId}/viewer/${viewerId}`, (message) => {
      const data: SignalingMessage = JSON.parse(message.body);
      console.log('📨 Viewer received:', data.type);
      
      if (this.onMessageCallback) {
        this.onMessageCallback(data);
      }
    });

    // Also subscribe to broadcast channel for stream status
    this.stompClient.subscribe(`/topic/webrtc/shop/${shopId}/broadcast`, (message) => {
      const data: SignalingMessage = JSON.parse(message.body);
      console.log('📨 Viewer received broadcast:', data.type);
      
      if (this.onMessageCallback) {
        this.onMessageCallback(data);
      }
    });

    // Notify broadcaster that viewer has joined
    this.sendMessage({
      type: 'viewer-joined',
      shopId,
      viewerId,
    });

    console.log('👀 Joined as viewer for shop:', shopId);
  }

  /**
   * Send signaling message
   */
  public sendMessage(message: SignalingMessage): void {
    if (!this.isConnected || !this.stompClient) {
      console.error('Cannot send message: not connected');
      return;
    }

    try {
      const destination = this.getDestination(message);
      this.stompClient.publish({
        destination,
        body: JSON.stringify(message),
      });
      console.log('📤 Sent message:', message.type, 'to', destination);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  /**
   * Get appropriate destination based on message type and role
   */
  private getDestination(message: SignalingMessage): string {
    const shopId = message.shopId || this.currentShopId;
    
    if (!shopId) {
      throw new Error('No shop ID available');
    }

    // Route messages based on type
    if (message.type === 'offer' || message.type === 'ice-candidate') {
      // Broadcaster sending to specific viewer
      if (message.viewerId) {
        return `/app/webrtc/shop/${shopId}/to-viewer/${message.viewerId}`;
      }
    } else if (message.type === 'answer') {
      // Viewer responding to broadcaster
      return `/app/webrtc/shop/${shopId}/to-broadcaster`;
    } else if (message.type === 'viewer-joined' || message.type === 'viewer-left') {
      // Viewer status updates
      return `/app/webrtc/shop/${shopId}/viewer-status`;
    } else if (message.type === 'stream-started' || message.type === 'stream-ended') {
      // Stream status updates (broadcast to all)
      return `/app/webrtc/shop/${shopId}/stream-status`;
    }

    // Default: send to broadcast channel
    return `/app/webrtc/shop/${shopId}/broadcast`;
  }

  /**
   * Leave current session
   */
  public leave(): void {
    if (this.currentShopId && this.currentRole === 'viewer') {
      // Notify that viewer is leaving
      this.sendMessage({
        type: 'viewer-left',
        shopId: this.currentShopId,
      });
    } else if (this.currentShopId && this.currentRole === 'broadcaster') {
      // Notify that stream has ended
      this.sendMessage({
        type: 'stream-ended',
        shopId: this.currentShopId,
      });
    }

    this.currentShopId = null;
    this.currentRole = null;
    this.viewers.clear();
  }

  /**
   * Disconnect from signaling server
   */
  public disconnect(): void {
    this.leave();
    
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
    
    this.isConnected = false;
    this.reconnectAttempts = 0;
    
    if (this.onConnectionChangeCallback) {
      this.onConnectionChangeCallback(false);
    }
  }

  /**
   * Set callback for incoming messages
   */
  public onMessage(callback: (message: SignalingMessage) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Set callback for connection state changes
   */
  public onConnectionChange(callback: (connected: boolean) => void): void {
    this.onConnectionChangeCallback = callback;
  }

  /**
   * Set callback for viewer count changes
   */
  public onViewerCountChange(callback: (count: number) => void): void {
    this.onViewerCountChangeCallback = callback;
  }

  /**
   * Get current viewer count (broadcaster only)
   */
  public getViewerCount(): number {
    return this.viewers.size;
  }

  /**
   * Check if connected
   */
  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Notify viewer count change
   */
  private notifyViewerCountChange(): void {
    if (this.onViewerCountChangeCallback) {
      this.onViewerCountChangeCallback(this.viewers.size);
    }
  }
}

// Export singleton instance
export const webrtcSignalingService = new WebRTCSignalingService();
