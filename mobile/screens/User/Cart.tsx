import { useState, useCallback, useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Modal, Alert, Animated, Image } from "react-native"
import { AntDesign } from "@expo/vector-icons"
import { router } from "expo-router"
import axios from "axios"
import { API_URL } from "../../config"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { AUTH_TOKEN_KEY } from "../../services/authService"
import BottomNavigation from "@/components/BottomNavigation"
import { styled } from "nativewind"

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledScrollView = styled(ScrollView)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledImage = styled(Image)

interface CartItem {
    itemId: string
    name: string
    description?: string
    quantity: number
    price: number
}

interface CartData {
    id: string
    shopId: string
    items: CartItem[]
    totalPrice: number
}

interface ShopData {
    id: string
    name: string
    address: string
    deliveryFee: number
}

interface AlertModalState {
    isVisible: boolean
    title: string
    message: string
    onConfirm: (() => Promise<void>) | null
    showConfirmButton: boolean
}

const CartScreen = () => {
    // Animated values for spinning logo
    const spinValue = useRef(new Animated.Value(0)).current;
    const circleValue = useRef(new Animated.Value(0)).current;

    const [cartData, setCartData] = useState<CartData | null>(null)
    const [shopData, setShopData] = useState<ShopData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [alertModal, setAlertModal] = useState<AlertModalState>({
        isVisible: false,
        title: "",
        message: "",
        onConfirm: null,
        showConfirmButton: true,
    })

    // Spinning logo animation
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

        if (isLoading) {
            startAnimations();
        }
    }, [isLoading, spinValue, circleValue]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const circleRotation = circleValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const fetchCartData = useCallback(async () => {
        try {
            const userId = await AsyncStorage.getItem("userId")
            if (!userId) {
                console.log("No user ID found")
                return
            }

            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)
            if (!token) {
                console.log("No auth token found")
                return
            }

            const response = await axios.get(`${API_URL}/api/carts/cart`, {
                params: { uid: userId },
                headers: { Authorization: token },
            })

            setCartData(response.data)

            if (response.data && response.data.shopId) {
                const shopResponse = await axios.get(`${API_URL}/api/shops/${response.data.shopId}`, {
                    headers: { Authorization: token },
                })
                setShopData(shopResponse.data)
            }
        } catch (error) {
            console.log("Cart data unavailable:", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCartData()
    }, [fetchCartData])

    const updateCartItem = async (itemId: string, action: "increase" | "decrease" | "remove") => {
        try {
            const userId = await AsyncStorage.getItem("userId")
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)

            if (!userId || !token) return

            const response = await axios.post(
                `${API_URL}/api/carts/update-cart-item`,
                {
                    uid: userId,
                    itemId,
                    action,
                },
                {
                    headers: { Authorization: token },
                },
            )

            setCartData(response.data.cartData)

            if (response.data.cartData && response.data.cartData.shopId) {
                const shopResponse = await axios.get(`${API_URL}/api/shops/${response.data.cartData.shopId}`, {
                    headers: { Authorization: token },
                })
                setShopData(shopResponse.data)
            }
        } catch (error) {
            console.log("Cart update unavailable:", error)
        }
    }

    const handleItemIncrease = (item: CartItem) => {
        updateCartItem(item.itemId, "increase")
    }

    const handleItemDecrease = (item: CartItem) => {
        updateCartItem(item.itemId, "decrease")
    }

    const handleItemRemove = (item: CartItem) => {
        setAlertModal({
            isVisible: true,
            title: "Remove Item",
            message: `Remove ${item.name} from cart?`,
            onConfirm: async () => {
                await updateCartItem(item.itemId, "remove")
                setAlertModal({ ...alertModal, isVisible: false })
            },
            showConfirmButton: true,
        })
    }

    const handleShopRemove = async () => {
        setAlertModal({
            isVisible: true,
            title: "Clear Cart",
            message: `Remove all items from ${shopData?.name}?`,
            onConfirm: async () => {
                try {
                    const userId = await AsyncStorage.getItem("userId")
                    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)

                    if (!userId || !token) return

                    await axios.delete(`${API_URL}/api/carts/remove-cart`, {
                        data: { uid: userId },
                        headers: { Authorization: token },
                    })

                    setCartData(null)
                    setShopData(null)
                    Alert.alert("Success", "Cart cleared successfully")
                } catch (error) {
                    console.log("Cart removal unavailable:", error)
                } finally {
                    setAlertModal({ ...alertModal, isVisible: false })
                }
            },
            showConfirmButton: true,
        })
    }

    const handleProceed = () => {
        if (!cartData || !shopData) return
        router.push({
            pathname: "/checkout",
            params: { shopId: cartData.shopId },
        })
    }

    const AlertModalComponent = () => (
        <Modal
            transparent={true}
            visible={alertModal.isVisible}
            animationType="fade"
            onRequestClose={() => setAlertModal({ ...alertModal, isVisible: false })}
        >
            <StyledView className="flex-1 justify-center items-center bg-black/50 px-5">
                <StyledView
                    className="bg-white rounded-2xl p-5 w-full max-w-sm"
                    style={{
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 5,
                    }}
                >
                    <StyledText className="text-lg font-bold text-[#8B4513] mb-3 text-center">{alertModal.title}</StyledText>
                    <StyledText className="text-sm text-[#8B4513]/70 mb-5 text-center leading-5">{alertModal.message}</StyledText>
                    <StyledView className="flex-row gap-3">
                        <StyledTouchableOpacity
                            className="flex-1 py-2.5 bg-gray-100 rounded-xl items-center"
                            onPress={() => setAlertModal({ ...alertModal, isVisible: false })}
                        >
                            <StyledText className="text-[#8B4513] font-semibold text-sm">Cancel</StyledText>
                        </StyledTouchableOpacity>
                        {alertModal.showConfirmButton && (
                            <StyledTouchableOpacity
                                className="flex-1 py-2.5 bg-[#BC4A4D] rounded-xl items-center"
                                onPress={() => {
                                    if (alertModal.onConfirm) alertModal.onConfirm()
                                    setAlertModal({ ...alertModal, isVisible: false })
                                }}
                            >
                                <StyledText className="text-white font-semibold text-sm">Confirm</StyledText>
                            </StyledTouchableOpacity>
                        )}
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    )

    return (
        <SafeAreaView className="flex-1 bg-[#DFD6C5]">
            <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
            <AlertModalComponent />

            {/* Header */}
            <StyledView className="bg-white py-4">
                <StyledText className="text-2xl font-bold text-[#000] text-center">Your Cart</StyledText>
            </StyledView>

            <StyledView className="flex-1 px-4 pt-4">
                {isLoading ? (
                    <StyledView className="flex-1 justify-center items-center">
                        {/* Circular Loading Line with Spinning Logo */}
                        <StyledView className="justify-center items-center">
                            {/* Outer circular loading line */}
                            <Animated.View
                                style={{
                                    transform: [{ rotate: circleRotation }],
                                    width: 100,
                                    height: 100,
                                    borderRadius: 50,
                                    borderWidth: 3,
                                    borderColor: 'transparent',
                                    borderTopColor: '#BC4A4D',
                                    borderRightColor: '#BC4A4D',
                                    position: 'absolute',
                                }}
                            />
                            
                            {/* Inner spinning logo */}
                            <Animated.View
                                style={{
                                    transform: [{ rotate: spin }],
                                    width: 100,
                                    height: 100,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <StyledImage
                                    source={require('../../assets/images/logo.png')}
                                    className="w-16 h-16 rounded-full"
                                    style={{ resizeMode: 'contain' }}
                                />
                            </Animated.View>
                        </StyledView>
                        
                        {/* Loading Text */}
                        <StyledText className="text-[#BC4A4D] text-base font-medium mt-6">
                            Loading please wait
                        </StyledText>
                    </StyledView>
                ) : !cartData || cartData.items.length === 0 ? (
                    <StyledView className="flex-1 justify-center items-center">
                        <StyledView className="bg-white p-6 rounded-2xl items-center">
                            <StyledText className="text-4xl mb-3">🛒</StyledText>
                            <StyledText className="text-xl font-bold text-[#000] mb-2">Empty Cart</StyledText>
                            <StyledText className="text-[#8B4513]/70 text-center">Add items to get started</StyledText>
                        </StyledView>
                    </StyledView>
                ) : (
                    <>
                        {/* Shop Info */}
                        <StyledView
                            className="bg-white rounded-2xl p-4 mb-4"
                            style={{
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.05,
                                shadowRadius: 6,
                                elevation: 2,
                            }}
                        >
                            <StyledView className="flex-row items-center justify-between">
                                <StyledView className="flex-1">
                                    <StyledText className="text-lg font-bold text-[#8B4513] mb-1">{shopData?.name}</StyledText>
                                    <StyledText className="text-sm text-[#8B4513]/60">📍 {shopData?.address}</StyledText>
                                </StyledView>
                                <StyledTouchableOpacity className="bg-[#BC4A4D] px-3 py-2 rounded-xl" onPress={handleShopRemove}>
                                    <StyledText className="text-white font-semibold text-xs">Clear</StyledText>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>

                        {/* Items List */}
                        <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            {cartData?.items.map((item) => (
                                <StyledView
                                    key={item.itemId}
                                    className="bg-white rounded-xl p-3 mb-3"
                                    style={{
                                        shadowColor: "#000",
                                        shadowOffset: { width: 0, height: 1 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 4,
                                        elevation: 1,
                                    }}
                                >
                                    <StyledView className="flex-row items-center">
                                        {/* Quantity Controls */}
                                        <StyledView className="flex-row items-center bg-gray-50 rounded-full p-1 mr-3">
                                            <StyledTouchableOpacity
                                                className="w-7 h-7 rounded-full bg-white items-center justify-center"
                                                onPress={() => (item.quantity > 1 ? handleItemDecrease(item) : handleItemRemove(item))}
                                            >
                                                <AntDesign name={item.quantity > 1 ? "minus" : "delete"} size={12} color="#8B4513" />
                                            </StyledTouchableOpacity>

                                            <StyledText className="mx-3 text-sm font-bold text-[#8B4513] min-w-[20px] text-center">
                                                {item.quantity}
                                            </StyledText>

                                            <StyledTouchableOpacity
                                                className="w-7 h-7 rounded-full bg-[#BC4A4D] items-center justify-center"
                                                onPress={() => handleItemIncrease(item)}
                                            >
                                                <AntDesign name="plus" size={12} color="white" />
                                            </StyledTouchableOpacity>
                                        </StyledView>

                                        {/* Item Info */}
                                        <StyledView className="flex-1">
                                            <StyledText className="text-sm font-bold text-[#8B4513] mb-1">{item.name}</StyledText>
                                            <StyledText className="text-xs text-[#8B4513]/60">
                                                {item.description || "No description"}
                                            </StyledText>
                                        </StyledView>

                                        {/* Price */}
                                        <StyledText className="text-sm font-bold text-[#BC4A4D] ml-2">₱{item.price.toFixed(2)}</StyledText>
                                    </StyledView>
                                </StyledView>
                            ))}
                        </StyledScrollView>

                        {/* Checkout Summary */}
                        <StyledView
                            className="bg-white rounded-t-2xl p-4 mt-3"
                            style={{
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: -2 },
                                shadowOpacity: 0.05,
                                shadowRadius: 8,
                                elevation: 3,
                            }}
                        >
                            <StyledView className="flex-row justify-between mb-2">
                                <StyledText className="text-sm text-[#8B4513]/70">Subtotal</StyledText>
                                <StyledText className="text-sm font-semibold text-[#8B4513]">
                                    ₱{cartData.totalPrice.toFixed(2)}
                                </StyledText>
                            </StyledView>

                            <StyledView className="flex-row justify-between mb-3">
                                <StyledText className="text-sm text-[#8B4513]/70">Delivery Fee</StyledText>
                                <StyledText className="text-sm font-semibold text-[#8B4513]">
                                    ₱{shopData?.deliveryFee?.toFixed(2) || "0.00"}
                                </StyledText>
                            </StyledView>

                            <StyledView className="flex-row justify-between mb-4 pt-3 border-t border-gray-100">
                                <StyledText className="text-base font-bold text-[#8B4513]">Total</StyledText>
                                <StyledText className="text-base font-bold text-[#BC4A4D]">
                                    ₱{((cartData.totalPrice || 0) + (shopData?.deliveryFee || 0)).toFixed(2)}
                                </StyledText>
                            </StyledView>

                            <StyledTouchableOpacity
                                className="bg-[#BC4A4D] py-3 rounded-xl items-center"
                                onPress={handleProceed}
                                style={{
                                    shadowColor: "#BC4A4D",
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 4,
                                    elevation: 3,
                                }}
                            >
                                <StyledText className="text-white font-bold text-base">Proceed to Checkout</StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </>
                )}
            </StyledView>
            <BottomNavigation activeTab="Cart" />
        </SafeAreaView>
    )
}

export default CartScreen;
