import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthentication, AUTH_TOKEN_KEY } from '../../services/authService';
import { styled } from 'nativewind';
import LiveStreamViewer from '../../components/LiveStreamViewer';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../../components/BottomNavigation';

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
  }, [id]);

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

      // Check if shop has a stream URL
      const response = await axios.get(`${API_URL}/api/shops/${id}/stream-url`, config);
      if (response.data && response.data.streamUrl) {
        setHasStreamUrl(true);
      }
    } catch (error) {
      // Check if this is a 404 error (no stream URL configured - expected case)
      if (error && typeof error === 'object' && 'response' in error && (error as any).response?.status === 404) {
        console.log('Shop does not have streaming configured (404)');
      } else {
        // For all other errors, log as error
        console.error('Error checking stream URL:', error);
      }
      setHasStreamUrl(false);
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
        return;
      }

      const config = { headers: { Authorization: token } };

      // Fetch shop info
      const shopResponse = await axios.get(`${API_URL}/api/shops/${id}`, config);
      setShopInfo(shopResponse.data);

      // Fetch shop items
      const itemsResponse = await axios.get(`${API_URL}/api/items/${id}/shop-items`, config);
      setItems(itemsResponse.data);
    } catch (error) {
      console.error('Error fetching shop details:', error);
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
        showCustomAlert('Success', 'Item added to cart successfully', 'success');
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
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error('No token available');
        return;
      }

      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error('No user ID found');
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
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#DFD6C5]">
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
        <StyledView className="flex-1 justify-center items-center">
          <StyledView className="bg-white p-8 rounded-3xl">
            <ActivityIndicator size="large" color="#BC4A4D" />
            <StyledText className="text-[#8B4513] text-lg font-bold mt-4 text-center">
              Loading...
            </StyledText>
          </StyledView>
        </StyledView>
        <BottomNavigation activeTab="Home" />
      </SafeAreaView>
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
              className="absolute top-8 left-4 w-10 h-10 bg-white rounded-full items-center justify-center"
              onPress={() => router.back()}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <StyledText className="text-[#BC4A4D] text-lg font-bold">←</StyledText>
            </StyledTouchableOpacity>

            {/* Shop Info Card */}
            <StyledView
              className="bg-white mx-4 -mt-12 rounded-2xl p-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <StyledView className="flex-row justify-between items-start mb-2">
                <StyledView className="flex-1">
                  <StyledText className="text-2xl font-black text-[#8B4513] mb-1">
                    {shopInfo.name}
                  </StyledText>
                  <StyledText className="text-[#8B4513]/70 text-sm">
                    {shopInfo.desc}
                  </StyledText>

                  {/* Original livestream buttons that only show when stream is available */}
                  {hasStreamUrl && (
                    <StyledView className="mt-2 flex-row space-x-2">
                      <StyledTouchableOpacity
                        className="bg-[#8B4513] px-4 py-2 rounded-xl flex-row items-center justify-center flex-1"
                        onPress={() => setLiveStreamModalVisible(true)}
                      >
                        <Ionicons name="play-circle-outline" size={16} color="#fff" style={{ marginRight: 5 }} />
                        <StyledText className="text-white font-bold">Watch in Modal</StyledText>
                      </StyledTouchableOpacity>
                    </StyledView>
                  )}
                </StyledView>

                {shopInfo.averageRating && (
                  <StyledView className="bg-[#BC4A4D] px-3 py-1 rounded-xl ml-3">
                    <StyledText className="text-white text-base font-bold">
                      ★ {shopInfo.averageRating}
                    </StyledText>
                  </StyledView>
                )}
              </StyledView>
            </StyledView>
          </StyledView>
        )}

        {/* Simple Menu Grid */}
        <StyledView className="px-4 pt-6 pb-16">
          <StyledText className="text-xl font-black text-[#8B4513] mb-4">
            Menu
          </StyledText>

          <StyledView className="flex-row flex-wrap justify-between">
            {items.map((item) => (
              <StyledTouchableOpacity
                key={item.id}
                className="w-[48%] bg-white rounded-xl mb-4 overflow-hidden"
                onPress={() => openModal(item)}
                activeOpacity={0.9}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <StyledImage
                  source={{ uri: item.imageUrl }}
                  className="w-full h-24"
                  resizeMode="cover"
                />

                <StyledView className="p-3">
                  <StyledText
                    className="text-base font-bold text-[#8B4513] mb-1"
                    numberOfLines={1}
                  >
                    {item.name}
                  </StyledText>
                  <StyledText
                    className="text-[#8B4513]/60 text-xs mb-2"
                    numberOfLines={2}
                  >
                    {item.description}
                  </StyledText>
                  <StyledText className="text-[#BC4A4D] text-lg font-black">
                    ₱{item.price.toFixed(2)}
                  </StyledText>
                </StyledView>
              </StyledTouchableOpacity>
            ))}
          </StyledView>
        </StyledView>

        {/* Live Stream Modal */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={liveStreamModalVisible}
          onRequestClose={() => setLiveStreamModalVisible(false)}
        >
          {liveStreamModalVisible && (
            <LiveStreamViewer
              shopId={id}
              shopName={shopInfo?.name}
              onClose={() => setLiveStreamModalVisible(false)}
            />
          )}
        </Modal>

        {/* Simple Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <StyledView className="flex-1 bg-black/50 justify-end">
            <StyledView
              className="bg-white rounded-t-3xl p-6"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 16,
                elevation: 16,
              }}
            >
              {selectedItem && (
                <>
                  {/* Header */}
                  <StyledView className="flex-row justify-between items-center mb-4">
                    <StyledText className="text-xl font-black text-[#8B4513]">
                      {selectedItem.name}
                    </StyledText>
                    <StyledTouchableOpacity
                      className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
                      onPress={() => {
                        setModalVisible(false);
                        setQuantity(0);
                        setSelectedItem(null);
                        setAvailableQuantity(0);
                      }}
                    >
                      <StyledText className="text-[#8B4513] text-base font-bold">✕</StyledText>
                    </StyledTouchableOpacity>
                  </StyledView>

                  {/* Image */}
                  <StyledImage
                    source={{ uri: selectedItem.imageUrl }}
                    className="w-full h-36 rounded-xl mb-4"
                    resizeMode="cover"
                  />

                  {/* Price & Availability */}
                  <StyledView className="flex-row justify-between items-center mb-4">
                    <StyledText className="text-2xl font-black text-[#BC4A4D]">
                      ₱{selectedItem.price.toFixed(2)}
                    </StyledText>
                    <StyledText className="text-[#8B4513]/70 text-sm">
                      {availableQuantity} available
                    </StyledText>
                  </StyledView>

                  {/* Simple Quantity Selector */}
                  <StyledView className="flex-row items-center justify-center mb-6">
                    <StyledTouchableOpacity
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        quantity === 0 ? 'bg-gray-100' : 'bg-[#BC4A4D]'
                      }`}
                      onPress={() => setQuantity(Math.max(0, quantity - 1))}
                    >
                      <StyledText
                        className={`text-xl font-bold ${
                          quantity === 0 ? 'text-gray-400' : 'text-white'
                        }`}
                      >
                        −
                      </StyledText>
                    </StyledTouchableOpacity>

                    <StyledText
                      className="text-2xl font-black text-[#8B4513] mx-6 min-w-[40px] text-center"
                    >
                      {quantity}
                    </StyledText>

                    <StyledTouchableOpacity
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        availableQuantity === 0 ? 'bg-gray-100' : 'bg-[#BC4A4D]'
                      }`}
                      onPress={() => {
                        if (availableQuantity > 0) {
                          setQuantity(quantity + 1);
                          setAvailableQuantity(availableQuantity - 1);
                        }
                      }}
                      disabled={availableQuantity === 0}
                    >
                      <StyledText
                        className={`text-xl font-bold ${
                          availableQuantity === 0 ? 'text-gray-400' : 'text-white'
                        }`}
                      >
                        +
                      </StyledText>
                    </StyledTouchableOpacity>
                  </StyledView>

                  {/* Simple Add to Cart Button */}
                  <StyledTouchableOpacity
                    className={`w-full py-3 rounded-xl items-center ${
                      quantity === 0 ? 'bg-gray-200' : 'bg-[#BC4A4D]'
                    }`}
                    onPress={handleAddToCart}
                    disabled={quantity === 0 || isAddingToCart}
                  >
                    {isAddingToCart ? (
                      <StyledView className="flex-row items-center">
                        <ActivityIndicator size="small" color="white" />
                        <StyledText className="text-white text-base font-bold ml-2">
                          Adding...
                        </StyledText>
                      </StyledView>
                    ) : (
                      <StyledText
                        className={`text-base font-bold ${
                          quantity === 0 ? 'text-gray-500' : 'text-white'
                        }`}
                      >
                        {quantity === 0
                          ? 'Select Quantity'
                          : `Add to Cart • ₱${(selectedItem.price * quantity).toFixed(2)}`}
                      </StyledText>
                    )}
                  </StyledTouchableOpacity>
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