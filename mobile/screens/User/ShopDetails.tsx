import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomNavigation from '../../components/BottomNavigation';
import LiveStreamViewer from '../../components/LiveStreamViewer';
import { API_URL } from '../../config';
import { AUTH_TOKEN_KEY, useAuthentication } from '../../services/authService';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledImage = styled(Image);

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  quantity?: number;
  availableQuantity?: number;
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
  showCancelButton?: boolean;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}


const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  type,
  onClose,
  showCancelButton = false,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
}) => {
  const getAlertColors = () => {
    switch (type) {
      case 'success':
        return {
          iconBg: '#E8F5E8',
          icon: '✓',
          iconColor: '#4CAF50',
          buttonBg: '#BC4A4D',
        };
      case 'error':
        return {
          iconBg: '#FFEBEE',
          icon: '✕',
          iconColor: '#F44336',
          buttonBg: '#BC4A4D',
        };
      case 'warning':
        return {
          iconBg: '#FFF3E0',
          icon: '⚠',
          iconColor: '#FF9800',
          buttonBg: '#BC4A4D',
        };
      default:
        return {
          iconBg: '#E3F2FD',
          icon: 'ℹ',
          iconColor: '#2196F3',
          buttonBg: '#BC4A4D',
        };
    }
  };

  const colors = getAlertColors();

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={alertStyles.overlay}>
        <View style={alertStyles.container}>
          <View
            style={[
              alertStyles.iconContainer,
              { backgroundColor: colors.iconBg },
            ]}
          >
            <Text style={[alertStyles.icon, { color: colors.iconColor }]}>
              {colors.icon}
            </Text>
          </View>

          <Text style={alertStyles.title}>{title}</Text>
          <Text style={alertStyles.message}>{message}</Text>

          <View style={alertStyles.buttonContainer}>
            {showCancelButton && (
              <TouchableOpacity
                style={[
                  alertStyles.button,
                  alertStyles.cancelButton,
                ]}
                onPress={onCancel || onClose}
              >
                <Text style={alertStyles.cancelButtonText}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                alertStyles.button,
                alertStyles.confirmButton,
                { backgroundColor: colors.buttonBg },
                !showCancelButton && alertStyles.singleButton,
              ]}
              onPress={onClose}
            >
              <Text style={alertStyles.confirmButtonText}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ShopDetails = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [availableQuantity, setAvailableQuantity] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [liveStreamModalVisible, setLiveStreamModalVisible] = useState(false);
  const [liveModalAnimation] = useState(new Animated.Value(0));
  const [isStreaming, setIsStreaming] = useState(false);

  // Animation values for loading state
  const spinValue = useRef(new Animated.Value(0)).current;
  const circleValue = useRef(new Animated.Value(0)).current;
  
  const viewLiveStream = () => {
    setLiveStreamModalVisible(true);
    // Animate modal content sliding up
    Animated.timing(liveModalAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeLiveStream = () => {
    // Animate modal content sliding down
    Animated.timing(liveModalAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setLiveStreamModalVisible(false);
    });
  };

  const [hasStreamUrl, setHasStreamUrl] = useState(false);
  const { getAccessToken } = useAuthentication();
  const [customAlertProps, setCustomAlertProps] = useState<CustomAlertProps>({
    visible: false,
    title: '',
    message: '',
    type: 'success',
    onClose: () => {},
    showCancelButton: false,
    onCancel: undefined,
    confirmText: 'OK',
    cancelText: 'Cancel',
  });

  // New bottom-sheet success modal state for Add-to-Cart
  const [addSuccessModalVisible, setAddSuccessModalVisible] = useState(false);

  const showCustomAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' = 'success',
    options?: {
      showCancelButton?: boolean;
      onCancel?: () => void;
      confirmText?: string;
      cancelText?: string;
    }
  ) => {
    setCustomAlertProps({
      visible: true,
      title,
      message,
      type,
      onClose: () => setCustomAlertProps(prev => ({ ...prev, visible: false })),
      showCancelButton: options?.showCancelButton || false,
      onCancel: options?.onCancel,
      confirmText: options?.confirmText || 'OK',
      cancelText: options?.cancelText || 'Cancel',
    });
  };

  useEffect(() => {
    fetchShopDetails();
    checkIfShopHasStream();

    // Animation setup for loading state
    const startAnimation = () => {
      // Logo spin animation
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ).start();

      // Circle line animation
      Animated.loop(
        Animated.timing(circleValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ).start();
    };

    startAnimation();
  }, [id]);

  // First, add a new state to track if streaming is active
  const checkIfShopHasStream = async () => {
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error('No token available');
        return;
      }

      const config = { headers: { Authorization: token } };
      let hasUrl = false;
      let activeStream = false;

      // Check if shop has a stream URL
      try {
        const urlResponse = await axios.get(`${API_URL}/api/shops/${id}/stream-url`, config);
        if (urlResponse.data && urlResponse.data.streamUrl) {
          hasUrl = true;
        }
      } catch (urlError) {
        // Check if this is a 404 error (no stream URL configured - expected case)
        if (urlError && typeof urlError === 'object' && 'response' in urlError && (urlError as any).response?.status === 404) {
          console.log('Shop does not have streaming configured (404)');
        } else {
          // For all other errors, log as error
          console.error('Error checking stream URL:', urlError);
        }
        hasUrl = false;
      }

      // If shop has a stream URL, check if streaming is active
      if (hasUrl) {
        try {
          const statusResponse = await axios.get(`${API_URL}/api/shops/${id}/streaming-status`, config);
          if (statusResponse.data && statusResponse.data.isStreaming === true) {
            // Set both flags when streaming is active
            activeStream = true;
          }
          console.log('Shop streaming status:', activeStream ? 'Active' : 'Inactive');
        } catch (statusError) {
          console.error('Error checking streaming status:', statusError);
        }
      }
      
      // Update both states
      setHasStreamUrl(hasUrl);
      setIsStreaming(activeStream);
    } catch (error) {
      console.error('Error in checkIfShopHasStream:', error);
      setHasStreamUrl(false);
      setIsStreaming(false);
    }
  };

  // Add a function to periodically check stream status
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (hasStreamUrl) {
      // Check streaming status every 30 seconds if we know the shop has streaming capability
      intervalId = setInterval(checkIfShopHasStream, 30000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [hasStreamUrl, id]);

  const fetchShopDetails = async () => {
    try {
      setIsLoading(true);
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error('No token available');
        showCustomAlert('Error', 'Authentication required. Please log in again.', 'error');
        return;
      }

      const config = { headers: { Authorization: token } };

      // Fetch shop info
      try {
        const shopResponse = await axios.get(`${API_URL}/api/shops/${id}`, config);
        setShopInfo(shopResponse.data);
      } catch (shopError) {
        if (axios.isAxiosError(shopError) && shopError.response?.status === 404) {
          showCustomAlert('Shop Not Found', 'This shop is currently unavailable or has been removed.', 'error');
          setTimeout(() => router.back(), 2000);
          return;
        } else {
          console.error('Error fetching shop info:', shopError);
          showCustomAlert('Error', 'Failed to load shop information. Please try again.', 'error');
          return;
        }
      }

      // Fetch shop items
      try {
        const itemsResponse = await axios.get(`${API_URL}/api/items/${id}/shop-items`, config);
        if (itemsResponse.data && Array.isArray(itemsResponse.data)) {
          setItems(itemsResponse.data);
        } else {
          setItems([]);
        }
      } catch (itemsError) {
        if (axios.isAxiosError(itemsError) && itemsError.response?.status === 404) {
          console.log('No items found for this shop - showing empty state');
          setItems([]);
        } else {
          console.error('Error fetching shop items:', itemsError);
          setItems([]);
          showCustomAlert('Notice', 'Unable to load menu items at the moment. Please try again later.', 'warning');
        }
      }
    } catch (error) {
      console.error('Unexpected error fetching shop details:', error);
      showCustomAlert('Error', 'Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (quantity === 0) {
      return;
    }

    setIsAddingToCart(true);

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error('No token available');
        setIsAddingToCart(false);
        return;
      }

      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error('No user ID found');
        setIsAddingToCart(false);
        return;
      }

      const config = { headers: { Authorization: token } };

      // First check if user has items in cart from a different shop
      try {
        const cartResponse = await axios.get(`${API_URL}/api/carts/cart`, {
          params: { uid: userId },
          headers: { Authorization: token },
        });

        if (cartResponse.data && cartResponse.data.shopId && cartResponse.data.shopId !== id) {
          showCustomAlert(
            'Cannot Add Item',
            'You already have items in your cart from a different shop. Please clear your cart first before adding items from this shop.',
            'warning'
          );
          setIsAddingToCart(false);
          return;
        }
      } catch (error) {
        // If cart not found (404), it's okay - we can proceed with adding items
        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          console.error('Error checking cart:', error);
          setIsAddingToCart(false);
          return;
        }
      }

      // Match the exact structure expected by the backend
      const payload = {
        uid: userId,
        shopId: id,
        item: {
          id: selectedItem?.id,
          name: selectedItem?.name,
          price: selectedItem?.price,
          quantity: selectedItem?.quantity,
          userQuantity: quantity,
        },
        totalPrice: selectedItem?.price ? selectedItem.price * quantity : 0,
      };

      console.log('Sending payload:', payload); // Debug log

      const response = await axios.post(`${API_URL}/api/carts/add-to-cart`, payload, config);

      if (response.status === 200) {
        // Show bottom-sheet success modal instead of the CustomAlert
        setAddSuccessModalVisible(true);
        setModalVisible(false);
        setQuantity(0);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || 'Failed to add item to cart';
        showCustomAlert('Error', errorMessage, 'error');
      } else {
        showCustomAlert('Error', 'Failed to add item to cart', 'error');
      }
    } finally {
      setIsAddingToCart(false);
    }
  };

  const openModal = async (item: Item) => {
    // Check if item is sold out
    if (!item.quantity || item.quantity === 0) {
      showCustomAlert(
        'Item Unavailable',
        `${item.name} is currently sold out. Please check back later or try other items.`,
        'warning'
      );
      return;
    }

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error('No token available');
        showCustomAlert('Error', 'Authentication required. Please log in again.', 'error');
        return;
      }

      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error('No user ID found');
        showCustomAlert('Error', 'User session expired. Please log in again.', 'error');
        return;
      }

      const config = { headers: { Authorization: token } };

      // Check cart for existing items
      try {
        const cartResponse = await axios.get(`${API_URL}/api/carts/cart`, {
          params: { uid: userId },
          headers: { Authorization: token },
        });

        if (cartResponse.data && cartResponse.data.items) {
          const existingItem = cartResponse.data.items.find((cartItem: any) => cartItem.id === item.id);
          if (existingItem) {
            const remainingQuantity = (item.quantity || 0) - existingItem.quantity;
            if (remainingQuantity <= 0) {
              showCustomAlert(
                'Item Unavailable',
                `You've already added all available ${item.name} to your cart.`,
                'warning'
              );
              return;
            }
            setAvailableQuantity(remainingQuantity);
          } else {
            setAvailableQuantity(item.quantity || 0);
          }
        } else {
          setAvailableQuantity(item.quantity || 0);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setAvailableQuantity(item.quantity || 0);
        } else {
          console.error('Error checking cart:', error);
          setAvailableQuantity(item.quantity || 0);
        }
      }

      setSelectedItem(item);
      setQuantity(0);
      setModalVisible(true);
    } catch (error) {
      console.error('Error opening modal:', error);
      showCustomAlert('Error', 'Failed to load item details. Please try again.', 'error');
    }
  };

  if (isLoading) {
    // Create interpolation for animations
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
        <StyledView className="flex-1 justify-center items-center">
          <StyledView className="items-center">
            {/* Spinning Logo Container */}
            <StyledView className="relative mb-6">
              {/* Outer rotating circle */}
              <Animated.View
                style={{
                  transform: [{ rotate: circleRotation }],
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 2,
                  borderColor: 'rgba(188, 74, 77, 0.2)',
                  borderTopColor: '#BC4A4D',
                  position: 'absolute',
                }}
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
                    style={{ resizeMode: 'contain' }}
                  />
                </Animated.View>
              </StyledView>
            </StyledView>
            
            {/* Brand Name */}
            <StyledText className="text-lg font-bold mb-4">
              <StyledText className="text-[#BC4A4D]">Campus</StyledText>
              <StyledText className="text-[#DAA520]">Eats</StyledText>
            </StyledText>
            
            {/* Loading Text */}
            <StyledText className="text-[#BC4A4D] text-base font-semibold">
              Loading shop details...
            </StyledText>
          </StyledView>
        </StyledView>
        <BottomNavigation activeTab="Home" />
      </StyledView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#DFD6C5]">
      <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
      <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Simple Hero Section */}
        {shopInfo && (
          <StyledView className="relative">
            <StyledImage
              source={{ uri: shopInfo.imageUrl }}
              className="w-full h-[200px]"
              resizeMode="cover"
            />

            {/* Back Button */}
            <StyledTouchableOpacity
              className="absolute top-8 left-4 w-12 h-12 bg-white rounded-full items-center justify-center"
              onPress={() => router.back()}
              style={{
                shadowColor: '#8B4513',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#8B4513" />
            </StyledTouchableOpacity>

            {/* Shop Info Card */}
            <StyledView
              className="bg-white mx-4 -mt-12 rounded-3xl p-6"
              style={{
                shadowColor: '#8B4513',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 20,
                elevation: 8,
              }}
            >
              <StyledView className="flex-row justify-between items-start mb-3">
                <StyledView className="flex-1">
                  <StyledText className="text-2xl font-black text-[#8B4513] mb-2">
                    {shopInfo.name}
                  </StyledText>
                  <StyledText className="text-[#8B4513]/70 text-sm leading-5">
                    {shopInfo.desc}
                  </StyledText>

                  {/* Dynamic livestream button that changes based on streaming status */}
                  {hasStreamUrl && (
                    <StyledView className="mt-4">
                      <StyledTouchableOpacity
                        className={`px-5 py-3 rounded-2xl flex-row items-center justify-center ${
                          isStreaming ? 'bg-[#BC4A4D]' : 'bg-[#8B4513]/40'
                        }`}
                        style={isStreaming ? {
                          shadowColor: "#BC4A4D",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 6,
                        } : {}}
                        onPress={isStreaming ? viewLiveStream : () => 
                          showCustomAlert(
                            'Stream Not Available', 
                            'This shop is not currently streaming. Please check back later.',
                            'warning'
                          )
                        }
                      >
                        <Ionicons 
                          name={isStreaming ? "play-circle" : "videocam-off"} 
                          size={18} 
                          color="#fff" 
                          style={{ marginRight: 8 }} 
                        />
                        <StyledText className="text-white font-bold text-sm">
                          {isStreaming ? "Watch Live Feed" : "Stream Offline"}
                        </StyledText>
                      </StyledTouchableOpacity>
                    </StyledView>
                  )}
                </StyledView>

                {shopInfo.averageRating && (
                  <StyledView className="bg-[#DAA520] px-4 py-2 rounded-2xl ml-3" style={{
                    shadowColor: "#DAA520",
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 4,
                  }}>
                    <StyledText className="text-white text-base font-bold">
                      ★ {shopInfo.averageRating}
                    </StyledText>
                  </StyledView>
                )}
              </StyledView>
            </StyledView>
          </StyledView>
        )}

        {/* Enhanced Menu Grid */}
        <StyledView className="px-4 pt-6 pb-16">
          <StyledText className="text-xl font-black text-[#8B4513] mb-6">
            Menu
          </StyledText>

          {items.length === 0 ? (
            /* Empty State for No Items */
            <StyledView className="items-center justify-center py-12">
              <StyledView 
                className="bg-white rounded-3xl p-8 items-center mx-4 w-full"
                style={{
                  shadowColor: '#8B4513',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <StyledView className="w-20 h-20 bg-[#DFD6C5]/30 rounded-full items-center justify-center mb-4">
                  <StyledText className="text-4xl">🍽️</StyledText>
                </StyledView>
                <StyledText className="text-xl font-bold text-[#8B4513] mb-3 text-center">
                  No Items Available
                </StyledText>
                <StyledText className="text-[#8B4513]/60 text-center text-base leading-6 mb-4">
                  This shop currently has no menu items available. Please check back later or contact the shop directly.
                </StyledText>
                <StyledView className="bg-[#BC4A4D]/10 px-4 py-2 rounded-xl">
                  <StyledText className="text-[#BC4A4D] text-sm font-semibold text-center">
                    Items may be sold out or temporarily unavailable
                  </StyledText>
                </StyledView>
              </StyledView>
            </StyledView>
          ) : (
            <StyledView className="flex-row flex-wrap justify-between">
              {items.map((item) => (
                <StyledTouchableOpacity
                  key={item.id}
                  className="w-[48%] bg-white rounded-2xl mb-5 overflow-hidden"
                  onPress={() => openModal(item)}
                  activeOpacity={0.9}
                  style={{
                    shadowColor: '#8B4513',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.12,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  <StyledView className="relative">
                    <StyledImage
                      source={{ uri: item.imageUrl }}
                      className="w-full h-28"
                      resizeMode="cover"
                    />
                    <StyledView className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    
                    {/* Sold Out Overlay */}
                    {(!item.quantity || item.quantity === 0) && (
                      <StyledView className="absolute inset-0 bg-black/60 items-center justify-center">
                        <StyledView className="bg-[#BC4A4D] px-3 py-1 rounded-xl">
                          <StyledText className="text-white text-xs font-bold">
                            SOLD OUT
                          </StyledText>
                        </StyledView>
                      </StyledView>
                    )}
                  </StyledView>

                  <StyledView className="p-4">
                    <StyledText
                      className={`text-base font-bold mb-1 ${
                        (!item.quantity || item.quantity === 0) ? 'text-[#8B4513]/50' : 'text-[#8B4513]'
                      }`}
                      numberOfLines={1}
                    >
                      {item.name}
                    </StyledText>
                    <StyledText
                      className={`text-xs mb-3 leading-4 ${
                        (!item.quantity || item.quantity === 0) ? 'text-[#8B4513]/40' : 'text-[#8B4513]/60'
                      }`}
                      numberOfLines={2}
                    >
                      {item.description}
                    </StyledText>
                    <StyledView className="flex-row justify-between items-center">
                      <StyledText className={`text-lg font-black ${
                        (!item.quantity || item.quantity === 0) ? 'text-[#BC4A4D]/50' : 'text-[#BC4A4D]'
                      }`}>
                        ₱{item.price.toFixed(2)}
                      </StyledText>
                      <StyledView className={`px-2 py-1 rounded-full ${
                        (!item.quantity || item.quantity === 0) 
                          ? 'bg-[#BC4A4D]/20' 
                          : 'bg-[#DAA520]/20'
                      }`}>
                        <StyledText className={`text-xs font-semibold ${
                          (!item.quantity || item.quantity === 0)
                            ? 'text-[#BC4A4D]'
                            : 'text-[#DAA520]'
                        }`}>
                          {(!item.quantity || item.quantity === 0) ? 'Sold out' : `${item.quantity} left`}
                        </StyledText>
                      </StyledView>
                    </StyledView>
                  </StyledView>
                </StyledTouchableOpacity>
              ))}
            </StyledView>
          )}
        </StyledView>

        {/* Live Stream Modal */}
        <Modal
          animationType="none"
          transparent={true}
          visible={liveStreamModalVisible}
          onRequestClose={closeLiveStream}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center', // Center vertically
            alignItems: 'center',     // Center horizontally
          }}>
            <Animated.View style={{
              backgroundColor: '#FFFFFF',
              height: '50%',         // 50% height (with 25% margin top and bottom)
              width: '90%',          // 90% width for better aesthetics
              borderRadius: 20,      // Rounded corners all around
              marginTop: '25%',      // 25% margin from the top
              marginBottom: '25%',   // 25% margin from the bottom
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5,
              overflow: 'hidden',
              transform: [{
                translateY: liveModalAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0], // Slide up 300px
                }),
              }],
            }}>
              {liveStreamModalVisible && (
                <LiveStreamViewer
                  shopId={id}
                  shopName={shopInfo?.name}
                  onClose={closeLiveStream}
                />
              )}
            </Animated.View>
          </View>
        </Modal>

        {/* Enhanced Add to Cart Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <StyledView className="flex-1 bg-black/60 justify-end">
            <StyledView
              className="bg-[#DFD6C5] rounded-t-3xl p-6"
              style={{
                shadowColor: '#8B4513',
                shadowOffset: { width: 0, height: -8 },
                shadowOpacity: 0.2,
                shadowRadius: 24,
                elevation: 20,
                minHeight: '50%',
              }}
            >
              {selectedItem && (
                <>
                  {/* Enhanced Header */}
                  <StyledView className="flex-row justify-between items-center mb-6">
                    <StyledView className="flex-1">
                      <StyledText className="text-2xl font-black text-[#8B4513] mb-1">
                        {selectedItem.name}
                      </StyledText>
                      <StyledText className="text-[#8B4513]/60 text-sm">
                        Customize your order
                      </StyledText>
                    </StyledView>
                    <StyledTouchableOpacity
                      className="w-10 h-10 bg-white rounded-full items-center justify-center"
                      style={{
                        shadowColor: '#8B4513',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                      onPress={() => {
                        setModalVisible(false);
                        setQuantity(0);
                        setSelectedItem(null);
                        setAvailableQuantity(0);
                      }}
                    >
                      <Ionicons name="close" size={20} color="#8B4513" />
                    </StyledTouchableOpacity>
                  </StyledView>

                  {/* Enhanced Image Card */}
                  <StyledView className="bg-white rounded-2xl p-4 mb-6" style={{
                    shadowColor: '#8B4513',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 6,
                  }}>
                    <StyledImage
                      source={{ uri: selectedItem.imageUrl }}
                      className="w-full h-40 rounded-xl mb-4"
                      resizeMode="cover"
                    />
                    <StyledText className="text-[#8B4513]/70 text-sm leading-5">
                      {selectedItem.description}
                    </StyledText>
                  </StyledView>

                  {/* Enhanced Price & Availability */}
                  <StyledView className="bg-white rounded-2xl p-5 mb-6" style={{
                    shadowColor: '#8B4513',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 6,
                  }}>
                    <StyledView className="flex-row justify-between items-center">
                      <StyledView>
                        <StyledText className="text-[#8B4513]/60 text-sm mb-1">Price per item</StyledText>
                        <StyledText className="text-3xl font-black text-[#BC4A4D]">
                          ₱{selectedItem.price.toFixed(2)}
                        </StyledText>
                      </StyledView>
                      <StyledView className="bg-[#DAA520]/20 px-4 py-2 rounded-xl">
                        <StyledText className="text-[#DAA520] text-sm font-bold text-center">
                          {availableQuantity} available
                        </StyledText>
                      </StyledView>
                    </StyledView>
                  </StyledView>

                  {/* Enhanced Quantity Selector */}
                  <StyledView className="bg-white rounded-2xl p-6 mb-6" style={{
                    shadowColor: '#8B4513',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 6,
                  }}>
                    <StyledText className="text-[#8B4513] text-lg font-bold mb-4 text-center">
                      Select Quantity
                    </StyledText>
                    <StyledView className="flex-row items-center justify-center">
                      <StyledTouchableOpacity
                        className={`w-14 h-14 rounded-2xl items-center justify-center ${
                          quantity === 0 ? 'bg-[#DFD6C5]/50' : 'bg-[#BC4A4D]'
                        }`}
                        style={quantity > 0 ? {
                          shadowColor: '#BC4A4D',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.3,
                          shadowRadius: 6,
                          elevation: 4,
                        } : {}}
                        onPress={() => {
                          if (quantity > 0) {
                            setQuantity(quantity - 1);
                            setAvailableQuantity(availableQuantity + 1);
                          }
                        }}
                      >
                        <Ionicons 
                          name="remove" 
                          size={24} 
                          color={quantity === 0 ? '#8B4513' : 'white'} 
                        />
                      </StyledTouchableOpacity>

                      <StyledView className="bg-[#DFD6C5]/30 px-8 py-4 rounded-2xl mx-6 min-w-[80px]">
                        <StyledText className="text-3xl font-black text-[#8B4513] text-center">
                          {quantity}
                        </StyledText>
                      </StyledView>

                      <StyledTouchableOpacity
                        className={`w-14 h-14 rounded-2xl items-center justify-center ${
                          availableQuantity === 0 ? 'bg-[#DFD6C5]/50' : 'bg-[#DAA520]'
                        }`}
                        style={availableQuantity > 0 ? {
                          shadowColor: '#DAA520',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.3,
                          shadowRadius: 6,
                          elevation: 4,
                        } : {}}
                        onPress={() => {
                          if (availableQuantity > 0) {
                            setQuantity(quantity + 1);
                            setAvailableQuantity(availableQuantity - 1);
                          }
                        }}
                        disabled={availableQuantity === 0}
                      >
                        <Ionicons 
                          name="add" 
                          size={24} 
                          color={availableQuantity === 0 ? '#8B4513' : 'white'} 
                        />
                      </StyledTouchableOpacity>
                    </StyledView>
                  </StyledView>

                  {/* Enhanced Add to Cart Button */}
                  <StyledView className="space-y-4">
                    {quantity > 0 && (
                      <StyledView className="bg-white rounded-2xl p-4" style={{
                        shadowColor: '#8B4513',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 12,
                        elevation: 6,
                      }}>
                        <StyledView className="flex-row justify-between items-center">
                          <StyledText className="text-[#8B4513]/70 text-sm">Order Total</StyledText>
                          <StyledText className="text-2xl font-black text-[#BC4A4D]">
                            ₱{(selectedItem.price * quantity).toFixed(2)}
                          </StyledText>
                        </StyledView>
                        <StyledView className="flex-row justify-between items-center mt-2">
                          <StyledText className="text-[#8B4513]/70 text-xs">
                            {quantity} × ₱{selectedItem.price.toFixed(2)}
                          </StyledText>
                          <StyledText className="text-[#DAA520] text-xs font-semibold">
                            Ready to add!
                          </StyledText>
                        </StyledView>
                      </StyledView>
                    )}
                    
                    <StyledTouchableOpacity
                      className={`w-full py-5 rounded-2xl items-center ${
                        quantity === 0 ? 'bg-[#DFD6C5]/50' : 'bg-[#BC4A4D]'
                      }`}
                      style={quantity > 0 ? {
                        shadowColor: '#BC4A4D',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.4,
                        shadowRadius: 12,
                        elevation: 8,
                      } : {}}
                      onPress={handleAddToCart}
                      disabled={quantity === 0 || isAddingToCart}
                    >
                      {isAddingToCart ? (
                        <StyledView className="flex-row items-center">
                          <ActivityIndicator size="small" color="white" />
                          <StyledText className="text-white text-lg font-bold ml-3">
                            Adding to Cart...
                          </StyledText>
                        </StyledView>
                      ) : (
                        <StyledView className="flex-row items-center">
                          <Ionicons 
                            name={quantity === 0 ? "basket-outline" : "basket"} 
                            size={20} 
                            color={quantity === 0 ? '#8B4513' : 'white'} 
                          />
                          <StyledText
                            className={`text-lg font-bold ml-3 ${
                              quantity === 0 ? 'text-[#8B4513]' : 'text-white'
                            }`}
                          >
                            {quantity === 0 ? 'Select Quantity First' : 'Add to Cart'}
                          </StyledText>
                        </StyledView>
                      )}
                    </StyledTouchableOpacity>
                  </StyledView>
                </>
              )}
            </StyledView>
          </StyledView>
        </Modal>

        {/* Custom Alert */}
        <CustomAlert
          visible={customAlertProps.visible}
          title={customAlertProps.title}
          message={customAlertProps.message}
          type={customAlertProps.type}
          onClose={() => setCustomAlertProps({ ...customAlertProps, visible: false })}
          showCancelButton={customAlertProps.showCancelButton}
          onCancel={customAlertProps.onCancel}
          confirmText={customAlertProps.confirmText}
          cancelText={customAlertProps.cancelText}
        />

          {/* Bottom-sheet success modal for Add to Cart */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={addSuccessModalVisible}
            onRequestClose={() => setAddSuccessModalVisible(false)}
          >
            <StyledView className="flex-1 justify-end bg-black/40">
              <StyledView className="bg-white rounded-t-3xl p-6">
                <StyledView className="items-center mb-4">
                  <StyledView className="w-16 h-16 rounded-full bg-[#EAF6F6] items-center justify-center mb-3">
                    <Ionicons name="checkmark-done" size={28} color="#BC4A4D" />
                  </StyledView>
                  <StyledText className="text-2xl font-black text-[#8B4513] mb-1">Added to cart</StyledText>
                  <StyledText className="text-[#8B4513]/70 text-sm text-center">Your item was added to the cart successfully.</StyledText>
                </StyledView>

                <StyledView className="space-y-3">
                  <StyledTouchableOpacity
                    className="w-full py-4 rounded-2xl items-center bg-[#BC4A4D]"
                    onPress={() => {
                      setAddSuccessModalVisible(false);
                      // Keep shopping - simply close modal
                    }}
                  >
                    <StyledText className="text-white font-bold text-lg">Continue Shopping</StyledText>
                  </StyledTouchableOpacity>

                  <StyledTouchableOpacity
                    className="w-full py-4 rounded-2xl items-center bg-white"
                    style={{ borderWidth: 1, borderColor: 'rgba(139,69,19,0.08)' }}
                    onPress={() => {
                      setAddSuccessModalVisible(false);
                      router.push('/cart');
                    }}
                  >
                    <StyledText className="text-[#8B4513] font-bold text-lg">View Cart</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>
              </StyledView>
            </StyledView>
          </Modal>
      </StyledScrollView>
      <BottomNavigation activeTab="Home" />
    </SafeAreaView>
  );
}

export default ShopDetails;

const { width, height } = Dimensions.get('window');

const alertStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  container: {
    backgroundColor: '#FFFAF1',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#8B4513',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: '#8B4513',
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleButton: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  confirmButton: {
    backgroundColor: '#BC4A4D',
    shadowColor: '#BC4A4D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  cancelButtonText: {
    color: '#8B4513',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmButtonText: {
    color: '#FFFAF1',
    fontWeight: '700',
    fontSize: 14,
  },
});