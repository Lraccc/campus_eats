import React, { useState, useEffect } from 'react';
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
  Platform
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

export default function UpdateItem() {
  const { id } = useLocalSearchParams();
  const { getAccessToken } = useAuthentication();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [categories, setCategories] = useState<Record<string, boolean>>({});

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

  const fetchItem = async () => {
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
      Alert.alert("Error", "Failed to load item details");
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
      Alert.alert("Warning", "Please select at least one category");
      return;
    }

    if (item.quantity < 1) {
      Alert.alert("Warning", "Quantity must be at least 1");
      return;
    }

    if (!item.description) {
      Alert.alert("Warning", "Please add a description");
      return;
    }

    if (!image) {
      Alert.alert("Warning", "Please add an image");
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
        shopId: item.shopId // Include shopId from the existing item
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
        Alert.alert("Success", response.data.message);
        router.back();
      } else {
        throw new Error("Update failed");
      }
    } catch (error) {
      console.error("Error updating item:", error);
      Alert.alert("Error", "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
          <StyledView className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#BC4A4D" />
            <StyledText className="mt-4 text-base text-gray-600 font-medium">Loading item details...</StyledText>
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
      </SafeAreaView>
  );
}