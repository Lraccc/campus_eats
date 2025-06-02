import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, Image, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL, AUTH_TOKEN_KEY } from '../../config';
import BottomNavigation from '../../components/BottomNavigation';
import DasherCompletedModal from './components/DasherCompletedModal';
import DasherCancelModal from './components/DasherCancelModal';
import DeliveryMap from "../../components/Map/DeliveryMap";

interface OrderItem {
    quantity: number;
    name: string;
    price: number;
}

interface Order {
    id: string;
    firstname: string;
    lastname?: string;
    mobileNum: string;
    deliverTo: string;
    paymentMethod: string;
    note?: string;
    totalPrice: number;
    status: string;
    items: OrderItem[];
    shopId: string;
    createdAt: string;
    changeFor?: number;
    shopData?: Shop;
    dasherId?: string;
    uid: string;
}

interface Shop {
    id: string;
    name: string;
    address: string;
    imageUrl: string;
    deliveryFee: number;
}

export default function Orders() {
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    const [pastOrders, setPastOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>('');
    const [currentStatus, setCurrentStatus] = useState('');
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    const fetchOrders = async () => {
        if (!userId) return;

        setLoading(true);
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) {
                console.error('Authentication token not found');
                setLoading(false);
                return;
            }

            console.log('Fetching all dasher orders for user ID:', userId);
            const ordersResponse = await axios.get(`${API_URL}/api/orders/dasher/all-orders-list/${userId}`, {
                headers: { 'Authorization': token }
            });

            if (ordersResponse.data) {
                const { activeOrders, orders: historicalOrders } = ordersResponse.data;

                let activeOrderData = null;
                if (activeOrders.length > 0) {
                    try {
                        const shopDataResponse = await axios.get(`${API_URL}/api/shops/${activeOrders[0].shopId}`, {
                            headers: { 'Authorization': token }
                        });
                        activeOrderData = { ...activeOrders[0], shopData: shopDataResponse.data };
                    } catch (error) {
                        console.error('Error fetching shop data for active order:', error);
                        activeOrderData = activeOrders[0];
                    }
                }
                setActiveOrder(activeOrderData);

                const pastOrdersWithShopData = await Promise.all(
                    historicalOrders.map(async (order: Order) => {
                        try {
                            const shopDataResponse = await axios.get(`${API_URL}/api/shops/${order.shopId}`, {
                                headers: { 'Authorization': token }
                            });
                            return { ...order, shopData: shopDataResponse.data };
                        } catch (error) {
                            console.error('Error fetching shop data for past order:', error);
                            return order;
                        }
                    })
                );
                setPastOrders(pastOrdersWithShopData);
            }
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const getUserId = async () => {
            try {
                const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
                if (token) {
                    const tokenParts = token.split('.');
                    if (tokenParts.length === 3) {
                        const payload = JSON.parse(atob(tokenParts[1]));
                        const id = payload.sub || payload.oid || payload.userId || payload.id;
                        setUserId(id);
                    }
                }
            } catch (err) {
                console.error('Error getting user ID:', err);
            }
        };
        getUserId();
    }, []);

    useEffect(() => {
        if (userId) {
            fetchOrders();
        }
    }, [userId]);

    useEffect(() => {
        if (activeOrder && activeOrder.status) {
            const adjustedStatus = activeOrder.status === "active_waiting_for_confirmation"
                ? "delivered"
                : ["active_waiting_for_shop", "active_shop_confirmed"].includes(activeOrder.status)
                ? "toShop"
                : activeOrder.status.replace("active_", "");
            setCurrentStatus(adjustedStatus);
        }
    }, [activeOrder]);

    const formatPastOrderStatus = (status: string, createdAt: string) => {
        if (status === 'no-show') {
            return 'Failed Delivery: Customer did not show up';
        } else if (status.startsWith('cancelled')) {
            return 'Order was cancelled';
        } else if (status === 'refunded') {
            return 'Order was refunded';
        } else if (status === 'completed'){
             return `Delivered on ${new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
        } else {
            return `Status: ${status}`;
        }
    };

    const updateOrderStatus = async (newStatus: string) => {
        if (!activeOrder || !userId) return;
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            console.log(`Updating order ${activeOrder.id} status to active_${newStatus}`);
            await axios.post(`${API_URL}/api/orders/update-order-status`, {
                orderId: activeOrder.id,
                status: `active_${newStatus}`
            }, {
                headers: { 'Authorization': token }
            });
        } catch (error) {
            console.error('Error updating order status:', error);
        }
    };

    const handleStatusChange = (newStatus: string) => {
        if (!activeOrder) return;

        console.log('Attempting status change to:', newStatus);
        console.log('Current status:', currentStatus);

        let nextStatus: string | null = null;
        if (currentStatus === '' && newStatus === 'toShop') {
             nextStatus = 'toShop';
         } else if (currentStatus === 'toShop' && newStatus === 'preparing') {
             nextStatus = 'preparing';
         } else if (currentStatus === 'preparing' && newStatus === 'pickedUp') {
             nextStatus = 'pickedUp';
         } else if (currentStatus === 'pickedUp' && newStatus === 'onTheWay') {
              nextStatus = 'onTheWay';
         } else if (currentStatus === 'onTheWay' && newStatus === 'delivered') {
             setIsCompletionModalOpen(true);
             return;
         }

         if (nextStatus) {
             setCurrentStatus(nextStatus);
             updateOrderStatus(nextStatus);
         } else {
            console.log('Invalid status transition from', currentStatus, 'with attempted new status', newStatus);
         }
    };

    const handleCancelOrder = async () => {
        if (!activeOrder) return;
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            // Update dasher status to active
            await axios.put(
                `${API_URL}/api/dashers/update/${activeOrder.dasherId}/status`,
                null,
                {
                    params: { status: 'active' },
                    headers: { 'Authorization': token }
                }
            );

            // Remove dasher from order
            await axios.post(
                `${API_URL}/api/orders/remove-dasher`,
                {
                    orderId: activeOrder.id
                },
                { headers: { 'Authorization': token } }
            );

            fetchOrders();
        } catch (error) {
            console.error('Error cancelling order:', error);
        }
    };

    const handleOrderCompleted = () => {
        setIsCompletionModalOpen(false);
        setIsCancelModalOpen(false);
        fetchOrders();
    };

    const getButtonProps = () => {
        switch (currentStatus) {
            case '':
                return { text: 'Start Trip', nextStatus: 'toShop' };
            case 'toShop':
                return { text: 'Arrived at Shop', nextStatus: 'preparing' };
            case 'preparing':
                return { text: 'Picked Up Order', nextStatus: 'pickedUp' };
            case 'pickedUp':
                return { text: 'On the Way', nextStatus: 'onTheWay' };
            case 'onTheWay':
                return { text: 'Delivered Order', nextStatus: 'delivered' };
            case 'delivered':
                return { text: 'Complete Order', nextStatus: 'completed' };
            default:
                return { text: 'N/A', nextStatus: null };
        }
    };

    const buttonProps = getButtonProps();

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                <View style={styles.mainContainer}>
                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>Active Order</Text>
                </View>

                {loading ? (
                     <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#BC4A4D" />
                    </View>
                ) : activeOrder ? (
                    <View style={styles.activeOrderCard}>
                        <View style={styles.activeOrderContent}>
                            <View style={styles.orderImageContainer}>
                                <Image
                                    source={activeOrder.shopData && activeOrder.shopData.imageUrl ? { uri: activeOrder.shopData.imageUrl } : require('../../assets/images/sample.jpg')}
                                    style={styles.orderImage}
                                    resizeMode="cover"
                                />
                            </View>
                             <View style={styles.orderDetails}>
                                <Text style={styles.shopName}>{activeOrder.shopData?.name || 'Shop'}</Text>
                                <Text style={styles.orderId}>Order #{activeOrder.id}</Text>
                                <Text style={styles.customerName}>{`Customer: ${activeOrder.firstname} ${activeOrder.lastname || ''}`}</Text>
                                <Text style={styles.deliveryLocation}>{`Deliver To: ${activeOrder.deliverTo}`}</Text>
                                 <Text style={styles.paymentMethod}>{`Payment: ${activeOrder.paymentMethod}`}</Text>
                                  {activeOrder.changeFor && <Text style={styles.changeFor}>{`Change For: ₱${activeOrder.changeFor}`}</Text>}
                                   {activeOrder.note && <Text style={styles.orderNote}>{`Note: ${activeOrder.note}`}</Text>}
                            </View>
                        </View>
                        <View style={styles.orderSummary}>
                            <Text style={styles.summaryTitle}>Order Summary</Text>
                            {activeOrder.items.map((item, index) => (
                                <View key={index} style={styles.summaryItemRow}>
                                    <Text style={styles.summaryItemQty}>{item.quantity}x</Text>
                                    <Text style={styles.summaryItemName}>{item.name}</Text>
                                    <Text style={styles.summaryItemPrice}>₱{item.price.toFixed(2)}</Text>
                                </View>
                            ))}
                            <View style={styles.summaryTotalRow}>
                                <Text style={styles.summaryTotalLabel}>Subtotal</Text>
                                <Text style={styles.summaryTotalValue}>₱{activeOrder.totalPrice.toFixed(2)}</Text>
                            </View>
                             <View style={styles.summaryTotalRow}>
                                <Text style={styles.summaryTotalLabel}>Delivery Fee</Text>
                                <Text style={styles.summaryTotalValue}>₱{activeOrder.shopData?.deliveryFee?.toFixed(2) || '0.00'}</Text>
                            </View>
                            <View style={styles.summaryTotalRow}>
                                <Text style={styles.summaryTotalLabel}>Total</Text>
                                <Text style={styles.summaryTotalValue}>₱{(activeOrder.totalPrice + (activeOrder.shopData?.deliveryFee || 0)).toFixed(2)}</Text>
                            </View>
                        </View>
                        <View style={styles.statusButtonContainer}>
                            <Text style={styles.statusLabel}>Current Status:</Text>
                            {buttonProps.nextStatus && (
                                <TouchableOpacity
                                    style={styles.statusButton}
                                    onPress={() => handleStatusChange(buttonProps.nextStatus)}
                                >
                                    <Text style={styles.statusButtonText}>{buttonProps.text}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.navigationButton} onPress={() => {
                                    // Open Google Maps with directions to shop
                                    let address = encodeURIComponent(activeOrder.shopData?.address || "");
                                    router.push(`https://www.google.com/maps/dir/?api=1&destination=${address}`);
                                }}>
                                    <Text style={styles.navigationButtonText}>Navigate to Shop</Text>
                                </TouchableOpacity>
                                {/* Delivery Map for tracking */}
                                <View style={styles.mapContainer}>
                                    <Text style={styles.mapTitle}>Live Delivery Tracking</Text>
                                    <DeliveryMap 
                                        orderId={activeOrder.id} 
                                        userType="dasher" 
                                        height={220} 
                                    />
                                </View>
                            {currentStatus === 'toShop' && (
                                <TouchableOpacity
                                    style={[styles.statusButton, styles.cancelButton]}
                                    onPress={handleCancelOrder}
                                >
                                    <Text style={styles.statusButtonText}>Cancel Order</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ) : (
                     <View style={styles.noOrdersContainer}>
                        <Text style={styles.noOrdersText}>No active order...</Text>
                    </View>
                )}

                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>Past Orders</Text>
                </View>

                 {loading ? (
                     <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#BC4A4D" />
                    </View>
                ) : pastOrders.length === 0 ? (
                    <View style={styles.noOrdersContainer}>
                        <Text style={styles.noOrdersText}>No past orders...</Text>
                    </View>
                ) : (
                    <View style={styles.pastOrdersList}>
                        {pastOrders.map((order) => (
                            <View key={order.id} style={styles.pastOrderCard}>
                                <View style={styles.pastOrderContent}>
                                    <View style={styles.pastOrderImageContainer}>
                                        <Image
                                             source={order.shopData && order.shopData.imageUrl ? { uri: order.shopData.imageUrl } : require('../../assets/images/sample.jpg')}
                                            style={styles.pastOrderImage}
                                            resizeMode="cover"
                                        />
                                    </View>
                                    <View style={styles.pastOrderDetails}>
                                        <Text style={styles.pastShopName}>{order.shopData?.name || 'Shop'}</Text>
                                        <Text style={styles.pastOrderStatus}>{formatPastOrderStatus(order.status, order.createdAt)}</Text>
                                        <Text style={styles.pastOrderId}>Order #{order.id}</Text>
                                         <Text style={styles.pastOrderPayment}>{`Paid ${order.paymentMethod}`}</Text>
                                    </View>
                                     <View style={styles.pastOrderTotalContainer}>
                                        <Text style={styles.pastOrderTotal}>₱{order.totalPrice.toFixed(2)}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
                </View>
            </ScrollView>
            <BottomNavigation activeTab="Orders" />
            
            {activeOrder && (
                <DasherCompletedModal
                    isOpen={isCompletionModalOpen}
                    closeModal={() => setIsCompletionModalOpen(false)}
                    shopData={activeOrder.shopData}
                    orderData={activeOrder}
                    onOrderCompleted={handleOrderCompleted}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fae9e0',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#fae9e0',
    },
    mainContainer: {
        backgroundColor: '#fae9e0',
        padding: 16,
        paddingTop: 30,
        paddingBottom: 80,
        flex: 1,
    },
    sectionTitleContainer: {
        marginBottom: 20,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#8B4513',
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noOrdersContainer: {
        padding: 20,
        alignItems: 'center',
    },
    noOrdersText: {
        fontSize: 16,
        color: '#666',
    },
    activeOrderCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    activeOrderContent: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    orderImageContainer: {
        marginRight: 12,
    },
    orderImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    orderDetails: {
        flex: 1,
    },
    shopName: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#8B4513',
    },
    orderId: {
        fontSize: 14,
        color: '#555',
        marginBottom: 4,
    },
    customerName: {
        fontSize: 14,
        color: '#555',
        marginBottom: 2,
    },
    deliveryLocation: {
        fontSize: 14,
        color: '#555',
        marginBottom: 2,
    },
    paymentMethod: {
        fontSize: 14,
        color: '#555',
        marginBottom: 2,
    },
    changeFor: {
        fontSize: 14,
        color: '#555',
        marginBottom: 2,
    },
    orderNote: {
        fontSize: 14,
        color: '#555',
        marginBottom: 2,
    },
    orderSummary: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
        paddingTop: 8,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    summaryItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    summaryItemQty: {
        fontSize: 14,
        marginRight: 8,
    },
    summaryItemName: {
        flex: 1,
        fontSize: 14,
    },
    summaryItemPrice: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    summaryTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 4,
    },
    summaryTotalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    summaryTotalValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statusButtonContainer: {
        marginTop: 12,
        alignItems: 'center',
    },
    statusLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    statusButton: {
        backgroundColor: '#e74c3c',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 8,
    },
    statusButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    navigationButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 8,
    },
    navigationButtonText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 14,
    },
    mapContainer: {
        marginTop: 15,
        marginBottom: 5,
        width: "100%",
    },
    mapTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
        color: "#BC4A4D",
    },
    pastOrdersList: {},
    pastOrderCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    pastOrderContent: {
        flexDirection: 'row',
        flex: 1,
        alignItems: 'center'
    },
    pastOrderImageContainer: {
        marginRight: 12,
    },
    pastOrderImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    pastOrderDetails: {
        flex: 1,
    },
    pastShopName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#8B4513',
    },
    pastOrderStatus: {
        fontSize: 14,
        color: '#555',
        marginBottom: 4,
    },
    pastOrderId: {
        fontSize: 14,
        color: '#555',
        marginBottom: 4,
    },
     pastOrderPayment: {
        fontSize: 14,
        color: '#555',
     },
     pastOrderTotalContainer: {
        alignItems: 'flex-end',
     },
     pastOrderTotal: {
        fontSize: 16,
        fontWeight: 'bold',
     },
    cancelButton: {
        backgroundColor: '#FF0000',
        marginTop: 8,
    },
});