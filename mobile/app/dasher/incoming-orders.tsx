import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';
import BottomNavigation from '../../components/BottomNavigation';

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
  items: Array<{
    quantity: number;
    name: string;
    price: number;
  }>;
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

        // Fetch orders only if status is active
        if (currentStatus === 'active') {
          console.log('Fetching incoming orders...');
          setLoading(true);
          const ordersResponse = await axios.get(`${API_URL}/api/orders/incoming-orders/dasher`, {
            headers: { 'Authorization': token }
          });

          console.log('Orders response:', ordersResponse.data);

          if (ordersResponse.data) {
            const ordersWithShopData = await Promise.all(
              ordersResponse.data.map(async (order: Order) => {
                try {
                  console.log('Fetching shop data for order:', order.id);
                  const shopResponse = await axios.get(`${API_URL}/api/shops/${order.shopId}`, {
                    headers: { 'Authorization': token }
                  });
                  return { ...order, shopData: shopResponse.data };
                } catch (error) {
                  console.error('Error fetching shop data for order:', error);
                  return order;
                }
              })
            );
            setOrders(ordersWithShopData);
          }
        } else {
          setOrders([]);
        }
      } catch (error) {
        console.error('Error fetching data in incoming orders:', error);
        if (axios.isAxiosError(error)) {
          console.log('Error response:', error.response?.data);
          console.log('Error status:', error.response?.status);
          Alert.alert('Error', `Failed to fetch data. Status: ${error.response?.status}`);
        } else {
          Alert.alert('Error', 'An unexpected error occurred. Please try again.');
        }
        setIsDelivering(false);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

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

        setAlert('Order accepted!');
        router.push('/dasher/orders');
      } else {
        setAlert('Failed to accept order: ' + assignRes.data.message);
      }
    } catch (error) {
      setAlert('An error occurred while accepting the order.');
      console.error('Error accepting order:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.ordersSection}>
          <Text style={styles.title}>Incoming Orders</Text>
          {alert && (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>{alert}</Text>
            </View>
          )}

          {!isDelivering && !loading && (
            <Text style={styles.noOrdersText}>Turn on your active status to receive incoming orders...</Text>
          )}

          {isDelivering && loading ? (
            <ActivityIndicator size="large" color="#BC4A4D" style={{ marginTop: 40 }} />
          ) : isDelivering && orders.length === 0 ? (
            <Text style={styles.noOrdersText}>No incoming orders...</Text>
          ) : isDelivering && orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderCardContent}>
                <Image
                  source={order.shopData && order.shopData.imageUrl ? { uri: order.shopData.imageUrl } : require('../../assets/images/sample.jpg')}
                  style={styles.orderImage}
                />
                <View style={styles.orderDetails}>
                  <Text style={styles.orderShopName}>{order.shopData?.name || 'Shop'}</Text>
                  <Text style={styles.orderCustomer}>{order.firstname} {order.lastname}</Text>
                  <Text style={styles.orderId}>Order #{order.id}</Text>
                  <Text style={styles.orderPayment}>{order.paymentMethod === 'gcash' ? 'Online Payment' : 'Cash on Delivery'}</Text>
                  {order.changeFor && <Text style={styles.orderChange}>Change for: ₱{order.changeFor}</Text>}
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptOrder(order.id, order.paymentMethod)}
                  >
                    <Text style={styles.acceptButtonText}>Accept Order</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.orderSummary}>
                <Text style={styles.summaryTitle}>Order Summary</Text>
                {order.items.map((item, idx) => (
                  <View key={idx} style={styles.summaryItemRow}>
                    <Text style={styles.summaryItemQty}>{item.quantity}x</Text>
                    <Text style={styles.summaryItemName}>{item.name}</Text>
                    <Text style={styles.summaryItemPrice}>₱{item.price.toFixed(2)}</Text>
                  </View>
                ))}
                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryTotalLabel}>Subtotal</Text>
                  <Text style={styles.summaryTotalValue}>₱{order.totalPrice.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryTotalLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryTotalValue}>₱{order.shopData?.deliveryFee?.toFixed(2) || '0.00'}</Text>
                </View>
                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryTotalLabel}>Total</Text>
                  <Text style={styles.summaryTotalValue}>₱{order.totalPrice && order.shopData ? (order.totalPrice + order.shopData.deliveryFee).toFixed(2) : '0.00'}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomNavigation activeTab="Incoming" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    padding: 16,
    paddingBottom: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#BC4A4D',
    marginBottom: 16,
    textAlign: 'center',
  },
  alertBox: {
    backgroundColor: '#fae9e0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  alertText: {
    color: '#BC4A4D',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noOrdersText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 24,
    fontSize: 16,
  },
  orderCard: {
    backgroundColor: '#fae9e0',
    borderRadius: 12,
    marginBottom: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#fff',
  },
  orderDetails: {
    flex: 1,
  },
  orderShopName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#8B4513',
  },
  orderCustomer: {
    fontSize: 14,
    color: '#333',
  },
  orderId: {
    fontSize: 12,
    color: '#666',
  },
  orderPayment: {
    fontSize: 12,
    color: '#BC4A4D',
  },
  orderChange: {
    fontSize: 12,
    color: '#666',
  },
  acceptButton: {
    marginTop: 8,
    backgroundColor: '#BC4A4D',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  orderSummary: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  summaryTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 6,
    color: '#BC4A4D',
  },
  summaryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  summaryItemQty: {
    fontWeight: 'bold',
    color: '#333',
    width: 30,
  },
  summaryItemName: {
    flex: 1,
    color: '#333',
  },
  summaryItemPrice: {
    color: '#333',
    width: 70,
    textAlign: 'right',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontWeight: 'bold',
    color: '#8B4513',
  },
  summaryTotalValue: {
    fontWeight: 'bold',
    color: '#8B4513',
  },
  ordersSection: {
    padding: 20,
    backgroundColor: '#fae9e0',
  },
});