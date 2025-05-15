import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import axios from 'axios'; // Replace with your axiosConfig if needed

interface Shop {
  id: string;
  name: string;
  address: string;
  desc: string;
  imageUrl: string;
  categories: string[];
  deliveryFee: number;
}

interface Item {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  orderCount?: number;
}

export default function ShopScreen({ route, navigation }: any) {
  const { shopId } = route.params;
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [popularItems, setPopularItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingPopular, setLoadingPopular] = useState(true);

  useEffect(() => {
    async function fetchShop() {
      try {
        const res = await axios.get(`/shops/${shopId}`);
        setShop(res.data);
      } catch (e) {
        Alert.alert('Error', 'Failed to fetch shop info.');
      } finally {
        setLoading(false);
      }
    }
    async function fetchItems() {
      try {
        const res = await axios.get(`/items/${shopId}/shop-items`);
        setItems(res.data);
      } catch (e) {
        Alert.alert('Error', 'Failed to fetch shop items.');
      } finally {
        setLoadingItems(false);
      }
    }
    async function fetchPopular() {
      try {
        const res = await axios.get(`/items/${shopId}/popular-items`);
        setPopularItems(res.data.sort((a: Item, b: Item) => (b.orderCount || 0) - (a.orderCount || 0)));
      } catch (e) {
        Alert.alert('Error', 'Failed to fetch popular items.');
      } finally {
        setLoadingPopular(false);
      }
    }
    fetchShop();
    fetchItems();
    fetchPopular();
  }, [shopId]);

  if (loading || !shop) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#ae4e4e" /></View>;
  }

  return (
    <ScrollView style={styles.container}>
      {/* Shop Info */}
      <View style={styles.shopInfo}>
        <Image source={{ uri: shop.imageUrl }} style={styles.shopImage} />
        <Text style={styles.shopName}>{shop.name}</Text>
        <Text style={styles.shopAddress}>{shop.address}</Text>
        <Text style={styles.shopDesc}>{shop.desc}</Text>
        <View style={styles.categories}>
          {shop.categories && shop.categories.map((cat, idx) => (
            <Text key={idx} style={styles.category}>{cat}</Text>
          ))}
        </View>
        <Text style={styles.deliveryFee}>Delivery Fee: ₱{shop.deliveryFee}</Text>
      </View>

      {/* Popular Items */}
      <Text style={styles.sectionTitle}>Popular Items</Text>
      {loadingPopular ? (
        <ActivityIndicator size="small" color="#ae4e4e" />
      ) : popularItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {popularItems.map(item => (
            <TouchableOpacity key={item.id} style={styles.itemCard}>
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
              <Text style={styles.itemOrders}>🔥 {item.orderCount || 0} orders</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.noItemsText}>No popular items yet.</Text>
      )}

      {/* All Items */}
      <Text style={styles.sectionTitle}>All Items</Text>
      {loadingItems ? (
        <ActivityIndicator size="small" color="#ae4e4e" />
      ) : items.length > 0 ? (
        <View style={styles.itemsGrid}>
          {items.map(item => (
            <TouchableOpacity key={item.id} style={styles.itemCard}>
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.noItemsText}>No items available.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fae9e0',
  },
  shopInfo: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  shopImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
    backgroundColor: '#eee',
  },
  shopName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ae4e4e',
    marginBottom: 4,
  },
  shopAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  shopDesc: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    justifyContent: 'center',
  },
  category: {
    backgroundColor: '#f5c6cb',
    color: '#ae4e4e',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    margin: 2,
    fontSize: 12,
  },
  deliveryFee: {
    fontSize: 14,
    color: '#ae4e4e',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ae4e4e',
    marginLeft: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  horizontalScroll: {
    paddingLeft: 16,
    marginBottom: 8,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  itemCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 8,
    padding: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
    textAlign: 'center',
  },
  itemPrice: {
    fontSize: 14,
    color: '#ae4e4e',
    marginBottom: 2,
  },
  itemOrders: {
    fontSize: 12,
    color: '#666',
  },
  noItemsText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 16,
  },
}); 