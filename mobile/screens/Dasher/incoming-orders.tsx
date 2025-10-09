import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';
import BottomNavigation from '../../components/BottomNavigation';
import { styled } from 'nativewind';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface Order {
  id: string;
  firstname: string;
  lastname: string;
  mobileNum: string;
  deliverTo: string;
  paymentMethod: string;
  note: string;
  totalPrice: number;
  status: string;
  items: {
    quantity: number;
    name: string;
    price: number;
  }[];
  shopId: string;
  createdAt: string;
  changeFor?: number;
  shopData?: Shop;
}

interface Shop {
  id: string;
  name: string;
  address: string;
  imageUrl: string;
  deliveryFee: number;
}

export default function DasherIncomingOrder() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [alert, setAlert] = useState<string | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);

  // Animation values for loading
  const spinValue = useRef(new Animated.Value(0)).current;
  const circleValue = useRef(new Animated.Value(0)).current;

  // WebSocket refs
  const stompClientRef = useRef<Client | null>(null);
  const isConnectedRef = useRef<boolean>(false);
  const isMountedRef = useRef(true);
  const connectionRetryCount = useRef<number>(0);
  const maxRetries = 3;

  useEffect(() => {
    // Get user data from AsyncStorage
    const getUserData = async () => {
      try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (token) {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            const id = payload.sub || payload.oid || payload.userId || payload.id;
            setUserId(id);
          }
        }
      } catch (err) {
        console.error('Error getting user data:', err);
      }
    };
    getUserData();
  }, []);

  useEffect(() => {
    // Fetch dasher status and orders when userId is available
    const fetchData = async () => {
      if (!userId) return;

      try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (!token) return;

        // Fetch dasher status
        console.log('Fetching dasher status for user ID in incoming orders:', userId);
        const statusResponse = await axios.get(`${API_URL}/api/dashers/${userId}`, {
          headers: { 'Authorization': token }
        });
        const currentStatus = statusResponse.data.status;
        setIsDelivering(currentStatus === 'active');

        // Fetch orders and connect WebSocket only if status is active
        if (currentStatus === 'active') {
          setLoading(true);
          try {
            await fetchIncomingOrders();
            
            // Connect to WebSocket for real-time notifications
            connectWebSocket(userId);
          } catch (error) {
            console.error('❌ Error during initial data fetch:', error);
          }
        } else {
          setOrders([]);
          // Disconnect WebSocket if not active
          disconnectWebSocket();
        }
      } catch (error) {
        console.error('Error fetching dasher status:', error);
        if (axios.isAxiosError(error) && error.response?.status !== 404) {
          Alert.alert('Error', 'Failed to fetch dasher status. Please try again.');
        }
        setIsDelivering(false);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up dasher incoming orders component');
      isMountedRef.current = false;
      disconnectWebSocket();
    };
  }, []);

  // Animation effect for loading state
  useEffect(() => {
    const startAnimations = () => {
      spinValue.setValue(0);
      circleValue.setValue(0);
      
      // Start spinning logo
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ).start();

      // Start circular loading line
      Animated.loop(
        Animated.timing(circleValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ).start();
    };

    if (loading) {
      startAnimations();
    }
  }, [loading, spinValue, circleValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const circleRotation = circleValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // WebSocket connection management
  const connectWebSocket = async (dasherId: string) => {
    if (isConnectedRef.current || stompClientRef.current) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    try {
      console.log('🔗 Connecting to WebSocket for dasher:', dasherId);
      
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        console.log('❌ No token available for WebSocket connection');
        return;
      }

      const socket = new SockJS(`${API_URL}/ws`);
      const client = new Client({
        webSocketFactory: () => socket,
        connectHeaders: {
          'Authorization': token
        },
        debug: (str) => {
          console.log('🔧 STOMP Debug:', str);
        },
        onConnect: (frame) => {
          console.log('✅ WebSocket connected for dasher:', frame);
          isConnectedRef.current = true;
          setIsWebSocketConnected(true);
          connectionRetryCount.current = 0;

          // Subscribe to general dashers new order notifications
          client.subscribe(`/topic/dashers/new-orders`, (message) => {
            if (!isMountedRef.current) return;
            
            try {
              const newOrderData = JSON.parse(message.body);
              console.log('📦 New order notification received:', newOrderData);
              
              // Add the new order to the list and fetch complete data
              handleNewOrderNotification(newOrderData);
            } catch (error) {
              console.error('❌ Error parsing new order message:', error);
            }
          });

          console.log('🎯 Subscribed to dashers new orders topic');
        },
        onDisconnect: () => {
          console.log('📡 WebSocket disconnected for dasher');
          isConnectedRef.current = false;
          setIsWebSocketConnected(false);
        },
        onStompError: (frame) => {
          console.error('❌ STOMP error:', frame);
          isConnectedRef.current = false;
          setIsWebSocketConnected(false);
          
          // Retry connection with exponential backoff
          if (connectionRetryCount.current < maxRetries) {
            connectionRetryCount.current++;
            const retryDelay = Math.pow(2, connectionRetryCount.current) * 1000;
            console.log(`🔄 Retrying WebSocket connection in ${retryDelay}ms (attempt ${connectionRetryCount.current})`);
            
            setTimeout(() => {
              if (isMountedRef.current && isDelivering && userId) {
                connectWebSocket(userId);
              }
            }, retryDelay);
          }
        }
      });

      stompClientRef.current = client;
      client.activate();
    } catch (error) {
      console.error('❌ Error setting up WebSocket:', error);
    }
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (stompClientRef.current) {
      console.log('🔌 Disconnecting WebSocket for dasher');
      stompClientRef.current.deactivate();
      stompClientRef.current = null;
    }
    
    isConnectedRef.current = false;
    setIsWebSocketConnected(false);
    connectionRetryCount.current = 0;
  };

  // Handle new order notification
  const handleNewOrderNotification = async (orderData: any) => {
    try {
      console.log('🔔 Processing new order notification:', orderData);
      
      // Show alert for new order
      setAlert('New order available! 🎉');
      
      // Refresh orders list to include the new order
      await fetchIncomingOrders();
      
      // Auto-clear alert after 5 seconds
      setTimeout(() => {
        setAlert(null);
      }, 5000);
    } catch (error) {
      console.error('❌ Error handling new order notification:', error);
    }
  };

  // Fetch incoming orders function (extracted for reuse)
  const fetchIncomingOrders = async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) return;

      console.log('📡 Fetching incoming orders...');
      const ordersResponse = await axios.get(`${API_URL}/api/orders/incoming-orders/dasher`, {
        headers: { 'Authorization': token }
      });

      console.log('📦 Orders response:', ordersResponse.data);

      if (ordersResponse.data) {
        const ordersWithShopData = await Promise.all(
          ordersResponse.data.map(async (order: Order) => {
            try {
              console.log('🏪 Fetching shop data for order:', order.id);
              const shopResponse = await axios.get(`${API_URL}/api/shops/${order.shopId}`, {
                headers: { 'Authorization': token }
              });
              return { ...order, shopData: shopResponse.data };
            } catch (error) {
              console.error('❌ Error fetching shop data for order:', error);
              return order;
            }
          })
        );
        setOrders(ordersWithShopData);
      }
    } catch (error) {
      // Handle 404 or no orders case silently
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('ℹ️ No incoming orders available');
        setOrders([]);
      } else {
        console.error('❌ Error fetching incoming orders:', error);
        if (axios.isAxiosError(error)) {
          console.log('Error response:', error.response?.data);
          console.log('Error status:', error.response?.status);
          Alert.alert('Error', `Failed to fetch orders. Please try again.`);
        }
      }
    }
  };

  const handleAcceptOrder = async (orderId: string, paymentMethod: string) => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token || !userId) return;

      // Get order details first
      const orderResponse = await axios.get(`${API_URL}/api/orders/${orderId}`, {
        headers: { 'Authorization': token }
      });

      // Assign dasher to the order
      const assignRes = await axios.post(`${API_URL}/api/orders/assign-dasher`,
          { orderId, dasherId: userId },
          { headers: { 'Authorization': token } }
      );

      if (assignRes.data.success) {
        // Update order status
        let newStatus = 'active_toShop';
        if (paymentMethod === 'gcash') {
          newStatus = 'active_waiting_for_shop';
        }

        await axios.post(`${API_URL}/api/orders/update-order-status`,
            { orderId, status: newStatus },
            { headers: { 'Authorization': token } }
        );

        // Update dasher status to ongoing order
        await axios.put(`${API_URL}/api/dashers/update/${userId}/status`, null, {
          headers: { 'Authorization': token },
          params: { status: 'ongoing order' }
        });

        setAlert('Order accepted! 🎉');
        
        // Refresh orders list to remove accepted order
        await fetchIncomingOrders();
        
        // Navigate to dasher orders page
        setTimeout(() => {
          router.push('/dasher/orders');
        }, 1500);
      } else {
        setAlert('Failed to accept order: ' + assignRes.data.message);
      }
    } catch (error) {
      setAlert('An error occurred while accepting the order.');
      console.error('❌ Error accepting order:', error);
    }
  };

  return (
      <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
        <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <StyledView className="flex-1 px-5 pt-12 pb-24">
            {/* Enhanced Header */}
            <StyledView className="mb-8">
              <StyledView 
                  className="bg-gradient-to-r from-[#BC4A4D] to-[#A03D40] rounded-2xl p-6 items-center"
                  style={{
                    shadowColor: "#BC4A4D",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                    backgroundColor: '#BC4A4D',
                  }}
              >
                <StyledView className="flex-row items-center mb-2">
                  <StyledView className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3">
                    <StyledText className="text-xl">📦</StyledText>
                  </StyledView>
                  <StyledText className="text-2xl font-bold text-white">Incoming Orders</StyledText>
                </StyledView>
                <StyledText className="text-white/80 text-sm text-center">
                  {isDelivering ? 'New orders waiting for pickup' : 'Go online to receive orders'}
                </StyledText>
                
                {/* Status indicator */}
                <StyledView className="flex-row items-center mt-3 bg-white/20 px-3 py-1 rounded-full">
                  <StyledView className={`w-2 h-2 rounded-full mr-2 ${
                    isDelivering && isWebSocketConnected ? 'bg-emerald-400' : 
                    isDelivering ? 'bg-amber-400' : 'bg-gray-300'
                  }`} />
                  <StyledText className="text-white/90 text-xs font-medium">
                    {isDelivering && isWebSocketConnected ? 'Online - Real-time Updates' :
                     isDelivering ? 'Active - Connecting...' : 'Inactive'}
                  </StyledText>
                </StyledView>
              </StyledView>
            </StyledView>

            {alert && (
                <StyledView 
                    className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl mb-6 flex-row items-center"
                    style={{
                      shadowColor: "#10b981",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                >
                  <StyledView className="w-8 h-8 bg-emerald-500 rounded-full items-center justify-center mr-3">
                    <StyledText className="text-white text-lg">✓</StyledText>
                  </StyledView>
                  <StyledText className="text-[#8B4513] font-semibold flex-1">{alert}</StyledText>
                </StyledView>
            )}

            {!isDelivering && !loading && (
                <StyledView className="bg-white rounded-2xl p-8 items-center justify-center my-4"
                            style={{
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 3 },
                              shadowOpacity: 0.08,
                              shadowRadius: 10,
                              elevation: 4,
                            }}
                >
                  <StyledView className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                    <StyledText className="text-4xl">😴</StyledText>
                  </StyledView>
                  <StyledText className="text-lg font-bold text-[#8B4513] text-center mb-2">
                    You're Currently Offline
                  </StyledText>
                  <StyledText className="text-base text-[#8B4513]/70 text-center mb-4">
                    Turn on your active status to start receiving incoming orders and earn money!
                  </StyledText>
                  <StyledView className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <StyledText className="text-[#BC4A4D] text-sm text-center">
                      💡 Tip: Go to your dashboard to activate delivery mode
                    </StyledText>
                  </StyledView>
                </StyledView>
            )}

            {isDelivering && loading ? (
                <StyledView className="flex-1 justify-center items-center mt-10">
                  <StyledView className="items-center">
                    {/* Spinning Logo Container */}
                    <StyledView className="relative mb-6">
                      {/* Outer rotating circle */}
                      <Animated.View
                        style={{
                          transform: [{ rotate: circleRotation }],
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          borderWidth: 2,
                          borderColor: 'rgba(188, 74, 77, 0.2)',
                          borderTopColor: '#BC4A4D',
                          position: 'absolute',
                        }}
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
                            style={{ resizeMode: 'contain' }}
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
                    <StyledText className="text-[#BC4A4D] text-base font-semibold">
                      Loading...
                    </StyledText>
                  </StyledView>
                </StyledView>
            ) : isDelivering && orders.length === 0 ? (
                <StyledView className="bg-white rounded-2xl p-8 items-center justify-center my-4"
                            style={{
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 3 },
                              shadowOpacity: 0.08,
                              shadowRadius: 10,
                              elevation: 4,
                            }}
                >
                  <StyledView className="w-20 h-20 bg-blue-100 rounded-full items-center justify-center mb-4">
                    <StyledText className="text-4xl">🔍</StyledText>
                  </StyledView>
                  <StyledText className="text-lg font-bold text-[#8B4513] text-center mb-2">
                    All Caught Up!
                  </StyledText>
                  <StyledText className="text-base text-[#8B4513]/70 text-center mb-4">
                    No new orders at the moment. We'll notify you when new orders arrive.
                  </StyledText>
                  <StyledView className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <StyledText className="text-[#BC4A4D] text-sm text-center">
                      🎯 Stay active - orders are coming your way!
                    </StyledText>
                  </StyledView>
                </StyledView>
            ) : isDelivering && orders.map((order) => (
                <StyledView key={order.id} className="bg-white rounded-2xl mb-6 overflow-hidden"
                            style={{
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.12,
                              shadowRadius: 12,
                              elevation: 6,
                            }}
                >
                  {/* Order Header with gradient */}
                  <StyledView 
                      className="bg-gradient-to-r from-[#BC4A4D] to-[#A03D40] p-4"
                      style={{ backgroundColor: '#BC4A4D' }}
                  >
                    <StyledView className="flex-row items-center justify-between">
                      <StyledView className="flex-row items-center">
                        <StyledView className="w-12 h-12 bg-white/20 rounded-full items-center justify-center mr-3">
                          <StyledText className="text-xl">🏪</StyledText>
                        </StyledView>
                        <StyledView>
                          <StyledText className="text-white font-bold text-lg">{order.shopData?.name || 'Shop'}</StyledText>
                          <StyledText className="text-white/80 text-sm">Order #{order.id.slice(-6)}</StyledText>
                        </StyledView>
                      </StyledView>
                      <StyledView className={`px-3 py-1 rounded-full ${order.paymentMethod === 'gcash' ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                        <StyledText className="text-white text-xs font-semibold">
                          {order.paymentMethod === 'gcash' ? '💳 Online' : '💰 Cash'}
                        </StyledText>
                      </StyledView>
                    </StyledView>
                  </StyledView>

                  <StyledView className="p-4">
                    {/* Customer Info Card */}
                    <StyledView className="bg-gray-50 rounded-xl p-4 mb-4">
                      <StyledView className="flex-row items-center mb-2">
                        <StyledView className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                          <StyledText className="text-lg">👤</StyledText>
                        </StyledView>
                        <StyledView>
                          <StyledText className="text-[#8B4513] font-semibold text-base">{order.firstname} {order.lastname}</StyledText>
                          <StyledText className="text-[#8B4513]/70 text-sm">📱 {order.mobileNum}</StyledText>
                        </StyledView>
                      </StyledView>
                      <StyledView className="flex-row items-center mt-2">
                        <StyledText className="text-[#8B4513]/60 text-sm mr-2">📍</StyledText>
                        <StyledText className="text-[#8B4513] text-sm flex-1">{order.deliverTo}</StyledText>
                      </StyledView>
                      {order.changeFor && (
                          <StyledView className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                            <StyledText className="text-[#BC4A4D] text-sm font-medium">
                              💵 Change for: ₱{order.changeFor}
                            </StyledText>
                          </StyledView>
                      )}
                    </StyledView>

                    {/* Accept Button */}
                    <StyledTouchableOpacity
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 py-4 rounded-2xl items-center flex-row justify-center"
                        onPress={() => handleAcceptOrder(order.id, order.paymentMethod)}
                        style={{
                          shadowColor: "#10b981",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 6,
                          backgroundColor: '#10b981',
                        }}
                    >
                      <StyledView className="w-6 h-6 bg-white/20 rounded-full items-center justify-center mr-3">
                        <StyledText className="text-white text-sm">✓</StyledText>
                      </StyledView>
                      <StyledText className="text-white font-bold text-lg">Accept Order</StyledText>
                    </StyledTouchableOpacity>
                  </StyledView>

                  {/* Order Summary Section */}
                  <StyledView className="bg-gradient-to-br from-gray-50 to-gray-100 p-5">
                    <StyledView className="flex-row items-center mb-4">
                      <StyledView className="w-8 h-8 bg-[#BC4A4D] rounded-lg items-center justify-center mr-3">
                        <StyledText className="text-white text-sm font-bold">📝</StyledText>
                      </StyledView>
                      <StyledText className="text-lg font-bold text-[#BC4A4D]">Order Summary</StyledText>
                    </StyledView>
                    
                    {/* Items List */}
                    <StyledView className="bg-white rounded-xl p-4 mb-4">
                      {order.items.map((item, idx) => (
                          <StyledView key={idx} className="flex-row justify-between items-center py-2">
                            <StyledView className="flex-row items-center flex-1">
                              <StyledView className="w-8 h-8 bg-[#BC4A4D]/10 rounded-full items-center justify-center mr-3">
                                <StyledText className="text-sm font-bold text-[#BC4A4D]">{item.quantity}</StyledText>
                              </StyledView>
                              <StyledText className="text-sm text-[#8B4513] flex-1 font-medium">{item.name}</StyledText>
                            </StyledView>
                            <StyledText className="text-sm font-bold text-[#8B4513]">₱{item.price.toFixed(2)}</StyledText>
                          </StyledView>
                      ))}
                    </StyledView>

                    {/* Pricing Breakdown */}
                    <StyledView className="bg-white rounded-xl p-4">
                      <StyledView className="flex-row justify-between py-2">
                        <StyledText className="text-base text-[#8B4513]/70">Subtotal</StyledText>
                        <StyledText className="text-base font-medium text-[#8B4513]">₱{order.totalPrice.toFixed(2)}</StyledText>
                      </StyledView>
                      <StyledView className="flex-row justify-between py-2">
                        <StyledText className="text-base text-[#8B4513]/70">Delivery Fee</StyledText>
                        <StyledText className="text-base font-medium text-[#8B4513]">₱{order.shopData?.deliveryFee?.toFixed(2) || '0.00'}</StyledText>
                      </StyledView>
                      <StyledView className="h-px bg-gray-200 my-2" />
                      <StyledView className="flex-row justify-between py-2">
                        <StyledText className="text-lg font-bold text-[#BC4A4D]">Total Amount</StyledText>
                        <StyledText className="text-lg font-bold text-[#BC4A4D]">
                          ₱{order.totalPrice && order.shopData ? (order.totalPrice + order.shopData.deliveryFee).toFixed(2) : '0.00'}
                        </StyledText>
                      </StyledView>
                    </StyledView>
                  </StyledView>
                </StyledView>
            ))}
          </StyledView>
        </StyledScrollView>
        <BottomNavigation activeTab="Incoming" />
      </StyledSafeAreaView>
  );
}