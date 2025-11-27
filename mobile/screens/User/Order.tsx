import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Animated } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useState, useEffect, useRef, useCallback } from "react"
import { getAuthToken, AUTH_TOKEN_KEY, clearStoredAuthState } from "../../services/authService"
import { API_URL } from "../../config"
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import BottomNavigation from "../../components/BottomNavigation"
import { useRouter, useFocusEffect } from "expo-router"
import UserMap from "../../components/Map/UserMap"
import { styled } from "nativewind"
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import * as ImagePicker from 'expo-image-picker';

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledImage = styled(Image)
const StyledScrollView = styled(ScrollView)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledTextInput = styled(TextInput)
const StyledModal = styled(Modal)
const StyledKeyboardAvoidingView = styled(KeyboardAvoidingView)

const AUTH_STORAGE_KEY = '@CampusEats:Auth'
const { width, height } = Dimensions.get("window")

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

const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

const Order = () => {
    const spinValue = useRef(new Animated.Value(0)).current;
    const circleValue = useRef(new Animated.Value(0)).current;

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
    const reviewTimerRef = useRef<NodeJS.Timeout | null>(null)
    const [showShopReviewModal, setShowShopReviewModal] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null)
    const [shopRating, setShopRating] = useState(0)
    const [shopReviewText, setShopReviewText] = useState('')
    const [isSubmittingShopReview, setIsSubmittingShopReview] = useState(false)
    const [showEditPhoneModal, setShowEditPhoneModal] = useState(false)
    const [newPhoneNumber, setNewPhoneNumber] = useState('')
    const [isUpdatingPhone, setIsUpdatingPhone] = useState(false)
    const [showNoShowModal, setShowNoShowModal] = useState(false)
    const [showReportNoShowModal, setShowReportNoShowModal] = useState(false)
    const [noShowProofImage, setNoShowProofImage] = useState<string | null>(null)
    const [noShowGcashQr, setNoShowGcashQr] = useState<string | null>(null)
    const [isSubmittingNoShow, setIsSubmittingNoShow] = useState(false)
    const [showNoShowSuccessModal, setShowNoShowSuccessModal] = useState(false)
    const [vendorDeclinedVisible, setVendorDeclinedVisible] = useState(false)
    const [vendorDeclineMessage, setVendorDeclineMessage] = useState('')
    const vendorDeclineShownRef = useRef(false)
    const [statusPollingInterval, setStatusPollingInterval] = useState<NodeJS.Timeout | null>(null)
    const [isStatusPolling, setIsStatusPolling] = useState(false)
    const [lastPolledStatus, setLastPolledStatus] = useState<string | null>(null)
    const router = useRouter()

    const stompClientRef = useRef<Client | null>(null);
    const isConnectedRef = useRef<boolean>(false);
    const currentOrderIdRef = useRef<string | null>(null);
    const connectionRetryCount = useRef<number>(0);
    const maxRetries = 3;
    const connectionHealthCheckRef = useRef<NodeJS.Timeout | null>(null);

    // CRITICAL FIX: Use refs to prevent stale closures
    const fallbackPollingRef = useRef<NodeJS.Timeout | null>(null);
    const lastPolledStatusRef = useRef<string | null>(null);
    const isMountedRef = useRef(true);
    const activeOrderRef = useRef<OrderItem | null>(null);
    const dasherNameRef = useRef<string>("");
    const dasherPhoneRef = useRef<string>("");

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // CRITICAL FIX: Update refs whenever state changes
    useEffect(() => {
        activeOrderRef.current = activeOrder;
    }, [activeOrder]);

    useEffect(() => {
        dasherNameRef.current = dasherName;
    }, [dasherName]);

    useEffect(() => {
        dasherPhoneRef.current = dasherPhone;
    }, [dasherPhone]);

    useEffect(() => {
        const startAnimations = () => {
            spinValue.setValue(0);
            circleValue.setValue(0);
            
            Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ).start();

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

    useEffect(() => {
        if (!isLoggedIn) return;
        fetchOrders();
    }, [isLoggedIn])

    // Ban check: Automatically sign out user if they have 3 or more offenses
    useEffect(() => {
        console.log('Checking offenses:', offenses);
        console.log('Offenses type:', typeof offenses);
        if (offenses >= 3) {
            console.log('🚨 User has 3+ offenses, automatically signing out');
            // Clear all auth data and redirect to login
            clearStoredAuthState().then(() => {
                router.replace('/');
            });
        }
    }, [offenses]);
    
    useFocusEffect(
        useCallback(() => {
            if (isLoggedIn && isMountedRef.current) {
                console.log('Order screen in focus - refreshing orders');
                fetchOrders(false);
                
                if (activeOrder && activeOrder.id) {
                    const terminalStates = ['completed', 'cancelled', 'refunded'];
                    const isTerminalState = terminalStates.some(state => 
                        activeOrder.status === state || activeOrder.status.includes(state)
                    );
                    
                    if (!isTerminalState) {
                        console.log('Active order found - starting continuous polling');
                        startFallbackPolling(activeOrder.id);
                    }
                }
            }
            
            return () => {};
        }, [isLoggedIn, activeOrder?.id, isStatusPolling])
    );

    const fetchOrders = async (showLoadingIndicator = true) => {
        if (!isMountedRef.current) return;

        try {
            if (showLoadingIndicator) {
                setLoading(true);
            }

            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            const userId = await AsyncStorage.getItem('userId');

            if (!userId || !token) {
                if (showLoadingIndicator) {
                    setLoading(false);
                    setIsLoggedIn(false);
                    router.replace('/');
                }
                return;
            }

            if (!isLoggedIn) {
                setIsLoggedIn(true);
            }

            axiosInstance.defaults.headers.common['Authorization'] = token

            try {
                let retryCount = 0;
                const maxRetries = 2;
                let userResponse;

                while (retryCount <= maxRetries) {
                    try {
                        userResponse = await axiosInstance.get('/api/users/me')
                        break;
                    } catch (error: any) {
                        if (error.response?.status === 401 && retryCount < maxRetries) {
                            const freshToken = await getAuthToken()
                            if (freshToken && freshToken !== token) {
                                token = freshToken
                                axiosInstance.defaults.headers.common['Authorization'] = token
                            }
                            retryCount++
                            await new Promise(resolve => setTimeout(resolve, 1000))
                            continue
                        }
                        throw error
                    }
                }

                if (!userResponse) {
                    throw new Error("Failed to validate token after retries")
                }

                const userData = userResponse.data

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

                await AsyncStorage.setItem('accountType', userData.accountType)
            } catch (error) {
                console.error("Token validation failed:", error)
                await AsyncStorage.multiRemove(['@CampusEats:AuthToken', 'userId', 'accountType',
                    '@CampusEats:UserEmail', '@CampusEats:UserPassword', AUTH_STORAGE_KEY]);
                router.replace('/')
                return
            }

            const ordersResponse = await axiosInstance.get(`/api/orders/user/${userId}`)
            
            if (!ordersResponse.data) {
                throw new Error('No data returned from orders endpoint');
            }
            
            const ordersData = ordersResponse.data

            // Filter out orders where customer reported no-show (these should not appear as active)
            let activeOrdersList = ordersData.activeOrders || [];
            activeOrdersList = activeOrdersList.filter(order => 
                order.status !== 'active_waiting_for_no_show_confirmation' &&
                order.status !== 'dasher-no-show' &&
                order.status !== 'no-show-resolved' &&
                order.status !== 'no_show_resolved'
            );
            
            let activeOrder = activeOrdersList[0] || null;
            
            if (!activeOrder && ordersData.orders && ordersData.orders.length > 0) {
                const activeStatuses = [
                    'active_waiting_for_shop',
                    'active_waiting_for_dasher', 
                    'active_shop_confirmed',
                    'active_preparing',
                    'active_onTheWay',
                    'active_pickedUp',
                    'active_toShop',
                    'active_waiting_for_confirmation',
                    'active_waiting_for_cancel_confirmation'
                    // Note: 'active_waiting_for_no_show_confirmation' and related statuses excluded - customer reported dasher
                ];
                
                activeOrder = ordersData.orders.find(order => 
                    activeStatuses.includes(order.status)
                ) || null;
            }
            
            setActiveOrder(activeOrder)

            if (activeOrder) {
                const [shopResponse, dasherResponse, dasherUserResponse] = await Promise.all([
                    activeOrder.shopId ? axiosInstance.get(`/api/shops/${activeOrder.shopId}`).catch(() => null) : null,
                    activeOrder.dasherId ? axiosInstance.get(`/api/dashers/${activeOrder.dasherId}`).catch(() => null) : null,
                    activeOrder.dasherId ? axiosInstance.get(`/api/users/${activeOrder.dasherId}`).catch(() => null) : null
                ])

                if (shopResponse?.data) {
                    setShop(shopResponse.data)
                }

                if (dasherResponse?.data || dasherUserResponse?.data) {
                    const dasherData = dasherResponse?.data || {}
                    const dasherUserData = dasherUserResponse?.data || {}
                    
                    const firstName = dasherUserData.firstname || ""
                    const lastName = dasherUserData.lastname || ""
                    const fullName = firstName && lastName ? `${firstName} ${lastName}` : 
                                   firstName || lastName || dasherData.gcashName || "Waiting..."
                    
                    const rawPhone = dasherUserData.phone || dasherData.gcashNumber || "Waiting..."
                    const phone = rawPhone !== "Waiting..." ? rawPhone.replace(/^0/, '') : rawPhone
                    
                    setDasherName(fullName)
                    setDasherPhone(phone)
                }

                setStatus(getStatusMessage(activeOrder.status))
            }

            if (ordersData.orders?.length > 0) {
                const ordersWithShopData = await Promise.all(
                    ordersData.orders.map(async (order: OrderItem) => {
                        if (!order.shopId) return order

                        try {
                            const shopResponse = await axiosInstance.get(`/api/shops/${order.shopId}`)
                            return { ...order, shopData: shopResponse.data }
                        } catch (error) {
                            return order
                        }
                    })
                )
                setOrders(ordersWithShopData)
            } else {
                setOrders([])
            }

            await fetchOffenses()

        } catch (error) {
            console.error("❌ Error fetching orders:", error)
            setActiveOrder(null)
            setOrders([])
        } finally {
            setLoading(false)
        }
    }

    const fetchOffenses = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId')
            let token = await getAuthToken()
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken')
            }
            if (!userId || !token) return

            const response = await axiosInstance.get(`/api/users/${userId}/offenses`, {
                headers: { Authorization: token }
            })
            setOffenses(response.data)
        } catch (error) {
            console.error("Error fetching offenses:", error)
        }
    }

    const postOffenses = async () => {
        // ✅ FIXED: Only fetch offense count, don't increment
        // Backend handles offense increment when dasher reports no-show
        await fetchOffenses();
    }

    const handleCancelOrder = async () => {
        try {
            setCancelling(true)
            let token = await getAuthToken()
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
                // Offense increment removed - not needed for cancellations
                setShowCancelModal(false)
                fetchOrders()
            }
        } catch (error) {
            console.error("Error cancelling order:", error)
            Alert.alert("Error", "Failed to cancel order. Please try again.")
        } finally {
            setCancelling(false)
        }
    }

    const completeOrderWithoutReview = async () => {
        // Clear timer if exists
        if (reviewTimerRef.current) {
            clearTimeout(reviewTimerRef.current);
            reviewTimerRef.current = null;
        }
        
        // Complete the order without review
        if (activeOrder?.id) {
            try {
                let token = await getAuthToken();
                if (!token) {
                    token = await AsyncStorage.getItem('@CampusEats:AuthToken');
                }
                if (token) {
                    await axiosInstance.post('/api/orders/update-order-status', {
                        orderId: activeOrder.id,
                        status: "completed"
                    }, {
                        headers: { Authorization: token }
                    });
                }
            } catch (error) {
                console.error("Error completing order:", error);
            }
        }
        
        setRating(0);
        setReviewText('');
        setIsSubmittingReview(false);
        setShowReviewModal(false);
        fetchOrders();
    };
    
    const closeReviewModalOnly = async () => {
        // Close modal and auto-complete order without review (same as timeout behavior)
        console.log('❌ User closed review modal - auto-completing order');
        
        // Clear timer if exists
        if (reviewTimerRef.current) {
            clearTimeout(reviewTimerRef.current);
            reviewTimerRef.current = null;
        }
        
        // Auto-complete without review
        if (activeOrder?.id) {
            try {
                let token = await getAuthToken();
                if (!token) {
                    token = await AsyncStorage.getItem('@CampusEats:AuthToken');
                }
                if (token) {
                    await axiosInstance.post('/api/orders/update-order-status', {
                        orderId: activeOrder.id,
                        status: "completed"
                    }, {
                        headers: { Authorization: token }
                    });
                }
            } catch (error) {
                console.error("Error auto-completing order:", error);
            }
        }
        
        setRating(0);
        setReviewText('');
        setShowReviewModal(false);
        fetchOrders();
    };
    
    const handleSubmitReview = async () => {
        if (rating === 0) {
            Alert.alert("Action Needed", "Please provide a rating.");
            return;
        }
        
        if (!activeOrder?.id) {
            Alert.alert("Error", "Order information not available.");
            return;
        }

        try {
            setIsSubmittingReview(true);
            
            // Clear timer when submitting review
            if (reviewTimerRef.current) {
                clearTimeout(reviewTimerRef.current);
                reviewTimerRef.current = null;
            }
            
            let token = await getAuthToken()
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken')
            }
            if (!token) return;

            const ratingData = {
                dasherId: activeOrder.dasherId || 'unknown',
                rate: rating,
                comment: reviewText,
                type: "dasher",
                orderId: activeOrder.id
            };

            await axiosInstance.post('/api/ratings/dasher-create', ratingData, {
                headers: { Authorization: token }
            });

            await axiosInstance.post('/api/orders/update-order-status', {
                orderId: activeOrder.id,
                status: "completed"
            }, {
                headers: { Authorization: token }
            });

            // Clear timer and close modal after successful review submission
            if (reviewTimerRef.current) {
                clearTimeout(reviewTimerRef.current);
                reviewTimerRef.current = null;
            }
            
            setRating(0);
            setReviewText('');
            setShowReviewModal(false);
            fetchOrders();
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

        const digitsOnly = newPhoneNumber.replace(/\D/g, '');
        if (!newPhoneNumber || digitsOnly.length !== 10 || !digitsOnly.startsWith('9')) {
            Alert.alert("Invalid Phone Number", "Please enter a valid mobile number.");
            return;
        }

        if (!activeOrder) {
            Alert.alert("Error", "Order information not available.");
            return;
        }

        try {
            setIsUpdatingPhone(true);
            let token = await getAuthToken()
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken')
            }
            if (!token) return;

            await axiosInstance.put(`/api/orders/update/${activeOrder.id}/mobileNum`, null, {
                params: { mobileNum: newPhoneNumber },
                headers: { Authorization: token }
            });

            Alert.alert("Success", "Phone number updated successfully");
            setShowEditPhoneModal(false);
            fetchOrders();
        } catch (error) {
            console.error("Error updating phone number:", error);
            Alert.alert("Error", "Failed to update phone number. Please try again.");
        } finally {
            setIsUpdatingPhone(false);
        }
    };

    const handlePickNoShowProof = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant permission to access your photos.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setNoShowProofImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    const handlePickGcashQr = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant permission to access your photos.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setNoShowGcashQr(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking GCash QR:', error);
            Alert.alert('Error', 'Failed to pick GCash QR. Please try again.');
        }
    };

    const handleReportNoShow = async () => {
        if (!noShowProofImage) {
            Alert.alert("Action Needed", "Please upload proof image before submitting.");
            return;
        }

        if (!noShowGcashQr) {
            Alert.alert("Action Needed", "Please upload your GCash QR code for refund processing.");
            return;
        }

        if (!activeOrder?.id) {
            Alert.alert("Error", "Order information not available.");
            return;
        }

        try {
            setIsSubmittingNoShow(true);
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) return;

            const formData = new FormData();
            formData.append('orderId', activeOrder.id);
            
            // Add proof image
            const proofFilename = noShowProofImage.split('/').pop() || 'proof.jpg';
            const proofMatch = /\.(\w+)$/.exec(proofFilename);
            const proofType = proofMatch ? `image/${proofMatch[1]}` : 'image/jpeg';

            formData.append('proofImage', {
                uri: noShowProofImage,
                name: proofFilename,
                type: proofType,
            } as any);

            // Add GCash QR image
            const gcashFilename = noShowGcashQr.split('/').pop() || 'gcash_qr.jpg';
            const gcashMatch = /\.(\w+)$/.exec(gcashFilename);
            const gcashType = gcashMatch ? `image/${gcashMatch[1]}` : 'image/jpeg';

            formData.append('gcashQr', {
                uri: noShowGcashQr,
                name: gcashFilename,
                type: gcashType,
            } as any);

            const response = await axiosInstance.post('/api/orders/customer-report-no-show', formData, {
                headers: {
                    Authorization: token,
                    'Content-Type': 'multipart/form-data',
                }
            });

            if (response.status === 200) {
                setShowReportNoShowModal(false);
                setNoShowProofImage(null);
                setNoShowGcashQr(null);
                setShowNoShowSuccessModal(true);
            }
        } catch (error: any) {
            console.error("Error reporting no-show:", error);
            Alert.alert("Error", error.response?.data?.error || "Failed to submit report. Please try again.");
        } finally {
            setIsSubmittingNoShow(false);
        }
    };

    const handleShopReview = async () => {
        if (shopRating === 0 || !selectedOrder?.shopId) {
            Alert.alert("Action Needed", "Please provide a rating.");
            return;
        }

        try {
            setIsSubmittingShopReview(true);
            let token = await getAuthToken()
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

            await axiosInstance.post('/api/ratings/shop-create', ratingData, {
                headers: { Authorization: token }
            });

            setShowShopReviewModal(false);
            setSelectedOrder(null);
            setShopRating(0);
            setShopReviewText('');
            fetchOrders();
        } catch (error) {
            console.error("Error submitting shop review:", error);
            Alert.alert("Error", "Failed to submit review. Please try again.");
        } finally {
            setIsSubmittingShopReview(false);
        }
    };

    useEffect(() => {
        if (activeOrder && activeOrder.status === 'active_waiting_for_confirmation') {
            setRating(0);
            setReviewText('');
            setShowReviewModal(true);
            
            // Start 5-minute (300000ms) auto-complete timer
            if (reviewTimerRef.current) {
                clearTimeout(reviewTimerRef.current);
            }
            
            reviewTimerRef.current = setTimeout(async () => {
                console.log('⏰ Auto-completing order - review timeout');
                
                // Auto-complete without review
                if (activeOrder?.id) {
                    try {
                        let token = await getAuthToken();
                        if (!token) {
                            token = await AsyncStorage.getItem('@CampusEats:AuthToken');
                        }
                        if (token) {
                            await axiosInstance.post('/api/orders/update-order-status', {
                                orderId: activeOrder.id,
                                status: "completed"
                            }, {
                                headers: { Authorization: token }
                            });
                        }
                    } catch (error) {
                        console.error("Error auto-completing order:", error);
                    }
                }
                
                setRating(0);
                setReviewText('');
                setShowReviewModal(false);
                fetchOrders();
            }, 300000); // 5 minutes
        }

        disconnectWebSocket();
        
        lastPolledStatusRef.current = null;
        setLastPolledStatus(null);
        
        const terminalStates = ['completed', 'cancelled', 'refunded', 'no-show'];
        const isTerminalState = activeOrder?.status ? terminalStates.some(state => 
            activeOrder.status === state || activeOrder.status.includes(state)
        ) : false;
        
        if (activeOrder && activeOrder.id && !isTerminalState) {
            connectWebSocket(activeOrder.id);
            
            setTimeout(() => {
                if (!isConnectedRef.current && currentOrderIdRef.current === activeOrder.id) {
                    startFallbackPolling(activeOrder.id);
                }
            }, 500);
        }
        
        return () => {
            disconnectWebSocket();
            
            // Clear review timer on cleanup
            if (reviewTimerRef.current) {
                clearTimeout(reviewTimerRef.current);
                reviewTimerRef.current = null;
            }
        };
    }, [activeOrder?.id]);

    const connectWebSocket = async (orderId: string) => {
        try {
            disconnectWebSocket();
            
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) {
                return;
            }

            currentOrderIdRef.current = orderId;

            const wsUrl = API_URL + '/ws';
            const socket = new SockJS(wsUrl);
            
            const connectionTimeout = setTimeout(() => {
                if (!isConnectedRef.current && currentOrderIdRef.current) {
                    startFallbackPolling(currentOrderIdRef.current);
                }
            }, 3000);
            
            const stompClient = new Client({
                webSocketFactory: () => socket,
                connectHeaders: {
                    Authorization: token
                },
                debug: (str) => {
                    if (str.includes('connected') || str.includes('error') || str.includes('disconnect')) {
                        console.log('🔌 STOMP Debug:', str);
                    }
                },
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                onConnect: (frame) => {
                    console.log('🟢 WebSocket connected successfully!');
                    isConnectedRef.current = true;
                    connectionRetryCount.current = 0;
                    clearTimeout(connectionTimeout);
                    
                    stopFallbackPolling();
                    
                    if (stompClient && currentOrderIdRef.current) {
                        try {
                            stompClient.subscribe(`/topic/orders/${currentOrderIdRef.current}`, (message) => {
                                try {
                                    const orderUpdate = JSON.parse(message.body);
                                    handleOrderUpdate(orderUpdate);
                                } catch (error) {
                                    console.error('❌ Error parsing order update:', error);
                                }
                            });
                            
                            stompClient.subscribe(`/topic/orders/${currentOrderIdRef.current}/dasher`, (message) => {
                                try {
                                    const dasherUpdate = JSON.parse(message.body);
                                    handleDasherUpdate(dasherUpdate);
                                } catch (error) {
                                    console.error('❌ Error parsing dasher update:', error);
                                }
                            });
                            
                            stompClient.subscribe('/topic/order-status', (message) => {
                                try {
                                    const statusUpdate = JSON.parse(message.body);
                                    if (statusUpdate.orderId === currentOrderIdRef.current) {
                                        handleOrderUpdate(statusUpdate);
                                    }
                                } catch (error) {
                                    console.error('❌ Error parsing global status:', error);
                                }
                            });
                            
                            connectionHealthCheckRef.current = setInterval(() => {
                                if (stompClient && stompClient.connected && currentOrderIdRef.current) {
                                    fetchOrderStatus(currentOrderIdRef.current);
                                } else if (currentOrderIdRef.current) {
                                    isConnectedRef.current = false;
                                    startFallbackPolling(currentOrderIdRef.current);
                                    if (connectionHealthCheckRef.current) {
                                        clearInterval(connectionHealthCheckRef.current);
                                        connectionHealthCheckRef.current = null;
                                    }
                                }
                            }, 5000);
                            
                            if (currentOrderIdRef.current) {
                                fetchOrderStatus(currentOrderIdRef.current);
                            }
                        } catch (subscriptionError) {
                            console.error('❌ Error subscribing:', subscriptionError);
                            if (currentOrderIdRef.current) {
                                startFallbackPolling(currentOrderIdRef.current);
                            }
                        }
                    }
                },
                onDisconnect: () => {
                    console.log('🔴 WebSocket disconnected');
                    isConnectedRef.current = false;
                    
                    if (currentOrderIdRef.current) {
                        startFallbackPolling(currentOrderIdRef.current);
                    }
                },
                onStompError: (frame) => {
                    console.error('🔴 STOMP error:', frame.headers?.['message']);
                    isConnectedRef.current = false;
                    clearTimeout(connectionTimeout);
                    
                    if (connectionRetryCount.current < maxRetries) {
                        connectionRetryCount.current++;
                        const retryDelay = Math.pow(2, connectionRetryCount.current) * 1000;
                        setTimeout(() => {
                            if (currentOrderIdRef.current && isMountedRef.current) {
                                connectWebSocket(currentOrderIdRef.current);
                            }
                        }, retryDelay);
                    } else {
                        if (currentOrderIdRef.current) {
                            startFallbackPolling(currentOrderIdRef.current);
                        }
                    }
                },
                onWebSocketClose: (evt) => {
                    console.log('🔴 WebSocket closed');
                    isConnectedRef.current = false;
                    
                    if (currentOrderIdRef.current && isMountedRef.current) {
                        startFallbackPolling(currentOrderIdRef.current);
                    }
                },
                onWebSocketError: (evt) => {
                    console.error('❌ WebSocket error:', evt);
                    isConnectedRef.current = false;
                }
            });

            stompClientRef.current = stompClient;
            
            try {
                stompClient.activate();
            } catch (activationError) {
                console.error('❌ Failed to activate STOMP client:', activationError);
                if (orderId) {
                    startFallbackPolling(orderId);
                }
            }
            
        } catch (error) {
            console.error('❌ Error connecting to WebSocket:', error);
            isConnectedRef.current = false;
            if (orderId) {
                startFallbackPolling(orderId);
            }
        }
    };

    // CRITICAL FIX: Improved fallback polling
    const startFallbackPolling = (orderId: string) => {
        console.log('🔄 Starting fallback polling for order:', orderId);
        
        if (fallbackPollingRef.current) {
            clearInterval(fallbackPollingRef.current);
            fallbackPollingRef.current = null;
        }
        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
        }
        
        setIsStatusPolling(true);
        
        fetchOrderStatus(orderId);
        
        const intervalId = setInterval(async () => {
            console.log('🔄 Polling check...');
            
            await fetchOrders(false);
            
            const currentOrderId = activeOrderRef.current?.id;
            if (currentOrderId) {
                try {
                    const token = await getAuthToken();
                    if (token) {
                        const orderStatusResponse = await axiosInstance.get(`/api/orders/${currentOrderId}`, {
                            headers: { Authorization: token }
                        });
                        const orderStatus = orderStatusResponse.data.status;
                        console.log('🔄 Direct order status from polling:', orderStatus);
                        
                        // CRITICAL FIX: Check for no-show FIRST before any other processing
                        // Note: 'active_waiting_for_no_show_confirmation' is NOT a customer no-show - it means customer reported dasher
                        const isNoShow = orderStatus === 'no-show' || 
                                        orderStatus === 'no_show' || 
                                        (orderStatus?.toLowerCase().includes('noshow') && orderStatus !== 'active_waiting_for_no_show_confirmation') ||
                                        (orderStatus?.toLowerCase().includes('no-show') && orderStatus !== 'active_waiting_for_no_show_confirmation');
                        
                        if (isNoShow) {
                            console.log('🚨🚨🚨 NO-SHOW DETECTED IN POLLING');
                            
                            // ✅ Backend already incremented offense - just fetch updated count
                            await fetchOffenses().catch(err => console.error('Error fetching offenses:', err));
                            
                            // Stop polling immediately
                            if (fallbackPollingRef.current) {
                                clearInterval(fallbackPollingRef.current);
                                fallbackPollingRef.current = null;
                            }
                            
                            // Disconnect WebSocket
                        disconnectWebSocket();
                        
                        // Show modal with setTimeout to ensure state update
                        setTimeout(() => {
                            if (isMountedRef.current) {
                                setShowNoShowModal(true);
                                setStatus(getStatusMessage(orderStatus));
                            }
                        }, 0);
                        
                        return;
                    }                        // Detect vendor/shop cancellation statuses coming from polling
                        const isVendorDecline = orderStatus === 'cancelled_by_shop' || orderStatus === 'active_waiting_for_shop_cancel_confirmation';
                        if (isVendorDecline && !vendorDeclineShownRef.current) {
                            vendorDeclineShownRef.current = true;
                            // Stop polling and disconnect websocket
                            if (fallbackPollingRef.current) {
                                clearInterval(fallbackPollingRef.current);
                                fallbackPollingRef.current = null;
                            }
                            disconnectWebSocket();

                            // Set message and show modal
                            setTimeout(() => {
                                if (isMountedRef.current) {
                                            const pollOrderId = activeOrderRef.current?.id || currentOrderId || '';
                                            const pollMessage = pollOrderId
                                                ? `We're sorry — some items in your order (Order #${pollOrderId}) are out of stock. Your order has been cancelled. We apologize for the inconvenience.`
                                                : `We're sorry — your order was cancelled by the shop. We apologize for the inconvenience.`;
                                            setVendorDeclineMessage(pollMessage);
                                    setVendorDeclinedVisible(true);
                                }
                            }, 0);
                            return;
                        }
                    }
                } catch (error) {
                    console.error('❌ Error in direct order status check:', error);
                }
            }
        }, 3000);
        
        fallbackPollingRef.current = intervalId;
        setStatusPollingInterval(intervalId);
    };

    const stopFallbackPolling = () => {
        if (fallbackPollingRef.current) {
            clearInterval(fallbackPollingRef.current);
            fallbackPollingRef.current = null;
        }
        
        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
        }
        
        setStatusPollingInterval(null);
        setIsStatusPolling(false);
    };
    
    const disconnectWebSocket = () => {
        if (connectionHealthCheckRef.current) {
            clearTimeout(connectionHealthCheckRef.current);
            connectionHealthCheckRef.current = null;
        }
        
        if (stompClientRef.current) {
            try {
                stompClientRef.current.deactivate();
            } catch (error) {
                console.error('❌ Error during WebSocket disconnection:', error);
            }
            stompClientRef.current = null;
        }
        
        stopFallbackPolling();
        
        isConnectedRef.current = false;
        currentOrderIdRef.current = null;
        connectionRetryCount.current = 0;
        lastPolledStatusRef.current = null;
    };

    // CRITICAL FIX: Improved handleOrderUpdate with no-show check FIRST
    const handleOrderUpdate = (orderUpdate: any) => {
        if (!isMountedRef.current) return;
        
        const newStatus = orderUpdate.status;
        const newDasherId = orderUpdate.dasherId;
        
        console.log('🔄 Processing order update:', { newStatus, newDasherId });
        
        // CRITICAL FIX: Check for no-show FIRST before any other processing
        // Note: 'active_waiting_for_no_show_confirmation' is NOT a customer no-show - it means customer reported dasher
        const isNoShow = newStatus === 'no-show' || 
                        newStatus === 'no_show' || 
                        (newStatus?.toLowerCase().includes('noshow') && newStatus !== 'active_waiting_for_no_show_confirmation') ||
                        (newStatus?.toLowerCase().includes('no-show') && newStatus !== 'active_waiting_for_no_show_confirmation');
        
        if (isNoShow) {
            console.log('🚨🚨🚨 NO-SHOW DETECTED VIA WEBSOCKET!');
            
            // ✅ Backend already incremented offense - just fetch updated count
            fetchOffenses().catch(err => console.error('Error fetching offenses:', err));
            
            // Stop polling immediately
            if (fallbackPollingRef.current) {
                clearInterval(fallbackPollingRef.current);
                fallbackPollingRef.current = null;
            }
            
            // Disconnect WebSocket
            disconnectWebSocket();
            
            // Show modal with setTimeout to ensure state update
            setTimeout(() => {
                if (isMountedRef.current) {
                    setShowNoShowModal(true);
                    setStatus(getStatusMessage(newStatus));
                }
            }, 0);
            
            return; // Exit early
        }

        // Detect vendor/shop cancellation statuses coming from websocket updates
        const isVendorDeclineWS = newStatus === 'cancelled_by_shop' || newStatus === 'active_waiting_for_shop_cancel_confirmation';
        if (isVendorDeclineWS && !vendorDeclineShownRef.current) {
            vendorDeclineShownRef.current = true;

            // Stop polling and disconnect websocket
            if (fallbackPollingRef.current) {
                clearInterval(fallbackPollingRef.current);
                fallbackPollingRef.current = null;
            }
            disconnectWebSocket();

            // Show modal to the user
            setTimeout(() => {
                if (isMountedRef.current) {
                    const wsOrderId = activeOrderRef.current?.id || currentOrderIdRef.current || '';
                    const wsMessage = wsOrderId
                        ? `We're sorry — some items in your order (Order #${wsOrderId}) are out of stock. Your order has been cancelled. We apologize for the inconvenience.`
                        : `We're sorry — your order was cancelled by the shop. We apologize for the inconvenience.`;
                    setVendorDeclineMessage(wsMessage);
                    setVendorDeclinedVisible(true);
                }
            }, 0);

            return; // exit early after handling decline
        }
        
        // Only update if status has changed or if we now have a dasher assigned
        if ((newStatus && newStatus !== lastPolledStatusRef.current) || 
            (newDasherId && activeOrderRef.current && !activeOrderRef.current.dasherId) ||
            (newDasherId && (dasherNameRef.current === "Waiting..." || dasherPhoneRef.current === "Waiting..."))) {
            
            lastPolledStatusRef.current = newStatus;
            setLastPolledStatus(newStatus);
            
            const newStatusMessage = getStatusMessage(newStatus);
            setStatus(newStatusMessage);
            
            if (newDasherId && (!activeOrderRef.current?.dasherId || activeOrderRef.current.dasherId !== newDasherId)) {
                setActiveOrder(prev => prev ? { ...prev, dasherId: newDasherId } : null);
                fetchDasherInfo(newDasherId);
            }
            
            const isTerminalState = [
                'completed', 'cancelled', 'refunded'
            ].some(state => newStatus === state || newStatus.includes(state));
            
            if (isTerminalState) {
                disconnectWebSocket();
                fetchOrders();
                return;
            }
            
            if (newStatus === 'active_waiting_for_confirmation') {
                setShowReviewModal(true);
            }
        }
    };

    const handleDasherUpdate = (dasherUpdate: any) => {
        if (!isMountedRef.current) return;
        
        if (dasherUpdate.name) {
            setDasherName(dasherUpdate.name);
        }
        if (dasherUpdate.phone) {
            const phone = dasherUpdate.phone.replace(/^0/, '');
            setDasherPhone(phone);
        }
    };

    const fetchDasherInfo = async (dasherId: string) => {
        try {
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) return;
            
            const [dasherResponse, dasherUserResponse] = await Promise.all([
                axiosInstance.get(`/api/dashers/${dasherId}`, { headers: { Authorization: token } }).catch(() => null),
                axiosInstance.get(`/api/users/${dasherId}`, { headers: { Authorization: token } }).catch(() => null)
            ]);

            if (dasherResponse?.data || dasherUserResponse?.data) {
                const dasherData = dasherResponse?.data || {};
                const dasherUserData = dasherUserResponse?.data || {};
                
                const firstName = dasherUserData.firstname || "";
                const lastName = dasherUserData.lastname || "";
                const fullName = firstName && lastName ? `${firstName} ${lastName}` : 
                               firstName || lastName || dasherData.gcashName || "Waiting...";
                
                const rawPhone = dasherUserData.phone || dasherData.gcashNumber || "Waiting...";
                const phone = rawPhone !== "Waiting..." ? rawPhone.replace(/^0/, '') : rawPhone;
                
                setDasherName(fullName);
                setDasherPhone(phone);
            }
        } catch (error) {
            console.error('Error fetching dasher information:', error);
        }
    };
    
    // CRITICAL FIX: Improved fetchOrderStatus with no-show check FIRST
    const fetchOrderStatus = async (orderId: string) => {
        if (!isMountedRef.current) return;
        
        try {
            console.log('🔍 Checking order status for:', orderId);
            
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) return;
            
            const response = await axiosInstance.get(`/api/orders/${orderId}`, {
                headers: { Authorization: token }
            });
            
            if (!isMountedRef.current) return;
            
            if (response.data) {
                const orderData = response.data;
                const newStatus = orderData.status;
                const newDasherId = orderData.dasherId;
                
                console.log('📡 Status received:', newStatus);
                
                // CRITICAL FIX: Check for no-show FIRST before terminal state check
                const isNoShow = newStatus === 'no-show' || 
                                newStatus === 'no_show' || 
                                (newStatus?.toLowerCase().includes('noshow') && newStatus !== 'active_waiting_for_no_show_confirmation') ||
                                (newStatus?.toLowerCase().includes('no-show') && newStatus !== 'active_waiting_for_no_show_confirmation');
                
                if (isNoShow) {
                    console.log('🚨🚨🚨 NO-SHOW DETECTED IN API POLLING!');
                    
                    // ✅ Backend already incremented offense - just fetch updated count
                    await fetchOffenses().catch(err => console.error('Error fetching offenses:', err));
                    
                    // Stop polling immediately
                    if (fallbackPollingRef.current) {
                        clearInterval(fallbackPollingRef.current);
                        fallbackPollingRef.current = null;
                    }
                    if (statusPollingInterval) {
                        clearInterval(statusPollingInterval);
                        setStatusPollingInterval(null);
                    }
                    
                    // Disconnect WebSocket
                    disconnectWebSocket();
                    
                    // Show modal with setTimeout to ensure state update
                    setTimeout(() => {
                        if (isMountedRef.current) {
                            setShowNoShowModal(true);
                            setStatus(getStatusMessage(newStatus));
                        }
                    }, 0);
                    
                    return; // Exit early
                }

                // Detect vendor/shop cancellation statuses coming from API polling
                const isVendorDeclineApi = newStatus === 'cancelled_by_shop' || newStatus === 'active_waiting_for_shop_cancel_confirmation';
                if (isVendorDeclineApi && !vendorDeclineShownRef.current) {
                    vendorDeclineShownRef.current = true;

                    // Stop polling and disconnect websocket
                    if (fallbackPollingRef.current) {
                        clearInterval(fallbackPollingRef.current);
                        fallbackPollingRef.current = null;
                    }
                    if (statusPollingInterval) {
                        clearInterval(statusPollingInterval);
                        setStatusPollingInterval(null);
                    }
                    disconnectWebSocket();

                    setTimeout(() => {
                        if (isMountedRef.current) {
                            const apiOrderId = activeOrderRef.current?.id || orderId || '';
                            const apiMessage = apiOrderId
                                ? `We're sorry — some items in your order (Order #${apiOrderId}) are out of stock. Your order has been cancelled and a refund (if applicable) has been initiated. We apologize for the inconvenience.`
                                : `We're sorry — your order was cancelled by the shop. A refund (if applicable) has been initiated. We apologize for the inconvenience.`;
                            setVendorDeclineMessage(apiMessage);
                            setVendorDeclinedVisible(true);
                        }
                    }, 0);

                    return; // Exit after handling
                }
                
                const hasStatusChange = newStatus && newStatus !== lastPolledStatusRef.current;
                const hasDasherChange = newDasherId && activeOrderRef.current && !activeOrderRef.current.dasherId;
                const needsDasherInfo = newDasherId && (dasherNameRef.current === "Waiting..." || dasherPhoneRef.current === "Waiting...");
                
                if ((newStatus && newStatus !== lastPolledStatusRef.current) || 
                    (newDasherId && activeOrderRef.current && !activeOrderRef.current.dasherId) ||
                    (newDasherId && (dasherNameRef.current === "Waiting..." || dasherPhoneRef.current === "Waiting..."))) {
                    
                    const previousStatus = lastPolledStatusRef.current;
                    
                    lastPolledStatusRef.current = newStatus;
                    setLastPolledStatus(newStatus);
                    
                    const newStatusMessage = getStatusMessage(newStatus);
                    setStatus(newStatusMessage);
                    
                    if (newDasherId && (!activeOrderRef.current?.dasherId || activeOrderRef.current.dasherId !== newDasherId || 
                        dasherNameRef.current === "Waiting..." || dasherPhoneRef.current === "Waiting...")) {
                        
                        try {
                            const [dasherResponse, dasherUserResponse] = await Promise.all([
                                axiosInstance.get(`/api/dashers/${newDasherId}`, { headers: { Authorization: token } }).catch(() => null),
                                axiosInstance.get(`/api/users/${newDasherId}`, { headers: { Authorization: token } }).catch(() => null)
                            ]);

                            if (dasherResponse?.data || dasherUserResponse?.data) {
                                const dasherData = dasherResponse?.data || {}
                                const dasherUserData = dasherUserResponse?.data || {}
                                
                                const firstName = dasherUserData.firstname || ""
                                const lastName = dasherUserData.lastname || ""
                                const fullName = firstName && lastName ? `${firstName} ${lastName}` : 
                                               firstName || lastName || dasherData.gcashName || "Waiting..."
                                
                                const rawPhone = dasherUserData.phone || dasherData.gcashNumber || "Waiting..."
                                const phone = rawPhone !== "Waiting..." ? rawPhone.replace(/^0/, '') : rawPhone
                                
                                setDasherName(fullName)
                                setDasherPhone(phone)
                                
                                setActiveOrder(prev => prev ? { ...prev, dasherId: newDasherId } : null);
                            }
                        } catch (dasherError) {
                            console.error('Error fetching dasher information:', dasherError);
                        }
                    }
                    
                    // NOW check for terminal states (after no-show check)
                    const isTerminalState = [
                        'completed', 'cancelled', 'refunded'
                    ].some(state => newStatus === state || newStatus.includes(state));
                    
                    if (isTerminalState) {
                        disconnectWebSocket();
                        fetchOrders();
                        return;
                    }
                    
                    if (newStatus === 'active_waiting_for_confirmation') {
                        setShowReviewModal(true);
                    }
                } else if (newStatus) {
                    const isTerminalState = [
                        'completed', 'cancelled', 'refunded'
                    ].some(state => newStatus === state || newStatus.includes(state));
                    
                    if (isTerminalState) {
                        disconnectWebSocket();
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching order status:', error);
        }
    };

    const getStatusMessage = (status: string): string => {
        const statusMessages: { [key: string]: string } = {
            'active_waiting_for_shop': 'Waiting for shop\'s approval. We\'ll find a dasher soon!',
            'active_waiting_for_dasher': 'Searching for Dashers. Hang tight, this might take a little time!',
            'active_shop_confirmed': 'Searching for Dashers. Hang tight, this might take a little time!',
            'active_toShop': 'Dasher is on the way to the shop',
            'active_dasher_arrived': 'Dasher has arrived at the shop. Waiting for order preparation.',
            'active_preparing': 'Shop is preparing your order',
            'active_ready_for_pickup': 'Your order is ready! Dasher will pick it up soon.',
            'active_onTheWay': 'Order is on the way',
            'active_delivered': 'Order has been delivered',
            'active_waiting_for_confirmation': 'Waiting for your confirmation',
            'active_pickedUp': 'Dasher has picked up your order',
            'cancelled_by_customer': 'Order has been cancelled',
            'cancelled_by_dasher': 'Order has been cancelled',
            'cancelled_by_shop': 'Order has been cancelled',
            'refunded': 'Order has been refunded',
            'active_waiting_for_cancel_confirmation': 'Order is waiting for cancellation confirmation',
            'no-show': 'Customer did not show up for the delivery',
            'no_show': 'Customer did not show up for the delivery',  
            'active_waiting_for_no_show_confirmation': 'No-show report submitted. Awaiting admin review for refund.',
            'dasher-no-show': 'Dasher no-show confirmed. Your refund is being processed.',
            'no-show-resolved': 'No-show case resolved',
            'no_show_resolved': 'No-show case resolved'
        }
        return statusMessages[status] || 'Unknown status'
    }

    const hideCancelButton = status === 'Shop is preparing your order' ||
        status === 'Your order is ready! Dasher will pick it up soon.' ||
        status === 'Order has been picked up' ||
        status === 'Dasher has picked up your order' ||
        status === 'Order is on the way' ||
        status === 'Order has been delivered' ||
        status === 'Order has been completed' ||
        status === 'Order is waiting for cancellation confirmation' ||
        status === 'Waiting for your confirmation' ||
        status === 'Dasher is on the way to the shop'

    const modalContentStyle = "bg-white rounded-3xl p-8 w-[90%] max-w-[400px]";
    const modalHeaderStyle = "flex-row justify-between items-center mb-6";
    const modalTitleStyle = "text-xl font-bold text-[#8B4513]";
    const modalButtonRowStyle = "flex-row justify-between mt-6";
    const modalCancelButtonStyle = "bg-[#DFD6C5] py-4 px-6 rounded-2xl flex-1 mr-4";
    const modalSubmitButtonStyle = "bg-[#BC4A4D] py-4 px-6 rounded-2xl flex-1";
    const modalButtonTextStyle = "text-base font-bold text-center";

    return (
        <StyledView className="flex-1 bg-[#DFD6C5]">
            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingTop: 20, paddingBottom: 80, paddingHorizontal: 15 }}>
                <StyledText className="text-2xl font-bold mb-6 text-[#BC4A4D]">Active Order</StyledText>

                {/* Offense Warning */}
                {offenses > 0 && offenses < 3 && (
                    <StyledView className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 mx-1">
                        <StyledText className="text-red-800 text-sm">
                            <StyledText className="font-semibold">Warning!</StyledText>
                            {' '}x{offenses} {offenses > 1 ? "offenses" : "offense"} recorded. 3 cancellations will lead to account ban.
                        </StyledText>
                    </StyledView>
                )}

                {loading ? (
                    <StyledView className="flex-1 justify-center items-center py-16">
                        <StyledView className="items-center bg-white rounded-3xl p-8 mx-4" style={{
                            shadowColor: "#8B4513",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.15,
                            shadowRadius: 20,
                            elevation: 8,
                        }}>
                            <StyledView className="relative mb-6">
                                <Animated.View
                                    style={{
                                        transform: [{ rotate: circleRotation }],
                                        width: 80,
                                        height: 80,
                                        borderRadius: 40,
                                        borderWidth: 3,
                                        borderColor: 'rgba(218, 165, 32, 0.2)',
                                        borderTopColor: '#DAA520',
                                        position: 'absolute',
                                    }}
                                />
                                
                                <StyledView className="w-16 h-16 rounded-full bg-[#DAA520]/10 items-center justify-center mx-2 my-2">
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
                            
                            <StyledText className="text-xl font-bold mb-3">
                                <StyledText className="text-[#BC4A4D]">Campus</StyledText>
                                <StyledText className="text-[#DAA520]">Eats</StyledText>
                            </StyledText>
                            
                            <StyledText className="text-[#8B4513] text-base font-semibold">Loading your orders...</StyledText>
                        </StyledView>
                    </StyledView>
                ) : activeOrder ? (
                    <StyledView className="flex-1">
                        {/* Map Section at Top */}
                        {activeOrder?.dasherId && (
                            <StyledView className="mb-4">
                                <StyledView className="rounded-2xl overflow-hidden" style={{
                                    height: 250,
                                    shadowColor: "#8B4513",
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 12,
                                    elevation: 6,
                                }}>
                                    <UserMap
                                        orderId={activeOrder.id}
                                        height={250}
                                    />
                                </StyledView>
                            </StyledView>
                        )}

                        {/* Status and Order Details Card */}
                        <StyledView className="bg-white rounded-2xl p-4 mb-4" style={{
                            shadowColor: "#8B4513",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 12,
                            elevation: 4,
                        }}>
                            {/* Status Section */}
                            <StyledTouchableOpacity 
                                className="bg-gradient-to-r from-[#DAA520]/20 to-[#BC4A4D]/20 rounded-xl p-4 w-full border border-[#DAA520]/30 mb-4"
                                onPress={() => {
                                    if (activeOrder?.id) {
                                        fetchOrderStatus(activeOrder.id);
                                    }
                                }}
                            >
                                <StyledText className="text-lg text-[#BC4A4D] text-center font-bold leading-6">{status}</StyledText>
                                <StyledText className="text-xs text-[#8B4513] text-center mt-1 opacity-60"></StyledText>
                            </StyledTouchableOpacity>

                            {/* Order Details Section */}
                            <StyledView className="flex-row mb-4">
                                <StyledImage
                                    source={{ uri: shop?.imageUrl || "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=100&width=100" }}
                                    className="w-16 h-16 rounded-xl mr-3"
                                />
                                <StyledView className="flex-1">
                                    <StyledText className="text-lg font-bold text-[#BC4A4D] mb-1">{shop?.name || "Loading..."}</StyledText>
                                    <StyledText className="text-xs text-[#8B4513]/70 mb-2">{shop?.address || "Loading..."}</StyledText>
                                    <StyledView className="flex-row items-center">
                                        <Ionicons name="person" size={14} color="#DAA520" />
                                        <StyledText className="text-xs text-[#8B4513]/70 ml-1">
                                            <StyledText className="font-semibold text-[#BC4A4D]">{dasherName || "Searching for Dashers..."}</StyledText>
                                        </StyledText>
                                        {dasherPhone && dasherPhone !== "Waiting..." && (
                                            <>
                                                <StyledText className="text-xs text-[#8B4513]/70 mx-2">•</StyledText>
                                                <Ionicons name="call" size={14} color="#DAA520" />
                                                <StyledText className="text-xs text-[#BC4A4D] font-semibold ml-1">{dasherPhone}</StyledText>
                                            </>
                                        )}
                                    </StyledView>
                                </StyledView>
                            </StyledView>

                            <StyledView className="bg-[#DFD6C5]/30 rounded-xl p-3 mb-4">
                                <StyledView className="flex-row items-center mb-2">
                                    <Ionicons name="location" size={16} color="#DAA520" />
                                    <StyledText className="text-sm font-semibold text-[#BC4A4D] ml-2">Delivery Info</StyledText>
                                </StyledView>
                                <StyledView className="ml-5 space-y-1">
                                    <StyledView className="flex-row">
                                        <StyledText className="text-xs text-[#8B4513]/70 w-16">To:</StyledText>
                                        <StyledText className="text-xs text-[#BC4A4D] flex-1 font-medium">{activeOrder.deliverTo}</StyledText>
                                    </StyledView>
                                    <StyledView className="flex-row">
                                        <StyledText className="text-xs text-[#8B4513]/70 w-16">Order:</StyledText>
                                        <StyledText className="text-xs text-[#BC4A4D] font-medium">#{activeOrder.id}</StyledText>
                                        <StyledText className="text-xs text-[#8B4513]/70 mx-2">•</StyledText>
                                        <StyledText className="text-xs text-[#BC4A4D] font-medium">{activeOrder.paymentMethod}</StyledText>
                                    </StyledView>
                                    <StyledView className="flex-row items-center">
                                        <StyledText className="text-xs text-[#8B4513]/70 w-16">Phone:</StyledText>
                                        <StyledText className="text-xs text-[#BC4A4D] font-medium">{activeOrder.mobileNum}</StyledText>
                                        <StyledTouchableOpacity
                                            className="ml-2"
                                            onPress={() => {
                                                setNewPhoneNumber('');
                                                setShowEditPhoneModal(true);
                                            }}
                                        >
                                            <StyledText className="text-xs text-[#BC4A4D] underline">Edit</StyledText>
                                        </StyledTouchableOpacity>
                                    </StyledView>
                                </StyledView>
                            </StyledView>

                            <StyledView>
                                <StyledText className="text-sm font-bold mb-3 text-[#BC4A4D]">Order Summary</StyledText>
                                
                                <StyledView className="max-h-24 overflow-hidden">
                                    {activeOrder.items.slice(0, 2).map((item, index) => (
                                        <StyledView key={index} className="flex-row justify-between mb-2 bg-[#DFD6C5]/20 p-2 rounded-lg">
                                            <StyledView className="flex-row flex-1">
                                                <StyledText className="text-xs text-[#DAA520] mr-2 font-bold">{item.quantity}x</StyledText>
                                                <StyledText className="text-xs text-[#8B4513] font-medium flex-1" numberOfLines={1}>{item.name}</StyledText>
                                            </StyledView>
                                            <StyledText className="text-xs text-[#BC4A4D] font-bold">₱{item.price.toFixed(2)}</StyledText>
                                        </StyledView>
                                    ))}
                                    {activeOrder.items.length > 2 && (
                                        <StyledText className="text-xs text-[#8B4513]/70 text-center py-1">
                                            +{activeOrder.items.length - 2} more items
                                        </StyledText>
                                    )}
                                </StyledView>

                                <StyledView className="mt-3 pt-3 border-t border-[#DFD6C5]">
                                    <StyledView className="flex-row justify-between mb-1">
                                        <StyledText className="text-xs text-[#8B4513]/70">Subtotal + Delivery</StyledText>
                                        <StyledText className="text-xs text-[#8B4513] font-medium">₱{(activeOrder.totalPrice + (shop?.deliveryFee || 0)).toFixed(2)}</StyledText>
                                    </StyledView>
                                    {((activeOrder.previousNoShowItems ?? 0) > 0 || (activeOrder.previousNoShowFee ?? 0) > 0) && (
                                        <StyledView className="flex-row justify-between mb-1">
                                            <StyledText className="text-xs text-[#BC4A4D]">Previous Charges</StyledText>
                                            <StyledText className="text-xs font-medium text-[#BC4A4D]">₱{((activeOrder.previousNoShowItems ?? 0) + (activeOrder.previousNoShowFee ?? 0)).toFixed(2)}</StyledText>
                                        </StyledView>
                                    )}
                                    <StyledView className="flex-row justify-between mt-2 pt-2 border-t border-[#DAA520]/30 bg-[#DAA520]/10 p-2 rounded-lg">
                                        <StyledText className="text-sm font-bold text-[#BC4A4D]">Total</StyledText>
                                        <StyledText className="text-sm font-bold text-[#BC4A4D]">₱{(activeOrder.totalPrice + (shop?.deliveryFee || 0) + (activeOrder.previousNoShowItems ?? 0) + (activeOrder.previousNoShowFee ?? 0)).toFixed(2)}</StyledText>
                                    </StyledView>
                                </StyledView>

                                {activeOrder.paymentMethod === "cash" && !hideCancelButton && (
                                    <StyledView className="mt-4 flex-row justify-center">
                                        <StyledTouchableOpacity
                                            className="bg-[#BC4A4D] py-3 px-6 rounded-xl"
                                            style={{
                                                shadowColor: "#BC4A4D",
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 4,
                                                elevation: 3,
                                            }}
                                            onPress={() => setShowCancelModal(true)}
                                        >
                                            <StyledText className="text-sm font-bold text-white">
                                                {cancelling ? "Cancelling..." : "Cancel Order"}
                                            </StyledText>
                                        </StyledTouchableOpacity>
                                    </StyledView>
                                )}
                            </StyledView>
                        </StyledView>
                    </StyledView>
                ) : (
                    <StyledView className="bg-white rounded-2xl p-8 items-center mb-6" style={{
                        shadowColor: "#8B4513",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.12,
                        shadowRadius: 16,
                        elevation: 6,
                    }}>
                        <StyledView className="bg-[#DAA520]/10 p-4 rounded-full mb-4">
                            <Ionicons name="fast-food-outline" size={48} color="#c54910ff" />
                        </StyledView>
                        <StyledText className="text-lg text-[#8B4513] text-center font-semibold mt-2">No active orders</StyledText>
                        <StyledText className="text-sm text-[#8B4513]/70 text-center mt-2">Your active orders will appear here</StyledText>
                    </StyledView>
                )}
            </StyledScrollView>

            <BottomNavigation activeTab="Orders" />

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
                        style={{
                            shadowColor: "#8B4513",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.2,
                            shadowRadius: 24,
                            elevation: 12,
                        }}
                    >
                        <StyledView className={modalHeaderStyle}>
                            <StyledText className={modalTitleStyle}>Cancel Order</StyledText>
                            <StyledTouchableOpacity
                                className="p-2 bg-[#DFD6C5]/50 rounded-full"
                                onPress={() => setShowCancelModal(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={20} color="#8B4513" />
                            </StyledTouchableOpacity>
                        </StyledView>
                        <StyledText className="text-base text-[#8B4513] mb-4 font-medium">Are you sure you want to cancel your order?</StyledText>
                        <StyledText className="text-sm text-[#8B4513]/70 mb-6">Note: Cancelling orders may result in penalties.</StyledText>
                        <StyledView className={modalButtonRowStyle}>
                            <StyledTouchableOpacity
                                className={modalCancelButtonStyle}
                                onPress={() => setShowCancelModal(false)}
                            >
                                <StyledText className={`${modalButtonTextStyle} text-[#8B4513]`}>Keep Order</StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className={`${modalSubmitButtonStyle} ${cancelling ? 'opacity-60' : ''}`}
                                style={{
                                    shadowColor: "#BC4A4D",
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                    elevation: 6,
                                }}
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
                onRequestClose={closeReviewModalOnly}
                statusBarTranslucent={true}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-4">
                    <StyledKeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        className={modalContentStyle}
                        style={{
                            shadowColor: "#8B4513",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.2,
                            shadowRadius: 24,
                            elevation: 12,
                        }}
                    >
                        <StyledView className={modalHeaderStyle}>
                            <StyledText className={modalTitleStyle}>Rate Your Dasher</StyledText>
                            <StyledTouchableOpacity
                                className="p-2 bg-[#DFD6C5]/50 rounded-full"
                                onPress={closeReviewModalOnly}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={20} color="#8B4513" />
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="flex-row justify-center my-8 bg-[#DFD6C5]/20 py-4 rounded-2xl">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <StyledTouchableOpacity
                                    key={star}
                                    onPress={() => setRating(star)}
                                    className="mx-1 p-1.5 rounded-full"
                                    style={rating >= star ? {
                                        backgroundColor: '#DAA520',
                                        shadowColor: "#DAA520",
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 4,
                                        elevation: 3,
                                    } : {}}
                                    hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                                >
                                    <Ionicons
                                        name={rating >= star ? "star" : "star-outline"}
                                        size={24}
                                        color={rating >= star ? "#FFF" : "#DAA520"}
                                    />
                                </StyledTouchableOpacity>
                            ))}
                        </StyledView>

                        <StyledView className="my-4">
                            <StyledText className="text-base mb-3 text-[#8B4513] font-semibold">Write your review (optional)</StyledText>
                            <StyledTextInput
                                className="border-2 border-[#DFD6C5] rounded-2xl p-4 h-[100px] bg-[#DFD6C5]/10"
                                multiline
                                numberOfLines={4}
                                placeholder="Share your experience..."
                                placeholderTextColor="#8B4513"
                                style={{ color: '#8B4513' }}
                                value={reviewText}
                                onChangeText={setReviewText}
                                textAlignVertical="top"
                            />
                        </StyledView>

                        <StyledTouchableOpacity
                            className={`bg-[#BC4A4D] py-4 px-6 rounded-2xl mt-6 ${isSubmittingReview ? 'opacity-60' : ''}`}
                            style={{
                                shadowColor: "#BC4A4D",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 6,
                            }}
                            onPress={handleSubmitReview}
                            disabled={isSubmittingReview}
                        >
                            <StyledText className={`${modalButtonTextStyle} text-white`}>
                                {isSubmittingReview ? "Submitting..." : "Submit"}
                            </StyledText>
                        </StyledTouchableOpacity>
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
                        style={{
                            shadowColor: "#8B4513",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.2,
                            shadowRadius: 24,
                            elevation: 12,
                        }}
                    >
                        <StyledView className={modalHeaderStyle}>
                            <StyledText className={modalTitleStyle}>Update Phone Number</StyledText>
                            <StyledTouchableOpacity
                                className="p-2 bg-[#DFD6C5]/50 rounded-full"
                                onPress={() => setShowEditPhoneModal(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={20} color="#8B4513" />
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="my-4">
                            <StyledText className="text-base mb-3 text-[#8B4513] font-semibold">Current Phone Number</StyledText>
                            <StyledView className="bg-[#DFD6C5]/20 rounded-2xl p-4 border border-[#DFD6C5]">
                                <StyledText className="text-base text-[#8B4513] font-medium">
                                    {activeOrder?.mobileNum || ""}
                                </StyledText>
                            </StyledView>
                        </StyledView>

                        <StyledView className="my-4">
                            <StyledText className="text-base mb-3 text-[#8B4513] font-semibold">New Phone Number</StyledText>
                            <StyledView className="flex-row items-center border-2 border-[#DFD6C5] rounded-2xl bg-[#DFD6C5]/10">
                                <StyledText className="text-base text-[#8B4513] pl-4 font-bold">+63</StyledText>
                                <StyledTextInput
                                    className="flex-1 px-4 py-4 text-base"
                                    placeholder="9XX-XXX-XXXX"
                                    placeholderTextColor="#999"
                                    keyboardType="phone-pad"
                                    value={newPhoneNumber}
                                    onChangeText={(text) => {
                                        const digitsOnly = text.replace(/\D/g, '');
                                        
                                        let workingDigits = digitsOnly;
                                        if (digitsOnly.startsWith('0') && digitsOnly.length > 1) {
                                            workingDigits = digitsOnly.slice(1);
                                        }
                                        
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
                                <StyledText className={`${modalButtonTextStyle} text-[#8B4513]`}>Cancel</StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className={`${modalSubmitButtonStyle} ${isUpdatingPhone ? 'opacity-60' : ''}`}
                                style={{
                                    shadowColor: "#BC4A4D",
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                    elevation: 6,
                                }}
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

            {/* No-Show Warning Modal */}
            <StyledModal
                animationType="fade"
                transparent={true}
                visible={showNoShowModal}
                onRequestClose={() => setShowNoShowModal(false)}
                statusBarTranslucent={true}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-4">
                    <StyledView
                        className={modalContentStyle}
                        style={{
                            shadowColor: "#BC4A4D",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.3,
                            shadowRadius: 24,
                            elevation: 12,
                        }}
                    >
                        <StyledView className={modalHeaderStyle}>
                            <StyledText className="text-xl font-bold text-red-600">⚠️ No Show Alert</StyledText>
                            <StyledTouchableOpacity
                                className="p-2 bg-[#DFD6C5]/50 rounded-full"
                                onPress={() => setShowNoShowModal(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={20} color="#8B4513" />
                            </StyledTouchableOpacity>
                        </StyledView>
                        
                        <StyledView className="h-px bg-gray-300 mb-4" />
                        
                        <StyledView className="mb-6">
                            <StyledText className="text-lg font-medium text-[#8B4513] mb-2">
                                Your order has been marked as a no-show.
                            </StyledText>
                            <StyledText className="text-sm text-gray-600">
                                Please ensure you are available for future deliveries or contact support for assistance.
                            </StyledText>
                        </StyledView>
                        
                        <StyledView className="flex-row justify-end">
                            <StyledTouchableOpacity
                                className="bg-yellow-500 py-3 px-6 rounded-2xl"
                                style={{
                                    shadowColor: "#F59E0B",
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                    elevation: 6,
                                }}
                                onPress={() => {
                                    setShowNoShowModal(false);
                                    fetchOrders();
                                }}
                            >
                                <StyledText className="text-base font-bold text-white text-center">
                                    Understood
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </StyledModal>

            {/* Vendor Declined Modal */}
            <StyledModal
                animationType="fade"
                transparent={true}
                visible={vendorDeclinedVisible}
                onRequestClose={() => setVendorDeclinedVisible(false)}
                statusBarTranslucent={true}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-4">
                    <StyledView
                        className={modalContentStyle}
                        style={{
                            shadowColor: "#BC4A4D",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.3,
                            shadowRadius: 24,
                            elevation: 12,
                        }}
                    >
                        <StyledView className={modalHeaderStyle}>
                            <StyledText className={modalTitleStyle}>Order Cancelled</StyledText>
                            <StyledTouchableOpacity
                                className="p-2 bg-[#DFD6C5]/50 rounded-full"
                                onPress={() => setVendorDeclinedVisible(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={20} color="#8B4513" />
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="h-px bg-gray-300 mb-4" />

                        <StyledView className="mb-6">
                            <StyledText className="text-lg font-medium text-[#8B4513] mb-2">
                                {vendorDeclineMessage || 'Your order was cancelled by the shop.'}
                            </StyledText>
                            <StyledText className="text-sm text-gray-600">
                                We\'ve refreshed your orders. You can place a new order or contact support for help.
                            </StyledText>
                        </StyledView>

                        <StyledView className="flex-row justify-between">
                            <StyledTouchableOpacity
                                className="bg-[#DFD6C5] py-3 px-6 rounded-2xl mr-3"
                                onPress={() => {
                                    setVendorDeclinedVisible(false);
                                }}
                            >
                                <StyledText className="text-base font-bold text-[#8B4513] text-center">Close</StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className="bg-[#BC4A4D] py-3 px-6 rounded-2xl"
                                onPress={() => {
                                    setVendorDeclinedVisible(false);
                                    // Refresh orders to clear active order and show updated list
                                    fetchOrders();
                                }}
                            >
                                <StyledText className="text-base font-bold text-white text-center">Refresh Orders</StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </StyledModal>

            {/* Report No-Show Modal */}
            <StyledModal
                animationType="fade"
                transparent={true}
                visible={showReportNoShowModal}
                onRequestClose={() => {
                    setShowReportNoShowModal(false);
                    setNoShowProofImage(null);
                    setNoShowGcashQr(null);
                }}
                statusBarTranslucent={true}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-4">
                    <StyledKeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        className={modalContentStyle}
                        style={{
                            shadowColor: "#ea580c",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.3,
                            shadowRadius: 24,
                            elevation: 12,
                        }}
                    >
                        <StyledView className={modalHeaderStyle}>
                            <StyledText className={modalTitleStyle}>Report Dasher No-Show</StyledText>
                            <StyledTouchableOpacity
                                className="p-2 bg-[#DFD6C5]/50 rounded-full"
                                onPress={() => {
                                    setShowReportNoShowModal(false);
                                    setNoShowProofImage(null);
                                    setNoShowGcashQr(null);
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={20} color="#8B4513" />
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="h-px bg-gray-300 mb-4" />

                        <StyledScrollView 
                            className="max-h-96"
                            showsVerticalScrollIndicator={false}
                        >
                            <StyledText className="text-sm text-[#8B4513] mb-4">
                                Please provide proof that the dasher did not arrive and your GCash QR code for refund processing.
                            </StyledText>

                            {/* Proof Image Upload */}
                            <StyledView className="mb-4">
                                <StyledText className="text-sm font-semibold text-[#8B4513] mb-2">
                                    Upload Proof Image *
                                </StyledText>
                                <StyledTouchableOpacity
                                    className="border-2 border-dashed border-orange-400 rounded-xl p-4 items-center justify-center"
                                    style={{ minHeight: 120 }}
                                    onPress={handlePickNoShowProof}
                                >
                                    {noShowProofImage ? (
                                        <StyledView className="items-center">
                                            <StyledImage
                                                source={{ uri: noShowProofImage }}
                                                style={{ width: 100, height: 100, borderRadius: 8 }}
                                                resizeMode="cover"
                                            />
                                            <StyledText className="text-xs text-orange-600 mt-2">Tap to change</StyledText>
                                        </StyledView>
                                    ) : (
                                        <StyledView className="items-center">
                                            <Ionicons name="camera-outline" size={40} color="#ea580c" />
                                            <StyledText className="text-sm text-orange-600 mt-2">Take Photo</StyledText>
                                            <StyledText className="text-xs text-[#8B4513]/60 mt-1">
                                                Screenshot or photo as proof
                                            </StyledText>
                                        </StyledView>
                                    )}
                                </StyledTouchableOpacity>
                            </StyledView>

                            {/* GCash QR Upload */}
                            <StyledView className="mb-4">
                                <StyledText className="text-sm font-semibold text-[#8B4513] mb-2">
                                    Upload GCash QR Code *
                                </StyledText>
                                <StyledTouchableOpacity
                                    className="border-2 border-dashed border-green-400 rounded-xl p-4 items-center justify-center"
                                    style={{ minHeight: 120 }}
                                    onPress={handlePickGcashQr}
                                >
                                    {noShowGcashQr ? (
                                        <StyledView className="items-center">
                                            <StyledImage
                                                source={{ uri: noShowGcashQr }}
                                                style={{ width: 100, height: 100, borderRadius: 8 }}
                                                resizeMode="cover"
                                            />
                                            <StyledText className="text-xs text-green-600 mt-2">Tap to change</StyledText>
                                        </StyledView>
                                    ) : (
                                        <StyledView className="items-center">
                                            <Ionicons name="qr-code-outline" size={40} color="#10B981" />
                                            <StyledText className="text-sm text-green-600 mt-2">Select QR Code</StyledText>
                                            <StyledText className="text-xs text-[#8B4513]/60 mt-1">
                                                Your personal GCash QR for refund
                                            </StyledText>
                                        </StyledView>
                                    )}
                                </StyledTouchableOpacity>
                            </StyledView>

                            <StyledText className="text-xs text-[#8B4513]/70 mb-4 italic">
                                Note: False reports may result in account penalties. Our team will review your submission and process the refund to your GCash.
                            </StyledText>
                        </StyledScrollView>

                        <StyledView className={modalButtonRowStyle}>
                            <StyledTouchableOpacity
                                className={modalCancelButtonStyle}
                                onPress={() => {
                                    setShowReportNoShowModal(false);
                                    setNoShowProofImage(null);
                                    setNoShowGcashQr(null);
                                }}
                            >
                                <StyledText className={`${modalButtonTextStyle} text-[#8B4513]`}>Cancel</StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className={`bg-orange-600 py-4 px-6 rounded-2xl flex-1 ${isSubmittingNoShow || !noShowProofImage || !noShowGcashQr ? 'opacity-60' : ''}`}
                                style={{
                                    shadowColor: "#ea580c",
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                    elevation: 6,
                                }}
                                onPress={handleReportNoShow}
                                disabled={isSubmittingNoShow || !noShowProofImage || !noShowGcashQr}
                            >
                                <StyledText className={`${modalButtonTextStyle} text-white`}>
                                    {isSubmittingNoShow ? "Submitting..." : "Submit"}
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledKeyboardAvoidingView>
                </StyledView>
            </StyledModal>

            {/* No-Show Report Success Modal */}
            <StyledModal
                animationType="fade"
                transparent={true}
                visible={showNoShowSuccessModal}
                onRequestClose={() => {
                    setShowNoShowSuccessModal(false);
                    fetchOrders();
                }}
                statusBarTranslucent={true}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center px-4">
                    <StyledView
                        className={modalContentStyle}
                        style={{
                            shadowColor: "#10B981",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.3,
                            shadowRadius: 24,
                            elevation: 12,
                        }}
                    >
                        <StyledView className="items-center mb-6">
                            <StyledView 
                                className="w-16 h-16 rounded-full justify-center items-center mb-4"
                                style={{ backgroundColor: '#D1FAE5' }}
                            >
                                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                            </StyledView>
                            <StyledText className="text-xl font-bold text-[#8B4513] text-center mb-2">
                                Report Submitted
                            </StyledText>
                            <StyledText className="text-sm text-[#8B4513]/70 text-center leading-5">
                                Your no-show report has been submitted successfully. Our team will review it and process your refund.
                            </StyledText>
                        </StyledView>

                        <StyledTouchableOpacity
                            className="bg-[#10B981] py-4 px-6 rounded-2xl"
                            style={{
                                shadowColor: "#10B981",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 6,
                            }}
                            onPress={() => {
                                setShowNoShowSuccessModal(false);
                                fetchOrders();
                            }}
                        >
                            <StyledText className="text-base font-bold text-white text-center">
                                Got it, thanks!
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledModal>
        </StyledView>
    )
}

export default Order;