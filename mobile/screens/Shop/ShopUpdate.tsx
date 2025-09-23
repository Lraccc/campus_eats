import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Linking,
  Dimensions,
  ImageSourcePropType,
  Modal,
  Animated
} from 'react-native';
import { router } from 'expo-router';
import axios, { AxiosError } from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import BottomNavigation from '../../components/BottomNavigation';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

interface ShopData {
  id: string;
  name: string;
  description?: string;
  desc?: string;
  address: string;
  googleLink?: string;
  imageUrl: string;
  categories: string[];
  deliveryFee?: number;
  acceptGCASH: boolean;
  wallet?: number;
  timeOpen?: string;
  timeClose?: string;
  gcashName?: string;
  gcashNumber?: string;
}

const CATEGORIES = [
  'food', 'drinks', 'clothing', 'chicken', 'sisig', 'samgyupsal',
  'burger steak', 'pork', 'bbq', 'street food', 'desserts', 'milk tea',
  'coffee', 'snacks', 'breakfast', 'others'
];

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  type: 'info' | 'success' | 'error' | 'warning';
}

interface CustomAlertProps extends AlertConfig {}

// Add CustomAlert component at the top level
const CustomAlert: React.FC<CustomAlertProps> = ({ visible, title, message, buttons, type = 'info' }) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <MaterialIcons name="check-circle" size={24} color="#10B981" />;
      case 'error':
        return <MaterialIcons name="error" size={24} color="#BC4A4D" />;
      case 'warning':
        return <MaterialIcons name="warning" size={24} color="#F59E0B" />;
      default:
        return <MaterialIcons name="info" size={24} color="#3B82F6" />;
    }
  };

  const getBgColor = () => {
    return 'bg-white';
  };

  const getBorderColor = () => {
    return 'border-gray-200';
  };

  return (
      <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={() => buttons[0]?.onPress?.()}
      >
        <StyledView className="flex-1 justify-center items-center bg-black/50">
          <StyledView className={`w-[85%] rounded-2xl ${getBgColor()} ${getBorderColor()} border-2 shadow-xl`}>
            <StyledView className="p-6">
              <StyledView className="items-center mb-4">
                {getIcon()}
              </StyledView>
              <StyledText className="text-xl font-bold text-gray-800 text-center mb-2">
                {title}
              </StyledText>
              <StyledText className="text-base text-gray-600 text-center mb-6">
                {message}
              </StyledText>
              <StyledView className="flex-row justify-end space-x-3">
                {buttons.map((button, index) => (
                    <StyledTouchableOpacity
                        key={index}
                        className={`px-6 py-3 rounded-xl ${
                            button.style === 'cancel'
                                ? 'bg-gray-100'
                                : 'bg-[#BC4A4D]'
                        }`}
                        onPress={() => {
                          button.onPress?.();
                        }}
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

export default function ShopUpdate() {
  const { getAccessToken } = useAuthentication();
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({
    food: false,
    drinks: false,
    clothing: false,
    electronics: false,
    chicken: false,
    sisig: false,
    samgyupsal: false,
    'burger steak': false,
    pork: false,
    bbq: false,
    'street food': false,
    desserts: false,
    'milk tea': false,
    coffee: false,
    snacks: false,
    breakfast: false,
    others: false
  });
  const [acceptGCASH, setAcceptGCASH] = useState<boolean | null>(null);
  const [gcashName, setGcashName] = useState('');
  const [gcashNumber, setGcashNumber] = useState('');
  const [shopOpen, setShopOpen] = useState('');
  const [shopClose, setShopClose] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    type: 'info'
  });

  // Animation values
  const spinValue = useRef(new Animated.Value(0)).current;
  const circleValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start animation when component mounts
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
  }, []);

  useEffect(() => {
    fetchShopId();
  }, []);

  const fetchShopId = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setShopId(userId);
        fetchShopData(userId);
      }
    } catch (error) {
      console.error("Error fetching shop ID:", error);
      setIsLoading(false);
    }
  };

  const fetchShopData = async (id: string) => {
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        setIsLoading(false);
        return;
      }

      const config = { headers: { Authorization: token } };
      const response = await axios.get(`${API_URL}/api/shops/${id}`, config);

      const shop = response.data;
      setShopData(shop);

      setName(shop.name);
      setDescription(shop.desc || '');
      setAddress(shop.address);

      if (shop.googleLink) {
        setCoordinates(shop.googleLink);

        const coordsMatch = shop.googleLink.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
            shop.googleLink.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);

        if (coordsMatch && coordsMatch.length >= 3) {
          setLatitude(parseFloat(coordsMatch[1]));
          setLongitude(parseFloat(coordsMatch[2]));
        }
      }
      setDeliveryFee(shop.deliveryFee ? shop.deliveryFee.toString() : '0');
      setImage(shop.imageUrl || null);
      setAcceptGCASH(shop.acceptGCASH !== undefined ? shop.acceptGCASH : null);
      setGcashName(shop.gcashName || '');
      setGcashNumber(shop.gcashNumber || '');
      setShopOpen(shop.timeOpen || '');
      setShopClose(shop.timeClose || '');

      const initialCategories: Record<string, boolean> = {};
      Object.keys(selectedCategories).forEach((cat: string) => {
        initialCategories[cat] = false;
      });

      if (shop.categories && Array.isArray(shop.categories)) {
        shop.categories.forEach((category: string) => {
          initialCategories[category] = true;
        });
      }
      setSelectedCategories(initialCategories);

    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response && axiosError.response.status === 404) {
        console.log("Shop not found for this user - this is normal for new users");
      } else {
        console.error("Error fetching shop data:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const showAlert = (title: string, message: string, buttons: AlertButton[], type: AlertConfig['type'] = 'info') => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons: buttons.map(btn => ({
        ...btn,
        onPress: () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          btn.onPress?.();
        }
      })),
      type
    });
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        showAlert(
            "Permission Required",
            "You need to allow access to your photos to upload an image.",
            [{ text: "OK" }],
            "error"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
        setImageFile(result.assets[0]);
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const openGoogleMapsHelp = () => {
    Linking.openURL('https://support.google.com/maps/answer/9099064?hl=en&co=GENIE.Platform%3DAndroid');
  };

  const openLocationPicker = () => {
    showAlert(
        'Location Picker',
        'Please use the location picker buttons below.',
        [{ text: "OK" }],
        "info"
    );
  };

  const pinCurrentLocation = async () => {
    try {
      setIsSaving(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        showAlert(
            'Permission Denied',
            'Please grant location permissions to use this feature.',
            [{ text: "OK" }],
            "error"
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);

      const googleMapsLink = `https://www.google.com/maps?q=${location.coords.latitude},${location.coords.longitude}`;
      setCoordinates(googleMapsLink);

      showAlert(
          'Location Updated',
          'Your current location has been set.',
          [{ text: "OK" }],
          "success"
      );
    } catch (error) {
      console.error('Error getting location:', error);
      showAlert(
          'Error',
          'Failed to get your current location. Please try again.',
          [{ text: "OK" }],
          "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmLocation = () => {
    const lat = 10.3157;
    const lng = 123.8854;

    const coordinatesString = `https://www.google.com/maps?q=${lat},${lng}`;

    setCoordinates(coordinatesString);
    setLatitude(lat);
    setLongitude(lng);

    Alert.alert('Success', 'Your location has been set. You can now save your shop details.');
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showAlert("Error", "Shop name is required", [{ text: "OK" }], "error");
      return;
    }

    if (!address.trim()) {
      showAlert("Error", "Shop address is required", [{ text: "OK" }], "error");
      return;
    }

    if (isNaN(parseFloat(deliveryFee)) || parseFloat(deliveryFee) < 0) {
      showAlert("Error", "Please enter a valid delivery fee", [{ text: "OK" }], "error");
      return;
    }

    const categoriesArray = Object.keys(selectedCategories).filter(key => selectedCategories[key]);
    if (categoriesArray.length === 0) {
      showAlert("Error", "Please select at least one category", [{ text: "OK" }], "error");
      return;
    }

    if (!coordinates || !coordinates.includes('maps?q=') || !latitude || !longitude) {
      showAlert("Error", "Please set your shop location using the Pin Current Location button.", [{ text: "OK" }], "error");
      return;
    }

    if (acceptGCASH === null) {
      showAlert("Error", "Please select whether you accept GCASH payment.", [{ text: "OK" }], "error");
      return;
    }

    if (acceptGCASH === true) {
      if (!gcashName.trim()) {
        showAlert("Error", "Please provide a GCASH Name.", [{ text: "OK" }], "error");
        return;
      }
      if (!gcashNumber.startsWith('9') || gcashNumber.length !== 10) {
        showAlert("Error", "Please provide a valid GCASH Number.", [{ text: "OK" }], "error");
        return;
      }
    }

    if (shopOpen && shopClose) {
      if (shopOpen >= shopClose) {
        showAlert("Error", "Shop close time must be later than shop open time.", [{ text: "OK" }], "error");
        return;
      }
    }

    if (!image) {
      showAlert("Error", "Please upload a shop image.", [{ text: "OK" }], "error");
      return;
    }

    if (!description.trim()) {
      showAlert(
          "Warning",
          "You haven't provided a description. Are you sure you want to continue?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Continue", onPress: () => updateShop() }
          ],
          "warning"
      );
      return;
    }

    updateShop();
  };

  const updateShop = async () => {
    if (!shopId) {
      showAlert("Error", "Shop ID not found", [{ text: "OK" }], "error");
      return;
    }

    setIsSaving(true);

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        showAlert("Error", "Authentication failed", [{ text: "OK" }], "error");
        setIsSaving(false);
        return;
      }

      const config = { headers: { Authorization: token } };

      const categoriesArray = Object.keys(selectedCategories).filter(key => selectedCategories[key]);

      const formData = new FormData();

      const shopUpdateData = {
        name,
        desc: description,
        address,
        googleLink: coordinates,
        deliveryFee: parseFloat(deliveryFee),
        categories: categoriesArray,
        acceptGCASH,
        timeOpen: shopOpen,
        timeClose: shopClose,
        gcashName: acceptGCASH ? gcashName : '',
        gcashNumber: acceptGCASH ? gcashNumber : ''
      };

      formData.append('shop', JSON.stringify(shopUpdateData));
      formData.append('shopId', shopId);

      if (imageFile && image) {
        const uriParts = image.split('.') || [];
        const fileType = uriParts.length > 0 ? uriParts[uriParts.length - 1] : 'jpg';

        const imageObject: any = {
          uri: Platform.OS === 'ios' ? image.replace('file://', '') : image,
          name: `photo.${fileType}`,
          type: `image/${fileType}`
        };

        formData.append('image', imageObject);
      }

      const response = await axios.put(
          `${API_URL}/api/shops/shop-update/${shopId}`,
          formData,
          {
            ...config,
            headers: {
              ...config.headers,
              'Content-Type': 'multipart/form-data'
            }
          }
      );

      showAlert("Success", "Shop updated successfully", [{ text: "OK" }], "success");
      setTimeout(() => {
        router.push('/profile' as any);
      }, 1000);
    } catch (error) {
      console.error("Error updating shop:", error);

      const axiosError = error as AxiosError;
      if (axiosError.response) {
        if (axiosError.response.status === 400) {
          showAlert("Error", "Invalid shop data. Please check your inputs and try again.", [{ text: "OK" }], "error");
        } else if (axiosError.response.status === 401) {
          showAlert("Error", "Authentication failed. Please log in again.", [{ text: "OK" }], "error");
        } else if (axiosError.response.status === 413) {
          showAlert("Error", "Image file is too large. Please choose a smaller image.", [{ text: "OK" }], "error");
        } else {
          showAlert("Error", "Failed to update shop. Please try again later.", [{ text: "OK" }], "error");
        }
      } else if (axiosError.request) {
        showAlert("Error", "Network error. Please check your internet connection.", [{ text: "OK" }], "error");
      } else {
        showAlert("Error", "An unexpected error occurred. Please try again.", [{ text: "OK" }], "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const renderSection = (title: string, children: React.ReactNode, icon?: string) => (
      <StyledView className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <StyledView className="px-5 py-4 border-b border-gray-50">
          <StyledView className="flex-row items-center">
            {icon && <MaterialIcons name={icon as any} size={20} color="#BC4A4D" />}
            <StyledText className="text-lg font-bold text-gray-800 ml-2">{title}</StyledText>
          </StyledView>
        </StyledView>
        <StyledView className="p-5">
          {children}
        </StyledView>
      </StyledView>
  );

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
        <StyledView className="flex-1 bg-[#DFD6C5]">
          <StatusBar barStyle="dark-content" />
          <StyledView className="flex-1 justify-center items-center px-6">
            <StyledView 
              className="bg-white rounded-3xl p-8 items-center"
              style={{
                shadowColor: '#BC4A4D',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
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
              <StyledText className="text-lg font-bold mb-6">
                <StyledText className="text-[#BC4A4DFF]">Campus</StyledText>
                <StyledText className="text-[#DAA520]">Eats</StyledText>
              </StyledText>
              
              {/* Loading Text */}
              <StyledText className="text-[#BC4A4D] text-base font-semibold mb-2">Loading Shop Update...</StyledText>
              <StyledText className="text-gray-500 text-sm text-center max-w-[200px] leading-5">
                Please wait while we fetch your shop details
              </StyledText>
            </StyledView>
          </StyledView>
          <BottomNavigation activeTab="Profile" />
        </StyledView>
    );
  }

  return (
      <StyledView className="flex-1 bg-[#DFD6C5]">
        <StatusBar barStyle="dark-content" />
        <CustomAlert {...alertConfig} />

        <StyledView className="bg-gradient-to-r from-[#FFFAF1] to-[#F5F0E8] pt-12 pb-6 px-6 shadow-sm">
          <StyledView className="flex-row items-center justify-between mb-4">
            <StyledTouchableOpacity onPress={handleCancel} className="p-2 rounded-full bg-white shadow-sm">
              <MaterialIcons name="arrow-back" size={24} color="#BC4A4D" />
            </StyledTouchableOpacity>
            <StyledView className="flex-1 items-center">
              <StyledText className="text-2xl font-bold text-gray-800">Update Shop</StyledText>
            </StyledView>
            <StyledView className="w-10" />
          </StyledView>
          <StyledText className="text-base text-gray-600 text-center leading-6">
            Keep your shop information up to date for better customer experience
          </StyledText>
        </StyledView>

        <StyledScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          <StyledView className="py-4">

            {renderSection("Shop Image", (
                <StyledView>
                  <StyledTouchableOpacity
                      className="h-48 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden mb-3"
                      onPress={pickImage}
                  >
                    {image ? (
                        <StyledView className="relative h-full">
                          <StyledImage
                              source={{ uri: image || undefined } as ImageSourcePropType}
                              className="w-full h-full"
                              resizeMode="cover"
                          />
                          <StyledView className="absolute top-3 right-3 bg-black/50 rounded-full p-2">
                            <MaterialIcons name="edit" size={16} color="white" />
                          </StyledView>
                        </StyledView>
                    ) : (
                        <StyledView className="flex-1 justify-center items-center">
                          <StyledView className="bg-[#BC4A4D]/10 rounded-full p-4 mb-3">
                            <Ionicons name="camera" size={32} color="#BC4A4D" />
                          </StyledView>
                          <StyledText className="text-lg font-semibold text-gray-700 mb-1">Add Shop Photo</StyledText>
                          <StyledText className="text-sm text-gray-500 text-center">Tap to upload a photo of your shop</StyledText>
                        </StyledView>
                    )}
                  </StyledTouchableOpacity>
                  <StyledText className="text-xs text-gray-500 text-center">
                    Recommended: Square image (1:1 ratio) for best results
                  </StyledText>
                </StyledView>
            ), "store")}

            {renderSection("Basic Information", (
                <StyledView>
                  <StyledView className="mb-4">
                    <StyledText className="text-sm font-semibold text-gray-700 mb-2">Shop Name *</StyledText>
                    <StyledTextInput
                        className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-base font-medium"
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter your shop name"
                        placeholderTextColor="#9CA3AF"
                    />
                  </StyledView>

                  <StyledView className="mb-4">
                    <StyledText className="text-sm font-semibold text-gray-700 mb-2">Address *</StyledText>
                    <StyledTextInput
                        className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-base"
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Enter complete shop address"
                        placeholderTextColor="#9CA3AF"
                        multiline
                    />
                  </StyledView>

                  <StyledView>
                    <StyledText className="text-sm font-semibold text-gray-700 mb-2">Description</StyledText>
                    <StyledTextInput
                        className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-base min-h-[100px]"
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Tell customers about your shop..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                  </StyledView>
                </StyledView>
            ), "info")}

            {renderSection("Location", (
                <StyledView>
                  <StyledView className="flex-row items-center mb-3">
                    <StyledText className="text-sm font-semibold text-gray-700 flex-1">Set Your Location *</StyledText>
                    <StyledTouchableOpacity onPress={openGoogleMapsHelp} className="p-1">
                      <MaterialIcons name="help-outline" size={18} color="#BC4A4D" />
                    </StyledTouchableOpacity>
                  </StyledView>

                  {coordinates ? (
                      <StyledView className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                        <StyledView className="flex-row items-center mb-2">
                          <MaterialIcons name="location-on" size={20} color="#10B981" />
                          <StyledText className="text-sm font-semibold text-green-800 ml-2">Location Set</StyledText>
                        </StyledView>
                        <StyledText className="text-xs text-green-700 mb-3">{coordinates}</StyledText>
                        <StyledTouchableOpacity
                            className="bg-green-600 py-2 px-4 rounded-lg self-start"
                            onPress={() => Linking.openURL(coordinates)}
                        >
                          <StyledText className="text-white text-sm font-semibold">View on Map</StyledText>
                        </StyledTouchableOpacity>
                      </StyledView>
                  ) : (
                      <StyledView className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                        <StyledView className="flex-row items-center mb-2">
                          <MaterialIcons name="location-off" size={20} color="#F59E0B" />
                          <StyledText className="text-sm font-semibold text-orange-800 ml-2">Location Required</StyledText>
                        </StyledView>
                        <StyledText className="text-xs text-orange-700">Please set your shop location to continue</StyledText>
                      </StyledView>
                  )}

                  <StyledTouchableOpacity
                      className={`bg-[#BC4A4D] py-4 rounded-xl items-center justify-center ${isSaving ? 'opacity-70' : ''}`}
                      onPress={pinCurrentLocation}
                      disabled={isSaving}
                  >
                    <StyledView className="flex-row items-center">
                      {isSaving ? (
                          <ActivityIndicator color="#fff" size="small" />
                      ) : (
                          <>
                            <MaterialIcons name="my-location" size={20} color="white" />
                            <StyledText className="text-white font-bold text-base ml-2">Pin Current Location</StyledText>
                          </>
                      )}
                    </StyledView>
                  </StyledTouchableOpacity>
                </StyledView>
            ), "place")}

            {renderSection("Operating Hours", (
                <StyledView>
                  <StyledText className="text-sm text-gray-600 mb-4">Set your shop's operating hours (24-hour format)</StyledText>
                  <StyledView className="flex-row justify-between">
                    <StyledView className="flex-1 mr-3">
                      <StyledText className="text-sm font-semibold text-gray-700 mb-2">Opening Time</StyledText>
                      <StyledTextInput
                          className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-base text-center font-mono"
                          value={shopOpen}
                          onChangeText={setShopOpen}
                          placeholder="08:00"
                          placeholderTextColor="#9CA3AF"
                      />
                    </StyledView>
                    <StyledView className="flex-1 ml-3">
                      <StyledText className="text-sm font-semibold text-gray-700 mb-2">Closing Time</StyledText>
                      <StyledTextInput
                          className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-base text-center font-mono"
                          value={shopClose}
                          onChangeText={setShopClose}
                          placeholder="20:00"
                          placeholderTextColor="#9CA3AF"
                      />
                    </StyledView>
                  </StyledView>
                </StyledView>
            ), "schedule")}

            {renderSection("Delivery & Payment", (
                <StyledView>
                  <StyledView className="mb-6">
                    <StyledText className="text-sm font-semibold text-gray-700 mb-2">Delivery Fee (₱)</StyledText>
                    <StyledTextInput
                        className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-base"
                        value={deliveryFee}
                        onChangeText={setDeliveryFee}
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                    />
                  </StyledView>

                  <StyledView>
                    <StyledText className="text-sm font-semibold text-gray-700 mb-3">Accept GCASH Payment *</StyledText>
                    <StyledView className="flex-row bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                      <StyledTouchableOpacity
                          className={`flex-1 py-4 items-center ${acceptGCASH === true ? 'bg-[#BC4A4D]' : ''}`}
                          onPress={() => setAcceptGCASH(true)}
                      >
                        <StyledText className={`font-bold ${acceptGCASH === true ? 'text-white' : 'text-gray-600'}`}>
                          Yes
                        </StyledText>
                      </StyledTouchableOpacity>
                      <StyledTouchableOpacity
                          className={`flex-1 py-4 items-center ${acceptGCASH === false ? 'bg-[#BC4A4D]' : ''}`}
                          onPress={() => setAcceptGCASH(false)}
                      >
                        <StyledText className={`font-bold ${acceptGCASH === false ? 'text-white' : 'text-gray-600'}`}>
                          No
                        </StyledText>
                      </StyledTouchableOpacity>
                    </StyledView>
                  </StyledView>

                  {acceptGCASH === true && (
                      <StyledView className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <StyledText className="text-sm font-semibold text-blue-800 mb-4">GCASH Details</StyledText>
                        <StyledView className="mb-4">
                          <StyledText className="text-sm font-semibold text-gray-700 mb-2">GCASH Name *</StyledText>
                          <StyledTextInput
                              className="bg-white border border-gray-200 rounded-xl p-4 text-base"
                              value={gcashName}
                              onChangeText={setGcashName}
                              placeholder="Enter registered GCASH name"
                              placeholderTextColor="#9CA3AF"
                          />
                        </StyledView>
                        <StyledView>
                          <StyledText className="text-sm font-semibold text-gray-700 mb-2">GCASH Number *</StyledText>
                          <StyledView className="flex-row items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <StyledText className="px-4 py-4 text-base font-bold text-gray-800 bg-gray-50 border-r border-gray-200">+63</StyledText>
                            <StyledTextInput
                                className="flex-1 px-4 py-4 text-base"
                                value={gcashNumber}
                                onChangeText={setGcashNumber}
                                placeholder="9XXXXXXXXX"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="numeric"
                                maxLength={10}
                            />
                          </StyledView>
                        </StyledView>
                      </StyledView>
                  )}
                </StyledView>
            ), "payment")}

            {renderSection("Categories", (
                <StyledView>
                  <StyledText className="text-sm text-gray-600 mb-4">Select categories that best describe your shop *</StyledText>
                  <StyledView className="flex-row flex-wrap -mx-1">
                    {Object.keys(selectedCategories).map(category => (
                        <StyledTouchableOpacity
                            key={category}
                            className={`m-1 px-4 py-3 rounded-full border-2 ${
                                selectedCategories[category]
                                    ? 'bg-[#BC4A4D] border-[#BC4A4D]'
                                    : 'bg-white border-gray-200'
                            }`}
                            onPress={() => toggleCategory(category)}
                        >
                          <StyledText
                              className={`text-sm font-semibold ${
                                  selectedCategories[category] ? 'text-white' : 'text-gray-600'
                              }`}
                          >
                            {category}
                          </StyledText>
                        </StyledTouchableOpacity>
                    ))}
                  </StyledView>
                </StyledView>
            ), "category")}

            <StyledView className="flex-row justify-between mt-6 mb-20">
              <StyledTouchableOpacity
                  className="flex-1 bg-white py-4 rounded-xl mr-3 border-2 border-gray-200"
                  onPress={handleCancel}
              >
                <StyledText className="text-gray-600 text-base font-bold text-center">Cancel</StyledText>
              </StyledTouchableOpacity>
              <StyledTouchableOpacity
                  className={`flex-1 bg-[#BC4A4D] py-4 rounded-xl ml-3 ${isSaving ? 'opacity-70' : ''}`}
                  onPress={handleSubmit}
                  disabled={isSaving}
              >
                <StyledView className="flex-row items-center justify-center">
                  {isSaving ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                      <>
                        <MaterialIcons name="save" size={20} color="white" />
                        <StyledText className="text-white text-base font-bold ml-2">Save Changes</StyledText>
                      </>
                  )}
                </StyledView>
              </StyledTouchableOpacity>
            </StyledView>
          </StyledView>
        </StyledScrollView>
        <BottomNavigation activeTab="Profile" />
      </StyledView>
  );
}