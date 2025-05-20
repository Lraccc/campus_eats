import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, Image, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios'; // Use the mobile app's axios
import { API_URL, AUTH_TOKEN_KEY } from '../../config';
import BottomNavigation from '../../components/BottomNavigation';

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
    uid: string; // Assuming uid is present
}

interface Shop {
    id: string;
    name: string;
    address: string;
    imageUrl: string;
    deliveryFee: number;
}

export default function DasherOrders() {
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    const [pastOrders, setPastOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>('');
    const [currentStatus, setCurrentStatus] = useState(''); // State for active order status

    useEffect(() => {
        // Get user ID from AsyncStorage
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
    }, []); // Run only once on mount to get user ID

    useEffect(() => {
        const fetchOrders = async () => {
            if (!userId) return; // Only fetch if userId is available

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

                    // Process active order
                    const activeOrderData = activeOrders.length > 0 ? activeOrders[0] : null;
                    setActiveOrder(activeOrderData);

                    // Process past orders
                    const pastOrdersWithShopData = await Promise.all(
                        historicalOrders.map(async (order: Order) => {
                            try {
                                const shopDataResponse = await axios.get(`${API_URL}/api/shops/${order.shopId}`, {
                                    headers: { 'Authorization': token }
                                });
                                return { ...order, shopData: shopDataResponse.data };
                            } catch (error) {
                                console.error('Error fetching shop data for past order:', error);
                                return order; // Return order even if shop data fetch fails
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

        fetchOrders();
    }, [userId]); // Rerun when userId changes

    // Effect to update currentStatus when activeOrder changes
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

    // Function to format past order status
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
            return `Status: ${status}`; // Fallback for other statuses
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
            // Optionally refetch active order to update UI
            // fetchOrders(); // Would need to make fetchOrders accessible or call separately
        } catch (error) {
            console.error('Error updating order status:', error);
            // Handle error, maybe show an alert
        }
    };

    const handleStatusChange = (newStatus: string) => {
        if (!activeOrder) return;

        console.log('Attempting status change to:', newStatus);
        console.log('Current status:', currentStatus);

        // Determine the next status based on the current status
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
             nextStatus = 'delivered';
         } else if (currentStatus === 'delivered' && newStatus === 'completed') {
             nextStatus = 'completed';
         }

         if (nextStatus) {
             // If completing the order, handle modal (placeholder)
             if (nextStatus === 'completed') {
                 console.log('Handle completed status - needs modal');
                 // setIsModalOpen(true); // Placeholder for modal
             } else {
                 setCurrentStatus(nextStatus);
                 updateOrderStatus(nextStatus);
             }
         } else {
            console.log('Invalid status transition from', currentStatus, 'with attempted new status', newStatus);
            // Optionally show an alert for invalid transition
        }
    };

    // Determine button text and next status based on current status
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
                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>Active Order</Text>
                </View>

                {loading ? (
                     <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#BC4A4D" />
                    </View>
                ) : activeOrder ? (
                    <View style={styles.activeOrderCard}>
                        {/* Render Active Order Details */}
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
                        {/* Add more active order details based on web code */}
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
                         {/* Status Update Button */}
                        <View style={styles.statusButtonContainer}>
                            <Text style={styles.statusLabel}>Current Status: {activeOrder.status}</Text>
                            {buttonProps.nextStatus && ( // Only display button if a next status is defined
                                 <TouchableOpacity
                                     style={/* Add your button style */ styles.statusButton}
                                     onPress={() => handleStatusChange(buttonProps.nextStatus)}
                                 >
                                     <Text style={/* Add your button text style */ styles.statusButtonText}>{buttonProps.text}</Text>
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
                                {/* Render Past Order Details */}
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

            </ScrollView>
            <BottomNavigation activeTab="Orders" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollView: {
        padding: 16,
        paddingBottom: 80, // To prevent content from being hidden by bottom navigation
    },
    sectionTitleContainer: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
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
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
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
     // Add style for the single status button
     statusButton: {
        backgroundColor: '#BC4A4D', // Example background color
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 8,
     },
      statusButtonText: {
        color: 'white', // Example text color
        fontSize: 16,
        fontWeight: 'bold',
      },
    pastOrdersList: {},
    pastOrderCard: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
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
});