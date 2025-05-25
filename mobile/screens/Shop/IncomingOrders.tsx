import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { MaterialIcons } from '@expo/vector-icons';
import BottomNavigation from '../../components/BottomNavigation';

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
      <View key={index} style={styles.orderItem}>
        <View style={styles.orderItemHeader}>
          <Text style={styles.orderItemQuantity}>{item.quantity}x</Text>
          <Text style={styles.orderItemName}>{item.name}</Text>
        </View>
        <Text style={styles.orderItemPrice}>₱{item.price.toFixed(2)}</Text>
      </View>
    ));
  };

  const renderOrderCard = (order: Order, isOngoing: boolean = false) => {
    const isExpanded = expandedOrderIds[order.id] || false;
    
    return (
      <View key={order.id} style={styles.orderCard}>
        <TouchableOpacity 
          style={styles.orderCardHeader}
          onPress={() => toggleOrderExpansion(order.id)}
        >
          <View style={styles.orderImageContainer}>
            <Image 
              source={{ uri: order.shopData?.imageUrl || 'https://via.placeholder.com/150' }} 
              style={styles.orderImage} 
            />
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.customerName}>{order.firstname} {order.lastname}</Text>
            <Text style={styles.orderId}>Order #{order.id}</Text>
            <Text style={styles.paymentMethod}>
              {order.paymentMethod === 'gcash' ? 'Online Payment' : 'Cash on Delivery'}
            </Text>
          </View>
          {!isOngoing && (
            <View style={styles.orderActions}>
              <TouchableOpacity 
                style={styles.declineButton}
                onPress={() => handleDeclineOrder(order)}
              >
                <Text style={styles.declineButtonText}>
                  {order.paymentMethod === 'gcash' ? 'Decline & Refund' : 'Decline'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.acceptButton}
                onPress={() => handleAcceptOrder(order.id)}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          )}
          <MaterialIcons 
            name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
            size={24} 
            color="#666" 
            style={styles.expandIcon}
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.orderDetails}>
            <Text style={styles.orderSummaryTitle}>Order Summary</Text>
            {renderOrderItems(order.items)}
            <View style={styles.orderSummaryTotals}>
              <View style={styles.orderSummaryRow}>
                <Text style={styles.orderSummaryLabel}>Subtotal</Text>
                <Text style={styles.orderSummaryValue}>₱{order.totalPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.orderSummaryRow}>
                <Text style={styles.orderSummaryLabel}>Delivery Fee</Text>
                <Text style={styles.orderSummaryValue}>
                  ₱{order.shopData?.deliveryFee.toFixed(2) || '0.00'}
                </Text>
              </View>
              <View style={[styles.orderSummaryRow, styles.orderTotal]}>
                <Text style={[styles.orderSummaryLabel, styles.orderTotalLabel]}>Total</Text>
                <Text style={[styles.orderSummaryValue, styles.orderTotalValue]}>
                  ₱{(order.totalPrice + (order.shopData?.deliveryFee || 0)).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#BC4A4D" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BC4A4D" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
        <BottomNavigation activeTab="Home" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fae9e0" />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Approving Orders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approving Orders</Text>
          {orders.length === 0 ? (
            <Text style={styles.noOrdersText}>No approving orders...</Text>
          ) : (
            orders.map(order => renderOrderCard(order))
          )}
        </View>

        {/* Ongoing Orders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ongoing Orders</Text>
          {ongoingOrders.length === 0 ? (
            <Text style={styles.noOrdersText}>No ongoing orders...</Text>
          ) : (
            ongoingOrders.map(order => renderOrderCard(order, true))
          )}
        </View>

        {/* Past Orders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past Orders</Text>
          {pastOrders.length === 0 ? (
            <Text style={styles.noOrdersText}>No past orders...</Text>
          ) : (
            pastOrders.map(order => (
              <View key={order.id} style={styles.pastOrderCard}>
                <View style={styles.orderImageContainer}>
                  <Image 
                    source={{ uri: order.shopData?.imageUrl || 'https://via.placeholder.com/150' }} 
                    style={styles.orderImage} 
                  />
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.customerName}>{order.firstname} {order.lastname}</Text>
                  <Text style={styles.orderId}>Order #{order.id}</Text>
                  <Text style={styles.paymentMethod}>
                    {order.paymentMethod === 'gcash' ? 'Online Payment' : 'Cash on Delivery'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Decline Order Confirmation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={declineModalVisible}
        onRequestClose={() => setDeclineModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Decline Order</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to decline this order? 
              {selectedOrder?.paymentMethod === 'gcash' ? 
                ' This will process a refund to the customer.' : 
                ''}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setDeclineModalVisible(false);
                  setSelectedOrder(null);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={confirmDeclineOrder}
              >
                <Text style={styles.modalConfirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <BottomNavigation activeTab="Home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },

  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  noOrdersText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pastOrderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderCardHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  orderImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 12,
  },
  orderImage: {
    width: '100%',
    height: '100%',
  },
  orderInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orderId: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  paymentMethod: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  orderActions: {
    flexDirection: 'column',
    marginRight: 8,
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  declineButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  declineButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  expandIcon: {
    marginLeft: 8,
  },
  orderDetails: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  orderSummaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderItemHeader: {
    flexDirection: 'row',
  },
  orderItemQuantity: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  orderItemName: {
    fontSize: 14,
    color: '#333',
  },
  orderItemPrice: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  orderSummaryTotals: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderSummaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  orderSummaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  orderTotal: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
  },
  orderTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orderTotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#BC4A4D',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  modalCancelButton: {
    backgroundColor: '#e0e0e0',
  },
  modalCancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  modalConfirmButton: {
    backgroundColor: '#F44336',
  },
  modalConfirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
