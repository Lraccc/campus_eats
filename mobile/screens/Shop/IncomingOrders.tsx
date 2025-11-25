import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  Image,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNavigation from '../../components/BottomNavigation';
import CampusRegistrationModal from '../../components/CampusRegistrationModal';
import { API_URL } from '../../config';
import { AUTH_TOKEN_KEY, clearStoredAuthState, useAuthentication } from '../../services/authService';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

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
  shopData: any;
  items: OrderItem[];
  totalPrice: number;
  deliveryFee: number;
  status: string;
  paymentMethod: string;
  dasherId: string | null;
}

interface Campus {
  id: string
  name: string
  address: string
  city?: string
  state?: string
  isActive: boolean
}

interface ShopInfo {
  id: string
  name?: string
  campusId?: string
  imageUrl?: string
}

export default function IncomingOrders() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  const [declineSuccessVisible, setDeclineSuccessVisible] = useState(false);
  const [declineSuccessText, setDeclineSuccessText] = useState<string | null>(null);
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [acceptOrderId, setAcceptOrderId] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('');
  const [shopImage, setShopImage] = useState<string | null>(null);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const { signOut, getAccessToken } = useAuthentication();
  
  // Campus registration states
  const [showCampusModal, setShowCampusModal] = useState(false)
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [isCampusLoading, setIsCampusLoading] = useState(false)
  const [campusError, setCampusError] = useState<string | null>(null)
  const [showCustomAlert, setShowCustomAlert] = useState(false)
  const [customAlertConfig, setCustomAlertConfig] = useState<{
    title: string
    message: string
    type: 'success' | 'error'
    onClose?: () => void
  }>({ title: '', message: '', type: 'success' })
  
  // Polling state
  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isComponentMountedRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);
  const currentPollingIntervalRef = useRef(8000); // Start with 8 seconds

  // WebSocket state for real-time updates
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const stompClientRef = useRef<Client | null>(null);
  const isConnectedRef = useRef<boolean>(false);
  const connectionRetryCount = useRef<number>(0);
  const maxRetries = 3;

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
    // Create a custom error handler for Axios
    const axiosErrorHandler = axios.interceptors.response.use(
        response => response,
        error => {
          // Log significant errors but don't suppress them completely
          if (error.response && error.response.status !== 404) {
            console.warn('API Warning:', error.response?.status, error.message);
          }
          // For polling requests, we want to handle errors properly
          return Promise.reject(error);
        }
    );

    fetchAllOrders();

    // Clean up the interceptor when component unmounts
    return () => {
      axios.interceptors.response.eject(axiosErrorHandler);
    };
  }, []);

  useEffect(() => {
    const fetchShopId = async () => {
      try {
        const storedShopId = await AsyncStorage.getItem('userId');
        setShopId(storedShopId);
        
        // Fetch shop details if we have shopId
        if (storedShopId) {
          try {
            const token = await getAccessToken();
            const response = await axios.get(`${API_URL}/api/shops/${storedShopId}`, {
              headers: { Authorization: token }
            });
            if (response.data) {
              setShopInfo(response.data);
              if (response.data.name) {
                setShopName(response.data.name);
              }
              // If shop has an imageUrl field, store it for header background
              if (response.data.imageUrl) {
                setShopImage(response.data.imageUrl);
              }
            }
          } catch (error) {
            console.warn('Failed to fetch shop details:', error);
          }
        }
      } catch (error) {
        console.error('Failed to fetch shop ID:', error);
      }
    };
    fetchShopId();
  }, []);

  // Check campus registration after shop info is fetched
  useEffect(() => {
    if (shopInfo) {
      checkCampusRegistration()
    }
  }, [shopInfo])

  // WebSocket connection effect - connect when shopId is available
  useEffect(() => {
    if (shopId) {
      console.log('🔗 Attempting to connect WebSocket for shop:', shopId);
      connectWebSocket(shopId);
    }

    return () => {
      console.log('🧹 Cleaning up shop WebSocket connection');
      disconnectWebSocket();
    };
  }, [shopId]);

  // Component cleanup
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
      disconnectWebSocket();
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Polling mechanism for real-time order updates
  useEffect(() => {
    const startPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Start polling with adaptive interval
      const poll = async () => {
        if (!isComponentMountedRef.current || isLoading || refreshing) {
          scheduleNextPoll();
          return;
        }

        try {
          setIsPolling(true);
          setPollingError(null);
          
          console.log('📊 Polling for new incoming orders...');
          await fetchOrders();
          
          console.log('✅ Incoming orders polling successful');
          
          // Reset error count and interval on success
          consecutiveErrorsRef.current = 0;
          currentPollingIntervalRef.current = 8000; // Reset to 8 seconds
          
        } catch (error) {
          console.error('❌ Incoming orders polling failed:', error);
          setPollingError('Failed to check for new orders');
          
          // Increase error count and adjust polling interval
          consecutiveErrorsRef.current += 1;
          
          // Exponential backoff: 8s -> 16s -> 30s -> 60s (max)
          const backoffMultiplier = Math.min(Math.pow(2, consecutiveErrorsRef.current - 1), 7.5);
          currentPollingIntervalRef.current = Math.min(8000 * backoffMultiplier, 60000);
          
          console.log(`⏰ Consecutive errors: ${consecutiveErrorsRef.current}, next poll in ${currentPollingIntervalRef.current/1000}s`);
        } finally {
          if (isComponentMountedRef.current) {
            setIsPolling(false);
          }
        }
        
        scheduleNextPoll();
      };

      const scheduleNextPoll = () => {
        pollingIntervalRef.current = setTimeout(poll, currentPollingIntervalRef.current);
      };

      // Start first poll
      poll();

      console.log('🔄 Started polling for incoming orders');
    };

    if (shopId && !isLoading) {
      startPolling();
    }

    // Cleanup polling on unmount or shopId change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log('⏹️ Stopped polling for incoming orders');
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

  const fetchAllOrders = async () => {
    try {
      await fetchOrders();
    } catch (error) {
      console.error('Error in fetchAllOrders:', error);
      
      // Set empty orders array when all endpoints fail
      if (isComponentMountedRef.current) {
        setOrders([]);
      }
      
      // Only show alert if not polling to avoid spam
      if (!isPolling && isComponentMountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load incoming orders';
        Alert.alert('Connection Error', `Unable to fetch orders: ${errorMessage}\n\nPlease check your connection and try again.`);
      }
      
      // Re-throw for polling error handling
      throw error;
    } finally {
      if (isComponentMountedRef.current) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  };

  // WebSocket connection management for shops
  const connectWebSocket = async (shopId: string) => {
    if (isConnectedRef.current || stompClientRef.current) {
      console.log('🏪 Shop WebSocket already connected or connecting');
      return;
    }

    try {
      console.log('🔗 Connecting to WebSocket for shop:', shopId);
      
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }
      
      if (!token) {
        console.log('❌ No token available for shop WebSocket connection');
        return;
      }

      // Use proper WebSocket URL construction for React Native
      const wsUrl = API_URL + '/ws';
      console.log('🔗 Shop WebSocket URL:', wsUrl);
      const socket = new SockJS(wsUrl);

      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!isConnectedRef.current) {
          console.log('⚠️ Shop WebSocket connection timeout after 3 seconds');
          console.log('⚠️ This usually means the WebSocket server is not available or reachable');
        }
      }, 3000);

      const client = new Client({
        webSocketFactory: () => socket,
        connectHeaders: {
          'Authorization': token
        },
        debug: (str) => {
          // Only log important debug messages to reduce console spam
          if (str.includes('connected') || str.includes('error') || str.includes('disconnect')) {
            console.log('🔧 Shop STOMP Debug:', str);
          }
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: (frame) => {
          console.log('✅ Shop WebSocket connected successfully!', frame);
          isConnectedRef.current = true;
          setIsWebSocketConnected(true);
          connectionRetryCount.current = 0;
          clearTimeout(connectionTimeout);

          try {
            // Subscribe to shop-specific new order notifications
            client.subscribe(`/topic/shops/${shopId}/new-orders`, (message) => {
              if (!isComponentMountedRef.current) return;
              
              try {
                const newOrderData = JSON.parse(message.body);
                console.log('🏪 New order notification for shop:', newOrderData);
                
                // Handle the new order notification
                handleNewShopOrderNotification(newOrderData);
              } catch (error) {
                console.error('❌ Error parsing shop order message:', error);
              }
            });

            console.log('🎯 Subscribed to shop orders topic:', `/topic/shops/${shopId}/new-orders`);
          } catch (subscriptionError) {
            console.error('❌ Error subscribing to shop topics:', subscriptionError);
          }
        },
        onDisconnect: () => {
          console.log('📡 Shop WebSocket disconnected');
          isConnectedRef.current = false;
          setIsWebSocketConnected(false);
        },
        onStompError: (frame) => {
          console.error('❌ Shop STOMP error:', frame.headers?.['message'] || 'Unknown error');
          console.error('❌ Error details:', frame.body || 'No error details');
          isConnectedRef.current = false;
          setIsWebSocketConnected(false);
          clearTimeout(connectionTimeout);
          
          // Retry connection with exponential backoff
          if (connectionRetryCount.current < maxRetries) {
            connectionRetryCount.current++;
            const retryDelay = Math.pow(2, connectionRetryCount.current) * 1000;
            console.log(`🔄 Retrying shop WebSocket connection in ${retryDelay}ms (attempt ${connectionRetryCount.current}/${maxRetries})`);
            
            setTimeout(() => {
              if (isComponentMountedRef.current && shopId) {
                connectWebSocket(shopId);
              }
            }, retryDelay);
          } else {
            console.error('❌ Max shop WebSocket retry attempts reached');
          }
        },
        onWebSocketClose: (evt) => {
          console.log('🔴 Shop WebSocket closed:', evt.reason || 'Unknown reason');
          isConnectedRef.current = false;
          setIsWebSocketConnected(false);
        },
        onWebSocketError: (evt) => {
          console.error('❌ Shop WebSocket error:', evt);
          isConnectedRef.current = false;
          setIsWebSocketConnected(false);
        }
      });

      stompClientRef.current = client;
      
      // Add error handling for activation
      try {
        client.activate();
        console.log('🔄 Shop WebSocket activation initiated...');
      } catch (activationError) {
        console.error('❌ Failed to activate shop STOMP client:', activationError);
      }
    } catch (error) {
      console.error('❌ Error setting up shop WebSocket:', error);
    }
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (stompClientRef.current) {
      console.log('🔌 Disconnecting shop WebSocket');
      try {
        stompClientRef.current.deactivate();
        console.log('✅ Shop WebSocket disconnected successfully');
      } catch (error) {
        console.error('❌ Error during shop WebSocket disconnection:', error);
      }
      stompClientRef.current = null;
    }
    
    isConnectedRef.current = false;
    setIsWebSocketConnected(false);
    connectionRetryCount.current = 0;
  };

  // Handle new shop order notification
  const handleNewShopOrderNotification = async (orderData: any) => {
    try {
      console.log('🔔 Processing new shop order notification:', orderData);
      
      // Refresh orders list to include the new order
      await fetchOrders();
      
      // You could also show an alert or toast notification here
      console.log('🎉 New order received for shop!');
    } catch (error) {
      console.error('❌ Error handling new shop order notification:', error);
    }
  };

  const checkCampusRegistration = async () => {
    try {
      // Check if shop has a campusId assigned
      if (!shopInfo?.campusId) {
        console.log("Shop has no campus assigned, showing campus selection modal")
        // Fetch available campuses
        await fetchCampuses()
        setShowCampusModal(true)
      } else {
        console.log("Shop already registered to campus:", shopInfo.campusId)
      }
    } catch (error) {
      console.error("Error checking campus registration:", error)
    }
  }

  const fetchCampuses = async () => {
    setIsCampusLoading(true)
    setCampusError(null)
    try {
      let token = await getAccessToken()

      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)
      }

      if (!token) {
        throw new Error("No authentication token available")
      }

      const response = await axios.get(`${API_URL}/api/campuses`, {
        headers: { Authorization: token },
      })

      if (response.data && Array.isArray(response.data)) {
        setCampuses(response.data)
      } else {
        throw new Error("Invalid campuses data received")
      }
    } catch (error: any) {
      console.error("Error fetching campuses:", error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to load campuses"
      setCampusError(errorMessage)
      setCustomAlertConfig({
        title: "Error",
        message: "Unable to load campus list. Please check your connection and try again.",
        type: "error"
      })
      setShowCustomAlert(true)
    } finally {
      setIsCampusLoading(false)
    }
  }

  const handleSelectCampus = async (campusId: string) => {
    if (!shopInfo?.id) {
      Alert.alert("Error", "Shop information not available")
      return
    }

    setIsCampusLoading(true)
    try {
      let token = await getAccessToken()

      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)
      }

      if (!token) {
        throw new Error("No authentication token available")
      }

      // Update shop's campus assignment
      const response = await axios.put(
        `${API_URL}/api/shops/${shopInfo.id}/assign-campus?campusId=${campusId}`,
        {},
        {
          headers: { Authorization: token },
        }
      )

      if (response.status === 200) {
        console.log("Campus assigned successfully to shop")
        
        // Update local shop info
        setShopInfo(prev => prev ? { ...prev, campusId } : null)
        
        // Close modal
        setShowCampusModal(false)
        
        // Show success message
        setCustomAlertConfig({
          title: "Success",
          message: "Campus registration completed successfully!",
          type: "success"
        })
        setShowCustomAlert(true)
      }
    } catch (error: any) {
      console.error("Error assigning campus:", error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to register campus"
      setCustomAlertConfig({
        title: "Registration Failed",
        message: errorMessage,
        type: "error",
        onClose: () => setIsCampusLoading(false)
      })
      setShowCustomAlert(true)
    } finally {
      setIsCampusLoading(false)
    }
  }

  const fetchOrders = async () => {
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
      const userId = await AsyncStorage.getItem('userId');
      
      if (!userId) {
        throw new Error('User ID not available');
      }

      console.log('📎 Fetching incoming orders for shop:', userId);
      
      let allOrders: any[] = [];
      
      // Try multiple endpoints to find incoming orders
      const endpoints = [
        { url: `${API_URL}/api/orders/active-waiting-for-shop`, name: 'active-waiting-for-shop' },
        { url: `${API_URL}/api/orders/pending`, name: 'pending' },
        { url: `${API_URL}/api/orders/waiting-for-confirmation`, name: 'waiting-for-confirmation' },
        { url: `${API_URL}/api/orders/shop/${userId}`, name: 'shop-specific' },
        { url: `${API_URL}/api/orders`, name: 'all-orders' }
      ];

      let successfulEndpoint = null;
      
      for (const endpoint of endpoints) {
        try {
          console.log(`📡 Trying endpoint: ${endpoint.name}`);
          const response = await axios.get(endpoint.url, config);
          
          if (response.data && Array.isArray(response.data) && response.data.length >= 0) {
            allOrders = response.data;
            successfulEndpoint = endpoint.name;
            console.log(`✅ Successfully fetched from ${endpoint.name}: ${allOrders.length} orders`);
            break;
          }
        } catch (endpointError: any) {
          console.log(`⚠️ Endpoint ${endpoint.name} failed:`, endpointError.response?.status || endpointError.message);
          continue;
        }
      }

      if (!successfulEndpoint) {
        throw new Error('All API endpoints failed to return order data');
      }

      // Filter orders to only include those for this shop that need confirmation
      const rawFilteredOrders = allOrders.filter((order: any) => 
        order.shopId === userId && 
        (order.status === 'waiting_for_shop_confirmation' || 
         order.status === 'active_waiting_for_shop' ||
         order.status === 'pending' ||
         order.status === 'new')
      );

      console.log(`🎯 Found ${rawFilteredOrders.length} potential incoming orders after filtering`);

      // Add shop data to orders
      const ordersWithShopData = await Promise.all(rawFilteredOrders.map(async (order: any) => {
        try {
          const shopDataResponse = await axios.get(`${API_URL}/api/shops/${order.shopId}`, config);
          return { ...order, shopData: shopDataResponse.data };
        } catch (shopError) {
          console.warn(`Failed to fetch shop data for order ${order.id}:`, shopError);
          return { ...order, shopData: null };
        }
      }));

      console.log(`📎 Final count: ${ordersWithShopData.length} incoming orders ready for display`);
      
      setOrders(ordersWithShopData);
    } catch (error) {
      console.error('Error fetching incoming orders:', error);
      throw error; // Re-throw for proper error handling
    }
  };





  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchAllOrders();
  }, []);

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrderIds(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const handleAcceptOrder = (orderId: string) => {
    setAcceptOrderId(orderId);
    setAcceptModalVisible(true);
  };

  const confirmAcceptOrder = async () => {
    if (!acceptOrderId) return;

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        return;
      }

      const config = { headers: { Authorization: token } };

      await axios.post(`${API_URL}/api/orders/update-order-status`,
          { orderId: acceptOrderId, status: 'active_shop_confirmed' },
          config
      );
      
      setAcceptModalVisible(false);
      setAcceptOrderId(null);
      fetchOrders();
    } catch (error) {
      // Suppress error without logging
      setAcceptModalVisible(false);
    }
  };

  const handleDeclineOrder = (order: Order) => {
    setSelectedOrder(order);
    setDeclineModalVisible(true);
  };

  const confirmDeclineOrder = async () => {
    if (!selectedOrder) return;

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        return;
      }

      const config = { headers: { Authorization: token } };

      let newStatus = selectedOrder.dasherId !== null
          ? 'active_waiting_for_shop_cancel_confirmation'
          : 'cancelled_by_shop';

      await axios.post(`${API_URL}/api/orders/update-order-status`,
          { orderId: selectedOrder.id, status: newStatus },
          config
      );

      // If payment was online, process refund
      if (selectedOrder.paymentMethod === 'gcash') {
        const paymentResponse = await axios.get(
            `${API_URL}/api/payments/get-payment-by-reference/${selectedOrder.id}`,
            config
        );

        if (paymentResponse.data.payment_id) {
          const refundPayload = {
            paymentId: paymentResponse.data.payment_id,
            amount: selectedOrder.totalPrice + selectedOrder.deliveryFee,
            reason: "others",
            notes: "Refund initiated by shop."
          };

          await axios.put(
              `${API_URL}/api/shops/update/${selectedOrder.shopId}/wallet`,
              null,
              {
                ...config,
                params: { totalPrice: -(selectedOrder.totalPrice) }
              }
          );

          await axios.post(`${API_URL}/api/payments/process-refund`, refundPayload, config);
        }
      }

      // Show themed success modal instead of native alert
      setDeclineSuccessText('Order declined successfully');
      setDeclineSuccessVisible(true);
      setDeclineModalVisible(false);
      setSelectedOrder(null);
      // Auto-dismiss the success modal after a short delay
      setTimeout(() => {
        if (isComponentMountedRef.current) {
          setDeclineSuccessVisible(false);
          setDeclineSuccessText(null);
        }
      }, 1600);
      // Notify customer about cancellation with a friendly message
      try {
        const userId = (selectedOrder as any)?.uid || (selectedOrder as any)?.userId || (selectedOrder as any)?.customerId || null;
        if (userId) {
          const notifyMessage = `We're sorry — some items in your order (Order #${selectedOrder.id}) are out of stock. Your order has been cancelled and a refund (if applicable) has been initiated. We apologize for the inconvenience.`;
          try {
            await axios.post(`${API_URL}/api/notifications/send-user`, { userId, message: notifyMessage }, config);
            console.log('✅ Sent cancellation notification to user:', userId);
          } catch (notifyError) {
            console.warn('⚠️ Failed to send cancellation notification to user:', notifyError);
          }
        } else {
          console.warn('⚠️ Could not determine userId to notify for order', selectedOrder.id);
        }
      } catch (err) {
        console.warn('⚠️ Error while attempting to notify user about cancellation:', err);
      }

      fetchOrders();
    } catch (error) {
      // Suppress error without logging
    }
  };

  const handleLogout = async () => {
    try {
      console.log("Performing complete sign-out...");

      // Use the signOut method from authentication hook if available
      if (signOut) {
        await signOut();
      }

      // Also use the clearStoredAuthState function for additional safety
      await clearStoredAuthState();

      // Clear ALL app storage to ensure no user data remains
      await AsyncStorage.clear();
      console.log("⚠️ ALL AsyncStorage data has been cleared!");

      // Force navigation to root
      console.log("Sign-out complete, redirecting to login page");
      router.replace('/');

      // Add a double check to ensure navigation works
      setTimeout(() => {
        console.log("Double-checking navigation after logout...");
        router.replace('/');
      }, 500);
    } catch (error) {
      console.error("Error during sign-out:", error);
      // Even if there's an error, try to navigate away
      router.replace('/');
    }
  };

  const renderOrderItems = (items: OrderItem[]) => {
    return items.map((item, index) => (
      <View key={index} style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        marginBottom: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#f9f9f9',
        borderRadius: 8
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={{
            backgroundColor: '#BC4A4D',
            width: 26, 
            height: 26, 
            borderRadius: 13, 
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10
          }}>
            <Text style={{ fontSize: 12, color: 'white', fontWeight: 'bold' }}>{item.quantity}</Text>
          </View>
          <Text style={{ fontSize: 14, color: '#333', flex: 1, fontWeight: '500' }}>{item.name}</Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#BC4A4D', marginLeft: 8 }}>₱{item.price.toFixed(2)}</Text>
      </View>
    ));
  };

  const renderOrderCard = (order: Order, isOngoing: boolean = false) => {
    const isExpanded = expandedOrderIds[order.id] || false;
    const paymentMethod = order.paymentMethod === 'gcash' ? 'Online Payment' : 'Cash on Delivery';

    return (
        <View key={order.id} style={{
          backgroundColor: 'white',
          borderRadius: 16,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 3,
          borderWidth: 1,
          borderColor: isOngoing ? '#10B98120' : '#BC4A4D15',
          overflow: 'hidden',
        }}>
          <TouchableOpacity
              style={{ padding: 14 }}
              activeOpacity={0.7}
              onPress={() => toggleOrderExpansion(order.id)}
          >
            <View style={{ flexDirection: 'column' }}>
              {/* Top row with customer info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: isOngoing ? '#10B98115' : '#BC4A4D15',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                  borderWidth: 2,
                  borderColor: isOngoing ? '#10B98130' : '#BC4A4D30',
                }}>
                  <Ionicons 
                    name="person" 
                    size={22} 
                    color={isOngoing ? '#10B981' : '#BC4A4D'} 
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text 
                    style={{ 
                      fontSize: 15, 
                      fontWeight: 'bold', 
                      color: '#333', 
                      marginBottom: 3,
                      flexWrap: 'wrap'
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {order.firstname} {order.lastname}
                  </Text>
                  
                  <Text 
                    style={{ 
                      fontSize: 12, 
                      color: '#555', 
                      marginBottom: 4,
                      flexWrap: 'wrap' 
                    }}
                    numberOfLines={1}
                  >
                    Order #{order.id.substring(0, 8)}...
                  </Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      backgroundColor: order.paymentMethod === 'gcash' ? '#3B82F615' : '#F59E0B15',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: order.paymentMethod === 'gcash' ? '#3B82F630' : '#F59E0B30',
                    }}>
                      <Ionicons
                        name={order.paymentMethod === 'gcash' ? "card" : "cash"}
                        size={14}
                        color={order.paymentMethod === 'gcash' ? "#3B82F6" : "#F59E0B"}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={{ 
                        fontSize: 11, 
                        fontWeight: '600',
                        color: order.paymentMethod === 'gcash' ? "#3B82F6" : "#F59E0B" 
                      }}>
                        {paymentMethod}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{
                  backgroundColor: '#F5F5F5', 
                  width: 28, 
                  height: 28, 
                  borderRadius: 14,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#666"
                  />
                </View>
              </View>
              
              {/* Bottom row with action buttons */}
              {!isOngoing && (
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'flex-end',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: '#F0EBE420'
                }}>
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#FEF2F2',
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: '#FECACA',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#EF4444',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 1,
                    }}
                    activeOpacity={0.7}
                    onPress={() => handleDeclineOrder(order)}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>
                      Decline
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      backgroundColor: '#10B981',
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#10B981',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 3,
                      elevation: 2,
                    }}
                    activeOpacity={0.8}
                    onPress={() => handleAcceptOrder(order.id)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="white" style={{ marginRight: 4 }} />
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>Accept</Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* <View style={{
                backgroundColor: '#F5F5F5', 
                width: 30, 
                height: 30, 
                borderRadius: 15,
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#666"
                />
              </View> */}
            </View>
          </TouchableOpacity>

          {isExpanded && (
              <View style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: isOngoing ? '#10B98120' : '#BC4A4D20',
                backgroundColor: isOngoing ? '#F0FDF415' : '#FEF7F015',
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16
              }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: isOngoing ? '#10B981' : '#BC4A4D',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}>
                    <Ionicons name="receipt" size={14} color="white" />
                  </View>
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: 'bold', 
                    color: '#333',
                  }}>
                    Order Summary
                  </Text>
                </View>
                {renderOrderItems(order.items)}

                <View style={{
                  backgroundColor: 'white',
                  borderRadius: 10,
                  padding: 12,
                  marginTop: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: '#666', fontWeight: '500' }}>Subtotal</Text>
                    <Text style={{ fontSize: 13, color: '#333', fontWeight: '600' }}>₱{order.totalPrice.toFixed(2)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: '#666', fontWeight: '500' }}>Delivery Fee</Text>
                    <Text style={{ fontSize: 13, color: '#333', fontWeight: '600' }}>
                      ₱{order.shopData?.deliveryFee.toFixed(2) || '0.00'}
                    </Text>
                  </View>

                  <View style={{
                    height: 1,
                    backgroundColor: '#E5E7EB',
                    marginVertical: 8,
                  }} />

                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <Text style={{ 
                      fontSize: 15, 
                      fontWeight: 'bold', 
                      color: '#333' 
                    }}>
                      Total Amount
                    </Text>
                    <Text style={{ 
                      fontSize: 16, 
                      fontWeight: 'bold', 
                      color: isOngoing ? '#10B981' : '#BC4A4D' 
                    }}>
                      ₱{(order.totalPrice + (order.shopData?.deliveryFee || 0)).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {isOngoing && (
                    <View style={{ marginTop: 12 }}>
                      <View style={{
                        backgroundColor: '#ECFDF5',
                        borderWidth: 1,
                        borderColor: '#A7F3D0',
                        borderRadius: 10,
                        padding: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        shadowColor: '#10B981',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 1,
                      }}>
                        <View style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: '#10B981',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10,
                        }}>
                          <Ionicons name="time" size={14} color="white" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ 
                            fontSize: 12, 
                            color: '#065F46', 
                            fontWeight: '600',
                            marginBottom: 2,
                          }}>
                            Order Status
                          </Text>
                          <Text style={{ 
                            fontSize: 14, 
                            color: '#10B981', 
                            fontWeight: 'bold',
                            textTransform: 'capitalize',
                          }}>
                            {order.status.replace('active_', '').replace('_', ' ')}
                          </Text>
                        </View>
                      </View>
                    </View>
                )}
              </View>
          )}
        </View>
    );
  };

  const startStream = () => {
    // Navigate to separate livestream screen
    router.push({
      pathname: '/shop/livestream',
      params: {
        shopId: shopId || '',
        shopName: shopName || ''
      }
    });
  };

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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#DFD6C5' }}>
          <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
            <View 
              style={{
                alignItems: 'center',
              }}
            >
              {/* Spinning Logo Container */}
              <View style={{ position: 'relative', marginBottom: 24 }}>
                {/* Outer rotating circle */}
                <Animated.View
                  style={{
                    transform: [{ rotate: circleRotation }],
                    position: 'absolute',
                    width: 80,
                    height: 80,
                    borderWidth: 2,
                    borderColor: 'rgba(188, 74, 77, 0.2)',
                    borderTopColor: '#BC4A4D',
                    borderRadius: 40,
                  }}
                />
                
                {/* Logo container */}
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(188, 74, 77, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginHorizontal: 8,
                  marginVertical: 8,
                }}>
                  <Animated.View
                    style={{
                      transform: [{ rotate: spin }],
                    }}
                  >
                    <Image
                        source={require('../../assets/images/logo.png')}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                  </Animated.View>
                </View>
              </View>
              
              {/* Brand Name */}
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                <Text style={{ color: '#BC4A4DFF' }}>Campus</Text>
                <Text style={{ color: '#DAA520' }}>Eats</Text>
              </Text>
              
              {/* Loading Text */}
              <Text style={{ color: '#BC4A4D', fontSize: 16, fontWeight: '600' }}>
                Loading...
              </Text>
            </View>
          </View>
          <BottomNavigation activeTab="Home" />
        </SafeAreaView>
    );
  }

  const AcceptModalComponent = () => (
    <Modal
      transparent={true}
      visible={acceptModalVisible}
      animationType="fade"
      onRequestClose={() => setAcceptModalVisible(false)}
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ 
          backgroundColor: 'white', 
          borderRadius: 24, 
          padding: 24, 
          width: '100%', 
          maxWidth: 340,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 5
        }}>
          <View style={{
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: '#F8DEDE',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
            borderWidth: 2,
            borderColor: '#fb8588'
          }}>
            <Ionicons name="checkmark-circle" size={36} color="#BC4A4D" />
          </View>
          
          <Text style={{ 
            fontSize: 20, 
            fontWeight: 'bold', 
            color: '#333', 
            marginBottom: 12, 
            textAlign: 'center' 
          }}>
            Accept Order
          </Text>
          
          <Text style={{ 
            fontSize: 15,
            lineHeight: 22, 
            color: '#555', 
            marginBottom: 24, 
            textAlign: 'center' 
          }}>
            Are you ready to prepare this order? Once accepted, you'll need to start preparing the items.
          </Text>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
            <TouchableOpacity 
              style={{
                flex: 1,
                backgroundColor: '#F5F5F5',
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                marginRight: 10,
                borderWidth: 1,
                borderColor: '#E0E0E0'
              }}
              activeOpacity={0.7}
              onPress={() => setAcceptModalVisible(false)}
            >
              <Text style={{ color: '#555', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#BC4A4D',
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: 2
              }}
              activeOpacity={0.7}
              onPress={confirmAcceptOrder}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#DFD6C5' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
        <AcceptModalComponent />

        <>
          {/* Header with optional shop image background */}
          <View style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 3,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            overflow: 'hidden',
            marginBottom: 5,
          }}>
            {shopImage ? (
              <ImageBackground
                source={{ uri: shopImage }}
                style={{ width: '100%', minHeight: 180 }}
                resizeMode="cover"
                blurRadius={1}
              >
        {/* Layered overlay: subtle gradient-like effect using one view */}
                <LinearGradient
                  colors={[ 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.24)' ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{ paddingTop: 12, paddingBottom: 18, paddingHorizontal: 20, minHeight: 180, justifyContent: 'flex-start' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -1 }}>
                    {/* Brand on the top-left */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: 'white', letterSpacing: 0.2 }} numberOfLines={1} accessibilityLabel="Campus Eats brand">
                        <Text style={{ color: 'white' }}>Campus</Text>
                        <Text style={{ color: '#FFD66B' }}> Eats</Text>
                      </Text>
                    </View>

                    {/* Action buttons on the top-right: Start Live */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={startStream}
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel="Start live stream"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          backgroundColor: '#E85B5F',
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 18,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 8,
                        }}
                      >
                        <View style={{ width: 15, height: 15, borderRadius: 5, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                          <Ionicons name="videocam" size={11} color="#E85B5F" />
                        </View>
                        <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>Start Live</Text>
                      </TouchableOpacity>

                      
                    </View>
                  </View>

                  <View style={{ alignItems: 'center', marginTop: 20 }}>
                    <Text style={{ 
                      fontSize: 18, 
                      fontWeight: '700', 
                      color: 'white',
                      marginBottom: 6,
                      textAlign: 'center',
                      letterSpacing: 0.2,
                      textShadowColor: 'rgba(0,0,0,0.9)',
                      textShadowOffset: { width: 0, height: 2 },
                      textShadowRadius: 6,
                    }}
                    accessibilityRole="header"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    >
                      Shop Dashboard
                    </Text>

                    {shopName && (
                      <View style={{
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 22,
                        alignSelf: 'center',
                        marginTop: 0,
                        marginBottom: 6,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)'
                      }}
                      accessibilityLabel={`Shop: ${shopName}`}>
                        <Text style={{ 
                          color: 'white', 
                          fontSize: 15, 
                          fontWeight: '700',
                          textAlign: 'center',
                          letterSpacing: 0.3,
                        }} numberOfLines={1} ellipsizeMode="tail">
                          🏪 {shopName}
                        </Text>
                      </View>
                    )}

                    
                  </View>
                </LinearGradient>
              </ImageBackground>
            ) : (
              <View style={{
                backgroundColor: 'white',
                paddingHorizontal: 20,
                paddingVertical: 18,
                minHeight: 120,
                borderBottomColor: 'rgba(0,0,0,0.04)',
                borderBottomWidth: 1,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -8 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#BC4A4D' }}>
                    <Text style={{ color: '#BC4A4D' }}>Campus</Text>
                    <Text style={{ color: '#DAA520' }}> Eats</Text>
                  </Text>

                  <View style={{ width: 40 }} />
                </View>

                <View style={{ alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ 
                    fontSize: 18, 
                    fontWeight: '700', 
                    color: '#111827',
                    marginBottom: 8,
                    textAlign: 'center',
                    letterSpacing: 0.2,
                  }}>
                    Shop Dashboard
                  </Text>

                  {shopName && (
                    <View style={{
                      backgroundColor: '#BC4A4D10',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      alignSelf: 'center',
                      marginTop: 6,
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: 'rgba(188,74,77,0.12)'
                    }}>
                      <Text style={{ 
                        color: '#5B1D1E', 
                        fontSize: 15, 
                        fontWeight: '700',
                        textAlign: 'center',
                        letterSpacing: 0.3,
                      }}>
                        🏪 {shopName}
                      </Text>
                    </View>
                  )}

                  
                </View>
              </View>
            )}
          </View>

          <ScrollView
              style={{ flex: 1, padding: 16 }}
              refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={['#BC4A4D']}
                    tintColor="#BC4A4D"
                />
              }
          >
            {/* Simple New Orders Section */}
            <View style={{ marginBottom: 20 }}>
              <View style={{
                backgroundColor: 'white',
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#BC4A4D15',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                    }}>
                      <Ionicons name="time" size={18} color="#BC4A4D" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ 
                          fontSize: 17, 
                          fontWeight: 'bold', 
                          color: '#333',
                          marginBottom: 2,
                        }}>
                          New Orders
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                          {isPolling && (
                            <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 4 }} />
                          )}
                          <View style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: pollingError ? '#EF4444' : '#10B981'
                          }} />
                          <Text style={{
                            marginLeft: 4,
                            fontSize: 9,
                            fontWeight: '600',
                            color: pollingError ? '#EF4444' : '#10B981'
                          }}>
                            {pollingError ? 'Error' : 'Auto-sync'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ 
                        fontSize: 13, 
                        color: '#666',
                      }}>
                        Waiting for approval • {pollingError ? 'Retrying...' : 'Auto-updating'}
                      </Text>
                    </View>
                  </View>
                  
                  {orders.length > 0 && (
                      <View style={{
                        backgroundColor: '#BC4A4D',
                        borderRadius: 16,
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        shadowColor: '#BC4A4D',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 3,
                        elevation: 2,
                      }}>
                        <Text style={{ 
                          color: 'white', 
                          fontWeight: 'bold', 
                          fontSize: 14 
                        }}>
                          {orders.length}
                        </Text>
                      </View>
                  )}
                </View>
              </View>

              {orders.length === 0 ? (
                  <View style={{
                    backgroundColor: 'white',
                    borderRadius: 16,
                    padding: 24,
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 4,
                    elevation: 2,
                  }}>
                    <View style={{
                      width: 60,
                      height: 60,
                      borderRadius: 30,
                      backgroundColor: '#BC4A4D10',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}>
                      <Ionicons name="fast-food-outline" size={30} color="#BC4A4D" />
                    </View>
                    <Text style={{ 
                      fontSize: 16, 
                      fontWeight: 'bold',
                      color: '#333', 
                      marginBottom: 6,
                      textAlign: 'center' 
                    }}>
                      All Caught Up!
                    </Text>
                    <Text style={{ 
                      fontSize: 14, 
                      color: '#666', 
                      textAlign: 'center',
                      lineHeight: 20,
                      marginBottom: 12,
                    }}>
                      No new orders waiting for approval at the moment
                    </Text>
                    
                  </View>
              ) : (
                  orders.map(order => renderOrderCard(order))
              )}
            </View>


          </ScrollView>
        </>

        {/* Decline Order Confirmation Modal */}
        <Modal
            animationType="fade"
            transparent={true}
            visible={declineModalVisible}
            onRequestClose={() => setDeclineModalVisible(false)}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}>
            <View style={{
              backgroundColor: 'white',
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 340,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 5
            }}>
              <View style={{
                width: 70,
                height: 70,
                borderRadius: 35,
                backgroundColor: '#FFEBEE',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
                borderWidth: 2,
                borderColor: '#FFCDD2'
              }}>
                <Ionicons name="close-circle" size={36} color="#F44336" />
              </View>
              
              <Text style={{ 
                fontSize: 20, 
                fontWeight: 'bold', 
                color: '#333', 
                marginBottom: 12,
                textAlign: 'center'
              }}>
                Decline Order
              </Text>
              
              <Text style={{ 
                fontSize: 15, 
                lineHeight: 22,
                color: '#555', 
                textAlign: 'center', 
                marginBottom: 24 
              }}>
                Are you sure you want to decline this order?
                {selectedOrder?.paymentMethod === 'gcash' ? (
                  <Text style={{ fontWeight: '500', color: '#0277BD' }}>
                    {' '}This will process a refund to the customer.
                  </Text>
                ) : ('')}
              </Text>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#F5F5F5',
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: 'center',
                      marginRight: 10,
                      borderWidth: 1,
                      borderColor: '#E0E0E0'
                    }}
                    activeOpacity={0.7}
                    onPress={() => {
                      setDeclineModalVisible(false);
                      setSelectedOrder(null);
                    }}
                >
                  <Text style={{ color: '#555', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#F44336',
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                      elevation: 2
                    }}
                    activeOpacity={0.7}
                    onPress={confirmDeclineOrder}
                >
                  <Ionicons name="close-circle-outline" size={18} color="white" style={{ marginRight: 6 }} />
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Decline Success Modal (themed) */}
        <Modal
          transparent={true}
          visible={declineSuccessVisible}
          animationType="fade"
          onRequestClose={() => setDeclineSuccessVisible(false)}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', padding: 20 }}>
            <View style={{
              backgroundColor: 'white',
              borderRadius: 20,
              padding: 20,
              width: '100%',
              maxWidth: 320,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 6
            }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: '#ECFDF5',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#A7F3D0'
              }}>
                <Ionicons name="checkmark-circle" size={36} color="#10B981" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6, textAlign: 'center' }}>Done</Text>
              {declineSuccessText && (
                <Text style={{ fontSize: 14, color: '#374151', textAlign: 'center' }}>{declineSuccessText}</Text>
              )}
            </View>
          </View>
        </Modal>

        {/* Campus Registration Modal */}
        <CampusRegistrationModal
          visible={showCampusModal}
          campuses={campuses}
          onSelectCampus={handleSelectCampus}
          isLoading={isCampusLoading}
          error={campusError}
        />

        {/* Custom Alert Modal */}
        <Modal
          transparent
          visible={showCustomAlert}
          animationType="fade"
          onRequestClose={() => {
            setShowCustomAlert(false)
            customAlertConfig.onClose?.()
          }}
        >
          <View style={{ 
            flex: 1, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            justifyContent: 'center', 
            alignItems: 'center', 
            paddingHorizontal: 24 
          }}>
            <View style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 340,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 5
            }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: customAlertConfig.type === 'success' ? '#ECFDF5' : '#FEE2E2',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
                borderWidth: 1,
                borderColor: customAlertConfig.type === 'success' ? '#A7F3D0' : '#FECACA'
              }}>
                <Ionicons 
                  name={customAlertConfig.type === 'success' ? 'checkmark-circle' : 'alert-circle'} 
                  size={40} 
                  color={customAlertConfig.type === 'success' ? '#10B981' : '#EF4444'} 
                />
              </View>
              <Text style={{ 
                fontSize: 20, 
                fontWeight: 'bold', 
                color: '#111827', 
                marginBottom: 8, 
                textAlign: 'center' 
              }}>
                {customAlertConfig.title}
              </Text>
              <Text style={{ 
                fontSize: 14, 
                color: '#6B7280', 
                marginBottom: 24, 
                textAlign: 'center',
                lineHeight: 20
              }}>
                {customAlertConfig.message}
              </Text>
              <TouchableOpacity
                style={{
                  width: '100%',
                  backgroundColor: customAlertConfig.type === 'success' ? '#BC4A4D' : '#374151',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2
                }}
                activeOpacity={0.8}
                onPress={() => {
                  setShowCustomAlert(false)
                  customAlertConfig.onClose?.()
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <BottomNavigation activeTab="Home" />
      </SafeAreaView>
  );
}