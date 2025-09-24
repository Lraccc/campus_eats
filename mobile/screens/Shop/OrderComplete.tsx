import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Image,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    Animated
} from 'react-native';
import { styled } from 'nativewind';
import { router } from 'expo-router';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import axios from 'axios';
import { API_URL } from '../../config';
import { MaterialIcons } from '@expo/vector-icons';
import BottomNavigation from '../../components/BottomNavigation';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface OrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

interface Order {
    id: string;
    firstname: string;
    lastname: string;
    shopId: string;
    shopData: any;
    items: OrderItem[];
    totalPrice: number;
    deliveryFee: number;
    status: string;
    paymentMethod: string;
    dasherId: string | null;
    createdAt: string;
}

export default function OrderComplete() {
    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
    const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
    const { getAccessToken } = useAuthentication();
    
    // Animation values
    const spinValue = useRef(new Animated.Value(0)).current;
    const circleValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Start animation when component mounts
        const spinAnimation = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: true,
            })
        );

        const circleAnimation = Animated.loop(
            Animated.timing(circleValue, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        );

        spinAnimation.start();
        circleAnimation.start();

        return () => {
            spinAnimation.stop();
            circleAnimation.stop();
        };
    }, []);

    useEffect(() => {
        fetchCompletedOrders();
    }, []);

    const fetchCompletedOrders = async () => {
        try {
            let token = await getAccessToken();
            if (!token) {
                token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            }

            if (!token) {
                console.error("No token available");
                return;
            }

            const config = { headers: { Authorization: token } };
            const userId = await AsyncStorage.getItem('userId');

            const response = await axios.get(`${API_URL}/api/orders/past-orders`, config);

            const ordersWithShopData = await Promise.all(response.data.map(async (order: any) => {
                const shopDataResponse = await axios.get(`${API_URL}/api/shops/${order.shopId}`, config);
                return { ...order, shopData: shopDataResponse.data };
            }));

            // Filter orders for the current shop
            const filteredOrders = ordersWithShopData.filter((order: Order) => order.shopId === userId);
            setCompletedOrders(filteredOrders);
        } catch (error) {
            console.error("Error fetching completed orders:", error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchCompletedOrders();
    }, []);

    const toggleOrderExpansion = (orderId: string) => {
        setExpandedOrderIds(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const renderOrderItems = (items: OrderItem[]) => {
        return items.map((item, index) => (
            <StyledView key={index} className="flex-row justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <StyledView className="flex-row items-center flex-1">
                    <StyledView className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-3">
                        <StyledText className="text-sm font-semibold text-gray-600">{item.quantity}</StyledText>
                    </StyledView>
                    <StyledText className="text-sm text-gray-800 flex-1">{item.name}</StyledText>
                </StyledView>
                <StyledText className="text-sm font-semibold text-gray-900">₱{item.price.toFixed(2)}</StyledText>
            </StyledView>
        ));
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (isLoading) {
        const spin = spinValue.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
        });

        const circleRotation = circleValue.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
        });

        return (
            <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
                <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
                <StyledView className="flex-1 justify-center items-center px-6">
                    <StyledView 
                        className="bg-white rounded-3xl p-8 items-center"
                        style={{
                            shadowColor: '#BC4A4D',
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.15,
                            shadowRadius: 16,
                            elevation: 8,
                        }}
                    >
                        {/* Spinning Logo Container */}
                        <StyledView className="relative mb-6">
                            {/* Outer rotating circle */}
                            <Animated.View
                                style={{
                                    transform: [{ rotate: circleRotation }],
                                }}
                                className="absolute w-20 h-20 border-2 border-[#BC4A4D]/20 border-t-[#BC4A4D] rounded-full"
                            />
                            
                            {/* Logo container */}
                            <StyledView className="w-16 h-16 rounded-full bg-[#BC4A4D]/10 items-center justify-center mx-2 my-2">
                                <Animated.View
                                    style={{
                                        transform: [{ rotate: spin }],
                                    }}
                                >
                                    <StyledImage
                                        source={require('../../assets/images/logo.png')}
                                        className="w-10 h-10 rounded-full"
                                    />
                                </Animated.View>
                            </StyledView>
                        </StyledView>
                        
                        {/* Brand Name */}
                        <StyledText className="text-lg font-bold mb-6">
                            <StyledText className="text-[#BC4A4DFF]">Campus</StyledText>
                            <StyledText className="text-[#DAA520]">Eats</StyledText>
                        </StyledText>
                        
                        {/* Loading Text */}
                        <StyledText className="text-[#BC4A4D] text-base font-semibold mb-2">Loading Orders Complete...</StyledText>
                        <StyledText className="text-gray-500 text-sm text-center max-w-[200px] leading-5">
                            Please wait while we fetch your completed orders
                        </StyledText>
                    </StyledView>
                </StyledView>
                <BottomNavigation activeTab="Profile" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
            <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />

            {/* Header */}
            <StyledView className="px-5 py-4" style={{ backgroundColor: '#DFD6C5' }}>
                <StyledView className="flex-row items-center">


                </StyledView>
            </StyledView>

            <StyledScrollView
                className="flex-1 px-5"
                style={{ backgroundColor: '#DFD6C5' }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Orders Complete Section */}
                <StyledView className="mb-6">
                    <StyledText className="text-lg font-bold mb-4 text-gray-900">Orders Complete</StyledText>
                    {completedOrders.length === 0 ? (
                        <StyledView className="bg-white rounded-2xl p-6 items-center border border-gray-100">
                            <StyledView className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-3">
                                <MaterialIcons name="history" size={32} color="#9CA3AF" />
                            </StyledView>
                            <StyledText className="text-base font-medium text-gray-900 mb-1">No order history</StyledText>
                            <StyledText className="text-sm text-gray-500 text-center">Completed orders will appear here</StyledText>
                        </StyledView>
                    ) : (
                        completedOrders.map(order => {
                            const isExpanded = expandedOrderIds[order.id] || false;
                            return (
                                <StyledView key={order.id} className="bg-white rounded-2xl mb-4 shadow-sm border border-gray-100">
                                    <StyledTouchableOpacity
                                        className="p-4"
                                        onPress={() => toggleOrderExpansion(order.id)}
                                    >
                                        <StyledView className="flex-row items-center">
                                            <StyledView className="w-12 h-12 rounded-full overflow-hidden mr-3 bg-gray-100">
                                                <StyledImage
                                                    source={{ uri: order.shopData?.imageUrl || 'https://via.placeholder.com/150' }}
                                                    className="w-full h-full"
                                                    resizeMode="cover"
                                                />
                                            </StyledView>
                                            <StyledView className="flex-1">
                                                <StyledText className="text-base font-semibold text-gray-900">
                                                    {order.firstname} {order.lastname}
                                                </StyledText>
                                                <StyledText className="text-sm text-gray-500 mt-1">
                                                    Order #{order.id.slice(-6)}
                                                </StyledText>
                                                <StyledView className="flex-row items-center mt-1">
                                                    <StyledView className="px-2 py-1 rounded-full bg-green-100">
                                                        <StyledText className="text-xs font-medium text-green-700">Completed</StyledText>
                                                    </StyledView>
                                                </StyledView>
                                            </StyledView>
                                            <MaterialIcons
                                                name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                                                size={24}
                                                color="#9CA3AF"
                                            />
                                        </StyledView>
                                    </StyledTouchableOpacity>

                                    {isExpanded && (
                                        <StyledView className="px-4 pb-4 border-t border-gray-100">
                                            <StyledText className="text-base font-semibold mb-3 text-gray-900">Order Details</StyledText>
                                            <StyledView className="bg-gray-50 rounded-xl p-3 mb-4">
                                                {renderOrderItems(order.items)}
                                            </StyledView>
                                            <StyledView className="bg-gray-50 rounded-xl p-3">
                                                <StyledView className="flex-row justify-between items-center py-2">
                                                    <StyledText className="text-sm text-gray-600">Subtotal</StyledText>
                                                    <StyledText className="text-sm font-medium text-gray-900">₱{order.totalPrice.toFixed(2)}</StyledText>
                                                </StyledView>
                                                <StyledView className="flex-row justify-between items-center py-2">
                                                    <StyledText className="text-sm text-gray-600">Delivery Fee</StyledText>
                                                    <StyledText className="text-sm font-medium text-gray-900">
                                                        ₱{order.shopData?.deliveryFee?.toFixed(2) || '0.00'}
                                                    </StyledText>
                                                </StyledView>
                                                <StyledView className="flex-row justify-between items-center py-2 border-t border-gray-200 mt-2">
                                                    <StyledText className="text-base font-semibold text-gray-900">Total</StyledText>
                                                    <StyledText className="text-lg font-bold" style={{ color: '#BC4A4D' }}>
                                                        ₱{(order.totalPrice + (order.shopData?.deliveryFee || 0)).toFixed(2)}
                                                    </StyledText>
                                                </StyledView>
                                            </StyledView>
                                        </StyledView>
                                    )}
                                </StyledView>
                            );
                        })
                    )}
                </StyledView>
            </StyledScrollView>

            <BottomNavigation activeTab="Profile" />
        </SafeAreaView>
    );
}