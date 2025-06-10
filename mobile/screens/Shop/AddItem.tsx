
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView
} from 'react-native';
import { styled } from 'nativewind';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BottomNavigation from '../../components/BottomNavigation';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

const CATEGORIES = [
  'food', 'drinks', 'clothing', 'chicken', 'sisig', 'samgyupsal',
  'burger steak', 'pork', 'bbq', 'street food', 'desserts', 'milk tea',
  'coffee', 'snacks', 'breakfast', 'others'
];

export default function AddItem() {
  const { getAccessToken } = useAuthentication();
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);

  React.useEffect(() => {
    fetchShopId();
  }, []);

  const fetchShopId = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setShopId(userId);
      }
    } catch (error) {
      console.error("Error fetching shop ID:", error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const validateForm = () => {
    if (!itemName.trim()) {
      Alert.alert("Input Required", "Please enter an item name");
      return false;
    }

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      Alert.alert("Input Required", "Please enter a valid price");
      return false;
    }

    if (!quantity || isNaN(parseInt(quantity)) || parseInt(quantity) < 1) {
      Alert.alert("Input Required", "Quantity must be at least 1");
      return false;
    }

    const hasSelectedCategory = Object.values(selectedCategories).some(value => value);
    if (!hasSelectedCategory) {
      Alert.alert("Input Required", "Please select at least one category");
      return false;
    }

    if (!description.trim()) {
      Alert.alert(
          "Important Notice",
          "You have not set a description. Are you sure you want to continue?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Continue", onPress: () => handleSubmit(true) }
          ]
      );
      return false;
    }

    if (!image) {
      Alert.alert(
          "Important Notice",
          "You have not set an item image. Are you sure you want to continue?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Continue", onPress: () => handleSubmit(true) }
          ]
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (skipValidation = false) => {
    if (!skipValidation && !validateForm()) {
      return;
    }

    Alert.alert(
        "Please Confirm",
        "Are you sure you want to add this item?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add Item", onPress: submitItem }
        ]
    );
  };

  const submitItem = async () => {
    if (!shopId) {
      Alert.alert("Error", "Shop ID not found");
      return;
    }

    setIsLoading(true);

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        Alert.alert("Error", "Authentication failed");
        setIsLoading(false);
        return;
      }

      const config = { headers: { Authorization: token } };

      // Prepare categories array
      const categoriesArray = Object.keys(selectedCategories).filter(key => selectedCategories[key]);

      // Create form data
      const formData = new FormData();

      // Add item data
      const itemData = {
        name: itemName,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        description: description,
        categories: categoriesArray
      };

      formData.append('item', JSON.stringify(itemData));
      formData.append('shopId', shopId);

      // Add image if available
      if (image) {
        const uriParts = image.split('.');
        const fileType = uriParts[uriParts.length - 1];

        formData.append('image', {
          uri: Platform.OS === 'ios' ? image.replace('file://', '') : image,
          name: `photo.${fileType}`,
          type: `image/${fileType}`
        } as any); // Type assertion needed for FormData image upload
      }

      // Send request
      const response = await axios.post(
          `${API_URL}/api/items/shop-add-item/${shopId}`,
          formData,
          {
            headers: {
              ...config.headers,
              'Content-Type': 'multipart/form-data',
            },
          }
      );

      Alert.alert(
          "Success",
          "Item added successfully!",
          [{ text: "OK", onPress: () => router.push('/shop/items') }]
      );

      resetForm();
    } catch (error) {
      console.error("Error adding item:", error);
      Alert.alert("Error", "Failed to add item. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setItemName('');
    setPrice('');
    setQuantity('1');
    setDescription('');
    setImage(null);
    setSelectedCategories({});
  };

  if (isLoading) {
    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
          <StyledView className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#8B7355" />
            <StyledText className="mt-4 text-base text-gray-600 font-medium">Adding item...</StyledText>
          </StyledView>
          <BottomNavigation activeTab="AddItems" />
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
              <StyledText className="text-2xl font-bold text-gray-900">Add New Item</StyledText>
              <StyledText className="text-sm text-gray-600 mt-1">Fill in the details below</StyledText>
            </StyledView>
          </StyledView>
        </StyledView>

        <StyledScrollView
            className="flex-1 px-5"
            style={{ backgroundColor: '#DFD6C5' }}
            showsVerticalScrollIndicator={false}
        >
          {/* Item Image Section */}
          <StyledView className="mb-6">
            <StyledText className="text-lg font-semibold text-gray-900 mb-3">Item Photo</StyledText>
            <StyledTouchableOpacity
                className="h-48 bg-white rounded-3xl overflow-hidden border-2 border-dashed border-gray-300"
                onPress={pickImage}
            >
              {image ? (
                  <StyledView className="relative w-full h-full">
                    <StyledImage source={{ uri: image }} className="w-full h-full" />
                    <StyledView className="absolute top-3 right-3 bg-black/50 rounded-full p-2">
                      <MaterialIcons name="edit" size={20} color="white" />
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

          {/* Basic Information */}
          <StyledView className="mb-6">
            <StyledText className="text-lg font-semibold text-gray-900 mb-4">Basic Information</StyledText>

            {/* Item Name */}
            <StyledView className="mb-4">
              <StyledText className="text-sm font-medium text-gray-700 mb-2">Item Name *</StyledText>
              <StyledView className="bg-white rounded-2xl border border-gray-200">
                <StyledTextInput
                    className="px-4 py-4 text-base text-gray-900"
                    value={itemName}
                    onChangeText={setItemName}
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
                      value={price}
                      onChangeText={setPrice}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                  />
                </StyledView>
              </StyledView>
              <StyledView className="flex-1">
                <StyledText className="text-sm font-medium text-gray-700 mb-2">Quantity *</StyledText>
                <StyledView className="bg-white rounded-2xl border border-gray-200">
                  <StyledTextInput
                      className="px-4 py-4 text-base text-gray-900"
                      value={quantity}
                      onChangeText={setQuantity}
                      placeholder="1"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                  />
                </StyledView>
              </StyledView>
            </StyledView>

            {/* Description */}
            <StyledView className="mb-4">
              <StyledText className="text-sm font-medium text-gray-700 mb-2">Description</StyledText>
              <StyledView className="bg-white rounded-2xl border border-gray-200">
                <StyledTextInput
                    className="px-4 py-4 text-base text-gray-900 min-h-[100px]"
                    value={description}
                    onChangeText={setDescription}
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
            <StyledText className="text-sm text-gray-600 mb-4">Select one or more categories that best describe your item</StyledText>

            <StyledView className="flex-row flex-wrap">
              {CATEGORIES.map((category) => (
                  <StyledTouchableOpacity
                      key={category}
                      className={`px-4 py-2 rounded-full m-1 border ${
                          selectedCategories[category]
                              ? 'bg-amber-500 border-amber-500'
                              : 'bg-white border-gray-300'
                      }`}
                      onPress={() => toggleCategory(category)}
                  >
                    <StyledText
                        className={`text-sm font-medium capitalize ${
                            selectedCategories[category] ? 'text-white' : 'text-gray-700'
                        }`}
                    >
                      {category}
                    </StyledText>
                  </StyledTouchableOpacity>
              ))}
            </StyledView>

            {/* Selected categories count */}
            {Object.values(selectedCategories).some(value => value) && (
                <StyledView className="mt-3 bg-amber-50 rounded-xl p-3">
                  <StyledText className="text-sm text-amber-800">
                    {Object.values(selectedCategories).filter(Boolean).length} categories selected
                  </StyledText>
                </StyledView>
            )}
          </StyledView>

          {/* Submit Button */}
          <StyledView className="mb-6">
            <StyledTouchableOpacity
                className="bg-[#BC4A4DFF] rounded-2xl py-4 items-center shadow-sm"
                onPress={() => handleSubmit()}
            >
              <StyledView className="flex-row items-center">
                <MaterialIcons name="add" size={24} color="white" />
                <StyledText className="text-white font-semibold text-lg ml-2">Add Item</StyledText>
              </StyledView>
            </StyledTouchableOpacity>
          </StyledView>

          {/* Helper Text */}
          <StyledView className="mb-8 bg-blue-50 rounded-2xl p-4">
            <StyledView className="flex-row items-start">
              <MaterialIcons name="info" size={20} color="#3B82F6" />
              <StyledView className="flex-1 ml-3">
                <StyledText className="text-sm font-medium text-blue-900 mb-1">Tips for better listings</StyledText>
                <StyledText className="text-sm text-blue-700 leading-relaxed">
                  • Use clear, well-lit photos{'\n'}
                  • Write detailed descriptions{'\n'}
                  • Set competitive prices{'\n'}
                  • Choose relevant categories
                </StyledText>
              </StyledView>
            </StyledView>
          </StyledView>
        </StyledScrollView>

        <BottomNavigation activeTab="AddItems" />
      </SafeAreaView>
  );
}
