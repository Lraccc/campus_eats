import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useState, useEffect } from "react"
import { getAuthToken } from "../../services/authService"
import { API_URL } from "../../config"
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import BottomNavigation from "../../components/BottomNavigation"
import { useRouter } from "expo-router"

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
    const router = useRouter()

    useEffect(() => {
        fetchOrders()
    }, [])

    const fetchOrders = async () => {
        try {
            setLoading(true)

            // Get user ID and token from AsyncStorage
            const [userId, token] = await Promise.all([
                AsyncStorage.getItem('userId'),
                AsyncStorage.getItem('@CampusEats:AuthToken')
            ])

            if (!userId || !token) {
                console.error("Missing required data:", { userId: !!userId, token: !!token })
                setLoading(false)
                return
            }

            // Set the authorization header
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`

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
                    setDasherName(dasherData.gcashName || "N/A")
                    setDasherPhone(dasherData.gcashNumber || "N/A")
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
            const token = await AsyncStorage.getItem('@CampusEats:AuthToken')
            if (!userId || !token) return

            const response = await axiosInstance.get(`/api/users/${userId}/offenses`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setOffenses(response.data)
        } catch (error) {
            console.error("Error fetching offenses:", error)
        }
    }

    const postOffenses = async () => {
        if (activeOrder && activeOrder.dasherId !== null) {
            try {
                const userId = await AsyncStorage.getItem('userId')
                const token = await AsyncStorage.getItem('@CampusEats:AuthToken')
                if (!userId || !token) return

                const response = await axiosInstance.post(`/api/users/${userId}/offenses`, null, {
                    headers: { Authorization: `Bearer ${token}` }
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
            const token = await AsyncStorage.getItem('@CampusEats:AuthToken')
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
                headers: { Authorization: `Bearer ${token}` }
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

    // Add useEffect for offenses check
    useEffect(() => {
        if (offenses >= 3) {
            Alert.alert(
                "Account Banned",
                "You have been banned due to multiple order cancellations.",
                [{ text: "OK", onPress: () => router.replace('/login') }]
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
        status === 'Waiting for your confirmation'

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
                {/* Active Order Section */}
                <Text style={styles.sectionTitle}>Active Order</Text>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#BC4A4D" />
                        <Text style={styles.loadingText}>Loading orders...</Text>
                    </View>
                ) : activeOrder ? (
                    <View style={styles.activeOrderContainer}>
                        {/* Order Details Card */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Order Details</Text>
                            <View style={styles.orderContent}>
                                <Image
                                    source={{ uri: shop?.imageUrl || "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=100&width=100" }}
                                    style={styles.shopImage}
                                />
                                <View style={styles.orderDetails}>
                                    <Text style={styles.shopName}>{shop?.name || "Loading..."}</Text>
                                    <Text style={styles.shopAddress}>{shop?.address || "Loading..."}</Text>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Dasher Name:</Text>
                                        <Text style={styles.detailValue}>{dasherName || "N/A"}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Dasher Phone:</Text>
                                        <TouchableOpacity>
                                            <Text style={styles.phoneLink}>{dasherPhone ? `+63 ${dasherPhone}` : "N/A"}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Delivery Location:</Text>
                                        <Text style={styles.detailValue}>{activeOrder.deliverTo}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Order number:</Text>
                                        <Text style={styles.detailValue}>#{activeOrder.id}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Payment Method:</Text>
                                        <Text style={styles.detailValue}>{activeOrder.paymentMethod}</Text>
                                    </View>

                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Phone number:</Text>
                                        <View style={styles.phoneContainer}>
                                            <Text style={styles.detailValue}>{activeOrder.mobileNum}</Text>
                                            <TouchableOpacity>
                                                <Text style={styles.editLink}>edit</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Order Summary */}
                            <View style={styles.orderSummary}>
                                <Text style={styles.summaryTitle}>Order Summary</Text>

                                {activeOrder.items.map((item, index) => (
                                    <View key={index} style={styles.summaryItem}>
                                        <View style={styles.summaryItemHeader}>
                                            <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                                            <Text style={styles.itemName}>{item.name}</Text>
                                        </View>
                                        <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
                                    </View>
                                ))}

                                <View style={styles.totalContainer}>
                                    <View style={styles.subtotalRow}>
                                        <Text style={styles.subtotalLabel}>Subtotal</Text>
                                        <Text style={styles.subtotalValue}>₱{activeOrder.totalPrice.toFixed(2)}</Text>
                                    </View>

                                    <View style={styles.subtotalRow}>
                                        <Text style={styles.subtotalLabel}>Delivery Fee</Text>
                                        <Text style={styles.subtotalValue}>₱{shop?.deliveryFee?.toFixed(2) || "0.00"}</Text>
                                    </View>

                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalLabel}>Total</Text>
                                        <Text style={styles.totalValue}>₱{(activeOrder.totalPrice + (shop?.deliveryFee || 0)).toFixed(2)}</Text>
                                    </View>
                                </View>

                                <View style={styles.buttonContainer}>
                                    {activeOrder.paymentMethod === "gcash" && (
                                        <TouchableOpacity style={styles.refundButton}>
                                            <Text style={styles.refundButtonText}>Cancel and Refund</Text>
                                        </TouchableOpacity>
                                    )}

                                    {activeOrder.paymentMethod === "cash" && !hideCancelButton && (
                                        <TouchableOpacity 
                                            style={styles.cancelButton}
                                            onPress={() => setShowCancelModal(true)}
                                        >
                                            <Text style={styles.cancelButtonText}>
                                                {cancelling ? "Cancelling..." : "Cancel Order"}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Status Card */}
                        <View style={styles.statusCard}>
                            <View style={styles.loaderContainer}>
                                <View style={styles.circle}>
                                    <View style={styles.dot}></View>
                                    <View style={styles.outline}></View>
                                </View>
                                <View style={styles.circle}>
                                    <View style={styles.dot}></View>
                                    <View style={styles.outline}></View>
                                </View>
                                <View style={styles.circle}>
                                    <View style={styles.dot}></View>
                                    <View style={styles.outline}></View>
                                </View>
                                <View style={styles.circle}>
                                    <View style={styles.dot}></View>
                                    <View style={styles.outline}></View>
                                </View>
                            </View>
                            <Text style={styles.statusText}>{status}</Text>
                        </View>
                    </View>
                ) : (
                    <Text style={styles.noOrderText}>No active order</Text>
                )}

                {/* Past Orders Section */}
                <View style={styles.pastOrdersHeader}>
                    <Text style={styles.sectionTitle}>Past Orders</Text>
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
                        <Text style={styles.loadingText}>Loading past orders...</Text>
                    </View>
                ) : orders.length === 0 ? (
                    <Text style={styles.noOrderText}>No past orders</Text>
                ) : (
                    <View style={styles.pastOrdersContainer}>
                        {orders.map((order, index) => (
                            <TouchableOpacity key={index} style={styles.pastOrderCard}>
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

            {/* Bottom Navigation */}
            <BottomNavigation activeTab="Orders" />

            {/* Cancel Order Modal */}
            {showCancelModal && (
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Cancel Order</Text>
                        <Text style={styles.modalText}>Are you sure you want to cancel your order?</Text>
                        <Text style={styles.modalWarning}>Note: Cancelling orders may result in penalties.</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={styles.modalCancelButton}
                                onPress={() => setShowCancelModal(false)}
                            >
                                <Text style={styles.modalCancelButtonText}>No, Keep Order</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalConfirmButton, cancelling && styles.disabledButton]}
                                onPress={handleCancelOrder}
                                disabled={cancelling}
                            >
                                <Text style={styles.modalConfirmButtonText}>
                                    {cancelling ? "Cancelling..." : "Yes, Cancel Order"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    )
}

// Modal Components (static, without functionality)
const CancelOrderModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Cancel Order</Text>
                <Text style={styles.modalText}>Are you sure you want to cancel your order?</Text>
                <Text style={styles.modalWarning}>Note: Cancelling orders may result in penalties.</Text>
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalCancelButton}>
                        <Text style={styles.modalCancelButtonText}>No, Keep Order</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmButton}>
                        <Text style={styles.modalConfirmButtonText}>Yes, Cancel Order</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}

const RefundOrderModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Request Refund</Text>
                <Text style={styles.modalText}>Are you sure you want to cancel and request a refund?</Text>
                <Text style={styles.modalWarning}>Refunds may take 3-5 business days to process.</Text>
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalCancelButton}>
                        <Text style={styles.modalCancelButtonText}>No, Keep Order</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmButton}>
                        <Text style={styles.modalConfirmButtonText}>Yes, Request Refund</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}

const ReviewModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Rate Your Order</Text>
                <Text style={styles.modalText}>How was your experience?</Text>
                <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star}>
                            <Ionicons name="star-outline" size={30} color="#FFD700" />
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.reviewInputContainer}>
                    <Text style={styles.inputLabel}>Leave a comment (optional)</Text>
                    <View style={styles.textInputPlaceholder} />
                </View>
                <TouchableOpacity style={styles.submitReviewButton}>
                    <Text style={styles.submitReviewButtonText}>Submit Review</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const ReviewShopModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Rate This Shop</Text>
                <Text style={styles.modalText}>How was your experience with this shop?</Text>
                <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star}>
                            <Ionicons name="star-outline" size={30} color="#FFD700" />
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.reviewInputContainer}>
                    <Text style={styles.inputLabel}>Leave a comment (optional)</Text>
                    <View style={styles.textInputPlaceholder} />
                </View>
                <TouchableOpacity style={styles.submitReviewButton}>
                    <Text style={styles.submitReviewButtonText}>Submit Review</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const UserNoShowModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Delivery Failed</Text>
                <Text style={styles.modalText}>The dasher reported that you were not available at the delivery location.</Text>
                <Text style={styles.modalWarning}>
                    This counts as an offense. Three offenses will result in account suspension.
                </Text>
                <TouchableOpacity style={styles.modalConfirmButton}>
                    <Text style={styles.modalConfirmButtonText}>I Understand</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const ShopCancelModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Order Cancelled</Text>
                <Text style={styles.modalText}>
                    The shop has cancelled your order. This could be due to unavailable items or shop closure.
                </Text>
                <Text style={styles.modalInfo}>
                    If you paid via GCash, a refund will be processed within 3-5 business days.
                </Text>
                <TouchableOpacity style={styles.modalConfirmButton}>
                    <Text style={styles.modalConfirmButtonText}>OK</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const OrderEditPhoneNumModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Edit Phone Number</Text>
                <Text style={styles.modalText}>Update your contact number for this delivery.</Text>
                <View style={styles.phoneInputContainer}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <View style={styles.textInputPlaceholder} />
                </View>
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalCancelButton}>
                        <Text style={styles.modalCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmButton}>
                        <Text style={styles.modalConfirmButtonText}>Update</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}

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
        paddingBottom: 80, // Added extra padding to account for bottom navigation
        paddingHorizontal: 15,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "600",
        marginVertical: 16,
        color: "#BC4A4D",
    },
    activeOrderContainer: {
        marginBottom: 24,
    },
    card: {
        backgroundColor: "#FFFAF1",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 16,
        color: "#BC4A4D",
    },
    orderContent: {
        flexDirection: "row",
        marginBottom: 16,
    },
    shopImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 16,
    },
    orderDetails: {
        flex: 1,
    },
    shopName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#BC4A4D",
    },
    shopAddress: {
        fontSize: 14,
        color: "#BBB4A",
        marginBottom: 8,
    },
    detailRow: {
        flexDirection: "row",
        marginTop: 4,
    },
    detailLabel: {
        fontSize: 14,
        color: "#BBB4A",
        width: 120,
    },
    detailValue: {
        fontSize: 14,
        color: "#BC4A4D",
        fontWeight: "500",
    },
    phoneLink: {
        fontSize: 14,
        color: "#BC4A4D",
        fontWeight: "500",
        textDecorationLine: "underline",
    },
    phoneContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    editLink: {
        fontSize: 14,
        color: "#BC4A4D",
        marginLeft: 8,
        textDecorationLine: "underline",
    },
    orderSummary: {
        borderTopWidth: 1,
        borderTopColor: "#BBB4A",
        paddingTop: 16,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 12,
        color: "#BC4A4D",
    },
    summaryItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    summaryItemHeader: {
        flexDirection: "row",
    },
    itemQuantity: {
        fontSize: 14,
        color: "#BBB4A",
        marginRight: 8,
    },
    itemName: {
        fontSize: 14,
        color: "#BC4A4D",
    },
    itemPrice: {
        fontSize: 14,
        color: "#BC4A4D",
        fontWeight: "500",
    },
    totalContainer: {
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: "#BBB4A",
        paddingTop: 16,
    },
    subtotalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    subtotalLabel: {
        fontSize: 14,
        color: "#BBB4A",
    },
    subtotalValue: {
        fontSize: 14,
        color: "#BC4A4D",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: "#BBB4A",
        paddingTop: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#BC4A4D",
    },
    totalValue: {
        fontSize: 16,
        fontWeight: "600",
        color: "#BC4A4D",
    },
    buttonContainer: {
        marginTop: 16,
        flexDirection: "row",
        justifyContent: "center",
    },
    refundButton: {
        backgroundColor: "#BC4A4D",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 8,
    },
    refundButtonText: {
        color: "#FFFAF1",
        fontSize: 14,
        fontWeight: "600",
    },
    cancelButton: {
        backgroundColor: "#BC4A4D",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 8,
    },
    cancelButtonText: {
        color: "#FFFAF1",
        fontSize: 14,
        fontWeight: "600",
    },
    statusCard: {
        backgroundColor: "#FFFAF1",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    loaderContainer: {
        flexDirection: "row",
        marginBottom: 16,
    },
    circle: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: "#BBB4A",
        marginHorizontal: 4,
        justifyContent: "center",
        alignItems: "center",
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#BC4A4D",
    },
    outline: {
        position: "absolute",
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#BC4A4D",
    },
    statusText: {
        fontSize: 16,
        color: "#BC4A4D",
        textAlign: "center",
    },
    noOrderText: {
        fontSize: 16,
        color: "#BBB4A",
        textAlign: "center",
        marginVertical: 24,
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
    // Modal styles
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
    modalWarning: {
        fontSize: 14,
        color: "#BC4A4D",
        marginBottom: 24,
        textAlign: "center",
    },
    modalInfo: {
        fontSize: 14,
        color: "#BBB4A",
        marginBottom: 24,
        textAlign: "center",
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
    textInputPlaceholder: {
        height: 100,
        borderWidth: 1,
        borderColor: "#BBB4A",
        borderRadius: 8,
        padding: 8,
    },
    submitReviewButton: {
        backgroundColor: "#BC4A4D",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: "center",
    },
    submitReviewButtonText: {
        color: "#FFFAF1",
        fontSize: 16,
        fontWeight: "600",
    },
    phoneInputContainer: {
        marginBottom: 24,
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
    disabledButton: {
        opacity: 0.7,
    },
})

export default Order