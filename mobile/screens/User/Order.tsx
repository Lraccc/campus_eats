import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert, TextInput, SafeAreaView, StatusBar } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useState, useEffect, useRef } from "react"
import { getAuthToken, AUTH_TOKEN_KEY } from "../../services/authService"
import { API_URL } from "../../config"
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import BottomNavigation from "../../components/BottomNavigation"
import { useRouter } from "expo-router"
import DeliveryMap from "../../components/Map/DeliveryMap"
import { styled } from "nativewind"

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledImage = styled(Image)
const StyledScrollView = styled(ScrollView)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)
const StyledSafeAreaView = styled(SafeAreaView)

// Import AUTH_STORAGE_KEY constant
const AUTH_STORAGE_KEY = '@CampusEats:Auth'

const { width } = Dimensions.get("window")

// Define types for our data
interface CartItem {
    name: string;
    quantity: number;
    price: number;
}

interface ShopData {
    name: string;
    address: string;
    imageUrl: string;
    deliveryFee: number;
}

interface OrderItem {
    id: string;
    deliverTo: string;
    paymentMethod: string;
    mobileNum: string;
    totalPrice: number;
    items: CartItem[];
    status: string;
    createdAt: string;
    shopId?: string;
    dasherId?: string;
    shopData?: ShopData;
}

// Create axios instance with base URL
const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

