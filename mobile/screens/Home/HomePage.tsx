"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from "react-native"
import NavigationBar from "@/components/NavigationBar"
import BottomNavigation from "@/components/BottomNavigation"
import axios from "axios"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"

type RootStackParamList = {
  ShopDetails: { shopId: string }
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "ShopDetails">

// Update this URL to match your Spring Boot backend URL
export const API_URL = "http://192.168.1.20:8080"

interface Shop {
  id: string
  name: string
  type: string
  rating: number
  image: string
  categories: string[]
  desc: string
  averageRating?: string
}

interface Category {
  id: number
  name: string
  icon: string
}

const HomePage = () => {
  const navigation = useNavigation<NavigationProp>()
  const [shops, setShops] = useState<Shop[]>([])
  const [topShops, setTopShops] = useState<Shop[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [username, setUsername] = useState<string>("User") // Placeholder for user's name

  const categories: Category[] = [
    { id: 1, name: "Fast Food", icon: "🍔" },
    { id: 2, name: "Cafes", icon: "☕" },
    { id: 3, name: "Desserts", icon: "🍰" },
    { id: 4, name: "Asian", icon: "🍜" },
    { id: 5, name: "Healthy", icon: "🥗" },
  ]

  useEffect(() => {
    fetchShops()
    fetchTopShops()
  }, [])

  const fetchShops = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(`${API_URL}/api/shops/active`)
      const data = response.data
      const shopsWithRatings = await Promise.all(
          data.map(async (shop: Shop) => {
            try {
              const ratingResponse = await axios.get(`${API_URL}/api/ratings/shop/${shop.id}`)
              const ratings = ratingResponse.data
              const averageRating = calculateAverageRating(ratings)
              return { ...shop, averageRating }
            } catch (error) {
              return { ...shop, averageRating: "No Ratings" }
            }
          }),
      )
      setShops(shopsWithRatings)
    } catch (error) {
      console.error("Error fetching shops:", error)
    }
    setIsLoading(false)
  }

  const fetchTopShops = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/shops/top-performing`)
      const topShops = response.data

      const topShopsWithRatings = await Promise.all(
          topShops.map(async (shop: Shop) => {
            try {
              const ratingResponse = await axios.get(`${API_URL}/api/ratings/shop/${shop.id}`)
              const ratings = ratingResponse.data
              const averageRating = calculateAverageRating(ratings)
              return { ...shop, averageRating }
            } catch (error) {
              return { ...shop, averageRating: "No Ratings" }
            }
          }),
      )

      setTopShops(topShopsWithRatings)
    } catch (error) {
      console.error("Error fetching top shops:", error)
    }
  }

  const calculateAverageRating = (ratings: any[]) => {
    if (ratings.length === 0) return "No Ratings"
    const total = ratings.reduce((sum, rating) => sum + rating.rate, 0)
    const average = total / ratings.length
    return average.toFixed(1)
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return "Good Midnight"
    if (hour < 12) return "Good Morning"
    if (hour < 18) return "Good Afternoon"
    return "Good Evening"
  }

  const handleCardClick = (shopId: string) => {
    navigation.navigate("ShopDetails", { shopId })
  }

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category)
  }

  const filteredShops = selectedCategory ? shops.filter((shop) => shop.categories.includes(selectedCategory)) : shops

  if (isLoading) {
    return (
        <View style={styles.container}>
          <NavigationBar title="Campus Eats" />
          <View style={styles.loadingContainer}>
            <View style={styles.loadingIndicator}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          </View>
          <BottomNavigation activeTab="Home" />
        </View>
    )
  }

  return (
      <View style={styles.container}>
        <NavigationBar title="Campus Eats" />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          {/* Greeting Section */}
          <View style={styles.titleSection}>
            <Text style={styles.titleText}>
              {getGreeting()}, {username}!
            </Text>
            <Text style={styles.subtitleText}>Start Simplifying Your Campus Cravings!</Text>
          </View>

          {/* Categories Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.categoryGrid}>
              {categories.map((category) => (
                  <TouchableOpacity
                      key={category.id}
                      style={[styles.categoryItem, selectedCategory === category.name && styles.selectedCategory]}
                      onPress={() => handleCategoryClick(category.name)}
                  >
                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Most Purchase Shop Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Most Purchase Shop</Text>
            <View style={styles.shopGrid}>
              {topShops.map((shop) => (
                  <TouchableOpacity key={shop.id} style={styles.shopCard} onPress={() => handleCardClick(shop.id)}>
                    <View style={styles.imageContainer}>
                      <Image source={{ uri: shop.image }} style={styles.shopImage} />
                    </View>
                    <View style={styles.shopInfo}>
                      <Text style={styles.shopName}>{shop.name}</Text>
                      <Text style={styles.shopRating}>
                        {shop.averageRating && shop.averageRating !== "No Ratings" ? `★ ${shop.averageRating}` : shop.desc}
                      </Text>
                      <View style={styles.categoriesContainer}>
                        {shop.categories.map((category, idx) => (
                            <Text key={idx} style={styles.categoryTag}>
                              {category}
                            </Text>
                        ))}
                      </View>
                    </View>
                  </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Available Shops Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Shops</Text>
            <View style={styles.shopGrid}>
              {filteredShops.map((shop) => (
                  <TouchableOpacity key={shop.id} style={styles.shopCard} onPress={() => handleCardClick(shop.id)}>
                    <View style={styles.imageContainer}>
                      <Image source={{ uri: shop.image }} style={styles.shopImage} />
                    </View>
                    <View style={styles.shopInfo}>
                      <Text style={styles.shopName}>{shop.name}</Text>
                      <Text style={styles.shopRating}>
                        {shop.averageRating && shop.averageRating !== "No Ratings" ? `★ ${shop.averageRating}` : shop.desc}
                      </Text>
                      <View style={styles.categoriesContainer}>
                        {shop.categories.map((category, idx) => (
                            <Text key={idx} style={styles.categoryTag}>
                              {category}
                            </Text>
                        ))}
                      </View>
                    </View>
                  </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
        <BottomNavigation activeTab="Home" />
      </View>
  )
}

const { width } = Dimensions.get("window")
const cardWidth = (width - 50) / 2 // For 2 cards per row with spacing

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#DFD6C5", // Matching web background color
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingTop: 20,
    paddingBottom: 80, // Added extra padding to account for bottom navigation
    paddingHorizontal: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIndicator: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  titleSection: {
    marginBottom: 20,
  },
  titleText: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 5,
    color: "#000",
  },
  subtitleText: {
    fontSize: 16,
    color: "#333",
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
    color: "#000",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryItem: {
    width: "48%", // For 2 items per row with spacing
    alignItems: "center",
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#FFFAF1", // Matching web card color
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  selectedCategory: {
    borderWidth: 2,
    borderColor: "#BC4A4D", // Matching web accent color
  },
  categoryIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  shopGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  shopCard: {
    width: cardWidth,
    marginBottom: 15,
    borderRadius: 30, // Matching web card border radius
    overflow: "hidden",
    backgroundColor: "#FFFAF1", // Matching web card color
    shadowColor: "#bbb4a7",
    shadowOffset: { width: 7, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 5,
  },
  imageContainer: {
    width: "100%",
    height: 150, // Matching web image height
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
  },
  shopImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  shopInfo: {
    padding: 15,
  },
  shopName: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 5,
    color: "#000",
  },
  shopRating: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoryTag: {
    fontSize: 13,
    color: "#333",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    marginRight: 5,
    marginBottom: 5,
  },
})

export default HomePage
