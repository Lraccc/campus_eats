import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, StatusBar, Alert, Modal, ActivityIndicator, Linking } from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import BottomNavigation from '@/components/BottomNavigation';
import { styled } from "nativewind";

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)
const StyledTextInput = styled(TextInput)
const StyledSafeAreaView = styled(SafeAreaView)

interface CartItem {
    itemId: string;
    name: string;
    description?: string;
    quantity: number;
    price: number;
}

interface CartData {
    id: string;
    shopId: string;
    items: CartItem[];
    totalPrice: number;
}

interface ShopData {
    id: string;
    name: string;
    address: string;
    deliveryFee: number;
    acceptGCASH: boolean;
    gcashName?: string;
    gcashNumber?: string;
}

interface AlertModalState {
    isVisible: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
    showConfirmButton: boolean;
    confirmButtonText?: string;
}

interface OrderData {
    uid: string;
    shopId: string;
    firstname: string;
    lastname: string;
    mobileNum: string;
    deliverTo: string;
    paymentMethod: string;
    note: string;
    deliveryFee: number;
    items: CartItem[];
    totalPrice: number;
    previousNoShowFee?: number;
    previousNoShowItems?: number;
    refNum?: string;
    changeFor?: string;
}

const CheckoutScreen = () => {
    const { shopId } = useLocalSearchParams();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [mobileNum, setMobileNum] = useState('');
    const [deliverTo, setDeliverTo] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [changeFor, setChangeFor] = useState('');
    const [note, setNote] = useState('');
    const [cart, setCart] = useState<CartData | null>(null);
    const [shop, setShop] = useState<ShopData | null>(null);
    const [loading, setLoading] = useState(false);
    const [waitingForPayment, setWaitingForPayment] = useState(false);
    const [previousNoShowFee, setPreviousNoShowFee] = useState(0);
    const [previousNoShowItems, setPreviousNoShowItems] = useState(0);

    const [alertModal, setAlertModal] = useState<AlertModalState>({
        isVisible: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: true,
    });

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userId = await AsyncStorage.getItem('userId');
                const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

                if (!userId || !token) {
                    return;
                }

                const response = await axios.get(`${API_URL}/api/users/${userId}`, {
                    headers: { Authorization: token }
                });

                const userData = response.data;
                setFirstName(userData.firstname || '');
                setLastName(userData.lastname || '');
                // Format phone number from database for display (removing leading 0 if present)
                setMobileNum(userData.phone ? userData.phone.replace(/^0/, '') : '');
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        fetchUserData();
    }, []);

    useEffect(() => {
        const fetchCartData = async () => {
            try {
                const userId = await AsyncStorage.getItem('userId');
                const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

                if (!userId || !token) {
                    return;
                }

                const response = await axios.get(`${API_URL}/api/carts/cart`, {
                    params: { uid: userId },
                    headers: { Authorization: token }
                });

                setCart(response.data);

                if (response.data && response.data.shopId) {
                    const shopResponse = await axios.get(`${API_URL}/api/shops/${response.data.shopId}`, {
                        headers: { Authorization: token }
                    });
                    setShop(shopResponse.data);

                    // Check for previous no-show orders
                    try {
                        const noShowResponse = await axios.get(`${API_URL}/api/orders/user/no-show-orders/${userId}`, {
                            headers: { Authorization: token }
                        });

                        if (noShowResponse.data && noShowResponse.data.length > 0) {
                            // Get the most recent no-show order
                            const sortedOrders = noShowResponse.data.sort((a: any, b: any) =>
                                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            );
                            const lastNoShowOrder = sortedOrders[0];
                            setPreviousNoShowFee(lastNoShowOrder.deliveryFee || 0);
                            
                            // Calculate the total of missed items if available
                            if (lastNoShowOrder.items && lastNoShowOrder.items.length > 0) {
                                const itemsTotal = lastNoShowOrder.items.reduce((sum: number, item: CartItem) => {
                                    return sum + (item.price * item.quantity);
                                }, 0);
                                setPreviousNoShowItems(itemsTotal);
                            }
                        }
                    } catch (error) {
                        console.log('Error fetching no-show orders:', error);
                    }
                }
            } catch (error) {
                console.error('Error fetching cart data:', error);
            }
        };

        fetchCartData();
    }, []);

    const changeWaitingForPayment = () => {
        setWaitingForPayment(false);
    };

    // No need for payment status polling

    const checkDasherStatus = async () => {
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            const response = await axios.get(`${API_URL}/api/dashers`, {
                headers: { Authorization: token }
            });
            const availableDashers = response.data.filter((dasher: any) => dasher.status === 'active');
            return availableDashers.length > 0;
        } catch (error) {
            console.error('Error fetching available dashers:', error);
            return false;
        }
    };

    const showConfirmation = async (message: string) => {
        return new Promise((resolve) => {
            setAlertModal({
                isVisible: true,
                title: 'No Dashers Available',
                message,
                onConfirm: async () => {
                    setAlertModal({ ...alertModal, isVisible: false });
                    resolve(true);
                },
                showConfirmButton: true,
            });
        });
    };

    const handleOrderSubmission = async (refNum?: string, paymentId?: string) => {
        console.log('Submitting order... refnum : ', refNum);
        const activeDashers = await checkDasherStatus();
        if (!activeDashers) {
            setLoading(false);
            const proceed = await showConfirmation('There are no active dashers available at the moment. Do you want to continue finding?');
            if (!proceed) {
                // If user cancels and they already paid via GCash, process a refund
                if (paymentMethod === 'gcash' && paymentId && refNum) {
                    await processRefund(paymentId, refNum);
                    setAlertModal({
                        isVisible: true,
                        title: 'Payment Refunded',
                        message: 'Your payment has been refunded because you canceled the order.',
                        showConfirmButton: false,
                        onConfirm: null,
                    });
                }
                return;
            }
            setLoading(true);
        }

        const userId = await AsyncStorage.getItem('userId');
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

        if (!userId || !token || !cart || !shop) {
            // If missing required data and they already paid via GCash, process a refund
            if (paymentMethod === 'gcash' && paymentId && refNum) {
                await processRefund(paymentId, refNum);
                setAlertModal({
                    isVisible: true,
                    title: 'Payment Refunded',
                    message: 'Your payment has been refunded due to missing order information.',
                    showConfirmButton: false,
                    onConfirm: null,
                });
            }
            setLoading(false);
            return;
        }

        const order: OrderData = {
            uid: userId,
            shopId: cart.shopId,
            firstname: firstName,
            lastname: lastName,
            mobileNum,
            deliverTo,
            paymentMethod,
            note,
            deliveryFee: shop.deliveryFee,
            items: cart.items,
            totalPrice: cart.totalPrice,
            previousNoShowFee: previousNoShowFee,
            previousNoShowItems: previousNoShowItems,
            refNum,
        };

        if (paymentMethod === 'cash' && changeFor) {
            order.changeFor = changeFor;
        }

        if (paymentMethod === 'gcash') {
            try {
                await axios.put(`${API_URL}/api/shops/update/${shop.id}/wallet`, null, {
                    params: { totalPrice: cart.totalPrice },
                    headers: { Authorization: token }
                });
            } catch (error) {
                console.error('Error updating shop wallet:', error);
                // If updating shop wallet fails and they already paid via GCash, process a refund
                if (paymentId && refNum) {
                    await processRefund(paymentId, refNum);
                    setAlertModal({
                        isVisible: true,
                        title: 'Payment Refunded',
                        message: 'Your payment has been refunded due to an error processing your order.',
                        showConfirmButton: false,
                        onConfirm: null,
                    });
                    setLoading(false);
                    return;
                }
            }
        }

        try {
            const response = await axios.post(`${API_URL}/api/orders/place-order`, order, {
                headers: { Authorization: token }
            });

            try {
                await axios.delete(`${API_URL}/api/carts/remove-cart`, {
                    data: { uid: userId },
                    headers: { Authorization: token }
                });
                setCart(null);
            } catch (error) {
                console.error('Error removing cart:', error);
            }

            router.push('/order' as any);
        } catch (error: any) {
            // If order placement fails and they already paid via GCash, process a refund
            if (paymentMethod === 'gcash' && paymentId && refNum) {
                await processRefund(paymentId, refNum);
                setAlertModal({
                    isVisible: true,
                    title: 'Payment Refunded',
                    message: 'Your GCash payment has been refunded. ' + (error.response?.data?.error || 'An error occurred while placing your order.'),
                    showConfirmButton: false,
                    onConfirm: null,
                });
            } else {
                setAlertModal({
                    isVisible: true,
                    title: 'Existing active order',
                    message: error.response?.data?.error || 'An error occurred',
                    showConfirmButton: false,
                    onConfirm: null,
                });
            }
            setLoading(false);
            return;
        }

        setLoading(false);
    };
    
    // Process refunds for failed orders or payment issues
    const processRefund = async (paymentId: string, referenceNumber: string) => {
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token || !cart || !shop) {
                console.error('Missing required data for refund');
                return null;
            }
            
            const totalAmount = cart.totalPrice + shop.deliveryFee;
            
            console.log('Processing refund for payment:', paymentId);
            
            const response = await axios.post(`${API_URL}/api/payments/process-refund`, {
                paymentId: paymentId,
                amount: totalAmount,
                reason: 'requested_by_customer',
                notes: `Refund for failed order transaction. Reference: ${referenceNumber}`
            }, {
                headers: { Authorization: token }
            });
            
            console.log('Refund processed:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error processing refund:', error);
            return null;
        }
    };

    const handleSubmit = async () => {
        setLoading(true);

        // Validate the mobile number - should be 10 digits and start with 9 for Philippines
        if (!mobileNum || mobileNum.length !== 10 || !mobileNum.startsWith('9')) {
            setAlertModal({
                isVisible: true,
                title: 'Invalid Mobile Number',
                message: 'Please enter a valid mobile number starting with 9 and containing 10 digits.',
                showConfirmButton: false,
                onConfirm: null,
            });
            setLoading(false);
            return;
        }

        if (paymentMethod === 'cash') {
            if (cart && parseFloat(changeFor) < cart.totalPrice) {
                setAlertModal({
                    isVisible: true,
                    title: 'Invalid Amount',
                    message: 'Change for must be greater than or equal to the total price',
                    showConfirmButton: false,
                    onConfirm: null,
                });
                setLoading(false);
                return;
            } else {
                handleOrderSubmission();
            }
        } else if (paymentMethod === 'gcash') {
            try {
                const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
                if (!token || !cart || !shop) return;

                const userId = await AsyncStorage.getItem('userId');
                if (!userId) {
                    throw new Error('User ID not found');
                }

                // Generate a unique transaction ID for this order
                const txnId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
                
                // Create a payment link for the order
                const response = await axios.post(`${API_URL}/api/payments/create-gcash-payment`, {
                    amount: (cart.totalPrice + shop.deliveryFee + previousNoShowFee + previousNoShowItems),
                    description: `to ${shop.name} payment by ${firstName} ${lastName}`,
                    orderId: userId,
                    metadata: {
                        txnId: txnId,
                        type: 'order_payment'
                    }
                }, {
                    headers: { Authorization: token }
                });

                const data = response.data;
                
                if (!data.checkout_url) {
                    throw new Error('No checkout URL received');
                }
                
                // Store information about this order payment locally
                await AsyncStorage.setItem(
                    `order_payment_${txnId}`,
                    JSON.stringify({
                        id: txnId,
                        userId: userId,
                        shopId: shop.id,
                        amount: (cart.totalPrice + shop.deliveryFee + previousNoShowFee + previousNoShowItems),
                        status: "pending",
                        timestamp: Date.now(),
                        linkId: data.id,
                        referenceNumber: data.reference_number
                    })
                );
                
                // Show alert with instructions before opening payment URL
                setAlertModal({
                    isVisible: true,
                    title: 'GCash Payment',
                    message: 'You will be redirected to complete your payment. After completing payment, return to this app and tap the "I have paid" button to place your order.',
                    onConfirm: async () => {
                        try {
                            // Attempt to open the URL
                            const supported = await Linking.canOpenURL(data.checkout_url);
                            if (supported) {
                                await Linking.openURL(data.checkout_url);
                                
                                // After opening the URL, update UI to show "I have paid" button
                                setWaitingForPayment(true);
                                
                                // Also show a secondary alert when they come back to the app
                                setTimeout(() => {
                                    setAlertModal({
                                        isVisible: true,
                                        title: 'Complete Your Order',
                                        message: 'Have you completed your GCash payment?',
                                        onConfirm: async () => {
                                            // First get payment ID using the reference number
                                            setWaitingForPayment(false);
                                            try {
                                                const paymentResponse = await axios.get(
                                                    `${API_URL}/api/payments/get-payment-by-reference/${data.reference_number}`,
                                                    { headers: { Authorization: token } }
                                                );
                                                
                                                if (paymentResponse.data && paymentResponse.data.payment_id) {
                                                    // When user confirms payment, proceed with order submission
                                                    handleOrderSubmission(data.reference_number, paymentResponse.data.payment_id);
                                                } else {
                                                    handleOrderSubmission(data.reference_number);
                                                }
                                            } catch (error) {
                                                console.error('Error getting payment ID:', error);
                                                handleOrderSubmission(data.reference_number);
                                            }
                                        },
                                        showConfirmButton: true,
                                        confirmButtonText: 'Yes, I Have Paid'
                                    });
                                }, 1000); // Small delay to ensure this appears after they return
                            } else {
                                console.error("Don't know how to open this URL: " + data.checkout_url);
                                setAlertModal({
                                    isVisible: true,
                                    title: 'Error',
                                    message: 'Unable to open payment URL. Please try again or use a different payment method.',
                                    showConfirmButton: false,
                                    onConfirm: null
                                });
                            }
                        } catch (error) {
                            console.error('Error opening URL:', error);
                            setAlertModal({
                                isVisible: true,
                                title: 'Error',
                                message: 'Failed to open payment page. Please try again.',
                                showConfirmButton: false,
                                onConfirm: null
                            });
                        }
                    },
                    showConfirmButton: true,
                    confirmButtonText: 'Proceed to Payment'
                });
                
                setLoading(false);
            } catch (error: any) {
                console.error('Error creating GCash payment:', error);
                setLoading(false);
                setAlertModal({
                    isVisible: true,
                    title: 'Error',
                    message: `Error creating GCash payment: ${error.response?.data?.error || 'An unknown error occurred.'}`,
                    showConfirmButton: false,
                    onConfirm: null,
                });
                return;
            }
        }
    };

    const AlertModalComponent = () => (
        <Modal
            transparent={true}
            visible={alertModal.isVisible}
            animationType="fade"
            onRequestClose={() => setAlertModal({ ...alertModal, isVisible: false })}
        >
            <StyledView className="flex-1 justify-center items-center bg-black/50 px-6">
                <StyledView className="bg-white rounded-3xl p-6 w-full max-w-sm">
                    <StyledView className="items-center mb-4">
                        <StyledView className="w-16 h-16 rounded-full bg-red-50 justify-center items-center mb-4">
                            <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
                        </StyledView>
                        <StyledText className="text-xl font-bold text-[#333] text-center">{alertModal.title}</StyledText>
                    </StyledView>
                    <StyledText className="text-base text-center text-[#666] mb-6 leading-6">{alertModal.message}</StyledText>
                    <StyledView className="space-y-3">
                        {alertModal.showConfirmButton && (
                            <StyledTouchableOpacity
                                className="bg-[#BC4A4D] py-3 px-6 rounded-2xl"
                                onPress={() => {
                                    if (alertModal.onConfirm) alertModal.onConfirm();
                                    setAlertModal({ ...alertModal, isVisible: false });
                                }}
                            >
                                <StyledText className="text-white font-bold text-base text-center">Confirm</StyledText>
                            </StyledTouchableOpacity>
                        )}
                        <StyledTouchableOpacity
                            className="bg-white py-3 px-6 rounded-2xl border border-[#e5e5e5]"
                            onPress={() => setAlertModal({ ...alertModal, isVisible: false })}
                        >
                            <StyledText className="text-[#666] font-semibold text-base text-center">Close</StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );

    if (!cart || !shop) {
        return (
            <StyledSafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
                <StyledView className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#BC4A4D" />
                    <StyledText className="text-lg text-center mt-4 text-[#666]">Loading checkout...</StyledText>
                </StyledView>
            </StyledSafeAreaView>
        );
    }

    return (
        <StyledSafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <AlertModalComponent />

            {/* Header */}
            <StyledView className="bg-white px-6 py-4 border-b border-[#f0f0f0]">
                <StyledView className="flex-row items-center justify-between">
                    <StyledView className="flex-row items-center">
                        <StyledTouchableOpacity
                            onPress={() => router.back()}
                            className="mr-4 p-2 -ml-2"
                        >
                            <Ionicons name="arrow-back" size={24} color="#333" />
                        </StyledTouchableOpacity>
                        <StyledText className="text-xl font-bold text-[#333]">Checkout</StyledText>
                    </StyledView>
                    <StyledView className="w-10 h-10 rounded-full bg-[#f8f8f8] justify-center items-center">
                        <Ionicons name="card-outline" size={20} color="#BC4A4D" />
                    </StyledView>
                </StyledView>
            </StyledView>

            <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Contact Details */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="person-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Contact Details</StyledText>
                    </StyledView>

                    <StyledView className="space-y-4">
                        <StyledView className="flex-row space-x-4">
                            <StyledView className="flex-1">
                                <StyledText className="text-sm font-semibold text-[#666] mb-2">First Name</StyledText>
                                <StyledTextInput
                                    className="bg-[#f8f8f8] rounded-2xl px-4 py-3 text-base border border-[#e5e5e5] text-[#999]"
                                    value={firstName}
                                    editable={false}
                                    placeholder="Enter firstname"
                                />
                            </StyledView>
                            <StyledView className="flex-1">
                                <StyledText className="text-sm font-semibold text-[#666] mb-2">Last Name</StyledText>
                                <StyledTextInput
                                    className="bg-[#f8f8f8] rounded-2xl px-4 py-3 text-base border border-[#e5e5e5] text-[#999]"
                                    value={lastName}
                                    editable={false}
                                    placeholder="Enter lastname"
                                />
                            </StyledView>
                        </StyledView>

                        <StyledView>
                            <StyledText className="text-sm font-semibold text-[#666] mb-2">Mobile Number</StyledText>
                            <StyledView className="flex-row items-center bg-white rounded-2xl border border-[#e5e5e5]" 
                                      style={{ borderColor: mobileNum ? '#BC4A4D' : '#e5e5e5' }}>
                                <StyledText className="text-base text-[#666] pl-4 font-semibold">+63</StyledText>
                                <StyledTextInput
                                    className="flex-1 px-4 py-3 text-base"
                                    value={mobileNum}
                                    onChangeText={setMobileNum}
                                    placeholder="9XX XXX XXXX"
                                    keyboardType="phone-pad"
                                    placeholderTextColor="#aaa"
                                    style={{ fontSize: 16, color: '#333' }}
                                />
                                {mobileNum ? (
                                    <StyledTouchableOpacity 
                                        onPress={() => setMobileNum('')}
                                        className="pr-3"
                                    >
                                        <Ionicons name="close-circle" size={18} color="#999" />
                                    </StyledTouchableOpacity>
                                ) : null}
                            </StyledView>
                        </StyledView>

                        <StyledView>
                            <StyledText className="text-sm font-semibold text-[#666] mb-2">Delivery Address</StyledText>
                            <StyledTextInput
                                className="bg-white rounded-2xl px-4 py-3 text-base border border-[#e5e5e5]"
                                value={deliverTo}
                                onChangeText={setDeliverTo}
                                placeholder="Enter your complete delivery address"
                                style={{ fontSize: 16 }}
                            />
                        </StyledView>

                        <StyledView>
                            <StyledText className="text-sm font-semibold text-[#666] mb-2">Delivery Notes (Optional)</StyledText>
                            <StyledTextInput
                                className="bg-white rounded-2xl px-4 py-3 text-base border border-[#e5e5e5] h-20"
                                value={note}
                                onChangeText={setNote}
                                placeholder="Add special instructions for delivery..."
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                style={{ fontSize: 16 }}
                            />
                        </StyledView>
                    </StyledView>
                </StyledView>

                {/* Payment Method */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="card-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Payment Method</StyledText>
                    </StyledView>

                    {!shop.acceptGCASH && (
                        <StyledView className="bg-orange-50 p-3 rounded-2xl mb-4 border border-orange-100">
                            <StyledText className="text-sm text-orange-600 text-center">
                                This shop only accepts cash payments
                            </StyledText>
                        </StyledView>
                    )}
                    
                    {shop.acceptGCASH && (!shop.gcashName || !shop.gcashNumber) && (
                        <StyledView className="bg-orange-50 p-3 rounded-2xl mb-4 border border-orange-100">
                            <StyledText className="text-sm text-orange-600 text-center">
                                This shop hasn't completed their GCash account setup
                            </StyledText>
                        </StyledView>
                    )}

                    <StyledView className="space-y-3">
                        <StyledTouchableOpacity
                            className={`flex-row items-center p-4 rounded-2xl border ${
                                paymentMethod === 'cash'
                                    ? 'border-[#BC4A4D] bg-red-50'
                                    : 'border-[#e5e5e5] bg-white'
                            }`}
                            onPress={() => setPaymentMethod('cash')}
                        >
                            <StyledView className="w-5 h-5 rounded-full border-2 border-[#BC4A4D] mr-3 items-center justify-center">
                                {paymentMethod === 'cash' && <StyledView className="w-2.5 h-2.5 rounded-full bg-[#BC4A4D]" />}
                            </StyledView>
                            <Ionicons name="cash-outline" size={20} color="#666" />
                            <StyledText className="text-base font-semibold text-[#333] ml-2">Cash on Delivery</StyledText>
                        </StyledTouchableOpacity>

                        {((cart.totalPrice + shop.deliveryFee) > 100) && shop.acceptGCASH && shop.gcashName && shop.gcashNumber && (
                            <StyledTouchableOpacity
                                className={`flex-row items-center p-4 rounded-2xl border ${
                                    paymentMethod === 'gcash'
                                        ? 'border-[#BC4A4D] bg-red-50'
                                        : 'border-[#e5e5e5] bg-white'
                                }`}
                                onPress={() => setPaymentMethod('gcash')}
                            >
                                <StyledView className="w-5 h-5 rounded-full border-2 border-[#BC4A4D] mr-3 items-center justify-center">
                                    {paymentMethod === 'gcash' && <StyledView className="w-2.5 h-2.5 rounded-full bg-[#BC4A4D]" />}
                                </StyledView>
                                <Ionicons name="phone-portrait-outline" size={20} color="#666" />
                                <StyledText className="text-base font-semibold text-[#333] ml-2">Online Payment (GCash)</StyledText>
                            </StyledTouchableOpacity>
                        )}
                    </StyledView>

                    {paymentMethod === 'cash' && (
                        <StyledView className="mt-4">
                            <StyledText className="text-sm font-semibold text-[#666] mb-2">Change for (₱)</StyledText>
                            <StyledTextInput
                                className="bg-white rounded-2xl px-4 py-3 text-base border border-[#e5e5e5]"
                                value={changeFor}
                                onChangeText={setChangeFor}
                                placeholder="Enter amount for change"
                                keyboardType="numeric"
                                style={{ fontSize: 16 }}
                            />
                        </StyledView>
                    )}
                    
                    {paymentMethod === 'gcash' && shop.gcashName && shop.gcashNumber && (
                        <StyledView className="mt-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <StyledView className="flex-row items-center mb-2">
                                <Ionicons name="information-circle" size={18} color="#3b82f6" />
                                <StyledText className="text-sm font-semibold text-blue-700 ml-2">GCash Payment Details</StyledText>
                            </StyledView>
                            <StyledText className="text-sm text-blue-700 mb-1">
                                Account Name: <StyledText className="font-bold">{shop.gcashName}</StyledText>
                            </StyledText>
                            <StyledText className="text-sm text-blue-700">
                                Account Number: <StyledText className="font-bold">{shop.gcashNumber}</StyledText>
                            </StyledText>
                        </StyledView>
                    )}
                </StyledView>

                {/* Order Summary */}
                <StyledView className="bg-white mx-6 mt-6 mb-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="receipt-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Order Summary</StyledText>
                    </StyledView>

                    <StyledView className="mb-4 p-4 bg-[#f8f8f8] rounded-2xl">
                        <StyledText className="text-lg font-bold text-[#333]">{shop.name}</StyledText>
                        <StyledText className="text-sm text-[#666] mt-1">{shop.address}</StyledText>
                    </StyledView>

                    <StyledView className="space-y-3 mb-4">
                        {cart.items.map((item, index) => (
                            <StyledView key={index} className="flex-row justify-between items-center py-2">
                                <StyledView className="flex-row items-center flex-1">
                                    <StyledView className="w-8 h-8 rounded-full bg-[#BC4A4D] justify-center items-center mr-3">
                                        <StyledText className="text-white text-sm font-bold">{item.quantity}</StyledText>
                                    </StyledView>
                                    <StyledView className="flex-1">
                                        <StyledText className="text-base text-[#333]">{item.name}</StyledText>
                                        {/*<StyledText className="text-xs text-[#666] mt-1">Delivery Fee: ₱{shop.deliveryFee.toFixed(2)}</StyledText>*/}
                                    </StyledView>
                                </StyledView>
                                <StyledText className="text-base font-bold text-[#BC4A4D]">₱{item.price.toFixed(2)}</StyledText>
                            </StyledView>
                        ))}
                    </StyledView>

                    <StyledView className="border-t border-[#e5e5e5] pt-4 space-y-3">
                        <StyledView className="flex-row justify-between">
                            <StyledText className="text-base text-[#666]">Subtotal</StyledText>
                            <StyledText className="text-base font-semibold text-[#333]">₱{cart.totalPrice.toFixed(2)}</StyledText>
                        </StyledView>
                        <StyledView className="flex-row justify-between">
                            <StyledText className="text-base text-[#666]">Delivery Fee</StyledText>
                            <StyledText className="text-base font-semibold text-[#333]">₱{shop.deliveryFee.toFixed(2)}</StyledText>
                        </StyledView>
                        {previousNoShowItems > 0 && (
                            <StyledView className="flex-row justify-between">
                                <StyledText className="text-sm text-[#BC4A4D]">Previous Missed Delivery Items</StyledText>
                                <StyledText className="text-sm font-semibold text-[#BC4A4D]">₱{previousNoShowItems.toFixed(2)}</StyledText>
                            </StyledView>
                        )}
                        {previousNoShowFee > 0 && (
                            <StyledView className="flex-row justify-between">
                                <StyledText className="text-sm text-[#BC4A4D]">Previous Missed Delivery Fee</StyledText>
                                <StyledText className="text-sm font-semibold text-[#BC4A4D]">₱{previousNoShowFee.toFixed(2)}</StyledText>
                            </StyledView>
                        )}
                        <StyledView className="flex-row justify-between pt-3 mt-3 border-t border-[#e5e5e5]">
                            <StyledText className="text-xl font-bold text-[#BC4A4D]">Total</StyledText>
                            <StyledText className="text-xl font-bold text-[#BC4A4D]">
                                ₱{(cart.totalPrice + shop.deliveryFee + previousNoShowFee + previousNoShowItems).toFixed(2)}
                            </StyledText>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </StyledScrollView>

            {/* Action Buttons */}
            <StyledView className="bg-white px-6 py-4 border-t border-[#f0f0f0]">
                <StyledView className="flex-row space-x-3">
                    {!waitingForPayment ? (
                        <StyledTouchableOpacity
                            className="flex-1 bg-white py-3 rounded-2xl border border-[#e5e5e5]"
                            onPress={() => router.back()}
                        >
                            <StyledView className="flex-row items-center justify-center">
                                <Ionicons name="arrow-back-outline" size={18} color="#666" />
                                <StyledText className="text-[#666] font-semibold text-base ml-2">Back</StyledText>
                            </StyledView>
                        </StyledTouchableOpacity>
                    ) : (
                        <StyledTouchableOpacity
                            className="flex-1 bg-white py-3 rounded-2xl border border-[#e5e5e5]"
                            onPress={changeWaitingForPayment}
                        >
                            <StyledView className="flex-row items-center justify-center">
                                <Ionicons name="close-outline" size={18} color="#666" />
                                <StyledText className="text-[#666] font-semibold text-base ml-2">Cancel Payment</StyledText>
                            </StyledView>
                        </StyledTouchableOpacity>
                    )}

                    <StyledTouchableOpacity
                        className={`flex-[2] py-3 rounded-2xl ${
                            (loading || waitingForPayment) ? 'bg-[#BC4A4D]/50' : 'bg-[#BC4A4D]'
                        }`}
                        onPress={handleSubmit}
                        disabled={loading || waitingForPayment}
                    >
                        <StyledView className="flex-row items-center justify-center">
                            {loading && <ActivityIndicator color="white" size="small" />}
                            {waitingForPayment && <Ionicons name="time-outline" size={18} color="white" />}
                            {!loading && !waitingForPayment && <Ionicons name="checkmark-circle-outline" size={18} color="white" />}
                            <StyledText className="text-white font-bold text-base ml-2">
                                {waitingForPayment ? 'Waiting for Payment' : loading ? 'Processing...' : 'Place Order'}
                            </StyledText>
                        </StyledView>
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledView>
        </StyledSafeAreaView>
    );
};

export default CheckoutScreen;