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
  SafeAreaView
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
  image: string;
  category: string;
}

const ShopDetails = () => {
  const { id } = useLocalSearchParams();
  const { getAccessToken } = useAuthentication();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<any>(null);

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
                    source={{ uri: shopInfo.image }}
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
                      onPress={() => {
                        // TODO: Implement item details view
                        console.log('Item clicked:', item.id);
                      }}
                      activeOpacity={0.7}
                  >
                    <Image
                        source={{ uri: item.image }}
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
});

export default ShopDetails;