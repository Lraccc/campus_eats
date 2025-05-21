import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, StatusBar, Modal } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { router } from 'expo-router';

// Original imports commented out for reference
// import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { Button } from 'react-bootstrap';
// import { useNavigate } from 'react-router-dom';
// import { useOrderContext } from "../../context/OrderContext";
// import { useAuth } from "../../utils/AuthContext";
// import axios from '../../utils/axiosConfig';
// import AlertModal from '../AlertModal';
// import "../css/CartModal.css";

// Static data to replace API calls
const STATIC_CART_DATA = {
  id: 'cart123',
  shopId: 'shop456',
  items: [
    { itemId: 'item1', name: 'Burger', quantity: 2, price: 150 },
    { itemId: 'item2', name: 'Fries', quantity: 1, price: 75 },
    { itemId: 'item3', name: 'Soda', quantity: 3, price: 35 },
  ],
  totalPrice: 330, // 150*2 + 75 + 35*3
};

const STATIC_SHOP_DATA = {
  id: 'shop456',
  name: 'Burger Junction',
  address: '123 Food Street, Foodville',
  deliveryFee: 50,
};

const CartScreen = () => {
    // Original context and auth hooks commented out
    // const { currentUser } = useAuth();
    // const { cartData: contextCartData, fetchData } = useOrderContext();
    // const navigate = useNavigate();
    
    const [cartData, setCartData] = useState(STATIC_CART_DATA);
    const [shopData, setShopData] = useState(STATIC_SHOP_DATA);
    
    const [alertModal, setAlertModal] = useState({
        isVisible: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: true,
    });

    const handleProceed = () => {
        console.log('Proceeding to checkout');
        router.push('/checkout');
    };

    // Original fetchCartData function commented out
    const fetchCartData = useCallback(async () => {
        // try {
        //     const response = await axios.get(`/carts/cart`, {
        //         params: { uid: currentUser.id }
        //     });
        //     setCartData(response.data);
        // } catch (error) {
        //     console.error('Error fetching cart data:', error);
        // }
        console.log('fetchCartData would be called here');
        // Using static data instead
        setCartData(STATIC_CART_DATA);
    }, [/* currentUser */]);

    // Original useEffect commented out
    useEffect(() => {
        fetchCartData();
        // Adding navigation focus listener would go here
        // const unsubscribe = navigation.addListener('focus', () => {
        //    fetchCartData();
        // });
        // return unsubscribe;
    }, [/* navigation, currentUser, */ fetchCartData /* contextCartData */]);

    // Original useEffect for fetching shop data commented out
    useEffect(() => {
        const fetchShopData = async () => {
            if (cartData && cartData.id) {
                // try {
                //     const response = await axios.get(`/shops/${cartData.shopId}`);
                //     setShopData(response.data);
                // } catch (error) {
                //     console.error('Error fetching shop data:', error);
                // }
                console.log('fetchShopData would be called here');
                // Using static data instead
                setShopData(STATIC_SHOP_DATA);
            }
        };
        fetchShopData();
    }, [cartData]);

    // Original updateCartItem function commented out
    const updateCartItem = async (itemId, action) => {
        // try {
        //     const response = await axios.post('/carts/update-cart-item', {
        //         uid: currentUser.id,
        //         itemId,
        //         action
        //     });
        //     setCartData(response.data.cartData);
        //     fetchData();
        //     fetchCartData();
        // } catch (error) {
        //     if (error.response && error.response.status === 400) {
        //         setAlertModal({
        //             isOpen: true,
        //             title: 'Error',
        //             message: 'Quantity limit reached',
        //             showConfirmButton: false,
        //         });
        //     } else {
        //         console.error(error.response);
        //     }
        // }
        
        console.log(`updateCartItem would call API with action: ${action}`);
        let updatedCartData = { ...cartData };
        const itemIndex = updatedCartData.items.findIndex(item => item.itemId === itemId);
        
        if (itemIndex !== -1) {
            if (action === 'increase') {
                updatedCartData.items[itemIndex].quantity += 1;
            } else if (action === 'decrease') {
                updatedCartData.items[itemIndex].quantity -= 1;
            } else if (action === 'remove') {
                updatedCartData.items = updatedCartData.items.filter(item => item.itemId !== itemId);
            }
            
            updatedCartData.totalPrice = updatedCartData.items.reduce(
                (total, item) => total + (item.price * item.quantity), 0
            );
            
            setCartData(updatedCartData);
        }
    };

    const handleItemIncrease = (item) => {
        updateCartItem(item.itemId, 'increase');
    };

    const handleItemDecrease = (item) => {
        updateCartItem(item.itemId, 'decrease');
    };

    const handleItemRemove = (item) => {
        setAlertModal({
            isVisible: true,
            title: "Confirm to Remove",
            message: `Are you sure you want to remove ${item.name} from your cart?`,
            onConfirm: () => updateCartItem(item.itemId, 'remove'),
            showConfirmButton: true,
        });
    };

    // Original handleShopRemove function commented out
    const handleShopRemove = async () => {
        setAlertModal({
            isVisible: true,
            title: "Confirm to Remove Shop",
            message: `Are you sure you want to remove ${shopData.name}? This will remove all items in your cart.`,
            onConfirm: async () => {
                // try {
                //     const response = await axios.delete('/carts/remove-cart', {
                //         data: { uid: currentUser.id }
                //     });
                //     setCartData(null);
                //     fetchData();
                //     fetchCartData();
                //     setAlertModal({
                //         isOpen: true,
                //         title: 'Success',
                //         message: response.data.message,
                //         showConfirmButton: false,
                //     });
                // } catch (error) {
                //     console.error('Error removing cart:', error);
                // }
                
                console.log('handleShopRemove would call API here');
                setCartData({...cartData, items: [], totalPrice: 0});
                setAlertModal({
                    isVisible: true,
                    title: 'Success',
                    message: 'Cart cleared successfully',
                    showConfirmButton: false,
                    onConfirm: null
                });
                
                setTimeout(() => {
                    setAlertModal((prev) => ({ ...prev, isVisible: false }));
                }, 3000);
            },
            showConfirmButton: true,
        });
    };

    // Original handleProceedToCheckout function commented out
    const handleProceedToCheckout = () => {
        // navigate(`/checkout/${currentUser.id}/${cartData.shopId}`);
        console.log(`Would navigate to checkout for shop ${cartData.shopId}`);
        // navigation.navigate('Checkout', { shopId: cartData.shopId });
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
                        {!cartData || cartData.items.length === 0 ? (
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
                                            <Text style={styles.storeName}>{shopData ? shopData.name : 'Store Name'}</Text>
                                            <View style={styles.storeAddressContainer}>
                                                <AntDesign 
                                                    name="enviroment" 
                                                    size={14} 
                                                    color="#666666" 
                                                    style={styles.locationIcon}
                                                />
                                                <Text style={styles.storeAddress}>{shopData ? shopData.address : 'Store Address'}</Text>
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
                        {cartData && cartData.items.map(item => (
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
                                        <Text style={styles.itemDescription}>More Description</Text>
                                    </View>
                                </View>
                                <View style={styles.itemRight}>
                                    <Text style={styles.itemPrice}>₱{item.price}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
                
                <View style={styles.footer}>
                    <View style={styles.subtotal}>
                        <Text style={styles.subtotalLabel}>Subtotal</Text>
                        <Text style={styles.subtotalValue}>₱{cartData ? cartData.totalPrice : '0.00'}</Text>
                    </View>
                    <View style={styles.subtotal}>
                        <Text style={styles.subtotalLabel}>Delivery Fee</Text>
                        <Text style={styles.subtotalValue}>₱{shopData ? shopData.deliveryFee : '0.00'}</Text>
                    </View>
                    <View style={styles.total}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>
                            ₱{cartData && shopData ? (cartData.totalPrice + shopData.deliveryFee).toFixed(2) : '0.00'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        disabled={!cartData || cartData.items.length === 0}
                        style={[
                            styles.proceedButton,
                            (!cartData || cartData.items.length === 0) && styles.disabledButton
                        ]}
                        onPress={handleProceed}
                    >
                        <Text style={styles.proceedButtonText}>Proceed to Checkout</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F8F8',
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
        paddingTop: 20,
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
        padding: 20,
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
        marginBottom: 10,
    },
    subtotalLabel: {
        fontSize: 16,
        color: '#666666',
    },
    subtotalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333333',
    },
    total: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    totalLabel: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#BC4A4D',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#BC4A4D',
    },
    proceedButton: {
        backgroundColor: '#BC4A4D',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    proceedButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    disabledButton: {
        backgroundColor: '#CCCCCC',
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
});

export default CartScreen;