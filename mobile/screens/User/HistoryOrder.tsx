import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { getAuthToken } from "../../services/authService"
import { API_URL } from "../../config"
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import BottomNavigation from "../../components/BottomNavigation"
import { useRouter } from "expo-router"

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

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
                <View style={styles.pastOrdersHeader}>
                    <Text style={styles.sectionTitle}>Order History</Text>
                    {offenses > 0 && (
                        <View style={styles.warningContainer}>
                            <Text style={styles.warningText}>
                                <Text style={styles.warningBold}>Warning!</Text> x{offenses} {offenses > 1 ? "offenses" : "offense"}{" "}
                                recorded. 3 cancellations will lead to account ban.
                            </Text>
                        </View>
                    )}
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#BC4A4D" />
                        <Text style={styles.loadingText}>Loading order history...</Text>
                    </View>
                ) : orders.length === 0 ? (
                    <Text style={styles.noOrderText}>No past orders</Text>
                ) : (
                    <View style={styles.pastOrdersContainer}>
                        {orders.map((order: OrderItem, index: number) => (
                            <TouchableOpacity 
                                key={index} 
                                style={styles.pastOrderCard}
                                onPress={() => {
                                    if (!order.status.includes('cancelled_') && !order.status.includes('no-')) {
                                        setSelectedOrder(order);
                                        setShowShopReviewModal(true);
                                    }
                                }}
                            >
                                <Image
                                    source={{ uri: order.shopData?.imageUrl || "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=100&width=100" }}
                                    style={styles.pastOrderImage}
                                />
                                <View style={styles.pastOrderDetails}>
                                    <View style={styles.pastOrderHeader}>
                                        <View>
                                            <Text style={styles.pastOrderShopName}>{order.shopData?.name || "Loading..."}</Text>
                                            <Text style={styles.pastOrderShopAddress}>{order.shopData?.address || "Loading..."}</Text>
                                        </View>
                                        <Text style={styles.pastOrderPrice}>₱{order.totalPrice.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.pastOrderInfo}>
                                        <Text style={styles.pastOrderStatus}>
                                            {order.status === "cancelled_by_shop"
                                                ? "Order was cancelled by shop"
                                                : order.status === "cancelled_by_customer"
                                                    ? "Order was cancelled by customer"
                                                    : order.status === "cancelled_by_dasher"
                                                        ? "Order was cancelled by dasher"
                                                        : order.status === "refunded"
                                                            ? "Order was refunded"
                                                            : order.status === "no-show"
                                                                ? "Customer did not show up for delivery"
                                                                : `Delivered on ${new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`}
                                        </Text>
                                        <Text style={styles.pastOrderId}>Order #{order.id}</Text>
                                        <Text style={styles.pastOrderPayment}>
                                            {order.paymentMethod === "cash" ? "Cash On Delivery" : "GCASH"}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Shop Review Modal */}
            {showShopReviewModal && selectedOrder && (
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Share Your Experience</Text>
                            <TouchableOpacity 
                                style={styles.closeButton}
                                onPress={() => {
                                    setShowShopReviewModal(false);
                                    setSelectedOrder(null);
                                    setShopRating(0);
                                    setShopReviewText('');
                                }}
                            >
                                <Ionicons name="close" size={24} color="#BC4A4D" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalText}>Rate {selectedOrder.shopData?.name}</Text>
                        
                        <View style={styles.ratingContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity 
                                    key={star}
                                    onPress={() => setShopRating(star)}
                                >
                                    <Ionicons 
                                        name={shopRating >= star ? "star" : "star-outline"} 
                                        size={30} 
                                        color="#FFD700" 
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.reviewInputContainer}>
                            <Text style={styles.inputLabel}>Write your review (optional)</Text>
                            <TextInput
                                style={styles.reviewInput}
                                multiline
                                numberOfLines={4}
                                placeholder="Share your experience..."
                                value={shopReviewText}
                                onChangeText={setShopReviewText}
                            />
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    setShowShopReviewModal(false);
                                    setSelectedOrder(null);
                                    setShopRating(0);
                                    setShopReviewText('');
                                }}
                            >
                                <Text style={styles.modalCancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalConfirmButton, isSubmittingShopReview && styles.disabledButton]}
                                onPress={handleShopReview}
                                disabled={isSubmittingShopReview}
                            >
                                <Text style={styles.modalConfirmButtonText}>
                                    {isSubmittingShopReview ? "Submitting..." : "Submit"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Bottom Navigation */}
            <BottomNavigation activeTab="Profile" />
        </View>
    );
};

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
    sectionTitle: {
        fontSize: 20,
        fontWeight: "600",
        marginVertical: 16,
        color: "#BC4A4D",
    },
    pastOrdersHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    warningContainer: {
        backgroundColor: "#FFFAF1",
        padding: 8,
        borderRadius: 8,
        flex: 1,
        marginLeft: 16,
    },
    warningText: {
        fontSize: 12,
        color: "#BC4A4D",
    },
    warningBold: {
        fontWeight: "700",
    },
    pastOrdersContainer: {
        marginBottom: 24,
    },
    pastOrderCard: {
        backgroundColor: "#FFFAF1",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        flexDirection: "row",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    pastOrderImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 16,
    },
    pastOrderDetails: {
        flex: 1,
    },
    pastOrderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    pastOrderShopName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#BC4A4D",
    },
    pastOrderShopAddress: {
        fontSize: 14,
        color: "#BBB4A",
    },
    pastOrderPrice: {
        fontSize: 16,
        fontWeight: "600",
        color: "#BC4A4D",
    },
    pastOrderInfo: {
        marginTop: 4,
    },
    pastOrderStatus: {
        fontSize: 14,
        color: "#BBB4A",
        marginBottom: 4,
    },
    pastOrderId: {
        fontSize: 14,
        color: "#BBB4A",
        marginBottom: 4,
    },
    pastOrderPayment: {
        fontSize: 14,
        color: "#BBB4A",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#BC4A4D',
    },
    noOrderText: {
        fontSize: 16,
        color: "#BBB4A",
        textAlign: "center",
        marginVertical: 24,
    },
    modalContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    modalContent: {
        backgroundColor: "#FFFAF1",
        borderRadius: 12,
        padding: 24,
        width: "100%",
        maxWidth: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "600",
        marginBottom: 16,
        color: "#BC4A4D",
        textAlign: "center",
    },
    modalText: {
        fontSize: 16,
        color: "#BC4A4D",
        marginBottom: 16,
        textAlign: "center",
    },
    closeButton: {
        padding: 4,
    },
    ratingContainer: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 24,
    },
    reviewInputContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        color: "#BBB4A",
        marginBottom: 8,
    },
    reviewInput: {
        height: 100,
        borderWidth: 1,
        borderColor: "#BBB4A",
        borderRadius: 8,
        padding: 8,
        textAlignVertical: 'top',
        color: '#BC4A4D',
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    modalCancelButton: {
        backgroundColor: "#BBB4A",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        flex: 1,
        marginRight: 8,
        alignItems: "center",
    },
    modalCancelButtonText: {
        color: "#FFFAF1",
        fontSize: 14,
        fontWeight: "600",
    },
    modalConfirmButton: {
        backgroundColor: "#BC4A4D",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        flex: 1,
        marginLeft: 8,
        alignItems: "center",
    },
    modalConfirmButtonText: {
        color: "#FFFAF1",
        fontSize: 14,
        fontWeight: "600",
    },
    disabledButton: {
        opacity: 0.7,
    },
});

export default HistoryOrder; 