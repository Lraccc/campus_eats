import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import NavigationBar from '@/components/NavigationBar';

const CategoryItem = ({ name }) => (
    <View style={styles.categoryItem}>
      <View style={styles.categoryCircle} />
      <Text style={styles.categoryName}>{name}</Text>
    </View>
);

const ShopItem = ({ price, image }) => (
    <View style={styles.shopItem}>
      <Image source={{ uri: image }} style={styles.shopImage} />
      <View style={styles.priceTag}>
        <Text style={styles.priceText}>${price}</Text>
      </View>
    </View>
);

const FoodShopItem = ({ name, type, rating, image }) => (
    <View style={styles.foodShopItem}>
      <Image source={{ uri: image }} style={styles.foodShopImage} />
      <View style={styles.shopInfo}>
        <Text style={styles.shopName}>{name}</Text>
        <Text style={styles.shopType}>{type}</Text>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingText}>{rating}</Text>
          <View style={styles.ratingIcon} />
        </View>
      </View>
    </View>
);

const BottomNavigation = () => (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem}>
        <View style={styles.navIcon} />
        <Text style={styles.navText}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem}>
        <View style={styles.navIcon} />
        <Text style={styles.navText}>Explore</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem}>
        <View style={styles.navIcon} />
        <Text style={styles.navText}>Order</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem}>
        <View style={styles.navIcon} />
        <Text style={styles.navText}>Profile</Text>
      </TouchableOpacity>
    </View>
);

const HomePage = () => {
  // Sample data
  const categories = ['Burgers', 'Pizza', 'Chicken', 'Coffee', 'Desserts'];

  const foodShops = [
    { id: 1, name: 'Burger King', type: 'Fast Food', rating: '4.5', image: 'https://v0.dev/placeholder.svg' },
    { id: 2, name: 'Nanay\'s Carinderia', type: 'Local Food', rating: '4.8', image: 'https://v0.dev/placeholder.svg' },
    { id: 3, name: 'Starbucks', type: 'Coffee Shop', rating: '4.6', image: 'https://v0.dev/placeholder.svg' },
    { id: 4, name: 'Jollibee', type: 'Fast Food', rating: '4.7', image: 'https://v0.dev/placeholder.svg' },
  ];

  const shopItems = [
    { id: 1, price: '9.99', image: 'https://v0.dev/placeholder.svg' },
    { id: 2, price: '8.50', image: 'https://v0.dev/placeholder.svg' },
    { id: 3, price: '12.99', image: 'https://v0.dev/placeholder.svg' },
    { id: 4, price: '7.50', image: 'https://v0.dev/placeholder.svg' },
    { id: 5, price: '10.99', image: 'https://v0.dev/placeholder.svg' },
    { id: 6, price: '6.99', image: 'https://v0.dev/placeholder.svg' },
  ];

  return (
      <View style={styles.container}>
        <NavigationBar title="Campus Eats" />
        <ScrollView style={styles.scrollView}>
          <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map((category, index) => (
                  <CategoryItem key={index} name={category} />
              ))}
            </ScrollView>
          </View>

          <View style={styles.foodShopSection}>
            <Text style={styles.sectionTitle}>Available Food Shops</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.foodShopScroll}>
              {foodShops.map((shop) => (
                  <FoodShopItem
                      key={shop.id}
                      name={shop.name}
                      type={shop.type}
                      rating={shop.rating}
                      image={shop.image}
                  />
              ))}
            </ScrollView>
          </View>

          <View style={styles.popularSection}>
            <Text style={styles.popularTitle}>Discover our most popular Shop</Text>
            <View style={styles.shopGrid}>
              {shopItems.map((item) => (
                  <ShopItem key={item.id} price={item.price} image={item.image} />
              ))}
            </View>
          </View>
        </ScrollView>
        <BottomNavigation />
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE4E1', // Light pink background similar to the screenshot
  },
  scrollView: {
    flex: 1,
  },
  categorySection: {
    padding: 15,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  categoryCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0F0F0',
    marginBottom: 5,
  },
  categoryName: {
    fontSize: 12,
    color: '#666',
  },
  foodShopSection: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2', // Blue color for available shops
    marginBottom: 15,
  },
  foodShopScroll: {
    flexDirection: 'row',
  },
  foodShopItem: {
    width: 200,
    marginRight: 15,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  foodShopImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  shopInfo: {
    padding: 10,
  },
  shopName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  shopType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginRight: 5,
  },
  ratingIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#FFD700', // Gold color for star
    borderRadius: 6,
  },
  popularSection: {
    padding: 15,
  },
  popularTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6347', // Orange-red color for the title
    marginBottom: 15,
  },
  shopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  shopItem: {
    width: '48%',
    height: 150,
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  shopImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  priceTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: '#FF6347',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  priceText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#CD5C5C', // Reddish background for bottom nav
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
  },
  navIcon: {
    width: 24,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    marginBottom: 4,
  },
  navText: {
    color: 'white',
    fontSize: 12,
  },
});

export default HomePage;