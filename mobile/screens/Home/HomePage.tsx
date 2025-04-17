"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from "react-native"
import NavigationBar from "@/components/NavigationBar"
import BottomNavigation from "@/components/BottomNavigation"
import axios from "axios"
import { router } from "expo-router"
import { jwtDecode } from "jwt-decode"
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';

// Import the auth hook and clearStoredAuthState
import { useAuthentication, clearStoredAuthState, getStoredAuthState } from "../../services/authService";

type RootStackParamList = {
  ShopDetails: { shopId: string }
}

// Update this URL to match your Spring Boot backend URL
export const API_URL = "http://192.168.1.10:8080"

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
    // Check for either OAuth login or traditional login
    checkAuth();
  }, [isLoggedIn, authState]);

  // Utility function to validate token format
  const isValidTokenFormat = (token: string | null): boolean => {
    if (!token) return false;
    // Valid JWT token should have 3 parts separated by dots
    const parts = token.split('.');
    return parts.length === 3;
  };

  const checkAuth = async () => {
    try {
      console.log("🔍 Performing thorough authentication check");
      
      // Get and validate OAuth token
      const oauthState = await getStoredAuthState();
      
      // Log the auth states for debugging
      console.log("OAuth State from storage:", oauthState ? "Present" : "Not found");
      console.log("isLoggedIn prop value:", isLoggedIn);
      console.log("authState from hook:", authState ? "Present" : "Not found");
      
      // IMPORTANT: This fixes the loop - if we have valid token data in storage but isLoggedIn is false,
      // don't redirect to login as it's likely the hook state is still initializing
      const hasValidOAuthToken = oauthState && oauthState.accessToken && isValidTokenFormat(oauthState.accessToken);
      
      if (oauthState && (!oauthState.accessToken || !isValidTokenFormat(oauthState.accessToken))) {
        console.warn("❌ Invalid OAuth token format detected, clearing all storage");
        await clearStoredAuthState();
        router.replace('/');
        return;
      }
      
      // Check traditional login token
      const traditionalToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      
      // Validate token format if it exists
      if (traditionalToken && !isValidTokenFormat(traditionalToken)) {
        console.warn("❌ Invalid traditional token format detected, clearing all storage");
        await clearStoredAuthState();
        router.replace('/');
        return;
      }
      
      // Log detailed authentication state for debugging
      console.log("📊 Auth Status:", { 
        oauthLoggedIn: isLoggedIn,
        hasOAuthToken: !!oauthState?.accessToken,
        hasTraditionalToken: !!traditionalToken,
        hasValidOAuthToken
      });
      
      // FIX for OAuth login loop: Use either the hook's state or the stored state
      if ((isLoggedIn && authState) || (hasValidOAuthToken && !isLoggedIn)) {
        // OAuth login is active - here's the key change: don't require isLoggedIn if we have a valid token
        console.log("✅ User is logged in via OAuth");
        fetchShops();
        fetchTopShops();
        
        // Get user info from OAuth token or storage
        const tokenSource = authState?.idToken || (oauthState?.idToken);
        
        if (tokenSource) { 
            try {
                const decodedToken = jwtDecode<DecodedIdToken>(tokenSource);
                const nameFromToken = decodedToken.given_name || decodedToken.name || "User";
                console.log("OAuth Name:", nameFromToken);
                setUsername(nameFromToken);
            } catch (e) {
                console.error("Error decoding OAuth ID token:", e);
                setUsername("User");
            }
        }
      } else if (traditionalToken) {
        // Traditional login is active
        console.log("User is logged in via traditional login");
        fetchShops();
        fetchTopShops();
        
        // Try to get username from traditional token if it's a JWT
        try {
          const decodedToken = jwtDecode<any>(traditionalToken);
          const nameFromToken = decodedToken.username || decodedToken.name || "User";
          console.log("Traditional auth name:", nameFromToken);
          setUsername(nameFromToken);
        } catch (e) {
          console.error("Error decoding traditional token:", e);
          setUsername("User");
        }
      } else {
        // Only redirect if we've verified there are no valid tokens
        // This prevents the login loop
        if (!hasValidOAuthToken) {
          console.log("No valid authentication found. Redirecting to login page...");
          // Add a small delay to avoid immediate redirection
          setTimeout(() => {
            router.replace('/');
          }, 100);
        } else {
          // We have a valid token in storage but hook isn't ready yet
          console.log("Valid token in storage but hook not ready. Not redirecting yet.");
          // Try to load shops anyway
          fetchShops();
          fetchTopShops();
        }
      }
    } catch (error) {
      console.error("Error checking authentication:", error);
      // On error, redirect to login
      router.replace('/');
    }
  };

  const fetchShops = async () => {
    setIsLoading(true)
    let token = null;
    try {
      // Try to get OAuth token first
      token = await getAccessToken();
      
      // If no OAuth token, try traditional token
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        console.log("Using traditional auth token");
      }
      
      if (!token) {
          console.error("AUTH_TOKEN_MISSING: No token found for fetching shops.");
          setIsLoading(false);
          return;
      }

      // Debug token format to verify it's properly formatted
      console.log(`Token format check: ${token.substring(0, 10)}... (length: ${token.length})`);
      
      // Use raw token format only - this is the approach that works according to logs
      const config = { headers: { Authorization: token } };
      console.log(`Fetching shops from ${API_URL}/api/shops/active with raw token...`);
      const response = await axios.get(`${API_URL}/api/shops/active`, config);
      
      const data = response.data;
      console.log("Successfully fetched shops data.");
      
      const shopsWithRatings = await Promise.all(
        data.map(async (shop: Shop) => {
          try {
            const ratingResponse = await axios.get(`${API_URL}/api/ratings/shop/${shop.id}`, config)
            const ratings = ratingResponse.data
            const averageRating = calculateAverageRating(ratings)
            return { ...shop, averageRating }
          } catch (error) {
            return { ...shop, averageRating: "N/A" }
          }
        }),
      )
      setShops(shopsWithRatings)
    } catch (error: any) {
      console.error("FETCH_SHOPS_ERROR: Failed fetching shops.");
      console.error(error);
      // Display mock data if fetch fails
      setShops([
        {
          id: "mock1",
          name: "Sample Shop",
          type: "Restaurant",
          rating: 4.5,
          image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38",
          categories: ["Fast Food", "Healthy"],
          desc: "A sample shop description",
          averageRating: "4.5"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTopShops = async () => {
    try {
      // Try to get OAuth token first
      let token = await getAccessToken();
      
      // If no OAuth token, try traditional token
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        console.log("Using traditional auth token for top shops");
      }
      
      if (!token) {
        console.error("AUTH_TOKEN_MISSING: No token found for fetching top shops.");
        return;
      }
      
      // Debug token format to verify it's properly formatted
      console.log(`Token format check: ${token.substring(0, 10)}... (length: ${token.length})`);
      
      // Use raw token format only - this is the approach that works according to logs
      const config = { headers: { Authorization: token } };
      console.log(`Fetching top shops from ${API_URL}/api/shops/top-performing with raw token...`);
      const response = await axios.get(`${API_URL}/api/shops/top-performing`, config);
      
      const topShopsData = response.data;
      console.log("Successfully fetched top shops data.");
      
      const topShopsWithRatings = await Promise.all(
        topShopsData.map(async (shop: Shop) => {
          try {
            const ratingResponse = await axios.get(`${API_URL}/api/ratings/shop/${shop.id}`, config)
            const ratings = ratingResponse.data
            const averageRating = calculateAverageRating(ratings)
            return { ...shop, averageRating }
          } catch (error) {
            return { ...shop, averageRating: "N/A" }
          }
        }),
      )
      setTopShops(topShopsWithRatings)
    } catch (error: any) {
      console.error("FETCH_TOP_SHOPS_ERROR: Failed fetching top shops.");
      console.error(error);
      // Display mock data if fetch fails
      setTopShops([
        {
          id: "mock2",
          name: "Top Sample Shop",
          type: "Cafe",
          rating: 4.8,
          image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
          categories: ["Cafes", "Desserts"],
          desc: "A top-rated sample shop",
          averageRating: "4.8"
        }
      ]);
    }
  };

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
    // When implementing shop details page, use the following pattern:
    // 
    // const token = await getAccessToken() || await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    // const config = { headers: { Authorization: token } }; // Use raw token directly
    // const response = await axios.get(`${API_URL}/api/shops/${shopId}`, config);
    
    console.log(`Navigate to shop details for shop ID: ${shopId}`);
    // For now, just log the shop ID until details page is implemented
  }

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category)
  }

  const filteredShops = selectedCategory ? shops.filter((shop) => shop.categories.includes(selectedCategory)) : shops

  // Sign out handler with immediate navigation
  const handleSignOut = async () => {
    try {
      console.log("Performing complete sign-out...");
      await signOut();
      
      // Force clear all storage as a backup measure
      await clearStoredAuthState();
      
      // Force navigation to root
      console.log("Sign-out complete, redirecting to login page");
      router.replace('/');
    } catch (error) {
      console.error("Error during sign-out:", error);
      // Even if there's an error, try to navigate away
      router.replace('/');
    }
  };

  const handleClearStorage = async () => {
    console.log("Emergency storage clearing...");
    try {
      // First clear all auth-related storage
      await clearStoredAuthState();
      
      // Then clear ALL app storage as a last resort
      await AsyncStorage.clear();
      console.log("⚠️ ALL AsyncStorage data has been cleared!");
      
      // Force immediate navigation without any delay
      router.replace('/');
      
      // Add a double check to ensure navigation works
      setTimeout(() => {
        console.log("Double-checking navigation after storage clear...");
        router.replace('/');
      }, 500);
    } catch (error) {
      console.error("Error during emergency storage clear:", error);
      // Even on error, try to navigate back to login
      router.replace('/');
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
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearStorage} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear Storage</Text>
            </TouchableOpacity>
          </View>
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
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10, // Space between buttons
  },
  signOutButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: "#ae4e4e",
    borderRadius: 8,
  },
  signOutButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 'bold',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: "#444", // Darker color to differentiate
    borderRadius: 8,
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  signOutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  topShopsContainer: {
    padding: 10,
  },
  topShopCard: {
    width: 200,
    height: 250,
    marginRight: 10,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  topShopImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  topShopInfo: {
    padding: 10,
  },
  topShopName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  topShopType: {
    fontSize: 14,
    color: '#666',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  shopsGrid: {
    padding: 10,
  },
})

export default HomePage
