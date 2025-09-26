import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Animated } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useState, useEffect, useRef, useCallback } from "react"
import { getAuthToken, AUTH_TOKEN_KEY } from "../../services/authService"
import { API_URL } from "../../config"
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import BottomNavigation from "../../components/BottomNavigation"
import { useRouter, useFocusEffect } from "expo-router"
import DeliveryMap from "../../components/Map/DeliveryMap"
import { styled } from "nativewind"
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

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
    previousNoShowItems?: number;
}

// Create axios instance with base URL
const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

const Order = () => {
    // Animated value for spinning logo
    const spinValue = useRef(new Animated.Value(0)).current;
    // Animated value for circular loading line
    const circleValue = useRef(new Animated.Value(0)).current;

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
    // Removed orderToReview state as it was causing issues
    const [showShopReviewModal, setShowShopReviewModal] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null)
    const [shopRating, setShopRating] = useState(0)
    const [shopReviewText, setShopReviewText] = useState('')
    const [isSubmittingShopReview, setIsSubmittingShopReview] = useState(false)
    const [showEditPhoneModal, setShowEditPhoneModal] = useState(false)
    const [newPhoneNumber, setNewPhoneNumber] = useState('')
    const [isUpdatingPhone, setIsUpdatingPhone] = useState(false)
    // New state for status card polling
    const [statusPollingInterval, setStatusPollingInterval] = useState<NodeJS.Timeout | null>(null)
    const [isStatusPolling, setIsStatusPolling] = useState(false)
    const [lastPolledStatus, setLastPolledStatus] = useState<string | null>(null)
    const router = useRouter()

    // WebSocket connection management
    const stompClientRef = useRef<Client | null>(null);
    const isConnectedRef = useRef<boolean>(false);
    const currentOrderIdRef = useRef<string | null>(null);
    const connectionRetryCount = useRef<number>(0);
    const maxRetries = 3;

    // Use ref for fallback polling interval to ensure clearInterval always works
    const fallbackPollingRef = useRef<NodeJS.Timeout | null>(null);
    
    // Use ref for last polled status to avoid stale closure issues in polling
    const lastPolledStatusRef = useRef<string | null>(null);

    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true);

    // Track if user is logged in
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

        if (loading) {
            startAnimations();
        }
    }, [loading, spinValue, circleValue]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const circleRotation = circleValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // All existing useEffect hooks and functions remain unchanged
    // Check login status
    useEffect(() => {
        const checkLoginStatus = async () => {
            try {
                const token = await AsyncStorage.getItem('@CampusEats:AuthToken');
                const userId = await AsyncStorage.getItem('userId');
                setIsLoggedIn(!!(token && userId));
                setCurrentUserId(userId);
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

    // Set up initial order fetch when logged in
    useEffect(() => {
        // Only proceed if logged in
        if (!isLoggedIn) return;

        // Initial fetch
        fetchOrders();

        // NOTE: Polling functionality has been removed based on requirements
        // and replaced with focus-based updates using useFocusEffect below
    }, [isLoggedIn])
    
    // Use focus effect to fetch orders whenever the screen comes into focus
    // This is more efficient than polling and will refresh orders when users
    // return to this screen after completing a payment or from another screen
    useFocusEffect(
        useCallback(() => {
            // Only fetch if logged in and component is mounted
            if (isLoggedIn && isMountedRef.current) {
                console.log('Order screen in focus - refreshing orders');
                fetchOrders(false); // Pass false to indicate this is a background refresh
                
                // If there's an active order and no WebSocket connection, start fallback polling
                if (activeOrder && activeOrder.id && !isConnectedRef.current) {
                    const terminalStates = ['completed', 'cancelled', 'refunded', 'no-show'];
                    const isTerminalState = terminalStates.some(state => 
                        activeOrder.status === state || activeOrder.status.includes(state)
                    );
                    
                    if (!isTerminalState && !isStatusPolling) {
                        console.log('No WebSocket connection, starting fallback polling on focus');
                        startFallbackPolling(activeOrder.id);
                    }
                }
            }
            
            return () => {
                // Cleanup function when screen loses focus - don't stop polling here
                // as we want to continue getting updates even when screen is not focused
            };
        }, [isLoggedIn, activeOrder?.id, isStatusPolling])
    );

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
                const [shopResponse, dasherResponse, dasherUserResponse] = await Promise.all([
                    activeOrder.shopId ? axiosInstance.get(`/api/shops/${activeOrder.shopId}`).catch(() => null) : null,
                    activeOrder.dasherId ? axiosInstance.get(`/api/dashers/${activeOrder.dasherId}`).catch(() => null) : null,
                    // Fetch the dasher's user data to get actual name and phone
                    activeOrder.dasherId ? axiosInstance.get(`/api/users/${activeOrder.dasherId}`).catch(() => null) : null
                ])

                if (shopResponse?.data) {
                    setShop(shopResponse.data)
                }

                if (dasherResponse?.data || dasherUserResponse?.data) {
                    const dasherData = dasherResponse?.data || {}
                    const dasherUserData = dasherUserResponse?.data || {}
                    
                    // Try to get name from user data first, then fallback to dasher GCash name
                    const firstName = dasherUserData.firstname || ""
                    const lastName = dasherUserData.lastname || ""
                    const fullName = firstName && lastName ? `${firstName} ${lastName}` : 
                                   firstName || lastName || dasherData.gcashName || "Waiting..."
                    
                    // Try to get phone from user data first, then fallback to dasher GCash number
                    const rawPhone = dasherUserData.phone || dasherData.gcashNumber || "Waiting..."
                    // Remove leading zero if present
                    const phone = rawPhone !== "Waiting..." ? rawPhone.replace(/^0/, '') : rawPhone
                    
                    setDasherName(fullName)
                    setDasherPhone(phone)
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
            // Only log errors that are not 404 (not found)
            if (!(axios.isAxiosError(error) && error.response?.status === 404)) {
                // Remove this log to prevent console error always showing
                // console.error("Error fetching orders:", error)
            }
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

    // Simple function to reset review states
    const resetReviewStates = () => {
        console.log('Resetting review states');
        setRating(0);
        setReviewText('');
        setIsSubmittingReview(false);
        setShowReviewModal(false);
    };
    
    const handleSubmitReview = async () => {
        console.log('Submitting review with rating:', rating);
        console.log('Active order for review:', {
            id: activeOrder?.id,
            status: activeOrder?.status,
            dasherId: activeOrder?.dasherId
        });
        
        // Only validate the rating
        if (rating === 0) {
            console.log('Rating validation failed - rating is zero');
            Alert.alert("Action Needed", "Please provide a rating.");
            return;
        }
        
        // Check if we have an active order
        if (!activeOrder?.id) {
            console.log('No active order available for review');
            Alert.alert("Error", "Order information not available.");
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

            // Use activeOrder directly
            const ratingData = {
                dasherId: activeOrder.dasherId || 'unknown', // Use fallback if dasherId is null
                rate: rating,
                comment: reviewText,
                type: "dasher",
                orderId: activeOrder.id
            };
            
            console.log('Submitting rating data:', ratingData);

            // Submit the rating - IMPORTANT: This backend expects the raw token without 'Bearer ' prefix
            await axiosInstance.post('/api/ratings/dasher-create', ratingData, {
                headers: { Authorization: token }
            });

            // Update order status to completed
            await axiosInstance.post('/api/orders/update-order-status', {
                orderId: activeOrder.id,
                status: "completed"
            }, {
                headers: { Authorization: token }
            });

            // Reset all review-related states after successful submission
            resetReviewStates();
            console.log('Review submitted successfully, states reset');
            fetchOrders(); // Refresh orders to update status
            
            // Force a small delay to ensure state updates are processed
            setTimeout(() => {
                console.log('Post-review state check:', { rating, isSubmittingReview, showReviewModal });
            }, 500);
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

        // Validate phone number - should be in XXX-XXX-XXXX format and start with 9
        const digitsOnly = newPhoneNumber.replace(/\D/g, '');
        if (!newPhoneNumber || digitsOnly.length !== 10 || !digitsOnly.startsWith('9')) {
            Alert.alert("Invalid Phone Number", "Please enter a valid mobile number starting with 9 and containing 10 digits in XXX-XXX-XXXX format.");
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

    // Simplified approach for handling the review modal
    useEffect(() => {
        console.log('Order status changed:', activeOrder?.status, 'for order:', activeOrder?.id);
        
        // When order status is waiting for confirmation, show review modal
        if (activeOrder && activeOrder.status === 'active_waiting_for_confirmation') {
            console.log('Order in confirmation state - showing review modal');
            // Reset rating state
            setRating(0);
            setReviewText('');
            setShowReviewModal(true);
        }

        // Disconnect any existing WebSocket connection when order changes
        disconnectWebSocket();
        
        // Reset lastPolledStatus when order changes
        lastPolledStatusRef.current = null;
        setLastPolledStatus(null);
        
        // Define terminal states
        const terminalStates = ['completed', 'cancelled', 'refunded', 'no-show'];
        const isTerminalState = activeOrder?.status ? terminalStates.some(state => 
            activeOrder.status === state || activeOrder.status.includes(state)
        ) : false;
        
        // Connect to WebSocket only when there's an active order that's NOT in a terminal state
        if (activeOrder && activeOrder.id && !isTerminalState) {
            console.log('🔗 Attempting WebSocket connection for order:', activeOrder.id, 'status:', activeOrder.status);
            console.log('🔗 WebSocket URL will be:', API_URL.replace(/^https?:\/\//, 'http://') + '/ws');
            console.log('🔗 If you see continuous polling logs, it means WebSocket connection failed');
            console.log('🔗 Check if your backend server is running and WebSocket endpoint is accessible');
            // Try WebSocket first, but also start immediate fallback polling
            connectWebSocket(activeOrder.id);
            
            // Start immediate polling as backup (will be stopped if WebSocket connects successfully)
            console.log('🔄 Starting immediate backup polling while WebSocket connects...');
            setTimeout(() => {
                if (!isConnectedRef.current && currentOrderIdRef.current === activeOrder.id) {
                    console.log('🔄 WebSocket not connected, ensuring fallback polling is active');
                    startFallbackPolling(activeOrder.id);
                }
            }, 500); // Very short delay to allow WebSocket to try first
        } else if (activeOrder && isTerminalState) {
            console.log('⏹️ Not connecting for terminal status order:', activeOrder.status);
        }
        
        // Clean up on unmount
        return () => {
            disconnectWebSocket();
        };
    }, [activeOrder?.id]);

    // Connect to WebSocket for real-time order updates
    const connectWebSocket = async (orderId: string) => {
        try {
            // Disconnect any existing connection
            disconnectWebSocket();
            
            // Get authentication token
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) {
                console.error('No authentication token available for WebSocket connection');
                return;
            }

            // Reset review states when starting connection for a new order
            resetReviewStates();
            
            console.log('Connecting to WebSocket for order:', orderId);
            currentOrderIdRef.current = orderId;

            // Create SockJS connection (fallback for environments that don't support WebSocket)
            // Use the API_URL to construct the WebSocket endpoint
            const wsUrl = API_URL.replace(/^https?:\/\//, 'http://') + '/ws';
            console.log('Attempting SockJS connection to:', wsUrl);
            const socket = new SockJS(wsUrl);
            
            // Add connection timeout to quickly fallback to polling if WebSocket server is not available
            const connectionTimeout = setTimeout(() => {
                if (!isConnectedRef.current) {
                    console.log('⚠️ WebSocket connection timeout after 3 seconds, falling back to polling');
                    console.log('⚠️ This usually means the WebSocket server is not available or reachable');
                    if (currentOrderIdRef.current) {
                        startFallbackPolling(currentOrderIdRef.current);
                    }
                }
            }, 3000); // 3 second timeout
            
            // Create STOMP client
            const stompClient = new Client({
                webSocketFactory: () => socket,
                connectHeaders: {
                    Authorization: token
                },
                debug: (str) => {
                    console.log('🔌 STOMP Debug:', str);
                },
                reconnectDelay: 5000, // Reconnect after 5 seconds if connection lost
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                onConnect: (frame) => {
                    console.log('🟢 WebSocket connected successfully!', frame);
                    isConnectedRef.current = true;
                    connectionRetryCount.current = 0;
                    clearTimeout(connectionTimeout); // Clear timeout since we connected successfully
                    
                    // Stop fallback polling since WebSocket is now connected
                    stopFallbackPolling();
                    
                    // Subscribe to order-specific updates
                    if (stompClient && currentOrderIdRef.current) {
                        stompClient.subscribe(`/topic/orders/${currentOrderIdRef.current}`, (message) => {
                            try {
                                const orderUpdate = JSON.parse(message.body);
                                console.log('Received order update:', orderUpdate);
                                handleOrderUpdate(orderUpdate);
                            } catch (error) {
                                console.error('Error parsing order update message:', error);
                            }
                        });
                        
                        // Subscribe to dasher updates for this order
                        stompClient.subscribe(`/topic/orders/${currentOrderIdRef.current}/dasher`, (message) => {
                            try {
                                const dasherUpdate = JSON.parse(message.body);
                                console.log('Received dasher update:', dasherUpdate);
                                handleDasherUpdate(dasherUpdate);
                            } catch (error) {
                                console.error('Error parsing dasher update message:', error);
                            }
                        });
                        
                        // Initial fetch to get current status
                        fetchOrderStatus(currentOrderIdRef.current);
                    }
                },
                onDisconnect: () => {
                    console.log('🔴 WebSocket disconnected');
                    isConnectedRef.current = false;
                    
                    // Start fallback polling when WebSocket disconnects
                    if (currentOrderIdRef.current) {
                        console.log('🔄 Starting fallback polling due to WebSocket disconnect');
                        startFallbackPolling(currentOrderIdRef.current);
                    }
                },
                onStompError: (frame) => {
                    console.error('🔴 STOMP error:', frame.headers['message']);
                    console.error('🔴 Error details:', frame.body);
                    isConnectedRef.current = false;
                    clearTimeout(connectionTimeout);
                    
                    // Retry connection with exponential backoff
                    if (connectionRetryCount.current < maxRetries) {
                        connectionRetryCount.current++;
                        const retryDelay = Math.pow(2, connectionRetryCount.current) * 1000; // Exponential backoff
                        console.log(`Retrying connection in ${retryDelay}ms (attempt ${connectionRetryCount.current})`);
                        setTimeout(() => {
                            if (currentOrderIdRef.current) {
                                connectWebSocket(currentOrderIdRef.current);
                            }
                        }, retryDelay);
                    } else {
                        console.error('Max WebSocket retry attempts reached, falling back to polling');
                        // Fallback to polling if WebSocket fails
                        if (currentOrderIdRef.current) {
                            startFallbackPolling(currentOrderIdRef.current);
                        }
                    }
                }
            });

            stompClientRef.current = stompClient;
            stompClient.activate();
            
        } catch (error) {
            console.error('❌ Error connecting to WebSocket:', error);
            isConnectedRef.current = false;
            // If WebSocket connection fails entirely, fall back to polling
            if (orderId) {
                console.log('🔄 WebSocket connection failed completely, starting fallback polling immediately');
                startFallbackPolling(orderId);
            }
        }
    };

    // Fallback polling mechanism when WebSocket is not available
    const startFallbackPolling = (orderId: string) => {
        // Don't start polling if WebSocket is connected
        if (isConnectedRef.current) {
            console.log('🔌 WebSocket is connected, skipping fallback polling');
            return;
        }
        
        console.log('🔄 Starting fallback polling for order:', orderId);
        
        // Clear any existing polling using both refs
        if (fallbackPollingRef.current) {
            clearInterval(fallbackPollingRef.current);
            fallbackPollingRef.current = null;
            console.log('🔄 Cleared existing fallback polling interval via ref');
        }
        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
            console.log('🔄 Cleared existing polling interval via state');
        }
        
        // Set initial status polling
        setIsStatusPolling(true);
        console.log('🔄 Set isStatusPolling to true');
        
        // First fetch immediately
        console.log('🔄 Fetching order status immediately...');
        fetchOrderStatus(orderId);
        
        // Then set up interval for subsequent polling (every 5 seconds to reduce log spam)
        const intervalId = setInterval(() => {
            // Only log if WebSocket is not connected to reduce log spam
            if (!isConnectedRef.current) {
                console.log('🔄 Polling interval triggered, fetching status...');
            }
            fetchOrderStatus(orderId);
        }, 5000); // Increased to 5 seconds to reduce log frequency
        
        // Store interval ID in both state and ref for reliable cleanup
        fallbackPollingRef.current = intervalId;
        setStatusPollingInterval(intervalId);
        console.log('🔄 Fallback polling started with 3-second interval');
    };

    // Stop fallback polling
    const stopFallbackPolling = () => {
        console.log('🛑 Attempting to stop fallback polling...');
        
        // Clear interval using ref (most reliable)
        if (fallbackPollingRef.current) {
            clearInterval(fallbackPollingRef.current);
            fallbackPollingRef.current = null;
            console.log('🛑 Cleared fallback polling interval via ref');
        }
        
        // Also clear via state (backup)
        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
            console.log('🛑 Cleared polling interval via state');
        }
        
        setStatusPollingInterval(null);
        setIsStatusPolling(false);
        console.log('🛑 Fallback polling stopped and state reset');
    };
    
    // Disconnect from WebSocket
    const disconnectWebSocket = () => {
        if (stompClientRef.current) {
            console.log('Disconnecting WebSocket');
            stompClientRef.current.deactivate();
            stompClientRef.current = null;
        }
        
        // Also stop any fallback polling
        stopFallbackPolling();
        
        // Reset connection state
        isConnectedRef.current = false;
        currentOrderIdRef.current = null;
        connectionRetryCount.current = 0;
        lastPolledStatusRef.current = null;
    };

    // Handle real-time order updates from WebSocket
    const handleOrderUpdate = (orderUpdate: any) => {
        if (!isMountedRef.current) return;
        
        const newStatus = orderUpdate.status;
        const newDasherId = orderUpdate.dasherId;
        
        console.log('Processing order update:', { newStatus, newDasherId });
        
        // Only update if status has changed or if we now have a dasher assigned
        if ((newStatus && newStatus !== lastPolledStatusRef.current) || 
            (newDasherId && activeOrder && !activeOrder.dasherId) ||
            (newDasherId && (dasherName === "Waiting..." || dasherPhone === "Waiting..."))) {
            
            // Update the last polled status in both state and ref
            lastPolledStatusRef.current = newStatus;
            setLastPolledStatus(newStatus);
            
            // Get the user-friendly status message
            const newStatusMessage = getStatusMessage(newStatus);
            setStatus(newStatusMessage);
            
            // If a dasher is assigned, update dasher info
            if (newDasherId && (!activeOrder?.dasherId || activeOrder.dasherId !== newDasherId)) {
                setActiveOrder(prev => prev ? { ...prev, dasherId: newDasherId } : null);
                fetchDasherInfo(newDasherId);
            }
            
            // Define terminal states - order is completed one way or another
            const isTerminalState = [
                'completed', 'cancelled', 'refunded', 'no-show'
            ].some(state => newStatus === state || newStatus.includes(state));
            
            // If status indicates terminal state, disconnect and refresh full order data
            if (isTerminalState) {
                console.log('Status changed to terminal state:', newStatus);
                disconnectWebSocket();
                fetchOrders();
                return;
            }
            
            // If status is waiting for confirmation, show review modal
            if (newStatus === 'active_waiting_for_confirmation') {
                setShowReviewModal(true);
            }
        }
    };

    // Handle real-time dasher updates from WebSocket
    const handleDasherUpdate = (dasherUpdate: any) => {
        if (!isMountedRef.current) return;
        
        console.log('Processing dasher update:', dasherUpdate);
        
        // Update dasher information
        if (dasherUpdate.name) {
            setDasherName(dasherUpdate.name);
        }
        if (dasherUpdate.phone) {
            const phone = dasherUpdate.phone.replace(/^0/, ''); // Remove leading zero if present
            setDasherPhone(phone);
        }
        if (dasherUpdate.location) {
            // Handle dasher location updates if needed
            console.log('Dasher location update:', dasherUpdate.location);
        }
    };

    // Helper function to fetch dasher information
    const fetchDasherInfo = async (dasherId: string) => {
        try {
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) return;
            
            const [dasherResponse, dasherUserResponse] = await Promise.all([
                axiosInstance.get(`/api/dashers/${dasherId}`, { headers: { Authorization: token } }).catch((error) => {
                    console.error('Error fetching dasher data:', error);
                    return null;
                }),
                axiosInstance.get(`/api/users/${dasherId}`, { headers: { Authorization: token } }).catch((error) => {
                    console.error('Error fetching dasher user data:', error);
                    return null;
                })
            ]);

            if (dasherResponse?.data || dasherUserResponse?.data) {
                const dasherData = dasherResponse?.data || {};
                const dasherUserData = dasherUserResponse?.data || {};
                
                // Try to get name from user data first, then fallback to dasher GCash name
                const firstName = dasherUserData.firstname || "";
                const lastName = dasherUserData.lastname || "";
                const fullName = firstName && lastName ? `${firstName} ${lastName}` : 
                               firstName || lastName || dasherData.gcashName || "Waiting...";
                
                // Try to get phone from user data first, then fallback to dasher GCash number
                const rawPhone = dasherUserData.phone || dasherData.gcashNumber || "Waiting...";
                const phone = rawPhone !== "Waiting..." ? rawPhone.replace(/^0/, '') : rawPhone;
                
                setDasherName(fullName);
                setDasherPhone(phone);
            }
        } catch (error) {
            console.error('Error fetching dasher information:', error);
        }
    };
    
    // Fetch only the order status (lightweight operation)
    const fetchOrderStatus = async (orderId: string) => {
        // Skip if component is unmounted
        if (!isMountedRef.current) return;
        
        try {
            // Only log fetching if WebSocket is not connected to reduce spam
            if (!isConnectedRef.current) {
                console.log('📡 Fetching order status for:', orderId);
            }
            
            // Get token using auth service first for most up-to-date token
            let token = await getAuthToken();
            // Fallback to direct AsyncStorage if needed
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) {
                console.log('❌ No token available for fetchOrderStatus');
                return;
            }
            
            // Use the existing endpoint but we'll only use the status from the response
            const response = await axiosInstance.get(`/api/orders/${orderId}`, {
                headers: { Authorization: token }
            });
            
            if (!isMountedRef.current) return;
            
            // Extract just the status from the full order object
            if (response.data) {
                const orderData = response.data;
                const newStatus = orderData.status;
                const newDasherId = orderData.dasherId;
                
                // Only log the status response if there's a change or WebSocket is not connected
                const hasStatusChange = newStatus && newStatus !== lastPolledStatusRef.current;
                const hasDasherChange = newDasherId && activeOrder && !activeOrder.dasherId;
                const needsDasherInfo = newDasherId && (dasherName === "Waiting..." || dasherPhone === "Waiting...");
                
                if (!isConnectedRef.current && (hasStatusChange || hasDasherChange || needsDasherInfo)) {
                    console.log('📡 Order status response:', { 
                        orderId, 
                        newStatus, 
                        lastPolledStatus: lastPolledStatusRef.current, 
                        newDasherId, 
                        currentDasherId: activeOrder?.dasherId 
                    });
                }
                
                // Only update if status has changed or if we now have a dasher assigned or if we need dasher info
                if ((newStatus && newStatus !== lastPolledStatusRef.current) || 
                    (newDasherId && activeOrder && !activeOrder.dasherId) ||
                    (newDasherId && (dasherName === "Waiting..." || dasherPhone === "Waiting..."))) {
                    
                    // Store the previous status for logging
                    const previousStatus = lastPolledStatusRef.current;
                    
                    // Update the last polled status in both state and ref
                    lastPolledStatusRef.current = newStatus;
                    setLastPolledStatus(newStatus);
                    
                    // Get the user-friendly status message
                    const newStatusMessage = getStatusMessage(newStatus);
                    
                    console.log('✅ Status updated!', { 
                        from: previousStatus, 
                        to: newStatus, 
                        message: newStatusMessage 
                    });
                    
                    // Update only the status text without refreshing entire UI
                    setStatus(newStatusMessage);
                    
                    // If a dasher is assigned and we don't have proper dasher info yet, fetch it
                    if (newDasherId && (!activeOrder?.dasherId || activeOrder.dasherId !== newDasherId || 
                        dasherName === "Waiting..." || dasherPhone === "Waiting...")) {
                        console.log('Dasher assigned, fetching dasher information:', newDasherId);
                        
                        // Fetch dasher information
                        try {
                            const [dasherResponse, dasherUserResponse] = await Promise.all([
                                axiosInstance.get(`/api/dashers/${newDasherId}`, { headers: { Authorization: token } }).catch((error) => {
                                    console.error('Error fetching dasher data:', error);
                                    return null;
                                }),
                                axiosInstance.get(`/api/users/${newDasherId}`, { headers: { Authorization: token } }).catch((error) => {
                                    console.error('Error fetching dasher user data:', error);
                                    return null;
                                })
                            ]);

                            console.log('Dasher response:', dasherResponse?.data);
                            console.log('Dasher user response:', dasherUserResponse?.data);

                            if (dasherResponse?.data || dasherUserResponse?.data) {
                                const dasherData = dasherResponse?.data || {}
                                const dasherUserData = dasherUserResponse?.data || {}
                                
                                console.log('Processing dasher data:', { dasherData, dasherUserData });
                                
                                // Try to get name from user data first, then fallback to dasher GCash name
                                const firstName = dasherUserData.firstname || ""
                                const lastName = dasherUserData.lastname || ""
                                const fullName = firstName && lastName ? `${firstName} ${lastName}` : 
                                               firstName || lastName || dasherData.gcashName || "Waiting..."
                                
                                // Try to get phone from user data first, then fallback to dasher GCash number
                                const rawPhone = dasherUserData.phone || dasherData.gcashNumber || "Waiting..."
                                // Remove leading zero if present
                                const phone = rawPhone !== "Waiting..." ? rawPhone.replace(/^0/, '') : rawPhone
                                
                                console.log('Setting dasher info:', { fullName, phone });
                                
                                setDasherName(fullName)
                                setDasherPhone(phone)
                                
                                // Update activeOrder with the new dasherId
                                setActiveOrder(prev => prev ? { ...prev, dasherId: newDasherId } : null);
                            } else {
                                console.log('No dasher data received from either endpoint');
                            }
                        } catch (dasherError) {
                            console.error('Error fetching dasher information:', dasherError);
                        }
                    }
                    
                    // Define terminal states - order is completed one way or another
                    const isTerminalState = [
                        'completed', 'cancelled', 'refunded', 'no-show'
                    ].some(state => newStatus === state || newStatus.includes(state));
                    
                    // If status indicates terminal state, stop all polling/WebSocket and refresh full order data
                    if (isTerminalState) {
                        console.log('Status changed to terminal state:', newStatus);
                        disconnectWebSocket(); // This will also stop fallback polling
                        fetchOrders();
                        return; // Exit early to prevent further processing
                    }
                    
                    // If status is waiting for confirmation, show review modal
                    if (newStatus === 'active_waiting_for_confirmation') {
                        setShowReviewModal(true);
                    }
                } else if (newStatus) {
                    // Check for terminal state on every poll, even if status hasn't changed
                    const isTerminalState = [
                        'completed', 'cancelled', 'refunded', 'no-show'
                    ].some(state => newStatus === state || newStatus.includes(state));
                    
                    if (isTerminalState) {
                        console.log('Order already in terminal state:', newStatus);
                        disconnectWebSocket(); // This will also stop fallback polling
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching order status:', error);
            // Don't stop polling on error - try again next interval
        }
    };

    // Helper function to get status message
    const getStatusMessage = (status: string): string => {
        const statusMessages: { [key: string]: string } = {
            'active_waiting_for_shop': 'Waiting for shop\'s approval. We\'ll find a dasher soon!',
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
            'refunded': 'Order has been refunded',
            'active_waiting_for_cancel_confirmation': 'Order is waiting for cancellation confirmation',
            'no-show': 'Customer did not show up for the delivery',
            'no_show': 'Customer did not show up for the delivery',  
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
                                <StyledText className="text-[#BC4A4DFF]">Campus</StyledText>
                                <StyledText className="text-[#DAA520]">Eats</StyledText>
                            </StyledText>
                            
                            {/* Loading Text */}
                            <StyledText className="text-[#BC4A4D] text-base font-semibold">Loading...</StyledText>
                        </StyledView>
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
                                {(activeOrder.previousNoShowItems ?? 0) > 0 && (
                                    <StyledView className="flex-row justify-between mb-2">
                                        <StyledText className="text-sm text-[#BC4A4D]">Previous Missed Delivery Items</StyledText>
                                        <StyledText className="text-sm font-medium text-[#BC4A4D]">₱{(activeOrder.previousNoShowItems ?? 0).toFixed(2)}</StyledText>
                                    </StyledView>
                                )}
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
                                        currentUserId={currentUserId || ''}
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
                                    onPress={() => {
                                        console.log('Setting rating to:', star);
                                        setRating(star);
                                    }}
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
                                onPress={() => {
                                    // Use the comprehensive reset function
                                    resetReviewStates();
                                    console.log('Review skipped, all states reset');
                                }}
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
                            <StyledView className="flex-row items-center border border-[#eee] rounded-xl bg-[#F9F6F2]">
                                <StyledText className="text-base text-[#666] pl-4 font-semibold">+63</StyledText>
                                <StyledTextInput
                                    className="flex-1 px-4 py-4 text-base"
                                    placeholder="9XX-XXX-XXXX"
                                    placeholderTextColor="#999"
                                    keyboardType="phone-pad"
                                    value={newPhoneNumber}
                                    onChangeText={(text) => {
                                        // Remove all non-numeric characters for processing
                                        const digitsOnly = text.replace(/\D/g, '');
                                        
                                        // If first digit is 0, skip it and work with remaining digits
                                        let workingDigits = digitsOnly;
                                        if (digitsOnly.startsWith('0') && digitsOnly.length > 1) {
                                            workingDigits = digitsOnly.slice(1);
                                        }
                                        
                                        // Format as XXX-XXX-XXXX
                                        let formatted = '';
                                        if (workingDigits.length >= 3) {
                                            formatted = workingDigits.slice(0, 3);
                                            if (workingDigits.length >= 6) {
                                                formatted += '-' + workingDigits.slice(3, 6);
                                                if (workingDigits.length >= 10) {
                                                    formatted += '-' + workingDigits.slice(6, 10);
                                                } else if (workingDigits.length > 6) {
                                                    formatted += '-' + workingDigits.slice(6);
                                                }
                                            } else if (workingDigits.length > 3) {
                                                formatted += '-' + workingDigits.slice(3);
                                            }
                                        } else {
                                            formatted = workingDigits;
                                        }
                                        
                                        // Limit to 12 characters (XXX-XXX-XXXX format)
                                        if (formatted.length <= 12) {
                                            setNewPhoneNumber(formatted);
                                        }
                                    }}
                                    maxLength={12}
                                />
                            </StyledView>
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