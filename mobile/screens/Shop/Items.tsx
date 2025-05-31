import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import { MaterialIcons } from '@expo/vector-icons';
import BottomNavigation from '../../components/BottomNavigation';

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
}

interface ShopInfo {
  id: string;
  name: string;
  // Add other shop properties as needed
}

export default function Items() {
  const { getAccessToken } = useAuthentication();
  const [items, setItems] = useState<Item[]>([]);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    fetchShopId();
  }, []);

  const fetchShopId = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setShopId(userId);
        fetchData(userId);
      }
    } catch (error) {
      console.error("Error fetching shop ID:", error);
      setIsLoading(false);
    }
  };

  const fetchData = async (id: string) => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchShopDetails(id),
        fetchShopItems(id)
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Failed to load shop data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShopDetails = async (id: string) => {
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

      const response = await axios.get(`${API_URL}/api/shops/${id}`, config);
      setShopInfo(response.data);
    } catch (error) {
      console.error("Error fetching shop details:", error);
      throw error;
    }
  };

  const fetchShopItems = async (id: string) => {
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

      const response = await axios.get(`${API_URL}/api/items/${id}/shop-items`, config);
      setItems(response.data);
    } catch (error) {
      console.error("Error fetching shop items:", error);
      throw error;
    }
  };

  const navigateToEditItem = (itemId: string) => {
    router.push({
      pathname: "/shop/edit-item/[id]",
      params: { id: itemId }
    });
  };

  const navigateToAddItem = () => {
    router.push('/shop/add-item');
  };

  const renderCategories = (categories: string[]) => {
    if (!categories || !Array.isArray(categories)) return null;
    
    return (
      <View style={styles.categoriesContainer}>
        {categories.map((category, index) => (
          <View key={index} style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{category}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BC4A4D" />
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
        <BottomNavigation activeTab="Items" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView}>


        {/* Items Section */}
        <View style={styles.directItemsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items</Text>
            <TouchableOpacity 
              style={styles.addItemButton}
              onPress={navigateToAddItem}
            >
              <MaterialIcons name="add" size={20} color="#FFF" />
              <Text style={styles.addItemButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {items.length > 0 ? (
            <View style={styles.itemsContainer}>
              {items.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <Image
                    source={{ uri: item.imageUrl || 'https://via.placeholder.com/100' }}
                    style={styles.itemImage}
                  />
                  <View style={styles.itemInfo}>
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
                    </View>
                    <View style={styles.itemPriceContainer}>
                      <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
                      <View style={styles.itemActions}>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => navigateToEditItem(item.id)}
                        >
                          <MaterialIcons name="edit" size={20} color="#BC4A4D" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>No items added yet. Add your first item to get started!</Text>
              <TouchableOpacity 
                style={styles.emptyStateButton}
                onPress={navigateToAddItem}
              >
                <Text style={styles.emptyStateButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNavigation activeTab="Items" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },

  directItemsSection: {
    padding: 15,
    marginHorizontal: 10,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addItemButton: {
    flexDirection: 'row',
    backgroundColor: '#BC4A4D',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  addItemButtonText: {
    color: '#FFFFFF',
    marginLeft: 4,
    fontWeight: 'bold',
    fontSize: 14,
  },
  itemsContainer: {
    marginBottom: 10,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  itemImage: {
    width: 100,
    height: 100,
  },
  itemInfo: {
    flex: 1,
    padding: 10,
    flexDirection: 'row',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  itemPriceContainer: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#BC4A4D',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButton: {
    padding: 5,
    marginLeft: 8,
  },
  emptyStateContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  emptyStateButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  categoryBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 5,
    marginBottom: 5,
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
  },
});
