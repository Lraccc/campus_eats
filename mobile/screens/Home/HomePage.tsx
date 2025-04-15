"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from "react-native"
import NavigationBar from "@/components/NavigationBar"
import BottomNavigation from "@/components/BottomNavigation"
import axios from "axios"
import { router } from "expo-router"
import { jwtDecode } from "jwt-decode"

// Import the auth hook
import { useAuthentication } from "../../src/services/AuthService.js";

type RootStackParamList = {
  ShopDetails: { shopId: string }
}

// Update this URL to match your Spring Boot backend URL
export const API_URL = "http://192.168.1.39:8080"

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

// Define an interface for the expected AuthState structure
interface AuthStateShape {
  accessToken: string;
  idToken?: string | null;
  refreshToken?: string | null;
  expiresIn?: number;
  issuedAt?: number;
  scopes?: string[];
  tokenType?: string;
  // Allow other potential properties if needed
  [key: string]: any; 
}

// Define an interface for expected ID token claims (optional but good practice)
interface DecodedIdToken {
  given_name?: string;
  family_name?: string;
  name?: string;
  email?: string;
  oid?: string;
  // Add other claims you might need
}

const HomePage = () => {
  const { getAccessToken, signOut, isLoggedIn, authState: rawAuthState } = useAuthentication();
  const authState = rawAuthState as AuthStateShape | null;
  
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
    if (isLoggedIn && authState) {
      fetchShops()
      fetchTopShops()
      
      // Decode ID Token to get user info
      let nameFromToken = "User"; // Default name
      // Now we can safely check authState.idToken after casting
      if (authState.idToken) { 
          try {
              const decodedToken = jwtDecode<DecodedIdToken>(authState.idToken);
              nameFromToken = decodedToken.given_name || decodedToken.name || "User";
              console.log("Decoded Name:", nameFromToken);
          } catch (e) {
              console.error("Error decoding ID token:", e);
          }
      }
      setUsername(nameFromToken);
    } else {
      console.log("User is not logged in on Home Page.");
      // Use timeout to avoid potential state update race conditions during initial mount/redirect
      setTimeout(() => {
         // Check if routing is possible before attempting
         // This check might need refinement based on Expo Router specifics
        if (router.canGoBack()) { 
             router.replace('/');
         }
      }, 0);
    }
  }, [isLoggedIn, authState])

  const fetchShops = async () => {
    setIsLoading(true)
    let token = null;
    try {
      token = await getAccessToken();
      if (!token) {
          console.error("AUTH_TOKEN_MISSING: Token not found for fetching shops.");
          setIsLoading(false);
          return;
      }
      const config = { headers: { Authorization: `Bearer ${token}` } };
      console.log(`Fetching shops from ${API_URL}/api/shops/active with token...`); // Log before request
      const response = await axios.get(`${API_URL}/api/shops/active`, config)
      const data = response.data
      console.log("Successfully fetched shops data."); // Log success

      const shopsWithRatings = await Promise.all(
          data.map(async (shop: Shop) => {
            try {
              // Also add token to rating requests if they are secured
              const ratingResponse = await axios.get(`${API_URL}/api/ratings/shop/${shop.id}`, config)
              const ratings = ratingResponse.data
              const averageRating = calculateAverageRating(ratings)
              return { ...shop, averageRating }
            } catch (error) {
                // Log rating fetch error but continue
                console.warn(`Failed to fetch ratings for shop ${shop.id}:`, error);
                return { ...shop, averageRating: "N/A" } // Indicate rating fetch failed
            }
          }),
      )
      setShops(shopsWithRatings)
    } catch (error: any) {
      console.error("FETCH_SHOPS_ERROR: Failed fetching shops."); // Specific error message
      if (axios.isAxiosError(error)) {
          console.error(`Axios Error Code: ${error.code}`); // e.g., ECONNREFUSED, ENETUNREACH
          console.error(`Axios Error Message: ${error.message}`);
          // Log request details if available (might be large)
          // console.error(`Axios Error Request: ${JSON.stringify(error.request)}`); 
          // Log response details if available
          if (error.response) {
              console.error(`Axios Error Response Status: ${error.response.status}`);
              // console.error(`Axios Error Response Headers: ${JSON.stringify(error.response.headers)}`);
              console.error(`Axios Error Response Data: ${JSON.stringify(error.response.data)}`);
          } else {
              console.error("Axios Error: No response received from server.");
          }
          if (!token) {
              console.error("FETCH_SHOPS_ERROR: Token was missing during the attempt.");
          }
      } else {
          // Non-Axios error
          console.error("Non-Axios Error:", error);
      }
    }
    setIsLoading(false)
  }

  const fetchTopShops = async () => {
      let token = null;
      try {
        token = await getAccessToken();
        if (!token) {
            console.error("AUTH_TOKEN_MISSING: Token not found for fetching top shops.");
            return;
        }
        const config = { headers: { Authorization: `Bearer ${token}` } };
        console.log(`Fetching top shops from ${API_URL}/api/shops/top-performing with token...`); // Log before request
        const response = await axios.get(`${API_URL}/api/shops/top-performing`, config)
        const topShopsData = response.data
        console.log("Successfully fetched top shops data."); // Log success

        const topShopsWithRatings = await Promise.all(
            topShopsData.map(async (shop: Shop) => {
                try {
                    // Also add token to rating requests if they are secured
                    const ratingResponse = await axios.get(`${API_URL}/api/ratings/shop/${shop.id}`, config)
                    const ratings = ratingResponse.data
                    const averageRating = calculateAverageRating(ratings)
                    return { ...shop, averageRating }
                } catch (error) {
                    // Log rating fetch error but continue
                    console.warn(`Failed to fetch ratings for top shop ${shop.id}:`, error);
                    return { ...shop, averageRating: "N/A" } // Indicate rating fetch failed
                }
            }),
        )

        setTopShops(topShopsWithRatings)
    } catch (error: any) {
        console.error("FETCH_TOP_SHOPS_ERROR: Failed fetching top shops."); // Specific error message
        if (axios.isAxiosError(error)) {
            console.error(`Axios Error Code: ${error.code}`);
            console.error(`Axios Error Message: ${error.message}`);
            // console.error(`Axios Error Request: ${JSON.stringify(error.request)}`);
            if (error.response) {
                console.error(`Axios Error Response Status: ${error.response.status}`);
                // console.error(`Axios Error Response Headers: ${JSON.stringify(error.response.headers)}`);
                console.error(`Axios Error Response Data: ${JSON.stringify(error.response.data)}`);
            } else {
                console.error("Axios Error: No response received from server.");
            }
             if (!token) {
                 console.error("FETCH_TOP_SHOPS_ERROR: Token was missing during the attempt.");
             }
        } else {
            console.error("Non-Axios Error:", error);
        }
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
    // navigation.navigate("ShopDetails", { shopId })
  }

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category)
  }

  const filteredShops = selectedCategory ? shops.filter((shop) => shop.categories.includes(selectedCategory)) : shops

  const handleSignOut = async () => {
    console.log("Attempting Sign Out...");
    try {
        await signOut();
        console.log("Sign out successful (Tokens Cleared).");
        // Navigate back explicitly
        router.replace('/'); 
    } catch (error) {
        console.error("Error during sign out process:", error);
    }
  };

  if (isLoading && !shops.length) {
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
            <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
                <Text style={styles.signOutButtonText}>Sign Out</Text>
             </TouchableOpacity>
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
    marginBottom: 10,
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
  signOutButton: {
    marginTop: 5,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: "#ae4e4e",
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  signOutButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 'bold',
  },
})

export default HomePage
