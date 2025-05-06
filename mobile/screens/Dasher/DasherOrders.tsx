import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  shopName: string;
  customerName: string;
  deliveryAddress: string;
  totalAmount: number;
  createdAt: string;
}

export default function DasherOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.get(`${API_URL}/api/dasher/orders`, {
        headers: {
          'Authorization': token,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      setOrders(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.message || 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchOrders().finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        throw new Error('No authentication token found');
      }

      await axios.post(`${API_URL}/api/dasher/orders/${orderId}/accept`, {}, {
        headers: {
          'Authorization': token
        }
      });

      // Refresh orders after accepting
      fetchOrders();
    } catch (err: any) {
      console.error('Error accepting order:', err);
      setError(err.response?.data?.message || 'Failed to accept order');
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        throw new Error('No authentication token found');
      }

      await axios.post(`${API_URL}/api/dasher/orders/${orderId}/complete`, {}, {
        headers: {
          'Authorization': token
        }
      });

      // Refresh orders after completing
      fetchOrders();
    } catch (err: any) {
      console.error('Error completing order:', err);
      setError(err.response?.data?.message || 'Failed to complete order');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ae4e4e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Available Orders</Text>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => router.push('/dasher/profile' as any)}
        >
          <Text style={styles.profileButtonText}>Profile</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {orders.length === 0 ? (
          <Text style={styles.noOrdersText}>No available orders at the moment</Text>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
                <Text style={[
                  styles.orderStatus,
                  { color: order.status === 'PENDING' ? '#f39c12' : '#27ae60' }
                ]}>
                  {order.status}
                </Text>
              </View>

              <View style={styles.orderDetails}>
                <Text style={styles.shopName}>{order.shopName}</Text>
                <Text style={styles.customerName}>Customer: {order.customerName}</Text>
                <Text style={styles.address}>Delivery to: {order.deliveryAddress}</Text>
                <Text style={styles.amount}>Total: ₱{order.totalAmount.toFixed(2)}</Text>
              </View>

              <View style={styles.orderActions}>
                {order.status === 'PENDING' && (
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptOrder(order.id)}
                  >
                    <Text style={styles.buttonText}>Accept Order</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'ACCEPTED' && (
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={() => handleCompleteOrder(order.id)}
                  >
                    <Text style={styles.buttonText}>Mark as Delivered</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fae9e0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  profileButton: {
    backgroundColor: '#ae4e4e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  profileButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  noOrdersText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 32,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderDetails: {
    marginBottom: 16,
  },
  shopName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  acceptButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  completeButton: {
    backgroundColor: '#2980b9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
}); 