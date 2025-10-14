import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from "expo-router";
import { styled } from "nativewind";
import React, { useEffect, useState, useRef } from "react";
import { ActivityIndicator, Image, SafeAreaView, ScrollView, Text, TouchableOpacity, View, Animated } from "react-native";
import BottomNavigation from '../../components/BottomNavigation';
import DeliveryMap from "../../components/Map/DeliveryMap";
import { API_URL, AUTH_TOKEN_KEY } from '../../config';
import DasherCompletedModal from './components/DasherCompletedModal';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// Create styled components
const StyledView = styled(View);
const StyledText = styled(Text);

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
    previousNoShowFee?: number;
    previousNoShowItems?: number;
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

    // Animation values for loading state
    const spinValue = useRef(new Animated.Value(0)).current;
    const circleValue = useRef(new Animated.Value(0)).current;

    // WebSocket refs for real-time order updates
    const stompClientRef = useRef<Client | null>(null);
    const isConnectedRef = useRef<boolean>(false);
    const isMountedRef = useRef(true);

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

    // Animation setup for loading state
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
            
            console.log(`🔄 Dasher status update: ${activeOrder.status} -> ${adjustedStatus}`);
            setCurrentStatus(adjustedStatus);
        }
    }, [activeOrder]);

    // WebSocket connection for real-time order status updates
    useEffect(() => {
        const connectWebSocket = async () => {
            // Only connect if we have an active order
            if (!activeOrder || !userId) {
                return;
            }

            // Don't reconnect if already connected
            if (isConnectedRef.current && stompClientRef.current) {
                console.log('✅ WebSocket already connected');
                return;
            }

            try {
                const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
                if (!token) {
                    console.log('❌ No token for WebSocket');
                    return;
                }

                console.log(`🔗 Connecting WebSocket for order: ${activeOrder.id}`);
                
                const wsUrl = API_URL + '/ws';
                const socket = new SockJS(wsUrl);

                const client = new Client({
                    webSocketFactory: () => socket,
                    connectHeaders: {
                        'Authorization': token
                    },
                    debug: (str) => {
                        if (str.includes('connected') || str.includes('error') || str.includes('disconnect')) {
                            console.log('🔧 STOMP:', str);
                        }
                    },
                    reconnectDelay: 5000,
                    heartbeatIncoming: 4000,
                    heartbeatOutgoing: 4000,
                    onConnect: () => {
                        console.log(`✅ WebSocket connected for order: ${activeOrder.id}`);
                        isConnectedRef.current = true;

                        // Subscribe to order-specific updates
                        if (client && activeOrder?.id) {
                            client.subscribe(`/topic/orders/${activeOrder.id}`, (message) => {
                                if (!isMountedRef.current) return;
                                
                                try {
                                    const orderUpdate = JSON.parse(message.body);
                                    console.log(`� Order status update received: ${orderUpdate.status}`);
                                    
                                    // Update only the status without full refresh
                                    if (orderUpdate.status && orderUpdate.status !== activeOrder.status) {
                                        console.log(`✅ Updating status: ${activeOrder.status} -> ${orderUpdate.status}`);
                                        setActiveOrder(prev => prev ? { ...prev, status: orderUpdate.status } : null);
                                    }
                                } catch (error) {
                                    console.error('❌ Error parsing order update:', error);
                                }
                            });

                            console.log(`🎯 Subscribed to /topic/orders/${activeOrder.id}`);
                        }
                    },
                    onDisconnect: () => {
                        console.log('� WebSocket disconnected');
                        isConnectedRef.current = false;
                    },
                    onStompError: (frame) => {
                        console.error('❌ STOMP error:', frame.headers?.['message']);
                        isConnectedRef.current = false;
                    },
                });

                stompClientRef.current = client;
                client.activate();

            } catch (error) {
                console.error('❌ WebSocket connection error:', error);
            }
        };

        connectWebSocket();

        // Cleanup on unmount or when order changes
        return () => {
            if (stompClientRef.current && isConnectedRef.current) {
                console.log('🛑 Disconnecting WebSocket');
                stompClientRef.current.deactivate();
                isConnectedRef.current = false;
            }
        };
    }, [activeOrder?.id, userId]);

    // Set isMounted flag
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

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
        
        // Allow starting trip from empty, toShop, preparing, or ready_for_pickup states
        if ((currentStatus === '' || currentStatus === 'preparing' || currentStatus === 'ready_for_pickup') && newStatus === 'toShop') {
            // If shop is already preparing/ready, go straight to toShop (dasher heading to shop)
            nextStatus = 'toShop';
        } else if (currentStatus === 'toShop' && newStatus === 'toShop') {
            // Allow re-clicking if already at shop
            nextStatus = 'toShop';
        } else if ((currentStatus === 'preparing' || currentStatus === 'ready_for_pickup') && newStatus === 'pickedUp') {
            // Dasher can pick up the order once shop marks it as ready
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
                return { text: 'Start Trip', nextStatus: 'toShop', icon: 'play-outline' };
            case 'toShop':
                return { text: 'Waiting at Shop...', nextStatus: null, icon: 'time-outline' };
            case 'preparing':
                // If order is already preparing when dasher accepts, allow them to start trip to shop
                // Once they click this and update to toShop, they'll wait at shop
                return { text: 'Start Trip to Shop', nextStatus: 'toShop', icon: 'bicycle-outline' };
            case 'ready_for_pickup':
                // Food is ready! Dasher can either start trip (if not started yet) or pick up (if already there)
                return { text: 'Pick Up Order', nextStatus: 'pickedUp', icon: 'bag-check-outline' };
            case 'pickedUp':
                return { text: 'On the Way', nextStatus: 'onTheWay', icon: 'bicycle-outline' };
            case 'onTheWay':
                return { text: 'Delivered Order', nextStatus: 'delivered', icon: 'checkmark-circle-outline' };
            case 'delivered':
                return { text: 'Complete Order', nextStatus: 'completed', icon: 'flag-outline' };
            default:
                return { text: 'N/A', nextStatus: null, icon: 'help-circle-outline' };
        }
    };

    // Helper function to get the correct Ionicons name
    const getIconName = (iconKey: string) => {
        // Create a mapping of your custom keys to valid Ionicons names
        const iconMap: Record<string, any> = {
            'play-outline': 'play-outline',
            'location-outline': 'location-outline',
            'time-outline': 'time-outline',
            'bag-check-outline': 'bag-check-outline',
            'bicycle-outline': 'bicycle-outline',
            'checkmark-circle-outline': 'checkmark-circle-outline',
            'flag-outline': 'flag-outline',
            'help-circle-outline': 'help-circle-outline',
            'navigate': 'navigate-outline',
            'close-circle': 'close-circle-outline'
        };

        // Return the mapped icon name or a default one if not found
        return iconMap[iconKey] || 'help-circle-outline';
    };

    const buttonProps = getButtonProps();

    const getStatusStepNumber = () => {
        switch (currentStatus) {
            case '':
                return 0;
            case 'toShop':
                return 1;
            case 'preparing':
                return 2;
            case 'ready_for_pickup':
                return 2.5; // Between preparing and picked up
            case 'pickedUp':
                return 3;
            case 'onTheWay':
                return 4;
            case 'delivered':
                return 5;
            default:
                return 0;
        }
    };

    const statusStepNumber = getStatusStepNumber();
    const totalSteps = 5;
    const progressPercentage = (statusStepNumber / totalSteps) * 100;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#DFD6C5' }}>
            <ScrollView style={{ flex: 1, backgroundColor: '#DFD6C5' }}>
                <View style={{ padding: 16, paddingTop: 24, paddingBottom: 80, flex: 1 }}>
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#8B4513', textAlign: 'left' }}>Active Order</Text>
                    </View>

                    {loading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                            <View style={{ alignItems: 'center' }}>
                                {/* Spinning Logo Container */}
                                <View style={{ position: 'relative', marginBottom: 24 }}>
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
                                    <View style={{ 
                                        width: 64, 
                                        height: 64, 
                                        borderRadius: 32, 
                                        backgroundColor: 'rgba(188, 74, 77, 0.1)', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        marginHorizontal: 8, 
                                        marginVertical: 8 
                                    }}>
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
                                    </View>
                                </View>
                                
                                {/* Brand Name */}
                                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                                    <Text style={{ color: '#BC4A4DFF' }}>Campus</Text>
                                    <Text style={{ color: '#DAA520' }}>Eats</Text>
                                </Text>
                                
                                {/* Loading Text */}
                                <Text style={{ color: '#BC4A4D', fontSize: 16, fontWeight: '600' }}>
                                    Loading...
                                </Text>
                            </View>
                        </View>
                    ) : activeOrder ? (
                        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                            {/* Order Header */}
                            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                                <Image
                                    source={activeOrder.shopData && activeOrder.shopData.imageUrl ? { uri: activeOrder.shopData.imageUrl } : require('../../assets/images/logo.png')}
                                    style={{ width: 80, height: 80, borderRadius: 12, marginRight: 16 }}
                                    resizeMode="cover"
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4, color: '#BC4A4D' }}>{activeOrder.shopData?.name || 'Shop'}</Text>
                                    <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Order #{activeOrder.id}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                        <Ionicons name="person" size={14} color="#BC4A4D" style={{ marginRight: 4 }} />
                                        <Text style={{ fontSize: 14, color: '#333' }}>{`${activeOrder.firstname} ${activeOrder.lastname || ''}`}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="call" size={14} color="#BC4A4D" style={{ marginRight: 4 }} />
                                        <Text style={{ fontSize: 14, color: '#333' }}>{activeOrder.mobileNum}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Delivery Progress */}
                            <View style={{ marginBottom: 20 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#8B4513' }}>Delivery Progress</Text>
                                    <Text style={{ fontSize: 14, color: '#BC4A4D', fontWeight: '500' }}>{statusStepNumber}/5 Steps</Text>
                                </View>
                                <View style={{ height: 8, backgroundColor: '#F0EBE4', borderRadius: 4, overflow: 'hidden' }}>
                                    <View style={{ height: '100%', width: `${progressPercentage}%`, backgroundColor: '#BC4A4D', borderRadius: 4 }} />
                                </View>
                                <Text style={{ fontSize: 14, color: '#8B4513', marginTop: 8, textAlign: 'center' }}>
                                    {currentStatus === '' ? 'Ready to start' :
                                        currentStatus === 'toShop' ? 'Heading to shop' :
                                            currentStatus === 'preparing' ? 'Waiting for order' :
                                                currentStatus === 'pickedUp' ? 'Order picked up' :
                                                    currentStatus === 'onTheWay' ? 'On the way to customer' :
                                                        currentStatus === 'delivered' ? 'Order delivered' : 'Processing'}
                                </Text>
                            </View>

                            {/* Delivery Details */}
                            <View style={{ backgroundColor: '#F9F6F2', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#8B4513', marginBottom: 12 }}>Delivery Details</Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="location" size={18} color="#BC4A4D" style={{ width: 24 }} />
                                    <Text style={{ fontSize: 14, color: '#8B4513', width: 80 }}>Deliver To:</Text>
                                    <Text style={{ fontSize: 14, color: '#8B4513', flex: 1, fontWeight: '500' }}>{activeOrder.deliverTo}</Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="card" size={18} color="#BC4A4D" style={{ width: 24 }} />
                                    <Text style={{ fontSize: 14, color: '#8B4513', width: 80 }}>Payment:</Text>
                                    <Text style={{ fontSize: 14, color: '#8B4513', flex: 1, fontWeight: '500' }}>{activeOrder.paymentMethod}</Text>
                                </View>

                                {activeOrder.changeFor && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                        <Ionicons name="cash" size={18} color="#BC4A4D" style={{ width: 24 }} />
                                        <Text style={{ fontSize: 14, color: '#666', width: 80 }}>Change For:</Text>
                                        <Text style={{ fontSize: 14, color: '#333', flex: 1, fontWeight: '500' }}>₱{activeOrder.changeFor}</Text>
                                    </View>
                                )}

                                {activeOrder.note && (
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <Ionicons name="document-text" size={18} color="#BC4A4D" style={{ width: 24, marginTop: 2 }} />
                                        <Text style={{ fontSize: 14, color: '#666', width: 80 }}>Note:</Text>
                                        <Text style={{ fontSize: 14, color: '#333', flex: 1, fontWeight: '500' }}>{activeOrder.note}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Order Summary */}
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#8B4513', marginBottom: 12 }}>Order Summary</Text>

                                {activeOrder.items.map((item, index) => (
                                    <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', flex: 1 }}>
                                            <Text style={{ fontSize: 14, color: '#666', marginRight: 8, width: 24, textAlign: 'center' }}>{item.quantity}x</Text>
                                            <Text style={{ fontSize: 14, color: '#333', flex: 1 }}>{item.name}</Text>
                                        </View>
                                        <Text style={{ fontSize: 14, fontWeight: '500', color: '#8B4513' }}>₱{item.price.toFixed(2)}</Text>
                                    </View>
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

                                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text style={{ fontSize: 14, color: '#666' }}>Subtotal</Text>
                                        <Text style={{ fontSize: 14, color: '#333' }}>₱{activeOrder.totalPrice.toFixed(2)}</Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text style={{ fontSize: 14, color: '#666' }}>Delivery Fee</Text>
                                        <Text style={{ fontSize: 14, color: '#333' }}>₱{activeOrder.shopData?.deliveryFee?.toFixed(2) || '0.00'}</Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#BC4A4D' }}>Total</Text>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#BC4A4D' }}>₱{(activeOrder.totalPrice + (activeOrder.shopData?.deliveryFee || 0)).toFixed(2)}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Action Buttons */}
                            <View style={{ marginTop: 16 }}>
                                {buttonProps.nextStatus ? (
                                    <TouchableOpacity
                                        style={{ 
                                            backgroundColor: '#BC4A4D', 
                                            paddingVertical: 14, 
                                            paddingHorizontal: 20, 
                                            borderRadius: 12, 
                                            flexDirection: 'row', 
                                            justifyContent: 'center', 
                                            alignItems: 'center', 
                                            marginBottom: 12 
                                        }}
                                        onPress={() => handleStatusChange(buttonProps.nextStatus)}
                                    >
                                        <Ionicons 
                                            name={getIconName(buttonProps.icon)} 
                                            size={20} 
                                            color="white" 
                                            style={{ marginRight: 8 }} 
                                        />
                                        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                                            {buttonProps.text}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View
                                        style={{ 
                                            backgroundColor: '#D1D5DB', 
                                            paddingVertical: 14, 
                                            paddingHorizontal: 20, 
                                            borderRadius: 12, 
                                            flexDirection: 'row', 
                                            justifyContent: 'center', 
                                            alignItems: 'center', 
                                            marginBottom: 12 
                                        }}
                                    >
                                        <Ionicons 
                                            name={getIconName(buttonProps.icon)} 
                                            size={20} 
                                            color="#6B7280" 
                                            style={{ marginRight: 8 }} 
                                        />
                                        <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: 'bold' }}>
                                            {buttonProps.text}
                                        </Text>
                                    </View>
                                )}

                                {/* Show navigation button when dasher needs to go to shop */}
                                {(currentStatus === '' || currentStatus === 'toShop' || currentStatus === 'preparing' || currentStatus === 'ready_for_pickup') && (
                                    <TouchableOpacity
                                        style={{ 
                                            backgroundColor: '#BC4A4D',
                                            paddingVertical: 14, 
                                            paddingHorizontal: 20, 
                                            borderRadius: 12, 
                                            flexDirection: 'row', 
                                            justifyContent: 'center', 
                                            alignItems: 'center', 
                                            marginBottom: 12 
                                        }}
                                        onPress={() => {
                                            let address = encodeURIComponent(activeOrder.shopData?.address || "");
                                            router.push(`https://www.google.com/maps/dir/?api=1&destination=${address}`);
                                        }}
                                    >
                                        <Ionicons name="navigate-outline" size={20} color="white" style={{ marginRight: 8 }} />
                                        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                                            Navigate to Shop
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Delivery Map */}
                            <View style={{ marginTop: 24 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#8B4513', marginBottom: 12 }}>Live Delivery Tracking</Text>
                                <View style={{ borderRadius: 12, overflow: 'hidden' }}>
                                    <DeliveryMap
                                            orderId={activeOrder.id}
                                            userType="dasher"
                                            height={220} currentUserId={""}                                    />
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                            <Ionicons name="bicycle" size={60} color="#BC4A4D" />
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#8B4513', marginTop: 16 }}>No Active Orders</Text>
                            <Text style={{ fontSize: 14, color: '#8B4513', textAlign: 'center', marginTop: 8 }}>You don't have any active deliveries at the moment.</Text>
                        </View>
                    )}

                    {/* Past Orders Section */}
                    <View style={{ marginBottom: 24, marginTop: 8 }}>
                        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#BC4A4D', textAlign: 'center', marginBottom: 16 }}>Past Orders</Text>
                    </View>

                    {loading ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#BC4A4D" />
                        </View>
                    ) : pastOrders.length === 0 ? (
                        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                            <Ionicons name="document" size={40} color="#BC4A4D" />
                            <Text style={{ fontSize: 16, color: '#8B4513', marginTop: 12 }}>No past orders yet</Text>
                        </View>
                    ) : (
                        <View>
                            {pastOrders.map((order) => (
                                <View key={order.id} style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Image
                                            source={order.shopData && order.shopData.imageUrl ? { uri: order.shopData.imageUrl } : require('../../assets/images/logo.png')}
                                            style={{ width: 60, height: 60, borderRadius: 10, marginRight: 16 }}
                                            resizeMode="cover"
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#BC4A4D' }}>{order.shopData?.name || 'Shop'}</Text>
                                            <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{formatPastOrderStatus(order.status, order.createdAt)}</Text>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={{ fontSize: 13, color: '#666' }}>Order #{order.id.substring(0, 8)}...</Text>
                                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>₱{order.totalPrice.toFixed(2)}</Text>
                                            </View>
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
}