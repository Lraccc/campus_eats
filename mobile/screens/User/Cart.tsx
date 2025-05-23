import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, StatusBar, Modal, Alert } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios, { AxiosError } from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import BottomNavigation from '@/components/BottomNavigation';

// Original imports commented out for reference
// import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { Button } from 'react-bootstrap';
// import { useNavigate } from 'react-router-dom';
// import { useOrderContext } from "../../context/OrderContext";
// import { useAuth } from "../../utils/AuthContext";
// import AlertModal from '../AlertModal';
// import "../css/CartModal.css";

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
}

interface AlertModalState {
    isVisible: boolean;
    title: string;
    message: string;
    onConfirm: (() => Promise<void>) | null;
    showConfirmButton: boolean;
}

const CartScreen = () => {
    // Original context and auth hooks commented out
    // const { currentUser } = useAuth();
    // const { cartData: contextCartData, fetchData } = useOrderContext();
    // const navigate = useNavigate();

    const [cartData, setCartData] = useState<CartData | null>(null);
    const [shopData, setShopData] = useState<ShopData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [alertModal, setAlertModal] = useState<AlertModalState>({
        isVisible: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: true,
    });

    const fetchCartData = useCallback(async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            if (!userId) {
                console.log('No user ID found');
                return;
            }

            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) {
                console.log('No auth token found');
                return;
            }

            const response = await axios.get(`${API_URL}/api/carts/cart`, {
                params: { uid: userId },
                headers: { Authorization: token }
            });

            setCartData(response.data);

            // Fetch shop data if cart exists
            if (response.data && response.data.shopId) {
                const shopResponse = await axios.get(`${API_URL}/api/shops/${response.data.shopId}`, {
                    headers: { Authorization: token }
                });
                setShopData(shopResponse.data);
            }
        } catch (error) {
            console.log('Cart data unavailable:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCartData();
    }, [fetchCartData]);

    const updateCartItem = async (itemId: string, action: 'increase' | 'decrease' | 'remove') => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

            if (!userId || !token) {
                return;
            }

            const response = await axios.post(`${API_URL}/api/carts/update-cart-item`, {
                uid: userId,
                itemId,
                action
            }, {
                headers: { Authorization: token }
            });

            setCartData(response.data.cartData);

            // Refresh shop data
            if (response.data.cartData && response.data.cartData.shopId) {
                const shopResponse = await axios.get(`${API_URL}/api/shops/${response.data.cartData.shopId}`, {
                    headers: { Authorization: token }
                });
                setShopData(shopResponse.data);
            }
        } catch (error) {
            console.log('Cart update unavailable:', error);
        }
    };

    const handleItemIncrease = (item: CartItem) => {
        updateCartItem(item.itemId, 'increase');
    };

    const handleItemDecrease = (item: CartItem) => {
        updateCartItem(item.itemId, 'decrease');
    };

    const handleItemRemove = (item: CartItem) => {
        setAlertModal({
            isVisible: true,
            title: "Confirm to Remove",
            message: `Are you sure you want to remove ${item.name} from your cart?`,
            onConfirm: async () => {
                await updateCartItem(item.itemId, 'remove');
                setAlertModal({...alertModal, isVisible: false});
            },
            showConfirmButton: true,
        });
    };

    const handleShopRemove = async () => {
        setAlertModal({
            isVisible: true,
            title: "Confirm to Remove Shop",
            message: `Are you sure you want to remove ${shopData?.name}? This will remove all items in your cart.`,
            onConfirm: async () => {
                try {
                    const userId = await AsyncStorage.getItem('userId');
                    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

                    if (!userId || !token) {
                        return;
                    }

                    await axios.delete(`${API_URL}/api/carts/remove-cart`, {
                        data: { uid: userId },
                        headers: { Authorization: token }
                    });

                    setCartData(null);
                    setShopData(null);

                    Alert.alert('Success', 'Cart cleared successfully');
                } catch (error) {
                    console.log('Cart removal unavailable:', error);
                } finally {
                    setAlertModal({...alertModal, isVisible: false});
                }
            },
            showConfirmButton: true,
        });
    };

    const handleProceed = () => {
        if (!cartData || !shopData) return;
        router.push({
            pathname: '/checkout',
            params: { shopId: cartData.shopId }
        });
    };

    const AlertModalComponent = () => (
        <Modal
            transparent={true}
            visible={alertModal.isVisible}
            animationType="fade"
            onRequestClose={() => setAlertModal({...alertModal, isVisible: false})}
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
                                    setAlertModal({...alertModal, isVisible: false});
                                }}
                            >
                                <Text style={styles.alertButtonText}>Confirm</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.alertCancelButton}
                            onPress={() => setAlertModal({...alertModal, isVisible: false})}
                        >
                            <Text style={styles.alertButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <AlertModalComponent />

            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Your Cart</Text>
                    <View style={styles.headerDivider} />
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.cartContainer}>
                    <View style={styles.cartHeader}>
                        {isLoading ? (
                            <Text style={styles.emptyCartText}>Loading cart...</Text>
                        ) : !cartData || cartData.items.length === 0 ? (
                            <Text style={styles.emptyCartText}>Your cart is empty...</Text>
                        ) : (
                            <>
                                <View style={styles.storeItem}>
                                    <View style={styles.storeInfoContainer}>
                                        <View style={styles.storeIconContainer}>
                                            <AntDesign
                                                name="home"
                                                size={28}
                                                color="#BC4A4D"
                                            />
                                        </View>
                                        <View style={styles.storeDetails}>
                                            <Text style={styles.storeName}>{shopData?.name}</Text>
                                            <View style={styles.storeAddressContainer}>
                                                <AntDesign
                                                    name="enviroment"
                                                    size={14}
                                                    color="#666666"
                                                    style={styles.locationIcon}
                                                />
                                                <Text style={styles.storeAddress}>{shopData?.address}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.storeRemoveButton}
                                        onPress={handleShopRemove}
                                    >
                                        <AntDesign name="delete" size={16} color="white" />
                                        <Text style={styles.storeRemoveText}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.sectionTitle}>Your Items</Text>
                            </>
                        )}
                    </View>

                    <ScrollView style={styles.itemsList}>
                        {cartData?.items.map(item => (
                            <View style={styles.item} key={item.itemId}>
                                <View style={styles.itemLeft}>
                                    <View style={styles.itemButtons}>
                                        <TouchableOpacity
                                            style={styles.button}
                                            onPress={() => item.quantity > 1 ? handleItemDecrease(item) : handleItemRemove(item)}
                                        >
                                            {item.quantity > 1 ? (
                                                <AntDesign name="minus" size={16} color="#000" />
                                            ) : (
                                                <AntDesign name="delete" size={16} color="#000" />
                                            )}
                                        </TouchableOpacity>
                                        <Text style={styles.itemCount}>{item.quantity}</Text>
                                        <TouchableOpacity
                                            style={styles.button}
                                            onPress={() => handleItemIncrease(item)}
                                        >
                                            <AntDesign name="plus" size={16} color="#000" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.itemTitle}>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        <Text style={styles.itemDescription}>{item.description || 'No description available'}</Text>
                                    </View>
                                </View>
                                <View style={styles.itemRight}>
                                    <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {cartData && cartData.items.length > 0 && (
                    <View style={styles.footer}>
                        <View style={styles.subtotal}>
                            <Text style={styles.subtotalLabel}>Subtotal</Text>
                            <Text style={styles.subtotalValue}>₱{cartData.totalPrice.toFixed(2)}</Text>
                        </View>
                        <View style={styles.subtotal}>
                            <Text style={styles.subtotalLabel}>Delivery Fee</Text>
                            <Text style={styles.subtotalValue}>₱{shopData?.deliveryFee?.toFixed(2) || '0.00'}</Text>
                        </View>
                        <View style={styles.total}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalValue}>
                                ₱{((cartData.totalPrice || 0) + (shopData?.deliveryFee || 0)).toFixed(2)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.proceedButton}
                            onPress={handleProceed}
                        >
                            <Text style={styles.proceedButtonText}>Proceed to Checkout</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
            <BottomNavigation activeTab="Cart" />
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
        paddingHorizontal: 20,
        paddingTop: 15,
    },
    cartContainer: {
        flex: 1,
    },
    cartHeader: {
        marginBottom: 20,
    },
    emptyCartText: {
        fontSize: 20,
        textAlign: 'center',
        color: '#666666',
        marginTop: 50,
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#BC4A4D',
    },
    storeItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    storeInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    storeIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFF5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    storeDetails: {
        flex: 1,
    },
    storeName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 4,
    },
    storeAddressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationIcon: {
        marginRight: 4,
    },
    storeAddress: {
        fontSize: 14,
        color: '#666666',
        flex: 1,
    },
    storeRemoveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#BC4A4D',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginLeft: 12,
    },
    storeRemoveText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 4,
    },
    itemsList: {
        flex: 1,
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    itemButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
        backgroundColor: '#F8F8F8',
        borderRadius: 20,
        padding: 5,
    },
    button: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    itemCount: {
        marginHorizontal: 12,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333333',
        minWidth: 20,
        textAlign: 'center',
    },
    itemTitle: {
        flexDirection: 'column',
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 4,
    },
    itemDescription: {
        fontSize: 14,
        color: '#666666',
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#BC4A4D',
    },
    footer: {
        backgroundColor: '#FFFFFF',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    subtotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    subtotalLabel: {
        fontSize: 14,
        color: '#666666',
    },
    subtotalValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333333',
    },
    total: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#BC4A4D',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#BC4A4D',
    },
    proceedButton: {
        backgroundColor: '#BC4A4D',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    proceedButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
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
    itemRight: {
        marginLeft: 10,
        alignItems: 'flex-end',
    },
});

export default CartScreen;