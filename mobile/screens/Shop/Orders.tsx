import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Animated,
  Image,
  TextInput
} from 'react-native';
import { styled } from 'nativewind';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../../components/BottomNavigation';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// AsyncStorage keys for persisting local order states
const PREPARING_ORDERS_KEY = 'shop_preparing_orders';
const READY_FOR_PICKUP_ORDERS_KEY = 'shop_ready_for_pickup_orders';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);
const StyledTextInput = styled(TextInput);

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  firstname: string;
  lastname: string;
  shopId: string;
  items: OrderItem[];
  totalPrice: number;
  deliveryFee: number;
  status: string;
  paymentMethod: string;
  dasherId: string | null;
  createdAt?: string;
}

interface Notification {
  id: string;
  message: string;
  timestamp: number;
  type?: 'info' | 'success' | 'warning' | 'error';
  read?: boolean;
}

const STATUS_CONFIG = {
  'waiting_for_shop_confirmation': {
    label: 'Pending Confirmation',
    color: 'bg-yellow-100 text-yellow-800',
    icon: 'schedule'
  },
  'active_waiting_for_shop': {
    label: 'Awaiting Action',
    color: 'bg-amber-100 text-amber-800',
    icon: 'hourglass-empty'
  },
  'active_shop_confirmed': {
    label: 'Confirmed',
    color: 'bg-blue-100 text-blue-800',
    icon: 'check-circle'
  },
  'active_toShop': {
    label: 'Dasher Heading to Shop',
    color: 'bg-blue-100 text-blue-800',
    icon: 'bicycle'
  },
  'active_waiting_for_dasher': {
    label: 'Awaiting Dasher',
    color: 'bg-yellow-100 text-yellow-800',
    icon: 'schedule'
  },
  'active_preparing': {
    label: 'Preparing',
    color: 'bg-orange-100 text-orange-800',
    icon: 'restaurant'
  },
  'active_ready_for_pickup': {
    label: 'Ready for Pickup',
    color: 'bg-purple-100 text-purple-800',
    icon: 'done-all'
  },
  'active_pickedUp': {
    label: 'Picked Up',
    color: 'bg-green-100 text-green-800',
    icon: 'checkmark-circle'
  },
  'active_onTheWay': {
    label: 'On the Way',
    color: 'bg-indigo-100 text-indigo-800',
    icon: 'local-shipping'
  },
  'completed': {
    label: 'Completed',
    color: 'bg-green-100 text-green-800',
    icon: 'check-circle'
  },
  'cancelled_by_shop': {
    label: 'Cancelled by Shop',
    color: 'bg-red-100 text-red-800',
    icon: 'cancel'
  },
  'cancelled_by_user': {
    label: 'Cancelled by Customer',
    color: 'bg-red-100 text-red-800',
    icon: 'cancel'
  },
  'cancelled_by_customer': {
    label: 'Cancelled by Customer',
    color: 'bg-red-100 text-red-800',
    icon: 'cancel'
  },
  'no_show': {
    label: 'No-Show',
    color: 'bg-red-100 text-red-800',
    icon: 'person-off'
  },
  'no-show': {
    label: 'No-Show',
    color: 'bg-red-100 text-red-800',
    icon: 'person-off'
  },
  // Status when dasher reports customer didn't show up, waiting for admin confirmation
  'active_waiting_for_no_show_confirmation': {
    label: 'No-Show Pending',
    color: 'bg-orange-100 text-orange-800',
    icon: 'warning'
  },
  // No-show resolved status (underscore version)
  // Backend inconsistency: Some endpoints send 'no_show_resolved' (underscores)
  // Without this entry, orders would display in default gray/black-white appearance
  'no_show_resolved': {
    label: 'No-Show Resolved',
    color: 'bg-blue-100 text-blue-800',
    icon: 'check-circle-outline'
  },
  // No-show resolved status (hyphen version)
  // Backend inconsistency: Other endpoints send 'no-show-resolved' (hyphens)
  // Both entries ensure proper color display regardless of backend format
  'no-show-resolved': {
    label: 'No-Show Resolved',
    color: 'bg-blue-100 text-blue-800',
    icon: 'check-circle-outline'
  }
};

