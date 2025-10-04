import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Animated,
  Image
} from 'react-native';
import { styled } from 'nativewind';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import { MaterialIcons } from '@expo/vector-icons';
import BottomNavigation from '../../components/BottomNavigation';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

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
  items: OrderItem[];
  totalPrice: number;
  deliveryFee: number;
  status: string;
  paymentMethod: string;
  dasherId: string | null;
  createdAt?: string;
}

const STATUS_CONFIG = {
  'waiting_for_shop_confirmation': {
    label: 'Pending Confirmation',
    color: 'bg-yellow-100 text-yellow-800',
    icon: 'schedule'
  },
  'active_waiting_for_shop': {
    label: 'Awaiting Action',
    color: 'bg-amber-100 text-amber-800',
    icon: 'hourglass-empty'
  },
  'active_shop_confirmed': {
    label: 'Confirmed',
    color: 'bg-blue-100 text-blue-800',
    icon: 'check-circle'
  },
  'active_waiting_for_dasher': {
    label: 'Preparing',
    color: 'bg-orange-100 text-orange-800',
    icon: 'restaurant'
  },
  'active_preparing': {
    label: 'Dasher On Way',
    color: 'bg-indigo-100 text-indigo-800',
    icon: 'delivery-dining'
  },
  'active_ready_for_pickup': {
    label: 'Ready for Pickup',
    color: 'bg-purple-100 text-purple-800',
    icon: 'done-all'
  },
  'active_out_for_delivery': {
    label: 'Out for Delivery',
    color: 'bg-indigo-100 text-indigo-800',
    icon: 'local-shipping'
  },
  'completed': {
    label: 'Completed',
    color: 'bg-green-100 text-green-800',
    icon: 'check-circle'
  },
  'cancelled_by_shop': {
    label: 'Cancelled by Shop',
    color: 'bg-red-100 text-red-800',
    icon: 'cancel'
  },
  'cancelled_by_user': {
    label: 'Cancelled by Customer',
    color: 'bg-red-100 text-red-800',
    icon: 'cancel'
  }
};

