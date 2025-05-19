import type React from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { router } from "expo-router"
import AsyncStorage from '@react-native-async-storage/async-storage'

interface BottomNavigationProps {
    activeTab?: string
}

type RoutePath = "/home" | "/order" | "/cart" | "/profile" | "/dasher/orders" | "/shop/incoming-orders" | "/admin/dashboard" | string

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab = "Home" }) => {
    const navigateTo = async (path: RoutePath) => {
        try {
            const accountType = await AsyncStorage.getItem('accountType')
            console.log('Current account type:', accountType)

            // Handle navigation based on account type
            switch (path) {
                case "/home":
                    if (accountType === 'shop') {
                        router.push('/shop/incoming-orders')
                    } else if (accountType === 'dasher') {
                        router.push('/dasher/orders')
                    } else if (accountType === 'admin') {
                        router.push('/admin/dashboard')
                    } else {
                        router.push('/home')
                    }
                    break
                case "/order":
                    if (accountType === 'shop') {
                        router.push('/shop/incoming-orders')
                    } else if (accountType === 'dasher') {
                        router.push('/dasher/orders')
                    } else if (accountType === 'admin') {
                        router.push('/admin/dashboard')
                    } else {
                        router.push('/order')
                    }
                    break
                case "/cart":
                    if (accountType === 'shop' || accountType === 'dasher' || accountType === 'admin') {
                        // Redirect to appropriate page for non-customer accounts
                        if (accountType === 'shop') {
                            router.push('/shop/incoming-orders')
                        } else if (accountType === 'dasher') {
                            router.push('/dasher/orders')
                        } else {
                            router.push('/admin/dashboard')
                        }
                    } else {
                        router.push('/cart')
                    }
                    break
                case "/profile":
                    router.push('/profile')
                    break
                default:
                    router.push(path)
            }
        } catch (error) {
            console.error('Error checking account type:', error)
            // Default to regular home route if there's an error
            router.push('/home')
        }
    }

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.tabItem}
                onPress={() => navigateTo("/home")}
                accessibilityLabel="Home tab"
            >
                <View style={styles.iconContainer}>
                    {/* Home Icon */}
                    <View style={styles.icon}>
                        <View style={styles.homeIcon} />
                    </View>
                </View>
                <Text style={[styles.tabText, activeTab === "Home" && styles.activeTabText]}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.tabItem} 
                onPress={() => navigateTo("/order")} 
                accessibilityLabel="Orders tab"
            >
                <View style={styles.iconContainer}>
                    {/* Orders Icon */}
                    <View style={styles.icon}>
                        <View style={styles.ordersIcon} />
                        <View style={styles.ordersIconLine} />
                    </View>
                </View>
                <Text style={[styles.tabText, activeTab === "Orders" && styles.activeTabText]}>Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.tabItem} 
                onPress={() => navigateTo("/cart")} 
                accessibilityLabel="Cart tab"
            >
                <View style={styles.iconContainer}>
                    {/* Cart Icon */}
                    <View style={styles.icon}>
                        <View style={styles.cartIcon} />
                        <View style={styles.cartIconHandle} />
                    </View>
                </View>
                <Text style={[styles.tabText, activeTab === "Cart" && styles.activeTabText]}>Cart</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.tabItem} 
                onPress={() => navigateTo("/profile")} 
                accessibilityLabel="Profile tab"
            >
                <View style={styles.iconContainer}>
                    {/* Profile Icon */}
                    <View style={styles.icon}>
                        <View style={styles.profileIconHead} />
                        <View style={styles.profileIconBody} />
                    </View>
                </View>
                <Text style={[styles.tabText, activeTab === "Profile" && styles.activeTabText]}>Profile</Text>
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        backgroundColor: "#BC4A4D", // Matching the red color from the image
        paddingVertical: 8,
        paddingHorizontal: 10,
        justifyContent: "space-around",
        borderTopWidth: 1,
        borderTopColor: "rgba(0,0,0,0.1)",
    },
    tabItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 5,
    },
    iconContainer: {
        width: 24,
        height: 24,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
    },
    icon: {
        width: 24,
        height: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    tabText: {
        fontSize: 12,
        color: "rgba(255,255,255,0.8)",
        textAlign: "center",
    },
    activeTabText: {
        color: "#FFFFFF",
        fontWeight: "bold",
    },
    // Home icon
    homeIcon: {
        width: 18,
        height: 16,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        borderRadius: 2,
        position: "relative",
        borderTopWidth: 0,
        marginTop: 8,
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        backgroundColor: "transparent",
        transform: [{ translateY: -4 }],
        borderTopColor: "transparent",
        borderTopWidth: 2,
    },
    // Orders icon
    ordersIcon: {
        width: 18,
        height: 14,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        borderRadius: 2,
    },
    ordersIconLine: {
        width: 12,
        height: 0,
        borderTopWidth: 2,
        borderTopColor: "#FFFFFF",
        position: "absolute",
        top: 7,
        left: 6,
    },
    // Cart icon
    cartIcon: {
        width: 16,
        height: 12,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        borderRadius: 2,
        marginTop: 6,
    },
    cartIconHandle: {
        width: 8,
        height: 8,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        borderRadius: 8,
        position: "absolute",
        top: 0,
        left: 8,
        borderBottomWidth: 0,
        borderBottomColor: "transparent",
    },
    // Profile icon
    profileIconHead: {
        width: 10,
        height: 10,
        borderRadius: 10,
        backgroundColor: "#FFFFFF",
        marginBottom: 2,
    },
    profileIconBody: {
        width: 16,
        height: 10,
        borderRadius: 8,
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
    },
})

export default BottomNavigation