export default React.memo(function Orders() {
  const { getAccessToken } = useAuthentication();
  const [orders, setOrders] = useState<Order[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'ongoing' | 'cancelled' | 'no-show' | 'completed'>('all');
  
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsExpanded, setIsNotificationsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationConnected, setIsNotificationConnected] = useState(false);
  
  // Polling state
  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isComponentMountedRef = useRef(true);
  
  // Local UI state for orders being prepared (doesn't affect database)
  const [preparingOrders, setPreparingOrders] = useState<Set<string>>(new Set());
  
  // Local UI state for orders ready for pickup (doesn't affect database)
  const [readyForPickupOrders, setReadyForPickupOrders] = useState<Set<string>>(new Set());

  // WebSocket references
  const notificationStompClientRef = useRef<Client | null>(null);
  const notificationAnimationValue = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Animation values for loading state
  const spinValue = useRef(new Animated.Value(0)).current;
  const circleValue = useRef(new Animated.Value(0)).current;

  // Start animations when loading begins
  useEffect(() => {
    if (isLoading) {
      // Spinning logo animation
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );

      // Circle loading animation
      const circleAnimation = Animated.loop(
        Animated.timing(circleValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      );

      spinAnimation.start();
      circleAnimation.start();

      return () => {
        spinAnimation.stop();
        circleAnimation.stop();
      };
    }
  }, [isLoading, spinValue, circleValue]);

  useEffect(() => {
    fetchShopId();
    loadPersistedOrderStates();
  }, []);

  useEffect(() => {
    // Connect to notifications WebSocket when shopId is available
    if (shopId) {
      connectToNotificationsWebSocket();
    }
    return () => {
      if (notificationStompClientRef.current?.connected) {
        notificationStompClientRef.current.deactivate();
      }
    };
  }, [shopId]);

  useEffect(() => {
    // Start pulse animation for unread notifications
    if (unreadCount > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [unreadCount]);

  // Connect to WebSocket for notifications
  const connectToNotificationsWebSocket = async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token || !shopId) return;

      const client = new Client({
        webSocketFactory: () => new SockJS(`${API_URL}/ws`),
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        debug: (str) => console.log('Notification WebSocket Debug:', str),
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          console.log('✅ Shop notifications WebSocket connected');
          setIsNotificationConnected(true);

          // Subscribe to shop-specific user notifications
          client.subscribe(`/topic/users/${shopId}`, (message) => {
            try {
              const data = JSON.parse(message.body);
              console.log('📧 Shop notification received:', data);
              
              const newNotification: Notification = {
                id: Date.now().toString(),
                message: data.message,
                timestamp: data.timestamp || Date.now(),
                type: getNotificationType(data.message),
                read: false,
              };

              addNotification(newNotification);
            } catch (error) {
              console.error('❌ Error parsing shop notification:', error);
            }
          });
        },
        onDisconnect: () => {
          console.log('📡 Shop notifications WebSocket disconnected');
          setIsNotificationConnected(false);
        },
        onStompError: (frame) => {
          console.error('❌ Shop notifications STOMP error:', frame);
          setIsNotificationConnected(false);
        },
      });

      client.activate();
      notificationStompClientRef.current = client;
    } catch (error) {
      console.error('❌ Error connecting to notifications WebSocket:', error);
    }
  };

  const getNotificationType = (message: string): 'info' | 'success' | 'warning' | 'error' => {
    if (message.includes('cancelled') || message.includes('did not show up')) {
      return 'error';
    }
    if (message.includes('completed') || message.includes('delivered') || message.includes('picked up')) {
      return 'success';
    }
    if (message.includes('waiting') || message.includes('on the way')) {
      return 'warning';
    }
    return 'info';
  };

  const addNotification = (notification: Notification) => {
    setNotifications(prev => {
      const updated = [notification, ...prev].slice(0, 10); // Keep max 10 notifications
      return updated;
    });
    
    setUnreadCount(prev => prev + 1);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const toggleNotifications = () => {
    setIsNotificationsExpanded(!isNotificationsExpanded);
    if (!isNotificationsExpanded) {
      markAllAsRead();
    }
    
    Animated.timing(notificationAnimationValue, {
      toValue: isNotificationsExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const clearNotifications = () => {
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            setNotifications([]);
            setUnreadCount(0);
            setIsNotificationsExpanded(false);
            notificationAnimationValue.setValue(0);
          }
        },
      ]
    );
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return '#22C55E';
      case 'error': return '#EF4444';
      case 'warning': return '#F59E0B';
      default: return '#3B82F6';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'alert-circle';
      case 'warning': return 'warning';
      default: return 'information-circle';
    }
  };

  // Load persisted order states from AsyncStorage
  const loadPersistedOrderStates = async () => {
    try {
      const [preparingData, readyData] = await Promise.all([
        AsyncStorage.getItem(PREPARING_ORDERS_KEY),
        AsyncStorage.getItem(READY_FOR_PICKUP_ORDERS_KEY)
      ]);

      if (preparingData) {
        const preparingArray = JSON.parse(preparingData);
        setPreparingOrders(new Set(preparingArray));
        console.log('📦 Loaded persisted preparing orders:', preparingArray.length);
      }

      if (readyData) {
        const readyArray = JSON.parse(readyData);
        setReadyForPickupOrders(new Set(readyArray));
        console.log('🎯 Loaded persisted ready-for-pickup orders:', readyArray.length);
      }
    } catch (error) {
      console.error('Error loading persisted order states:', error);
    }
  };

  // Persist preparing orders to AsyncStorage
  const persistPreparingOrders = useCallback(async (orderIds: Set<string>) => {
    try {
      const array = Array.from(orderIds);
      await AsyncStorage.setItem(PREPARING_ORDERS_KEY, JSON.stringify(array));
      console.log('💾 Persisted preparing orders:', array.length);
    } catch (error) {
      console.error('Error persisting preparing orders:', error);
    }
  }, []);

  // Persist ready-for-pickup orders to AsyncStorage
  const persistReadyForPickupOrders = useCallback(async (orderIds: Set<string>) => {
    try {
      const array = Array.from(orderIds);
      await AsyncStorage.setItem(READY_FOR_PICKUP_ORDERS_KEY, JSON.stringify(array));
      console.log('💾 Persisted ready-for-pickup orders:', array.length);
    } catch (error) {
      console.error('Error persisting ready-for-pickup orders:', error);
    }
  }, []);

  // Clean up completed orders from persisted state
  const cleanupCompletedOrders = async (currentOrders: Order[]) => {
    try {
      const currentOrderIds = new Set(currentOrders.map(order => order.id));
      
      // Remove orders that no longer exist or are completed from preparing state
      const updatedPreparingOrders = new Set(
        Array.from(preparingOrders).filter(orderId => {
          const order = currentOrders.find(o => o.id === orderId);
          return order && currentOrderIds.has(orderId) && 
                 (order.status === 'active_waiting_for_dasher' || order.status === 'active_preparing');
        })
      );
      
      // Remove orders that no longer exist or are completed from ready state
      const updatedReadyOrders = new Set(
        Array.from(readyForPickupOrders).filter(orderId => {
          const order = currentOrders.find(o => o.id === orderId);
          return order && currentOrderIds.has(orderId) && 
                 (order.status === 'active_waiting_for_dasher' || order.status === 'active_preparing');
        })
      );
      
      // Update states if they changed
      if (updatedPreparingOrders.size !== preparingOrders.size) {
        setPreparingOrders(updatedPreparingOrders);
        persistPreparingOrders(updatedPreparingOrders);
        console.log('🧹 Cleaned up preparing orders:', preparingOrders.size - updatedPreparingOrders.size, 'removed');
      }
      
      if (updatedReadyOrders.size !== readyForPickupOrders.size) {
        setReadyForPickupOrders(updatedReadyOrders);
        persistReadyForPickupOrders(updatedReadyOrders);
        console.log('🧹 Cleaned up ready orders:', readyForPickupOrders.size - updatedReadyOrders.size, 'removed');
      }
    } catch (error) {
      console.error('Error cleaning up completed orders:', error);
    }
  };

  // Polling mechanism for real-time order updates
  useEffect(() => {
    const startPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Start polling every 10 seconds
      pollingIntervalRef.current = setInterval(async () => {
        if (!isComponentMountedRef.current || isLoading || refreshing) {
          return;
        }

        try {
          setIsPolling(true);
          setPollingError(null);
          
          console.log('📊 Polling for order updates...');
          await fetchOrders(shopId);
          
          console.log('✅ Polling successful');
        } catch (error) {
          console.error('❌ Polling failed:', error);
          setPollingError('Failed to fetch updates');
          
          // Continue polling even if one request fails
        } finally {
          if (isComponentMountedRef.current) {
            setIsPolling(false);
          }
        }
      }, 10000); // Poll every 10 seconds

      console.log('🔄 Started polling for order updates');
    };

    if (shopId && !isLoading) {
      startPolling();
    }

    // Cleanup polling on unmount or shopId change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log('⏹️ Stopped polling for order updates');
      }
    };
  }, [shopId, isLoading, refreshing]);

  // Component unmount cleanup
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    return () => {
      isComponentMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Clean up persisted orders when orders list changes
  useEffect(() => {
    if (orders.length > 0) {
      cleanupCompletedOrders(orders);
    }
  }, [orders]);

  const fetchShopId = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setShopId(userId);
        fetchOrders(userId);
      }
    } catch (error) {
      console.error("Error fetching shop ID:", error);
      setIsLoading(false);
    }
  };

  const fetchOrders = useCallback(async (id?: string) => {
    const currentShopId = id || shopId;
    if (!currentShopId) {
      console.warn('No shop ID available for fetching orders');
      return;
    }

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        throw new Error('Authentication token not available');
      }

      const config = { headers: { Authorization: token } };

      // Fetch all order types for the shop including specific status calls
      const [pendingResponse, ongoingResponse, pastResponse, waitingForDasherResponse] = await Promise.all([
        axios.get(`${API_URL}/api/orders/active-waiting-for-shop`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/orders/ongoing-orders`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/orders/past-orders`, config).catch(() => ({ data: [] })),
        // Specifically fetch orders waiting for dasher assignment
        axios.get(`${API_URL}/api/orders/waiting-for-dasher`, config).catch(() => ({ data: [] }))
      ]);

      // Try multiple fallback endpoints to get orders with active_waiting_for_dasher status
      let allShopOrdersResponse = { data: [] };
      let activeOrdersResponse = { data: [] };
      
      try {
        // Try direct shop orders API
        allShopOrdersResponse = await axios.get(`${API_URL}/api/orders/shop/${currentShopId}`, config);
        console.log('Fetched all shop orders directly:', allShopOrdersResponse.data.length);
      } catch (error) {
        console.log('Direct shop orders API not available');
      }

      try {
        // Try active orders API which might include active_waiting_for_dasher
        activeOrdersResponse = await axios.get(`${API_URL}/api/orders/active-orders`, config);
        console.log('Fetched active orders:', activeOrdersResponse.data.length);
        
        // Filter for this shop's orders
        const shopActiveOrders = activeOrdersResponse.data.filter((order: Order) => order.shopId === currentShopId);
        console.log('Active orders for this shop:', shopActiveOrders.length);
        
        // Log the statuses of active orders for this shop
        shopActiveOrders.forEach((order: Order) => {
          console.log(`Active order ${order.id}: ${order.status}`);
        });
      } catch (error) {
        console.log('Active orders API not available');
      }

      // Try one more endpoint - orders that are assigned to dashers but not yet picked up
      let dasherAssignedOrdersResponse = { data: [] };
      try {
        dasherAssignedOrdersResponse = await axios.get(`${API_URL}/api/orders/dasher-assigned`, config);
        console.log('Fetched dasher assigned orders:', dasherAssignedOrdersResponse.data.length);
      } catch (error) {
        console.log('Dasher assigned orders API not available');
      }

      // Try the most generic endpoint - all orders (no filtering)
      let allOrdersResponse = { data: [] };
      try {
        allOrdersResponse = await axios.get(`${API_URL}/api/orders`, config);
        console.log('Fetched ALL orders (unfiltered):', allOrdersResponse.data.length);
        
        // Filter for this shop and log all statuses
        const allShopOrders = allOrdersResponse.data.filter((order: Order) => order.shopId === currentShopId);
        console.log('All orders for this shop (unfiltered):', allShopOrders.length);
        
        allShopOrders.forEach((order: Order) => {
          console.log(`Unfiltered order ${order.id}: ${order.status}`);
        });
      } catch (error) {
        console.log('Generic orders API not available');
      }

      // As a last resort, try to search by specific criteria
      let searchOrdersResponse = { data: [] };
      try {
        // Try searching for orders with active statuses
        searchOrdersResponse = await axios.get(`${API_URL}/api/orders/search?status=active_waiting_for_dasher&shopId=${currentShopId}`, config);
        console.log('Search results for active_waiting_for_dasher:', searchOrdersResponse.data.length);
      } catch (error) {
        console.log('Search orders API not available');
      }

      // Combine all orders from different sources
      const combinedOrders = [
        ...pendingResponse.data,
        ...ongoingResponse.data,
        ...pastResponse.data,
        ...waitingForDasherResponse.data,
        ...allShopOrdersResponse.data,
        ...activeOrdersResponse.data,
        ...dasherAssignedOrdersResponse.data,
        ...allOrdersResponse.data,
        ...searchOrdersResponse.data
      ];

      // Remove duplicates and filter for current shop - exclude orders waiting for shop confirmation only
      const uniqueOrdersMap = new Map();
      combinedOrders.forEach(order => {
        uniqueOrdersMap.set(order.id, order);
      });

      const allOrders = Array.from(uniqueOrdersMap.values()).filter((order: Order) => 
        order.shopId === currentShopId && 
        order.status !== 'waiting_for_shop_confirmation' &&
        order.status !== 'active_waiting_for_shop'
      );

      // Debug: Log all orders and their statuses
      console.log('All fetched orders for shop:', currentShopId);
      console.log('Pending orders:', pendingResponse.data.length);
      console.log('Ongoing orders:', ongoingResponse.data.length);
      console.log('Past orders:', pastResponse.data.length);
      console.log('Waiting for dasher orders:', waitingForDasherResponse.data.length);
      console.log('Direct shop orders:', allShopOrdersResponse.data.length);
      console.log('Active orders response:', activeOrdersResponse.data.length);
      
      const shopOrders = [...pendingResponse.data, ...ongoingResponse.data, ...pastResponse.data]
        .filter((order: Order) => order.shopId === currentShopId);
      
      console.log('Shop orders by status:');
      shopOrders.forEach((order: Order) => {
        console.log(`Order ${order.id}: ${order.status}`);
      });
      
      // Check specifically for the statuses we're looking for
      const waitingForDasher = shopOrders.filter(order => order.status === 'active_waiting_for_dasher');
      const toShopOrders = shopOrders.filter(order => order.status === 'active_toShop');
      
      console.log(`Found ${waitingForDasher.length} orders with active_waiting_for_dasher status`);
      console.log(`Found ${toShopOrders.length} orders with active_toShop status`);
      
      if (waitingForDasher.length === 0 && toShopOrders.length === 0) {
        console.log('No orders found with the expected statuses. Checking all responses:');
        
        // Check each response individually for active_waiting_for_dasher orders
        console.log('Checking pending response for active_waiting_for_dasher:');
        pendingResponse.data.forEach((order: Order) => {
          if (order.status === 'active_waiting_for_dasher' && order.shopId === currentShopId) {
            console.log('Found in pending:', order.id, order.status);
          }
        });
        
        console.log('Checking ongoing response for active_waiting_for_dasher:');
        ongoingResponse.data.forEach((order: Order) => {
          if (order.status === 'active_waiting_for_dasher' && order.shopId === currentShopId) {
            console.log('Found in ongoing:', order.id, order.status);
          }
        });
        
        console.log('Checking active orders response for active_waiting_for_dasher:');
        activeOrdersResponse.data.forEach((order: Order) => {
          if (order.status === 'active_waiting_for_dasher' && order.shopId === currentShopId) {
            console.log('Found in active orders:', order.id, order.status);
          }
        });
      }

      // Sort by creation date (newest first)
      allOrders.sort((a: Order, b: Order) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setOrders(allOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      
      // Only show alert if not polling (to avoid spam during background polling)
      if (!isPolling && isComponentMountedRef.current) {
        if (error instanceof Error) {
          Alert.alert("Error", `Failed to load orders: ${error.message}`);
        } else {
          Alert.alert("Error", "Failed to load orders");
        }
      }
      
      // Re-throw error for polling error handling
      throw error;
    } finally {
      if (isComponentMountedRef.current) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  }, [shopId]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [shopId]);

  // Debounce search query for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce search query for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Optimized filter and search with useMemo
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Apply status filter
    if (activeFilter !== 'all') {
      switch (activeFilter) {
        case 'ongoing':
          // Ongoing includes active states where the shop has accepted and is preparing/ready/out for delivery/picked up
          filtered = orders.filter(order => [
            'active_shop_confirmed',
            'active_toShop',
            'active_waiting_for_dasher',
            'active_preparing',
            'active_ready_for_pickup',
            'active_pickedUp',
            'active_onTheWay'
          ].includes(order.status));
          break;
        case 'cancelled':
          filtered = orders.filter(order => 
            order.status === 'cancelled_by_shop' || 
            order.status === 'cancelled_by_user' ||
            order.status === 'cancelled_by_customer'
          );
          break;
        case 'no-show':
          filtered = orders.filter(order => 
            order.status === 'no_show' || 
            order.status === 'no-show' || 
            order.status === 'active_waiting_for_no_show_confirmation' ||
            order.status === 'no_show_resolved' ||
            order.status?.toLowerCase().includes('noshow') ||
            order.status?.toLowerCase().includes('no-show')
          );
          break;
        case 'completed':
          filtered = orders.filter(order => order.status === 'completed');
          break;
      }
    }

    // Apply search filter with debounced query
    if (debouncedSearchQuery.trim()) {
      const searchLower = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        const orderId = order.id.toLowerCase();
        const shortId = order.id.slice(-6).toLowerCase();
        return orderId.includes(searchLower) || shortId.includes(searchLower);
      });
    }

    return filtered;
  }, [orders, activeFilter, debouncedSearchQuery]);

  const handleFilterPress = useCallback((filter: 'all' | 'ongoing' | 'cancelled' | 'no-show' | 'completed') => {
    setActiveFilter(filter);
  }, []);

  // Function to handle real-time order updates
  const handleRealtimeOrderUpdate = (updatedOrder: Order) => {
    setOrders(prevOrders => {
      const updatedOrders = prevOrders.map(order => 
        order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order
      );
      return updatedOrders;
    });
  };

  const toggleOrderExpansion = React.useCallback((orderId: string) => {
    setExpandedOrderIds(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  }, []);

  const getStatusConfig = React.useCallback((status: string, orderId?: string) => {
    // Check if this order is locally marked as preparing or ready for pickup
    const isLocallyPreparing = orderId && preparingOrders.has(orderId);
    const isLocallyReadyForPickup = orderId && readyForPickupOrders.has(orderId);
    
    if (isLocallyReadyForPickup && (status === 'active_waiting_for_dasher' || status === 'active_preparing')) {
      // Show ready for pickup status in UI while keeping database unchanged
      return {
        label: 'Ready for Pickup',
        color: 'bg-purple-100 text-purple-800',
        icon: 'done-all'
      };
    }
    
    if (isLocallyPreparing && status === 'active_waiting_for_dasher') {
      // Show preparing status in UI while keeping database as active_waiting_for_dasher
      return {
        label: 'Preparing',
        color: 'bg-orange-100 text-orange-800',
        icon: 'restaurant'
      };
    }
    
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || {
      label: status,
      color: 'bg-gray-100 text-gray-800',
      icon: 'help'
    };
  }, [preparingOrders, readyForPickupOrders]);

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: string) => {
    try {
      console.log(`🔄 Shop updating order ${orderId} to status: ${newStatus}`);
      
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        return;
      }

      const config = { headers: { Authorization: token } };
      const currentOrder = orders.find(order => order.id === orderId);

      // Update local UI state based on the status
      if (newStatus === 'active_preparing') {
        // Add to preparing orders set for UI display
        const newPreparingOrders = new Set([...preparingOrders, orderId]);
        setPreparingOrders(newPreparingOrders);
        persistPreparingOrders(newPreparingOrders);
      } else if (newStatus === 'active_ready_for_pickup') {
        // Remove from preparing and add to ready for pickup
        const newPreparingOrders = new Set(preparingOrders);
        newPreparingOrders.delete(orderId);
        const newReadyOrders = new Set([...readyForPickupOrders, orderId]);
        
        setPreparingOrders(newPreparingOrders);
        setReadyForPickupOrders(newReadyOrders);
        
        persistPreparingOrders(newPreparingOrders);
        persistReadyForPickupOrders(newReadyOrders);
      }

      // CRITICAL: Always update the database status so dasher can see the change
      console.log(`📡 Sending status update to backend: ${orderId} -> ${newStatus}`);
      
      await axios.post(`${API_URL}/api/orders/update-order-status`,
        { orderId, status: newStatus },
        config
      );

      console.log(`✅ Status update successful: ${orderId} -> ${newStatus}`);

      // Refresh orders after update
      fetchOrders();
    } catch (error) {
      console.error("Error updating order status:", error);
      Alert.alert("Error", "Failed to update order status");
    }
  }, [orders, preparingOrders, readyForPickupOrders, persistPreparingOrders, persistReadyForPickupOrders, fetchOrders]);

  const getNextStatusOptions = React.useCallback((currentStatus: string, orderId: string) => {
    const isLocallyPreparing = preparingOrders.has(orderId);
    const isLocallyReadyForPickup = readyForPickupOrders.has(orderId);
    
    switch (currentStatus) {
      case 'active_shop_confirmed':
        return [
          { status: 'active_waiting_for_dasher', label: 'Start Preparing', icon: 'restaurant', color: '#F59E0B' }
        ];
      
      // When dasher is on the way to shop, shop can start preparing
      case 'active_toShop':
        return [
          { status: 'active_preparing', label: 'Start Preparing', icon: 'restaurant', color: '#F59E0B' }
        ];
      
      case 'active_waiting_for_dasher':
        if (isLocallyReadyForPickup) {
          // No more buttons if ready for pickup (dasher will handle)
          return [];
        } else if (isLocallyPreparing) {
          // Show "Ready for Pickup" if locally marked as preparing
          return [
            { status: 'active_ready_for_pickup', label: 'Ready for Pickup', icon: 'done-all', color: '#10B981' }
          ];
        } else {
          // Show "Start Preparing" (local UI only)
          return [
            { status: 'active_preparing', label: 'Start Preparing', icon: 'restaurant', color: '#F59E0B' }
          ];
        }
      
      // Shop is actively preparing the order
      case 'active_preparing':
        if (isLocallyReadyForPickup) {
          // No more buttons if ready for pickup (dasher will handle)
          return [];
        } else {
          return [
            { status: 'active_ready_for_pickup', label: 'Ready for Pickup', icon: 'done-all', color: '#10B981' }
          ];
        }
      
      // No buttons for active_ready_for_pickup or active_pickedUp - dasher will handle pickup and delivery
      case 'active_ready_for_pickup':
        return [];
      
      case 'active_pickedUp':
        return [];
      
      default:
        return [];
    }
  }, [preparingOrders, readyForPickupOrders]);

  const renderOrderItems = React.useCallback((items: OrderItem[]) => {
    return items.map((item, index) => (
      <StyledView key={`${item.id}-${index}`} className="bg-gray-50 rounded-xl p-3 mb-2">
        <StyledView className="flex-row justify-between items-center">
          <StyledView className="flex-1">
            <StyledText className="font-semibold text-gray-900 mb-1">
              {item.name}
            </StyledText>
            <StyledText className="text-sm text-gray-600">
              Qty: {item.quantity} × ₱{item.price.toFixed(2)}
            </StyledText>
          </StyledView>
          <StyledText className="font-bold text-[#BC4A4D]">
            ₱{(item.price * item.quantity).toFixed(2)}
          </StyledText>
        </StyledView>
      </StyledView>
    ));
  }, []);

  const renderOrderCard = React.useCallback((order: Order) => {
    const isExpanded = expandedOrderIds[order.id] || false;
    const statusConfig = getStatusConfig(order.status, order.id);
    const paymentMethod = order.paymentMethod === 'gcash' ? 'Online Payment' : 'Cash on Delivery';

    return (
      <StyledView key={order.id} className="bg-white rounded-2xl mb-4 overflow-hidden shadow-sm border border-gray-100">
        <StyledTouchableOpacity
          className="p-4"
          onPress={() => toggleOrderExpansion(order.id)}
          activeOpacity={0.7}
          delayPressIn={0}
        >
          <StyledView className="flex-row justify-between items-start mb-3">
            <StyledView className="flex-1">
              <StyledText className="text-lg font-bold text-gray-900 mb-1">
                Order #{order.id.slice(-6)}
              </StyledText>
              <StyledText className="text-sm text-gray-600">
                {order.firstname} {order.lastname}
              </StyledText>
            </StyledView>
            <StyledView className={`px-3 py-1 rounded-full ${statusConfig.color}`}>
              <StyledView className="flex-row items-center">
                <MaterialIcons name={statusConfig.icon as any} size={14} color="currentColor" />
                <StyledText className="text-xs font-medium ml-1">
                  {statusConfig.label}
                </StyledText>
              </StyledView>
            </StyledView>
          </StyledView>

          <StyledView className="flex-row justify-between items-center">
            <StyledView className="flex-row items-center">
              <MaterialIcons name="shopping-bag" size={16} color="#6B7280" />
              <StyledText className="text-sm text-gray-600 ml-1">
                {order.items.length} item{order.items.length !== 1 ? 's' : ''}
              </StyledText>
            </StyledView>
            <StyledText className="text-lg font-bold text-[#BC4A4D]">
              ₱{(order.totalPrice + order.deliveryFee).toFixed(2)}
            </StyledText>
          </StyledView>

          <StyledView className="flex-row justify-between items-center mt-2">
            <StyledView className="flex-row items-center">
              <MaterialIcons 
                name={order.paymentMethod === 'gcash' ? 'payment' : 'money'} 
                size={16} 
                color="#6B7280" 
              />
              <StyledText className="text-sm text-gray-600 ml-1">
                {paymentMethod}
              </StyledText>
            </StyledView>
            <MaterialIcons 
              name={isExpanded ? 'expand-less' : 'expand-more'} 
              size={24} 
              color="#6B7280" 
            />
          </StyledView>
        </StyledTouchableOpacity>

        {isExpanded && (
          <StyledView className="px-4 pb-4 border-t border-gray-100">
            <StyledText className="font-semibold text-gray-900 mb-3 mt-3">
              Order Details
            </StyledText>
            
            {renderOrderItems(order.items)}

            <StyledView className="bg-gray-50 rounded-xl p-3 mt-2">
              <StyledView className="flex-row justify-between items-center mb-2">
                <StyledText className="text-sm text-gray-600">Subtotal</StyledText>
                <StyledText className="text-sm font-medium">₱{order.totalPrice.toFixed(2)}</StyledText>
              </StyledView>
              <StyledView className="flex-row justify-between items-center mb-2">
                <StyledText className="text-sm text-gray-600">Delivery Fee</StyledText>
                <StyledText className="text-sm font-medium">₱{order.deliveryFee.toFixed(2)}</StyledText>
              </StyledView>
              <StyledView className="h-px bg-gray-300 my-2" />
              <StyledView className="flex-row justify-between items-center">
                <StyledText className="font-bold text-gray-900">Total</StyledText>
                <StyledText className="font-bold text-[#BC4A4D] text-lg">
                  ₱{(order.totalPrice + order.deliveryFee).toFixed(2)}
                </StyledText>
              </StyledView>
            </StyledView>

            {/* Status Update Buttons */}
            {(() => {
              const nextStatusOptions = getNextStatusOptions(order.status, order.id);
              if (nextStatusOptions.length > 0) {
                return (
                  <StyledView className="mt-4">
                    <StyledText className="font-semibold text-gray-900 mb-3">
                      Update Order Status
                    </StyledText>
                    <StyledView className="flex-row flex-wrap">
                      {nextStatusOptions.map((option, index) => (
                        <StyledTouchableOpacity
                          key={`${order.id}-${option.status}-${index}`}
                          className="flex-row items-center px-4 py-3 rounded-xl shadow-sm mr-2 mb-2"
                          style={{ backgroundColor: option.color }}
                          onPress={() => updateOrderStatus(order.id, option.status)}
                          activeOpacity={0.8}
                          delayPressIn={0}
                        >
                          <MaterialIcons name={option.icon as any} size={18} color="white" />
                          <StyledText className="text-white font-semibold text-sm ml-2">
                            {option.label}
                          </StyledText>
                        </StyledTouchableOpacity>
                      ))}
                    </StyledView>
                  </StyledView>
                );
              }
              return null;
            })()}
          </StyledView>
        )}
      </StyledView>
    );
  }, [expandedOrderIds, preparingOrders, readyForPickupOrders, updateOrderStatus, renderOrderItems]);

  if (isLoading) {
    const spin = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const circleRotation = circleValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
        <StyledView className="flex-1 justify-center items-center px-6">
          <StyledView className="items-center">
            {/* Spinning Logo Container */}
            <StyledView className="relative mb-6">
              {/* Outer rotating circle */}
              <Animated.View
                style={{
                  transform: [{ rotate: circleRotation }],
                }}
                className="absolute w-20 h-20 border-2 border-[#BC4A4D]/20 border-t-[#BC4A4D] rounded-full"
              />
              
              {/* Logo container */}
              <StyledView className="w-16 h-16 rounded-full bg-[#BC4A4D]/10 items-center justify-center mx-2 my-2">
                <Animated.View
                  style={{
                    transform: [{ rotate: spin }],
                  }}
                >
                  <StyledImage
                    source={require('../../assets/images/logo.png')}
                    className="w-10 h-10 rounded-full"
                  />
                </Animated.View>
              </StyledView>
            </StyledView>
            
            {/* Brand Name */}
            <StyledText className="text-lg font-bold mb-4">
              <StyledText className="text-[#BC4A4DFF]">Campus</StyledText>
              <StyledText className="text-[#DAA520]">Eats</StyledText>
            </StyledText>
            
            {/* Loading Text */}
            <StyledText className="text-[#BC4A4D] text-base font-semibold">Loading orders...</StyledText>
          </StyledView>
        </StyledView>
        <BottomNavigation activeTab="Orders" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />

      {/* Header */}
      <StyledView className="px-5 py-4 bg-white rounded-b-3xl shadow-sm relative">
        {/* Search Bar */}
        <StyledView className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2 mb-3">
          <MaterialIcons name="search" size={20} color="#6B7280" />
          <StyledTextInput
            className="flex-1 ml-2 text-sm text-gray-900"
            placeholder="Search by Order ID..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <StyledTouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="clear" size={18} color="#6B7280" />
            </StyledTouchableOpacity>
          )}
        </StyledView>

        {/* Order Count and Polling Status */}
        <StyledView className="flex-row justify-between items-center mb-3">
          <StyledText className="text-sm text-gray-600">
            {filteredOrders.length} of {orders.length} total {orders.length === 1 ? 'order' : 'orders'}
          </StyledText>
          <StyledView className="flex-row items-center">
            {isPolling && (
              <StyledView className="mr-2">
                <ActivityIndicator size="small" color="#10B981" />
              </StyledView>
            )}
            <StyledView className={`w-2 h-2 rounded-full mr-2 ${
              pollingError ? 'bg-red-500' : 'bg-green-500'
            }`} />
            <StyledText className={`text-xs ${
              pollingError ? 'text-red-600' : 'text-green-600'
            }`}>
              {pollingError ? 'Error' : 'Auto-sync'}
            </StyledText>
          </StyledView>
        </StyledView>

        {/* Filter Buttons */}
        <StyledView className="flex-row justify-between">
          <StyledTouchableOpacity
            key="filter-all"
            className={`flex-1 py-2.5 px-1 rounded-lg mr-1.5 items-center justify-center ${
              activeFilter === 'all' ? 'bg-[#BC4A4D]' : 'bg-gray-100'
            }`}
            onPress={() => handleFilterPress('all')}
            activeOpacity={0.8}
          >
            <StyledText 
              className={`text-center font-medium text-xs ${
                activeFilter === 'all' ? 'text-white' : 'text-gray-700'
              }`}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ includeFontPadding: false, textAlignVertical: 'center' }}
            >
              All
            </StyledText>
          </StyledTouchableOpacity>

          <StyledTouchableOpacity
            key="filter-ongoing"
            className={`flex-1 py-2.5 px-1 rounded-lg mr-1.5 items-center justify-center ${
              activeFilter === 'ongoing' ? 'bg-[#BC4A4D]' : 'bg-gray-100'
            }`}
            onPress={() => handleFilterPress('ongoing')}
            activeOpacity={0.8}
          >
            <StyledText 
              className={`text-center font-medium text-xs ${
                activeFilter === 'ongoing' ? 'text-white' : 'text-gray-700'
              }`}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ includeFontPadding: false, textAlignVertical: 'center' }}
            >
              Ongoing
            </StyledText>
          </StyledTouchableOpacity>

          <StyledTouchableOpacity
            key="filter-cancelled"
            className={`flex-1 py-2.5 px-1 rounded-lg mr-1.5 items-center justify-center ${
              activeFilter === 'cancelled' ? 'bg-[#BC4A4D]' : 'bg-gray-100'
            }`}
            onPress={() => handleFilterPress('cancelled')}
            activeOpacity={0.8}
          >
            <StyledText 
              className={`text-center font-medium text-xs ${
                activeFilter === 'cancelled' ? 'text-white' : 'text-gray-700'
              }`}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ includeFontPadding: false, textAlignVertical: 'center' }}
            >
              Cancelled
            </StyledText>
          </StyledTouchableOpacity>

          <StyledTouchableOpacity
            key="filter-no-show"
            className={`flex-1 py-2.5 px-1 rounded-lg mr-1.5 items-center justify-center ${
              activeFilter === 'no-show' ? 'bg-[#BC4A4D]' : 'bg-gray-100'
            }`}
            onPress={() => handleFilterPress('no-show')}
            activeOpacity={0.8}
          >
            <StyledText 
              className={`text-center font-medium text-xs ${
                activeFilter === 'no-show' ? 'text-white' : 'text-gray-700'
              }`}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ includeFontPadding: false, textAlignVertical: 'center' }}
            >
              No-Show
            </StyledText>
          </StyledTouchableOpacity>

          <StyledTouchableOpacity
            key="filter-completed"
            className={`flex-1 py-2.5 px-1 rounded-lg items-center justify-center ${
              activeFilter === 'completed' ? 'bg-[#BC4A4D]' : 'bg-gray-100'
            }`}
            onPress={() => handleFilterPress('completed')}
            activeOpacity={0.8}
          >
            <StyledText 
              className={`text-center font-medium text-xs ${
                activeFilter === 'completed' ? 'text-white' : 'text-gray-700'
              }`}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ includeFontPadding: false, textAlignVertical: 'center' }}
            >
              Completed
            </StyledText>
          </StyledTouchableOpacity>
        </StyledView>
      </StyledView>

      <StyledScrollView
        className="flex-1 px-5"
        style={{ backgroundColor: '#DFD6C5' }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#BC4A4D']}
            tintColor="#BC4A4D"
          />
        }
      >
        {filteredOrders.length > 0 ? (
          <StyledView className="py-4">
            {/* Show section headers when in cancelled tab for better organization */}
            {activeFilter === 'cancelled' ? (
              <>
                {/* Cancelled by Shop Section */}
                {filteredOrders.filter(order => order.status === 'cancelled_by_shop').length > 0 && (
                  <>
                    <StyledView className="mb-3 mt-2">
                      <StyledText className="text-sm font-bold text-gray-700 px-2">
                        Cancelled by You
                      </StyledText>
                    </StyledView>
                    {filteredOrders
                      .filter(order => order.status === 'cancelled_by_shop')
                      .map(renderOrderCard)}
                  </>
                )}

                {/* Cancelled by Customer Section */}
                {filteredOrders.filter(order => 
                  order.status === 'cancelled_by_user' || order.status === 'cancelled_by_customer'
                ).length > 0 && (
                  <>
                    <StyledView className="mb-3 mt-4">
                      <StyledText className="text-sm font-bold text-gray-700 px-2">
                        Cancelled by Customer
                      </StyledText>
                    </StyledView>
                    {filteredOrders
                      .filter(order => 
                        order.status === 'cancelled_by_user' || order.status === 'cancelled_by_customer'
                      )
                      .map(renderOrderCard)}
                  </>
                )}
              </>
            ) : activeFilter === 'no-show' ? (
              <>
                {/* No-Show (Unresolved) Section */}
                {filteredOrders.filter(order => 
                  order.status === 'no_show' || order.status === 'no-show'
                ).length > 0 && (
                  <>
                    <StyledView className="mb-3 mt-2">
                      <StyledText className="text-sm font-bold text-gray-700 px-2">
                        No-Show (Customer Didn't Appear)
                      </StyledText>
                    </StyledView>
                    {filteredOrders
                      .filter(order => order.status === 'no_show' || order.status === 'no-show')
                      .map(renderOrderCard)}
                  </>
                )}

                {/* Pending Confirmation Section */}
                {filteredOrders.filter(order => 
                  order.status === 'active_waiting_for_no_show_confirmation'
                ).length > 0 && (
                  <>
                    <StyledView className="mb-3 mt-4">
                      <StyledText className="text-sm font-bold text-gray-700 px-2">
                        Pending Admin Review
                      </StyledText>
                    </StyledView>
                    {filteredOrders
                      .filter(order => order.status === 'active_waiting_for_no_show_confirmation')
                      .map(renderOrderCard)}
                  </>
                )}

                {/* Resolved Section */}
                {filteredOrders.filter(order => 
                  order.status === 'no_show_resolved' || order.status === 'no-show-resolved'
                ).length > 0 && (
                  <>
                    <StyledView className="mb-3 mt-4">
                      <StyledText className="text-sm font-bold text-gray-700 px-2">
                        Resolved
                      </StyledText>
                    </StyledView>
                    {filteredOrders
                      .filter(order => 
                        order.status === 'no_show_resolved' || order.status === 'no-show-resolved'
                      )
                      .map(renderOrderCard)}
                  </>
                )}
              </>
            ) : (
              /* Regular display for other filters */
              filteredOrders.map(renderOrderCard)
            )}
          </StyledView>
        ) : (
          /* Empty State */
          <StyledView className="flex-1 justify-center items-center py-16">
            <StyledView className="bg-white rounded-3xl p-8 items-center shadow-sm border border-gray-100 mx-4">
              <StyledView className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                <MaterialIcons 
                  name={searchQuery ? "search-off" : "receipt-long"} 
                  size={40} 
                  color="#9CA3AF" 
                />
              </StyledView>

              <StyledText className="text-xl font-semibold text-gray-900 mb-2 text-center">
                {searchQuery 
                  ? "No Orders Found" 
                  : activeFilter === 'all' 
                    ? "No Accepted Orders"
                    : `No ${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Orders`
                }
              </StyledText>

              <StyledText className="text-sm text-gray-600 text-center mb-6 leading-relaxed px-4">
                {searchQuery 
                  ? `No orders found matching "${searchQuery}". Try searching with a different Order ID.`
                  : activeFilter === 'all'
                    ? "Orders that you've accepted will appear here. You can manage their status and track progress from this screen."
                    : `No ${activeFilter} orders found. Use the filter buttons above to view different order types.`
                }
              </StyledText>

              {searchQuery ? (
                <StyledTouchableOpacity
                  className="bg-[#BC4A4D] px-6 py-3 rounded-2xl shadow-sm"
                  onPress={() => setSearchQuery('')}
                >
                  <StyledView className="flex-row items-center">
                    <MaterialIcons name="clear" size={20} color="white" />
                    <StyledText className="text-white font-semibold text-base ml-2">Clear Search</StyledText>
                  </StyledView>
                </StyledTouchableOpacity>
              ) : (
                <StyledTouchableOpacity
                  className="bg-[#BC4A4D] px-6 py-3 rounded-2xl shadow-sm"
                  onPress={() => router.push('/shop/items')}
                >
                  <StyledView className="flex-row items-center">
                    <MaterialIcons name="inventory" size={20} color="white" />
                    <StyledText className="text-white font-semibold text-base ml-2">View My Items</StyledText>
                  </StyledView>
                </StyledTouchableOpacity>
              )}
            </StyledView>
          </StyledView>
        )}
      </StyledScrollView>

      <BottomNavigation activeTab="Orders" />
    </SafeAreaView>
  );
});