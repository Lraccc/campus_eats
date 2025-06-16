import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';
import BottomNavigation from '../../components/BottomNavigation';
import { styled } from 'nativewind';

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
          try {
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
          } catch (error) {
            // Handle 404 or no orders case silently
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              console.log('No incoming orders available');
              setOrders([]);
            } else {
              // Only show error for non-404 cases
              console.error('Error fetching incoming orders:', error);
              if (axios.isAxiosError(error)) {
                console.log('Error response:', error.response?.data);
                console.log('Error status:', error.response?.status);
                Alert.alert('Error', `Failed to fetch orders. Please try again.`);
              }
            }
          }
        } else {
          setOrders([]);
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
      <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
        <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <StyledView className="flex-1 px-5 pt-12 pb-24">
            <StyledView className="mb-6">
              <StyledText className="text-2xl font-bold text-[#000] text-center">Incoming Orders</StyledText>
            </StyledView>

            {alert && (
                <StyledView className="bg-white p-3 rounded-xl mb-4 shadow-sm">
                  <StyledText className="text-[#BC4A4D] font-bold text-center">{alert}</StyledText>
                </StyledView>
            )}

            {!isDelivering && !loading && (
                <StyledView className="bg-white rounded-2xl p-6 items-center justify-center my-4"
                            style={{
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 3 },
                              shadowOpacity: 0.08,
                              shadowRadius: 10,
                              elevation: 4,
                            }}
                >
                  <StyledText className="text-base text-gray-600 text-center">
                    Turn on your active status to receive incoming orders...
                  </StyledText>
                </StyledView>
            )}

            {isDelivering && loading ? (
                <StyledView className="flex-1 justify-center items-center mt-10">
                  <ActivityIndicator size="large" color="#BC4A4D" />
                </StyledView>
            ) : isDelivering && orders.length === 0 ? (
                <StyledView className="bg-white rounded-2xl p-6 items-center justify-center my-4"
                            style={{
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 3 },
                              shadowOpacity: 0.08,
                              shadowRadius: 10,
                              elevation: 4,
                            }}
                >
                  <StyledText className="text-base text-gray-600 text-center">
                    No incoming orders...
                  </StyledText>
                </StyledView>
            ) : isDelivering && orders.map((order) => (
                <StyledView key={order.id} className="bg-white rounded-2xl mb-5 overflow-hidden"
                            style={{
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 3 },
                              shadowOpacity: 0.08,
                              shadowRadius: 10,
                              elevation: 4,
                            }}
                >
                  <StyledView className="p-4 flex-row items-center">
                    <StyledImage
                        source={order.shopData && order.shopData.imageUrl ? { uri: order.shopData.imageUrl } : require('../../assets/images/sample.jpg')}
                        className="w-[60px] h-[60px] rounded-lg mr-3"
                    />
                    <StyledView className="flex-1">
                      <StyledText className="text-base font-bold text-[#8B4513]">{order.shopData?.name || 'Shop'}</StyledText>
                      <StyledText className="text-sm text-gray-800">{order.firstname} {order.lastname}</StyledText>
                      <StyledText className="text-xs text-gray-500">Order #{order.id}</StyledText>
                      <StyledText className="text-xs text-[#BC4A4D]">
                        {order.paymentMethod === 'gcash' ? 'Online Payment' : 'Cash on Delivery'}
                      </StyledText>
                      {order.changeFor && (
                          <StyledText className="text-xs text-gray-500">Change for: ₱{order.changeFor}</StyledText>
                      )}
                      <StyledTouchableOpacity
                          className="bg-[#BC4A4D] py-2 rounded-lg mt-2 items-center"
                          onPress={() => handleAcceptOrder(order.id, order.paymentMethod)}
                          style={{
                            shadowColor: "#BC4A4D",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 3,
                          }}
                      >
                        <StyledText className="text-white font-bold text-sm">Accept Order</StyledText>
                      </StyledTouchableOpacity>
                    </StyledView>
                  </StyledView>

                  <StyledView className="bg-gray-50 p-4">
                    <StyledText className="text-base font-bold text-[#BC4A4D] mb-2">Order Summary</StyledText>
                    {order.items.map((item, idx) => (
                        <StyledView key={idx} className="flex-row justify-between mb-1">
                          <StyledText className="text-sm font-bold text-gray-800 w-8">{item.quantity}x</StyledText>
                          <StyledText className="text-sm text-gray-800 flex-1">{item.name}</StyledText>
                          <StyledText className="text-sm text-gray-800 w-[70px] text-right">₱{item.price.toFixed(2)}</StyledText>
                        </StyledView>
                    ))}
                    <StyledView className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
                      <StyledText className="text-base font-bold text-[#8B4513]">Subtotal</StyledText>
                      <StyledText className="text-base font-bold text-[#8B4513]">₱{order.totalPrice.toFixed(2)}</StyledText>
                    </StyledView>
                    <StyledView className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
                      <StyledText className="text-base font-bold text-[#8B4513]">Delivery Fee</StyledText>
                      <StyledText className="text-base font-bold text-[#8B4513]">₱{order.shopData?.deliveryFee?.toFixed(2) || '0.00'}</StyledText>
                    </StyledView>
                    <StyledView className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
                      <StyledText className="text-base font-bold text-[#8B4513]">Total</StyledText>
                      <StyledText className="text-base font-bold text-[#8B4513]">
                        ₱{order.totalPrice && order.shopData ? (order.totalPrice + order.shopData.deliveryFee).toFixed(2) : '0.00'}
                      </StyledText>
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