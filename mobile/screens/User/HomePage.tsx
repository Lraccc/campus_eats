import { useState, useEffect } from "react"
import { View, Text, ScrollView, Image, TouchableOpacity } from "react-native"
import { styled } from "nativewind"
import BottomNavigation from "@/components/BottomNavigation"
import axios from "axios"
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

  const [shops, setShops] = useState<Shop[]>([])
  const [topShops, setTopShops] = useState<Shop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [username, setUsername] = useState<string>("User")
  const [userInfo, setUserInfo] = useState<User | null>(null)

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
          topShopsData.map(async (shop: Shop) => {
            try {
              const ratingResponse = await axios.get(`${API_URL}/api/ratings/shop/${shop.id}`, config)
              const ratings = ratingResponse.data
              const averageRating = calculateAverageRating(ratings)
              return {
                ...shop,
                averageRating,
                imageUrl: shop.imageUrl || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
                categories: shop.categories || ["General"],
                type: shop.type || "Restaurant"
              }
            } catch (error) {
              console.warn(`Failed to fetch ratings for shop ${shop.id}:`, error)
              return {
                ...shop,
                averageRating: "N/A",
                imageUrl: shop.imageUrl || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
                categories: shop.categories || ["General"],
                type: shop.type || "Restaurant"
              }
            }
          })
      )

      setTopShops(topShopsWithRatings)
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
          averageRating: "4.8"
        }
      ])
    }
  }

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
      params: { id: shopId },
    })
  }

  if (isLoading && !shops.length) {
    return (
        <StyledView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
          <StyledView className="flex-1 justify-center items-center">
            <StyledView
                className="w-32 h-32 rounded-3xl bg-white/90 justify-center items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 8,
                }}
            >
              <StyledText className="text-2xl mb-2">🍽️</StyledText>
              <StyledText className="text-lg font-bold text-gray-900">Loading...</StyledText>
              <StyledText className="text-sm text-gray-600 mt-1">Finding delicious food</StyledText>
            </StyledView>
          </StyledView>
          <BottomNavigation activeTab="Home" />
        </StyledView>
    )
  }

  return (
      <StyledView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
        {/* Enhanced Header Section */}
        <StyledView
            className="bg-white pt-12 pb-6 px-6 rounded-b-3xl"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 8,
            }}
        >
          {/* App Title */}
          <StyledView className="items-center mb-6">
            <StyledText
                className="text-3xl font-black text-gray-900 tracking-wide"
                style={{
                  textShadowColor: 'rgba(0, 0, 0, 0.1)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 4,
                }}
            >
              Campus Eats
            </StyledText>
            <StyledView className="w-16 h-1 bg-gray-300 rounded-full mt-2" />
          </StyledView>

          {/* Greeting Card */}
          <StyledView
              className="rounded-3xl p-6 flex-row justify-between items-center"
              style={{ backgroundColor: '#BC4A4D' }}
          >
            <StyledView className="flex-1 pr-4">
              <StyledText className="text-white text-xl font-bold mb-2">
                {getGreeting()}, {username}! 👋
              </StyledText>
              <StyledText className="text-white/90 text-sm leading-5">
                What delicious meal are you craving today?
              </StyledText>
            </StyledView>
            <StyledView
                className="w-14 h-14 rounded-2xl bg-white justify-center items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
            >
              <StyledText className="text-3xl">🍔</StyledText>
            </StyledView>
          </StyledView>
        </StyledView>

        <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Enhanced Shops Section */}
          <StyledView className="mb-8 px-6 mt-8">
            <StyledView className="flex-row justify-between items-center mb-6">
              <StyledView>
                <StyledText className="text-2xl font-bold text-gray-900 mb-1">
                  Available Shops
                </StyledText>
                <StyledText className="text-gray-600 text-sm">
                  Discover amazing places to eat
                </StyledText>
              </StyledView>

            </StyledView>

            <StyledScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <StyledView className="flex-row pl-2">
                {shops.map((shop, index) => (
                    <StyledTouchableOpacity
                        key={shop.id}
                        className="mr-6 items-center"
                        onPress={() => handleCardClick(shop.id)}
                        activeOpacity={0.8}
                    >
                      <StyledView
                          className="w-24 h-24 rounded-2xl overflow-hidden mb-3 bg-white"
                          style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 5,
                          }}
                      >
                        <StyledImage
                            source={{ uri: shop.imageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                        {/* Rating badge */}
                        <StyledView
                            className="absolute top-2 right-2 px-2 py-1 rounded-full"
                            style={{ backgroundColor: '#BC4A4D' }}
                        >
                          <StyledText className="text-white text-xs font-bold">
                            ⭐ {shop.averageRating !== "No Ratings" ? shop.averageRating : "N/A"}
                          </StyledText>
                        </StyledView>
                      </StyledView>
                      <StyledText
                          className="text-center text-sm font-semibold text-gray-900 w-24"
                          numberOfLines={2}
                      >
                        {shop.name}
                      </StyledText>
                    </StyledTouchableOpacity>
                ))}
              </StyledView>
            </StyledScrollView>
          </StyledView>

          {/* Enhanced Most Purchase Shop Section */}
          <StyledView className="px-6 pb-24">
            <StyledView className="flex-row justify-between items-center mb-6">
              <StyledView>
                <StyledText className="text-2xl font-bold text-gray-900 mb-1">
                  Top Rated Shops
                </StyledText>
                <StyledText className="text-gray-600 text-sm">
                  Most loved by students
                </StyledText>
              </StyledView>

            </StyledView>

            <StyledView className="space-y-4">
              {topShops.map((shop, index) => (
                  <StyledTouchableOpacity
                      key={shop.id}
                      className="bg-white rounded-2xl overflow-hidden flex-row mb-4"
                      style={{
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 4,
                      }}
                      onPress={() => handleCardClick(shop.id)}
                      activeOpacity={0.9}
                  >
                    <StyledView className="relative">
                      <StyledImage
                          source={{ uri: shop.imageUrl }}
                          className="w-28 h-28"
                          resizeMode="cover"
                      />
                      {/* Trending badge */}
                      <StyledView
                          className="absolute top-3 left-3 px-2 py-1 rounded-full"
                          style={{ backgroundColor: '#BC4A4D' }}
                      >
                        <StyledText className="text-white text-xs font-bold">
                          #{index + 1}
                        </StyledText>
                      </StyledView>
                    </StyledView>

                    <StyledView className="flex-1 p-4 justify-center">
                      <StyledText className="text-lg font-bold text-gray-900 mb-2">
                        {shop.name}
                      </StyledText>

                      <StyledView className="flex-row items-center mb-2">
                        <StyledView className="flex-row items-center bg-yellow-100 px-2 py-1 rounded-full mr-3">
                          <StyledText className="text-yellow-600 text-sm mr-1">★</StyledText>
                          <StyledText className="text-gray-900 text-sm font-semibold">
                            {shop.averageRating !== "No Ratings" ? shop.averageRating : "N/A"}
                          </StyledText>
                        </StyledView>
                        <StyledView className="bg-gray-100 px-2 py-1 rounded-full">
                          <StyledText className="text-gray-700 text-xs font-medium">
                            {shop.type}
                          </StyledText>
                        </StyledView>
                      </StyledView>

                      <StyledView className="flex-row flex-wrap">
                        {shop.categories.slice(0, 2).map((category, idx) => (
                            <StyledView key={idx} className="bg-gray-50 px-2 py-1 rounded-full mr-2 mb-1">
                              <StyledText className="text-xs text-gray-600 font-medium">
                                {category}
                              </StyledText>
                            </StyledView>
                        ))}
                      </StyledView>
                    </StyledView>
                  </StyledTouchableOpacity>
              ))}
            </StyledView>
          </StyledView>
        </StyledScrollView>
        <BottomNavigation activeTab="Home" />
      </StyledView>
  )
}

export default HomePage;