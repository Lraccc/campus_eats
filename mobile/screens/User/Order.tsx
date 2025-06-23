import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native"
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

// Create styled components
const StyledView = styled(View)
const StyledText = styled(Text)
const StyledImage = styled(Image)
const StyledScrollView = styled(ScrollView)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)
const StyledModal = styled(Modal)
const StyledKeyboardAvoidingView = styled(KeyboardAvoidingView)

// Import AUTH_STORAGE_KEY constant
const AUTH_STORAGE_KEY = '@CampusEats:Auth'

const { width, height } = Dimensions.get("window")

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
    previousNoShowFee?: number;
}

// Create axios instance with base URL
const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

const Order = () => {
    // All existing state variables and hooks remain unchanged
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

    // All existing useEffect hooks and functions remain unchanged
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

    /*// Set up polling only when logged in
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
    }, [isLoggedIn])*/

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

    // Shared modal styles for consistency
    const modalContentStyle = "bg-white rounded-2xl p-6 w-[90%] max-w-[400px] shadow-lg";
    const modalHeaderStyle = "flex-row justify-between items-center mb-4";
    const modalTitleStyle = "text-xl font-bold text-[#BC4A4D]";
    const modalButtonRowStyle = "flex-row justify-between mt-4";
    const modalCancelButtonStyle = "bg-[#F0EBE4] py-3 px-4 rounded-xl flex-1 mr-3";
    const modalSubmitButtonStyle = "bg-[#BC4A4D] py-3 px-4 rounded-xl flex-1";
    const modalButtonTextStyle = "text-base font-semibold text-center";

    return (
        <StyledView className="flex-1 bg-[#DFD6C5]">
            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingTop: 20, paddingBottom: 80, paddingHorizontal: 15 }}>
                {/* Active Order Section */}
                <StyledText className="text-2xl font-bold mb-6 text-[#000]">Active Order</StyledText>

                {loading ? (
                    <StyledView className="flex-1 justify-center items-center p-5">
                        <ActivityIndicator size="large" color="#BC4A4D" />
                        <StyledText className="mt-3 text-base text-[#666]">Loading orders...</StyledText>
                    </StyledView>
                ) : activeOrder ? (
                    <StyledView className="mb-8">
                        {/* Order Details Card */}
                        <StyledView className="bg-white rounded-2xl p-6 mb-6 shadow-md">
                            <StyledView className="flex-row mb-6">
                                <StyledImage
                                    source={{ uri: shop?.imageUrl || "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=100&width=100" }}
                                    className="w-24 h-24 rounded-xl mr-4"
                                />
                                <StyledView className="flex-1">
                                    <StyledText className="text-xl font-bold text-[#BC4A4D] mb-1">{shop?.name || "Loading..."}</StyledText>
                                    <StyledText className="text-sm text-[#666] mb-3">{shop?.address || "Loading..."}</StyledText>

                                    <StyledView className="flex-row items-center mb-2">
                                        <Ionicons name="person" size={16} color="#BC4A4D" />
                                        <StyledText className="text-sm text-[#666] ml-2">
                                            Dasher: <StyledText className="font-medium text-[#333]">{dasherName || "Waiting..."}</StyledText>
                                        </StyledText>
                                    </StyledView>

                                    <StyledView className="flex-row items-center mb-2">
                                        <Ionicons name="call" size={16} color="#BC4A4D" />
                                        <StyledText className="text-sm text-[#666] ml-2">
                                            Phone: <StyledText className="font-medium text-[#333]">{dasherPhone || "Waiting..."}</StyledText>
                                        </StyledText>
                                    </StyledView>
                                </StyledView>
                            </StyledView>

                            {/* Delivery Details */}
                            <StyledView className="bg-[#F9F6F2] rounded-xl p-4 mb-6">
                                <StyledView className="flex-row items-center mb-3">
                                    <Ionicons name="location" size={18} color="#BC4A4D" />
                                    <StyledText className="text-base font-medium text-[#333] ml-2">Delivery Details</StyledText>
                                </StyledView>

                                <StyledView className="ml-6 space-y-2">
                                    <StyledView className="flex-row">
                                        <StyledText className="text-sm text-[#666] w-24">Location:</StyledText>
                                        <StyledText className="text-sm text-[#333] flex-1 font-medium">{activeOrder.deliverTo}</StyledText>
                                    </StyledView>

                                    <StyledView className="flex-row">
                                        <StyledText className="text-sm text-[#666] w-24">Order #:</StyledText>
                                        <StyledText className="text-sm text-[#333] flex-1 font-medium">#{activeOrder.id}</StyledText>
                                    </StyledView>

                                    <StyledView className="flex-row">
                                        <StyledText className="text-sm text-[#666] w-24">Payment:</StyledText>
                                        <StyledText className="text-sm text-[#333] flex-1 font-medium">{activeOrder.paymentMethod}</StyledText>
                                    </StyledView>

                                    <StyledView className="flex-row">
                                        <StyledText className="text-sm text-[#666] w-24">Phone:</StyledText>
                                        <StyledView className="flex-1">
                                            <StyledText className="text-sm text-[#333] font-medium">{activeOrder.mobileNum}</StyledText>
                                            <StyledTouchableOpacity
                                                className="mt-1"
                                                onPress={() => {
                                                    setNewPhoneNumber('');
                                                    setShowEditPhoneModal(true);
                                                }}
                                            >
                                                <StyledText className="text-xs text-[#BC4A4D] underline">Edit phone number</StyledText>
                                            </StyledTouchableOpacity>
                                        </StyledView>
                                    </StyledView>
                                </StyledView>
                            </StyledView>

                            {/* Order Summary */}
                            <StyledView>
                                <StyledText className="text-base font-bold mb-4 text-[#BC4A4D]">Order Summary</StyledText>

                                {activeOrder.items.map((item, index) => (
                                    <StyledView key={index} className="flex-row justify-between mb-3">
                                        <StyledView className="flex-row">
                                            <StyledText className="text-sm text-[#666] mr-2">{item.quantity}x</StyledText>
                                            <StyledText className="text-sm text-[#333]">{item.name}</StyledText>
                                        </StyledView>
                                        <StyledText className="text-sm text-[#333] font-medium">₱{item.price.toFixed(2)}</StyledText>
                                    </StyledView>
                                ))}
                                {(activeOrder.previousNoShowFee ?? 0) > 0 && (
                                    <StyledView className="flex-row justify-between mb-2">
                                        <StyledText className="text-sm text-[#BC4A4D]">Previous Missed Delivery Fee</StyledText>
                                        <StyledText className="text-sm font-medium text-[#BC4A4D]">₱{(activeOrder.previousNoShowFee ?? 0).toFixed(2)}</StyledText>
                                    </StyledView>
                                )}

                                <StyledView className="mt-4 pt-4 border-t border-[#eee]">

                                    
                                    <StyledView className="flex-row justify-between mb-2">
                                        <StyledText className="text-sm text-[#666]">Subtotal</StyledText>
                                        <StyledText className="text-sm text-[#333]">₱{activeOrder.totalPrice.toFixed(2)}</StyledText>
                                    </StyledView>

                                    <StyledView className="flex-row justify-between mb-2">
                                        <StyledText className="text-sm text-[#666]">Delivery Fee</StyledText>
                                        <StyledText className="text-sm text-[#333]">₱{shop?.deliveryFee?.toFixed(2) || "0.00"}</StyledText>
                                    </StyledView>

                                    <StyledView className="flex-row justify-between mt-3 pt-3 border-t border-[#eee]">
                                        <StyledText className="text-base font-bold text-[#BC4A4D]">Total</StyledText>
                                        <StyledText className="text-base font-bold text-[#BC4A4D]">₱{(activeOrder.totalPrice + (shop?.deliveryFee || 0)).toFixed(2)}</StyledText>
                                    </StyledView>
                                </StyledView>

                                <StyledView className="mt-6 flex-row justify-center">
                                    {activeOrder.paymentMethod === "gcash" && (
                                        <StyledTouchableOpacity className="bg-[#BC4A4D] py-3 px-6 rounded-xl shadow-sm">
                                            <StyledText className="text-base font-semibold text-white">Cancel and Refund</StyledText>
                                        </StyledTouchableOpacity>
                                    )}

                                    {activeOrder.paymentMethod === "cash" && !hideCancelButton && (
                                        <StyledTouchableOpacity
                                            className="bg-[#BC4A4D] py-3 px-6 rounded-xl shadow-sm"
                                            onPress={() => setShowCancelModal(true)}
                                        >
                                            <StyledText className="text-base font-semibold text-white">
                                                {cancelling ? "Cancelling..." : "Cancel Order"}
                                            </StyledText>
                                        </StyledTouchableOpacity>
                                    )}
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        {/* Status Card */}
                        <StyledView className="bg-white rounded-2xl p-6 items-center shadow-md mb-6">
                            <StyledView className="bg-[#F9F6F2] rounded-xl p-4 w-full">
                                <StyledText className="text-base text-[#BC4A4D] text-center font-medium">{status}</StyledText>
                            </StyledView>
                        </StyledView>

                        {/* Show delivery map when dasher is assigned */}
                        {activeOrder?.dasherId && (
                            <StyledView className="mb-6">
                                <StyledText className="text-base font-bold mb-3 text-[#BC4A4D]">Track Your Order</StyledText>
                                <StyledView className="rounded-2xl overflow-hidden shadow-md">
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
                    <StyledView className="bg-white rounded-2xl p-8 items-center shadow-md mb-6">
                        <Ionicons name="fast-food-outline" size={60} color="#BC4A4D" />
                        <StyledText className="text-lg text-[#666] text-center mt-4">No active orders</StyledText>
                        <StyledText className="text-sm text-[#999] text-center mt-2">Your active orders will appear here</StyledText>
                    </StyledView>
                )}
            </StyledScrollView>

            {/* Bottom Navigation */}
            <BottomNavigation activeTab="Orders" />

            {/* REFACTORED MODALS */}

            {/* Cancel Order Modal */}
            <StyledModal
                animationType="fade"
                transparent={true}
                visible={showCancelModal}
                onRequestClose={() => setShowCancelModal(false)}
                statusBarTranslucent={true}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-4">
                    <StyledKeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        className={modalContentStyle}
                    >
                        <StyledView className={modalHeaderStyle}>
                            <StyledText className={modalTitleStyle}>Cancel Order</StyledText>
                            <StyledTouchableOpacity
                                className="p-1"
                                onPress={() => setShowCancelModal(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={24} color="#BC4A4D" />
                            </StyledTouchableOpacity>
                        </StyledView>
                        <StyledText className="text-base text-[#333] mb-4">Are you sure you want to cancel your order?</StyledText>
                        <StyledText className="text-sm text-[#666] mb-6">Note: Cancelling orders may result in penalties.</StyledText>
                        <StyledView className={modalButtonRowStyle}>
                            <StyledTouchableOpacity
                                className={modalCancelButtonStyle}
                                onPress={() => setShowCancelModal(false)}
                            >
                                <StyledText className={`${modalButtonTextStyle} text-[#666]`}>Keep Order</StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className={`${modalSubmitButtonStyle} ${cancelling ? 'opacity-60' : ''}`}
                                onPress={handleCancelOrder}
                                disabled={cancelling}
                            >
                                <StyledText className={`${modalButtonTextStyle} text-white`}>
                                    {cancelling ? "Cancelling..." : "Cancel Order"}
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledKeyboardAvoidingView>
                </StyledView>
            </StyledModal>

            {/* Review Modal */}
            <StyledModal
                animationType="fade"
                transparent={true}
                visible={showReviewModal}
                onRequestClose={() => setShowReviewModal(false)}
                statusBarTranslucent={true}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-4">
                    <StyledKeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        className={modalContentStyle}
                    >
                        <StyledView className={modalHeaderStyle}>
                            <StyledText className={modalTitleStyle}>Rate Your Dasher</StyledText>
                            <StyledTouchableOpacity
                                className="p-1"
                                onPress={() => setShowReviewModal(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={24} color="#BC4A4D" />
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="flex-row justify-center my-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <StyledTouchableOpacity
                                    key={star}
                                    onPress={() => setRating(star)}
                                    className="mx-2"
                                    hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                                >
                                    <Ionicons
                                        name={rating >= star ? "star" : "star-outline"}
                                        size={36}
                                        color="#FFD700"
                                    />
                                </StyledTouchableOpacity>
                            ))}
                        </StyledView>

                        <StyledView className="my-4">
                            <StyledText className="text-base mb-2 text-[#333]">Write your review (optional)</StyledText>
                            <StyledTextInput
                                className="border border-[#eee] rounded-xl p-4 h-[100px] bg-[#F9F6F2]"
                                multiline
                                numberOfLines={4}
                                placeholder="Share your experience..."
                                placeholderTextColor="#999"
                                value={reviewText}
                                onChangeText={setReviewText}
                                textAlignVertical="top"
                            />
                        </StyledView>

                        <StyledView className={modalButtonRowStyle}>
                            <StyledTouchableOpacity
                                className={modalCancelButtonStyle}
                                onPress={() => setShowReviewModal(false)}
                            >
                                <StyledText className={`${modalButtonTextStyle} text-[#666]`}>Skip</StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className={`${modalSubmitButtonStyle} ${isSubmittingReview ? 'opacity-60' : ''}`}
                                onPress={handleSubmitReview}
                                disabled={isSubmittingReview}
                            >
                                <StyledText className={`${modalButtonTextStyle} text-white`}>
                                    {isSubmittingReview ? "Submitting..." : "Submit"}
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledKeyboardAvoidingView>
                </StyledView>
            </StyledModal>

            {/* Edit Phone Number Modal */}
            <StyledModal
                animationType="fade"
                transparent={true}
                visible={showEditPhoneModal && activeOrder !== null}
                onRequestClose={() => setShowEditPhoneModal(false)}
                statusBarTranslucent={true}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-4">
                    <StyledKeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        className={modalContentStyle}
                    >
                        <StyledView className={modalHeaderStyle}>
                            <StyledText className={modalTitleStyle}>Update Phone Number</StyledText>
                            <StyledTouchableOpacity
                                className="p-1"
                                onPress={() => setShowEditPhoneModal(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={24} color="#BC4A4D" />
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="my-4">
                            <StyledText className="text-base mb-2 text-[#333]">Current Phone Number</StyledText>
                            <StyledView className="bg-[#F9F6F2] rounded-xl p-4">
                                <StyledText className="text-base text-[#333] font-medium">
                                    {activeOrder?.mobileNum || ""}
                                </StyledText>
                            </StyledView>
                        </StyledView>

                        <StyledView className="my-4">
                            <StyledText className="text-base mb-2 text-[#333]">New Phone Number</StyledText>
                            <StyledTextInput
                                className="border border-[#eee] rounded-xl p-4 bg-[#F9F6F2]"
                                placeholder="Enter new phone number"
                                placeholderTextColor="#999"
                                keyboardType="phone-pad"
                                value={newPhoneNumber}
                                onChangeText={setNewPhoneNumber}
                            />
                        </StyledView>

                        <StyledView className={modalButtonRowStyle}>
                            <StyledTouchableOpacity
                                className={modalCancelButtonStyle}
                                onPress={() => setShowEditPhoneModal(false)}
                            >
                                <StyledText className={`${modalButtonTextStyle} text-[#666]`}>Cancel</StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className={`${modalSubmitButtonStyle} ${isUpdatingPhone ? 'opacity-60' : ''}`}
                                onPress={handleUpdatePhoneNumber}
                                disabled={isUpdatingPhone || !newPhoneNumber.trim()}
                            >
                                <StyledText className={`${modalButtonTextStyle} text-white`}>
                                    {isUpdatingPhone ? "Updating..." : "Update"}
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledKeyboardAvoidingView>
                </StyledView>
            </StyledModal>
        </StyledView>
    )
}

export default Order;