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
          {/* App Title */}
          <View style={styles.appTitleContainer}>
            <Text style={styles.appTitle}>Campus Eats</Text>
          </View>

          {/* Greeting Section */}
          <View style={styles.titleSection}>
            <Text style={styles.titleText}>
              {getGreeting()}, {username}!
            </Text>
            <Text style={styles.subtitleText}>Start Simplifying Your Campus Cravings!</Text>
          </View>

          {/* Most Purchase Shop Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Most Purchase Shop</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollView}>
              <View style={styles.shopGrid}>
                {topShops.map((shop) => (
                    <TouchableOpacity key={shop.id} style={styles.shopCard} onPress={() => handleCardClick(shop.id)}>
                      <View style={styles.imageContainer}>
                        <Image source={{ uri: shop.imageUrl }} style={styles.shopImage} />
                      </View>
                      <View style={styles.shopInfo}>
                        <Text style={styles.shopName}>{shop.name}</Text>
                        <View style={styles.ratingContainer}>
                          <Text style={styles.shopRating}>
                            {shop.averageRating && shop.averageRating !== "No Ratings" ? (
                                <>
                                  <Text style={styles.starIcon}>★</Text> {shop.averageRating}
                                </>
                            ) : (
                                "No Ratings"
                            )}
                          </Text>
                        </View>
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
            </ScrollView>
          </View>

          {/* Available Shops Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Shops</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollView}>
              <View style={styles.shopGrid}>
                {shops.map((shop) => (
                    <TouchableOpacity key={shop.id} style={styles.shopCard} onPress={() => handleCardClick(shop.id)}>
                      <View style={styles.imageContainer}>
                        <Image source={{ uri: shop.imageUrl }} style={styles.shopImage} />
                      </View>
                      <View style={styles.shopInfo}>
                        <Text style={styles.shopName}>{shop.name}</Text>
                        <View style={styles.ratingContainer}>
                          <Text style={styles.shopRating}>
                            {shop.averageRating && shop.averageRating !== "No Ratings" ? (
                                <>
                                  <Text style={styles.starIcon}>★</Text> {shop.averageRating}
                                </>
                            ) : (
                                "No Ratings"
                            )}
                          </Text>
                        </View>
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
            </ScrollView>
          </View>
        </ScrollView>
        <BottomNavigation activeTab="Home" />
      </View>
  )
}

const { width } = Dimensions.get("window")
const cardWidth = (width - 50) / 2

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#DFD6C5",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingTop: 20,
    paddingBottom: 80,
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
  shopGrid: {
    flexDirection: "row",
    paddingHorizontal: 15,
  },
  shopCard: {
    width: cardWidth,
    marginRight: 15,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#FFFAF1",
    shadowColor: "#bbb4a7",
    shadowOffset: { width: 7, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 5,
  },
  imageContainer: {
    width: "100%",
    height: 150,
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
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  shopRating: {
    fontSize: 14,
    color: '#666',
  },
  starIcon: {
    color: '#FFD700',
    fontSize: 16,
    marginRight: 4,
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
  appTitleContainer: {
    marginTop: 10,
    marginBottom: 15,
    alignItems: "center",
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#8B4513",
  },
  horizontalScrollView: {
    marginHorizontal: -15,
  },
})

export default HomePage