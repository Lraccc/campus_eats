import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  Animated
} from 'react-native';
import { styled } from 'nativewind';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import BottomNavigation from '../../components/BottomNavigation';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledScrollView = styled(ScrollView);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface Item {
  id: string;
  shopId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  categories: string[];
  createdAt?: string;
}

const CATEGORIES = [
  'food', 'drinks', 'clothing', 'chicken', 'sisig', 'samgyupsal',
  'burger steak', 'pork', 'bbq', 'street food', 'desserts',
  'milk tea', 'coffee', 'snacks', 'breakfast', 'others'
];

interface AlertButton {
  text: string;
  style?: 'cancel' | 'default' | 'destructive';
  onPress: () => void;
}

interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  buttons: AlertButton[];
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  type?: 'info' | 'error' | 'success' | 'warning';
}

const CustomAlert: React.FC<CustomAlertProps> = ({ visible, title, message, buttons, type = 'info' }) => {
  const getIcon = () => {
    switch (type) {
      case 'error':
        return 'error';
      case 'success':
        return 'check-circle';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'error':
        return '#EF4444';
      case 'success':
        return '#10B981';
      case 'warning':
        return '#F59E0B';
      default:
        return '#3B82F6';
    }
  };

  return (
      <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={() => buttons.find(b => b.text === 'Cancel')?.onPress?.()}
      >
        <StyledView className="flex-1 justify-center items-center bg-black/50">
          <StyledView className="bg-white rounded-3xl w-[85%] max-w-[400px] overflow-hidden">
            <StyledView className="p-6">
              <StyledView className="items-center mb-4">
                <StyledView className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: `${getIconColor()}20` }}>
                  <MaterialIcons name={getIcon()} size={32} color={getIconColor()} />
                </StyledView>
                <StyledText className="text-xl font-bold text-gray-900 mb-2">{title}</StyledText>
                <StyledText className="text-base text-gray-600 text-center">{message}</StyledText>
              </StyledView>
              <StyledView className="flex-row justify-end space-x-3">
                {buttons.map((button, index) => (
                    <StyledTouchableOpacity
                        key={index}
                        className={`px-6 py-3 rounded-xl ${
                            button.style === 'cancel'
                                ? 'bg-gray-100'
                                : type === 'error'
                                    ? 'bg-red-500'
                                    : type === 'success'
                                        ? 'bg-green-500'
                                        : type === 'warning'
                                            ? 'bg-amber-500'
                                            : 'bg-blue-500'
                        }`}
                        onPress={button.onPress}
                    >
                      <StyledText
                          className={`font-semibold ${
                              button.style === 'cancel' ? 'text-gray-700' : 'text-white'
                          }`}
                      >
                        {button.text}
                      </StyledText>
                    </StyledTouchableOpacity>
                ))}
              </StyledView>
            </StyledView>
          </StyledView>
        </StyledView>
      </Modal>
  );
};

