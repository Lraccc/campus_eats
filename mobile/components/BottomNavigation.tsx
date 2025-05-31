import type React from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { router } from "expo-router"
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState, useEffect } from "react"
import { MaterialIcons } from '@expo/vector-icons'

interface BottomNavigationProps {
    activeTab?: string
}

type RoutePath = string;

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab = "Home" }) => {
    const [accountType, setAccountType] = useState<string | null>(null);

    useEffect(() => {
        const getAccountType = async () => {
            try {
                const type = await AsyncStorage.getItem('accountType');
                setAccountType(type);
            } catch (error) {
                console.error('Error getting account type:', error);
            }
        };
        getAccountType();
    }, []);

    const navigateTo = async (path: RoutePath) => {
        try {
            switch (path) {
                case "/home":
                    if (accountType === 'shop') {
                        router.push('/shop')
                    } else if (accountType === 'dasher') {
                        router.push('/dasher')
                    } else {
                        router.push('/home')
                    }
                    break
                case "/incoming":
                    if (accountType === 'shop') {
                        router.push('/shop/incoming-orders')
                    } else if (accountType === 'dasher') {
                        router.push('/dasher/incoming-orders')
                    } else {
                        router.push('/order')
                    }
                    break
                case "/orders":
                    if (accountType === 'shop') {
                        router.push('/shop/incoming-orders')
                    } else if (accountType === 'dasher') {
                        router.push('/dasher/orders')
                    } else {
                        router.push('/cart')
                    }
                    break
                case "/profile":
                    router.push('/profile')
                    break
                default:
                    router.push(path as any)
            }
        } catch (error) {
            console.error('Error checking account type:', error)
            router.push('/home')
        }
    }

    const renderTabItem = (
        path: string,
        label: string,
        isActive: boolean,
        icon: React.ReactNode,
        accessibilityLabel: string
    ) => (
        <TouchableOpacity
            style={[styles.tabItem, isActive && styles.activeTabItem]}
            onPress={() => navigateTo(path)}
            accessibilityLabel={accessibilityLabel}
            activeOpacity={0.7}
        >
            <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
                {icon}
            </View>
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>{label}</Text>
            {isActive && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
    );

    const renderRegularUserTabs = () => (
        <>
            {renderTabItem(
                "/home",
                "Home",
                activeTab === "Home",
                <View style={styles.homeIconWrapper}>
                    <View style={[styles.homeIcon, activeTab === "Home" && styles.activeHomeIcon]} />
                    <View style={[styles.homeRoof, activeTab === "Home" && styles.activeHomeRoof]} />
                </View>,
                "Home tab"
            )}

            {renderTabItem(
                "/orders",
                "Cart",
                activeTab === "Cart",
                <View style={styles.iconWrapper}>
                    <View style={[styles.cartIcon, activeTab === "Cart" && styles.activeCartIcon]} />
                    <View style={[styles.cartHandle, activeTab === "Cart" && styles.activeCartHandle]} />
                </View>,
                "Cart tab"
            )}

            {renderTabItem(
                "/incoming",
                "Orders",
                activeTab === "Orders",
                <View style={styles.iconWrapper}>
                    <View style={[styles.ordersIcon, activeTab === "Orders" && styles.activeOrdersIcon]} />
                    <View style={[styles.ordersLine1, activeTab === "Orders" && styles.activeOrdersLine]} />
                    <View style={[styles.ordersLine2, activeTab === "Orders" && styles.activeOrdersLine]} />
                </View>,
                "Orders tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <View style={styles.iconWrapper}>
                    <View style={[styles.profileIconHead, activeTab === "Profile" && styles.activeProfileHead]} />
                    <View style={[styles.profileIconBody, activeTab === "Profile" && styles.activeProfileBody]} />
                </View>,
                "Profile tab"
            )}
        </>
    );

    const renderDasherTabs = () => (
        <>
            {renderTabItem(
                "/home",
                "Home",
                activeTab === "Home",
                <View style={styles.homeIconWrapper}>
                    <View style={[styles.homeIcon, activeTab === "Home" && styles.activeHomeIcon]} />
                    <View style={[styles.homeRoof, activeTab === "Home" && styles.activeHomeRoof]} />
                </View>,
                "Home tab"
            )}

            {renderTabItem(
                "/incoming",
                "Incoming",
                activeTab === "Incoming",
                <MaterialIcons
                    name="notifications"
                    size={22}
                    color={activeTab === "Incoming" ? "#BC4A4D" : "rgba(255,255,255,0.85)"}
                />,
                "Incoming tab"
            )}

            {renderTabItem(
                "/orders",
                "Orders",
                activeTab === "Orders",
                <View style={styles.iconWrapper}>
                    <View style={[styles.ordersIcon, activeTab === "Orders" && styles.activeOrdersIcon]} />
                    <View style={[styles.ordersLine1, activeTab === "Orders" && styles.activeOrdersLine]} />
                    <View style={[styles.ordersLine2, activeTab === "Orders" && styles.activeOrdersLine]} />
                </View>,
                "Orders tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <View style={styles.iconWrapper}>
                    <View style={[styles.profileIconHead, activeTab === "Profile" && styles.activeProfileHead]} />
                    <View style={[styles.profileIconBody, activeTab === "Profile" && styles.activeProfileBody]} />
                </View>,
                "Profile tab"
            )}
        </>
    );

    const renderShopTabs = () => (
        <>
            {renderTabItem(
                "/home",
                "Home",
                activeTab === "Home",
                <View style={styles.homeIconWrapper}>
                    <View style={[styles.homeIcon, activeTab === "Home" && styles.activeHomeIcon]} />
                    <View style={[styles.homeRoof, activeTab === "Home" && styles.activeHomeRoof]} />
                </View>,
                "Home tab"
            )}

            {renderTabItem(
                "/shop/add-item",
                "Add Items",
                activeTab === "AddItems",
                <MaterialIcons
                    name="add-circle"
                    size={22}
                    color={activeTab === "AddItems" ? "#BC4A4D" : "rgba(255,255,255,0.85)"}
                />,
                "Add Items tab"
            )}

            {renderTabItem(
                "/shop/items",
                "Items",
                activeTab === "Items",
                <MaterialIcons
                    name="restaurant-menu"
                    size={22}
                    color={activeTab === "Items" ? "#BC4A4D" : "rgba(255,255,255,0.85)"}
                />,
                "Items tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <View style={styles.iconWrapper}>
                    <View style={[styles.profileIconHead, activeTab === "Profile" && styles.activeProfileHead]} />
                    <View style={[styles.profileIconBody, activeTab === "Profile" && styles.activeProfileBody]} />
                </View>,
                "Profile tab"
            )}
        </>
    );

    return (
        <View style={styles.container}>
            <View style={styles.shadowContainer}>
                {accountType === 'dasher'
                    ? renderDasherTabs()
                    : accountType === 'shop'
                        ? renderShopTabs()
                        : renderRegularUserTabs()
                }
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#BC4A4D",
        paddingTop: 8,
        paddingBottom: 12,
        paddingHorizontal: 8,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -3,
        },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 10,
    },
    shadowContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },
    tabItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 12,
        position: "relative",
        minHeight: 60,
    },
    activeTabItem: {
        backgroundColor: "rgba(255,255,255,0.15)",
        transform: [{ scale: 1.05 }],
    },
    iconContainer: {
        width: 28,
        height: 28,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.1)",
    },
    activeIconContainer: {
        backgroundColor: "rgba(255,255,255,0.9)",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    iconWrapper: {
        alignItems: "center",
        justifyContent: "center",
    },
    tabText: {
        fontSize: 11,
        color: "rgba(255,255,255,0.85)",
        textAlign: "center",
        fontWeight: "500",
        marginTop: 2,
    },
    activeTabText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 12,
    },
    activeIndicator: {
        position: "absolute",
        bottom: 2,
        width: 20,
        height: 2,
        backgroundColor: "#FFFFFF",
        borderRadius: 1,
    },

    // Enhanced Home icon with roof
    homeIconWrapper: {
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
    },
    homeIcon: {
        width: 16,
        height: 12,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.85)",
        borderRadius: 2,
        backgroundColor: "transparent",
        marginTop: 4,
    },
    activeHomeIcon: {
        borderColor: "#BC4A4D",
        backgroundColor: "rgba(188,74,77,0.1)",
    },
    homeRoof: {
        position: "absolute",
        top: -2,
        width: 0,
        height: 0,
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderBottomWidth: 8,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: "rgba(255,255,255,0.85)",
    },
    activeHomeRoof: {
        borderBottomColor: "#BC4A4D",
    },

    // Enhanced Cart icon
    cartIcon: {
        width: 16,
        height: 12,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.85)",
        borderRadius: 2,
        backgroundColor: "transparent",
    },
    activeCartIcon: {
        borderColor: "#BC4A4D",
        backgroundColor: "rgba(188,74,77,0.1)",
    },
    cartHandle: {
        position: "absolute",
        top: -3,
        right: 2,
        width: 8,
        height: 6,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.85)",
        borderBottomWidth: 0,
        borderRadius: 2,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    activeCartHandle: {
        borderColor: "#BC4A4D",
    },

    // Enhanced Orders icon
    ordersIcon: {
        width: 16,
        height: 12,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.85)",
        borderRadius: 2,
        backgroundColor: "transparent",
    },
    activeOrdersIcon: {
        borderColor: "#BC4A4D",
        backgroundColor: "rgba(188,74,77,0.1)",
    },
    ordersLine1: {
        position: "absolute",
        top: 3,
        width: 10,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.85)",
        borderRadius: 0.5,
    },
    ordersLine2: {
        position: "absolute",
        top: 6,
        width: 8,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.85)",
        borderRadius: 0.5,
    },
    activeOrdersLine: {
        backgroundColor: "#BC4A4D",
    },

    // Enhanced Profile icon
    profileIconHead: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "rgba(255,255,255,0.85)",
        marginBottom: 1,
    },
    activeProfileHead: {
        backgroundColor: "#BC4A4D",
    },
    profileIconBody: {
        width: 14,
        height: 8,
        borderRadius: 7,
        backgroundColor: "rgba(255,255,255,0.85)",
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
    },
    activeProfileBody: {
        backgroundColor: "#BC4A4D",
    },
})

export default BottomNavigation;