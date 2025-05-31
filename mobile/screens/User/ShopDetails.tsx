import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import BottomNavigation from '@/components/BottomNavigation';

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
                                                   cancelText = 'Cancel'
                                                 }) => {
  const getAlertColors = () => {
    switch (type) {
      case 'success':
        return {
          iconBg: '#E8F5E8',
          icon: '✓',
          iconColor: '#4CAF50',
          buttonBg: '#BC4A4D'
        };
      case 'error':
        return {
          iconBg: '#FFEBEE',
          icon: '✕',
          iconColor: '#F44336',
          buttonBg: '#BC4A4D'
        };
      case 'warning':
        return {
          iconBg: '#FFF3E0',
          icon: '⚠',
          iconColor: '#FF9800',
          buttonBg: '#BC4A4D'
        };
      default:
        return {
          iconBg: '#E3F2FD',
          icon: 'ℹ',
          iconColor: '#2196F3',
          buttonBg: '#BC4A4D'
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
            <View style={[alertStyles.iconContainer, { backgroundColor: colors.iconBg }]}>
              <Text style={[alertStyles.icon, { color: colors.iconColor }]}>
                {colors.icon}
              </Text>
            </View>

            <Text style={alertStyles.title}>{title}</Text>
            <Text style={alertStyles.message}>{message}</Text>

            <View style={alertStyles.buttonContainer}>
              {showCancelButton && (
                  <TouchableOpacity
                      style={[alertStyles.button, alertStyles.cancelButton]}
                      onPress={onCancel || onClose}
                  >
                    <Text style={alertStyles.cancelButtonText}>{cancelText}</Text>
                  </TouchableOpacity>
              )}
              <TouchableOpacity
                  style={[
                    alertStyles.button,
                    alertStyles.confirmButton,
                    { backgroundColor: colors.buttonBg },
                    !showCancelButton && alertStyles.singleButton
                  ]}
                  onPress={onClose}
              >
                <Text style={alertStyles.confirmButtonText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
  );
};

const ShopDetails = () => {
  const { id } = useLocalSearchParams();
  const { getAccessToken } = useAuthentication();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [quantity, setQuantity] = useState(0);
  const [availableQuantity, setAvailableQuantity] = useState(0);

  // Custom Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
    showCancelButton: false,
    onCancel: undefined as (() => void) | undefined,
    confirmText: 'OK',
    cancelText: 'Cancel'
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
    setAlertConfig({
      title,
      message,
      type,
      showCancelButton: options?.showCancelButton || false,
      onCancel: options?.onCancel,
      confirmText: options?.confirmText || 'OK',
      cancelText: options?.cancelText || 'Cancel'
    });
    setAlertVisible(true);
  };

  useEffect(() => {
    fetchShopDetails();
  }, [id]);

  const fetchShopDetails = async () => {
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
    } catch (error) {
      console.error("Error fetching shop details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (quantity === 0) {
      return;
    }

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        return;
      }

      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error("No user ID found");
        return;
      }

      const config = { headers: { Authorization: token } };

      // First check if user has items in cart from a different shop
      try {
        const cartResponse = await axios.get(`${API_URL}/api/carts/cart`, {
          params: { uid: userId },
          headers: { Authorization: token }
        });

        if (cartResponse.data && cartResponse.data.shopId && cartResponse.data.shopId !== id) {
          showCustomAlert(
              'Cannot Add Item',
              'You already have items in your cart from a different shop. Please clear your cart first before adding items from this shop.',
              'warning'
          );
          return;
        }
      } catch (error) {
        // If cart not found (404), it's okay - we can proceed with adding items
        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          console.error("Error checking cart:", error);
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
          userQuantity: quantity
        },
        totalPrice: selectedItem?.price ? selectedItem.price * quantity : 0
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
      console.error("Error adding to cart:", error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || 'Failed to add item to cart';
        showCustomAlert('Error', errorMessage, 'error');
      } else {
        showCustomAlert('Error', 'Failed to add item to cart', 'error');
      }
    }
  };

  const openModal = async (item: Item) => {
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        return;
      }

      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error("No user ID found");
        return;
      }

      const config = { headers: { Authorization: token } };

      // Check cart for existing items
      try {
        const cartResponse = await axios.get(`${API_URL}/api/carts/cart`, {
          params: { uid: userId },
          headers: { Authorization: token }
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
          console.error("Error checking cart:", error);
          setAvailableQuantity(item.quantity || 0);
        }
      }

      setSelectedItem(item);
      setQuantity(0);
      setModalVisible(true);
    } catch (error) {
      console.error("Error opening modal:", error);
    }
  };

  if (isLoading) {
    return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
          <View style={styles.loadingContainer}>
            <View style={styles.loadingSpinner}>
              <ActivityIndicator size="large" color="#BC4A4D" />
            </View>
            <Text style={styles.loadingText}>Loading shop details...</Text>
          </View>
          <BottomNavigation activeTab="Home" />
        </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Shop Header */}
          {shopInfo && (
              <View style={styles.shopHeader}>
                <View style={styles.shopImageContainer}>
                  <Image
                      source={{ uri: shopInfo.imageUrl }}
                      style={styles.shopImage}
                      resizeMode="cover"
                  />
                  <View style={styles.shopImageOverlay} />
                </View>
                <View style={styles.shopInfoContainer}>
                  <View style={styles.shopInfo}>
                    <Text style={styles.shopName}>{shopInfo.name}</Text>
                    {shopInfo.averageRating && (
                        <View style={styles.ratingContainer}>
                          <Text style={styles.ratingText}>★ {shopInfo.averageRating}</Text>
                        </View>
                    )}
                  </View>
                  <Text style={styles.shopDescription}>{shopInfo.desc}</Text>
                </View>
              </View>
          )}

          {/* Items Grid */}
          <View style={styles.itemsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Menu Items</Text>
              <View style={styles.sectionDivider} />
            </View>
            <View style={styles.itemsGrid}>
              {items.map((item) => (
                  <TouchableOpacity
                      key={item.id}
                      style={styles.itemCard}
                      onPress={() => openModal(item)}
                      activeOpacity={0.8}
                  >
                    <View style={styles.itemImageContainer}>
                      <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.itemImage}
                          resizeMode="cover"
                      />
                      <View style={styles.priceTag}>
                        <Text style={styles.priceTagText}>₱{item.price.toFixed(2)}</Text>
                      </View>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.itemDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Add to Cart Modal */}
          <Modal
              animationType="slide"
              transparent={true}
              visible={modalVisible}
              onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                {selectedItem && (
                    <>
                      <View style={styles.modalHeader}>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => {
                              setModalVisible(false);
                              setQuantity(0);
                              setSelectedItem(null);
                              setAvailableQuantity(0);
                            }}
                        >
                          <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.modalImageContainer}>
                        <Image
                            source={{ uri: selectedItem.imageUrl }}
                            style={styles.modalItemImage}
                            resizeMode="cover"
                        />
                      </View>

                      <View style={styles.modalItemDetails}>
                        <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                        <Text style={styles.modalItemPrice}>₱{selectedItem.price.toFixed(2)}</Text>
                        <Text style={styles.availableQuantity}>Available: {availableQuantity} items</Text>
                      </View>

                      <View style={styles.quantitySection}>
                        <Text style={styles.quantityLabel}>Quantity</Text>
                        <View style={styles.quantityContainer}>
                          <TouchableOpacity
                              style={[styles.quantityButton, quantity === 0 && styles.quantityButtonDisabled]}
                              onPress={() => setQuantity(Math.max(0, quantity - 1))}
                          >
                            <Text style={[styles.quantityButtonText, quantity === 0 && styles.quantityButtonTextDisabled]}>−</Text>
                          </TouchableOpacity>

                          <View style={styles.quantityDisplay}>
                            <Text style={styles.quantityText}>{quantity}</Text>
                          </View>

                          <TouchableOpacity
                              style={[styles.quantityButton, availableQuantity === 0 && styles.quantityButtonDisabled]}
                              onPress={() => {
                                if (availableQuantity > 0) {
                                  setQuantity(quantity + 1);
                                  setAvailableQuantity(availableQuantity - 1);
                                }
                              }}
                              disabled={availableQuantity === 0}
                          >
                            <Text style={[styles.quantityButtonText, availableQuantity === 0 && styles.quantityButtonTextDisabled]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.modalButtons}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.cancelButton]}
                            onPress={() => {
                              setModalVisible(false);
                              setQuantity(0);
                              setSelectedItem(null);
                              setAvailableQuantity(0);
                            }}
                        >
                          <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalButton, styles.addButton, quantity === 0 && styles.disabledButton]}
                            onPress={handleAddToCart}
                            disabled={quantity === 0}
                        >
                          <Text style={[styles.addButtonText, quantity === 0 && styles.disabledButtonText]}>
                            Add to Cart {quantity > 0 && `(${quantity})`}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                )}
              </View>
            </View>
          </Modal>

          {/* Custom Alert */}
          <CustomAlert
              visible={alertVisible}
              title={alertConfig.title}
              message={alertConfig.message}
              type={alertConfig.type}
              onClose={() => setAlertVisible(false)}
              showCancelButton={alertConfig.showCancelButton}
              onCancel={alertConfig.onCancel}
              confirmText={alertConfig.confirmText}
              cancelText={alertConfig.cancelText}
          />

          {/* Bottom spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
        <BottomNavigation activeTab="Home" />
      </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

const alertStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#FFFAF1',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2C2C2C',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '700',
    fontSize: 16,
  },
  confirmButtonText: {
    color: '#FFFAF1',
    fontWeight: '700',
    fontSize: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DFD6C5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingSpinner: {
    backgroundColor: '#FFFAF1',
    padding: 30,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  shopHeader: {
    backgroundColor: '#FFFAF1',
    borderRadius: 24,
    margin: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  shopImageContainer: {
    position: 'relative',
  },
  shopImage: {
    width: '100%',
    height: 220,
  },
  shopImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  shopInfoContainer: {
    padding: 20,
  },
  shopInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  shopName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2C2C2C',
    flex: 1,
    lineHeight: 32,
  },
  ratingContainer: {
    backgroundColor: '#FFF0E0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    marginLeft: 12,
    shadowColor: '#BC4A4D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#BC4A4D',
  },
  shopDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
    marginTop: 4,
  },
  itemsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionHeader: {
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2C2C2C',
    marginBottom: 8,
  },
  sectionDivider: {
    height: 3,
    backgroundColor: '#BC4A4D',
    width: 60,
    borderRadius: 2,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  itemCard: {
    width: cardWidth,
    backgroundColor: '#FFFAF1',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  itemImageContainer: {
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: 140,
  },
  priceTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#BC4A4D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  priceTagText: {
    color: '#FFFAF1',
    fontSize: 13,
    fontWeight: '700',
  },
  itemInfo: {
    padding: 14,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 6,
  },
  itemDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFAF1',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: height * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 0,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  modalImageContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalItemImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  modalItemDetails: {
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  modalItemName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2C2C2C',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalItemPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#BC4A4D',
    marginBottom: 12,
  },
  availableQuantity: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  quantitySection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  quantityLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 12,
    textAlign: 'center',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    backgroundColor: '#FFF0E0',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#BC4A4D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quantityButtonDisabled: {
    backgroundColor: '#F5F5F5',
  },
  quantityButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#BC4A4D',
  },
  quantityButtonTextDisabled: {
    color: '#CCCCCC',
  },
  quantityDisplay: {
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    marginHorizontal: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2C2C',
  },
  modalButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  addButton: {
    backgroundColor: '#BC4A4D',
    shadowColor: '#BC4A4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '700',
    fontSize: 16,
  },
  addButtonText: {
    color: '#FFFAF1',
    fontWeight: '700',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledButtonText: {
    color: '#999999',
  },
  bottomSpacing: {
    height: 30,
  },
});

export default ShopDetails;