export default function UpdateItem() {
  const { id } = useLocalSearchParams();
  const { getAccessToken } = useAuthentication();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [categories, setCategories] = useState<Record<string, boolean>>({});
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: []
  });

  // Animation values for loading state
  const spinValue = useRef(new Animated.Value(0)).current;
  const circleValue = useRef(new Animated.Value(0)).current;

  // Start animations when loading begins
  useEffect(() => {
    if (loading) {
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
  }, [loading, spinValue, circleValue]);

  useEffect(() => {
    fetchItem();
    initializeCategories();
  }, []);

  const initializeCategories = () => {
    const initialCategories: Record<string, boolean> = {};
    CATEGORIES.forEach(category => {
      initialCategories[category] = false;
    });
    setCategories(initialCategories);
  };

  const showAlert = (title: string, message: string, type: AlertConfig['type'] = 'info', buttons: AlertButton[]) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      buttons
    });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const fetchItem = async () => {
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        showAlert(
            "Error",
            "Authentication failed",
            "error",
            [{ text: "OK", onPress: hideAlert }]
        );
        return;
      }

      const config = { headers: { Authorization: token } };
      const response = await axios.get(`${API_URL}/api/items/${id}`, config);
      const itemData = response.data;

      if (itemData) {
        setItem(itemData);
        setImage(itemData.imageUrl);

        // Set categories
        const updatedCategories = { ...categories };
        itemData.categories.forEach((category: string) => {
          updatedCategories[category] = true;
        });
        setCategories(updatedCategories);
      }
    } catch (error) {
      console.error("Error fetching item:", error);
      showAlert(
          "Error",
          "Failed to load item details",
          "error",
          [{ text: "OK", onPress: hideAlert }]
      );
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSubmit = async () => {
    if (!item) return;

    const selectedCategories = Object.keys(categories).filter(cat => categories[cat]);

    if (selectedCategories.length === 0) {
      showAlert(
          "Warning",
          "Please select at least one category",
          "warning",
          [{ text: "OK", onPress: hideAlert }]
      );
      return;
    }

    if (item.quantity < 1) {
      showAlert(
          "Warning",
          "Quantity must be at least 1",
          "warning",
          [{ text: "OK", onPress: hideAlert }]
      );
      return;
    }

    if (!item.description) {
      showAlert(
          "Warning",
          "Please add a description",
          "warning",
          [{ text: "OK", onPress: hideAlert }]
      );
      return;
    }

    if (!image) {
      showAlert(
          "Warning",
          "Please add an image",
          "warning",
          [{ text: "OK", onPress: hideAlert }]
      );
      return;
    }

    setSaving(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        throw new Error("No token available");
      }

      const formData = new FormData();
      formData.append('item', JSON.stringify({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        description: item.description,
        categories: selectedCategories,
        shopId: item.shopId
      }));

      if (image && image.startsWith('file://')) {
        const imageUri = image;
        const filename = imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : 'image';

        formData.append('image', {
          uri: imageUri,
          name: filename,
          type
        } as any);
      }

      const config = {
        headers: {
          'Authorization': token,
          'Content-Type': 'multipart/form-data',
        },
      };

      const response = await axios.put(`${API_URL}/api/items/shop-update-item/${id}`, formData, config);

      if (response.data.message) {
        showAlert(
            "Success",
            response.data.message,
            "success",
            [{ text: "OK", onPress: () => { hideAlert(); router.back(); } }]
        );
      } else {
        throw new Error("Update failed");
      }
    } catch (error) {
      console.error("Error updating item:", error);
      showAlert(
          "Error",
          "Failed to update item",
          "error",
          [{ text: "OK", onPress: hideAlert }]
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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

  if (!item) {
    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
          <StyledView className="flex-1 justify-center items-center">
            <MaterialIcons name="error-outline" size={48} color="#BC4A4D" />
            <StyledText className="text-base text-gray-600 mt-3 font-medium">Item not found</StyledText>
            <StyledTouchableOpacity
                className="mt-4 px-6 py-3 rounded-2xl"
                style={{ backgroundColor: '#BC4A4D' }}
                onPress={() => router.back()}
            >
              <StyledText className="text-white font-semibold">Go Back</StyledText>
            </StyledTouchableOpacity>
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
          <StyledView className="flex-row items-center">
            <StyledTouchableOpacity
                className="mr-4 p-2"
                onPress={() => router.back()}
            >
              <MaterialIcons name="arrow-back" size={24} color="#374151" />
            </StyledTouchableOpacity>
            <StyledView className="flex-1">
              <StyledText className="text-2xl font-bold text-gray-900">Edit Item</StyledText>
              <StyledText className="text-sm text-gray-600 mt-1">Update your item details</StyledText>
            </StyledView>
            <StyledView className="bg-amber-100 px-3 py-1 rounded-full">
              <StyledText className="text-xs font-medium text-amber-800">Editing</StyledText>
            </StyledView>
          </StyledView>
        </StyledView>

        <StyledScrollView
            className="flex-1 px-5"
            style={{ backgroundColor: '#DFD6C5' }}
            showsVerticalScrollIndicator={false}
        >
          {/* Current Image Section */}
          <StyledView className="mb-6">
            <StyledText className="text-lg font-semibold text-gray-900 mb-3">Item Photo</StyledText>
            <StyledTouchableOpacity
                className="h-48 bg-white rounded-3xl overflow-hidden border-2 border-gray-200"
                onPress={pickImage}
            >
              {image ? (
                  <StyledView className="relative w-full h-full">
                    <StyledImage source={{ uri: image }} className="w-full h-full" />
                    <StyledView className="absolute top-3 right-3 bg-black/60 rounded-full p-2">
                      <MaterialIcons name="edit" size={20} color="white" />
                    </StyledView>
                    <StyledView className="absolute bottom-3 left-3 bg-black/60 rounded-full px-3 py-1">
                      <StyledText className="text-white text-xs font-medium">Tap to change</StyledText>
                    </StyledView>
                  </StyledView>
              ) : (
                  <StyledView className="flex-1 justify-center items-center">
                    <StyledView className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-3">
                      <MaterialIcons name="add-a-photo" size={32} color="#9CA3AF" />
                    </StyledView>
                    <StyledText className="text-base font-medium text-gray-700 mb-1">Add Photo</StyledText>
                    <StyledText className="text-sm text-gray-500 text-center px-4">
                      Tap to upload an image of your item
                    </StyledText>
                  </StyledView>
              )}
            </StyledTouchableOpacity>
          </StyledView>

          {/* Item Details */}
          <StyledView className="mb-6">
            <StyledText className="text-lg font-semibold text-gray-900 mb-4">Item Details</StyledText>

            {/* Item Name */}
            <StyledView className="mb-4">
              <StyledText className="text-sm font-medium text-gray-700 mb-2">Item Name *</StyledText>
              <StyledView className="bg-white rounded-2xl border border-gray-200">
                <StyledTextInput
                    className="px-4 py-4 text-base text-gray-900"
                    value={item.name}
                    onChangeText={(text) => setItem({ ...item, name: text })}
                    placeholder="Enter item name"
                    placeholderTextColor="#9CA3AF"
                />
              </StyledView>
            </StyledView>

            {/* Price and Quantity Row */}
            <StyledView className="flex-row space-x-3 mb-4">
              <StyledView className="flex-1">
                <StyledText className="text-sm font-medium text-gray-700 mb-2">Price (₱) *</StyledText>
                <StyledView className="bg-white rounded-2xl border border-gray-200">
                  <StyledTextInput
                      className="px-4 py-4 text-base text-gray-900"
                      value={item.price.toString()}
                      onChangeText={(text) => setItem({ ...item, price: parseFloat(text) || 0 })}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                  />
                </StyledView>
              </StyledView>
              <StyledView className="flex-1">
                <StyledText className="text-sm font-medium text-gray-700 mb-2">Quantity *</StyledText>
                <StyledView className="bg-white rounded-2xl border border-gray-200">
                  <StyledTextInput
                      className="px-4 py-4 text-base text-gray-900"
                      value={item.quantity.toString()}
                      onChangeText={(text) => setItem({ ...item, quantity: parseInt(text) || 0 })}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#9CA3AF"
                  />
                </StyledView>
              </StyledView>
            </StyledView>

            {/* Description */}
            <StyledView className="mb-4">
              <StyledText className="text-sm font-medium text-gray-700 mb-2">Description *</StyledText>
              <StyledView className="bg-white rounded-2xl border border-gray-200">
                <StyledTextInput
                    className="px-4 py-4 text-base text-gray-900 min-h-[100px]"
                    value={item.description}
                    onChangeText={(text) => setItem({ ...item, description: text })}
                    placeholder="Describe your item..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                />
              </StyledView>
            </StyledView>
          </StyledView>

          {/* Categories Section */}
          <StyledView className="mb-8">
            <StyledText className="text-lg font-semibold text-gray-900 mb-3">Categories *</StyledText>
            <StyledText className="text-sm text-gray-600 mb-4">Select categories that describe your item</StyledText>

            <StyledView className="flex-row flex-wrap">
              {CATEGORIES.map((category) => (
                  <StyledTouchableOpacity
                      key={category}
                      className={`px-4 py-2 rounded-full m-1 border ${
                          categories[category]
                              ? 'border-transparent'
                              : 'bg-white border-gray-300'
                      }`}
                      style={categories[category] ? { backgroundColor: '#BC4A4D' } : {}}
                      onPress={() => handleCategoryToggle(category)}
                  >
                    <StyledText
                        className={`text-sm font-medium capitalize ${
                            categories[category] ? 'text-white' : 'text-gray-700'
                        }`}
                    >
                      {category}
                    </StyledText>
                  </StyledTouchableOpacity>
              ))}
            </StyledView>

            {/* Selected categories count */}
            {Object.values(categories).some(value => value) && (
                <StyledView className="mt-3 bg-green-50 rounded-xl p-3">
                  <StyledText className="text-sm text-green-800">
                    {Object.values(categories).filter(Boolean).length} categories selected
                  </StyledText>
                </StyledView>
            )}
          </StyledView>

          {/* Action Buttons */}
          <StyledView className="flex-row space-x-3 mb-6">
            <StyledTouchableOpacity
                className="flex-1 bg-white border-2 rounded-2xl py-4 items-center"
                style={{ borderColor: '#BC4A4D' }}
                onPress={() => router.back()}
            >
              <StyledView className="flex-row items-center">
                <MaterialIcons name="close" size={20} color="#BC4A4D" />
                <StyledText className="font-semibold text-base ml-2" style={{ color: '#BC4A4D' }}>
                  Cancel
                </StyledText>
              </StyledView>
            </StyledTouchableOpacity>

            <StyledTouchableOpacity
                className="flex-1 rounded-2xl py-4 items-center"
                style={{ backgroundColor: '#BC4A4D' }}
                onPress={handleSubmit}
                disabled={saving}
            >
              <StyledView className="flex-row items-center">
                {saving ? (
                    <ActivityIndicator size="small" color="white" />
                ) : (
                    <MaterialIcons name="save" size={20} color="white" />
                )}
                <StyledText className="text-white font-semibold text-base ml-2">
                  {saving ? 'Saving...' : 'Save Changes'}
                </StyledText>
              </StyledView>
            </StyledTouchableOpacity>
          </StyledView>

          {/* Info Section */}
          <StyledView className="mb-8 bg-blue-50 rounded-2xl p-4">
            <StyledView className="flex-row items-start">
              <MaterialIcons name="info" size={20} color="#3B82F6" />
              <StyledView className="flex-1 ml-3">
                <StyledText className="text-sm font-medium text-blue-900 mb-1">Update Tips</StyledText>
                <StyledText className="text-sm text-blue-700 leading-relaxed">
                  • Changes will be visible immediately{'\n'}
                  • Make sure all required fields are filled{'\n'}
                  • High-quality photos improve sales{'\n'}
                  • Accurate descriptions build trust
                </StyledText>
              </StyledView>
            </StyledView>
          </StyledView>
        </StyledScrollView>

        <BottomNavigation activeTab="Items" />

        <CustomAlert {...alertConfig} />
      </SafeAreaView>
  );
}