const Order = () => {
    const [activeOrder, setActiveOrder] = useState<OrderItem | null>(null)
    const [orders, setOrders] = useState<OrderItem[]>([])
    const [shop, setShop] = useState<ShopData | null>(null)
    const [dasherName, setDasherName] = useState("")
    const [dasherPhone, setDasherPhone] = useState("")
    const [status, setStatus] = useState("")
    const [loading, setLoading] = useState(true)
    const [offenses, setOffenses] = useState(0)
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [cancelling, setCancelling] = useState(false)
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [rating, setRating] = useState(0)
    const [reviewText, setReviewText] = useState('')
    const [isSubmittingReview, setIsSubmittingReview] = useState(false)
    const [showShopReviewModal, setShowShopReviewModal] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null)
    const [shopRating, setShopRating] = useState(0)
    const [shopReviewText, setShopReviewText] = useState('')
    const [isSubmittingShopReview, setIsSubmittingShopReview] = useState(false)
    const [showEditPhoneModal, setShowEditPhoneModal] = useState(false)
    const [newPhoneNumber, setNewPhoneNumber] = useState('')
    const [isUpdatingPhone, setIsUpdatingPhone] = useState(false)
    const router = useRouter()

    // Polling interval for order updates (in milliseconds)
    const POLLING_INTERVAL = 5000; // 5 seconds

    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true);

    // Track if user is logged in
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Check login status
    useEffect(() => {
        const checkLoginStatus = async () => {
            try {
                const token = await AsyncStorage.getItem('@CampusEats:AuthToken');
                const userId = await AsyncStorage.getItem('userId');
                setIsLoggedIn(!!(token && userId));
            } catch (error) {
                console.error('Error checking login status:', error);
                setIsLoggedIn(false);
            }
        };

        checkLoginStatus();

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Set up polling only when logged in
    useEffect(() => {
        // Only proceed if logged in
        if (!isLoggedIn) return;

        // Initial fetch
        fetchOrders();

        // Set up polling for order updates
        const pollingInterval = setInterval(() => {
            // Only fetch if still logged in
            if (isLoggedIn) {
                fetchOrders(false); // Pass false to indicate this is a background refresh
            }
        }, POLLING_INTERVAL);

        // Clean up interval on component unmount or when logged out
        return () => {
            clearInterval(pollingInterval);
            console.log('Order polling stopped');
        };
    }, [isLoggedIn])

    const fetchOrders = async (showLoadingIndicator = true) => {
        // Skip if component is unmounted
        if (!isMountedRef.current) return;

        // Only show loading indicator for manual refreshes, not background polling
        try {
            if (showLoadingIndicator) {
                setLoading(true);
            }

            // First try to get the token using the auth service to ensure we get the most up-to-date token
            let token = await getAuthToken();
            // If that fails, try the direct AsyncStorage approach as fallback
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            const userId = await AsyncStorage.getItem('userId');

            if (!userId || !token) {
                // Only log once and don't redirect if this is a background refresh
                if (showLoadingIndicator) {
                    console.error("Missing required data:", { userId: !!userId, token: !!token });
                    setLoading(false);
                    setIsLoggedIn(false); // Update login status
                    router.replace('/');
                }
                return;
            }

            // Update login status
            if (!isLoggedIn) {
                setIsLoggedIn(true);
            }

            // Set the authorization header with Bearer token
            // IMPORTANT: This backend expects the raw token without 'Bearer ' prefix
            axiosInstance.defaults.headers.common['Authorization'] = token

            // First verify the token is valid by getting current user
            try {
                // Add retry logic for token validation
                let retryCount = 0;
                const maxRetries = 2;
                let userResponse;

                while (retryCount <= maxRetries) {
                    try {
                        userResponse = await axiosInstance.get('/api/users/me')
                        break; // If successful, break the loop
                    } catch (error: any) {
                        if (error.response?.status === 401 && retryCount < maxRetries) {
                            // Token might be expired, try to refresh
                            console.log("Token might be expired, attempting to refresh...")
                            // Try to get a fresh token using the auth service
                            const freshToken = await getAuthToken()
                            if (freshToken && freshToken !== token) {
                                console.log("Got a fresh token, updating authorization header")
                                token = freshToken
                                // IMPORTANT: This backend expects the raw token without 'Bearer ' prefix
                                axiosInstance.defaults.headers.common['Authorization'] = token
                            }
                            retryCount++
                            // Wait a bit before retrying
                            await new Promise(resolve => setTimeout(resolve, 1000))
                            continue
                        }
                        throw error // If max retries reached or other error, throw
                    }
                }

                if (!userResponse) {
                    throw new Error("Failed to validate token after retries")
                }

                const userData = userResponse.data

                // Check account type and redirect if needed
                if (userData.accountType === 'shop') {
                    router.replace('/shop/incoming-orders' as any)
                    return
                } else if (userData.accountType === 'dasher') {
                    router.replace('/dasher/orders' as any)
                    return
                } else if (userData.accountType === 'admin') {
                    router.replace('/admin/dashboard' as any)
                    return
                }

                // Store the validated user data
                await AsyncStorage.setItem('accountType', userData.accountType)
            } catch (error) {
                console.error("Token validation failed:", error)
                // Don't immediately clear tokens - try one more approach
                try {
                    console.log('Attempting re-authentication with stored credentials...');
                    const email = await AsyncStorage.getItem('@CampusEats:UserEmail');
                    const password = await AsyncStorage.getItem('@CampusEats:UserPassword');

                    if (email && password) {
                        // Try to login again with stored credentials
                        const loginResponse = await fetch(`${API_URL}/api/users/authenticate`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                usernameOrEmail: email,
                                password: password,
                            }),
                        });

                        if (loginResponse.ok) {
                            const loginData = await loginResponse.json();
                            console.log('Re-authentication successful');

                            if (loginData.token) {
                                const newToken = loginData.token.startsWith('Bearer ')
                                    ? loginData.token.substring(7)
                                    : loginData.token;

                                // Update token in storage
                                await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);

                                // Update axios headers with new token
                                axiosInstance.defaults.headers.common['Authorization'] = newToken;

                                // Try again with the new token
                                console.log('Retrying with new token from re-authentication');
                                return await fetchOrders();
                            }
                        }
                    }
                } catch (reAuthError) {
                    console.error('Re-authentication failed:', reAuthError);
                }

                // If all approaches fail, clear tokens and redirect
                console.log('All authentication approaches failed, clearing tokens');
                await AsyncStorage.multiRemove(['@CampusEats:AuthToken', 'userId', 'accountType',
                    '@CampusEats:UserEmail', '@CampusEats:UserPassword', AUTH_STORAGE_KEY]);
                router.replace('/')
                return
            }

            // Fetch user orders
            const ordersResponse = await axiosInstance.get(`/api/orders/user/${userId}`)
            const ordersData = ordersResponse.data

            // Set active order if exists
            const activeOrder = ordersData.activeOrders?.[0] || null
            setActiveOrder(activeOrder)

            if (activeOrder) {
                // Fetch shop and dasher data in parallel
                const [shopResponse, dasherResponse] = await Promise.all([
                    activeOrder.shopId ? axiosInstance.get(`/api/shops/${activeOrder.shopId}`).catch(() => null) : null,
                    activeOrder.dasherId ? axiosInstance.get(`/api/dashers/${activeOrder.dasherId}`).catch(() => null) : null
                ])

                if (shopResponse?.data) {
                    setShop(shopResponse.data)
                }

                if (dasherResponse?.data) {
                    const dasherData = dasherResponse.data
                    setDasherName(dasherData.gcashName || "Waiting...")
                    setDasherPhone(dasherData.gcashNumber || "Waiting...")
                }

                // Set status based on order status
                setStatus(getStatusMessage(activeOrder.status))
            }

            // Set past orders with shop data
            if (ordersData.orders?.length > 0) {
                const ordersWithShopData = await Promise.all(
                    ordersData.orders.map(async (order: OrderItem) => {
                        if (!order.shopId) return order

                        try {
                            const shopResponse = await axiosInstance.get(`/api/shops/${order.shopId}`)
                            return { ...order, shopData: shopResponse.data }
                        } catch (error) {
                            console.error(`Error fetching shop data for order ${order.id}:`, error)
                            return order
                        }
                    })
                )
                setOrders(ordersWithShopData)
            } else {
                setOrders([])
            }

            // Fetch offenses
            await fetchOffenses()

        } catch (error) {
            console.error("Error fetching orders:", error)
            setActiveOrder(null)
            setOrders([])
        } finally {
            setLoading(false)
        }
    }

    const fetchOffenses = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId')
            // Get token using auth service first for most up-to-date token
            let token = await getAuthToken()
            // Fallback to direct AsyncStorage if needed
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken')
            }
            if (!userId || !token) return

            // IMPORTANT: This backend expects the raw token without 'Bearer ' prefix
            // Use the same token format as in fetchOrders
            const response = await axiosInstance.get(`/api/users/${userId}/offenses`, {
                headers: { Authorization: token }
            })
            setOffenses(response.data)
        } catch (error) {
            console.error("Error fetching offenses:", error)
            // Don't let this error block the rest of the UI
        }
    }

    const postOffenses = async () => {
        if (activeOrder && activeOrder.dasherId !== null) {
            try {
                const userId = await AsyncStorage.getItem('userId')
                // Get token using auth service first for most up-to-date token
                let token = await getAuthToken()
                // Fallback to direct AsyncStorage if needed
                if (!token) {
                    token = await AsyncStorage.getItem('@CampusEats:AuthToken')
                }
                if (!userId || !token) return

                // IMPORTANT: This backend expects the raw token without 'Bearer ' prefix
                const response = await axiosInstance.post(`/api/users/${userId}/offenses`, null, {
                    headers: { Authorization: token }
                })
                setOffenses(response.data)
            } catch (error) {
                console.error("Error posting offenses:", error)
            }
        }
    }

    const handleCancelOrder = async () => {
        try {
            setCancelling(true)
            // Get token using auth service first for most up-to-date token
            let token = await getAuthToken()
            // Fallback to direct AsyncStorage if needed
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken')
            }
            if (!token || !activeOrder) return

            let newStatus = ''
            if (activeOrder.dasherId !== null) {
                newStatus = 'active_waiting_for_cancel_confirmation'
            } else {
                newStatus = 'cancelled_by_customer'
            }

            const response = await axiosInstance.post('/api/orders/update-order-status', {
                orderId: activeOrder.id,
                status: newStatus
            }, {
                headers: { Authorization: token }
            })

            if (response.status === 200) {
                await postOffenses()
                setShowCancelModal(false)
                fetchOrders() // Refresh orders to update status
            }
        } catch (error) {
            console.error("Error cancelling order:", error)
            Alert.alert("Error", "Failed to cancel order. Please try again.")
        } finally {
            setCancelling(false)
        }
    }

    const handleSubmitReview = async () => {
        if (rating === 0 || !activeOrder?.dasherId) {
            Alert.alert("Action Needed", "Please provide a rating.");
            return;
        }

        try {
            setIsSubmittingReview(true);
            // Get token using auth service first for most up-to-date token
            let token = await getAuthToken()
            // Fallback to direct AsyncStorage if needed
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken')
            }
            if (!token) return;

            const ratingData = {
                dasherId: activeOrder.dasherId,
                rate: rating,
                comment: reviewText,
                type: "dasher",
                orderId: activeOrder.id
            };

            // Submit the rating - IMPORTANT: This backend expects the raw token without 'Bearer ' prefix
            await axiosInstance.post('/api/ratings/dasher-create', ratingData, {
                headers: { Authorization: token }
            });

            // Update order status to completed - IMPORTANT: This backend expects the raw token without 'Bearer ' prefix
            await axiosInstance.post('/api/orders/update-order-status', {
                orderId: activeOrder.id,
                status: "completed"
            }, {
                headers: { Authorization: token }
            });

            setShowReviewModal(false);
            fetchOrders(); // Refresh orders to update status
        } catch (error) {
            console.error("Error submitting review:", error);
            Alert.alert("Error", "Failed to submit review. Please try again.");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleUpdatePhoneNumber = async () => {
        if (!newPhoneNumber.trim()) {
            Alert.alert("Action Needed", "Please enter a new phone number.");
            return;
        }

        if (!activeOrder) {
            Alert.alert("Error", "Order information not available.");
            return;
        }

        try {
            setIsUpdatingPhone(true);
            // Get token using auth service first for most up-to-date token
            let token = await getAuthToken()
            // Fallback to direct AsyncStorage if needed
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken')
            }
            if (!token) return;

            // Make the API call to update the phone number
            await axiosInstance.put(`/api/orders/update/${activeOrder.id}/mobileNum`, null, {
                params: { mobileNum: newPhoneNumber },
                headers: { Authorization: token }
            });

            // Show success message
            Alert.alert("Success", "Phone number updated successfully");

            // Close the modal and refresh orders
            setShowEditPhoneModal(false);
            fetchOrders();
        } catch (error) {
            console.error("Error updating phone number:", error);
            Alert.alert("Error", "Failed to update phone number. Please try again.");
        } finally {
            setIsUpdatingPhone(false);
        }
    };

    const handleShopReview = async () => {
        if (shopRating === 0 || !selectedOrder?.shopId) {
            Alert.alert("Action Needed", "Please provide a rating.");
            return;
        }

        try {
            setIsSubmittingShopReview(true);
            // Get token using auth service first for most up-to-date token
            let token = await getAuthToken()
            // Fallback to direct AsyncStorage if needed
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken')
            }
            if (!token) return;

            const ratingData = {
                shopId: selectedOrder.shopId,
                rate: shopRating,
                comment: shopReviewText,
                type: "shop",
                orderId: selectedOrder.id
            };

            // IMPORTANT: This backend expects the raw token without 'Bearer ' prefix
            await axiosInstance.post('/api/ratings/shop-create', ratingData, {
                headers: { Authorization: token }
            });

            setShowShopReviewModal(false);
            setSelectedOrder(null);
            setShopRating(0);
            setShopReviewText('');
            fetchOrders(); // Refresh orders to update status
        } catch (error) {
            console.error("Error submitting shop review:", error);
            Alert.alert("Error", "Failed to submit review. Please try again.");
        } finally {
            setIsSubmittingShopReview(false);
        }
    };

    // Add this to your existing useEffect that handles order status
    useEffect(() => {
        if (activeOrder?.status === 'active_waiting_for_confirmation') {
            setShowReviewModal(true);
        }
    }, [activeOrder?.status]);

    // Add useEffect for offenses check
    useEffect(() => {
        if (offenses >= 3) {
            Alert.alert(
                "Account Banned",
                "You have been banned due to multiple order cancellations.",
                [{ text: "OK", onPress: () => router.replace('/') }]
            )
        }
    }, [offenses])

    // Helper function to get status message
    const getStatusMessage = (status: string): string => {
        const statusMessages: { [key: string]: string } = {
            'active_waiting_for_dasher': 'Searching for Dashers. Hang tight, this might take a little time!',
            'active_shop_confirmed': 'Dasher is on the way to the shop.',
            'active_preparing': 'Order is being prepared',
            'active_onTheWay': 'Order is on the way',
            'active_delivered': 'Order has been delivered',
            'active_waiting_for_confirmation': 'Waiting for your confirmation',
            'active_pickedUp': 'Order has been picked up',
            'active_toShop': 'Dasher is on the way to the shop',
            'cancelled_by_customer': 'Order has been cancelled',
            'cancelled_by_dasher': 'Order has been cancelled',
            'cancelled_by_shop': 'Order has been cancelled',
            'active_waiting_for_shop': 'Dasher is on the way to the shop',
            'refunded': 'Order has been refunded',
            'active_waiting_for_cancel_confirmation': 'Order is waiting for cancellation confirmation',
            'no-show': 'Customer did not show up for the delivery',
            'active_waiting_for_no_show_confirmation': 'Order failed: Customer did not show up for delivery'
        }
        return statusMessages[status] || 'Unknown status'
    }

    const hideCancelButton = status === 'Order is being prepared' ||
        status === 'Order has been picked up' ||
        status === 'Order is on the way' ||
        status === 'Order has been delivered' ||
        status === 'Order has been completed' ||
        status === 'Order is waiting for cancellation confirmation' ||
        status === 'Waiting for your confirmation' ||
        status === 'Dasher is on the way to the shop'

    return (
        <StyledSafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
            <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />

            {/* Header */}
            <StyledView className="px-6 py-4" style={{ backgroundColor: '#DFD6C5' }}>
                <StyledText className="text-2xl font-bold text-gray-900">My Orders</StyledText>
                <StyledText className="text-sm text-gray-600 mt-1">Track your current and past orders</StyledText>
            </StyledView>

            <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {loading ? (
                    <StyledView className="flex-1 justify-center items-center py-20">
                        <ActivityIndicator size="large" color="#BC4A4D" />
                        <StyledText className="mt-4 text-base text-gray-600 font-medium">Loading your orders...</StyledText>
                    </StyledView>
                ) : activeOrder ? (
                    <StyledView className="px-6">
                        {/* Active Order Card */}
                        <StyledView className="bg-white rounded-3xl p-6 mb-6 shadow-sm">
                            <StyledView className="flex-row items-center mb-4">
                                <StyledView className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mr-3">
                                    <Ionicons name="time-outline" size={24} color="#10B981" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-lg font-bold text-gray-900">Active Order</StyledText>
                                    <StyledText className="text-sm text-gray-500">Order #{activeOrder.id.slice(-6)}</StyledText>
                                </StyledView>
                            </StyledView>

                            {/* Shop Info */}
                            <StyledView className="flex-row items-center mb-4 p-4 bg-gray-50 rounded-2xl">
                                <StyledImage
                                    source={{ uri: shop?.imageUrl || "https://via.placeholder.com/60" }}
                                    className="w-15 h-15 rounded-xl mr-4"
                                />
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-gray-900">{shop?.name || "Loading..."}</StyledText>
                                    <StyledText className="text-sm text-gray-500 mt-1">{shop?.address || "Loading..."}</StyledText>
                                </StyledView>
                            </StyledView>

                            {/* Order Status */}
                            <StyledView className="mb-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                <StyledView className="flex-row items-center mb-2">
                                    <StyledView className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
                                    <StyledText className="text-sm font-semibold text-blue-700">Order Status</StyledText>
                                </StyledView>
                                <StyledText className="text-sm text-blue-600 leading-relaxed">{status}</StyledText>
                            </StyledView>

                            {/* Delivery Info */}
                            <StyledView className="space-y-3 mb-4">
                                <StyledView className="flex-row items-center">
                                    <Ionicons name="person-outline" size={16} color="#6B7280" />
                                    <StyledText className="text-sm text-gray-600 ml-2 w-20">Dasher:</StyledText>
                                    <StyledText className="text-sm text-gray-900 font-medium">{dasherName || "Waiting..."}</StyledText>
                                </StyledView>

                                <StyledView className="flex-row items-center">
                                    <Ionicons name="call-outline" size={16} color="#6B7280" />
                                    <StyledText className="text-sm text-gray-600 ml-2 w-20">Phone:</StyledText>
                                    <StyledText className="text-sm text-gray-900 font-medium">{dasherPhone || "Waiting..."}</StyledText>
                                </StyledView>

                                <StyledView className="flex-row items-start">
                                    <Ionicons name="location-outline" size={16} color="#6B7280" />
                                    <StyledText className="text-sm text-gray-600 ml-2 w-20">Deliver to:</StyledText>
                                    <StyledText className="text-sm text-gray-900 font-medium flex-1">{activeOrder.deliverTo}</StyledText>
                                </StyledView>

                                <StyledView className="flex-row items-center">
                                    <Ionicons name="phone-portrait-outline" size={16} color="#6B7280" />
                                    <StyledText className="text-sm text-gray-600 ml-2 w-20">Contact:</StyledText>
                                    <StyledText className="text-sm text-gray-900 font-medium">{activeOrder.mobileNum}</StyledText>
                                    <StyledTouchableOpacity
                                        className="ml-2"
                                        onPress={() => {
                                            setNewPhoneNumber('');
                                            setShowEditPhoneModal(true);
                                        }}
                                    >
                                        <StyledText className="text-sm text-blue-600 underline">Edit</StyledText>
                                    </StyledTouchableOpacity>
                                </StyledView>
                            </StyledView>

                            {/* Order Items */}
                            <StyledView className="mb-4">
                                <StyledText className="text-base font-semibold text-gray-900 mb-3">Order Items</StyledText>
                                <StyledView className="bg-gray-50 rounded-2xl p-4">
                                    {activeOrder.items.map((item, index) => (
                                        <StyledView key={index} className="flex-row justify-between items-center py-2">
                                            <StyledView className="flex-row items-center flex-1">
                                                <StyledView className="w-6 h-6 bg-gray-200 rounded-full items-center justify-center mr-3">
                                                    <StyledText className="text-xs font-bold text-gray-600">{item.quantity}</StyledText>
                                                </StyledView>
                                                <StyledText className="text-sm text-gray-900 flex-1">{item.name}</StyledText>
                                            </StyledView>
                                            <StyledText className="text-sm font-semibold text-gray-900">₱{item.price.toFixed(2)}</StyledText>
                                        </StyledView>
                                    ))}
                                </StyledView>
                            </StyledView>

                            {/* Order Total */}
                            <StyledView className="border-t border-gray-200 pt-4 mb-4">
                                <StyledView className="flex-row justify-between items-center mb-2">
                                    <StyledText className="text-sm text-gray-600">Subtotal</StyledText>
                                    <StyledText className="text-sm text-gray-900">₱{activeOrder.totalPrice.toFixed(2)}</StyledText>
                                </StyledView>
                                <StyledView className="flex-row justify-between items-center mb-2">
                                    <StyledText className="text-sm text-gray-600">Delivery Fee</StyledText>
                                    <StyledText className="text-sm text-gray-900">₱{shop?.deliveryFee?.toFixed(2) || "0.00"}</StyledText>
                                </StyledView>
                                <StyledView className="flex-row justify-between items-center pt-2 border-t border-gray-200">
                                    <StyledText className="text-base font-bold text-gray-900">Total</StyledText>
                                    <StyledText className="text-lg font-bold" style={{ color: '#BC4A4D' }}>
                                        ₱{(activeOrder.totalPrice + (shop?.deliveryFee || 0)).toFixed(2)}
                                    </StyledText>
                                </StyledView>
                            </StyledView>

                            {/* Action Buttons */}
                            <StyledView className="flex-row space-x-3">
                                {activeOrder.paymentMethod === "gcash" && (
                                    <StyledTouchableOpacity
                                        className="flex-1 py-3 rounded-2xl items-center"
                                        style={{ backgroundColor: '#BC4A4D' }}
                                    >
                                        <StyledText className="text-white text-sm font-semibold">Cancel & Refund</StyledText>
                                    </StyledTouchableOpacity>
                                )}

                                {activeOrder.paymentMethod === "cash" && !hideCancelButton && (
                                    <StyledTouchableOpacity
                                        className="flex-1 py-3 rounded-2xl items-center"
                                        style={{ backgroundColor: '#BC4A4D' }}
                                        onPress={() => setShowCancelModal(true)}
                                    >
                                        <StyledText className="text-white text-sm font-semibold">
                                            {cancelling ? "Cancelling..." : "Cancel Order"}
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                )}
                            </StyledView>
                        </StyledView>

                        {/* Delivery Map */}
                        {activeOrder?.dasherId && (
                            <StyledView className="bg-white rounded-3xl p-6 mb-6 shadow-sm">
                                <StyledView className="flex-row items-center mb-4">
                                    <Ionicons name="map-outline" size={20} color="#BC4A4D" />
                                    <StyledText className="text-lg font-bold text-gray-900 ml-2">Track Delivery</StyledText>
                                </StyledView>
                                <StyledView className="rounded-2xl overflow-hidden">
                                    <DeliveryMap
                                        orderId={activeOrder.id}
                                        userType="user"
                                        height={220}
                                    />
                                </StyledView>
                            </StyledView>
                        )}
                    </StyledView>
                ) : (
                    <StyledView className="px-6">
                        <StyledView className="bg-white rounded-3xl p-8 items-center">
                            <StyledView className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                                <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
                            </StyledView>
                            <StyledText className="text-lg font-semibold text-gray-900 mb-2">No Active Orders</StyledText>
                            <StyledText className="text-sm text-gray-500 text-center">You don't have any active orders at the moment</StyledText>
                        </StyledView>
                    </StyledView>
                )}
            </StyledScrollView>

            {/* Bottom Navigation */}
            <BottomNavigation activeTab="Orders" />

            {/* Cancel Order Modal */}
            {showCancelModal && (
                <StyledView className="absolute inset-0 bg-black/50 justify-center items-center px-6">
                    <StyledView className="bg-white rounded-3xl p-6 w-full max-w-sm">
                        <StyledView className="items-center mb-4">
                            <StyledView className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4">
                                <Ionicons name="warning-outline" size={32} color="#EF4444" />
                            </StyledView>
                            <StyledText className="text-xl font-bold text-gray-900 text-center mb-2">Cancel Order</StyledText>
                            <StyledText className="text-sm text-gray-600 text-center mb-2">Are you sure you want to cancel your order?</StyledText>
                            <StyledText className="text-xs text-red-600 text-center">Note: Cancelling orders may result in penalties.</StyledText>
                        </StyledView>
                        <StyledView className="flex-row space-x-3">
                            <StyledTouchableOpacity
                                className="flex-1 bg-gray-100 py-3 rounded-2xl"
                                onPress={() => setShowCancelModal(false)}
                            >
                                <StyledText className="text-gray-700 text-sm font-semibold text-center">Keep Order</StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className={`flex-1 py-3 rounded-2xl ${cancelling ? 'opacity-60' : ''}`}
                                style={{ backgroundColor: '#BC4A4D' }}
                                onPress={handleCancelOrder}
                                disabled={cancelling}
                            >
                                <StyledText className="text-white text-sm font-semibold text-center">
                                    {cancelling ? "Cancelling..." : "Cancel Order"}
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            )}

            {/* Review Modal */}
            {showReviewModal && (
                <StyledView className="absolute inset-0 bg-black/50 justify-center items-center px-6">
                    <StyledView className="bg-white rounded-3xl p-6 w-full max-w-sm">
                        <StyledView className="items-center mb-4">
                            <StyledView className="w-16 h-16 bg-yellow-100 rounded-full items-center justify-center mb-4">
                                <Ionicons name="star-outline" size={32} color="#F59E0B" />
                            </StyledView>
                            <StyledText className="text-xl font-bold text-gray-900 text-center mb-2">Rate Your Dasher</StyledText>
                            <StyledText className="text-sm text-gray-600 text-center">How was your delivery experience?</StyledText>
                        </StyledView>

                        <StyledView className="flex-row justify-center my-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <StyledTouchableOpacity
                                    key={star}
                                    onPress={() => setRating(star)}
                                    className="mx-1"
                                >
                                    <Ionicons
                                        name={rating >= star ? "star" : "star-outline"}
                                        size={32}
                                        color="#F59E0B"
                                    />
                                </StyledTouchableOpacity>
                            ))}
                        </StyledView>

                        <StyledView className="mb-4">
                            <StyledText className="text-sm font-medium text-gray-700 mb-2">Write a review (optional)</StyledText>
                            <StyledTextInput
                                className="bg-gray-50 border border-gray-200 rounded-2xl p-3 h-20"
                                multiline
                                numberOfLines={3}
                                placeholder="Share your experience..."
                                value={reviewText}
                                onChangeText={setReviewText}
                                textAlignVertical="top"
                            />
                        </StyledView>

                        <StyledView className="flex-row space-x-3">
                            <StyledTouchableOpacity
                                className="flex-1 bg-gray-100 py-3 rounded-2xl"
                                onPress={() => setShowReviewModal(false)}
                            >
                                <StyledText className="text-gray-700 text-sm font-semibold text-center">Skip</StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className={`flex-1 py-3 rounded-2xl ${isSubmittingReview ? 'opacity-60' : ''}`}
                                style={{ backgroundColor: '#BC4A4D' }}
                                onPress={handleSubmitReview}
                                disabled={isSubmittingReview}
                            >
                                <StyledText className="text-white text-sm font-semibold text-center">
                                    {isSubmittingReview ? "Submitting..." : "Submit"}
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            )}

            {/* Edit Phone Number Modal */}
            {showEditPhoneModal && activeOrder && (
                <StyledView className="absolute inset-0 bg-black/50 justify-center items-center px-6">
                    <StyledView className="bg-white rounded-3xl p-6 w-full max-w-sm">
                        <StyledView className="items-center mb-4">
                            <StyledView className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-4">
                                <Ionicons name="phone-portrait-outline" size={32} color="#3B82F6" />
                            </StyledView>
                            <StyledText className="text-xl font-bold text-gray-900 text-center mb-2">Update Phone Number</StyledText>
                            <StyledText className="text-sm text-gray-600 text-center">Update your contact number for this delivery</StyledText>
                        </StyledView>

                        <StyledView className="mb-4">
                            <StyledText className="text-sm font-medium text-gray-700 mb-2">Current Number</StyledText>
                            <StyledText className="text-base text-gray-900 font-medium mb-4">{activeOrder.mobileNum}</StyledText>

                            <StyledText className="text-sm font-medium text-gray-700 mb-2">New Phone Number</StyledText>
                            <StyledTextInput
                                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3"
                                placeholder="Enter new phone number"
                                keyboardType="phone-pad"
                                value={newPhoneNumber}
                                onChangeText={setNewPhoneNumber}
                            />
                        </StyledView>

                        <StyledView className="flex-row space-x-3">
                            <StyledTouchableOpacity
                                className="flex-1 bg-gray-100 py-3 rounded-2xl"
                                onPress={() => setShowEditPhoneModal(false)}
                            >
                                <StyledText className="text-gray-700 text-sm font-semibold text-center">Cancel</StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className={`flex-1 py-3 rounded-2xl ${isUpdatingPhone || !newPhoneNumber.trim() ? 'opacity-60' : ''}`}
                                style={{ backgroundColor: '#BC4A4D' }}
                                onPress={handleUpdatePhoneNumber}
                                disabled={isUpdatingPhone || !newPhoneNumber.trim()}
                            >
                                <StyledText className="text-white text-sm font-semibold text-center">
                                    {isUpdatingPhone ? "Updating..." : "Update"}
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            )}
        </StyledSafeAreaView>
    )
}

export default Order;