import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, StatusBar, Alert, Modal } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import BottomNavigation from '@/components/BottomNavigation';

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
}

interface AlertModalState {
    isVisible: boolean;
    title: string;
    message: string;
    onConfirm: (() => Promise<void>) | null;
    showConfirmButton: boolean;
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
    let pollInterval: NodeJS.Timeout;

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
                    
                    // Check for previous no-show orders that haven't been paid yet
                    try {
                        const noShowResponse = await axios.get(`${API_URL}/api/orders/user/no-show-orders/${userId}`, {
                            headers: { Authorization: token }
                        });
                        if (noShowResponse.data && noShowResponse.data.length > 0) {
                            // Get the most recent no-show order
                            const sortedOrders = [...noShowResponse.data].sort((a: any, b: any) => 
                                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            );
                            const lastNoShowOrder = sortedOrders[0];
                            
                            // Check if this fee has already been paid in a subsequent order
                            const paidFeesResponse = await axios.get(`${API_URL}/api/orders/user/paid-no-show-fees/${userId}`, {
                                headers: { Authorization: token }
                            });
                            const paidFees = paidFeesResponse.data || [];
                            
                            // Check if the last no-show order ID exists in the paid fees list
                            const feeAlreadyPaid = paidFees.some((paidFee: any) => paidFee.noShowOrderId === lastNoShowOrder._id);
                            
                            if (!feeAlreadyPaid) {
                                setPreviousNoShowFee(lastNoShowOrder.deliveryFee || 0);
                                console.log("Previous no-show fee:", lastNoShowOrder.deliveryFee);
                            } else {
                                setPreviousNoShowFee(0);
                                console.log("No-show fee already paid");
                            }
                        }
                    } catch (error) {
                        console.log("Error fetching no-show orders:", error);
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

    const pollPaymentStatus = async (linkId: string, refNum: string) => {
        const options = {
            method: 'GET',
            url: `https://api.paymongo.com/v1/links/${linkId}`,
            headers: {
                accept: 'application/json',
                authorization: 'Basic c2tfdGVzdF83SGdhSHFBWThORktEaEVHZ2oxTURxMzU6'
            }
        };

        try {
            const response = await axios.request(options);
            const paymentStatus = response.data.data.attributes.status;
            if (paymentStatus === 'paid') {
                setWaitingForPayment(false);
                handleOrderSubmission(refNum);
            }
        } catch (error) {
            console.error('Error checking payment status:', error);
        }
    };

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

    const handleOrderSubmission = async (refNum?: string) => {
        console.log('Submitting order... refnum : ', refNum);
        const activeDashers = await checkDasherStatus();
        if (!activeDashers) {
            setLoading(false);
            const proceed = await showConfirmation('There are no active dashers available at the moment. Do you want to continue finding?');
            if (!proceed) {
                return;
            }
            setLoading(true);
        }

        const userId = await AsyncStorage.getItem('userId');
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

        if (!userId || !token || !cart || !shop) {
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
            refNum,
        };

        if (paymentMethod === 'cash' && changeFor) {
            order.changeFor = changeFor;
        }

        if (paymentMethod === 'gcash') {
            await axios.put(`${API_URL}/api/shops/update/${shop.id}/wallet`, null, {
                params: { totalPrice: cart.totalPrice },
                headers: { Authorization: token }
            });
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
                clearInterval(pollInterval);
            } catch (error) {
                console.error('Error removing cart:', error);
            }

            router.push('/order' as any);
        } catch (error: any) {
            setAlertModal({
                isVisible: true,
                title: 'Existing active order',
                message: error.response?.data?.error || 'An error occurred',
                showConfirmButton: false,
                onConfirm: null,
            });
            setLoading(false);
            return;
        }

        setLoading(false);
    };

