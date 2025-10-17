import React, { useEffect, useState, useCallback } from "react"
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Image } from "react-native"
import { styled } from "nativewind"
import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { router } from "expo-router"
import { API_URL } from "../config"
import { AUTH_TOKEN_KEY } from "../services/authService"
import { MaterialIcons } from '@expo/vector-icons'

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

    const handleRemoveShop = (shopId: string, shopName?: string) => {
        Alert.alert(
            `Remove cart for ${shopName || 'this shop'}`,
            `Are you sure you want to remove all items from ${shopName || 'this shop'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const userId = await AsyncStorage.getItem('userId')
                            if (!userId) return
                            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)
                            // Attempt server removal first
                            try {
                                await axios.delete(`${API_URL}/api/carts/remove-cart`, {
                                    data: { uid: userId, shopId },
                                    headers: { Authorization: token },
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

                            // Refresh list
                            await fetchCarts()
                        } catch (err) {
                            console.log('Failed to remove shop cart:', err)
                            Alert.alert('Error', 'Unable to remove shop cart. Please try again.')
                        }
                    }
                }
            ]
        )
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

                return (
                    <StyledTouchableOpacity
                        key={cart.id || cart.shopId}
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
                        <StyledView className="flex-row items-center justify-between">
                            <StyledView className="flex-row items-center">
                                                {cart.shop?.imageUrl ? (
                                                    <StyledImage
                                                        className="w-12 h-12 rounded-full mr-3"
                                                        source={{ uri: cart.shop.imageUrl }}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <StyledView className="w-12 h-12 rounded-full bg-[#DFD6C5] items-center justify-center mr-3">
                                                        <StyledText className="text-lg font-bold text-[#BC4A4D]">{(shopName[0] || 'S').toUpperCase()}</StyledText>
                                                    </StyledView>
                                                )}

                                <StyledView className="max-w-xs">
                                    <StyledText className="text-sm font-bold text-[#8B4513]">{shopName}</StyledText>
                                    <StyledText className="text-xs text-[#8B4513]/60 mt-1">
                                        {itemCount} item{itemCount !== 1 ? 's' : ''} • Delivery ₱{(cart.shop?.deliveryFee || 0).toFixed(2)}
                                    </StyledText>
                                </StyledView>
                            </StyledView>

                            <StyledView className="items-end ml-2 flex-row items-center">
                                <StyledText className="text-sm font-bold text-[#BC4A4D] mr-2">₱{(cart.totalPrice || 0).toFixed(2)}</StyledText>
                                <TouchableOpacity onPress={() => handleRemoveShop(cart.shopId, shopName)} style={{ marginRight: 8 }}>
                                    <MaterialIcons name="delete" size={20} color="#8B4513" />
                                </TouchableOpacity>
                                <MaterialIcons name="chevron-right" size={22} color="#8B4513" />
                            </StyledView>
                        </StyledView>
                    </StyledTouchableOpacity>
                )
            })}
        </StyledView>
    )
}

export default CartPreview
