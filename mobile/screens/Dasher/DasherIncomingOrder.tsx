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

interface TopDasher {
  name: string;
}

export default function DasherIncomingOrder() {
  const [isDelivering, setIsDelivering] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [alert, setAlert] = useState<string | null>(null);
  const [userName, setUserName] = useState('Dasher');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [topDashers] = useState<TopDasher[]>([
    { name: 'Clint Montemayor' },
    { name: 'Vanessa Capuras' },
    { name: 'Joe Schwarz' },
    { name: 'Brian Pila' },
    { name: 'Carl Tampus' },
    { name: 'John Gadiano' },
  ]);

  useEffect(() => {
    // Set time and date
    const updateDateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      setCurrentTime(`${formattedHours}:${formattedMinutes} ${ampm}`);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const dayName = days[now.getDay()];
      const monthName = months[now.getMonth()];
      const date = now.getDate();
      setCurrentDate(`${dayName}, ${monthName} ${date}`);
    };
    updateDateTime();
    const intervalId = setInterval(updateDateTime, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Fetch user name and id
    const fetchUserData = async () => {
      try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (token) {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            setUserId(payload.sub || payload.oid || payload.userId || payload.id);
          }
          const response = await axios.get(`${API_URL}/api/dasher/profile`, {
            headers: { 'Authorization': token }
          });
          if (response.data && response.data.name) {
            setUserName(response.data.name);
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    if (isDelivering) {
      fetchOrders();
    }
  }, [isDelivering]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) return;
      const response = await axios.get(`${API_URL}/api/orders/incoming-orders/dasher`, {
        headers: { 'Authorization': token }
      });
      if (response.data) {
        const ordersWithShopData = await Promise.all(
          response.data.map(async (order: Order) => {
            try {
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
    } catch (error) {
      console.error('Error fetching orders:', error);
      Alert.alert('Error', 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStartDelivering = () => {
    setIsDelivering(true);
  };

  const handleAcceptOrder = async (orderId: string, paymentMethod: string) => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token || !userId) return;
      // Assign dasher to the order
      const assignRes = await axios.post(`${API_URL}/api/orders/assign-dasher`, { orderId, dasherId: userId }, {
        headers: { 'Authorization': token }
      });
      if (assignRes.data.success) {
        // Update order status
        let newStatus = 'active_toShop';
        if (paymentMethod === 'gcash') {
          newStatus = 'active_waiting_for_shop';
        }
        await axios.post(`${API_URL}/api/orders/update-order-status`, { orderId, status: newStatus }, {
          headers: { 'Authorization': token }
        });
        setAlert('Order accepted!');
        fetchOrders();
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
      {!isDelivering ? (
        <ScrollView style={styles.scrollView}>
          {/* Map View with Status */}
          <View style={styles.mapContainer}>
            <Image
              source={require('../../assets/images/sample.jpg')}
              style={styles.mapImage}
              resizeMode="cover"
            />
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Offline</Text>
            </View>
          </View>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome {userName}!</Text>
            <Text style={styles.timeText}>{currentTime}</Text>
            <Text style={styles.dateText}>{currentDate}</Text>
          </View>
          {/* Top Dasher Section */}
          <View style={styles.topDasherSection}>
            <Text style={styles.sectionTitle}>Top Dasher</Text>
            {topDashers.map((dasher, index) => (
              <Text key={index} style={styles.dasherName}>{dasher.name}</Text>
            ))}
          </View>
          {/* Start Delivering Button */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartDelivering}
          >
            <Text style={styles.startButtonText}>Start Delivering</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollView}>
          <Text style={styles.title}>Incoming Orders</Text>
          {alert && (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>{alert}</Text>
            </View>
          )}
          {loading ? (
            <ActivityIndicator size="large" color="#BC4A4D" style={{ marginTop: 40 }} />
          ) : orders.length === 0 ? (
            <Text style={styles.noOrdersText}>No incoming orders...</Text>
          ) : (
            orders.map((order) => (
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
            ))
          )}
        </ScrollView>
      )}
      <BottomNavigation activeTab="Home" />
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
  mapContainer: {
    width: '100%',
    height: 250,
    position: 'relative',
    backgroundColor: '#fae9e0',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 14,
  },
  welcomeSection: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fae9e0',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  timeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  topDasherSection: {
    padding: 20,
    backgroundColor: '#fae9e0',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  dasherName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#e74c3c',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
});