    const handleSubmit = async () => {
        setLoading(true);

        if (mobileNum.length !== 10 && mobileNum.startsWith('9')) {
            setAlertModal({
                isVisible: true,
                title: 'Invalid Mobile Number',
                message: `Please enter a valid mobile number: ${mobileNum}`,
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

                const response = await axios.post(`${API_URL}/api/payments/create-gcash-payment`, {
                    amount: (cart.totalPrice + shop.deliveryFee),
                    description: `to ${shop.name} payment by ${firstName} ${lastName}`,
                    orderId: await AsyncStorage.getItem('userId'),
                }, {
                    headers: { Authorization: token }
                });

                const data = response.data;
                // Open payment URL in browser
                // Note: You'll need to implement a way to open URLs in the mobile app
                setWaitingForPayment(true);
                setLoading(false);

                pollInterval = setInterval(() => {
                    pollPaymentStatus(data.id, data.reference_number);
                }, 10000);

                return () => clearInterval(pollInterval);
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
            <View style={styles.alertOverlay}>
                <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>{alertModal.title}</Text>
                    <Text style={styles.alertMessage}>{alertModal.message}</Text>
                    <View style={styles.alertButtons}>
                        {alertModal.showConfirmButton && (
                            <TouchableOpacity
                                style={styles.alertConfirmButton}
                                onPress={() => {
                                    if (alertModal.onConfirm) alertModal.onConfirm();
                                    setAlertModal({ ...alertModal, isVisible: false });
                                }}
                            >
                                <Text style={styles.alertButtonText}>Confirm</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.alertCancelButton}
                            onPress={() => setAlertModal({ ...alertModal, isVisible: false })}
                        >
                            <Text style={styles.alertButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    if (!cart || !shop) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.loadingText}>Loading...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <AlertModalComponent />

            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Checkout</Text>
                    <View style={styles.headerDivider} />
                </View>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Contact Details</Text>
                    <View style={styles.form}>
                        <View style={styles.row}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Firstname</Text>
                                <TextInput
                                    style={[styles.input, styles.readOnlyInput]}
                                    value={firstName}
                                    editable={false}
                                    placeholder="Enter firstname"
                                />
                            </View>
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Lastname</Text>
                                <TextInput
                                    style={[styles.input, styles.readOnlyInput]}
                                    value={lastName}
                                    editable={false}
                                    placeholder="Enter lastname"
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Mobile Number</Text>
                            <View style={styles.phoneInputContainer}>
                                <Text style={styles.phonePrefix}>+63 </Text>
                                <TextInput
                                    style={styles.phoneInput}
                                    value={mobileNum}
                                    onChangeText={setMobileNum}
                                    placeholder="Enter mobile number"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Deliver To</Text>
                            <TextInput
                                style={styles.input}
                                value={deliverTo}
                                onChangeText={setDeliverTo}
                                placeholder="Enter delivery address"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Delivery Note</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={note}
                                onChangeText={setNote}
                                placeholder="Add delivery notes"
                                multiline
                                numberOfLines={4}
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Method</Text>
                    {!shop.acceptGCASH && (
                        <Text style={styles.warningText}>This shop doesn't accept online payment</Text>
                    )}
                    <View style={styles.paymentOptions}>
                        <TouchableOpacity
                            style={[
                                styles.paymentOption,
                                paymentMethod === 'cash' && styles.selectedPayment
                            ]}
                            onPress={() => setPaymentMethod('cash')}
                        >
                            <View style={styles.radioButton}>
                                {paymentMethod === 'cash' && <View style={styles.radioButtonSelected} />}
                            </View>
                            <Text style={styles.paymentText}>Cash on Delivery</Text>
                        </TouchableOpacity>

                        {((cart.totalPrice + shop.deliveryFee) > 100) && shop.acceptGCASH && (
                            <TouchableOpacity
                                style={[
                                    styles.paymentOption,
                                    paymentMethod === 'gcash' && styles.selectedPayment
                                ]}
                                onPress={() => setPaymentMethod('gcash')}
                            >
                                <View style={styles.radioButton}>
                                    {paymentMethod === 'gcash' && <View style={styles.radioButtonSelected} />}
                                </View>
                                <Text style={styles.paymentText}>Online Payment</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {paymentMethod === 'cash' && (
                        <View style={styles.changeForContainer}>
                            <Text style={styles.label}>Change for:</Text>
                            <TextInput
                                style={styles.input}
                                value={changeFor}
                                onChangeText={setChangeFor}
                                placeholder="Enter amount"
                                keyboardType="numeric"
                            />
                        </View>
                    )}
                </View>

                <View style={styles.orderSummary}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.shopInfo}>
                        <Text style={styles.shopName}>{shop.name}</Text>
                        <Text style={styles.shopAddress}>{shop.address}</Text>
                    </View>

                    {cart.items.map((item, index) => (
                        <View key={index} style={styles.orderItem}>
                            <View style={styles.orderItemHeader}>
                                <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                                <Text style={styles.itemName}>{item.name}</Text>
                            </View>
                            <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
                        </View>
                    ))}

                    <View style={styles.totalContainer}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Subtotal</Text>
                            <Text style={styles.totalValue}>₱{cart.totalPrice.toFixed(2)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Delivery Fee</Text>
                            <Text style={styles.totalValue}>₱{shop.deliveryFee.toFixed(2)}</Text>
                        </View>
                        {previousNoShowFee > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={[styles.totalLabel, {color: '#BC4A4D'}]}>Previous Missed Delivery Fee</Text>
                                <Text style={[styles.totalValue, {color: '#BC4A4D'}]}>₱{previousNoShowFee.toFixed(2)}</Text>
                            </View>
                        )}
                        <View style={[styles.totalRow, styles.grandTotal]}>
                            <Text style={styles.grandTotalLabel}>Total</Text>
                            <Text style={styles.grandTotalValue}>
                                ₱{(cart.totalPrice + shop.deliveryFee + previousNoShowFee).toFixed(2)}
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                {!waitingForPayment && (
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                )}
                {waitingForPayment && (
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={changeWaitingForPayment}
                    >
                        <Text style={styles.cancelButtonText}>Cancel Online Payment</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.submitButton, (loading || waitingForPayment) && styles.disabledButton]}
                    onPress={handleSubmit}
                    disabled={loading || waitingForPayment}
                >
                    <Text style={styles.submitButtonText}>
                        {waitingForPayment ? 'Waiting for Payment' : 'Place Order'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#DFD6C5',
    },
    header: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    headerContent: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#BC4A4D',
        marginBottom: 10,
    },
    headerDivider: {
        width: 60,
        height: 4,
        backgroundColor: '#BC4A4D',
        borderRadius: 2,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#BC4A4D',
        marginBottom: 16,
    },
    form: {
        gap: 16,
    },
    row: {
        flexDirection: 'row',
        gap: 16,
    },
    inputContainer: {
        flex: 1,
    },
    label: {
        fontSize: 16,
        color: '#333333',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F8F8F8',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    phoneInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    phonePrefix: {
        fontSize: 16,
        color: '#333333',
        paddingLeft: 12,
    },
    phoneInput: {
        flex: 1,
        padding: 12,
        fontSize: 16,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    warningText: {
        color: '#BC4A4D',
        marginBottom: 16,
    },
    paymentOptions: {
        gap: 12,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F8F8F8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    selectedPayment: {
        borderColor: '#BC4A4D',
        backgroundColor: '#FFF5F5',
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#BC4A4D',
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioButtonSelected: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#BC4A4D',
    },
    paymentText: {
        fontSize: 16,
        color: '#333333',
    },
    changeForContainer: {
        marginTop: 16,
    },
    orderSummary: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    shopInfo: {
        marginBottom: 16,
    },
    shopName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 4,
    },
    shopAddress: {
        fontSize: 14,
        color: '#666666',
    },
    orderItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    orderItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    itemQuantity: {
        fontSize: 16,
        color: '#333333',
        marginRight: 8,
    },
    itemName: {
        fontSize: 16,
        color: '#333333',
        flex: 1,
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#BC4A4D',
    },
    totalContainer: {
        marginTop: 16,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    totalLabel: {
        fontSize: 16,
        color: '#666666',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333333',
    },
    grandTotal: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    grandTotalLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#BC4A4D',
    },
    grandTotalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#BC4A4D',
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#666666',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    submitButton: {
        flex: 2,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#BC4A4D',
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    disabledButton: {
        opacity: 0.5,
    },
    loadingText: {
        fontSize: 18,
        textAlign: 'center',
        marginTop: 20,
        color: '#666666',
    },
    alertOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    alertContent: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 25,
        width: '85%',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    alertTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#BC4A4D',
        marginBottom: 15,
    },
    alertMessage: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 25,
        color: '#333333',
        lineHeight: 24,
    },
    alertButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    alertConfirmButton: {
        backgroundColor: '#BC4A4D',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
        marginHorizontal: 5,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    alertCancelButton: {
        backgroundColor: '#666666',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
        marginHorizontal: 5,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    alertButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    readOnlyInput: {
        backgroundColor: '#F0F0F0',
        color: '#666666',
    },
});

export default CheckoutScreen; 