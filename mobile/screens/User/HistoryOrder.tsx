import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, SafeAreaView, StatusBar } from "react-native"
import { Ionicons } from "@expo/vector-icons"
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

const HistoryOrder = () => {
    const [orders, setOrders] = useState<OrderItem[]>([])
    const [loading, setLoading] = useState(true)
    const [offenses, setOffenses] = useState(0)
    const [showShopReviewModal, setShowShopReviewModal] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null)
    const [shopRating, setShopRating] = useState(0)
    const [shopReviewText, setShopReviewText] = useState('')
    const [isSubmittingShopReview, setIsSubmittingShopReview] = useState(false)
    const router = useRouter()

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

            const ordersResponse = await axiosInstance.get(`/api/orders/user/${userId}`);
            const ordersData = ordersResponse.data;

            if (ordersData.orders?.length > 0) {
                const ordersWithShopData = await Promise.all(
                    ordersData.orders.map(async (order: OrderItem) => {
                        if (!order.shopId) return order;

                        try {
                            const shopResponse = await axiosInstance.get(`/api/shops/${order.shopId}`);
                            return { ...order, shopData: shopResponse.data };
                        } catch (error) {
                            console.error(`Error fetching shop data for order ${order.id}:`, error);
                            return order;
                        }
                    })
                );
                setOrders(ordersWithShopData);
            } else {
                setOrders([]);
            }
        } catch (error) {
            console.error("Error fetching orders:", error);
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
            Alert.alert("Action Needed", "Please provide a rating.");
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
                        <StyledText className="text-xl font-bold text-gray-900">Order History</StyledText>
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
                            <ActivityIndicator size="large" color="#BC4A4D" />
                            <StyledText className="mt-4 text-base text-gray-600">Loading order history...</StyledText>
                        </StyledView>
                    ) : orders.length === 0 ? (
                        <StyledView className="flex-1 justify-center items-center py-12 bg-white rounded-3xl shadow-sm">
                            <StyledView className="w-20 h-20 rounded-full bg-gray-50 justify-center items-center mb-4">
                                <Ionicons name="receipt-outline" size={36} color="#9CA3AF" />
                            </StyledView>
                            <StyledText className="text-lg font-bold text-gray-900 text-center">No Orders Yet</StyledText>
                            <StyledText className="mt-2 text-base text-gray-600 text-center px-6">
                                Your order history will appear here once you place orders
                            </StyledText>
                            <StyledTouchableOpacity
                                className="mt-6 bg-[#BC4A4D] px-6 py-3 rounded-2xl"
                                onPress={() => router.push('/')}
                            >
                                <StyledText className="text-white font-semibold">Browse Shops</StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    ) : (
                        <StyledView className="space-y-4">
                            {orders.map((order: OrderItem, index: number) => (
                                <StyledTouchableOpacity
                                    key={index}
                                    className="bg-white rounded-3xl p-5 shadow-sm"
                                    onPress={() => {
                                        if (!order.status.includes('cancelled_') && !order.status.includes('no-')) {
                                            setSelectedOrder(order);
                                            setShowShopReviewModal(true);
                                        }
                                    }}
                                >
                                    <StyledView className="flex-row items-center mb-3">
                                        <StyledText className="text-xs text-gray-500">
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
                                                    <StyledText className="text-lg font-bold text-gray-900">{order.shopData?.name || "Loading..."}</StyledText>
                                                    <StyledText className="text-sm text-gray-500 mt-1">{order.shopData?.address || "Loading..."}</StyledText>
                                                </StyledView>
                                                <StyledText className="text-lg font-bold text-[#BC4A4D]">₱{order.totalPrice.toFixed(2)}</StyledText>
                                            </StyledView>

                                            <StyledView className="mt-3 flex-row items-center justify-between">
                                                <StyledView className="flex-row items-center">
                                                    <Ionicons name={order.paymentMethod === "cash" ? "cash-outline" : "card-outline"} size={16} color="#6B7280" />
                                                    <StyledText className="text-sm text-gray-500 ml-1">
                                                        {order.paymentMethod === "cash" ? "Cash On Delivery" : "GCASH"}
                                                    </StyledText>
                                                </StyledView>
                                                <StyledText className="text-xs text-gray-400">Order #{order.id.substring(0, 8)}</StyledText>
                                            </StyledView>
                                        </StyledView>
                                    </StyledView>

                                    {!order.status.includes('cancelled_') && !order.status.includes('no-') && (
                                        <StyledView className="mt-4 border-t border-gray-100 pt-3 flex-row justify-end">
                                            <StyledTouchableOpacity
                                                className="flex-row items-center"
                                                onPress={() => {
                                                    setSelectedOrder(order);
                                                    setShowShopReviewModal(true);
                                                }}
                                            >
                                                <Ionicons name="star-outline" size={16} color="#BC4A4D" />
                                                <StyledText className="text-sm text-[#BC4A4D] font-semibold ml-1">Rate Order</StyledText>
                                            </StyledTouchableOpacity>
                                        </StyledView>
                                    )}
                                </StyledTouchableOpacity>
                            ))}
                        </StyledView>
                    )}
                </StyledView>
            </StyledScrollView>

            {/* Shop Review Modal */}
            {showShopReviewModal && selectedOrder && (
                <StyledView className="absolute inset-0 bg-black/50 justify-center items-center p-6">
                    <StyledView className="bg-white rounded-3xl p-6 w-full max-w-sm">
                        <StyledView className="flex-row justify-between items-center mb-6">
                            <StyledText className="text-xl font-bold text-gray-900">Rate Your Experience</StyledText>
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
                            <StyledImage
                                source={{ uri: selectedOrder.shopData?.imageUrl || "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=60&width=60" }}
                                className="w-16 h-16 rounded-full mb-3"
                            />
                            <StyledText className="text-base font-semibold text-gray-900 text-center">{selectedOrder.shopData?.name}</StyledText>
                            <StyledText className="text-sm text-gray-500 text-center mt-1">Order #{selectedOrder.id.substring(0, 8)}</StyledText>
                        </StyledView>

                        <StyledView className="flex-row justify-center mb-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <StyledTouchableOpacity
                                    key={star}
                                    className="mx-2"
                                    onPress={() => setShopRating(star)}
                                >
                                    <Ionicons
                                        name={shopRating >= star ? "star" : "star-outline"}
                                        size={36}
                                        color="#FFD700"
                                    />
                                </StyledTouchableOpacity>
                            ))}
                        </StyledView>

                        <StyledView className="mb-6">
                            <StyledText className="text-sm font-semibold text-gray-900 mb-2">Write your review (optional)</StyledText>
                            <StyledTextInput
                                className="bg-gray-50 rounded-2xl px-4 py-4 text-base border border-gray-200 h-24"
                                multiline
                                numberOfLines={4}
                                placeholder="Share your experience with this shop..."
                                placeholderTextColor="#9CA3AF"
                                value={shopReviewText}
                                onChangeText={setShopReviewText}
                                style={{ fontSize: 16 }}
                            />
                        </StyledView>

                        <StyledView className="space-y-3">
                            <StyledTouchableOpacity
                                className={`${isSubmittingShopReview ? 'bg-[#BC4A4D]/50' : 'bg-[#BC4A4D]'} p-4 rounded-2xl`}
                                onPress={handleShopReview}
                                disabled={isSubmittingShopReview}
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
                                    <StyledText className="text-gray-600 text-base font-semibold ml-2">Cancel</StyledText>
                                </StyledView>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            )}

            <BottomNavigation activeTab="Profile" />
        </StyledSafeAreaView>
    );
};

export default HistoryOrder;