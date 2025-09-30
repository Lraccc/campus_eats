import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { styled } from 'nativewind';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import BottomNavigation from '../../components/BottomNavigation';

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledScrollView = styled(ScrollView)
const StyledImage = styled(Image)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledSafeAreaView = styled(SafeAreaView)

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  orderCount?: number;
}

export default function ShopHome() {
  const { getAccessToken } = useAuthentication();
  const [items, setItems] = useState<Item[]>([]);
  const [popularItems, setPopularItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    fetchShopId();
  }, []);

  const fetchShopId = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setShopId(userId);
        fetchShopDetails(userId);
      }
    } catch (error) {
      console.error("Error fetching shop ID:", error);
      setIsLoading(false);
    }
  };

  const fetchShopDetails = async (id: string) => {
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

      // Fetch shop info
      const shopResponse = await axios.get(`${API_URL}/api/shops/${id}`, config);
      setShopInfo(shopResponse.data);

      // Fetch shop items
      const itemsResponse = await axios.get(`${API_URL}/api/items/${id}/shop-items`, config);
      setItems(itemsResponse.data);

      // Fetch popular items
      const popularResponse = await axios.get(`${API_URL}/api/items/${id}/popular-items`, config);
      const sortedItems = popularResponse.data.sort((a: Item, b: Item) => 
        (b.orderCount || 0) - (a.orderCount || 0)
      );
      setPopularItems(sortedItems);
    } catch (error) {
      console.error("Error fetching shop details:", error);
      Alert.alert("Error", "Failed to load shop details");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    if (shopId) {
      fetchShopDetails(shopId);
    } else {
      setRefreshing(false);
    }
  }, [shopId]);

  const navigateToIncomingOrders = () => {
    router.push('/shop/incoming-orders');
  };

  const navigateToCashout = () => {
    router.push('/shop/cashout');
  };

  const navigateToAddItem = () => {
    // This would be implemented in a future update
    Alert.alert("Coming Soon", "Add item functionality will be available soon!");
  };

  if (isLoading) {
    return (
      <StyledSafeAreaView className="flex-1 bg-gray-100">
        <StyledView className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#BC4A4D" />
          <StyledText className="mt-2.5 text-base text-gray-600">Loading shop details...</StyledText>
        </StyledView>
        <BottomNavigation activeTab="Home" />
      </StyledSafeAreaView>
    );
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-100">
      <StatusBar barStyle="dark-content" />
      <StyledScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Popular Items Section */}
        <StyledView className="p-4 bg-white mt-2.5">
          <StyledText className="text-lg font-bold mb-4 text-gray-800">Popular Items</StyledText>
          <StyledScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-grow-0">
            {popularItems.length > 0 ? (
              popularItems.map((item) => (
                <StyledView key={item.id} className="w-38 mr-4 bg-gray-50 rounded-2xl overflow-hidden">
                  <StyledImage
                    source={{ uri: item.imageUrl || 'https://via.placeholder.com/100' }}
                    className="w-full h-25"
                  />
                  <StyledView className="p-2.5">
                    <StyledText className="text-sm font-bold">{item.name}</StyledText>
                    <StyledText className="text-sm text-red-700 mt-1">${item.price.toFixed(2)}</StyledText>
                    <StyledText className="text-xs text-gray-500 mt-1">Orders: {item.orderCount || 0}</StyledText>
                  </StyledView>
                </StyledView>
              ))
            ) : (
              <StyledView className="p-5 items-center justify-center">
                <StyledText className="text-sm text-gray-500 text-center">No popular items yet.</StyledText>
              </StyledView>
            )}
          </StyledScrollView>
        </StyledView>

        {/* All Items Section */}
        <StyledView className="p-4 bg-white mt-2.5">
          <StyledText className="text-lg font-bold mb-4 text-gray-800">All Items</StyledText>
          <StyledTouchableOpacity 
            className="flex-row items-center bg-red-700 py-2 px-3 rounded self-end mb-2.5"
            onPress={navigateToAddItem}
          >
            <MaterialIcons name="add" size={24} color="#FFF" />
            <StyledText className="text-white ml-1 font-bold">Add Item</StyledText>
          </StyledTouchableOpacity>
          {items.length > 0 ? (
            <StyledView className="flex-row flex-wrap justify-between">
              {items.map((item) => (
                <StyledTouchableOpacity 
                  key={item.id} 
                  className="w-[48%] mb-4 bg-gray-50 rounded-2xl overflow-hidden"
                  activeOpacity={0.8}
                >
                  <StyledImage
                    source={{ uri: item.imageUrl || 'https://via.placeholder.com/100' }}
                    className="w-full h-30"
                    resizeMode="cover"
                  />
                  <StyledView className="p-2.5">
                    <StyledText className="text-sm font-bold">{item.name}</StyledText>
                    <StyledText className="text-sm text-red-700 mt-1 font-bold">${item.price.toFixed(2)}</StyledText>
                    <StyledText className="text-xs text-gray-600 mt-1">{item.description}</StyledText>
                  </StyledView>
                </StyledTouchableOpacity>
              ))}
            </StyledView>
          ) : (
            <StyledView className="p-5 items-center justify-center">
              <StyledText className="text-sm text-gray-500 text-center">No items added yet.</StyledText>
            </StyledView>
          )}
        </StyledView>
      </StyledScrollView>
      <BottomNavigation activeTab="Home" />
    </StyledSafeAreaView>
  );
}
