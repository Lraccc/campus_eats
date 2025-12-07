import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, DeviceEventEmitter, Dimensions, Image, Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomNavigation from '../../components/BottomNavigation';
import { API_URL } from '../../config';
import { AUTH_TOKEN_KEY, useAuthentication } from '../../services/authService';

const LOCAL_CARTS_KEY = '@local_carts';

// Helper: check if shop is open
function isShopOpen(timeOpen: string, timeClose: string): boolean {
  if (!timeOpen || !timeClose) return true;
  // Assume format HH:mm (24h)
  const now = new Date();
  const [openH, openM] = timeOpen.split(":").map(Number);
  const [closeH, closeM] = timeClose.split(":").map(Number);
  const open = new Date(now);
  open.setHours(openH, openM, 0, 0);
  const close = new Date(now);
  close.setHours(closeH, closeM, 0, 0);
  if (close <= open) close.setDate(close.getDate() + 1); // handle overnight
  return now >= open && now < close;
}

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledImage = styled(Image);
const StyledTextInput = styled(TextInput);

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  quantity?: number;
  availableQuantity?: number;
  addOns?: Array<{ name: string; price: number }>;
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
  // Customer drink selections
  const [selectedSize, setSelectedSize] = useState<'regular' | 'medium' | 'large'>('regular');
  const [selectedTemp, setSelectedTemp] = useState<'cold' | 'hot'>('cold');
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, boolean>>({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Animation values for loading state
  const spinValue = useRef(new Animated.Value(0)).current;
  const circleValue = useRef(new Animated.Value(0)).current;
  
  const viewLiveStream = () => {
    // Navigate to separate livestream viewer screen
    console.log('📺 [ShopDetails] Navigating to livestream with:', {
      shopId: id,
      shopName: shopInfo?.name || 'Shop'
    });
    
    try {
      router.push({
        pathname: '/view-livestream',
        params: {
          shopId: String(id),
          shopName: String(shopInfo?.name || 'Shop')
        }
      });
    } catch (error) {
      console.error('❌ [ShopDetails] Navigation error:', error);
      showCustomAlert(
        'Navigation Error',
        'Failed to open livestream. Please try again.',
        'error'
      );
    }
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

    // Set up WebSocket listener for streaming status changes
    const streamingStatusListener = DeviceEventEmitter.addListener(
      'streamingStatusUpdate',
      (data: any) => {
        console.log('Received streaming status update:', data);
        // Check if this update is for the current shop
        if (data.shopId && String(data.shopId) === String(id)) {
          console.log('Updating streaming status for shop:', id, 'isStreaming:', data.isStreaming);
          setIsStreaming(data.isStreaming === true);
          if (data.hasStreamUrl !== undefined) {
            setHasStreamUrl(data.hasStreamUrl);
          }
        }
      }
    );

    // Initial check and periodic fallback (every 60 seconds as backup)
    // WebSocket provides real-time updates, this is just a safety net
    const streamCheckInterval = setInterval(() => {
      checkIfShopHasStream();
    }, 60000);

    return () => {
      streamingStatusListener.remove();
      clearInterval(streamCheckInterval);
    };
  }, [id]);

  // Check if shop has stream and if streaming is active
  const checkIfShopHasStream = async () => {
    try {
      // Reduced logging to prevent console spam
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error('❌ [ShopDetails] No token available');
        return;
      }

      const config = { headers: { Authorization: token } };
      let hasUrl = false;
      let activeStream = false;

      // Check if shop has a stream URL (optional - not required for streaming to work)
      try {
        console.log('📡 [ShopDetails] Checking stream URL...');
        const urlResponse = await axios.get(`${API_URL}/api/shops/${id}/stream-url`, config);
        if (urlResponse.data && urlResponse.data.streamUrl) {
          hasUrl = true;
          console.log('✅ [ShopDetails] Shop has stream URL configured');
        }
      } catch (urlError) {
        // Check if this is a 404 error (no stream URL configured - this is OK!)
        if (urlError && typeof urlError === 'object' && 'response' in urlError && (urlError as any).response?.status === 404) {
          hasUrl = false;
          // Don't log 404s - this is normal when shop isn't streaming
        } else {
          // For all other errors, log as error
          console.error('❌ [ShopDetails] Error checking stream URL:', urlError);
          hasUrl = false;
        }
      }

      // ALWAYS check if streaming is active, regardless of whether a URL is stored
      // The broadcaster might be streaming even without a saved stream URL
      try {
        const statusResponse = await axios.get(`${API_URL}/api/shops/${id}/streaming-status`, config);
        if (statusResponse.data && statusResponse.data.isStreaming === true) {
          activeStream = true;
          hasUrl = true; // If streaming is active, treat as having stream capability
          console.log('🎥 [ShopDetails] Stream is ACTIVE!');
        }
        // Don't log when stream is inactive to reduce console spam
      } catch (statusError) {
        // If error checking status, assume not streaming
        // Only log non-404 errors
        if ((statusError as any).response?.status !== 404) {
          console.error('❌ [ShopDetails] Error checking streaming status:', statusError);
        }
        activeStream = false;
      }
      
      // Update both states (only log when actually streaming)
      if (activeStream) {
        console.log('📝 [ShopDetails] Stream active - updating states');
      }
      setHasStreamUrl(hasUrl);
      setIsStreaming(activeStream);
    } catch (error) {
      console.error('❌ [ShopDetails] Error in checkIfShopHasStream:', error);
      setHasStreamUrl(false);
      setIsStreaming(false);
    }
  };

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
      // Optional: fetch existing carts to help with availability checks, but do not block adding
      try {
        await axios.get(`${API_URL}/api/carts/cart`, {
          params: { uid: userId },
          headers: { Authorization: token },
        });
        // We intentionally do NOT block adding items from other shops here.
        // Backend is expected to support separate carts per shop or handle the new cart creation.
      } catch (error) {
        // If cart not found (404), it's fine. For other errors, log and proceed.
        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          console.error('Error checking cart (non-blocking):', error);
        }
      }

      const basePrice = selectedItem?.price || 0;
      
      // Calculate add-ons total
      let addOnsTotal = 0;
      const selectedAddOnsList: Array<{ name: string; price: number }> = [];
      if (selectedItem?.addOns) {
        selectedItem.addOns.forEach((addOn) => {
          if (selectedAddOns[addOn.name]) {
            addOnsTotal += addOn.price;
            selectedAddOnsList.push(addOn);
          }
        });
      }

      const itemPriceWithAddOns = basePrice + addOnsTotal;
      const totalPrice = itemPriceWithAddOns * quantity;

      // Match the exact structure expected by the backend
      const payload: any = {
        uid: userId,
        shopId: id,
        item: {
          id: selectedItem?.id,
          name: selectedItem?.name,
          price: basePrice,
          quantity: selectedItem?.quantity,
          userQuantity: quantity,
        },
        totalPrice: totalPrice,
      };

      // Add selected add-ons if any
      if (selectedAddOnsList.length > 0) {
        payload.item.selectedAddOns = selectedAddOnsList;
      }

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

      // If backend fails (5xx), fallback to storing the cart locally per-shop so preview and shop-cart view show it
      const isServerError = axios.isAxiosError(error) && error.response && error.response.status >= 500;
      if (isServerError) {
        try {
          // Read existing local carts
          const raw = await AsyncStorage.getItem(LOCAL_CARTS_KEY)
          const localCarts = raw ? JSON.parse(raw) : {}

          const shopCart = localCarts[id] || { id: `local-${Date.now()}`, shopId: id, items: [], totalPrice: 0 }

          const localBasePrice = selectedItem?.price || 0;
          
          // Calculate add-ons total for local storage
          let localAddOnsTotal = 0;
          const localSelectedAddOns: Array<{ name: string; price: number }> = [];
          if (selectedItem?.addOns) {
            selectedItem.addOns.forEach((addOn) => {
              if (selectedAddOns[addOn.name]) {
                localAddOnsTotal += addOn.price;
                localSelectedAddOns.push(addOn);
              }
            });
          }

          const itemPriceWithAddOns = localBasePrice + localAddOnsTotal;

          // Build cart item to store (use same shape as backend cart item)
          const cartItem: any = {
            itemId: selectedItem?.id || selectedItem?.id,
            id: selectedItem?.id,
            name: selectedItem?.name,
            price: itemPriceWithAddOns,
            quantity: quantity,
            imageUrl: selectedItem?.imageUrl || selectedItem?.imageUrl || undefined,
          };

          // Add add-ons if present
          if (localSelectedAddOns.length > 0) {
            cartItem.selectedAddOns = localSelectedAddOns;
          }

          // If item exists, increment quantity
          const existingIdx = shopCart.items.findIndex((it: any) => String(it.itemId || it.id) === String(cartItem.itemId || cartItem.id))
          if (existingIdx >= 0) {
            shopCart.items[existingIdx].quantity += quantity
          } else {
            shopCart.items.push(cartItem)
          }

          shopCart.totalPrice = (shopCart.totalPrice || 0) + itemPriceWithAddOns * quantity

          localCarts[id] = shopCart
          await AsyncStorage.setItem(LOCAL_CARTS_KEY, JSON.stringify(localCarts))

          // Show success modal and clear modal
          setAddSuccessModalVisible(true)
          setModalVisible(false)
          setQuantity(0)
          setSelectedItem(null)
          return
        } catch (storeError) {
          console.error('Failed to save local cart fallback:', storeError)
          showCustomAlert('Error', 'Failed to add item to cart', 'error')
          return
        }
      }

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

        // Support both array-of-carts and single-cart responses by selecting the cart for this shop
        let shopCart: any = null;
        const data = cartResponse.data;
        if (Array.isArray(data)) {
          shopCart = data.find((c) => String(c.shopId) === String(id));
        } else if (data && data.shopId && String(data.shopId) === String(id)) {
          shopCart = data;
        }

        if (shopCart && shopCart.items) {
          const existingItem = shopCart.items.find((cartItem: any) => cartItem.id === item.id || cartItem.itemId === item.id);
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
            setAvailableQuantity(remainingQuantity - 1);
          } else {
            setAvailableQuantity((item.quantity || 0) - 1);
          }
        } else {
          setAvailableQuantity((item.quantity || 0) - 1);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setAvailableQuantity((item.quantity || 0) - 1);
        } else {
          console.error('Error checking cart:', error);
          setAvailableQuantity((item.quantity || 0) - 1);
        }
      }

      setSelectedItem(item);
      setQuantity(1);
      setSelectedAddOns({});
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
                  <StyledText className="text-[#8B4513]/70 text-sm leading-5 mb-1">
                    {shopInfo.desc}
                  </StyledText>
                  {/* Shop open/close times and open/closed status */}
                  {shopInfo.timeOpen && shopInfo.timeClose && (
                    <StyledView className="mb-1">
                      <StyledText className="text-[#BC4A4D] text-xs font-semibold">
                        Hours: {shopInfo.timeOpen} - {shopInfo.timeClose}
                      </StyledText>
                      {!isShopOpen(shopInfo.timeOpen, shopInfo.timeClose) && (
                        <StyledText className="text-[#BC4A4D] text-xs font-bold mt-1">
                          Closed - Opens at {shopInfo.timeOpen}
                        </StyledText>
                      )}
                    </StyledView>
                  )}

                  {/* Dynamic livestream button that changes based on streaming status */}
                  <StyledView className="mt-4 space-y-2">
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
                      activeOpacity={0.7}
                      onPress={() => {
                        console.log('🎬 [ShopDetails] Live stream button pressed! isStreaming:', isStreaming);
                        if (isStreaming) {
                          console.log('▶️ [ShopDetails] Calling viewLiveStream...');
                          viewLiveStream();
                        } else {
                          console.log('⏸️ [ShopDetails] Stream not active, showing alert');
                          showCustomAlert(
                            'Stream Not Available', 
                            'This shop is not currently streaming. Please check back later.',
                            'warning'
                          );
                        }
                      }}
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
                    
                    {/* Refresh stream status button - helpful for debugging */}
                    {!isStreaming && hasStreamUrl && (
                      <StyledTouchableOpacity
                        className="px-3 py-2 rounded-xl flex-row items-center justify-center bg-[#8B4513]/20"
                        activeOpacity={0.7}
                        onPress={() => {
                          console.log('🔄 [ShopDetails] Manually refreshing stream status...');
                          checkIfShopHasStream();
                        }}
                      >
                        <Ionicons 
                          name="refresh" 
                          size={14} 
                          color="#8B4513" 
                          style={{ marginRight: 6 }} 
                        />
                        <StyledText className="text-[#8B4513] font-semibold text-xs">
                          Check if stream started
                        </StyledText>
                      </StyledTouchableOpacity>
                    )}
                  </StyledView>
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

          {/* If shop is closed, show closed message and disable menu */}
          {shopInfo.timeOpen && shopInfo.timeClose && !isShopOpen(shopInfo.timeOpen, shopInfo.timeClose) ? (
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
                  <StyledText className="text-4xl">⏰</StyledText>
                </StyledView>
                <StyledText className="text-xl font-bold text-[#8B4513] mb-3 text-center">
                  Shop is currently closed
                </StyledText>
                <StyledText className="text-[#8B4513]/60 text-center text-base leading-6 mb-4">
                  This shop is closed now. It will open at {shopInfo.timeOpen}.
                </StyledText>
                <StyledView className="bg-[#BC4A4D]/10 px-4 py-2 rounded-xl">
                  <StyledText className="text-[#BC4A4D] text-sm font-semibold text-center">
                    Please come back during open hours!
                  </StyledText>
                </StyledView>
              </StyledView>
            </StyledView>
          ) : items.length === 0 ? (
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
              {items.map((item) => {
                const isSoldOut = !item.quantity || item.quantity === 0;
                
                return (
                  <StyledTouchableOpacity
                    key={item.id}
                    className="w-[48%] bg-white rounded-2xl mb-5 overflow-hidden"
                    onPress={() => {
                      if (!isSoldOut) {
                        openModal(item);
                      }
                    }}
                    activeOpacity={isSoldOut ? 1 : 0.9}
                    disabled={isSoldOut}
                    style={{
                      shadowColor: '#8B4513',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: isSoldOut ? 0.06 : 0.12,
                      shadowRadius: 12,
                      elevation: isSoldOut ? 3 : 6,
                      opacity: isSoldOut ? 0.75 : 1,
                      borderWidth: isSoldOut ? 2 : 0,
                      borderColor: isSoldOut ? '#FCA5A5' : 'transparent',
                    }}
                  >
                    <StyledView className="relative">
                      <StyledImage
                        source={{ uri: item.imageUrl }}
                        className="w-full h-28"
                        resizeMode="cover"
                        style={{ opacity: isSoldOut ? 0.4 : 1 }}
                      />
                      <StyledView className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      
                      {/* Sold Out Overlay */}
                      {isSoldOut && (
                        <StyledView 
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(220, 38, 38, 0.95)',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Ionicons name="close-circle" size={32} color="white" style={{ marginBottom: 6 }} />
                          <StyledView className="bg-white/20 px-3 py-1 rounded-lg">
                            <StyledText className="text-white text-[10px] font-black tracking-wider">
                              OUT OF STOCK
                            </StyledText>
                          </StyledView>
                        </StyledView>
                      )}
                    </StyledView>

                    <StyledView className="p-4">
                      <StyledText
                        className={`text-base font-bold mb-1 ${
                          isSoldOut ? 'text-[#8B4513]/50' : 'text-[#8B4513]'
                        }`}
                        numberOfLines={1}
                      >
                        {item.name}
                      </StyledText>
                      <StyledText
                        className={`text-xs mb-3 leading-4 ${
                          isSoldOut ? 'text-[#8B4513]/40' : 'text-[#8B4513]/60'
                        }`}
                        numberOfLines={2}
                      >
                        {item.description}
                      </StyledText>
                      <StyledView className="flex-row justify-between items-center">
                        <StyledText className={`text-lg font-black ${
                          isSoldOut ? 'text-[#BC4A4D]/50' : 'text-[#BC4A4D]'
                        }`}>
                          ₱{item.price.toFixed(2)}
                        </StyledText>
                        <StyledView className={`px-2 py-1 rounded-full ${
                          isSoldOut 
                            ? 'bg-[#DC2626]/10' 
                            : 'bg-[#DAA520]/20'
                        }`}>
                          <StyledText className={`text-xs font-semibold ${
                            isSoldOut
                              ? 'text-[#DC2626]'
                              : 'text-[#DAA520]'
                          }`}>
                            {isSoldOut ? 'Out of stock' : `${item.quantity} left`}
                          </StyledText>
                        </StyledView>
                      </StyledView>
                    </StyledView>
                  </StyledTouchableOpacity>
                );
              })}
            </StyledView>
          )}
        </StyledView>

        {/* Enhanced Add to Cart Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <StyledView className="flex-1 bg-black/60 justify-end">
            <StyledView
              className="bg-[#DFD6C5] rounded-t-3xl p-5"
              style={{
                shadowColor: '#8B4513',
                shadowOffset: { width: 0, height: -8 },
                shadowOpacity: 0.2,
                shadowRadius: 24,
                elevation: 20,
              }}
            >
              {selectedItem && (
                <>
                  {/* Enhanced Header */}
                  <StyledView className="flex-row justify-between items-center mb-4">
                    <StyledView className="flex-1">
                      <StyledText className="text-xl font-black text-[#8B4513] mb-1">
                        {selectedItem.name}
                      </StyledText>
                      <StyledText className="text-[#8B4513]/60 text-xs">
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
                        setSelectedAddOns({});
                      }}
                    >
                      <Ionicons name="close" size={20} color="#8B4513" />
                    </StyledTouchableOpacity>
                  </StyledView>

                  {/* Enhanced Image Card */}
                  <StyledView className="bg-white rounded-2xl p-3 mb-4" style={{
                    shadowColor: '#8B4513',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 6,
                  }}>
                    <StyledImage
                      source={{ uri: selectedItem.imageUrl }}
                      className="w-full h-32 rounded-xl mb-3"
                      resizeMode="cover"
                    />
                    <StyledText className="text-[#8B4513]/70 text-xs leading-4">
                      {selectedItem.description}
                    </StyledText>
                  </StyledView>

                  {/* Add-ons - Show if item has add-ons */}
                  {selectedItem.addOns && selectedItem.addOns.length > 0 && (
                    <StyledView className="bg-white rounded-2xl p-4 mb-4" style={{
                      shadowColor: '#8B4513',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 12,
                      elevation: 6,
                    }}>
                      <StyledText className="text-[#8B4513] text-base font-bold mb-3">Size Options</StyledText>
                      <StyledText className="text-[#8B4513]/70 text-xs mb-3">Choose one size</StyledText>

                      {selectedItem.addOns.map((addOn, idx) => {
                        const isSelected = selectedAddOns[addOn.name];
                        return (
                          <StyledTouchableOpacity
                            key={`${addOn.name}-${idx}`}
                            className={`flex-row items-center justify-between py-3 px-3 rounded-xl mb-2 border ${isSelected ? 'bg-[#DAA520]/10 border-[#DAA520]' : 'bg-white border-gray-200'}`}
                            onPress={() => {
                              // Radio button behavior: clear all other selections, toggle this one
                              if (isSelected) {
                                // Deselect this option
                                setSelectedAddOns({});
                              } else {
                                // Select only this option (clear others)
                                setSelectedAddOns({ [addOn.name]: true });
                              }
                            }}
                          >
                            <StyledView className="flex-row items-center flex-1">
                              {/* Radio button style */}
                              <StyledView className={`w-5 h-5 rounded-full border-2 ${isSelected ? 'border-[#DAA520]' : 'border-gray-300'} items-center justify-center mr-3`}>
                                {isSelected && (
                                  <StyledView className="w-3 h-3 rounded-full bg-[#DAA520]" />
                                )}
                              </StyledView>
                              <StyledView className="flex-1">
                                <StyledText className="text-[#8B4513] text-sm font-semibold">{addOn.name}</StyledText>
                              </StyledView>
                            </StyledView>
                            <StyledText className="text-[#BC4A4D] text-sm font-bold">+₱{addOn.price.toFixed(2)}</StyledText>
                          </StyledTouchableOpacity>
                        );
                      })}
                    </StyledView>
                  )}

                  {/* Enhanced Price & Availability */}
                  <StyledView className="bg-white rounded-2xl p-4 mb-4" style={{
                    shadowColor: '#8B4513',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 6,
                  }}>
                    <StyledView className="flex-row justify-between items-center">
                      <StyledView>
                        <StyledText className="text-[#8B4513]/60 text-xs mb-1">Price per item</StyledText>
                        <StyledText className="text-2xl font-black text-[#BC4A4D]">
                          ₱{selectedItem.price.toFixed(2)}
                        </StyledText>
                      </StyledView>
                      <StyledView className="bg-[#DAA520]/20 px-3 py-1.5 rounded-xl">
                        <StyledText className="text-[#DAA520] text-xs font-bold text-center">
                          {availableQuantity} available
                        </StyledText>
                      </StyledView>
                    </StyledView>
                  </StyledView>

                  {/* Enhanced Quantity Selector */}
                  <StyledView className="bg-white rounded-2xl p-4 mb-4" style={{
                    shadowColor: '#8B4513',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 6,
                  }}>
                    <StyledText className="text-[#8B4513] text-base font-bold mb-3 text-center">
                      Select Quantity
                    </StyledText>
                    <StyledView className="flex-row items-center justify-center">
                      <StyledTouchableOpacity
                        className={`w-12 h-12 rounded-2xl items-center justify-center ${
                          quantity === 1 ? 'bg-[#DFD6C5]/50' : 'bg-[#BC4A4D]'
                        }`}
                        style={quantity > 1 ? {
                          shadowColor: '#BC4A4D',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.3,
                          shadowRadius: 6,
                          elevation: 4,
                        } : {}}
                        onPress={() => {
                          if (quantity > 1) {
                            setQuantity(quantity - 1);
                            setAvailableQuantity(availableQuantity + 1);
                          }
                        }}
                      >
                        <Ionicons 
                          name="remove" 
                          size={20} 
                          color={quantity === 1 ? '#8B4513' : 'white'} 
                        />
                      </StyledTouchableOpacity>

                      <StyledView className="bg-[#DFD6C5]/30 px-6 py-3 rounded-2xl mx-4 min-w-[60px]">
                        <StyledTextInput
                          className="text-2xl font-black text-[#8B4513] text-center"
                          value={quantity.toString()}
                          onChangeText={(text) => {
                            const numValue = parseInt(text) || 0;
                            const maxAllowed = availableQuantity + quantity;
                            if (numValue >= 0 && numValue <= maxAllowed) {
                              const diff = quantity - numValue;
                              setQuantity(numValue);
                              setAvailableQuantity(availableQuantity + diff);
                            }
                          }}
                          keyboardType="number-pad"
                          selectTextOnFocus={true}
                          maxLength={3}
                        />
                      </StyledView>

                      <StyledTouchableOpacity
                        className={`w-12 h-12 rounded-2xl items-center justify-center ${
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
                          size={20} 
                          color={availableQuantity === 0 ? '#8B4513' : 'white'} 
                        />
                      </StyledTouchableOpacity>
                    </StyledView>
                  </StyledView>

                  {/* Enhanced Add to Cart Button */}
                  <StyledView className="space-y-3">
                    {quantity > 0 && (() => {
                      const basePrice = selectedItem.price;
                      
                      let addOnsTotal = 0;
                      if (selectedItem.addOns) {
                        selectedItem.addOns.forEach((addOn) => {
                          if (selectedAddOns[addOn.name]) {
                            addOnsTotal += addOn.price;
                          }
                        });
                      }
                      const itemPriceWithAddOns = basePrice + addOnsTotal;
                      const orderTotal = itemPriceWithAddOns * quantity;

                      return (
                        <StyledView className="bg-white rounded-2xl p-3" style={{
                          shadowColor: '#8B4513',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.1,
                          shadowRadius: 12,
                          elevation: 6,
                        }}>
                          <StyledView className="flex-row justify-between items-center">
                            <StyledText className="text-[#8B4513]/70 text-xs">Order Total</StyledText>
                            <StyledText className="text-xl font-black text-[#BC4A4D]">
                              ₱{orderTotal.toFixed(2)}
                            </StyledText>
                          </StyledView>
                          <StyledView className="flex-row justify-between items-center mt-2">
                            <StyledText className="text-[#8B4513]/70 text-xs">
                              {quantity} × ₱{itemPriceWithAddOns.toFixed(2)}
                              {addOnsTotal > 0 && ` (Base + ₱${addOnsTotal.toFixed(2)} add-ons)`}
                            </StyledText>
                            <StyledText className="text-[#DAA520] text-xs font-semibold">
                              Ready to add!
                            </StyledText>
                          </StyledView>
                        </StyledView>
                      );
                    })()}
                    
                    <StyledTouchableOpacity
                      className={`w-full py-4 rounded-2xl items-center ${
                        (shopInfo.timeOpen && shopInfo.timeClose && !isShopOpen(shopInfo.timeOpen, shopInfo.timeClose)) ? 'bg-[#DFD6C5]/50' : 'bg-[#BC4A4D]'
                      }`}
                      style={(!shopInfo.timeOpen || !shopInfo.timeClose || isShopOpen(shopInfo.timeOpen, shopInfo.timeClose)) ? {
                        shadowColor: '#BC4A4D',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.4,
                        shadowRadius: 12,
                        elevation: 8,
                      } : {}}
                      onPress={handleAddToCart}
                      disabled={isAddingToCart || (shopInfo.timeOpen && shopInfo.timeClose && !isShopOpen(shopInfo.timeOpen, shopInfo.timeClose))}
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
                            name="basket" 
                            size={20} 
                            color="white" 
                          />
                          <StyledText className="text-lg font-bold ml-3 text-white">
                            Add to Cart
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

          {/* Middle-sheet success modal for Add to Cart */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={addSuccessModalVisible}
            onRequestClose={() => setAddSuccessModalVisible(false)}
          >
            {/* Center instead of bottom */}
            <StyledView className="flex-1 justify-center items-center bg-black/40">
              <StyledView className="bg-white rounded-3xl p-6 w-[85%]">
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
                    }}
                  >
                    <StyledText className="text-white font-bold text-lg">Continue Shopping</StyledText>
                  </StyledTouchableOpacity>
                  <StyledTouchableOpacity
                    className="w-full py-4 rounded-2xl items-center bg-white"
                    style={{ borderWidth: 3, borderColor: 'rgba(139, 69, 19, 0.4)' }}
                    onPress={() => {
                      setAddSuccessModalVisible(false);
                      router.push('/cart-preview');
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