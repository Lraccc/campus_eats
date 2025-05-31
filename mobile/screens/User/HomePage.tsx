import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from "react-native"
import BottomNavigation from "@/components/BottomNavigation"
import axios from "axios"
import { router } from "expo-router"
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY, useAuthentication, getStoredAuthState, clearStoredAuthState } from '../../services/authService';
import { API_URL } from '../../config';

type RootStackParamList = {
  ShopDetails: { shopId: string }
}

interface Shop {
  id: string
  name: string
  type: string
  rating: number
  imageUrl: string
  categories: string[]
  desc: string
  averageRating?: string
}

interface AuthStateShape {
  accessToken: string;
  idToken?: string | null;
  refreshToken?: string | null;
  expiresIn?: number;
  issuedAt?: number;
  scopes?: string[];
  tokenType?: string;
  [key: string]: any;
}

interface User {
  id: string;
  firstname?: string;
  lastname?: string;
  username?: string;
  email?: string;
}

const HomePage = () => {
  const { getAccessToken, signOut, isLoggedIn, authState: rawAuthState } = useAuthentication();
  const authState = rawAuthState as AuthStateShape | null;

  const [shops, setShops] = useState<Shop[]>([])
  const [topShops, setTopShops] = useState<Shop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [username, setUsername] = useState<string>("User")
  const [userInfo, setUserInfo] = useState<User | null>(null);

  useEffect(() => {
    checkAuth();
  }, [isLoggedIn, authState]);

  const isValidTokenFormat = (token: string | null): boolean => {
    if (!token) return false;
    const parts = token.split('.');
    return parts.length === 3;
  };

  const checkAuth = async () => {
    try {
      console.log("🔍 Performing thorough authentication check");

      const oauthState = await getStoredAuthState();

      console.log("OAuth State from storage:", oauthState ? "Present" : "Not found");
      console.log("isLoggedIn prop value:", isLoggedIn);
      console.log("authState from hook:", authState ? "Present" : "Not found");

      const hasValidOAuthToken = oauthState && oauthState.accessToken && isValidTokenFormat(oauthState.accessToken);

      if (oauthState && (!oauthState.accessToken || !isValidTokenFormat(oauthState.accessToken))) {
        console.warn("❌ Invalid OAuth token format detected, clearing all storage");
        await clearStoredAuthState();
        router.replace('/');
        return;
      }

      const traditionalToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

      if (traditionalToken && !isValidTokenFormat(traditionalToken)) {
        console.warn("❌ Invalid traditional token format detected, clearing all storage");
        await clearStoredAuthState();
        router.replace('/');
        return;
      }

      console.log("📊 Auth Status:", {
        oauthLoggedIn: isLoggedIn,
        hasOAuthToken: !!oauthState?.accessToken,
        hasTraditionalToken: !!traditionalToken,
        hasValidOAuthToken
      });

      if ((isLoggedIn && authState) || (hasValidOAuthToken && !isLoggedIn)) {
        console.log("✅ User is logged in via OAuth");
        fetchUserInfo();
        fetchShops();
        fetchTopShops();
        setUsername("User");
      } else if (traditionalToken) {
        console.log("User is logged in via traditional login");
        fetchUserInfo();
        fetchShops();
        fetchTopShops();
        setUsername("User");
      } else {
        if (!hasValidOAuthToken) {
          console.log("No valid authentication found. Redirecting to login page...");
          setTimeout(() => {
            router.replace('/');
          }, 100);
        } else {
          console.log("Valid token in storage but hook not ready. Not redirecting yet.");
          fetchShops();
          fetchTopShops();
        }
      }
    } catch (error) {
      console.error("Error checking authentication:", error);
      router.replace('/');
    }
  };

  const fetchUserInfo = async () => {
    try {
      let token = await getAccessToken();

      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available for fetching user info");
        return;
      }

      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: token }
      });

      const userData = response.data;
      setUserInfo(userData);

      if (userData.firstname) {
        setUsername(userData.firstname);
      } else if (userData.username) {
        setUsername(userData.username);
      } else {
        setUsername("User");
      }

      console.log("User info fetched successfully");
    } catch (error) {
      console.log("Error fetching user info:", error);
      setUsername("User");
    }
  };

  const fetchShops = async () => {
    setIsLoading(true)
    let token = null;
    try {
      token = await getAccessToken();

      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        console.log("Using traditional auth token");
      }

      if (!token) {
        console.error("AUTH_TOKEN_MISSING: No token found for fetching shops.");
        setIsLoading(false);
        return;
      }

      console.log(`Token format check: ${token.substring(0, 10)}... (length: ${token.length})`);

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
      setShops([
        {
          id: "mock1",
          name: "Sample Shop",
          type: "Restaurant",
          rating: 4.5,
          imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38",
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
      let token = await getAccessToken();

      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        console.log("Using traditional auth token for top shops");
      }

      if (!token) {
        console.error("AUTH_TOKEN_MISSING: No token found for fetching top shops.");
        return;
      }

      console.log(`Token format check: ${token.substring(0, 10)}... (length: ${token.length})`);

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
      setTopShops([
        {
          id: "mock2",
          name: "Top Sample Shop",
          type: "Cafe",
          rating: 4.8,
          imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
          categories: ["Cafes", "Desserts"],
          desc: "A top-rated sample shop",
          averageRating: "4.8"
        }
      ]);
    }
  };

  const calculateAverageRating = (ratings: any[]) => {
    if (!ratings || ratings.length === 0) return "No Ratings"
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
    router.push({
      pathname: "/shop/[id]",
      params: { id: shopId }
    });
  }

  if (isLoading && !shops.length) {
    return (
        <View style={styles.container}>
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.appTitleContainer}>
              <Text style={styles.appTitle}>Campus Eats</Text>
            </View>


            <View style={styles.greetingBanner}>
              <View style={styles.greetingContent}>
                <Text style={styles.greetingText}>{getGreeting()}, {username}!</Text>
                <Text style={styles.greetingSubtext}>What would you like to eat today?</Text>
              </View>
              <View style={styles.greetingImageContainer}>
                <Text style={styles.greetingEmoji}>🍔</Text>
              </View>
            </View>
          </View>

          {/* Featured Section */}
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 Trending Now</Text>
              <Text style={styles.sectionSubtitle}>Most popular choices</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollView}>
              <View style={styles.featuredGrid}>
                {topShops.map((shop, index) => (
                    <TouchableOpacity key={shop.id} style={[styles.featuredCard, index === 0 && styles.firstCard]} onPress={() => handleCardClick(shop.id)}>
                      <View style={styles.featuredImageContainer}>
                        <Image source={{ uri: shop.imageUrl }} style={styles.featuredImage} />
                        <View style={styles.featuredBadge}>
                          <Text style={styles.featuredBadgeText}>#{index + 1}</Text>
                        </View>
                      </View>
                      <View style={styles.featuredInfo}>
                        <Text style={styles.featuredName}>{shop.name}</Text>
                        <View style={styles.featuredRating}>
                          {shop.averageRating && shop.averageRating !== "No Ratings" ? (
                              <>
                                <Text style={styles.starIcon}>⭐</Text>
                                <Text style={styles.ratingText}>{shop.averageRating}</Text>
                              </>
                          ) : (
                              <Text style={styles.noRatingText}>New</Text>
                          )}
                        </View>
                        <View style={styles.featuredCategories}>
                          {shop.categories.slice(0, 2).map((category, idx) => (
                              <Text key={idx} style={styles.featuredCategoryTag}>
                                {category}
                              </Text>
                          ))}
                        </View>
                      </View>
                    </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* All Shops Section */}
          <View style={styles.allShopsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🏪 All Shops</Text>
              <Text style={styles.sectionSubtitle}>Explore all available options</Text>
            </View>

            <View style={styles.shopsGrid}>
              {shops.map((shop) => (
                  <TouchableOpacity key={shop.id} style={styles.shopCard} onPress={() => handleCardClick(shop.id)}>
                    <View style={styles.shopImageContainer}>
                      <Image source={{ uri: shop.imageUrl }} style={styles.shopImage} />
                      <View style={styles.shopOverlay}>
                        <View style={styles.shopRatingBadge}>
                          {shop.averageRating && shop.averageRating !== "No Ratings" ? (
                              <>
                                <Text style={styles.shopStarIcon}>⭐</Text>
                                <Text style={styles.shopRatingText}>{shop.averageRating}</Text>
                              </>
                          ) : (
                              <Text style={styles.shopNewText}>NEW</Text>
                          )}
                        </View>
                      </View>
                    </View>
                    <View style={styles.shopInfo}>
                      <Text style={styles.shopName}>{shop.name}</Text>
                      <Text style={styles.shopType}>{shop.type}</Text>
                      <View style={styles.shopCategories}>
                        {shop.categories.slice(0, 3).map((category, idx) => (
                            <Text key={idx} style={styles.shopCategoryTag}>
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
const featuredCardWidth = width * 0.75
const shopCardWidth = (width - 45) / 2

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#DFD6C5",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIndicator: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: "#FFFAF1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#bbb4a7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8B4513",
    marginTop: 10,
  },

  // New Header Styles
  headerSection: {
    backgroundColor: "#FFFAF1",
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#bbb4a7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  appTitleContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#8B4513",
  },
  searchBarContainer: {
    marginBottom: 20,
  },
  searchBar: {
    backgroundColor: "#DFD6C5",
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchPlaceholder: {
    color: "#8B4513",
    opacity: 0.6,
    fontSize: 16,
  },
  greetingBanner: {
    backgroundColor: "#8B4513",
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greetingContent: {
    flex: 1,
  },
  greetingText: {
    color: "#FFFAF1",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  greetingSubtext: {
    color: "#FFFAF1",
    opacity: 0.8,
    fontSize: 14,
  },
  greetingImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFAF1",
    justifyContent: "center",
    alignItems: "center",
  },
  greetingEmoji: {
    fontSize: 30,
  },
  featuredSection: {
    marginTop: 25,
    marginBottom: 30,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#8B4513",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  horizontalScrollView: {
    paddingLeft: 20,
  },
  featuredGrid: {
    flexDirection: "row",
    paddingRight: 20,
  },
  featuredCard: {
    width: featuredCardWidth,
    marginRight: 15,
    borderRadius: 20,
    backgroundColor: "#FFFAF1",
    shadowColor: "#bbb4a7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  firstCard: {
    borderWidth: 2,
    borderColor: "#8B4513",
  },
  featuredImageContainer: {
    height: 180,
    position: "relative",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  featuredBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#8B4513",
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featuredBadgeText: {
    color: "#FFFAF1",
    fontSize: 12,
    fontWeight: "bold",
  },
  featuredInfo: {
    padding: 16,
  },
  featuredName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#8B4513",
    marginBottom: 8,
  },
  featuredRating: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  starIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  noRatingText: {
    fontSize: 12,
    color: "#8B4513",
    fontWeight: "600",
    backgroundColor: "#DFD6C5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  featuredCategories: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  featuredCategoryTag: {
    fontSize: 12,
    color: "#8B4513",
    backgroundColor: "#DFD6C5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
    fontWeight: "500",
  },

  // All Shops Section
  allShopsSection: {
    paddingHorizontal: 20,
  },
  shopsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  shopCard: {
    width: shopCardWidth,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: "#FFFAF1",
    shadowColor: "#bbb4a7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  shopImageContainer: {
    height: 120,
    position: "relative",
  },
  shopImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  shopOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    padding: 8,
  },
  shopRatingBadge: {
    backgroundColor: "rgba(255, 250, 241, 0.95)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  shopStarIcon: {
    fontSize: 12,
    marginRight: 2,
  },
  shopRatingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  shopNewText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#8B4513",
  },
  shopInfo: {
    padding: 12,
  },
  shopName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#8B4513",
    marginBottom: 4,
  },
  shopType: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  shopCategories: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  shopCategoryTag: {
    fontSize: 10,
    color: "#8B4513",
    backgroundColor: "#DFD6C5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 2,
    fontWeight: "500",
  },
})

export default HomePage;