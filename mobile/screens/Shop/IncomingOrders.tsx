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
import { router } from 'expo-router';
import { useAuthentication, clearStoredAuthState } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import axios from 'axios';
import { API_URL } from '../../config';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../../components/BottomNavigation';
import LiveStreamBroadcaster from '../../components/LiveStreamBroadcaster';

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
        <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ fontSize: 14, color: '#666', marginRight: 8, width: 24, textAlign: 'center' }}>{item.quantity}x</Text>
            <Text style={{ fontSize: 14, color: '#333', flex: 1 }}>{item.name}</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}>₱{item.price.toFixed(2)}</Text>
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
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2
        }}>
          <TouchableOpacity
              style={{ padding: 16 }}
              onPress={() => toggleOrderExpansion(order.id)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: '#F0EBE4',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12
              }}>
                <Ionicons name="person" size={24} color="#BC4A4D" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2 }}>
                  {order.firstname} {order.lastname}
                </Text>
                <Text style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>
                  Order #{order.id.substring(0, 8)}...
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                      name={order.paymentMethod === 'gcash' ? "card" : "cash"}
                      size={14}
                      color="#BC4A4D"
                      style={{ marginRight: 4 }}
                  />
                  <Text style={{ fontSize: 13, color: '#666' }}>{paymentMethod}</Text>
                </View>
              </View>

              {!isOngoing && (
                  <View style={{ flexDirection: 'row', marginRight: 8 }}>
                    <TouchableOpacity
                        style={{
                          backgroundColor: '#F44336',
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          marginRight: 8
                        }}
                        onPress={() => handleDeclineOrder(order)}
                    >
                      <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
                        {order.paymentMethod === 'gcash' ? 'Decline' : 'Decline'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{
                          backgroundColor: '#BC4A4D',
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 8
                        }}
                        onPress={() => handleAcceptOrder(order.id)}
                    >
                      <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Accept</Text>
                    </TouchableOpacity>
                  </View>
              )}

              <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#666"
              />
            </View>
          </TouchableOpacity>

          {isExpanded && (
              <View style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: '#F0EBE4'
              }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 }}>Order Summary</Text>
                {renderOrderItems(order.items)}

                <View style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: '#F0EBE4'
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, color: '#666' }}>Subtotal</Text>
                    <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>₱{order.totalPrice.toFixed(2)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, color: '#666' }}>Delivery Fee</Text>
                    <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>
                      ₱{order.shopData?.deliveryFee.toFixed(2) || '0.00'}
                    </Text>
                  </View>

                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 8,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: '#F0EBE4'
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Total</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#BC4A4D' }}>
                      ₱{(order.totalPrice + (order.shopData?.deliveryFee || 0)).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {isOngoing && (
                    <View style={{ marginTop: 16 }}>
                      <View style={{
                        backgroundColor: '#F0EBE4',
                        borderRadius: 8,
                        padding: 12,
                        flexDirection: 'row',
                        alignItems: 'center'
                      }}>
                        <Ionicons name="time" size={18} color="#BC4A4D" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 14, color: '#333', flex: 1 }}>
                          Status: <Text style={{ fontWeight: '600' }}>{order.status.replace('active_', '')}</Text>
                        </Text>
                      </View>
                    </View>
                )}
              </View>
          )}
        </View>
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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#DFD6C5' }}>
          <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#BC4A4D" />
            <Text style={{ marginTop: 12, fontSize: 16, color: '#666' }}>Loading orders...</Text>
          </View>
          <BottomNavigation activeTab="Home" />
        </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#DFD6C5' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />

        {isStreaming ? (
            <LiveStreamBroadcaster shopId={shopId || ''} onEndStream={endStream} />
        ) : (
            <>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                backgroundColor: '#DFD6C5'
              }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#333' }}>Shop Dashboard</Text>
                <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#BC4A4D',
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      borderRadius: 20
                    }}
                    onPress={startStream}
                >
                  <Ionicons name="videocam" size={20} color="white" style={{ marginRight: 6 }} />
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>Go Live</Text>
                </TouchableOpacity>
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
                {/* Approving Orders Section */}
                <View style={{ marginBottom: 24 }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12
                  }}>
                    <Ionicons name="time" size={22} color="#BC4A4D" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>New Orders</Text>
                    {orders.length > 0 && (
                        <View style={{
                          backgroundColor: '#BC4A4D',
                          borderRadius: 12,
                          paddingVertical: 2,
                          paddingHorizontal: 8,
                          marginLeft: 8
                        }}>
                          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>{orders.length}</Text>
                        </View>
                    )}
                  </View>

                  {orders.length === 0 ? (
                      <View style={{
                        backgroundColor: 'white',
                        borderRadius: 16,
                        padding: 24,
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 1
                      }}>
                        <Ionicons name="fast-food-outline" size={40} color="#BC4A4D" />
                        <Text style={{ fontSize: 16, color: '#666', marginTop: 12, textAlign: 'center' }}>
                          No new orders waiting for approval
                        </Text>
                      </View>
                  ) : (
                      orders.map(order => renderOrderCard(order))
                  )}
                </View>

                {/* Ongoing Orders Section */}
                <View style={{ marginBottom: 24 }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12
                  }}>
                    <Ionicons name="bicycle" size={22} color="#BC4A4D" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>Ongoing Orders</Text>
                    {ongoingOrders.length > 0 && (
                        <View style={{
                          backgroundColor: '#4CAF50',
                          borderRadius: 12,
                          paddingVertical: 2,
                          paddingHorizontal: 8,
                          marginLeft: 8
                        }}>
                          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>{ongoingOrders.length}</Text>
                        </View>
                    )}
                  </View>

                  {ongoingOrders.length === 0 ? (
                      <View style={{
                        backgroundColor: 'white',
                        borderRadius: 16,
                        padding: 24,
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 1
                      }}>
                        <Ionicons name="checkmark-circle-outline" size={40} color="#4CAF50" />
                        <Text style={{ fontSize: 16, color: '#666', marginTop: 12, textAlign: 'center' }}>
                          No orders in progress
                        </Text>
                      </View>
                  ) : (
                      ongoingOrders.map(order => renderOrderCard(order, true))
                  )}
                </View>
              </ScrollView>
            </>
        )}

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
            alignItems: 'center'
          }}>
            <View style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 24,
              width: '85%',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5
            }}>
              <Ionicons name="alert-circle" size={48} color="#F44336" style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Decline Order</Text>
              <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24 }}>
                Are you sure you want to decline this order?
                {selectedOrder?.paymentMethod === 'gcash' ?
                    ' This will process a refund to the customer.' :
                    ''}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#F0EBE4',
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                      marginRight: 8
                    }}
                    onPress={() => {
                      setDeclineModalVisible(false);
                      setSelectedOrder(null);
                    }}
                >
                  <Text style={{ color: '#333', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#BC4A4D',
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                      marginLeft: 8
                    }}
                    onPress={confirmDeclineOrder}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <BottomNavigation activeTab="Home" />
      </SafeAreaView>
  );
}