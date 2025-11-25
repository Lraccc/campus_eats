import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  StatusBar,
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
  dasherId?: string | null;
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

  // WebSocket refs
  const stompClientRef = useRef<Client | null>(null);
  const isConnectedRef = useRef<boolean>(false);
  const isMountedRef = useRef(true);
  const connectionRetryCount = useRef<number>(0);
  const maxRetries = 3;

  useEffect(() => {
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
    const fetchData = async () => {
      if (!userId) return;

      try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (!token) return;

        const statusResponse = await axios.get(`${API_URL}/api/dashers/${userId}`, {
          headers: { 'Authorization': token }
        });
        const currentStatus = statusResponse.data.status;
        setIsDelivering(currentStatus === 'active');

        if (currentStatus === 'active') {
          setLoading(true);
          try {
            await fetchIncomingOrders();
            connectWebSocket(userId);
          } catch (error) {
            console.error('❌ Error during initial data fetch:', error);
          }
        } else {
          setOrders([]);
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

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      disconnectWebSocket();
    };
  }, []);

  const connectWebSocket = async (dasherId: string) => {
    if (isConnectedRef.current || stompClientRef.current) return;

    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) return;

      const wsUrl = API_URL + '/ws';
      const socket = new SockJS(wsUrl);

      const client = new Client({
        webSocketFactory: () => socket,
        connectHeaders: { 'Authorization': token },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          isConnectedRef.current = true;
          setIsWebSocketConnected(true);
          connectionRetryCount.current = 0;

          try {
            client.subscribe(`/topic/dashers/new-orders`, (message) => {
              if (!isMountedRef.current) return;
              try {
                const newOrderData = JSON.parse(message.body);
                handleNewOrderNotification(newOrderData);
              } catch (error) {
                console.error('❌ Error parsing new order message:', error);
              }
            });
          } catch (subscriptionError) {
            console.error('❌ Error subscribing to dasher topics:', subscriptionError);
          }
        },
        onDisconnect: () => {
          isConnectedRef.current = false;
          setIsWebSocketConnected(false);
        },
        onStompError: (frame) => {
          console.error('❌ STOMP error for dasher:', frame.headers?.['message'] || 'Unknown error');
          isConnectedRef.current = false;
          setIsWebSocketConnected(false);

          if (connectionRetryCount.current < maxRetries) {
            connectionRetryCount.current++;
            const retryDelay = Math.pow(2, connectionRetryCount.current) * 1000;
            setTimeout(() => {
              if (isMountedRef.current && isDelivering && userId) connectWebSocket(userId);
            }, retryDelay);
          } else {
            console.error('❌ Max dasher WebSocket retry attempts reached');
          }
        },
        onWebSocketClose: () => {
          isConnectedRef.current = false;
          setIsWebSocketConnected(false);
        },
        onWebSocketError: (evt) => {
          console.error('❌ Dasher WebSocket error:', evt);
          isConnectedRef.current = false;
          setIsWebSocketConnected(false);
        }
      });

      stompClientRef.current = client;
      try { client.activate(); } catch (e) { console.error('Failed to activate STOMP client', e); }
    } catch (error) {
      console.error('❌ Error setting up WebSocket:', error);
    }
  };

  const disconnectWebSocket = () => {
    if (stompClientRef.current) {
      try { stompClientRef.current.deactivate(); } catch (e) { /* ignore */ }
      stompClientRef.current = null;
    }
    isConnectedRef.current = false;
    setIsWebSocketConnected(false);
    connectionRetryCount.current = 0;
  };

  const handleNewOrderNotification = async (orderData: any) => {
    try {
      setAlert('New order available! 🎉');
      await fetchIncomingOrders();
      setTimeout(() => setAlert(null), 5000);
    } catch (error) {
      console.error('❌ Error handling new order notification:', error);
    }
  };

  const fetchIncomingOrders = async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) return;

      const ordersResponse = await axios.get(`${API_URL}/api/orders/incoming-orders/dasher`, {
        headers: { 'Authorization': token }
      });

      if (ordersResponse.data) {
        const unassignedOrders = ordersResponse.data.filter((order: any) => !order.dasherId || order.dasherId === null || order.dasherId === '');
        const ordersWithShopData = await Promise.all(unassignedOrders.map(async (order: Order) => {
          try {
            const shopResponse = await axios.get(`${API_URL}/api/shops/${order.shopId}`, { headers: { 'Authorization': token } });
            return { ...order, shopData: shopResponse.data };
          } catch (error) {
            return order;
          }
        }));
        setOrders(ordersWithShopData);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setOrders([]);
      } else {
        console.error('❌ Error fetching incoming orders:', error);
        if (axios.isAxiosError(error)) Alert.alert('Error', `Failed to fetch orders. Please try again.`);
      }
    }
  };

  const handleAcceptOrder = async (orderId: string, paymentMethod: string) => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token || !userId) return;

      const assignRes = await axios.post(`${API_URL}/api/orders/assign-dasher`, { orderId, dasherId: userId }, { headers: { 'Authorization': token } });
      if (assignRes.data.success) {
        await axios.put(`${API_URL}/api/dashers/update/${userId}/status`, null, { headers: { 'Authorization': token }, params: { status: 'ongoing order' } });
        setAlert('Order accepted! 🎉');
        await fetchIncomingOrders();
        setTimeout(() => router.push('/dasher/orders'), 1200);
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
          {/* Header (simplified) */}
          <StyledView className="mb-6">
            <StyledView className="bg-[#BC4A4D] rounded-2xl p-4">
              <StyledView className="flex-row items-center">
                <StyledView className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3">
                  <StyledText className="text-xl">📦</StyledText>
                </StyledView>
                <StyledView>
                  <StyledText className="text-white text-lg font-bold">Incoming Orders</StyledText>
                  <StyledText className="text-white/80 text-sm">{isDelivering ? (isWebSocketConnected ? 'Online' : 'Active - Connecting...') : 'Offline'}</StyledText>
                </StyledView>
              </StyledView>
            </StyledView>
          </StyledView>

          {alert && (
            <StyledView className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg mb-4">
              <StyledText className="text-[#8B4513] font-semibold">{alert}</StyledText>
            </StyledView>
          )}

          {!isDelivering && !loading && (
            <StyledView className="bg-white rounded-2xl p-6 items-center my-4">
              <StyledText className="text-lg font-bold text-[#8B4513] mb-1">You're Offline</StyledText>
              <StyledText className="text-sm text-[#8B4513]/70 text-center">Turn on active status to receive orders.</StyledText>
            </StyledView>
          )}

          {isDelivering && loading ? (
            <StyledView className="items-center mt-8">
              <StyledText className="text-lg font-bold text-[#BC4A4D] mb-2">Loading...</StyledText>
            </StyledView>
          ) : isDelivering && orders.length === 0 ? (
            <StyledView className="bg-white rounded-2xl p-6 items-center my-4">
              <StyledText className="text-lg font-bold text-[#8B4513] mb-1">All Caught Up</StyledText>
              <StyledText className="text-sm text-[#8B4513]/70">No new orders right now. Stay online to receive orders.</StyledText>
            </StyledView>
          ) : (
            <>
              {orders.map((order) => (
                <StyledView key={order.id} className="bg-white rounded-2xl mb-4 p-4">
                  <StyledView className="flex-row items-center justify-between mb-2">
                    <StyledView>
                      <StyledText className="text-[#BC4A4D] font-bold">{order.shopData?.name || 'Shop'}</StyledText>
                      <StyledText className="text-sm text-[#8B4513]/70">Order #{order.id.slice(-6)}</StyledText>
                    </StyledView>
                    <StyledText className="text-sm">{order.paymentMethod && order.paymentMethod.toLowerCase() === 'gcash' ? 'Online' : 'Cash'}</StyledText>
                  </StyledView>

                  <StyledView className="mb-3">
                    <StyledText className="text-sm text-[#8B4513] font-medium">{order.firstname} {order.lastname}</StyledText>
                    <StyledText className="text-xs text-[#8B4513]/70">{order.deliverTo}</StyledText>
                  </StyledView>

                  {/* Items preview: show qty x name and per-item subtotal so dasher can ready items */}
                  <StyledView className="mb-2">
                    {order.items && order.items.length > 0 ? (
                      <>
                        {order.items.slice(0, 4).map((it, idx) => (
                          <StyledView key={idx} className="flex-row justify-between items-center">
                            <StyledText className="text-sm text-[#8B4513]">{it.quantity} x {it.name}</StyledText>
                            <StyledText className="text-sm text-[#8B4513]/70">₱{it.price.toFixed(2)}</StyledText>
                          </StyledView>
                        ))}
                        {order.items.length > 4 && (
                          <StyledText className="text-xs text-[#8B4513]/70">+{order.items.length - 4} more items</StyledText>
                        )}
                      </>
                    ) : (
                      <StyledText className="text-sm text-[#8B4513]/70">No items listed</StyledText>
                    )}
                  </StyledView>

                  <StyledView className="flex-row items-center justify-between">
                    <StyledText className="text-base font-bold text-[#8B4513]">Total</StyledText>
                    <StyledText className="text-base font-bold text-[#BC4A4D]">₱{(order.totalPrice + (order.shopData?.deliveryFee || 0)).toFixed(2)}</StyledText>
                  </StyledView>

                  {/* Show change amount if customer provided a change amount (so dasher prepares exact change) */}
                  {order.changeFor !== undefined && order.changeFor !== null && (
                    <StyledText className="text-sm text-[#8B4513]/70 mt-1">Change for ₱{Number(order.changeFor).toFixed(2)}</StyledText>
                  )}

                  <StyledTouchableOpacity className="mt-3 bg-emerald-500 py-3 rounded-2xl items-center" onPress={() => handleAcceptOrder(order.id, order.paymentMethod)}>
                    <StyledText className="text-white font-bold">Accept Order</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>
              ))}
            </>
          )}
        </StyledView>
      </StyledScrollView>
      <BottomNavigation activeTab="Incoming" />
    </StyledSafeAreaView>
  );
}