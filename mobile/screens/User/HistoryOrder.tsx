import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, SafeAreaView, StatusBar, Modal } from "react-native"
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
    const [offenses, setOffenses] = useState(0)
    const [showShopReviewModal, setShowShopReviewModal] = useState(false)
    const [showViewReviewModal, setShowViewReviewModal] = useState(false)
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

            try {
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
            if (axios.isAxiosError(error) && error.response?.status === 409) {
                // Show styled alert for existing review
                Alert.alert(
                    "Review Already Submitted",
                    "You have already submitted a review for this order.",
                    [
                        {
                            text: "OK",
                            style: "default",
                            onPress: () => {
                                setShowShopReviewModal(false);
                                setSelectedOrder(null);
                                setShopRating(0);
                                setShopReviewText('');
                            }
                        }
                    ],
                    { cancelable: false }
                );
            } else {
                Alert.alert(
                    "Error",
                    "Failed to submit review. Please try again later.",
                    [{ text: "OK" }]
                );
            }
        } finally {
            setIsSubmittingShopReview(false);
        }
    };

    // Add this new function to check if an order has been reviewed
    const checkIfOrderReviewed = async (orderId: string) => {
        try {
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) return false;

            const response = await axiosInstance.get(`/api/ratings/check/${orderId}`, {
                headers: { Authorization: token }
            });
            return response.data.hasReview;
        } catch (error) {
            return false;
        }
    };

    // Add this new function to fetch existing review
    const fetchExistingReview = async (orderId: string) => {
        try {
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }
            if (!token) return null;

            const response = await axiosInstance.get(`/api/ratings/order/${orderId}`, {
                headers: { Authorization: token }
            });
            return response.data;
        } catch (error) {
            console.error("Error fetching existing review:", error);
            return null;
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
                                onPress={() => router.push('/home')}
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
                                            if (order.hasReview) {
                                                setShowViewReviewModal(true);
                                            } else {
                                                setShowShopReviewModal(true);
                                            }
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
                                                    if (order.hasReview) {
                                                        setShowViewReviewModal(true);
                                                    } else {
                                                        setShowShopReviewModal(true);
                                                    }
                                                }}
                                            >
                                                <Ionicons
                                                    name="star"
                                                    size={16}
                                                    color={order.hasReview ? "#F59E0B" : "#BC4A4D"}
                                                />
                                                <StyledText className={`text-sm font-semibold ml-1 ${order.hasReview ? 'text-amber-500' : 'text-[#BC4A4D]'}`}>
                                                    {order.hasReview ? 'View Review' : 'Rate Order'}
                                                </StyledText>
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
                                    <StyledView className="relative">
                                        <StyledImage
                                            source={{ uri: selectedOrder.shopData?.imageUrl || "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=60&width=60" }}
                                            className="w-20 h-20 rounded-2xl"
                                        />
                                        <StyledView className="absolute -bottom-2 -right-2 bg-amber-100 rounded-full p-1">
                                            <Ionicons name="star" size={16} color="#F59E0B" />
                                        </StyledView>
                                    </StyledView>
                                    <StyledText className="text-lg font-bold text-gray-900 mt-4">{selectedOrder.shopData?.name}</StyledText>
                                    <StyledText className="text-sm text-gray-500 mt-1">Order #{selectedOrder.id.substring(0, 8)}</StyledText>
                                </StyledView>

                                <StyledView className="mb-6">
                                    <StyledText className="text-base font-semibold text-gray-900 mb-3 text-center">How was your experience?</StyledText>
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
                                    <StyledText className="text-sm text-gray-500 text-center mt-2">
                                        {shopRating === 0 ? "Tap to rate" :
                                            shopRating === 1 ? "Poor" :
                                                shopRating === 2 ? "Fair" :
                                                    shopRating === 3 ? "Good" :
                                                        shopRating === 4 ? "Very Good" : "Excellent"}
                                    </StyledText>
                                </StyledView>

                                <StyledView className="mb-6">
                                    <StyledText className="text-base font-semibold text-gray-900 mb-2">Write your review (optional)</StyledText>
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
                                            <StyledText className="text-gray-600 text-base font-semibold ml-2">Cancel</StyledText>
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
                                    <StyledText className="text-xl font-bold text-gray-900">Your Review</StyledText>
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
                                    <StyledText className="text-lg font-bold text-gray-900 mt-4">{selectedOrder.shopData?.name}</StyledText>
                                    <StyledText className="text-sm text-gray-500 mt-1">Order #{selectedOrder.id.substring(0, 8)}</StyledText>
                                </StyledView>

                                <StyledView className="mb-6">
                                    <StyledText className="text-base font-semibold text-gray-900 mb-3 text-center">Your Rating</StyledText>
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
                                        <StyledText className="text-base font-semibold text-gray-900 mb-2">Your Review</StyledText>
                                        <StyledView className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-200">
                                            <StyledText className="text-base text-gray-700">
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

            <BottomNavigation activeTab="Profile" />
        </StyledSafeAreaView>
    );
};

export default HistoryOrder;