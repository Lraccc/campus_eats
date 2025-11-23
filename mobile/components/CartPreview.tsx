import React, { useEffect, useState, useCallback, useRef } from "react"
import { View, Text, TouchableOpacity, ActivityIndicator, Image, Modal } from "react-native"
import { styled } from "nativewind"
import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { router } from "expo-router"
import { API_URL } from "../config"
import { AUTH_TOKEN_KEY } from "../services/authService"
import { MaterialIcons } from '@expo/vector-icons'
import { Swipeable } from 'react-native-gesture-handler'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledImage = styled(Image)

interface CartItem {
    itemId: string
    name: string
    quantity: number
    price: number
}

interface CartData {
    id: string
    shopId: string
    items: CartItem[]
    totalPrice: number
}

interface ShopInfo {
    id: string
    name?: string
    deliveryFee?: number
    imageUrl?: string
}

const CartPreview = () => {
    const [loading, setLoading] = useState(true)
    const [carts, setCarts] = useState<Array<CartData & { shop?: ShopInfo }>>([])
    const LOCAL_CARTS_KEY = '@local_carts'
    const [confirmVisible, setConfirmVisible] = useState(false)
    const [selectedShop, setSelectedShop] = useState<{ shopId: string, shopName?: string } | null>(null)
    const [removing, setRemoving] = useState(false)
    const swipeRefs = useRef<Record<string, Swipeable | null>>({})
    const [errorVisible, setErrorVisible] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const fetchCarts = useCallback(async () => {
        try {
            setLoading(true)
            const userId = await AsyncStorage.getItem("userId")
            if (!userId) return
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)
            if (!token) return

            const response = await axios.get(`${API_URL}/api/carts/cart`, {
                params: { uid: userId },
                headers: { Authorization: token },
            })

            // Normalize possible backend response shapes:
            // - Array of shop carts
            // - Single shop cart object with shopId
            // - CartEntity with `.shops` array
            let rawCarts: CartData[] = []
            const respData = response.data
            if (!respData) {
                rawCarts = []
            } else if (Array.isArray(respData)) {
                rawCarts = respData
            } else if (Array.isArray(respData.shops)) {
                // CartEntity shape
                rawCarts = respData.shops.map((s: any) => ({ id: s.id || s.shopId, shopId: s.shopId, items: s.items || [], totalPrice: s.totalPrice || 0 }))
            } else if (respData.shops) {
                // single shop in .shops
                rawCarts = [{ id: respData.shops.id || respData.shops.shopId, shopId: respData.shops.shopId, items: respData.shops.items || [], totalPrice: respData.shops.totalPrice || 0 }]
            } else if (respData.shopId) {
                rawCarts = [{ id: respData.id || respData.shopId, shopId: respData.shopId, items: respData.items || [], totalPrice: respData.totalPrice || 0 }]
            } else {
                rawCarts = []
            }

            // Fetch shop info for each cart (name, delivery fee)
            const cartsWithShop = await Promise.all(
                rawCarts.map(async (c) => {
                    try {
                        const shopResp = await axios.get(`${API_URL}/api/shops/${c.shopId}`, {
                            headers: { Authorization: token },
                        })
                        return { ...c, shop: shopResp.data }
                    } catch (e) {
                        console.log(`Failed to fetch shop ${c.shopId}`, e)
                        return { ...c, shop: { id: c.shopId } }
                    }
                })
            )

            // Merge local carts (if any) stored under LOCAL_CARTS_KEY
            try {
                const rawLocal = await AsyncStorage.getItem(LOCAL_CARTS_KEY)
                const localCarts = rawLocal ? JSON.parse(rawLocal) : {}

                // Convert localCarts obj (keys by shopId) to array
                const localArray = Object.keys(localCarts).map((shopId) => ({ ...localCarts[shopId], shop: localCarts[shopId].shop || { id: shopId } }))

                // If any local cart has the same shopId as a server cart, prefer server cart but append missing items from local
                const merged = cartsWithShop.slice()
                localArray.forEach((lc: any) => {
                    const idx = merged.findIndex(m => String(m.shopId) === String(lc.shopId))
                    if (idx === -1) {
                        merged.push(lc)
                    } else {
                        // Merge items that are not present on server cart
                        const existingIds = new Set(merged[idx].items.map((it: any) => String(it.itemId || it.id)))
                        lc.items.forEach((lit: any) => {
                            if (!existingIds.has(String(lit.itemId || lit.id))) merged[idx].items.push(lit)
                        })
                        merged[idx].totalPrice = (merged[idx].totalPrice || 0) + (lc.totalPrice || 0)
                    }
                })

                setCarts(merged)
            } catch (localErr) {
                console.log('Error merging local carts:', localErr)
                setCarts(cartsWithShop)
            }
        } catch (error) {
            console.log("CartPreview fetch error:", error)
            setCarts([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCarts()
    }, [fetchCarts])

    const openRemoveConfirm = (shopId: string, shopName?: string) => {
        setSelectedShop({ shopId, shopName })
        // Close any open swipe row for this shop
        try { swipeRefs.current[shopId]?.close?.() } catch {}
        setConfirmVisible(true)
    }

    // Core removal implementation used by both confirm flow and full-swipe
    const performRemoveShopById = async (shopId: string) => {
        setRemoving(true)
        try {
            const userId = await AsyncStorage.getItem('userId')
            if (!userId) throw new Error('No user')
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)

            // Attempt server removal first
            try {
                await axios.delete(`${API_URL}/api/carts/remove-cart`, {
                    data: { uid: userId, shopId },
                    headers: { Authorization: token || '' },
                })
            } catch (serverErr) {
                console.log('Server remove failed, will still remove local fallback if present', serverErr)
            }

            // Remove from local fallback as well
            try {
                const rawLocal = await AsyncStorage.getItem(LOCAL_CARTS_KEY)
                if (rawLocal) {
                    const localCarts = JSON.parse(rawLocal)
                    if (localCarts && localCarts[shopId]) {
                        delete localCarts[shopId]
                        await AsyncStorage.setItem(LOCAL_CARTS_KEY, JSON.stringify(localCarts))
                    }
                }
            } catch (localErr) {
                console.log('Failed to remove local cart fallback:', localErr)
            }

            // Close any swipe row visually
            try { swipeRefs.current[shopId]?.close?.() } catch {}

            setConfirmVisible(false)
            setSelectedShop(null)
            await fetchCarts()
        } catch (err) {
            console.log('Failed to remove shop cart:', err)
            setConfirmVisible(false)
            setSelectedShop(null)
        } finally {
            setRemoving(false)
        }
    }

    // Wrapper used by the existing Confirm button flow (keeps API)
    const performRemoveShop = async () => {
        if (!selectedShop) return
        await performRemoveShopById(selectedShop.shopId)
    }

    // Optimistic remove: remove locally immediately and then call server. On failure, restore and show error.
    const optimisticRemoveAndCall = async (shopId: string) => {
        // find existing cart snapshot
        const prevCart = carts.find(c => String(c.shopId) === String(shopId))
        if (!prevCart) return

        // Optimistically remove from UI
        setCarts((prev) => prev.filter(c => String(c.shopId) !== String(shopId)))

        // Ensure the swipe row is closed visually
        try { swipeRefs.current[shopId]?.close?.() } catch {}

        // Call backend removal (best-effort)
        try {
            const userId = await AsyncStorage.getItem('userId')
            if (!userId) throw new Error('No user')
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)

            await axios.delete(`${API_URL}/api/carts/remove-cart`, {
                data: { uid: userId, shopId },
                headers: { Authorization: token || '' },
            })

            // Remove from local fallback as well
            try {
                const rawLocal = await AsyncStorage.getItem(LOCAL_CARTS_KEY)
                if (rawLocal) {
                    const localCarts = JSON.parse(rawLocal)
                    if (localCarts && localCarts[shopId]) {
                        delete localCarts[shopId]
                        await AsyncStorage.setItem(LOCAL_CARTS_KEY, JSON.stringify(localCarts))
                    }
                }
            } catch (localErr) {
                console.log('Failed to remove local cart fallback:', localErr)
            }

            // Optionally refresh
            await fetchCarts()
        } catch (err: any) {
            console.log('CartPreview remove error (optimistic):', err)
            // restore previous cart into UI
            setCarts((prev) => {
                // avoid duplicate if already present
                const exists = prev.find(p => String(p.shopId) === String(prevCart.shopId))
                if (exists) return prev
                return [prevCart, ...prev]
            })
            setErrorMsg(err?.message || 'Failed to remove cart')
            setErrorVisible(true)
        }
    }

    const handleOpenCart = (cart: CartData) => {
        router.push({ pathname: "/cart", params: { shopId: cart.shopId } })
    }

    if (loading) {
        return (
            <StyledView className="px-4 py-3 items-center">
                <ActivityIndicator color="#BC4A4D" />
            </StyledView>
        )
    }

    if (!carts || carts.length === 0) {
        return (
            <StyledTouchableOpacity
                className="mx-4 my-2 bg-white rounded-2xl px-4 py-3 items-center"
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.08,
                    shadowRadius: 12,
                    elevation: 6,
                }}
                onPress={() => router.push({ pathname: "/cart" })}
            >
                <StyledText className="text-sm text-[#8B4513]">Your cart is empty</StyledText>
                <StyledText className="text-xs text-[#8B4513]/60 mt-1">Start adding items from any shop</StyledText>
            </StyledTouchableOpacity>
        )
    }

    return (
        <StyledView className="px-4 py-3 space-y-3">
            {carts.map((cart) => {
                const itemCount = cart.items?.reduce((a, b) => a + (b.quantity || 0), 0) || 0
                const shopName = cart.shop?.name || `Shop ${cart.shopId}`

                const renderRightActions = () => (
                    <View style={{ height: '100%', borderTopRightRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden', justifyContent: 'center' }}>
                        <TouchableOpacity
                            onPress={() => openRemoveConfirm(cart.shopId, shopName)}
                            style={{
                              
                                justifyContent: 'center',
                                alignItems: 'center',
                                width: 110,
                                height: '100%',
                                flex: 1,
                                paddingHorizontal: 10,
                            }}
                        >
                            
                        </TouchableOpacity>
                    </View>
                )

                return (
                    <View key={cart.id || cart.shopId} style={{ marginBottom: 12, borderRadius: 16 }}>
                        <Swipeable
                                key={cart.id || cart.shopId}
                                ref={(ref) => { swipeRefs.current[cart.shopId] = ref }}
                                renderRightActions={renderRightActions}
                                friction={2}
                                rightThreshold={40}
                                overshootRight={false}
                                // When user fully swipes to the right open state, immediately remove without confirmation (optimistic)
                                onSwipeableRightOpen={() => optimisticRemoveAndCall(String(cart.shopId))}
                            >
                            <StyledTouchableOpacity
                                className="bg-white rounded-2xl"
                                onPress={() => handleOpenCart(cart)}
                                style={{
                                    padding: 12,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 6 },
                                    shadowOpacity: 0.08,
                                    shadowRadius: 12,
                                    elevation: 6,
                                }}
                            >
                            <StyledView className="flex-row items-center">
                                    {/* left accent bar for a subtle 'wow' touch */}
                                    <View style={{ width: 6, height: 58, backgroundColor: '#BC4A4D', borderRadius: 6, marginRight: 10 }} />

                                    {cart.shop?.imageUrl ? (
                                        <StyledImage
                                            className="w-14 h-14 rounded-full mr-3"
                                            source={{ uri: cart.shop.imageUrl }}
                                            resizeMode="cover"
                                            style={{ borderWidth: 2, borderColor: '#FFFAF1' }}
                                        />
                                    ) : (
                                        <StyledView className="w-14 h-14 rounded-full bg-[#DFD6C5] items-center justify-center mr-3">
                                            <StyledText className="text-xl font-bold text-[#BC4A4D]">{(shopName[0] || 'S').toUpperCase()}</StyledText>
                                        </StyledView>
                                    )}

                                    <StyledView style={{ flex: 1 }}>
                                        <StyledText className="text-sm font-bold text-[#8B4513]">{shopName}</StyledText>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                                            <View style={{ backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                                                <Text style={{ color: '#8B4513', fontWeight: '700' }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
                                            </View>
                                            <Text style={{ color: '#8B4513', opacity: 0.8 }}>Delivery ₱{(cart.shop?.deliveryFee || 0).toFixed(2)}</Text>
                                        </View>
                                    </StyledView>

                                    <StyledView className="items-end ml-2 flex-row items-center">
                                        <StyledText className="text-sm font-bold text-[#BC4A4D] mr-2">₱{(cart.totalPrice || 0).toFixed(2)}</StyledText>
                                        <MaterialIcons name="chevron-right" size={22} color="#8B4513" />
                                    </StyledView>
                            </StyledView>
                            </StyledTouchableOpacity>
                        </Swipeable>
                    </View>
                )
            })}
            {/* Error Modal (shows when optimistic removal fails) */}
            <Modal
                animationType="fade"
                transparent
                visible={errorVisible}
                onRequestClose={() => setErrorVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{ width: '100%', maxWidth: 320, backgroundColor: '#FFFAF1', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12 }}>
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                <MaterialIcons name="error-outline" size={26} color="#D32F2F" />
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#8B4513', textAlign: 'center' }}>
                                Failed to remove cart
                            </Text>
                            <Text style={{ fontSize: 14, color: '#8B4513', opacity: 0.85, textAlign: 'center', marginTop: 6 }}>
                                {errorMsg}
                            </Text>
                        </View>

                        <View style={{ marginTop: 6 }}>
                            <TouchableOpacity
                                style={{ backgroundColor: '#BC4A4D', paddingVertical: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#BC4A4D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }}
                                onPress={() => setErrorVisible(false)}
                            >
                                <Text style={{ color: '#FFFAF1', fontWeight: '700' }}>OK</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Confirmation Modal */}
            <Modal
                animationType="fade"
                transparent
                visible={confirmVisible}
                onRequestClose={() => setConfirmVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{ width: '100%', maxWidth: 320, backgroundColor: '#FFFAF1', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12 }}>
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                <MaterialIcons name="warning-amber" size={26} color="#FF9800" />
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#8B4513', textAlign: 'center' }}>
                                Remove cart for {selectedShop?.shopName || 'this shop'}?
                            </Text>
                            <Text style={{ fontSize: 14, color: '#8B4513', opacity: 0.75, textAlign: 'center', marginTop: 6 }}>
                                This will remove all items from this shop. You can't undo this action.
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                            <TouchableOpacity
                                style={{ flex: 1, backgroundColor: '#F0F0F0', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                                onPress={() => setConfirmVisible(false)}
                                disabled={removing}
                            >
                                <Text style={{ color: '#8B4513', fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ flex: 1, backgroundColor: '#BC4A4D', paddingVertical: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#BC4A4D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 }}
                                onPress={performRemoveShop}
                                disabled={removing}
                            >
                                {removing ? (
                                    <ActivityIndicator color="#FFFAF1" />
                                ) : (
                                    <Text style={{ color: '#FFFAF1', fontWeight: '700' }}>Remove</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </StyledView>
    )
}

export default CartPreview

// Themed confirmation modal (inline for simplicity)
// Note: Kept within this file to avoid new imports/files
