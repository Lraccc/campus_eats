import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { styled } from 'nativewind';
import axios from '../../services/axiosConfig';
import { API_URL, AUTH_TOKEN_KEY } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface Order {
  id: string;
  status: string;
  totalPrice: number;
  createdAt: string;
}

interface ShopAnalyticsData {
  orders: Order[];
  activeOrders: Order[];
}

const ShopAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState(0);
  const [cancelledOrders, setCancelledOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [averageOrderValue, setAverageOrderValue] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const screenWidth = Dimensions.get('window').width;

  useFocusEffect(
    useCallback(() => {
      fetchShopData();
    }, [])
  );

  const fetchShopData = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        router.replace('/login');
        return;
      }

      setShopId(userId);
      await fetchAnalyticsData(userId);
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalyticsData = async (shopId: string) => {
    try {
      let token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await axios.get(`${API_URL}/api/orders/shop/${shopId}`, {
        headers: { Authorization: token }
      });

      const data: ShopAnalyticsData = response.data;
      const allOrdersList = [...(data.orders || []), ...(data.activeOrders || [])];
      
      setAllOrders(allOrdersList);

      const completed = allOrdersList.filter(order => order.status === 'completed').length;
      const cancelled = allOrdersList.filter(order => order.status === 'cancelled').length;
      
      const revenue = allOrdersList
        .filter(order => order.status === 'completed')
        .reduce((sum, order) => sum + (order.totalPrice || 0), 0);

      setCompletedOrders(completed);
      setCancelledOrders(cancelled);
      setTotalRevenue(revenue);
      setAverageOrderValue(completed > 0 ? revenue / completed : 0);

    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (shopId) {
      await fetchAnalyticsData(shopId);
    }
    setRefreshing(false);
  };

  const formatOrdersByMonth = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyCompleted = Array(12).fill(0);

    allOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      if (orderDate.getFullYear() === selectedYear) {
        const month = orderDate.getMonth();
        if (order.status === 'completed') {
          monthlyCompleted[month]++;
        }
      }
    });

    return months.map((month, index) => ({
      month,
      count: monthlyCompleted[index]
    }));
  };

  const monthlyData = formatOrdersByMonth();

  if (loading) {
    return (
      <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
        <StyledView className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#BC4A4D" />
          <StyledText className="text-[#8B4513] text-base font-semibold mt-4">
            Loading Analytics...
          </StyledText>
        </StyledView>
      </StyledSafeAreaView>
    );
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
      {/* Header */}
      <StyledView className="bg-white px-6 py-4 shadow-md">
        <StyledView className="flex-row items-center justify-between">
          <StyledTouchableOpacity
            onPress={() => router.back()}
            className="mr-4"
          >
            <Ionicons name="arrow-back" size={24} color="#BC4A4D" />
          </StyledTouchableOpacity>
          <StyledView className="flex-1">
            <StyledText className="text-2xl font-bold text-[#8B4513]">
              Shop Analytics
            </StyledText>
          </StyledView>
        </StyledView>
      </StyledView>

      <StyledScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <StyledView className="p-4 gap-4">
          {/* Stats Cards Grid */}
          <StyledView className="flex-row flex-wrap gap-3">
            {/* Total Orders Card */}
            <StyledView
              className="bg-white rounded-2xl p-4 shadow-md flex-1 min-w-[45%]"
              style={{ minWidth: (screenWidth - 40) / 2 - 6 }}
            >
              <StyledText className="text-sm font-semibold text-[#8B4513] mb-2">
                Total Orders
              </StyledText>
              <StyledText className="text-3xl font-bold text-[#BC4A4D]">
                {allOrders.length}
              </StyledText>
            </StyledView>

            {/* Completed Orders Card */}
            <StyledView
              className="bg-white rounded-2xl p-4 shadow-md flex-1 min-w-[45%]"
              style={{ minWidth: (screenWidth - 40) / 2 - 6 }}
            >
              <StyledText className="text-sm font-semibold text-[#8B4513] mb-2">
                Completed
              </StyledText>
              <StyledText className="text-3xl font-bold text-green-600">
                {completedOrders}
              </StyledText>
            </StyledView>

            {/* Total Revenue Card */}
            <StyledView
              className="bg-white rounded-2xl p-4 shadow-md flex-1 min-w-[45%]"
              style={{ minWidth: (screenWidth - 40) / 2 - 6 }}
            >
              <StyledText className="text-sm font-semibold text-[#8B4513] mb-2">
                Total Revenue
              </StyledText>
              <StyledText className="text-2xl font-bold text-[#BC4A4D]">
                ₱{totalRevenue.toFixed(2)}
              </StyledText>
            </StyledView>

            {/* Average Order Value Card */}
            <StyledView
              className="bg-white rounded-2xl p-4 shadow-md flex-1 min-w-[45%]"
              style={{ minWidth: (screenWidth - 40) / 2 - 6 }}
            >
              <StyledText className="text-sm font-semibold text-[#8B4513] mb-2">
                Avg. Order Value
              </StyledText>
              <StyledText className="text-2xl font-bold text-[#BC4A4D]">
                ₱{averageOrderValue.toFixed(2)}
              </StyledText>
            </StyledView>
          </StyledView>

          {/* Orders Over Time Chart */}
          <StyledView className="bg-white rounded-2xl p-4 shadow-md">
            <StyledText className="text-lg font-bold text-[#8B4513] mb-4">
              Orders Over Time ({selectedYear})
            </StyledText>
            <StyledScrollView horizontal showsHorizontalScrollIndicator={false}>
              <StyledView className="flex-row items-end" style={{ height: 200, paddingTop: 20 }}>
                {monthlyData.map((item, index) => {
                  const maxCount = Math.max(...monthlyData.map(d => d.count), 1);
                  const barHeight = (item.count / maxCount) * 160;
                  
                  return (
                    <StyledView key={index} className="items-center mr-3" style={{ width: 40 }}>
                      <StyledView className="items-center mb-2">
                        <StyledText className="text-xs font-bold text-green-600">
                          {item.count}
                        </StyledText>
                      </StyledView>
                      <StyledView
                        className="bg-green-500 rounded-t-lg"
                        style={{
                          width: 32,
                          height: barHeight || 4,
                          minHeight: item.count > 0 ? 20 : 4
                        }}
                      />
                      <StyledText className="text-xs text-[#8B4513] mt-2">
                        {item.month}
                      </StyledText>
                    </StyledView>
                  );
                })}
              </StyledView>
            </StyledScrollView>
          </StyledView>

          {/* Order Status Breakdown */}
          <StyledView className="bg-white rounded-2xl p-4 shadow-md">
            <StyledText className="text-lg font-bold text-[#8B4513] mb-4">
              Order Status Breakdown
            </StyledText>
            
            {/* Completed Orders */}
            <StyledView className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 mb-3">
              <StyledView className="flex-row justify-between items-center">
                <StyledText className="text-base font-semibold text-green-800">
                  Completed Orders
                </StyledText>
                <StyledText className="text-2xl font-bold text-green-600">
                  {completedOrders}
                </StyledText>
              </StyledView>
              <StyledText className="text-sm text-green-600 mt-1">
                {allOrders.length > 0 
                  ? `${((completedOrders / allOrders.length) * 100).toFixed(1)}% of total`
                  : '0% of total'}
              </StyledText>
            </StyledView>

            {/* Cancelled Orders */}
            <StyledView className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-3">
              <StyledView className="flex-row justify-between items-center">
                <StyledText className="text-base font-semibold text-red-800">
                  Cancelled Orders
                </StyledText>
                <StyledText className="text-2xl font-bold text-red-600">
                  {cancelledOrders}
                </StyledText>
              </StyledView>
              <StyledText className="text-sm text-red-600 mt-1">
                {allOrders.length > 0 
                  ? `${((cancelledOrders / allOrders.length) * 100).toFixed(1)}% of total`
                  : '0% of total'}
              </StyledText>
            </StyledView>

            {/* Success Rate */}
            <StyledView className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
              <StyledView className="flex-row justify-between items-center">
                <StyledText className="text-base font-semibold text-blue-800">
                  Success Rate
                </StyledText>
                <StyledText className="text-2xl font-bold text-blue-600">
                  {allOrders.length > 0 
                    ? `${((completedOrders / allOrders.length) * 100).toFixed(1)}%`
                    : '0%'}
                </StyledText>
              </StyledView>
              <StyledText className="text-sm text-blue-600 mt-1">
                Based on {allOrders.length} total orders
              </StyledText>
            </StyledView>
          </StyledView>

          {/* Recent Orders */}
          <StyledView className="bg-white rounded-2xl p-4 shadow-md mb-6">
            <StyledText className="text-lg font-bold text-[#8B4513] mb-4">
              Recent Orders
            </StyledText>
            {allOrders.slice(0, 10).map((order, index) => (
              <StyledView
                key={order.id || index}
                className="border-b border-gray-200 py-3"
              >
                <StyledView className="flex-row justify-between items-start">
                  <StyledView className="flex-1">
                    <StyledText className="text-sm font-semibold text-[#8B4513]">
                      Order #{order.id.substring(0, 8)}...
                    </StyledText>
                    <StyledText className="text-xs text-gray-600 mt-1">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </StyledText>
                  </StyledView>
                  <StyledView className="items-end">
                    <StyledView
                      className={`px-3 py-1 rounded-full ${
                        order.status === 'completed'
                          ? 'bg-green-100'
                          : order.status === 'cancelled'
                          ? 'bg-red-100'
                          : 'bg-yellow-100'
                      }`}
                    >
                      <StyledText
                        className={`text-xs font-semibold ${
                          order.status === 'completed'
                            ? 'text-green-800'
                            : order.status === 'cancelled'
                            ? 'text-red-800'
                            : 'text-yellow-800'
                        }`}
                      >
                        {order.status}
                      </StyledText>
                    </StyledView>
                    <StyledText className="text-sm font-bold text-[#8B4513] mt-2">
                      ₱{order.totalPrice?.toFixed(2)}
                    </StyledText>
                  </StyledView>
                </StyledView>
              </StyledView>
            ))}
          </StyledView>
        </StyledView>
      </StyledScrollView>
    </StyledSafeAreaView>
  );
};

export default ShopAnalytics;
