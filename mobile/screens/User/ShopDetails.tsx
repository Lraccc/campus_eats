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
  Alert
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
          Alert.alert(
            'Cannot Add Item',
            'You already have items in your cart from a different shop. Please clear your cart first before adding items from this shop.'
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
        Alert.alert('Success', 'Item added to cart successfully');
        setModalVisible(false);
        setQuantity(0);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || 'Failed to add item to cart';
        Alert.alert('Error', errorMessage);
      } else {
        Alert.alert('Error', 'Failed to add item to cart');
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
            <ActivityIndicator size="large" color="#BC4A4D" />
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
                <Image
                    source={{ uri: shopInfo.imageUrl }}
                    style={styles.shopImage}
                    resizeMode="cover"
                />
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
            <Text style={styles.sectionTitle}>Menu Items</Text>
            <View style={styles.itemsGrid}>
              {items.map((item) => (
                  <TouchableOpacity
                      key={item.id}
                      style={styles.itemCard}
                      onPress={() => openModal(item)}
                      activeOpacity={0.7}
                  >
                    <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.itemImage}
                        resizeMode="cover"
                    />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
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
                    <Image
                      source={{ uri: selectedItem.imageUrl }}
                      style={styles.modalItemImage}
                      resizeMode="cover"
                    />
                    <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                    <Text style={styles.modalItemPrice}>₱{selectedItem.price.toFixed(2)}</Text>
                    <Text style={styles.availableQuantity}>Available: {availableQuantity}</Text>
                    
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => setQuantity(Math.max(0, quantity - 1))}
                      >
                        <Text style={styles.quantityButtonText}>-</Text>
                      </TouchableOpacity>
                      
                      <Text style={styles.quantityText}>{quantity}</Text>
                      
                      <TouchableOpacity
                        style={[styles.quantityButton, availableQuantity === 0 && styles.disabledButton]}
                        onPress={() => {
                          if (availableQuantity > 0) {
                            setQuantity(quantity + 1);
                            setAvailableQuantity(availableQuantity - 1);
                          }
                        }}
                        disabled={availableQuantity === 0}
                      >
                        <Text style={[styles.quantityButtonText, availableQuantity === 0 && styles.disabledButtonText]}>+</Text>
                      </TouchableOpacity>
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
                        <Text style={[styles.addButtonText, quantity === 0 && styles.disabledButtonText]}>Add to Cart</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>

          {/* Add some bottom padding for better scrolling experience */}
          <View style={{ height: 20 }} />
        </ScrollView>
        <BottomNavigation activeTab="Home" />
      </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // 2 cards per row with spacing

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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  shopHeader: {
    backgroundColor: '#FFFAF1',
    borderRadius: 20,
    margin: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  shopImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  shopInfoContainer: {
    padding: 16,
  },
  shopInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shopName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  ratingContainer: {
    backgroundColor: '#FFF0E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 10,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#BC4A4D',
  },
  shopDescription: {
    fontSize: 16,
    lineHeight: 22,
    color: '#666',
    marginTop: 8,
  },
  itemsContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: '#333',
    paddingLeft: 8,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  itemCard: {
    width: cardWidth,
    backgroundColor: '#FFFAF1',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  itemImage: {
    width: '100%',
    height: 140,
  },
  itemInfo: {
    padding: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#BC4A4D',
    marginTop: 6,
  },
  itemDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFAF1',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalItemImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
  },
  modalItemName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalItemPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#BC4A4D',
    marginBottom: 20,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  quantityButton: {
    backgroundColor: '#FFF0E0',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#BC4A4D',
  },
  quantityText: {
    fontSize: 20,
    fontWeight: '600',
    marginHorizontal: 20,
    minWidth: 30,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#FFF0E0',
  },
  addButton: {
    backgroundColor: '#BC4A4D',
  },
  cancelButtonText: {
    color: '#BC4A4D',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  addButtonText: {
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  disabledButtonText: {
    color: '#999999',
  },
  availableQuantity: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
});

export default ShopDetails;