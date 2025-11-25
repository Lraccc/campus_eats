import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Animated
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
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
}

interface ShopInfo {
  id: string;
  name: string;
  // Add other shop properties as needed
}

export default function Items() {
  const { getAccessToken } = useAuthentication();
  const [items, setItems] = useState<Item[]>([]);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);

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
        fetchData(userId);
      }
    } catch (error) {
      console.error("Error fetching shop ID:", error);
      setIsLoading(false);
    }
  };

  const fetchData = async (id: string) => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchShopDetails(id),
        fetchShopItems(id)
      ]);
    } catch (error) {
      // Only show error if it's not a 404 for shop items (new shops may have no items)
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        console.error("Error fetching data:", error);
        Alert.alert("Error", "Failed to load shop data");
      }
    } finally {
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

      const response = await axios.get(`${API_URL}/api/shops/${id}`, config);
      setShopInfo(response.data);
    } catch (error) {
      console.error("Error fetching shop details:", error);
      throw error;
    }
  };

  const fetchShopItems = async (id: string) => {
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

      const response = await axios.get(`${API_URL}/api/items/${id}/shop-items`, config);
      setItems(response.data);
    } catch (error) {
      // 404 is normal for new shops with no items yet
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setItems([]);
      } else {
        console.error("Error fetching shop items:", error);
        throw error;
      }
    }
  };

  const navigateToEditItem = (itemId: string) => {
    router.push({
      pathname: "/shop/edit-item/[id]",
      params: { id: itemId }
    });
  };

  const navigateToAddItem = () => {
    router.push('/shop/add-item');
  };

  const renderCategories = (categories: string[]) => {
    if (!categories || !Array.isArray(categories)) return null;

    return (
        <StyledView className="flex-row flex-wrap mt-1">
          {categories.map((category, index) => (
              <StyledView key={index} className="bg-amber-100 px-2 py-1 rounded-full mr-1 mb-1">
                <StyledText className="text-xs text-amber-800 font-medium">{category}</StyledText>
              </StyledView>
          ))}
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
              <StyledText className="text-[#BC4A4D] text-base font-semibold">Loading...</StyledText>
            </StyledView>
          </StyledView>
          <BottomNavigation activeTab="Items" />
        </SafeAreaView>
    );
  }

  return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />

        {/* Header */}
        <StyledView className="px-5 py-4" style={{ backgroundColor: '#DFD6C5' }}>
          <StyledView className="flex-row justify-between items-center">
            <StyledView className="flex-1">
              <StyledText className="text-2xl font-bold text-gray-900">My Items</StyledText>
              <StyledText className="text-sm text-gray-600 mt-1">
                {items.length} {items.length === 1 ? 'item' : 'items'} in your inventory
              </StyledText>
            </StyledView>
            <StyledTouchableOpacity
                className="flex-row items-center px-4 py-3 rounded-2xl shadow-sm"
                style={{ backgroundColor: '#BC4A4D' }}
                onPress={navigateToAddItem}
            >
              <MaterialIcons name="add" size={20} color="white" />
              <StyledText className="text-white ml-2 font-semibold text-sm">Add Item</StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>

        <StyledScrollView
            className="flex-1 px-5"
            style={{ backgroundColor: '#DFD6C5' }}
            showsVerticalScrollIndicator={false}
        >
          {items.length > 0 ? (
              <StyledView className="pb-6">
                {items.map((item, index) => (
                    <StyledView key={item.id} className="bg-white rounded-3xl mb-4 overflow-hidden shadow-sm border border-gray-100">
                      <StyledView className="flex-row">
                        {/* Item Image */}
                        <StyledView className="w-24 h-24 m-4 rounded-2xl overflow-hidden bg-gray-100">
                          <StyledImage
                              source={{ uri: item.imageUrl || 'https://via.placeholder.com/150' }}
                              className="w-full h-full"
                          />
                        </StyledView>

                        {/* Item Details */}
                        <StyledView className="flex-1 py-4 pr-4">
                          <StyledView className="flex-row justify-between items-start mb-2">
                            <StyledText className="text-lg font-semibold text-gray-900 flex-1 mr-2" numberOfLines={1}>
                              {item.name}
                            </StyledText>
                            <StyledTouchableOpacity
                                className="p-2 rounded-full bg-gray-50"
                                onPress={() => navigateToEditItem(item.id)}
                            >
                              <MaterialIcons name="edit" size={18} color="#BC4A4D" />
                            </StyledTouchableOpacity>
                          </StyledView>

                          <StyledText className="text-sm text-gray-600 mb-3 leading-relaxed" numberOfLines={2}>
                            {item.description}
                          </StyledText>

                          <StyledView className="flex-row justify-between items-center">
                            <StyledView className="bg-green-50 px-3 py-1 rounded-full">
                              <StyledText className="text-lg font-bold text-green-700">
                                ₱{item.price.toFixed(2)}
                              </StyledText>
                            </StyledView>

                            <StyledView className="flex-row items-center">
                              <StyledView className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                              <StyledText className="text-xs text-gray-500 font-medium">Available</StyledText>
                            </StyledView>
                          </StyledView>
                        </StyledView>
                      </StyledView>
                    </StyledView>
                ))}
              </StyledView>
          ) : (
              /* Empty State */
              <StyledView className="flex-1 justify-center items-center py-16">
                <StyledView className="bg-white rounded-3xl p-8 items-center shadow-sm border border-gray-100 mx-4">
                  <StyledView className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                    <MaterialIcons name="inventory-2" size={40} color="#9CA3AF" />
                  </StyledView>

                  <StyledText className="text-xl font-semibold text-gray-900 mb-2 text-center">
                    No Items Yet
                  </StyledText>

                  <StyledText className="text-sm text-gray-600 text-center mb-6 leading-relaxed px-4">
                    Start building your inventory by adding your first item. Showcase your products to customers!
                  </StyledText>

                  <StyledTouchableOpacity
                      className="px-6 py-3 rounded-2xl shadow-sm"
                      style={{ backgroundColor: '#BC4A4D' }}
                      onPress={navigateToAddItem}
                  >
                    <StyledView className="flex-row items-center">
                      <MaterialIcons name="add" size={20} color="white" />
                      <StyledText className="text-white font-semibold text-base ml-2">Add Your First Item</StyledText>
                    </StyledView>
                  </StyledTouchableOpacity>
                </StyledView>
              </StyledView>
          )}
        </StyledScrollView>

        <BottomNavigation activeTab="Items" />
      </SafeAreaView>
  );
}