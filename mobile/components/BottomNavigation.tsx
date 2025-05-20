import type React from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { router } from "expo-router"
import AsyncStorage from '@react-native-async-storage/async-storage'

interface BottomNavigationProps {
    activeTab?: string
}

// Making RoutePath less strict to accommodate all cases
type RoutePath = string;

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
                        router.push('/dasher')
                    } else if (accountType === 'admin') {
                        router.push('/admin/dashboard')
                    } else {
                        router.push('/home')
                    }
                    break
                case "/incoming":
                    if (accountType === 'shop') {
                        router.push('/shop/incoming-orders')
                    } else if (accountType === 'dasher') {
                        router.push('/dasher/incoming-orders')
                    } else if (accountType === 'admin') {
                        router.push('/admin/dashboard')
                    } else {
                        router.push('/order')
                    }
                    break
                case "/orders":
                    if (accountType === 'shop') {
                        router.push('/shop/incoming-orders')
                    } else if (accountType === 'dasher') {
                        router.push('/dasher/orders')
                    } else if (accountType === 'admin') {
                        router.push('/admin/dashboard')
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
                onPress={() => navigateTo("/incoming")} 
                accessibilityLabel="Incoming tab"
            >
                <View style={styles.iconContainer}>
                    {/* Incoming Icon */}
                    <View style={styles.icon}>
                        <View style={styles.incomingIcon} />
                        <View style={styles.incomingIconLine} />
                    </View>
                </View>
                <Text style={[styles.tabText, activeTab === "Incoming" && styles.activeTabText]}>Incoming</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.tabItem} 
                onPress={() => navigateTo("/orders")} 
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
        backgroundColor: "#BC4A4D",
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
        marginTop: 8,
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        backgroundColor: "transparent",
        transform: [{ translateY: -4 }],
    },
    // Incoming icon
    incomingIcon: {
        width: 18,
        height: 14,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        borderRadius: 2,
    },
    incomingIconLine: {
        width: 12,
        height: 0,
        borderTopWidth: 2,
        borderTopColor: "#FFFFFF",
        position: "absolute",
        top: 7,
        left: 6,
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
