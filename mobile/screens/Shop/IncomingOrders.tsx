import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
  View
} from 'react-native';
import BottomNavigation from '../../components/BottomNavigation';
import LiveStreamBroadcaster from '../../components/LiveStreamBroadcaster';
import { API_URL } from '../../config';
import { AUTH_TOKEN_KEY, clearStoredAuthState, useAuthentication } from '../../services/authService';

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
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [acceptOrderId, setAcceptOrderId] = useState<string | null>(null);
  const [liveStreamModalVisible, setLiveStreamModalVisible] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('');
  const { signOut, getAccessToken } = useAuthentication();
  const [modalContentAnimation] = useState(new Animated.Value(0));

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
      
      // Fetch shop name if we have shopId
      if (storedShopId) {
        try {
          const token = await getAccessToken();
          const response = await axios.get(`${API_URL}/api/shops/${storedShopId}`, {
            headers: { Authorization: token }
          });
          if (response.data && response.data.name) {
            setShopName(response.data.name);
          }
        } catch (error) {
          // Silently handle error
        }
      }
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
      fetchAllOrders();
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
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#BC4A4D', marginLeft: 8 }}>₱{(item.price * item.quantity).toFixed(2)}</Text>
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
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
          borderWidth: 1,
          borderColor: isOngoing ? '#BC4A4D20' : '#F0EBE4'
        }}>
          <TouchableOpacity
              style={{ padding: 16 }}
              activeOpacity={0.7}
              onPress={() => toggleOrderExpansion(order.id)}
          >
            <View style={{ flexDirection: 'column' }}>
              {/* Top row with customer info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  backgroundColor: isOngoing ? '#BC4A4D15' : '#F0EBE4',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 14,
                  borderWidth: 2,
                  borderColor: isOngoing ? '#BC4A4D30' : '#F0EBE480'
                }}>
                  <Ionicons name="person" size={26} color="#BC4A4D" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text 
                    style={{ 
                      fontSize: 16, 
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
                      fontSize: 13, 
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
                      backgroundColor: order.paymentMethod === 'gcash' ? '#BC4A4D15' : '#BC4A4D15',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}>
                      <Ionicons
                        name={order.paymentMethod === 'gcash' ? "card" : "cash"}
                        size={14}
                        color={order.paymentMethod === 'gcash' ? "#BC4A4D" : "#BC4A4D"}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={{ 
                        fontSize: 12, 
                        fontWeight: '500',
                        color: order.paymentMethod === 'gcash' ? "#BC4A4D" : "#BC4A4D" 
                      }}>
                        {paymentMethod}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{
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
                </View>
              </View>
              
              {/* Bottom row with action buttons */}
              {!isOngoing && (
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'flex-end',
                  marginTop: 5,
                  paddingTop: 5,
                  borderTopWidth: 1,
                  borderTopColor: '#F0EBE420'
                }}>
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#F5F5F5',
                      paddingVertical: 9,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: '#E0E0E0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    activeOpacity={0.7}
                    onPress={() => handleDeclineOrder(order)}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#F44336" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 14 }}>
                      Decline
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      backgroundColor: '#BC4A4D',
                      paddingVertical: 9,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                      elevation: 2
                    }}
                    activeOpacity={0.7}
                    onPress={() => handleAcceptOrder(order.id)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="white" style={{ marginRight: 4 }} />
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Accept</Text>
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
                borderTopColor: '#F0EBE4',
                backgroundColor: '#FAFAFA',
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16
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
    setLiveStreamModalVisible(true);
    setIsStreaming(true);
    // Animate modal content sliding up
    Animated.timing(modalContentAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const endStream = () => {
    // Animate modal content sliding down
    Animated.timing(modalContentAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setLiveStreamModalVisible(false);
      setIsStreaming(false);
    });
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
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Live</Text>
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
                    <Text style={{ fontSize: 16, color: '#665', marginTop: 12, textAlign: 'center' }}>
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
                      backgroundColor: '#BC4A4D',
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
                    <Ionicons name="checkmark-circle-outline" size={40} color="#BC4A4D" />
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

        {/* Live Stream Modal */}
        <Modal
            animationType="none"
            transparent={true}
            visible={liveStreamModalVisible}
            onRequestClose={() => setLiveStreamModalVisible(false)}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center', // Center vertically
            alignItems: 'center',     // Center horizontally
          }}>
            <Animated.View style={{
              backgroundColor: '#FFFFFF',
              height: '50%',         // 50% height (with 25% margin top and bottom)
              width: '90%',          // 90% width for better aesthetics
              borderRadius: 20,      // Rounded corners all around
              marginTop: '25%',      // 25% margin from the top
              marginBottom: '25%',   // 25% margin from the bottom
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5,
              overflow: 'hidden',
              transform: [{
                translateY: modalContentAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0], // Slide up 300px
                }),
              }],
            }}>
              {liveStreamModalVisible && (
                <LiveStreamBroadcaster 
                  shopId={shopId || ''} 
                  onEndStream={endStream}
                  shopName={shopName}
                />
              )}
            </Animated.View>
          </View>
        </Modal>

        <BottomNavigation activeTab="Home" />
      </SafeAreaView>
  );
}