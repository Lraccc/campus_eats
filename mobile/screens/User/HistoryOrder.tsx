import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, SafeAreaView, StatusBar, Modal, Animated, Platform, KeyboardAvoidingView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from 'expo-image-picker';
import { getAuthToken } from "../../services/authService"
import { API_URL } from "../../config"
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import BottomNavigation from "../../components/BottomNavigation"
import { useRouter } from "expo-router"
import { styled } from "nativewind"

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)
const StyledTextInput = styled(TextInput)
const StyledSafeAreaView = styled(SafeAreaView)
const StyledImage = styled(Image)
const StyledModal = styled(Modal)
const StyledKeyboardAvoidingView = styled(KeyboardAvoidingView)

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
    hasReview: boolean;
    rating?: number;
    reviewText?: string;
}

// Create axios instance with base URL
const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

const HistoryOrder = () => {
    const [orders, setOrders] = useState<OrderItem[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [offenses, setOffenses] = useState(0)
    const [showShopReviewModal, setShowShopReviewModal] = useState(false)
    const [showViewReviewModal, setShowViewReviewModal] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [showAlreadyReviewedModal, setShowAlreadyReviewedModal] = useState(false)
    const [showRatingRequiredModal, setShowRatingRequiredModal] = useState(false)
    const [showErrorModal, setShowErrorModal] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null)
    const [shopRating, setShopRating] = useState(0)
    const [shopReviewText, setShopReviewText] = useState('')
    const [isSubmittingShopReview, setIsSubmittingShopReview] = useState(false)
    // No-show reporting states
    const [showReportNoShowModal, setShowReportNoShowModal] = useState(false)
    const [noShowProofImage, setNoShowProofImage] = useState<string | null>(null)
    const [noShowGcashQr, setNoShowGcashQr] = useState<string | null>(null)
    const [isSubmittingNoShow, setIsSubmittingNoShow] = useState(false)
    const [showNoShowSuccessModal, setShowNoShowSuccessModal] = useState(false)
    const router = useRouter()

    // Animation values for loading state
    const spinValue = useRef(new Animated.Value(0)).current;
    const circleValue = useRef(new Animated.Value(0)).current;

    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true);

    // Track if user is logged in
    const [isLoggedIn, setIsLoggedIn] = useState(false);

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

        // Animation setup for loading state
        const startAnimation = () => {
            // Logo spin animation
            Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ).start();

            // Circle line animation
            Animated.loop(
                Animated.timing(circleValue, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ).start();
        };

        startAnimation();

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            fetchOrders();
            fetchOffenses();
        }
    }, [isLoggedIn]);

    const fetchOrders = async () => {
        if (!isMountedRef.current) return;

        try {
            setLoading(true);
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            const userId = await AsyncStorage.getItem('userId');

            if (!userId || !token) {
                console.error("Missing required data:", { userId: !!userId, token: !!token });
                setLoading(false);
                setIsLoggedIn(false);
                router.replace('/');
                return;
            }

            axiosInstance.defaults.headers.common['Authorization'] = token;

            try {
                const ordersResponse = await axiosInstance.get(`/api/orders/user/${userId}`);
                const ordersData = ordersResponse.data;

                if (ordersData.orders?.length > 0) {
                    const ordersWithShopDataAndReviews = await Promise.all(
                        ordersData.orders.map(async (order: OrderItem) => {
                            let updatedOrder = { ...order };

                            // Fetch shop data if shopId exists
                            if (order.shopId) {
                                try {
                                    const shopResponse = await axiosInstance.get(`/api/shops/${order.shopId}`);
                                    updatedOrder.shopData = shopResponse.data;
                                } catch (error) {
                                    console.error(`Error fetching shop data for order ${order.id}:`, error);
                                }
                            }

                            // Check if order has been reviewed
                            try {
                                const hasReview = await checkIfOrderReviewed(order.id);
                                updatedOrder.hasReview = hasReview;
                                
                                // If has review, fetch the review details
                                if (hasReview) {
                                    const reviewData = await fetchExistingReview(order.id);
                                    if (reviewData) {
                                        updatedOrder.rating = reviewData.rate;
                                        updatedOrder.reviewText = reviewData.comment;
                                    }
                                }
                            } catch (error) {
                                console.error(`Error checking review status for order ${order.id}:`, error);
                                updatedOrder.hasReview = false;
                            }

                            return updatedOrder;
                        })
                    );
                    
                    // Sort orders by creation date (most recent first)
                    const sortedOrders = ordersWithShopDataAndReviews.sort((a, b) => {
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    });
                    
                    setOrders(sortedOrders);
                } else {
                    setOrders([]);
                }
            } catch (error) {
                // Handle 404 error gracefully for new users with no orders
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    setOrders([]);
                } else {
                    console.error("Error fetching orders:", error);
                    setOrders([]);
                }
            }
        } catch (error) {
            console.error("Error in fetchOrders:", error);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchOffenses = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!userId || !token) return;

            const response = await axiosInstance.get(`/api/users/${userId}/offenses`, {
                headers: { Authorization: token }
            });
            setOffenses(response.data);
        } catch (error) {
            console.error("Error fetching offenses:", error);
        }
    };

    const handleShopReview = async () => {
        if (shopRating === 0 || !selectedOrder?.shopId) {
            setShowRatingRequiredModal(true);
            return;
        }

        try {
            setIsSubmittingShopReview(true);
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
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

            // Show success modal
            setShowShopReviewModal(false);
            setSelectedOrder(null);
            setShopRating(0);
            setShopReviewText('');
            setShowSuccessModal(true);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 409) {
                // Show already reviewed modal
                setShowShopReviewModal(false);
                setSelectedOrder(null);
                setShopRating(0);
                setShopReviewText('');
                setShowAlreadyReviewedModal(true);
            } else {
                setShowErrorModal(true);
            }
        } finally {
            setIsSubmittingShopReview(false);
        }
    };

    // Check if an order has been reviewed by fetching all shop ratings and checking for this orderId
    const checkIfOrderReviewed = async (orderId: string) => {
        try {
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) return false;

            // Fetch all shop ratings and check if any match this orderId
            const response = await axiosInstance.get(`/api/ratings/all-shop-ratings`, {
                headers: { Authorization: token }
            });
            
            if (response.data && Array.isArray(response.data)) {
                const orderRating = response.data.find((rating: any) => rating.orderId === orderId);
                return !!orderRating;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    // Fetch existing review for an order
    const fetchExistingReview = async (orderId: string) => {
        try {
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) return null;

            // Fetch all shop ratings and find the one for this orderId
            const response = await axiosInstance.get(`/api/ratings/all-shop-ratings`, {
                headers: { Authorization: token }
            });
            
            if (response.data && Array.isArray(response.data)) {
                const orderRating = response.data.find((rating: any) => rating.orderId === orderId);
                return orderRating || null;
            }
            return null;
        } catch (error) {
            console.error("Error fetching existing review:", error);
            return null;
        }
    };

    // No-show reporting handlers
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

        if (!selectedOrder?.id) {
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
            formData.append('orderId', selectedOrder.id);
            
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
                // Refresh orders after report
                setTimeout(() => {
                    fetchOrders();
                }, 1000);
            }
        } catch (error: any) {
            console.error("Error reporting no-show:", error);
            Alert.alert("Error", error.response?.data?.error || "Failed to submit report. Please try again.");
        } finally {
            setIsSubmittingNoShow(false);
        }
    };

    const getStatusBadge = (status: string) => {
        if (status.includes('cancelled_')) {
            return (
                <StyledView className="bg-red-50 px-3 py-1 rounded-full border border-red-100">
                    <StyledText className="text-xs font-semibold text-red-600">Cancelled</StyledText>
                </StyledView>
            );
        } else if (status === 'no-show') {
            return (
                <StyledView className="bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                    <StyledText className="text-xs font-semibold text-orange-600">No Show</StyledText>
                </StyledView>
            );
        } else if (status === 'refunded') {
            return (
                <StyledView className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    <StyledText className="text-xs font-semibold text-blue-600">Refunded</StyledText>
                </StyledView>
            );
        } else {
            return (
                <StyledView className="bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    <StyledText className="text-xs font-semibold text-green-600">Delivered</StyledText>
                </StyledView>
            );
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    return (
        <StyledSafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
            <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />

            {/* Header */}
            <StyledView className="bg-white px-6 py-4 border-b border-gray-100">
                <StyledView className="flex-row items-center justify-between">
                    <StyledView className="flex-row items-center">
                        <StyledTouchableOpacity
                            onPress={() => router.back()}
                            className="mr-4 p-2 -ml-2"
                        >
                            <Ionicons name="arrow-back" size={24} color="#374151" />
                        </StyledTouchableOpacity>
                        <StyledText className="text-xl font-bold text-[#BC4A4D]">Order History</StyledText>
                    </StyledView>
                    <StyledView className="w-10 h-10 rounded-full bg-gray-50 justify-center items-center">
                        <Ionicons name="receipt-outline" size={20} color="#BC4A4D" />
                    </StyledView>
                </StyledView>
            </StyledView>

            <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Warning Banner */}
                {offenses > 0 && (
                    <StyledView className="mx-6 mt-6 bg-red-50 p-4 rounded-2xl border border-red-100">
                        <StyledView className="flex-row items-center">
                            <Ionicons name="warning-outline" size={24} color="#ef4444" />
                            <StyledView className="ml-3 flex-1">
                                <StyledText className="text-base font-bold text-red-600">Warning!</StyledText>
                                <StyledText className="text-sm text-red-600 mt-1">
                                    You have {offenses} {offenses > 1 ? "offenses" : "offense"} recorded.
                                    3 cancellations will lead to account ban.
                                </StyledText>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                )}

                {/* Orders List */}
                <StyledView className="px-6 py-6">
                    {loading ? (
                        <StyledView className="flex-1 justify-center items-center py-12">
                            <StyledView className="items-center">
                                {/* Spinning Logo Container */}
                                <StyledView className="relative mb-6">
                                    {/* Outer circular loading line */}
                                    <Animated.View
                                        style={{
                                            transform: [{ rotate: circleValue.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0deg', '360deg'],
                                            }) }],
                                            width: 80,
                                            height: 80,
                                            borderRadius: 40,
                                            borderWidth: 2,
                                            borderColor: 'rgba(188, 74, 77, 0.2)',
                                            borderTopColor: '#BC4A4D',
                                            position: 'absolute',
                                        }}
                                    />
                                    
                                    {/* Inner spinning logo */}
                                    <StyledView className="w-16 h-16 rounded-full bg-[#BC4A4D]/10 items-center justify-center mx-2 my-2">
                                        <Animated.View
                                            style={{
                                                transform: [{ rotate: spinValue.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: ['0deg', '360deg'],
                                                }) }],
                                            }}
                                        >
                                            <Image
                                                source={require('../../assets/images/logo.png')}
                                                style={{ width: 40, height: 40 }}
                                                resizeMode="contain"
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
                                <StyledText className="text-[#BC4A4D] text-base font-semibold">
                                    Loading...
                                </StyledText>
                            </StyledView>
                        </StyledView>
                    ) : orders.length === 0 ? (
                        <StyledView className="flex-1 justify-center items-center py-12 bg-white rounded-3xl shadow-sm">
                            <StyledView className="w-20 h-20 rounded-full bg-gray-50 justify-center items-center mb-4">
                                <Ionicons name="receipt-outline" size={36} color="#9CA3AF" />
                            </StyledView>
                            <StyledText className="text-lg font-bold text-[#BC4A4D] text-center">No Orders Yet</StyledText>
                            <StyledText className="mt-2 text-base text-[#8B4513] text-center px-6">
                                Your order history will appear here once you place orders
                            </StyledText>
                            <StyledTouchableOpacity
                                className="mt-6 bg-[#BC4A4D] px-6 py-3 rounded-2xl"
                                onPress={() => router.push('/home')}
                            >
                                <StyledText className="text-white font-semibold">Browse Shops</StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    ) : (
                        <StyledView className="space-y-4">
                            {/* Refresh Indicator */}
                            {refreshing && (
                                <StyledView className="bg-white rounded-2xl p-3 shadow-sm border border-[#BC4A4D]/10">
                                    <StyledView className="flex-row items-center justify-center">
                                        <ActivityIndicator size="small" color="#BC4A4D" />
                                        <StyledText className="text-[#BC4A4D] text-sm font-medium ml-2">
                                            Updating orders...
                                        </StyledText>
                                    </StyledView>
                                </StyledView>
                            )}
                            
                            {orders.map((order: OrderItem, index: number) => (
                                <StyledView
                                    key={index}
                                    className={`${order.hasReview ? 'bg-amber-50 border-2 border-amber-200' : 'bg-white'} rounded-3xl p-5 shadow-sm`}
                                >
                                    <StyledView className="flex-row items-center mb-3">
                                        <StyledText className="text-xs text-[#8B4513]">
                                            {formatDate(order.createdAt)}
                                        </StyledText>
                                        <StyledView className="flex-1" />
                                        {getStatusBadge(order.status)}
                                    </StyledView>

                                    <StyledView className="flex-row">
                                        <StyledImage
                                            source={{ uri: order.shopData?.imageUrl || "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=100&width=100" }}
                                            className="w-20 h-20 rounded-2xl"
                                        />
                                        <StyledView className="flex-1 ml-4">
                                            <StyledView className="flex-row justify-between items-start">
                                                <StyledView className="flex-1 pr-2">
                                                    <StyledText className="text-lg font-bold text-[#BC4A4D]">{order.shopData?.name || "Loading..."}</StyledText>
                                                    <StyledText className="text-sm text-[#8B4513] mt-1">{order.shopData?.address || "Loading..."}</StyledText>
                                                </StyledView>
                                                <StyledText className="text-lg font-bold text-[#BC4A4D]">₱{order.totalPrice.toFixed(2)}</StyledText>
                                            </StyledView>

                                            <StyledView className="mt-3 flex-row items-center justify-between">
                                                <StyledView className="flex-row items-center">
                                                    <Ionicons name={order.paymentMethod === "cash" ? "cash-outline" : "card-outline"} size={16} color="#6B7280" />
                                                    <StyledText className="text-sm text-[#8B4513] ml-1">
                                                        {order.paymentMethod === "cash" ? "Cash On Delivery" : "GCASH"}
                                                    </StyledText>
                                                </StyledView>
                                                <StyledText className="text-xs text-[#8B4513]">Order #{order.id.substring(0, 8)}</StyledText>
                                            </StyledView>
                                        </StyledView>
                                    </StyledView>

                                    {!order.status.includes('cancelled_') && !order.status.includes('no-') && (
                                        <StyledView className="mt-4 border-t border-gray-100 pt-3">
                                            {order.hasReview ? (
                                                <StyledView>
                                                    <StyledTouchableOpacity
                                                        onPress={() => {
                                                            setSelectedOrder(order);
                                                            setShowViewReviewModal(true);
                                                        }}
                                                    >
                                                        <StyledView className="flex-row items-center justify-between mb-2">
                                                            <StyledView className="flex-row items-center">
                                                                <Ionicons
                                                                    name="checkmark-circle"
                                                                    size={16}
                                                                    color="#10B981"
                                                                />
                                                                <StyledText className="text-sm font-semibold ml-1 text-green-600">
                                                                    Already Rated
                                                                </StyledText>
                                                            </StyledView>
                                                            <StyledView className="flex-row items-center">
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <Ionicons
                                                                        key={star}
                                                                        name={(order.rating || 0) >= star ? "star" : "star-outline"}
                                                                        size={16}
                                                                        color={(order.rating || 0) >= star ? "#F59E0B" : "#D1D5DB"}
                                                                        style={{ marginLeft: 2 }}
                                                                    />
                                                                ))}
                                                            </StyledView>
                                                        </StyledView>
                                                    </StyledTouchableOpacity>
                                                    
                                                    {/* Report No-Show Button for completed orders */}
                                                    {order.status === 'completed' && (
                                                        <StyledTouchableOpacity
                                                            className="flex-row items-center justify-center bg-orange-50 px-3 py-2 rounded-full border border-orange-200 mt-2"
                                                            onPress={() => {
                                                                setSelectedOrder(order);
                                                                setShowReportNoShowModal(true);
                                                            }}
                                                        >
                                                            <Ionicons
                                                                name="warning-outline"
                                                                size={14}
                                                                color="#ea580c"
                                                            />
                                                            <StyledText className="text-xs font-semibold ml-1 text-orange-600">
                                                                Report Dasher No-Show
                                                            </StyledText>
                                                        </StyledTouchableOpacity>
                                                    )}
                                                </StyledView>
                                            ) : (
                                                <StyledView>
                                                    {/* Buttons side by side */}
                                                    {order.status === 'completed' ? (
                                                        <StyledView className="flex-row gap-2">
                                                            <StyledTouchableOpacity
                                                                className="flex-1 flex-row items-center justify-center bg-[#BC4A4D] px-3 py-2 rounded-full"
                                                                onPress={() => {
                                                                    setSelectedOrder(order);
                                                                    setShowShopReviewModal(true);
                                                                }}
                                                            >
                                                                <Ionicons
                                                                    name="star-outline"
                                                                    size={14}
                                                                    color="#FFFFFF"
                                                                />
                                                                <StyledText className="text-xs font-semibold ml-1 text-white">
                                                                    Rate Order
                                                                </StyledText>
                                                            </StyledTouchableOpacity>
                                                            
                                                            <StyledTouchableOpacity
                                                                className="flex-1 flex-row items-center justify-center bg-orange-50 px-3 py-2 rounded-full border border-orange-200"
                                                                onPress={() => {
                                                                    setSelectedOrder(order);
                                                                    setShowReportNoShowModal(true);
                                                                }}
                                                            >
                                                                <Ionicons
                                                                    name="warning-outline"
                                                                    size={14}
                                                                    color="#ea580c"
                                                                />
                                                                <StyledText className="text-xs font-semibold ml-1 text-orange-600">
                                                                    Report No-Show
                                                                </StyledText>
                                                            </StyledTouchableOpacity>
                                                        </StyledView>
                                                    ) : (
                                                        <StyledView className="flex-row justify-end">
                                                            <StyledTouchableOpacity
                                                                className="flex-row items-center bg-[#BC4A4D] px-3 py-2 rounded-full"
                                                                onPress={() => {
                                                                    setSelectedOrder(order);
                                                                    setShowShopReviewModal(true);
                                                                }}
                                                            >
                                                                <Ionicons
                                                                    name="star-outline"
                                                                    size={16}
                                                                    color="#FFFFFF"
                                                                />
                                                                <StyledText className="text-sm font-semibold ml-1 text-white">
                                                                    Rate Order
                                                                </StyledText>
                                                            </StyledTouchableOpacity>
                                                        </StyledView>
                                                    )}
                                                </StyledView>
                                            )}
                                        </StyledView>
                                    )}
                                </StyledView>
                            ))}
                        </StyledView>
                    )}
                </StyledView>
            </StyledScrollView>

            {/* Shop Review Modal */}
            {showShopReviewModal && selectedOrder && (
                <Modal
                    visible={showShopReviewModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => {
                        setShowShopReviewModal(false);
                        setSelectedOrder(null);
                        setShopRating(0);
                        setShopReviewText('');
                    }}
                >
                    <StyledView className="flex-1 justify-center items-center bg-black/50 p-6">
                        <StyledView className="bg-white rounded-3xl w-full max-w-[400px] overflow-hidden">
                            <StyledView className="p-6">
                                <StyledView className="flex-row justify-between items-center mb-6">
                                    <StyledText className="text-xl font-bold text-[#BC4A4D]">Rate Your Experience</StyledText>
                                    <StyledTouchableOpacity
                                        className="p-2"
                                        onPress={() => {
                                            setShowShopReviewModal(false);
                                            setSelectedOrder(null);
                                            setShopRating(0);
                                            setShopReviewText('');
                                        }}
                                    >
                                        <Ionicons name="close" size={24} color="#BC4A4D" />
                                    </StyledTouchableOpacity>
                                </StyledView>

                                <StyledView className="items-center mb-6">
                                    <StyledView className="relative">
                                        <StyledImage
                                            source={{ uri: selectedOrder.shopData?.imageUrl || "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=60&width=60" }}
                                            className="w-20 h-20 rounded-2xl"
                                        />
                                        <StyledView className="absolute -bottom-2 -right-2 bg-amber-100 rounded-full p-1">
                                            <Ionicons name="star" size={16} color="#F59E0B" />
                                        </StyledView>
                                    </StyledView>
                                    <StyledText className="text-lg font-bold text-[#BC4A4D] mt-4">{selectedOrder.shopData?.name}</StyledText>
                                    <StyledText className="text-sm text-[#8B4513] mt-1">Order #{selectedOrder.id.substring(0, 8)}</StyledText>
                                </StyledView>

                                <StyledView className="mb-6">
                                    <StyledText className="text-base font-semibold text-[#8B4513] mb-3 text-center">How was your experience?</StyledText>
                                    <StyledView className="flex-row justify-center">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <StyledTouchableOpacity
                                                key={star}
                                                className="mx-2"
                                                onPress={() => setShopRating(star)}
                                            >
                                                <Ionicons
                                                    name={shopRating >= star ? "star" : "star-outline"}
                                                    size={40}
                                                    color={shopRating >= star ? "#F59E0B" : "#D1D5DB"}
                                                />
                                            </StyledTouchableOpacity>
                                        ))}
                                    </StyledView>
                                    <StyledText className="text-sm text-[#8B4513] text-center mt-2">
                                        {shopRating === 0 ? "Tap to rate" :
                                            shopRating === 1 ? "Poor" :
                                                shopRating === 2 ? "Fair" :
                                                    shopRating === 3 ? "Good" :
                                                        shopRating === 4 ? "Very Good" : "Excellent"}
                                    </StyledText>
                                </StyledView>

                                <StyledView className="mb-4">
                                    <StyledText className="text-base font-semibold text-[#8B4513] mb-2">Write your review (optional)</StyledText>
                                    <StyledTextInput
                                        className="bg-gray-50 rounded-2xl px-4 py-4 text-base border border-gray-200 min-h-[120px]"
                                        multiline
                                        numberOfLines={4}
                                        placeholder="Share your experience with this shop..."
                                        placeholderTextColor="#9CA3AF"
                                        value={shopReviewText}
                                        onChangeText={setShopReviewText}
                                        textAlignVertical="top"
                                        style={{ fontSize: 16 }}
                                    />
                                </StyledView>

                                <StyledView className="space-y-3">
                                    <StyledTouchableOpacity
                                        className={`${isSubmittingShopReview ? 'bg-[#BC4A4D]/50' : 'bg-[#BC4A4D]'} p-4 rounded-2xl`}
                                        onPress={handleShopReview}
                                        disabled={isSubmittingShopReview || shopRating === 0}
                                    >
                                        <StyledView className="flex-row items-center justify-center">
                                            {isSubmittingShopReview ? (
                                                <>
                                                    <ActivityIndicator color="white" size="small" />
                                                    <StyledText className="text-white text-base font-bold ml-2">Submitting...</StyledText>
                                                </>
                                            ) : (
                                                <>
                                                    <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                                                    <StyledText className="text-white text-base font-bold ml-2">Submit Review</StyledText>
                                                </>
                                            )}
                                        </StyledView>
                                    </StyledTouchableOpacity>

                                    <StyledTouchableOpacity
                                        className="bg-white p-4 rounded-2xl border border-gray-200"
                                        onPress={() => {
                                            setShowShopReviewModal(false);
                                            setSelectedOrder(null);
                                            setShopRating(0);
                                            setShopReviewText('');
                                        }}
                                    >
                                        <StyledView className="flex-row items-center justify-center">
                                            <Ionicons name="close-circle-outline" size={20} color="#6B7280" />
                                            <StyledText className="text-[#8B4513] text-base font-semibold ml-2">Cancel</StyledText>
                                        </StyledView>
                                    </StyledTouchableOpacity>
                                </StyledView>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </Modal>
            )}

            {/* View Review Modal */}
            {showViewReviewModal && selectedOrder && (
                <Modal
                    visible={showViewReviewModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => {
                        setShowViewReviewModal(false);
                        setSelectedOrder(null);
                    }}
                >
                    <StyledView className="flex-1 justify-center items-center bg-black/50 p-6">
                        <StyledView className="bg-white rounded-3xl w-full max-w-[400px] overflow-hidden">
                            <StyledView className="p-6">
                                <StyledView className="flex-row justify-between items-center mb-6">
                                    <StyledText className="text-xl font-bold text-[#BC4A4D]">Your Review</StyledText>
                                    <StyledTouchableOpacity
                                        className="p-2"
                                        onPress={() => {
                                            setShowViewReviewModal(false);
                                            setSelectedOrder(null);
                                        }}
                                    >
                                        <Ionicons name="close" size={24} color="#BC4A4D" />
                                    </StyledTouchableOpacity>
                                </StyledView>

                                <StyledView className="items-center mb-6">
                                    <StyledView className="relative">
                                        <StyledImage
                                            source={{ uri: selectedOrder.shopData?.imageUrl || "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=60&width=60" }}
                                            className="w-20 h-20 rounded-2xl"
                                        />
                                        <StyledView className="absolute -bottom-2 -right-2 bg-amber-100 rounded-full p-1">
                                            <Ionicons name="star" size={16} color="#F59E0B" />
                                        </StyledView>
                                    </StyledView>
                                    <StyledText className="text-lg font-bold text-[#BC4A4D] mt-4">{selectedOrder.shopData?.name}</StyledText>
                                    <StyledText className="text-sm text-[#8B4513] mt-1">Order #{selectedOrder.id.substring(0, 8)}</StyledText>
                                </StyledView>

                                <StyledView className="mb-6">
                                    <StyledText className="text-base font-semibold text-[#8B4513] mb-3 text-center">Your Rating</StyledText>
                                    <StyledView className="flex-row justify-center">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <StyledView key={star} className="mx-2">
                                                <Ionicons
                                                    name={(selectedOrder.rating || 0) >= star ? "star" : "star-outline"}
                                                    size={40}
                                                    color={(selectedOrder.rating || 0) >= star ? "#F59E0B" : "#D1D5DB"}
                                                />
                                            </StyledView>
                                        ))}
                                    </StyledView>
                                </StyledView>

                                {selectedOrder.reviewText && (
                                    <StyledView className="mb-6">
                                        <StyledText className="text-base font-semibold text-[#8B4513] mb-2">Your Review</StyledText>
                                        <StyledView className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-200">
                                            <StyledText className="text-base text-[#8B4513]">
                                                {selectedOrder.reviewText}
                                            </StyledText>
                                        </StyledView>
                                    </StyledView>
                                )}

                                <StyledTouchableOpacity
                                    className="bg-white p-4 rounded-2xl border border-gray-200"
                                    onPress={() => {
                                        setShowViewReviewModal(false);
                                        setSelectedOrder(null);
                                    }}
                                >
                                    <StyledView className="flex-row items-center justify-center">
                                        <Ionicons name="close-circle-outline" size={20} color="#6B7280" />
                                        <StyledText className="text-gray-600 text-base font-semibold ml-2">Close</StyledText>
                                    </StyledView>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </Modal>
            )}

            {/* Success Review Modal */}
            {showSuccessModal && (
                <Modal
                    visible={showSuccessModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowSuccessModal(false)}
                >
                    <StyledView className="flex-1 justify-center items-center bg-black/50 p-6">
                        <StyledView className="bg-white rounded-3xl w-full max-w-[350px] overflow-hidden">
                            <StyledView className="p-8">
                                {/* Success Icon */}
                                <StyledView className="items-center mb-6">
                                    <StyledView className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-4">
                                        <Ionicons name="checkmark-circle" size={50} color="#10B981" />
                                    </StyledView>
                                    <StyledView className="items-center">
                                        <StyledText className="text-2xl font-bold text-gray-900 mb-2">
                                            Review Submitted!
                                        </StyledText>
                                        <StyledText className="text-base text-gray-600 text-center leading-6">
                                            Thank you for rating your experience. Your feedback helps improve our service!
                                        </StyledText>
                                    </StyledView>
                                </StyledView>

                                {/* Decorative Stars */}
                                <StyledView className="flex-row justify-center mb-6">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <StyledView key={star} className="mx-1">
                                            <Ionicons name="star" size={20} color="#F59E0B" />
                                        </StyledView>
                                    ))}
                                </StyledView>

                                {/* Action Button */}
                                <StyledTouchableOpacity
                                    className="bg-[#BC4A4D] p-4 rounded-2xl"
                                    onPress={async () => {
                                        setShowSuccessModal(false);
                                        // Show subtle refresh indicator
                                        setRefreshing(true);
                                        await fetchOrders(); // Refresh orders to update review status
                                        setRefreshing(false);
                                    }}
                                >
                                    <StyledView className="flex-row items-center justify-center">
                                        <Ionicons name="thumbs-up" size={20} color="white" />
                                        <StyledText className="text-white text-base font-bold ml-2">
                                            Great!
                                        </StyledText>
                                    </StyledView>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </Modal>
            )}

            {/* Already Reviewed Modal */}
            {showAlreadyReviewedModal && (
                <Modal
                    visible={showAlreadyReviewedModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowAlreadyReviewedModal(false)}
                >
                    <StyledView className="flex-1 justify-center items-center bg-black/50 p-6">
                        <StyledView className="bg-white rounded-3xl w-full max-w-[350px] overflow-hidden">
                            <StyledView className="p-8">
                                {/* Warning Icon */}
                                <StyledView className="items-center mb-6">
                                    <StyledView className="w-20 h-20 rounded-full bg-amber-100 items-center justify-center mb-4">
                                        <Ionicons name="information-circle" size={50} color="#F59E0B" />
                                    </StyledView>
                                    <StyledView className="items-center">
                                        <StyledText className="text-2xl font-bold text-gray-900 mb-2">
                                            Already Reviewed
                                        </StyledText>
                                        <StyledText className="text-base text-gray-600 text-center leading-6">
                                            You have already submitted a review for this order. Thank you for your feedback!
                                        </StyledText>
                                    </StyledView>
                                </StyledView>

                                {/* Decorative Check */}
                                <StyledView className="items-center mb-6">
                                    <StyledView className="bg-green-50 rounded-full px-4 py-2 border border-green-200">
                                        <StyledView className="flex-row items-center">
                                            <Ionicons name="checkmark" size={16} color="#10B981" />
                                            <StyledText className="text-green-700 text-sm font-semibold ml-1">
                                                Review Complete
                                            </StyledText>
                                        </StyledView>
                                    </StyledView>
                                </StyledView>

                                {/* Action Button */}
                                <StyledTouchableOpacity
                                    className="bg-[#BC4A4D] p-4 rounded-2xl"
                                    onPress={async () => {
                                        setShowAlreadyReviewedModal(false);
                                        // Refresh to update UI
                                        setRefreshing(true);
                                        await fetchOrders();
                                        setRefreshing(false);
                                    }}
                                >
                                    <StyledView className="flex-row items-center justify-center">
                                        <Ionicons name="hand-right" size={20} color="white" />
                                        <StyledText className="text-white text-base font-bold ml-2">
                                            Got it
                                        </StyledText>
                                    </StyledView>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </Modal>
            )}

            {/* Rating Required Modal */}
            {showRatingRequiredModal && (
                <Modal
                    visible={showRatingRequiredModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowRatingRequiredModal(false)}
                >
                    <StyledView className="flex-1 justify-center items-center bg-black/50 p-6">
                        <StyledView className="bg-white rounded-3xl w-full max-w-[350px] overflow-hidden">
                            <StyledView className="p-8">
                                {/* Rating Icon */}
                                <StyledView className="items-center mb-6">
                                    <StyledView className="w-20 h-20 rounded-full bg-[#BC4A4D]/10 items-center justify-center mb-4">
                                        <Ionicons name="star" size={50} color="#BC4A4D" />
                                    </StyledView>
                                    <StyledView className="items-center">
                                        <StyledText className="text-2xl font-bold text-gray-900 mb-2">
                                            Rating Required
                                        </StyledText>
                                        <StyledText className="text-base text-gray-600 text-center leading-6">
                                            Please tap the stars to rate your experience before submitting your review.
                                        </StyledText>
                                    </StyledView>
                                </StyledView>

                                {/* Decorative Stars */}
                                <StyledView className="flex-row justify-center mb-6">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <StyledView key={star} className="mx-1">
                                            <Ionicons name="star-outline" size={24} color="#BC4A4D" />
                                        </StyledView>
                                    ))}
                                </StyledView>

                                {/* Action Button */}
                                <StyledTouchableOpacity
                                    className="bg-[#BC4A4D] p-4 rounded-2xl"
                                    onPress={() => setShowRatingRequiredModal(false)}
                                >
                                    <StyledView className="flex-row items-center justify-center">
                                        <Ionicons name="arrow-back" size={20} color="white" />
                                        <StyledText className="text-white text-base font-bold ml-2">
                                            Back to Rating
                                        </StyledText>
                                    </StyledView>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </Modal>
            )}

            {/* Error Modal */}
            {showErrorModal && (
                <Modal
                    visible={showErrorModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowErrorModal(false)}
                >
                    <StyledView className="flex-1 justify-center items-center bg-black/50 p-6">
                        <StyledView className="bg-white rounded-3xl w-full max-w-[350px] overflow-hidden">
                            <StyledView className="p-8">
                                {/* Error Icon */}
                                <StyledView className="items-center mb-6">
                                    <StyledView className="w-20 h-20 rounded-full bg-red-100 items-center justify-center mb-4">
                                        <Ionicons name="close-circle" size={50} color="#EF4444" />
                                    </StyledView>
                                    <StyledView className="items-center">
                                        <StyledText className="text-2xl font-bold text-gray-900 mb-2">
                                            Submission Failed
                                        </StyledText>
                                        <StyledText className="text-base text-gray-600 text-center leading-6">
                                            We couldn't submit your review right now. Please check your connection and try again.
                                        </StyledText>
                                    </StyledView>
                                </StyledView>

                                {/* Decorative WiFi Icon */}
                                <StyledView className="items-center mb-6">
                                    <StyledView className="bg-red-50 rounded-full px-4 py-2 border border-red-200">
                                        <StyledView className="flex-row items-center">
                                            <Ionicons name="wifi" size={16} color="#EF4444" />
                                            <StyledText className="text-red-700 text-sm font-semibold ml-1">
                                                Check Connection
                                            </StyledText>
                                        </StyledView>
                                    </StyledView>
                                </StyledView>

                                {/* Action Button */}
                                <StyledTouchableOpacity
                                    className="bg-[#BC4A4D] p-4 rounded-2xl"
                                    onPress={() => setShowErrorModal(false)}
                                >
                                    <StyledView className="flex-row items-center justify-center">
                                        <Ionicons name="refresh" size={20} color="white" />
                                        <StyledText className="text-white text-base font-bold ml-2">
                                            Try Again
                                        </StyledText>
                                    </StyledView>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </Modal>
            )}

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
                        className="bg-white rounded-3xl w-full max-w-[500px] p-6"
                        style={{
                            shadowColor: "#8B4513",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.2,
                            shadowRadius: 24,
                            elevation: 12,
                        }}
                    >
                        <StyledView className="flex-row justify-between items-center mb-4">
                            <StyledText className="text-xl font-bold text-[#8B4513]">Report Dasher No-Show</StyledText>
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
                                If your order was marked as delivered but you didn't receive it, please provide proof for your refund claim.
                            </StyledText>

                            {/* Proof Image Upload */}
                            <StyledView className="mb-4">
                                <StyledText className="text-base font-semibold text-[#8B4513] mb-2">
                                    No-Show Proof <StyledText className="text-red-500">*</StyledText>
                                </StyledText>
                                <StyledText className="text-sm text-gray-600 mb-3">
                                    Take a photo showing you didn't receive the order
                                </StyledText>
                                {noShowProofImage ? (
                                    <StyledView className="relative">
                                        <StyledImage
                                            source={{ uri: noShowProofImage }}
                                            className="w-full h-48 rounded-2xl"
                                            resizeMode="cover"
                                        />
                                        <StyledTouchableOpacity
                                            className="absolute top-2 right-2 bg-red-500 rounded-full p-2"
                                            onPress={() => setNoShowProofImage(null)}
                                        >
                                            <Ionicons name="close" size={20} color="white" />
                                        </StyledTouchableOpacity>
                                    </StyledView>
                                ) : (
                                    <StyledTouchableOpacity
                                        className="border-2 border-dashed border-gray-300 rounded-2xl p-8 items-center justify-center bg-gray-50"
                                        onPress={handlePickNoShowProof}
                                    >
                                        <Ionicons name="camera-outline" size={48} color="#9CA3AF" />
                                        <StyledText className="text-sm text-gray-500 mt-2">Tap to take photo</StyledText>
                                    </StyledTouchableOpacity>
                                )}
                            </StyledView>

                            {/* GCash QR Upload */}
                            <StyledView className="mb-4">
                                <StyledText className="text-base font-semibold text-[#8B4513] mb-2">
                                    GCash QR Code <StyledText className="text-red-500">*</StyledText>
                                </StyledText>
                                <StyledText className="text-sm text-gray-600 mb-3">
                                    Upload your GCash QR for refund processing
                                </StyledText>
                                {noShowGcashQr ? (
                                    <StyledView className="relative">
                                        <StyledImage
                                            source={{ uri: noShowGcashQr }}
                                            className="w-full h-48 rounded-2xl"
                                            resizeMode="contain"
                                        />
                                        <StyledTouchableOpacity
                                            className="absolute top-2 right-2 bg-red-500 rounded-full p-2"
                                            onPress={() => setNoShowGcashQr(null)}
                                        >
                                            <Ionicons name="close" size={20} color="white" />
                                        </StyledTouchableOpacity>
                                    </StyledView>
                                ) : (
                                    <StyledTouchableOpacity
                                        className="border-2 border-dashed border-gray-300 rounded-2xl p-8 items-center justify-center bg-gray-50"
                                        onPress={handlePickGcashQr}
                                    >
                                        <Ionicons name="image-outline" size={48} color="#9CA3AF" />
                                        <StyledText className="text-sm text-gray-500 mt-2">Tap to upload GCash QR</StyledText>
                                    </StyledTouchableOpacity>
                                )}
                            </StyledView>
                        </StyledScrollView>

                        {/* Action Buttons */}
                        <StyledView className="flex-row gap-3 mt-4">
                            <StyledTouchableOpacity
                                className="flex-1 bg-gray-200 py-3 rounded-2xl"
                                onPress={() => {
                                    setShowReportNoShowModal(false);
                                    setNoShowProofImage(null);
                                    setNoShowGcashQr(null);
                                }}
                            >
                                <StyledText className="text-base font-bold text-gray-700 text-center">
                                    Cancel
                                </StyledText>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className={`flex-1 ${isSubmittingNoShow ? 'bg-orange-300' : 'bg-orange-500'} py-3 rounded-2xl`}
                                onPress={handleReportNoShow}
                                disabled={isSubmittingNoShow}
                            >
                                <StyledText className="text-base font-bold text-white text-center">
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
                        className="bg-white rounded-3xl w-full max-w-[400px] p-6"
                        style={{
                            shadowColor: "#10B981",
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.3,
                            shadowRadius: 24,
                            elevation: 12,
                        }}
                    >
                        <StyledView className="items-center mb-6">
                            <StyledView className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-4">
                                <Ionicons name="checkmark-circle" size={50} color="#10B981" />
                            </StyledView>
                            <StyledText className="text-2xl font-bold text-[#8B4513] mb-2 text-center">
                                Report Submitted
                            </StyledText>
                            <StyledText className="text-base text-gray-600 text-center">
                                Your no-show report has been submitted successfully. Our team will review it shortly.
                            </StyledText>
                        </StyledView>

                        <StyledTouchableOpacity
                            className="bg-green-500 py-3 rounded-2xl"
                            onPress={() => {
                                setShowNoShowSuccessModal(false);
                                fetchOrders();
                            }}
                        >
                            <StyledView className="flex-row items-center justify-center">
                                <Ionicons name="checkmark" size={20} color="white" />
                                <StyledText className="text-white text-base font-bold ml-2">
                                    Done
                                </StyledText>
                            </StyledView>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledModal>

            <BottomNavigation activeTab="Profile" />
        </StyledSafeAreaView>
    );
};

export default HistoryOrder;