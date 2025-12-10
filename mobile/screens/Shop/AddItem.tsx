
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  Animated,
  Keyboard,
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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  // Themed modal states
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertModalTitle, setAlertModalTitle] = useState('');
  const [alertModalMessage, setAlertModalMessage] = useState('');
  const [alertOnClose, setAlertOnClose] = useState<(() => void) | null>(null);

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState('');
  const [confirmModalMessage, setConfirmModalMessage] = useState('');
  const [confirmOnConfirm, setConfirmOnConfirm] = useState<(() => void) | null>(null);
  const [confirmOnCancel, setConfirmOnCancel] = useState<(() => void) | null>(null);

  React.useEffect(() => {
    fetchShopId();

    // Keyboard listeners
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Animation refs for Orders-like loading logo
  const spinValue = React.useRef(new Animated.Value(0)).current;
  const circleValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isLoading) {
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );

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
      setAlertModalTitle('Error');
      setAlertModalMessage('Failed to pick image');
      setAlertOnClose(() => () => setAlertModalVisible(false));
      setAlertModalVisible(true);
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
      setAlertModalTitle('Input Required');
      setAlertModalMessage('Please enter an item name');
      setAlertOnClose(() => () => setAlertModalVisible(false));
      setAlertModalVisible(true);
      return false;
    }

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      setAlertModalTitle('Input Required');
      setAlertModalMessage('Please enter a valid price');
      setAlertOnClose(() => () => setAlertModalVisible(false));
      setAlertModalVisible(true);
      return false;
    }

    if (!quantity || isNaN(parseInt(quantity)) || parseInt(quantity) < 1) {
      setAlertModalTitle('Input Required');
      setAlertModalMessage('Quantity must be at least 1');
      setAlertOnClose(() => () => setAlertModalVisible(false));
      setAlertModalVisible(true);
      return false;
    }

    const hasSelectedCategory = Object.values(selectedCategories).some(value => value);
    if (!hasSelectedCategory) {
      setAlertModalTitle('Input Required');
      setAlertModalMessage('Please select at least one category');
      setAlertOnClose(() => () => setAlertModalVisible(false));
      setAlertModalVisible(true);
      return false;
    }

    // Allow submission without description or image
    return true;
  };

  const handleSubmit = async (skipValidation = false) => {
    if (!skipValidation && !validateForm()) {
      return;
    }

    // Submit directly without confirmation modal
    submitItem();
  };

  const submitItem = async () => {
    if (!shopId) {
      setAlertModalTitle('Error');
      setAlertModalMessage('Shop ID not found');
      setAlertOnClose(() => () => setAlertModalVisible(false));
      setAlertModalVisible(true);
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
        setAlertModalTitle('Error');
        setAlertModalMessage('Authentication failed');
        setAlertOnClose(() => () => setAlertModalVisible(false));
        setAlertModalVisible(true);
        setIsLoading(false);
        return;
      }

      const config = { headers: { Authorization: token } };

      // Prepare categories array
      const categoriesArray = Object.keys(selectedCategories).filter(key => selectedCategories[key]);

      // Create form data
      const formData = new FormData();

      // Add item data
      const itemData: any = {
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

      // Show loading briefly, then navigate directly
      setIsLoading(true);

      // Small delay to allow the loading animation to be visible
      setTimeout(() => {
        setIsLoading(false);
        resetForm();
        router.push('/shop/items');
      }, 500);
    } catch (error) {
      console.error("Error adding item:", error);
      setAlertModalTitle('Error');
      setAlertModalMessage('Failed to add item. Please try again.');
      setAlertOnClose(() => () => setAlertModalVisible(false));
      setAlertModalVisible(true);
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
          <StyledView className="relative items-center justify-center w-48 h-48">
            <Animated.View
              style={{
                position: 'absolute',
                width: 160,
                height: 160,
                borderRadius: 80,
                borderWidth: 6,
                borderColor: '#BC4A4D44',
                transform: [{ rotate: circleRotation }],
              }}
            />

            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <StyledView className="w-36 h-36 bg-[#BC4A4D]/10 rounded-full items-center justify-center shadow-sm">
                <StyledImage
                  source={require('../../assets/images/logo.png')}
                  className="w-20 h-20"
                  style={{ resizeMode: 'contain' }}
                />
              </StyledView>
            </Animated.View>
          </StyledView>

          <StyledText className="mt-6 text-base text-gray-600 font-medium">Adding item...</StyledText>
        </StyledView>
        {!isKeyboardVisible && <BottomNavigation activeTab="AddItems" />}
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

          {/* Categories Section */}
          <StyledView className="mb-6">
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

          {/* Basic Information */}
          <StyledView className="mb-6">
            <StyledView className="bg-white rounded-3xl p-5 border border-gray-200" style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 3,
            }}>
              <StyledText className="text-xl font-bold text-gray-900 mb-4">Basic Information</StyledText>

              {/* Item Name */}
              <StyledView className="mb-4">
                <StyledText className="text-sm font-semibold text-gray-700 mb-2">Item Name *</StyledText>
                <StyledView className="bg-gray-50 rounded-xl border border-gray-200">
                  <StyledTextInput
                      className="px-4 py-3.5 text-base text-gray-900"
                      value={itemName}
                      onChangeText={setItemName}
                      placeholder="e.g. Iced Coffee, Milk Tea, Burger"
                      placeholderTextColor="#9CA3AF"
                      maxLength={100}
                  />
                </StyledView>
              </StyledView>

              {/* Price and Quantity Row */}
              <StyledView className="flex-row mb-4" style={{ gap: 12 }}>
                <StyledView className="flex-1">
                  <StyledText className="text-sm font-semibold text-gray-700 mb-2">Price (₱) *</StyledText>
                  <StyledView className="bg-gray-50 rounded-xl border border-gray-200 flex-row items-center px-3">
                    <StyledText className="text-gray-400 text-base mr-1">₱</StyledText>
                    <StyledTextInput
                        className="flex-1 py-3.5 text-base text-gray-900"
                        value={price}
                        onChangeText={setPrice}
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                        maxLength={10}
                    />
                  </StyledView>
                </StyledView>
                <StyledView className="flex-1">
                  <StyledText className="text-sm font-semibold text-gray-700 mb-2">Stock Quantity *</StyledText>
                  <StyledView className="bg-gray-50 rounded-xl border border-gray-200 flex-row items-center px-3">
                    <MaterialIcons name="inventory-2" size={18} color="#9CA3AF" style={{ marginRight: 4 }} />
                    <StyledTextInput
                        className="flex-1 py-3.5 text-base text-gray-900"
                        value={quantity}
                        onChangeText={setQuantity}
                        placeholder="1"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={6}
                    />
                  </StyledView>
                </StyledView>
              </StyledView>

              {/* Description */}
              <StyledView>
                <StyledText className="text-sm font-semibold text-gray-700 mb-2">Description</StyledText>
                <StyledView className="bg-gray-50 rounded-xl border border-gray-200">
                  <StyledTextInput
                      className="px-4 py-3.5 text-base text-gray-900"
                      style={{ minHeight: 100 }}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe your item's ingredients, taste, or special features..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      maxLength={500}
                  />
                </StyledView>
                <StyledText className="text-xs text-gray-500 mt-1.5">
                  {description.length}/500 characters • Help customers know what makes this item special
                </StyledText>
              </StyledView>
            </StyledView>
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
          <StyledView className="mb-24 bg-blue-50 rounded-2xl p-4">
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

        {!isKeyboardVisible && <BottomNavigation activeTab="Items" />}

        {/* Alert Modal */}
        <Modal
            visible={alertModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setAlertModalVisible(false)}
        >
          <StyledView className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <StyledView className="bg-white rounded-3xl p-6 mx-6 w-[85%] max-w-[400px]">
              <StyledView className="items-center mb-4">
                <StyledView className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center mb-3">
                  <MaterialIcons name="info" size={32} color="#F59E0B" />
                </StyledView>
                <StyledText className="text-xl font-bold text-gray-900 mb-2">{alertModalTitle}</StyledText>
                <StyledText className="text-base text-gray-600 text-center">{alertModalMessage}</StyledText>
              </StyledView>
              <StyledTouchableOpacity
                  className="bg-amber-500 rounded-2xl py-3"
                  onPress={() => {
                    setAlertModalVisible(false);
                    if (alertOnClose) alertOnClose();
                  }}
              >
                <StyledText className="text-white font-bold text-center text-base">OK</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          </StyledView>
        </Modal>

        {/* Confirmation Modal */}
        <Modal
            visible={confirmModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setConfirmModalVisible(false)}
        >
          <StyledView className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <StyledView className="bg-white rounded-3xl p-6 mx-6 w-[85%] max-w-[400px]">
              <StyledView className="items-center mb-4">
                <StyledView className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-3">
                  <MaterialIcons name="help-outline" size={32} color="#3B82F6" />
                </StyledView>
                <StyledText className="text-xl font-bold text-gray-900 mb-2">{confirmModalTitle}</StyledText>
                <StyledText className="text-base text-gray-600 text-center">{confirmModalMessage}</StyledText>
              </StyledView>
              <StyledView className="flex-row" style={{ gap: 12 }}>
                <StyledTouchableOpacity
                    className="flex-1 bg-gray-200 rounded-2xl py-3"
                    onPress={() => {
                      setConfirmModalVisible(false);
                      if (confirmOnCancel) confirmOnCancel();
                    }}
                >
                  <StyledText className="text-gray-700 font-bold text-center text-base">Cancel</StyledText>
                </StyledTouchableOpacity>
                <StyledTouchableOpacity
                    className="flex-1 bg-amber-500 rounded-2xl py-3"
                    onPress={() => {
                      if (confirmOnConfirm) confirmOnConfirm();
                    }}
                >
                  <StyledText className="text-white font-bold text-center text-base">Confirm</StyledText>
                </StyledTouchableOpacity>
              </StyledView>
            </StyledView>
          </StyledView>
        </Modal>

        {/* Loading Modal */}
        {isLoading && (
            <Modal visible={isLoading} transparent animationType="fade">
              <StyledView className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
                <StyledView className="items-center">
                  {/* Spinning Logo Container */}
                  <StyledView className="relative mb-6">
                    {/* Outer rotating circle */}
                    <Animated.View
                        style={{
                          transform: [{ rotate: circleValue.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg'],
                            }) }],
                        }}
                        className="absolute w-20 h-20 border-2 border-[#BC4A4D]/20 border-t-[#BC4A4D] rounded-full"
                    />

                    {/* Logo container */}
                    <StyledView className="w-16 h-16 rounded-full bg-[#BC4A4D]/10 items-center justify-center mx-2 my-2">
                      <Animated.View
                          style={{
                            transform: [{ rotate: spinValue.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '360deg'],
                              }) }],
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
                    <StyledText className="text-white">Campus</StyledText>
                    <StyledText className="text-[#DAA520]">Eats</StyledText>
                  </StyledText>

                  {/* Loading Text */}
                  <StyledText className="text-white text-base font-semibold">Adding item...</StyledText>
                </StyledView>
              </StyledView>
            </Modal>
        )}

        {/* Themed Alert Modal */}
        <Modal
          transparent
          visible={alertModalVisible}
          animationType="fade"
          onRequestClose={() => { setAlertModalVisible(false); alertOnClose?.(); }}
        >
          <StyledView className="flex-1 justify-center items-center bg-black/50 px-6">
            <StyledView className="bg-white rounded-2xl p-6 w-full max-w-md">
              <StyledText className="text-xl font-bold text-[#BC4A4D] mb-2">{alertModalTitle}</StyledText>
              <StyledText className="text-sm text-gray-700 mb-6">{alertModalMessage}</StyledText>
              <StyledView className="flex-row justify-end">
                <StyledTouchableOpacity
                  className="px-4 py-2 rounded-xl"
                  style={{ backgroundColor: '#BC4A4D' }}
                  onPress={() => { setAlertModalVisible(false); if (alertOnClose) alertOnClose(); }}
                >
                  <StyledText className="text-white font-semibold">OK</StyledText>
                </StyledTouchableOpacity>
              </StyledView>
            </StyledView>
          </StyledView>
        </Modal>

        {/* Themed Confirm Modal */}
        <Modal
          transparent
          visible={confirmModalVisible}
          animationType="fade"
          onRequestClose={() => { setConfirmModalVisible(false); confirmOnCancel?.(); }}
        >
          <StyledView className="flex-1 justify-center items-center bg-black/50 px-6">
            <StyledView className="bg-white rounded-2xl p-6 w-full max-w-md">
              <StyledText className="text-xl font-bold text-[#BC4A4D] mb-2">{confirmModalTitle}</StyledText>
              <StyledText className="text-sm text-gray-700 mb-6">{confirmModalMessage}</StyledText>
              <StyledView className="flex-row justify-end space-x-3">
                <StyledTouchableOpacity
                  className="px-4 py-2 rounded-xl"
                  style={{ backgroundColor: '#E5E7EB' }}
                  onPress={() => { setConfirmModalVisible(false); if (confirmOnCancel) confirmOnCancel(); }}
                >
                  <StyledText className="text-gray-800 font-semibold">Cancel</StyledText>
                </StyledTouchableOpacity>
                <StyledTouchableOpacity
                  className="px-4 py-2 rounded-xl"
                  style={{ backgroundColor: '#10B981' }}
                  onPress={() => { setConfirmModalVisible(false); if (confirmOnConfirm) confirmOnConfirm(); }}
                >
                  <StyledText className="text-white font-semibold">Confirm</StyledText>
                </StyledTouchableOpacity>
              </StyledView>
            </StyledView>
          </StyledView>
        </Modal>
      </SafeAreaView>
  );
}
