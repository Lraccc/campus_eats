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
  RefreshControl,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import BottomNavigation from '../../components/BottomNavigation';

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  orderCount?: number;
}

export default function ShopHome() {
  const { getAccessToken } = useAuthentication();
  const [items, setItems] = useState<Item[]>([]);
  const [popularItems, setPopularItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    fetchShopId();
  }, []);

  const fetchShopId = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setShopId(userId);
        fetchShopDetails(userId);
      }
    } catch (error) {
      console.error("Error fetching shop ID:", error);
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

      // Fetch shop info
      const shopResponse = await axios.get(`${API_URL}/api/shops/${id}`, config);
      setShopInfo(shopResponse.data);

      // Fetch shop items
      const itemsResponse = await axios.get(`${API_URL}/api/items/${id}/shop-items`, config);
      setItems(itemsResponse.data);

      // Fetch popular items
      const popularResponse = await axios.get(`${API_URL}/api/items/${id}/popular-items`, config);
      const sortedItems = popularResponse.data.sort((a: Item, b: Item) => 
        (b.orderCount || 0) - (a.orderCount || 0)
      );
      setPopularItems(sortedItems);
    } catch (error) {
      console.error("Error fetching shop details:", error);
      Alert.alert("Error", "Failed to load shop details");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    if (shopId) {
      fetchShopDetails(shopId);
    } else {
      setRefreshing(false);
    }
  }, [shopId]);

  const navigateToIncomingOrders = () => {
    router.push('/shop/incoming-orders');
  };

  const navigateToCashout = () => {
    router.push('/shop/cashout');
  };

  const navigateToAddItem = () => {
    // This would be implemented in a future update
    Alert.alert("Coming Soon", "Add item functionality will be available soon!");
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
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
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Popular Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Items</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popularItemsScroll}>
            {popularItems.length > 0 ? (
              popularItems.map((item) => (
                <View key={item.id} style={styles.popularItemCard}>
                  <Image 
                    source={{ uri: item.imageUrl || 'https://via.placeholder.com/100' }} 
                    style={styles.popularItemImage} 
                  />
                  <View style={styles.popularItemInfo}>
                    <Text style={styles.popularItemName}>{item.name}</Text>
                    <Text style={styles.popularItemPrice}>${item.price.toFixed(2)}</Text>
                    <Text style={styles.popularItemOrderCount}>Orders: {item.orderCount || 0}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>No popular items yet.</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* All Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Items</Text>
          <TouchableOpacity 
            style={styles.addItemButton}
            onPress={navigateToAddItem}
          >
            <MaterialIcons name="add" size={24} color="#FFF" />
            <Text style={styles.addItemButtonText}>Add Item</Text>
          </TouchableOpacity>
          {items.length > 0 ? (
            <View style={styles.itemsGrid}>
              {items.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.itemCard}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: item.imageUrl || 'https://via.placeholder.com/100' }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                    <Text style={styles.itemDescription}>{item.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>No items added yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNavigation activeTab="Home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    color: '#666',
  },

  section: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  popularItemsScroll: {
    flexGrow: 0,
  },
  popularItemCard: {
    width: 150,
    marginRight: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    overflow: 'hidden',
  },
  popularItemImage: {
    width: '100%',
    height: 100,
  },
  popularItemInfo: {
    padding: 10,
  },
  popularItemName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  popularItemPrice: {
    fontSize: 14,
    color: '#BC4A4D',
    marginTop: 5,
  },
  popularItemOrderCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  itemCard: {
    width: '48%',
    marginBottom: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: 120,
  },
  itemInfo: {
    padding: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  itemPrice: {
    fontSize: 14,
    color: '#BC4A4D',
    marginTop: 5,
    fontWeight: 'bold',
  },
  emptyStateContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
