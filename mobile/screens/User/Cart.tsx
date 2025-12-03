import BottomNavigation from "@/components/BottomNavigation"
import { AntDesign } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "axios"
import { router, useLocalSearchParams } from "expo-router"
import { styled } from "nativewind"
import { useCallback, useEffect, useRef, useState } from "react"
import { Animated, Image, Modal, SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native"
import { API_URL } from "../../config"
import { AUTH_TOKEN_KEY } from "../../services/authService"

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
    image?: string
    imageUrl?: string
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
    imageUrl?: string
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

    const [shopCarts, setShopCarts] = useState<Array<{ shopId: string, items: CartItem[], totalPrice: number, shop?: ShopData }>>([])
    // Read optional route params (e.g. ?shopId=... when navigating from preview)
    const params = useLocalSearchParams()
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

            // If a shopId param is provided, include it so the backend returns the cart for that shop.
            const requestParams: any = { uid: userId }
            if (params && (params as any).shopId) {
                requestParams.shopId = (params as any).shopId
            }

            let response
            try {
                response = await axios.get(`${API_URL}/api/carts/cart`, {
                    params: requestParams,
                    headers: { Authorization: token },
                })
            } catch (err) {
                // If server error or not found, try to load a local fallback cart for the shop
                console.log('Cart fetch error, trying local fallback:', err)
                const rawLocal = await AsyncStorage.getItem('@local_carts')
                if (rawLocal) {
                    try {
                        const localCarts = JSON.parse(rawLocal)
                        const local = requestParams.shopId ? localCarts[requestParams.shopId] : Object.values(localCarts || {})
                        if (local) {
                            // normalize local into array
                            response = { data: Array.isArray(local) ? local : [local] }
                        } else {
                            throw err
                        }
                    } catch (parseErr) {
                        console.log('Failed to parse local carts:', parseErr)
                        throw err
                    }
                } else {
                    throw err
                }
            }

            // Normalize backend response into array of shop carts
            let shopsArray: any[] = []
            const data = response?.data
            if (!data) shopsArray = []
            else if (Array.isArray(data)) shopsArray = data
            else if (Array.isArray(data.shops)) shopsArray = data.shops
            else if (data.shopId && data.items) shopsArray = [{ shopId: data.shopId, items: data.items, totalPrice: data.totalPrice || 0 }]
            else if (data.shopId && data.items == null && data.items === undefined && data.items !== null) shopsArray = []
            else if (data.items && data.shopId == null) shopsArray = Array.isArray(data) ? data : []
            else shopsArray = data.shops ? (Array.isArray(data.shops) ? data.shops : [data.shops]) : []

            const enhancedShops = await Promise.all(shopsArray.map(async (sc: any) => {
                const items = sc.items || []
                const itemsWithImages = await Promise.all(items.map(async (cartItem: CartItem) => {
                    try {
                        const itemResponse = await axios.get(`${API_URL}/api/items/${cartItem.itemId}`, { headers: { Authorization: token } })
                        return { ...cartItem, imageUrl: itemResponse.data.imageUrl, description: itemResponse.data.description || cartItem.description }
                    } catch (itemError) {
                        console.log(`Error fetching item ${cartItem.itemId}:`, itemError)
                        return cartItem
                    }
                }))

                let shopInfo = undefined
                try {
                    const shopResp = await axios.get(`${API_URL}/api/shops/${sc.shopId}`, { headers: { Authorization: token } })
                    shopInfo = shopResp.data
                } catch (e) { console.log('Failed to fetch shop info for', sc.shopId, e) }

                return { shopId: sc.shopId, items: itemsWithImages, totalPrice: sc.totalPrice || 0, shop: shopInfo }
            }))

            setShopCarts(enhancedShops)
        } catch (error) {
            console.log("Cart data unavailable:", error)
        } finally {
            setIsLoading(false)
        }
    }, [params?.shopId])

    useEffect(() => {
        fetchCartData()
    }, [fetchCartData])

    const updateCartItem = async (itemId: string, action: "increase" | "decrease" | "remove") => {
        try {
            const userId = await AsyncStorage.getItem("userId")
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)

            if (!userId || !token) return

            await axios.post(
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

            // Re-fetch cart to get latest state
            await fetchCartData()
        } catch (error) {
            console.log("Cart update unavailable:", error)
        }
    }

    const handleItemIncrease = (item: CartItem) => updateCartItem(item.itemId, "increase")
    const handleItemDecrease = (item: CartItem) => updateCartItem(item.itemId, "decrease")
    const handleItemRemove = (item: CartItem) => {
        setAlertModal({
            isVisible: true,
            title: "Remove Item",
            message: `Remove ${item.name} from cart?`,
            onConfirm: async () => {
                await updateCartItem(item.itemId, "remove")
                setAlertModal(prev => ({ ...prev, isVisible: false }))
            },
            showConfirmButton: true,
        })
    }

    const clearShop = (shopId: string, shopName?: string) => {
        setAlertModal({
            isVisible: true,
            title: "Clear Cart",
            message: `Remove all items from ${shopName || 'this shop'}?`,
            onConfirm: async () => {
                try {
                    const userId = await AsyncStorage.getItem("userId")
                    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)
                    if (!userId || !token) return

                    await axios.delete(`${API_URL}/api/carts/remove-cart`, {
                        data: { uid: userId, shopId },
                        headers: { Authorization: token },
                    })

                    // Immediately update local state to remove this shop's cart
                    setShopCarts(prevCarts => prevCarts.filter(cart => cart.shopId !== shopId))
                    
                    setAlertModal(prev => ({ ...prev, isVisible: false }))
                } catch (error) {
                    console.log("Shop cart removal unavailable:", error)
                    setAlertModal(prev => ({ ...prev, isVisible: false }))
                }
            },
            showConfirmButton: true,
        })
    }

    // Note: global "Clear All" removed per request; keep per-shop clear only.

    const proceedToCheckout = (shopId: string) => {
        router.push({ pathname: "/checkout", params: { shopId } })
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
            <StyledView 
                className="bg-white py-5"
                style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                }}
            >
                <StyledText className="text-2xl font-bold text-[#8B4513] text-center">Your Cart</StyledText>
            </StyledView>

            <StyledView className="flex-1 px-4 pt-4">
                {isLoading ? (
                    <StyledView className="flex-1 justify-center items-center">
                        <StyledView className="items-center">
                            {/* Spinning Logo Container */}
                            <StyledView className="relative mb-6">
                                {/* Outer circular loading line */}
                                <Animated.View
                                    style={{
                                        transform: [{ rotate: circleRotation }],
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
                                <StyledView className="w-16 h-16 rounded-full bg-[#BC4A4D]/10 items-center justify-center mx-2 my-2">
                                    <Animated.View
                                        style={{
                                            transform: [{ rotate: spin }],
                                        }}
                                    >
                                        <StyledImage
                                            source={require('../../assets/images/logo.png')}
                                            style={{ width: 40, height: 40 }}
                                            resizeMode="contain"
                                        />
                                    </Animated.View>
                                </StyledView>
                            </StyledView>
                            
                            {/* Brand Name */}
                            <StyledText className="text-lg font-bold mb-4">
                                <StyledText className="text-[#BC4A4DFF]">Campus</StyledText>
                                <StyledText className="text-[#DAA520]">Eats</StyledText>
                            </StyledText>
                            
                            {/* Loading Text */}
                            <StyledText className="text-[#BC4A4D] text-base font-semibold">
                                Loading...
                            </StyledText>
                        </StyledView>
                    </StyledView>
                ) : shopCarts.length === 0 ? (
                    <StyledView className="flex-1 justify-center items-center">
                        <StyledView 
                            className="bg-white p-8 rounded-2xl items-center mx-4"
                            style={{
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.1,
                                shadowRadius: 12,
                                elevation: 6,
                            }}
                        >
                            <StyledView className="w-16 h-16 bg-[#DFD6C5]/30 rounded-full items-center justify-center mb-4">
                                <StyledText className="text-3xl">🛒</StyledText>
                            </StyledView>
                            <StyledText className="text-xl font-bold text-[#8B4513] mb-2">Your cart is empty</StyledText>
                            <StyledText className="text-[#8B4513]/60 text-center text-base">Start browsing and add your favorite items</StyledText>
                        </StyledView>
                    </StyledView>
                ) : (
                    <>
                        {/* Render each shop cart as a section */}
                        <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                            {shopCarts.map((sc) => (
                                <StyledView key={sc.shopId} className="mb-4">
                                    {/* Shop Header */}
                                    <StyledView
                                        className="bg-white rounded-2xl p-5 mb-3"
                                        style={{
                                            shadowColor: "#000",
                                            shadowOffset: { width: 0, height: 3 },
                                            shadowOpacity: 0.08,
                                            shadowRadius: 8,
                                            elevation: 3,
                                        }}
                                    >
                                        <StyledView className="flex-row items-center justify-between">
                                                <StyledView className="flex-row items-center flex-1">
                                                    {sc.shop?.imageUrl ? (
                                                        <StyledImage
                                                            source={{ uri: sc.shop.imageUrl }}
                                                            className="w-12 h-12 rounded-full mr-3"
                                                            resizeMode="cover"
                                                        />
                                                    ) : (
                                                        <StyledView className="w-12 h-12 rounded-full bg-[#DFD6C5] items-center justify-center mr-3">
                                                            <StyledText className="text-lg font-bold text-[#BC4A4D]">{(sc.shop?.name?.[0] || 'S').toUpperCase()}</StyledText>
                                                        </StyledView>
                                                    )}

                                                    <StyledView className="flex-1">
                                                        <StyledText className="text-lg font-bold text-[#8B4513] mb-2">{sc.shop?.name || 'Shop'}</StyledText>
                                                        <StyledView className="flex-row items-center">
                                                            <StyledView className="w-2 h-2 bg-[#BC4A4D] rounded-full mr-2" />
                                                            <StyledText className="text-sm text-[#8B4513]/70 font-medium">{sc.shop?.address || ''}</StyledText>
                                                        </StyledView>
                                                    </StyledView>
                                                </StyledView>
                                            <StyledTouchableOpacity 
                                                className="bg-[#BC4A4D] px-4 py-2.5 rounded-xl" 
                                                onPress={() => clearShop(sc.shopId, sc.shop?.name)}
                                                style={{
                                                    shadowColor: "#BC4A4D",
                                                    shadowOffset: { width: 0, height: 2 },
                                                    shadowOpacity: 0.2,
                                                    shadowRadius: 4,
                                                    elevation: 2,
                                                }}
                                            >
                                                <StyledText className="text-white font-bold text-xs">Clear</StyledText>
                                            </StyledTouchableOpacity>
                                        </StyledView>
                                    </StyledView>

                                    {/* Items List for this shop */}
                                    {sc.items.map((item) => (
                                        <StyledView
                                            key={item.itemId}
                                            className="bg-white rounded-xl p-4 mb-3"
                                            style={{
                                                shadowColor: "#000",
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.06,
                                                shadowRadius: 6,
                                                elevation: 2,
                                            }}
                                        >
                                            <StyledView className="flex-row items-center">
                                                <StyledView className="mr-4">
                                                    {(item.image || item.imageUrl) ? (
                                                        <StyledImage
                                                            source={{ uri: item.image || item.imageUrl }}
                                                            className="w-16 h-16 rounded-xl"
                                                            resizeMode="cover"
                                                        />
                                                    ) : (
                                                        <StyledView 
                                                            className="w-16 h-16 rounded-xl bg-[#DFD6C5]/50 items-center justify-center"
                                                        >
                                                            <StyledText className="text-2xl">🍽️</StyledText>
                                                        </StyledView>
                                                    )}
                                                </StyledView>

                                                <StyledView className="flex-1">
                                                    <StyledText className="text-base font-bold text-[#8B4513] mb-1">{item.name}</StyledText>
                                                    <StyledText className="text-sm text-[#8B4513]/60 leading-4 mb-2">{item.description || 'Item'}</StyledText>

                                                    <StyledView className="flex-row items-center bg-[#DFD6C5]/30 rounded-full p-1 self-start">
                                                        <StyledTouchableOpacity
                                                            className="w-7 h-7 rounded-full bg-white items-center justify-center"
                                                            onPress={() => (item.quantity > 1 ? handleItemDecrease(item) : handleItemRemove(item))}
                                                        >
                                                            <AntDesign name={item.quantity > 1 ? "minus" : "delete"} size={12} color="#8B4513" />
                                                        </StyledTouchableOpacity>

                                                        <StyledText className="mx-3 text-sm font-bold text-[#8B4513] min-w-[20px] text-center">{item.quantity}</StyledText>

                                                        <StyledTouchableOpacity
                                                            className="w-7 h-7 rounded-full bg-[#BC4A4D] items-center justify-center"
                                                            onPress={() => handleItemIncrease(item)}
                                                        >
                                                            <AntDesign name="plus" size={12} color="white" />
                                                        </StyledTouchableOpacity>
                                                    </StyledView>
                                                </StyledView>

                                                <StyledView className="items-end ml-3">
                                                    <StyledText className="text-base font-bold text-[#BC4A4D]">₱{item.price.toFixed(2)}</StyledText>
                                                    <StyledText className="text-xs text-[#8B4513]/50 mt-0.5">per item</StyledText>
                                                </StyledView>
                                            </StyledView>
                                        </StyledView>
                                    ))}

                                    {/* Shop summary */}
                                    <StyledView
                                        className="bg-white rounded-t-2xl p-5 mt-1"
                                    >
                                        <StyledText className="text-lg font-bold text-[#8B4513] mb-4">Order Summary</StyledText>

                                        <StyledView className="flex-row justify-between mb-3">
                                            <StyledText className="text-base text-[#8B4513]/70 font-medium">Subtotal</StyledText>
                                            <StyledText className="text-base font-semibold text-[#8B4513]">₱{(sc.totalPrice || 0).toFixed(2)}</StyledText>
                                        </StyledView>

                                        <StyledView className="flex-row justify-between mb-4">
                                            <StyledText className="text-base text-[#8B4513]/70 font-medium">Delivery Fee</StyledText>
                                            <StyledText className="text-base font-semibold text-[#8B4513]">₱{(sc.shop?.deliveryFee || 0).toFixed(2)}</StyledText>
                                        </StyledView>

                                        <StyledView className="h-px bg-[#8B4513]/20 mb-4" />

                                        <StyledView className="flex-row justify-between mb-6">
                                            <StyledText className="text-lg font-bold text-[#8B4513]">Total Amount</StyledText>
                                            <StyledText className="text-lg font-bold text-[#BC4A4D]">₱{(((sc.totalPrice || 0) + (sc.shop?.deliveryFee || 0))).toFixed(2)}</StyledText>
                                        </StyledView>

                                        <StyledTouchableOpacity
                                            className="bg-[#BC4A4D] py-4 rounded-xl items-center"
                                            onPress={() => proceedToCheckout(sc.shopId)}
                                        >
                                            <StyledText className="text-white font-bold text-lg">Proceed to Checkout</StyledText>
                                        </StyledTouchableOpacity>
                                    </StyledView>
                                </StyledView>
                            ))}
                        </StyledScrollView>

                        {/* (Global Clear All removed) */}
                    </>
                )}
            </StyledView>
            <BottomNavigation activeTab="Cart" />
        </SafeAreaView>
    )
}

export default CartScreen;
