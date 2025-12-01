import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from "expo-router";
import { styled } from "nativewind";
import React, { useEffect, useState, useRef } from "react";
import { ActivityIndicator, Image, SafeAreaView, ScrollView, Text, TouchableOpacity, View, Animated, RefreshControl, Dimensions } from "react-native";
import BottomNavigation from '../../components/BottomNavigation';
import DeliveryMap from "../../components/Map/DeliveryMap";
import { API_URL, AUTH_TOKEN_KEY } from '../../config';
import DasherCompletedModal from './components/DasherCompletedModal';
import DasherDisputeModal from './components/DasherDisputeModal';
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
    customerNoShowProofImage?: string;
    customerNoShowGcashQr?: string;
    deliveryProofImage?: string;
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
    const [refreshing, setRefreshing] = useState(false);
    const [disputeModalVisible, setDisputeModalVisible] = useState(false);
    const [selectedDisputeOrder, setSelectedDisputeOrder] = useState<Order | null>(null);

    // Animation values for loading state
    const spinValue = useRef(new Animated.Value(0)).current;
    const circleValue = useRef(new Animated.Value(0)).current;

    // WebSocket references for real-time order updates
    const stompClientRef = useRef<Client | null>(null);
    const isConnectedRef = useRef<boolean>(false);
    const currentOrderIdRef = useRef<string | null>(null);
    const isMountedRef = useRef(true);
    const activeOrderRef = useRef<Order | null>(null);

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
                // Sort past orders by createdAt date in descending order (latest first)
                const sortedPastOrders = pastOrdersWithShopData.sort((a, b) => {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
                setPastOrders(sortedPastOrders);
            }
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchOrders();
        setRefreshing(false);
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

    // Update active order ref whenever it changes
    useEffect(() => {
        activeOrderRef.current = activeOrder;
    }, [activeOrder]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            disconnectWebSocket();
        };
    }, []);

    useEffect(() => {
        if (activeOrder && activeOrder.status) {
            let adjustedStatus;
            
            // Handle special status mappings
            if (activeOrder.status === "active_waiting_for_confirmation") {
                adjustedStatus = "delivered";
            } 
            // If order is in shop confirmation stages, dasher should start from toShop
            else if (["active_waiting_for_shop", "active_shop_confirmed"].includes(activeOrder.status)) {
                adjustedStatus = "toShop";
            }
            // If dasher has arrived at shop and waiting for order to be prepared or ready for pickup
            else if (["active_preparing", "active_ready_for_pickup", "active_dasher_arrived"].includes(activeOrder.status)) {
                adjustedStatus = "preparing";
            }
            // For active_toShop status, keep it as toShop
            else if (activeOrder.status === "active_toShop") {
                adjustedStatus = "toShop";
            }
            // For all other active statuses, remove the "active_" prefix
            else {
                adjustedStatus = activeOrder.status.replace("active_", "");
            }
            
            setCurrentStatus(adjustedStatus);
        }
    }, [activeOrder]);

    // WebSocket connection management
    useEffect(() => {
        // Disconnect previous connection
        disconnectWebSocket();
        
        // Connect to WebSocket for active order
        if (activeOrder && activeOrder.id) {
            currentOrderIdRef.current = activeOrder.id;
            connectWebSocket(activeOrder.id);
        }
        
        return () => {
            disconnectWebSocket();
        };
    }, [activeOrder?.id]);

    const formatPastOrderStatus = (status: string, createdAt: string) => {
        if (status === 'active_waiting_for_no_show_confirmation') {
            return 'Disputed: Customer reported no-show - Under Review';
        } else if (status === 'no-show-resolved' || status === 'no_show_resolved') {
            return 'Dispute Resolved';
        } else if (status === 'no-show' || status === 'no_show') {
            return 'No-Show: Customer did not appear';
        } else if (status === 'dasher-no-show') {
            return 'Confirmed No-Show: Refund Processed';
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
        console.log('Backend status:', activeOrder.status);

        let nextStatus: string | null = null;
        let backendStatus: string | null = null;
        
        // Handle status transitions
        if (currentStatus === '' && newStatus === 'toShop') {
            nextStatus = 'toShop';
            backendStatus = 'toShop';
        } else if (currentStatus === 'toShop' && newStatus === 'preparing') {
            nextStatus = 'preparing';
            // Use 'dasher_arrived' status to indicate dasher is waiting for shop to prepare
            backendStatus = 'dasher_arrived';
        } else if (currentStatus === 'preparing' && newStatus === 'pickedUp') {
            nextStatus = 'pickedUp';
            backendStatus = 'pickedUp';
        } else if (currentStatus === 'pickedUp' && newStatus === 'onTheWay') {
            nextStatus = 'onTheWay';
            backendStatus = 'onTheWay';
        } else if (currentStatus === 'onTheWay' && newStatus === 'delivered') {
            setIsCompletionModalOpen(true);
            return;
        }

        if (nextStatus && backendStatus) {
            setCurrentStatus(nextStatus);
            updateOrderStatus(backendStatus);
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
                return { text: 'Arrived at Shop', nextStatus: 'preparing', icon: 'location-outline' };
            case 'preparing':
                return { text: 'Picked Up Order', nextStatus: 'pickedUp', icon: 'bag-check-outline' };
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
            'bag-check-outline': 'bag-check-outline', // Note: This might not exist in Ionicons; fallback to another
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

    // WebSocket connection function
    const connectWebSocket = async (orderId: string) => {
        try {
            disconnectWebSocket();
            
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) {
                console.log('❌ No token available for WebSocket connection');
                return;
            }

            console.log('🔌 Connecting WebSocket for order:', orderId);

            const wsUrl = API_URL + '/ws';
            const socket = new SockJS(wsUrl);
            
            const stompClient = new Client({
                webSocketFactory: () => socket,
                connectHeaders: {
                    Authorization: token
                },
                debug: (str) => {
                    console.log('WebSocket Debug:', str);
                },
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                onConnect: (frame) => {
                    console.log('✅ Dasher WebSocket connected for order:', orderId);
                    isConnectedRef.current = true;

                    // Subscribe to order-specific updates
                    stompClient.subscribe(`/topic/orders/${orderId}`, (message) => {
                        try {
                            const orderUpdate = JSON.parse(message.body);
                            console.log('📦 Order update received:', orderUpdate);
                            handleOrderUpdate(orderUpdate);
                        } catch (error) {
                            console.error('❌ Error parsing order update:', error);
                        }
                    });

                    console.log('✅ Subscribed to order updates for:', orderId);
                },
                onDisconnect: () => {
                    console.log('📡 Dasher WebSocket disconnected');
                    isConnectedRef.current = false;
                },
                onStompError: (frame) => {
                    console.error('❌ Dasher STOMP error:', frame);
                    isConnectedRef.current = false;
                },
                onWebSocketClose: (evt) => {
                    console.log('📡 WebSocket closed:', evt);
                    isConnectedRef.current = false;
                },
                onWebSocketError: (evt) => {
                    console.error('❌ WebSocket error:', evt);
                }
            });

            stompClientRef.current = stompClient;
            
            try {
                stompClient.activate();
            } catch (activationError) {
                console.error('❌ Error activating STOMP client:', activationError);
            }
            
        } catch (error) {
            console.error('❌ Error connecting to WebSocket:', error);
            isConnectedRef.current = false;
        }
    };

    // Disconnect WebSocket
    const disconnectWebSocket = () => {
        if (stompClientRef.current) {
            try {
                stompClientRef.current.deactivate();
                console.log('🔌 WebSocket disconnected');
            } catch (error) {
                console.error('❌ Error disconnecting WebSocket:', error);
            }
            stompClientRef.current = null;
        }
        
        isConnectedRef.current = false;
        currentOrderIdRef.current = null;
    };

    // Handle order updates from WebSocket
    const handleOrderUpdate = (orderUpdate: any) => {
        if (!isMountedRef.current) return;
        
        const newStatus = orderUpdate.status;
        const orderId = orderUpdate.orderId || orderUpdate.id; // Backend sends 'orderId'
        
        console.log('🔄 Processing order update:', { orderId, newStatus });
        
        // Update active order with new status
        if (activeOrderRef.current && orderId === activeOrderRef.current.id) {
            console.log('✅ Updating active order status to:', newStatus);
            
            setActiveOrder(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    status: newStatus
                };
            });
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#DFD6C5' }}>
            <ScrollView 
                style={{ flex: 1, backgroundColor: '#DFD6C5' }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#BC4A4D"
                        colors={['#BC4A4D']}
                    />
                }
            >
                <View style={{ flex: 1, paddingBottom: 80 }}>
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
                        <>
                            {/* Delivery Map at Top (45% height) - Only show when dasher is assigned */}
                            {activeOrder?.dasherId && (
                                <View style={{ height: Dimensions.get('window').height * 0.45 }}>
                                    <DeliveryMap
                                        orderId={activeOrder.id}
                                        userType="dasher"
                                        height={Dimensions.get('window').height * 0.45}
                                        currentUserId={""}
                                    />
                                </View>
                            )}

                            {/* Scrollable Order Details Section */}
                            <View style={{ flex: 1 }}>
                                <ScrollView
                                    style={{ flex: 1 }}
                                    showsVerticalScrollIndicator={false}
                                >
                                <View style={{
                                    paddingHorizontal: 16,
                                    paddingTop: 12,
                                    paddingBottom: 12,
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    borderWidth: 2,
                                    borderColor: '#BC4A4D',
                                    margin: 8,
                                    borderRadius: 16,
                                    shadowColor: '#8B4513',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 8,
                                    elevation: 5,
                                }}>
                                {/* Action Buttons - Inside Container */}
                                <View style={{ marginBottom: 12 }}>
                                    {/* Pick Up Order Button - Only shown when dasher is at shop waiting for order */}
                                    {currentStatus === 'preparing' && (
                                        <TouchableOpacity
                                            style={{ 
                                                backgroundColor: activeOrder.status === 'active_ready_for_pickup' ? '#10B981' : '#D1D5DB',
                                                paddingVertical: 14, 
                                                paddingHorizontal: 24, 
                                                borderRadius: 12, 
                                                flexDirection: 'row', 
                                                justifyContent: 'center', 
                                                alignItems: 'center', 
                                                marginBottom: 8,
                                                opacity: activeOrder.status === 'active_ready_for_pickup' ? 1 : 0.6,
                                                shadowColor: activeOrder.status === 'active_ready_for_pickup' ? '#10B981' : '#D1D5DB',
                                                shadowOffset: { width: 0, height: 3 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 5,
                                                elevation: 4,
                                            }}
                                            onPress={() => {
                                                if (activeOrder.status === 'active_ready_for_pickup') {
                                                    handleStatusChange('pickedUp');
                                                }
                                            }}
                                            disabled={activeOrder.status !== 'active_ready_for_pickup'}
                                        >
                                            <Ionicons 
                                                name="bag-check-outline" 
                                                size={18} 
                                                color="white" 
                                                style={{ marginRight: 8 }} 
                                            />
                                            <Text style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>
                                                {activeOrder.status === 'active_ready_for_pickup' 
                                                    ? 'Pick Up Order' 
                                                    : 'Waiting for Shop to Prepare...'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {/* Other action buttons for different stages */}
                                    {buttonProps.nextStatus && currentStatus !== 'preparing' && (
                                        <TouchableOpacity
                                            style={{ 
                                                backgroundColor: '#BC4A4D', 
                                                paddingVertical: 14, 
                                                paddingHorizontal: 24, 
                                                borderRadius: 12, 
                                                flexDirection: 'row', 
                                                justifyContent: 'center', 
                                                alignItems: 'center', 
                                                marginBottom: 8,
                                                shadowColor: '#BC4A4D',
                                                shadowOffset: { width: 0, height: 3 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 5,
                                                elevation: 4,
                                            }}
                                            onPress={() => handleStatusChange(buttonProps.nextStatus)}
                                        >
                                            <Ionicons 
                                                name={getIconName(buttonProps.icon)} 
                                                size={18} 
                                                color="white" 
                                                style={{ marginRight: 8 }} 
                                            />
                                            <Text style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>
                                                {buttonProps.text}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {/* Navigation button */}
                                    {(currentStatus === '' || currentStatus === 'toShop') && (
                                        <TouchableOpacity
                                            style={{ 
                                                backgroundColor: '#BC4A4D',
                                                paddingVertical: 14, 
                                                paddingHorizontal: 24, 
                                                borderRadius: 12, 
                                                flexDirection: 'row', 
                                                justifyContent: 'center', 
                                                alignItems: 'center', 
                                                marginBottom: 8,
                                                shadowColor: '#BC4A4D',
                                                shadowOffset: { width: 0, height: 3 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 5,
                                                elevation: 4,
                                            }}
                                            onPress={() => {
                                                let address = encodeURIComponent(activeOrder.shopData?.address || "");
                                                router.push(`https://www.google.com/maps/dir/?api=1&destination=${address}`);
                                            }}
                                        >
                                            <Ionicons name="navigate-outline" size={20} color="white" style={{ marginRight: 8 }} />
                                            <Text style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>
                                                Navigate to Shop
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {/* Shop and Customer Info */}
                                <View style={{
                                    backgroundColor: '#FFF8DC',
                                    borderRadius: 12,
                                    padding: 12,
                                    marginBottom: 12,
                                    borderWidth: 1,
                                    borderColor: '#DAA520',
                                }}>
                                    <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                                        <Image
                                            source={activeOrder.shopData && activeOrder.shopData.imageUrl ? { uri: activeOrder.shopData.imageUrl } : require('../../assets/images/logo.png')}
                                            style={{ width: 64, height: 64, borderRadius: 12, marginRight: 12, borderWidth: 2, borderColor: '#DAA520' }}
                                            resizeMode="cover"
                                        />
                                        <View style={{ flex: 1, justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#8B4513', marginBottom: 4 }} numberOfLines={1}>{activeOrder.shopData?.name || 'Shop'}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons name="location-sharp" size={12} color="#BC4A4D" />
                                                <Text style={{ fontSize: 12, color: '#8B4513', marginLeft: 4, flex: 1 }} numberOfLines={1}>{activeOrder.shopData?.address || 'Loading...'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    
                                    <View style={{ height: 1, backgroundColor: 'rgba(218, 165, 32, 0.3)', marginVertical: 8 }} />
                                    
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <Ionicons name="person-circle" size={14} color="#DAA520" />
                                        <Text style={{ fontSize: 12, color: '#8B4513', marginLeft: 8, fontWeight: '600' }}>Customer: </Text>
                                        <Text style={{ fontSize: 12, color: '#BC4A4D', fontWeight: 'bold', flex: 1 }} numberOfLines={1}>
                                            {`${activeOrder.firstname} ${activeOrder.lastname || ''}`}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <Ionicons name="call" size={14} color="#DAA520" />
                                        <Text style={{ fontSize: 12, color: '#BC4A4D', marginLeft: 8, fontWeight: '600' }}>{activeOrder.mobileNum}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="receipt" size={10} color="#DAA520" />
                                        <Text style={{ fontSize: 11, color: '#8B4513', marginLeft: 8 }}>Order #{activeOrder.id.slice(0, 8)}</Text>
                                    </View>
                                </View>

                            {/* Delivery Progress */}
                            <View style={{
                                backgroundColor: '#BC4A4D',
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 12,
                                shadowColor: '#BC4A4D',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 4,
                                elevation: 3,
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="information-circle" size={16} color="#FFFFFF" />
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFFFFF', marginLeft: 8 }}>Delivery Progress</Text>
                                    </View>
                                    <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}>{statusStepNumber}/5 Steps</Text>
                                </View>
                                <View style={{ height: 6, backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                                    <View style={{ height: '100%', width: `${progressPercentage}%`, backgroundColor: '#DAA520', borderRadius: 3 }} />
                                </View>
                                <Text style={{ fontSize: 12, color: '#FFFFFF', textAlign: 'center', fontWeight: '600' }}>
                                    {currentStatus === '' ? 'Ready to start' :
                                        currentStatus === 'toShop' ? 'Heading to shop' :
                                            currentStatus === 'preparing' ? 'Waiting for order' :
                                                currentStatus === 'pickedUp' ? 'Order picked up' :
                                                    currentStatus === 'onTheWay' ? 'On the way to customer' :
                                                        currentStatus === 'delivered' ? 'Order delivered' : 'Processing'}
                                </Text>
                            </View>

                            {/* Delivery Details */}
                            <View style={{
                                backgroundColor: '#F5F5DC',
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 12,
                                borderWidth: 1,
                                borderColor: '#8B4513',
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="navigate-circle" size={16} color="#BC4A4D" />
                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#8B4513', marginLeft: 8 }}>Delivery Details</Text>
                                </View>
                                <Text style={{ fontSize: 12, color: '#BC4A4D', fontWeight: '600', marginBottom: 8 }} numberOfLines={2}>{activeOrder.deliverTo}</Text>
                                
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                                        <Ionicons name="card" size={10} color="#DAA520" />
                                        <Text style={{ fontSize: 12, color: '#BC4A4D', marginLeft: 4, fontWeight: '600' }}>
                                          {activeOrder.paymentMethod && activeOrder.paymentMethod.toLowerCase() === 'gcash' ? 'GCash' : 'Cash'}
                                        </Text>
                                    </View>
                                    {!!activeOrder.changeFor && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                                            <Ionicons name="cash" size={10} color="#DAA520" />
                                            <Text style={{ fontSize: 12, color: '#BC4A4D', marginLeft: 4, fontWeight: '600' }}>Change: ₱{activeOrder.changeFor}</Text>
                                        </View>
                                    )}
                                </View>

                                {!!activeOrder.note && (
                                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(139, 69, 19, 0.2)' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                            <Ionicons name="document-text" size={12} color="#DAA520" style={{ marginTop: 2 }} />
                                            <View style={{ flex: 1, marginLeft: 6 }}>
                                                <Text style={{ fontSize: 11, color: '#8B4513', fontWeight: '600', marginBottom: 2 }}>Note:</Text>
                                                <Text style={{ fontSize: 12, color: '#BC4A4D' }}>{activeOrder.note}</Text>
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Order Summary */}
                            <View style={{
                                backgroundColor: 'white',
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 8,
                                borderWidth: 1,
                                borderColor: '#DAA520',
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="cart" size={16} color="#BC4A4D" />
                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#8B4513', marginLeft: 8 }}>Order Items ({activeOrder.items.length})</Text>
                                </View>
                                
                                {activeOrder.items.slice(0, 2).map((item, index) => (
                                    <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, backgroundColor: 'rgba(255, 248, 220, 0.5)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                            <View style={{ backgroundColor: '#DAA520', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 }}>
                                                <Text style={{ fontSize: 12, color: 'white', fontWeight: 'bold' }}>{item.quantity}x</Text>
                                            </View>
                                            <Text style={{ fontSize: 12, color: '#8B4513', fontWeight: '500', flex: 1 }} numberOfLines={1}>{item.name}</Text>
                                        </View>
                                        <Text style={{ fontSize: 12, color: '#BC4A4D', fontWeight: 'bold' }}>₱{item.price.toFixed(2)}</Text>
                                    </View>
                                ))}
                                {activeOrder.items.length > 2 && (
                                    <Text style={{ fontSize: 11, color: 'rgba(139, 69, 19, 0.7)', textAlign: 'center', fontStyle: 'italic', paddingVertical: 4 }}>
                                        +{activeOrder.items.length - 2} more items
                                    </Text>
                                )}
                                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: 'rgba(218, 165, 32, 0.3)' }}>
                                    {((activeOrder.previousNoShowItems ?? 0) > 0 || (activeOrder.previousNoShowFee ?? 0) > 0) && (
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <Text style={{ fontSize: 12, color: '#BC4A4D', fontWeight: '600' }}>Previous Charges</Text>
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#BC4A4D' }}>₱{((activeOrder.previousNoShowItems ?? 0) + (activeOrder.previousNoShowFee ?? 0)).toFixed(2)}</Text>
                                        </View>
                                    )}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="bicycle" size={12} color="#8B4513" />
                                            <Text style={{ fontSize: 12, color: '#8B4513', marginLeft: 4, fontWeight: '600' }}>Delivery Fee</Text>
                                        </View>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#8B4513' }}>₱{activeOrder.shopData?.deliveryFee?.toFixed(2) || '0.00'}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(218, 165, 32, 0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DAA520' }}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#8B4513' }}>Total Amount</Text>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#BC4A4D' }}>₱{(activeOrder.totalPrice + (activeOrder.shopData?.deliveryFee || 0) + (activeOrder.previousNoShowItems ?? 0) + (activeOrder.previousNoShowFee ?? 0)).toFixed(2)}</Text>
                                    </View>
                                </View>
                            </View>
                                </View>
                                </ScrollView>
                            </View>
                        </>
                    ) : (
                        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                            <Ionicons name="bicycle" size={60} color="#BC4A4D" />
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#8B4513', marginTop: 16 }}>No Active Orders</Text>
                            <Text style={{ fontSize: 14, color: '#8B4513', textAlign: 'center', marginTop: 8 }}>You don't have any active deliveries at the moment.</Text>
                        </View>
                    )}

                    {/* Past Orders Section */}
                    <View style={{ padding: 16, paddingTop: 8 }}>
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#BC4A4D', textAlign: 'center' }}>Past Orders</Text>
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
                                    
                                    {/* View Dispute Button for disputed orders */}
                                    {order.status === 'active_waiting_for_no_show_confirmation' && (
                                        <TouchableOpacity
                                            style={{
                                                marginTop: 12,
                                                backgroundColor: '#FEF3C7',
                                                borderWidth: 1,
                                                borderColor: '#F59E0B',
                                                borderRadius: 8,
                                                padding: 12,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                            onPress={() => {
                                                setSelectedDisputeOrder(order);
                                                setDisputeModalVisible(true);
                                            }}
                                        >
                                            <Ionicons name="warning" size={18} color="#F59E0B" />
                                            <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#92400E' }}>
                                                View Dispute & Submit Proof
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}
                    </View>
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
            
            {selectedDisputeOrder && (
                <DasherDisputeModal
                    visible={disputeModalVisible}
                    onClose={() => {
                        setDisputeModalVisible(false);
                        setSelectedDisputeOrder(null);
                    }}
                    order={selectedDisputeOrder}
                    dasherId={userId}
                    onSuccess={() => {
                        // Refresh orders after successful submission
                        fetchOrders();
                    }}
                />
            )}
        </SafeAreaView>
    );
}