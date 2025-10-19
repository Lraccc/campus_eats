import { useState, useEffect, useRef, useMemo } from "react"
import { View, Text, ScrollView, Image, TouchableOpacity, Animated } from "react-native"
import { styled } from "nativewind"
import BottomNavigation from "@/components/BottomNavigation"
import axios from "axios"
import { Ionicons } from '@expo/vector-icons'
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { AUTH_TOKEN_KEY, useAuthentication, getStoredAuthState, clearStoredAuthState } from "../../services/authService"
import { API_URL } from "../../config"

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
  // number of completed orders / purchases
  purchaseCount?: number
  timeOpen?: string;
  timeClose?: string;
}

interface AuthStateShape {
  accessToken: string
  idToken?: string | null
  refreshToken?: string | null
  expiresIn?: number
  issuedAt?: number
  scopes?: string[]
  tokenType?: string
  [key: string]: any
}

interface User {
  id: string
  firstname?: string
  lastname?: string
  username?: string
  email?: string
}

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledScrollView = styled(ScrollView)
const StyledImage = styled(Image)
const StyledTouchableOpacity = styled(TouchableOpacity)

const HomePage = () => {
  const { getAccessToken, signOut, isLoggedIn, authState: rawAuthState } = useAuthentication()
  const authState = rawAuthState as AuthStateShape | null

  // Animation values for loading
  const spinValue = useRef(new Animated.Value(0)).current;
  const circleValue = useRef(new Animated.Value(0)).current;

  const [shops, setShops] = useState<Shop[]>([])
  const [topShops, setTopShops] = useState<Shop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [username, setUsername] = useState<string>("User")
  const [userInfo, setUserInfo] = useState<User | null>(null)

  // Animation values for scroll
  const scrollY = useRef(new Animated.Value(0)).current
  const initialHeaderHeight = 200 // Approximate height of the greeting card

  // Category icons for grid
  const categoryIcons = [
    { name: "Popular", icon: "🔥" },
    { name: "Best Seller", icon: "🏆" },
    { name: "Budget Meal", icon: "💰" },
    { name: "Healthy Food", icon: "🥗" },
    { name: "Open 24 Hours", icon: "🕒" },
    { name: "More", icon: "➕" },
  ]

  useEffect(() => {
    checkAuth()
  }, [isLoggedIn, authState])

  // Map of top shop ids to purchaseCount for fast lookup
  const topShopsMap = useMemo(() => {
    const m: Record<string, number> = {}
    topShops.forEach(s => { if (s && s.id) m[s.id] = s.purchaseCount ?? 0 })
    return m
  }, [topShops])

  const getPurchaseCount = (shop: Shop) => {
    return shop.purchaseCount ?? topShopsMap[shop.id] ?? 0
  }

  // Spinning logo animation
  useEffect(() => {
    const startAnimations = () => {
      spinValue.setValue(0);
      circleValue.setValue(0);
      
      // Start spinning logo
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ).start();

      // Start circular loading line
      Animated.loop(
        Animated.timing(circleValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ).start();
    };

    if (isLoading) {
      startAnimations();
    }
  }, [isLoading, spinValue, circleValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const circleRotation = circleValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isValidTokenFormat = (token: string | null): boolean => {
    if (!token) return false
    const parts = token.split(".")
    return parts.length === 3
  }

  const checkAuth = async () => {
    try {
      console.log("🔍 Performing thorough authentication check")

      const oauthState = await getStoredAuthState()

      console.log("OAuth State from storage:", oauthState ? "Present" : "Not found")
      console.log("isLoggedIn prop value:", isLoggedIn)
      console.log("authState from hook:", authState ? "Present" : "Not found")

      const hasValidOAuthToken = oauthState && oauthState.accessToken && isValidTokenFormat(oauthState.accessToken)

      if (oauthState && (!oauthState.accessToken || !isValidTokenFormat(oauthState.accessToken))) {
        console.warn("❌ Invalid OAuth token format detected, clearing all storage")
        await clearStoredAuthState()
        router.replace("/")
        return
      }

      const traditionalToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY)

      if (traditionalToken && !isValidTokenFormat(traditionalToken)) {
        console.warn("❌ Invalid traditional token format detected, clearing all storage")
        await clearStoredAuthState()
        router.replace("/")
        return
      }

      console.log("📊 Auth Status:", {
        oauthLoggedIn: isLoggedIn,
        hasOAuthToken: !!oauthState?.accessToken,
        hasTraditionalToken: !!traditionalToken,
        hasValidOAuthToken,
      })

      if ((isLoggedIn && authState) || (hasValidOAuthToken && !isLoggedIn)) {
        console.log("✅ User is logged in via OAuth")
        fetchUserInfo()
        fetchShops()
        fetchTopShops()
        setUsername("User")
      } else if (traditionalToken) {
        console.log("User is logged in via traditional login")
        fetchUserInfo()
        fetchShops()
        fetchTopShops()
        setUsername("User")
      } else {
        if (!hasValidOAuthToken) {
          console.log("No valid authentication found. Redirecting to login page...")
          setTimeout(() => {
            router.replace("/")
          }, 100)
        } else {
          console.log("Valid token in storage but hook not ready. Not redirecting yet.")
          fetchShops()
          fetchTopShops()
        }
      }
    } catch (error) {
      console.error("Error checking authentication:", error)
      router.replace("/")
    }
  }

  const fetchUserInfo = async () => {
    try {
      let token = await getAccessToken()

      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)
      }

      if (!token) {
        console.error("No token available for fetching user info")
        return
      }

      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: token },
      })

      const userData = response.data
      setUserInfo(userData)

      // Check if user is banned using the user data from the response
      // The backend already includes ban information in the user data
      if (userData.banned || userData.isBanned || (userData.offenses && userData.offenses >= 3)) {
        console.log('🚨 HomePage: User is banned based on user data, signing out');
        await clearStoredAuthState();
        router.replace('/');
        return;
      } else if (userData.offenses) {
        console.log('HomePage: User offenses:', userData.offenses);
      }

      if (userData.firstname) {
        setUsername(userData.firstname)
      } else if (userData.username) {
        setUsername(userData.username)
      } else {
        setUsername("User")
      }

      console.log("User info fetched successfully")
    } catch (error) {
      console.error("Error fetching user info:", error)
      setUsername("User")
    }
  }

  const fetchShops = async () => {
    setIsLoading(true)
    let token = null
    try {
      token = await getAccessToken()

      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)
        console.log("Using traditional auth token")
      }

      if (!token) {
        console.error("AUTH_TOKEN_MISSING: No token found for fetching shops.")
        setIsLoading(false)
        return
      }

      console.log(`Token format check: ${token.substring(0, 10)}... (length: ${token.length})`)

      const config = { headers: { Authorization: token } }
      console.log(`Fetching shops from ${API_URL}/api/shops/active with raw token...`)
      const response = await axios.get(`${API_URL}/api/shops/active`, config)

      const data = response.data
      console.log("Successfully fetched shops data.")

      const shopsWithRatings = await Promise.all(
          data.map(async (shop: any) => {
            try {
              const ratingResponse = await axios.get(`${API_URL}/api/ratings/shop/${shop.id}`, config)
              const ratings = ratingResponse.data
              const averageRating = calculateAverageRating(ratings)

              // Extract purchaseCount from possible backend fields
              let purchaseCount = 0
              if (typeof shop.completedOrderCount === 'number') purchaseCount = shop.completedOrderCount
              else if (typeof shop.completedOrderCount === 'string') purchaseCount = parseInt(shop.completedOrderCount || '0') || 0
              else if (typeof shop.totalPurchases === 'number') purchaseCount = shop.totalPurchases
              else if (typeof shop.totalOrders === 'number') purchaseCount = shop.totalOrders
              else if (typeof shop.purchaseCount === 'number') purchaseCount = shop.purchaseCount

              // If purchaseCount still 0, try fetching shop detail (some endpoints return completedOrderCount only on detail)
              if (!purchaseCount) {
                try {
                  const detailResp = await axios.get(`${API_URL}/api/shops/${shop.id}`, config)
                  const detail = detailResp.data
                  // detail may be an object or an array-wrapped optional
                  const detailObj = detail && detail.id ? detail : (Array.isArray(detail) && detail[0]) || detail
                  if (detailObj) {
                    if (typeof detailObj.completedOrderCount === 'number') purchaseCount = detailObj.completedOrderCount
                    else if (typeof detailObj.completedOrderCount === 'string') purchaseCount = parseInt(detailObj.completedOrderCount || '0') || purchaseCount
                  }
                } catch (e) {
                  // ignore detail fetch errors, keep purchaseCount as-is
                }
              }

              return { ...shop, averageRating, purchaseCount }
            } catch (error) {
              return { ...shop, averageRating: "N/A", purchaseCount: shop?.completedOrderCount || 0 }
            }
          }),
      )
      setShops(shopsWithRatings)
    } catch (error: any) {
      console.error("FETCH_SHOPS_ERROR: Failed fetching shops.")
      console.error(error)
      setShops([
        {
          id: "mock1",
          name: "Sample Shop",
          type: "Restaurant",
          rating: 4.5,
          imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38",
          categories: ["Fast Food", "Healthy"],
          desc: "A sample shop description",
          averageRating: "4.5",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTopShops = async () => {
    try {
      let token = await getAccessToken()

      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)
        console.log("Using traditional auth token for top shops")
      }

      if (!token) {
        console.error("AUTH_TOKEN_MISSING: No token found for fetching top shops.")
        return
      }

      const config = { headers: { Authorization: token } }
      const response = await axios.get(`${API_URL}/api/shops/top-performing`, config)
      const topShopsData = response.data

      if (!Array.isArray(topShopsData)) {
        console.error("Invalid response format for top shops")
        return
      }

      const topShopsWithRatings = await Promise.all(
          topShopsData.map(async (shop: any) => {
            try {
              const ratingResponse = await axios.get(`${API_URL}/api/ratings/shop/${shop.id}`, config)
              const ratings = ratingResponse.data
              const averageRating = calculateAverageRating(ratings)

              // Primary source: completedOrderCount (from ShopEntity)
              let purchaseCount = 0
              if (typeof shop.completedOrderCount === 'number') purchaseCount = shop.completedOrderCount
              else if (typeof shop.completedOrderCount === 'string') purchaseCount = parseInt(shop.completedOrderCount || '0') || 0
              else if (typeof shop.totalPurchases === 'number') purchaseCount = shop.totalPurchases
              else if (typeof shop.totalOrders === 'number') purchaseCount = shop.totalOrders
              else if (typeof shop.purchaseCount === 'number') purchaseCount = shop.purchaseCount

              return {
                ...shop,
                averageRating,
                purchaseCount,
                imageUrl: shop.imageUrl || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
                categories: shop.categories || ["General"],
                type: shop.type || "Restaurant"
              }
            } catch (error) {
              console.warn(`Failed to fetch ratings for shop ${shop.id}:`, error)
              let purchaseCount = 0
              if (typeof shop.completedOrderCount === 'number') purchaseCount = shop.completedOrderCount
              else if (typeof shop.completedOrderCount === 'string') purchaseCount = parseInt(shop.completedOrderCount || '0') || 0
              else if (typeof shop.totalPurchases === 'number') purchaseCount = shop.totalPurchases
              else if (typeof shop.totalOrders === 'number') purchaseCount = shop.totalOrders
              else if (typeof shop.purchaseCount === 'number') purchaseCount = shop.purchaseCount

              return {
                ...shop,
                averageRating: "N/A",
                purchaseCount,
                imageUrl: shop.imageUrl || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
                categories: shop.categories || ["General"],
                type: shop.type || "Restaurant"
              }
            }
          })
      )

      // Sort by purchaseCount descending and keep top 5
      topShopsWithRatings.sort((a, b) => (b.purchaseCount || 0) - (a.purchaseCount || 0))
      const top5 = topShopsWithRatings.slice(0, 5)
      setTopShops(top5)

      // Merge purchase counts into existing shops state so Explore cards show counts
      try {
        const countsMap: Record<string, number> = {}
        topShopsWithRatings.forEach((s: any) => { countsMap[s.id] = s.purchaseCount || 0 })
        setShops(prev => prev.map(p => ({ ...p, purchaseCount: countsMap[p.id] ?? p.purchaseCount ?? 0 })))
      } catch (e) {
        // ignore merging errors
      }
    } catch (error: any) {
      console.error("FETCH_TOP_SHOPS_ERROR:", error?.response?.data || error.message)
      setTopShops([
        {
          id: "mock2",
          name: "Top Sample Shop",
          type: "Cafe",
          rating: 4.8,
          imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
          categories: ["Cafes", "Desserts"],
          desc: "A top-rated sample shop",
          averageRating: "4.8",
          purchaseCount: 12
        }
      ])
    }
  }

  // Real-time updates: listen to DeviceEventEmitter order updates emitted by webSocketService
  useEffect(() => {
  let intervalId: any = null
  let subscription: any = null
    try {
      const { DeviceEventEmitter } = require('react-native')
      subscription = DeviceEventEmitter.addListener('orderUpdate', (payload: any) => {
        console.log('HomePage received orderUpdate event:', payload)
        // When an order update occurs, re-fetch top shops to reflect changed purchase counts
        fetchTopShops()
      })
    } catch (err) {
      console.log('DeviceEventEmitter not available; falling back to polling for top shops')
    }

    // Polling fallback: refresh every 15 seconds if websocket events aren't available
    intervalId = setInterval(() => {
      fetchTopShops()
    }, 15000)

    return () => {
      if (subscription && subscription.remove) subscription.remove()
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  // Ensure Explore shops reflect any purchase counts discovered in topShops
  useEffect(() => {
    if (!topShops || topShops.length === 0) return
    setShops(prevShops => {
      let changed = false
      const countsMap: Record<string, number> = {}
      topShops.forEach(s => { countsMap[s.id] = s.purchaseCount || 0 })

      const newShops = prevShops.map(s => {
        const newCount = countsMap[s.id] ?? s.purchaseCount ?? 0
        if (s.purchaseCount !== newCount) {
          changed = true
          return { ...s, purchaseCount: newCount }
        }
        return s
      })

      return changed ? newShops : prevShops
    })
  }, [topShops])

  const calculateAverageRating = (ratings: any[]) => {
    if (!ratings || ratings.length === 0) return "No Ratings"
    const total = ratings.reduce((sum, rating) => sum + rating.rate, 0)
    const average = total / ratings.length
    return average.toFixed(1)
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return "Good Morning"
    if (hour < 12) return "Good Morning"
    if (hour < 18) return "Good Afternoon"
    return "Good Evening"
  }

  const handleCardClick = (shopId: string) => {
    router.push({
      pathname: "/shop/[id]",
      params: { id: shopId },
    })
  }

  // Calculate greeting card animations based on scroll position
  const greetingCardTranslateY = scrollY.interpolate({
    inputRange: [0, initialHeaderHeight],
    outputRange: [0, -initialHeaderHeight],
    extrapolate: 'clamp'
  })
  
  // Opacity animation for the greeting card
  const greetingCardOpacity = scrollY.interpolate({
    inputRange: [0, initialHeaderHeight / 2, initialHeaderHeight],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp'
  })

  // Shadow intensity increases as you scroll
  const headerShadowOpacity = scrollY.interpolate({
    inputRange: [0, initialHeaderHeight],
    outputRange: [0.1, 0.3],
    extrapolate: 'clamp'
  })

  if (isLoading && !shops.length) {
    return (
        <StyledView className="flex-1 bg-[#DFD6C5]">
          <StyledView className="flex-1 justify-center items-center">
            <StyledView className="items-center">
              {/* Spinning Logo Container */}
              <StyledView className="relative mb-6">
                {/* Outer rotating circle */}
                <Animated.View
                  style={{
                    transform: [{ rotate: circleRotation }],
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    borderWidth: 2,
                    borderColor: 'rgba(188, 74, 77, 0.2)',
                    borderTopColor: '#BC4A4D',
                    position: 'absolute',
                  }}
                />
                
                {/* Logo container */}
                <StyledView className="w-16 h-16 rounded-full bg-[#BC4A4D]/10 items-center justify-center mx-2 my-2">
                  <Animated.View
                    style={{
                      transform: [{ rotate: spin }],
                    }}
                  >
                    <StyledImage
                      source={require('../../assets/images/logo.png')}
                      className="w-10 h-10 rounded-full"
                      style={{ resizeMode: 'contain' }}
                    />
                  </Animated.View>
                </StyledView>
              </StyledView>
              
              {/* Brand Name */}
              <StyledText className="text-lg font-bold mb-4">
                <StyledText className="text-[#BC4A4D]">Campus</StyledText>
                <StyledText className="text-[#DAA520]">Eats</StyledText>
              </StyledText>
              
              {/* Loading Text */}
              <StyledText className="text-[#BC4A4D] text-base font-semibold">
                Loading...
              </StyledText>
            </StyledView>
          </StyledView>
          <BottomNavigation activeTab="Home" />
        </StyledView>
    )
  }

  return (
      <StyledView className="flex-1 bg-[#DFD6C5]">
        {/* Fixed App Title Header - Always visible */}
        <View 
            style={{
              backgroundColor: '#ffffff',
              paddingTop: 12,
              paddingBottom: 12,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              zIndex: 10,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
        >
          {/* App Title - Always Visible */}
          <StyledView className="items-center py-4">
            <StyledText
                className="text-3xl font-black tracking-wide"
                style={{
                  color: '#8B4513',
                  textShadowColor: 'rgba(139, 69, 19, 0.1)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 4,
                }}
            >
              <StyledText style={{ color: '#BC4A4D' }}>Campus</StyledText>
              <StyledText style={{ color: '#DAA520' }}>Eats</StyledText>
            </StyledText>
            <StyledView className="w-16 h-1 bg-[#BC4A4D] rounded-full mt-2" />
          </StyledView>
        </View>
        
        {/* Animated Greeting Card Container - slides up and disappears */}
        <Animated.View 
            style={{
              position: 'absolute',
              top: 80, // Position below the fixed app title header
              left: 0,
              right: 0,
              zIndex: 9,
              transform: [{ translateY: greetingCardTranslateY }],
              opacity: greetingCardOpacity
            }}
        >    
          <View 
              style={{
                backgroundColor: '#ffffff',
                borderBottomLeftRadius: 24,
                borderBottomRightRadius: 24,
                padding: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 3,
              }}
          >
            <View 
              style={{
                backgroundColor: '#BC4A4D',
                marginTop: 15,
                borderRadius: 20,
                padding: 24,
                marginHorizontal: 20,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                shadowColor: "#BC4A4D",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }}
          >
            <StyledView className="flex-1 pr-4">
              <StyledText className="text-white text-xl font-bold mb-3">
                {getGreeting()}, {username}! 👋
              </StyledText>
              <StyledText className="text-white/90 text-base leading-6 font-medium">
                What delicious meal are you craving today?
              </StyledText>
            </StyledView>
            <StyledView
                className="w-16 h-16 rounded-2xl bg-white justify-center items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  elevation: 4,
                }}
            >
              <StyledText className="text-4xl">🍔</StyledText>
            </StyledView>
          </View>
          </View>
        </Animated.View>

        <Animated.ScrollView 
            style={{
              paddingTop: 170, // Account for fixed header + greeting card height
            }}
            className="flex-1" 
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
        >
          {/* Enhanced Most Purchase Shop Section (moved to top) */}
          <StyledView className="mb-8 px-5 mt-8">
            <StyledView className="flex-row justify-between items-center mb-6">
              <StyledView>
                <StyledText className="text-2xl font-bold text-[#8B4513] mb-2"
                            style={{
                              marginTop: 100
                            }}>
                  Recommended for you
                </StyledText>
                <StyledText className="text-[#8B4513]/70 text-base font-medium">
                  Most loved by students
                </StyledText>
              </StyledView>
            </StyledView>

            <StyledScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <StyledView className="flex-row pl-2">
                {topShops.map((shop, index) => (
                    <StyledTouchableOpacity
                        key={shop.id}
                        className="mr-6 items-center"
                        onPress={() => handleCardClick(shop.id)}
                        activeOpacity={0.8}
                    >
                      <StyledView
                          className="w-28 h-28 rounded-2xl overflow-hidden mb-3 bg-white"
                          style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.15,
                            shadowRadius: 12,
                            elevation: 6,
                          }}
                      >
                        <StyledImage
                            source={{ uri: shop.imageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                      </StyledView>
                      <StyledText
                          className="text-center text-sm font-bold text-[#8B4513] w-28 mb-1"
                          numberOfLines={2}
                      >
                        {shop.name}
                      </StyledText>
                      {/* Rating below shop name */}
                      <StyledView className="flex-row items-center justify-center">
                        {shop.averageRating !== "No Ratings" && (
                          <>
                            <StyledText className="text-[#DAA520] text-xs mr-1">★</StyledText>
                            <StyledText className="text-[#8B4513] text-xs font-medium">
                              {shop.averageRating}
                            </StyledText>
                          </>
                        )}
                        {/* Purchase badge on horizontal card */}
                        <StyledView className="ml-3 justify-center">
                          <StyledView className="flex-row items-center bg-[#BC4A4D]/10 px-2 py-1 rounded-md">
                            <Ionicons name="people" size={12} color="#BC4A4D" style={{ marginRight: 6 }} />
                            <StyledText className="text-xs text-[#8B4513] font-semibold">
                              {getPurchaseCount(shop)}
                            </StyledText>
                          </StyledView>
                        </StyledView>
                      </StyledView>
                    </StyledTouchableOpacity>
                ))}
              </StyledView>
            </StyledScrollView>
          </StyledView>

          {/* Enhanced Shops Section (moved below) */}
          <StyledView className="px-5 pb-40">
            <StyledView className="flex-row justify-between items-center mb-6">
              <StyledView>
                <StyledText className="text-2xl font-bold text-[#8B4513] mb-2">
                  Explore Shops
                </StyledText>
                <StyledText className="text-[#8B4513]/70 text-base font-medium">
                  Discover amazing places to eat
                </StyledText>
              </StyledView>
            </StyledView>

            <StyledView className="space-y-3">
                {shops.map((shop, index) => (
                  <StyledTouchableOpacity
                      key={shop.id}
                      className="bg-white rounded-xl overflow-hidden mb-4"
                      style={{
                        shadowColor: "#8B4513",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.12,
                        shadowRadius: 12,
                        elevation: 6,
                        borderWidth: 1,
                        borderColor: 'rgba(139, 69, 19, 0.06)',
                      }}
                      onPress={() => handleCardClick(shop.id)}
                      activeOpacity={0.9}
                  >
                    {/* Image on top */}
                    <StyledView className="w-full h-40 bg-gray-100">
                      <StyledImage
                          source={{ uri: shop.imageUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                      />

                      {/* Floating purchase badge on image */}
                      <StyledView style={{ position: 'absolute', top: 10, right: 10 }}>
                        <StyledView className="flex-row items-center bg-white/90 px-3 py-1 rounded-full" style={{ alignItems: 'center' }}>
                          <Ionicons name="people" size={14} color="#BC4A4D" style={{ marginRight: 8 }} />
                          <StyledText className="text-sm text-[#8B4513] font-semibold">
                            {getPurchaseCount(shop)} purchased
                          </StyledText>
                        </StyledView>
                      </StyledView>
                    </StyledView>

                    {/* Details below image */}
                    <StyledView className="p-4">
                      <StyledText className="text-lg font-bold text-[#8B4513] mb-1">
                        {shop.name}
                      </StyledText>
                      {/* Shop open/close times */}
                      {shop.timeOpen && shop.timeClose && (
                        <StyledText className="text-[#BC4A4D] text-xs font-semibold mb-1">
                          Hours: {shop.timeOpen} - {shop.timeClose}
                        </StyledText>
                      )}

                      <StyledView className="flex-row items-center mb-2">
                        {shop.averageRating !== "No Ratings" && (
                          <>
                            <StyledText className="text-[#DAA520] text-sm mr-1 font-bold">★</StyledText>
                            <StyledText className="text-[#8B4513] text-sm font-semibold">
                              {shop.averageRating}
                            </StyledText>
                          </>
                        )}
                      </StyledView>

                      <StyledView className="flex-row items-center justify-between">
                        <StyledView className="flex-row">
                          {shop.categories.slice(0, 2).map((category, idx) => (
                              <StyledView key={idx} className="bg-[#BC4A4D]/10 px-2 py-1 rounded-md mr-2">
                                <StyledText className="text-xs text-[#BC4A4D] font-medium">
                                  {category}
                                </StyledText>
                              </StyledView>
                          ))}
                          {shop.categories.length > 2 && (
                            <StyledView className="bg-[#8B4513]/10 px-2 py-1 rounded-md">
                              <StyledText className="text-xs text-[#8B4513]/70 font-medium">
                                +{shop.categories.length - 2} more
                              </StyledText>
                            </StyledView>
                          )}
                        </StyledView>

                        <StyledView>
                          <StyledText className="text-sm text-[#8B4513]/70">
                            {shop.desc ? shop.desc.slice(0, 40) + (shop.desc.length > 40 ? '...' : '') : ''}
                          </StyledText>
                        </StyledView>
                      </StyledView>
                    </StyledView>
                  </StyledTouchableOpacity>
                ))}
            </StyledView>
          </StyledView>
        </Animated.ScrollView>
        <BottomNavigation activeTab="Home" />
      </StyledView>
  )
}

export default HomePage;