export default function Orders() {
  const { getAccessToken } = useAuthentication();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  // Animation values for loading state
  const spinValue = useRef(new Animated.Value(0)).current;
  const circleValue = useRef(new Animated.Value(0)).current;

  // Start animations when loading begins
  useEffect(() => {
    if (isLoading) {
      // Spinning logo animation
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );

      // Circle loading animation
      const circleAnimation = Animated.loop(
        Animated.timing(circleValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      );

      spinAnimation.start();
      circleAnimation.start();

      return () => {
        spinAnimation.stop();
        circleAnimation.stop();
      };
    }
  }, [isLoading, spinValue, circleValue]);

  useEffect(() => {
    fetchShopId();
  }, []);

  const fetchShopId = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setShopId(userId);
        fetchOrders(userId);
      }
    } catch (error) {
      console.error("Error fetching shop ID:", error);
      setIsLoading(false);
    }
  };

  const fetchOrders = async (id?: string) => {
    const currentShopId = id || shopId;
    if (!currentShopId) return;

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

      // Fetch all order types for the shop
      const [pendingResponse, ongoingResponse, pastResponse] = await Promise.all([
        axios.get(`${API_URL}/api/orders/active-waiting-for-shop`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/orders/ongoing-orders`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/orders/past-orders`, config).catch(() => ({ data: [] }))
      ]);

      // Combine all orders and filter for current shop - exclude orders waiting for shop action
      const allOrders = [
        ...pendingResponse.data,
        ...ongoingResponse.data,
        ...pastResponse.data
      ].filter((order: Order) => 
        order.shopId === currentShopId && 
        order.status !== 'waiting_for_shop_confirmation' &&
        order.status !== 'active_waiting_for_shop'
      );

      // Sort by creation date (newest first)
      allOrders.sort((a: Order, b: Order) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setOrders(allOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      Alert.alert("Error", "Failed to load orders");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [shopId]);

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrderIds(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || {
      label: status,
      color: 'bg-gray-100 text-gray-800',
      icon: 'help'
    };
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
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
        { orderId, status: newStatus },
        config
      );

      // Refresh orders after update
      fetchOrders();
      Alert.alert("Success", "Order status updated successfully");
    } catch (error) {
      console.error("Error updating order status:", error);
      Alert.alert("Error", "Failed to update order status");
    }
  };

  const getNextStatusOptions = (currentStatus: string) => {
    switch (currentStatus) {
      case 'active_shop_confirmed':
        return [
          { status: 'active_waiting_for_dasher', label: 'Start Preparing', icon: 'restaurant', color: '#F59E0B' }
        ];
      case 'active_waiting_for_dasher':
        return [
          { status: 'active_ready_for_pickup', label: 'Ready for Pickup', icon: 'done-all', color: '#10B981' }
        ];
      // No buttons for active_ready_for_pickup - dasher will handle pickup and delivery
      default:
        return [];
    }
  };

  const renderOrderItems = (items: OrderItem[]) => {
    return items.map((item, index) => (
      <StyledView key={index} className="bg-gray-50 rounded-xl p-3 mb-2">
        <StyledView className="flex-row justify-between items-center">
          <StyledView className="flex-1">
            <StyledText className="font-semibold text-gray-900 mb-1">
              {item.name}
            </StyledText>
            <StyledText className="text-sm text-gray-600">
              Qty: {item.quantity} × ₱{item.price.toFixed(2)}
            </StyledText>
          </StyledView>
          <StyledText className="font-bold text-[#BC4A4D]">
            ₱{(item.price * item.quantity).toFixed(2)}
          </StyledText>
        </StyledView>
      </StyledView>
    ));
  };

  const renderOrderCard = (order: Order) => {
    const isExpanded = expandedOrderIds[order.id] || false;
    const statusConfig = getStatusConfig(order.status);
    const paymentMethod = order.paymentMethod === 'gcash' ? 'Online Payment' : 'Cash on Delivery';

    return (
      <StyledView key={order.id} className="bg-white rounded-2xl mb-4 overflow-hidden shadow-sm border border-gray-100">
        <StyledTouchableOpacity
          className="p-4"
          onPress={() => toggleOrderExpansion(order.id)}
          activeOpacity={0.7}
        >
          <StyledView className="flex-row justify-between items-start mb-3">
            <StyledView className="flex-1">
              <StyledText className="text-lg font-bold text-gray-900 mb-1">
                Order #{order.id.slice(-6)}
              </StyledText>
              <StyledText className="text-sm text-gray-600">
                {order.firstname} {order.lastname}
              </StyledText>
            </StyledView>
            <StyledView className={`px-3 py-1 rounded-full ${statusConfig.color}`}>
              <StyledView className="flex-row items-center">
                <MaterialIcons name={statusConfig.icon as any} size={14} color="currentColor" />
                <StyledText className="text-xs font-medium ml-1">
                  {statusConfig.label}
                </StyledText>
              </StyledView>
            </StyledView>
          </StyledView>

          <StyledView className="flex-row justify-between items-center">
            <StyledView className="flex-row items-center">
              <MaterialIcons name="shopping-bag" size={16} color="#6B7280" />
              <StyledText className="text-sm text-gray-600 ml-1">
                {order.items.length} item{order.items.length !== 1 ? 's' : ''}
              </StyledText>
            </StyledView>
            <StyledText className="text-lg font-bold text-[#BC4A4D]">
              ₱{(order.totalPrice + order.deliveryFee).toFixed(2)}
            </StyledText>
          </StyledView>

          <StyledView className="flex-row justify-between items-center mt-2">
            <StyledView className="flex-row items-center">
              <MaterialIcons 
                name={order.paymentMethod === 'gcash' ? 'payment' : 'money'} 
                size={16} 
                color="#6B7280" 
              />
              <StyledText className="text-sm text-gray-600 ml-1">
                {paymentMethod}
              </StyledText>
            </StyledView>
            <MaterialIcons 
              name={isExpanded ? 'expand-less' : 'expand-more'} 
              size={24} 
              color="#6B7280" 
            />
          </StyledView>
        </StyledTouchableOpacity>

        {isExpanded && (
          <StyledView className="px-4 pb-4 border-t border-gray-100">
            <StyledText className="font-semibold text-gray-900 mb-3 mt-3">
              Order Details
            </StyledText>
            
            {renderOrderItems(order.items)}

            <StyledView className="bg-gray-50 rounded-xl p-3 mt-2">
              <StyledView className="flex-row justify-between items-center mb-2">
                <StyledText className="text-sm text-gray-600">Subtotal</StyledText>
                <StyledText className="text-sm font-medium">₱{order.totalPrice.toFixed(2)}</StyledText>
              </StyledView>
              <StyledView className="flex-row justify-between items-center mb-2">
                <StyledText className="text-sm text-gray-600">Delivery Fee</StyledText>
                <StyledText className="text-sm font-medium">₱{order.deliveryFee.toFixed(2)}</StyledText>
              </StyledView>
              <StyledView className="h-px bg-gray-300 my-2" />
              <StyledView className="flex-row justify-between items-center">
                <StyledText className="font-bold text-gray-900">Total</StyledText>
                <StyledText className="font-bold text-[#BC4A4D] text-lg">
                  ₱{(order.totalPrice + order.deliveryFee).toFixed(2)}
                </StyledText>
              </StyledView>
            </StyledView>

            {/* Status Update Buttons */}
            {(() => {
              const nextStatusOptions = getNextStatusOptions(order.status);
              if (nextStatusOptions.length > 0) {
                return (
                  <StyledView className="mt-4">
                    <StyledText className="font-semibold text-gray-900 mb-3">
                      Update Order Status
                    </StyledText>
                    <StyledView className="flex-row flex-wrap">
                      {nextStatusOptions.map((option, index) => (
                        <StyledTouchableOpacity
                          key={index}
                          className="flex-row items-center px-4 py-3 rounded-xl shadow-sm mr-2 mb-2"
                          style={{ backgroundColor: option.color }}
                          onPress={() => updateOrderStatus(order.id, option.status)}
                        >
                          <MaterialIcons name={option.icon as any} size={18} color="white" />
                          <StyledText className="text-white font-semibold text-sm ml-2">
                            {option.label}
                          </StyledText>
                        </StyledTouchableOpacity>
                      ))}
                    </StyledView>
                  </StyledView>
                );
              }
              return null;
            })()}
          </StyledView>
        )}
      </StyledView>
    );
  };

  if (isLoading) {
    const spin = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const circleRotation = circleValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
        <StyledView className="flex-1 justify-center items-center px-6">
          <StyledView className="items-center">
            {/* Spinning Logo Container */}
            <StyledView className="relative mb-6">
              {/* Outer rotating circle */}
              <Animated.View
                style={{
                  transform: [{ rotate: circleRotation }],
                }}
                className="absolute w-20 h-20 border-2 border-[#BC4A4D]/20 border-t-[#BC4A4D] rounded-full"
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
            <StyledText className="text-[#BC4A4D] text-base font-semibold">Loading orders...</StyledText>
          </StyledView>
        </StyledView>
        <BottomNavigation activeTab="Orders" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />

      {/* Header */}
      <StyledView className="px-5 py-4 bg-white rounded-b-3xl shadow-sm">
        <StyledView className="flex-row justify-between items-center">
          <StyledView className="flex-1">
            <StyledText className="text-2xl font-bold text-gray-900">Order Management</StyledText>
            <StyledText className="text-sm text-gray-600 mt-1">
              {orders.length} accepted {orders.length === 1 ? 'order' : 'orders'}
            </StyledText>
          </StyledView>
          <StyledTouchableOpacity
            className="bg-[#BC4A4D] rounded-full p-3"
            onPress={() => fetchOrders()}
          >
            <MaterialIcons name="refresh" size={24} color="white" />
          </StyledTouchableOpacity>
        </StyledView>
      </StyledView>

      <StyledScrollView
        className="flex-1 px-5"
        style={{ backgroundColor: '#DFD6C5' }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#BC4A4D']}
            tintColor="#BC4A4D"
          />
        }
      >
        {orders.length > 0 ? (
          <StyledView className="py-4">
            {orders.map(renderOrderCard)}
          </StyledView>
        ) : (
          /* Empty State */
          <StyledView className="flex-1 justify-center items-center py-16">
            <StyledView className="bg-white rounded-3xl p-8 items-center shadow-sm border border-gray-100 mx-4">
              <StyledView className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="receipt-long" size={40} color="#9CA3AF" />
              </StyledView>

              <StyledText className="text-xl font-semibold text-gray-900 mb-2 text-center">
                No Accepted Orders
              </StyledText>

              <StyledText className="text-sm text-gray-600 text-center mb-6 leading-relaxed px-4">
                Orders that you've accepted will appear here. You can manage their status and track progress from this screen.
              </StyledText>

              <StyledTouchableOpacity
                className="bg-[#BC4A4D] px-6 py-3 rounded-2xl shadow-sm"
                onPress={() => router.push('/shop/items')}
              >
                <StyledView className="flex-row items-center">
                  <MaterialIcons name="inventory" size={20} color="white" />
                  <StyledText className="text-white font-semibold text-base ml-2">View My Items</StyledText>
                </StyledView>
              </StyledTouchableOpacity>
            </StyledView>
          </StyledView>
        )}
      </StyledScrollView>

      <BottomNavigation activeTab="Orders" />
    </SafeAreaView>
  );
}