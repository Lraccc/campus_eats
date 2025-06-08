import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Modal
} from 'react-native';
import { styled } from 'nativewind';
import { router } from 'expo-router';
import { useAuthentication, clearStoredAuthState } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import axios from 'axios';
import { API_URL } from '../../config';
import { MaterialIcons } from '@expo/vector-icons';
import BottomNavigation from '../../components/BottomNavigation';
import LiveStreamBroadcaster from '../../components/LiveStreamBroadcaster';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);

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

export default function IncomingOrders() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ongoingOrders, setOngoingOrders] = useState<Order[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  const { signOut, getAccessToken } = useAuthentication();
  const [isStreaming, setIsStreaming] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    // Create a custom error handler for Axios
    const axiosErrorHandler = axios.interceptors.response.use(
        response => response,
        error => {
          // Completely suppress errors (especially 404s) without logging
          // Only log non-404 errors if needed for debugging
          if (error.response && error.response.status !== 404) {
            // Optionally log non-404 errors
            // console.error('API Error:', error);
          }
          // Return a resolved promise to prevent error from bubbling up
          return Promise.resolve({ data: [] });
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
      const storedShopId = await AsyncStorage.getItem('userId');
      setShopId(storedShopId);
    };
    fetchShopId();
  }, []);

  const fetchAllOrders = async () => {
    try {
      await Promise.all([
        fetchOrders(),
        fetchOngoingOrders(),
        fetchPastOrders()
      ]);
    } catch (error) {
      // Completely suppress errors without logging them
      // No console.error here to avoid any error messages
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOrders = async () => {
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
      const userId = await AsyncStorage.getItem('userId');

      const response = await axios.get(`${API_URL}/api/orders/active-waiting-for-shop`, config);

      const ordersWithShopData = await Promise.all(response.data.map(async (order: any) => {
        const shopDataResponse = await axios.get(`${API_URL}/api/shops/${order.shopId}`, config);
        return { ...order, shopData: shopDataResponse.data };
      }));

      // Filter orders for the current shop
      const filteredOrders = ordersWithShopData.filter((order: Order) => order.shopId === userId);
      setOrders(filteredOrders);
    } catch (error) {
      // Suppress error without logging
    }
  };

  const fetchOngoingOrders = async () => {
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
      const userId = await AsyncStorage.getItem('userId');

      const response = await axios.get(`${API_URL}/api/orders/ongoing-orders`, config);

      const ordersWithShopData = await Promise.all(response.data.map(async (order: any) => {
        const shopDataResponse = await axios.get(`${API_URL}/api/shops/${order.shopId}`, config);
        return { ...order, shopData: shopDataResponse.data };
      }));

      // Filter orders for the current shop
      const filteredOrders = ordersWithShopData.filter((order: Order) => order.shopId === userId);
      setOngoingOrders(filteredOrders);
    } catch (error) {
      // Suppress error without logging
    }
  };

  const fetchPastOrders = async () => {
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
      const userId = await AsyncStorage.getItem('userId');

      const response = await axios.get(`${API_URL}/api/orders/past-orders`, config);

      const ordersWithShopData = await Promise.all(response.data.map(async (order: any) => {
        const shopDataResponse = await axios.get(`${API_URL}/api/shops/${order.shopId}`, config);
        return { ...order, shopData: shopDataResponse.data };
      }));

      // Filter orders for the current shop
      const filteredOrders = ordersWithShopData.filter((order: Order) => order.shopId === userId);
      setPastOrders(filteredOrders);
    } catch (error) {
      // Suppress error without logging
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

  const handleAcceptOrder = async (orderId: string) => {
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
          { orderId, status: 'active_shop_confirmed' },
          config
      );

      Alert.alert('Success', 'Order accepted successfully');
      fetchAllOrders();
    } catch (error) {
      // Suppress error without logging
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

      Alert.alert('Success', 'Order declined successfully');
      setDeclineModalVisible(false);
      setSelectedOrder(null);
      fetchAllOrders();
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
        <StyledView key={index} className="flex-row justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
          <StyledView className="flex-row items-center flex-1">
            <StyledView className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-3">
              <StyledText className="text-sm font-semibold text-gray-600">{item.quantity}</StyledText>
            </StyledView>
            <StyledText className="text-sm text-gray-800 flex-1">{item.name}</StyledText>
          </StyledView>
          <StyledText className="text-sm font-semibold text-gray-900">₱{item.price.toFixed(2)}</StyledText>
        </StyledView>
    ));
  };

  const renderOrderCard = (order: Order, isOngoing: boolean = false) => {
    const isExpanded = expandedOrderIds[order.id] || false;

    return (
        <StyledView key={order.id} className="bg-white rounded-2xl mb-4 shadow-sm border border-gray-100">
          <StyledTouchableOpacity
              className="p-4"
              onPress={() => toggleOrderExpansion(order.id)}
          >
            <StyledView className="flex-row items-center">
              <StyledView className="w-12 h-12 rounded-full overflow-hidden mr-3 bg-gray-100">
                <StyledImage
                    source={{ uri: order.shopData?.imageUrl || 'https://via.placeholder.com/150' }}
                    className="w-full h-full"
                    resizeMode="cover"
                />
              </StyledView>
              <StyledView className="flex-1">
                <StyledText className="text-base font-semibold text-gray-900">
                  {order.firstname} {order.lastname}
                </StyledText>
                <StyledText className="text-sm text-gray-500 mt-1">
                  Order #{order.id.slice(-6)}
                </StyledText>
                <StyledView className="flex-row items-center mt-1">
                  <StyledView className={`px-2 py-1 rounded-full ${order.paymentMethod === 'gcash' ? 'bg-blue-100' : 'bg-green-100'}`}>
                    <StyledText className={`text-xs font-medium ${order.paymentMethod === 'gcash' ? 'text-blue-700' : 'text-green-700'}`}>
                      {order.paymentMethod === 'gcash' ? 'Online Payment' : 'Cash on Delivery'}
                    </StyledText>
                  </StyledView>
                </StyledView>
              </StyledView>
              <MaterialIcons
                  name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                  size={24}
                  color="#9CA3AF"
              />
            </StyledView>

            {!isOngoing && (
                <StyledView className="flex-row items-center gap-3 mt-4">
                  <StyledTouchableOpacity
                      className="flex-1 bg-red-50 border border-red-200 py-3 rounded-xl items-center"
                      onPress={() => handleDeclineOrder(order)}
                  >
                    <StyledText className="text-red-600 text-sm font-semibold">
                      {order.paymentMethod === 'gcash' ? 'Decline & Refund' : 'Decline'}
                    </StyledText>
                  </StyledTouchableOpacity>
                  <StyledTouchableOpacity
                      className="flex-1 py-3 rounded-xl items-center"
                      style={{ backgroundColor: '#BC4A4D' }}
                      onPress={() => handleAcceptOrder(order.id)}
                  >
                    <StyledText className="text-white text-sm font-semibold">Accept Order</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>
            )}
          </StyledTouchableOpacity>

          {isExpanded && (
              <StyledView className="px-4 pb-4 border-t border-gray-100">
                <StyledText className="text-base font-semibold mb-3 text-gray-900">Order Details</StyledText>
                <StyledView className="bg-gray-50 rounded-xl p-3 mb-4">
                  {renderOrderItems(order.items)}
                </StyledView>
                <StyledView className="bg-gray-50 rounded-xl p-3">
                  <StyledView className="flex-row justify-between items-center py-2">
                    <StyledText className="text-sm text-gray-600">Subtotal</StyledText>
                    <StyledText className="text-sm font-medium text-gray-900">₱{order.totalPrice.toFixed(2)}</StyledText>
                  </StyledView>
                  <StyledView className="flex-row justify-between items-center py-2">
                    <StyledText className="text-sm text-gray-600">Delivery Fee</StyledText>
                    <StyledText className="text-sm font-medium text-gray-900">
                      ₱{order.shopData?.deliveryFee?.toFixed(2) || '0.00'}
                    </StyledText>
                  </StyledView>
                  <StyledView className="flex-row justify-between items-center py-2 border-t border-gray-200 mt-2">
                    <StyledText className="text-base font-semibold text-gray-900">Total</StyledText>
                    <StyledText className="text-lg font-bold" style={{ color: '#BC4A4D' }}>
                      ₱{(order.totalPrice + (order.shopData?.deliveryFee || 0)).toFixed(2)}
                    </StyledText>
                  </StyledView>
                </StyledView>
              </StyledView>
          )}
        </StyledView>
    );
  };

  const startStream = () => {
    setIsStreaming(true);
  };

  const endStream = () => {
    setIsStreaming(false);
  };

  if (isLoading) {
    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
          <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
          <StyledView className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#BC4A4D" />
            <StyledText className="mt-4 text-base text-gray-600 font-medium">Loading orders...</StyledText>
          </StyledView>
          <BottomNavigation activeTab="Home" />
        </SafeAreaView>
    );
  }

  return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />

        {isStreaming ? (
            <LiveStreamBroadcaster shopId={shopId || ''} onEndStream={endStream} />
        ) : (
            <>
              {/* Header */}
              <StyledView className="px-5 py-4" style={{ backgroundColor: '#DFD6C5' }}>
                <StyledView className="flex-row justify-between items-center">
                  <StyledView>
                    <StyledText className="text-2xl font-bold text-gray-900">Orders</StyledText>
                    <StyledText className="text-sm text-gray-600 mt-1">Manage your incoming orders</StyledText>
                  </StyledView>
                  <StyledTouchableOpacity
                      className="flex-row items-center px-4 py-3 rounded-2xl shadow-sm"
                      style={{ backgroundColor: '#BC4A4D' }}
                      onPress={startStream}
                  >
                    <MaterialIcons name="live-tv" size={20} color="white" />
                    <StyledText className="text-white ml-2 font-semibold text-sm">Go Live</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>
              </StyledView>

              <StyledScrollView
                  className="flex-1 px-5"
                  style={{ backgroundColor: '#DFD6C5' }}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                  }
                  showsVerticalScrollIndicator={false}
              >
                {/* Pending Approval Section */}
                <StyledView className="mb-6">
                  <StyledText className="text-lg font-bold mb-4 text-gray-900">Pending Approval</StyledText>
                  {orders.length === 0 ? (
                      <StyledView className="bg-white rounded-2xl p-6 items-center border border-gray-100">
                        <StyledView className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-3">
                          <MaterialIcons name="pending-actions" size={32} color="#9CA3AF" />
                        </StyledView>
                        <StyledText className="text-base font-medium text-gray-900 mb-1">No pending orders</StyledText>
                        <StyledText className="text-sm text-gray-500 text-center">New orders will appear here for approval</StyledText>
                      </StyledView>
                  ) : (
                      orders.map(order => renderOrderCard(order))
                  )}
                </StyledView>

                {/* Active Orders Section */}
                <StyledView className="mb-6">
                  <StyledText className="text-lg font-bold mb-4 text-gray-900">Active Orders</StyledText>
                  {ongoingOrders.length === 0 ? (
                      <StyledView className="bg-white rounded-2xl p-6 items-center border border-gray-100">
                        <StyledView className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-3">
                          <MaterialIcons name="local-shipping" size={32} color="#9CA3AF" />
                        </StyledView>
                        <StyledText className="text-base font-medium text-gray-900 mb-1">No active orders</StyledText>
                        <StyledText className="text-sm text-gray-500 text-center">Accepted orders will appear here</StyledText>
                      </StyledView>
                  ) : (
                      ongoingOrders.map(order => renderOrderCard(order, true))
                  )}
                </StyledView>

                {/* Order History Section */}
                <StyledView className="mb-6">
                  <StyledText className="text-lg font-bold mb-4 text-gray-900">Orders Complete</StyledText>
                  {pastOrders.length === 0 ? (
                      <StyledView className="bg-white rounded-2xl p-6 items-center border border-gray-100">
                        <StyledView className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-3">
                          <MaterialIcons name="history" size={32} color="#9CA3AF" />
                        </StyledView>
                        <StyledText className="text-base font-medium text-gray-900 mb-1">No order history</StyledText>
                        <StyledText className="text-sm text-gray-500 text-center">Completed orders will appear here</StyledText>
                      </StyledView>
                  ) : (
                      pastOrders.map(order => (
                          <StyledView key={order.id} className="bg-white rounded-2xl mb-4 p-4 border border-gray-100">
                            <StyledView className="flex-row items-center">
                              <StyledView className="w-12 h-12 rounded-full overflow-hidden mr-3 bg-gray-100">
                                <StyledImage
                                    source={{ uri: order.shopData?.imageUrl || 'https://via.placeholder.com/150' }}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                />
                              </StyledView>
                              <StyledView className="flex-1">
                                <StyledText className="text-base font-semibold text-gray-900">
                                  {order.firstname} {order.lastname}
                                </StyledText>
                                <StyledText className="text-sm text-gray-500 mt-1">
                                  Order #{order.id.slice(-6)}
                                </StyledText>
                                <StyledView className="flex-row items-center mt-1">
                                  <StyledView className="px-2 py-1 rounded-full bg-green-100">
                                    <StyledText className="text-xs font-medium text-green-700">Completed</StyledText>
                                  </StyledView>
                                </StyledView>
                              </StyledView>
                              <StyledText className="text-base font-bold" style={{ color: '#BC4A4D' }}>
                                ₱{(order.totalPrice + (order.shopData?.deliveryFee || 0)).toFixed(2)}
                              </StyledText>
                            </StyledView>
                          </StyledView>
                      ))
                  )}
                </StyledView>
              </StyledScrollView>
            </>
        )}

        {/* Decline Order Confirmation Modal */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={declineModalVisible}
            onRequestClose={() => setDeclineModalVisible(false)}
        >
          <StyledView className="flex-1 bg-black/50 justify-center items-center px-6">
            <StyledView className="bg-white rounded-3xl p-6 w-full max-w-sm">
              <StyledView className="items-center mb-4">
                <StyledView className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-3">
                  <MaterialIcons name="cancel" size={32} color="#EF4444" />
                </StyledView>
                <StyledText className="text-xl font-bold text-gray-900 mb-2">Decline Order</StyledText>
                <StyledText className="text-sm text-gray-600 text-center leading-relaxed">
                  Are you sure you want to decline this order?
                  {selectedOrder?.paymentMethod === 'gcash' ?
                      ' This will process a refund to the customer.' :
                      ''}
                </StyledText>
              </StyledView>
              <StyledView className="flex-row space-x-3">
                <StyledTouchableOpacity
                    className="flex-1 bg-gray-100 py-3 rounded-xl items-center"
                    onPress={() => {
                      setDeclineModalVisible(false);
                      setSelectedOrder(null);
                    }}
                >
                  <StyledText className="text-gray-700 font-semibold">Cancel</StyledText>
                </StyledTouchableOpacity>
                <StyledTouchableOpacity
                    className="flex-1 bg-red-500 py-3 rounded-xl items-center"
                    onPress={confirmDeclineOrder}
                >
                  <StyledText className="text-white font-semibold">Decline</StyledText>
                </StyledTouchableOpacity>
              </StyledView>
            </StyledView>
          </StyledView>
        </Modal>

        <BottomNavigation activeTab="Home" />
      </SafeAreaView>
  );
}