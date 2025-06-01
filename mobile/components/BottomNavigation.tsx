import type React from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { styled } from "nativewind"
import { router } from "expo-router"
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState, useEffect } from "react"
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

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
        <StyledTouchableOpacity
            className={`flex-1 items-center justify-center py-2 px-2 mx-1 rounded-2xl relative min-h-[60px] ${
                isActive
                    ? 'bg-white/25 scale-105'
                    : 'bg-transparent'
            }`}
            onPress={() => navigateTo(path)}
            accessibilityLabel={accessibilityLabel}
            activeOpacity={0.7}
            style={{
                shadowColor: isActive ? "#000" : "transparent",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isActive ? 0.15 : 0,
                shadowRadius: 8,
                elevation: isActive ? 6 : 0,
            }}
        >
            {/* Glowing background for active state */}
            {isActive && (
                <StyledView
                    className="absolute inset-0 rounded-3xl bg-white/10"
                    style={{
                        shadowColor: "#BC4A4D",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.3,
                        shadowRadius: 10,
                        elevation: 3,
                    }}
                />
            )}

            {/* Icon container with beautiful styling */}
            <StyledView className={`w-10 h-10 items-center justify-center mb-1 rounded-xl ${
                isActive
                    ? 'bg-white shadow-lg'
                    : 'bg-white/20'
            }`}
                        style={{
                            shadowColor: isActive ? "#BC4A4D" : "transparent",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: isActive ? 0.25 : 0,
                            shadowRadius: 6,
                            elevation: isActive ? 4 : 0,
                        }}
            >
                {icon}
            </StyledView>

            {/* Label with beautiful typography */}
            <StyledText className={`text-[10px] text-center font-bold leading-tight ${
                isActive
                    ? 'text-white'
                    : 'text-white/80'
            }`}
                        style={{
                            textShadowColor: isActive ? 'rgba(0,0,0,0.2)' : 'transparent',
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 2,
                        }}
            >
                {label}
            </StyledText>

            {/* Active indicator dot */}
            {isActive && (
                <StyledView
                    className="absolute bottom-2 w-2 h-2 bg-white rounded-full"
                    style={{
                        shadowColor: "#fff",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 4,
                        elevation: 2,
                    }}
                />
            )}
        </StyledTouchableOpacity>
    );

    const renderRegularUserTabs = () => (
        <>
            {renderTabItem(
                "/home",
                "Home",
                activeTab === "Home",
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="home"
                        size={24}
                        color={activeTab === "Home" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
                "Home tab"
            )}

            {renderTabItem(
                "/orders",
                "Cart",
                activeTab === "Cart",
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="shopping-cart"
                        size={22}
                        color={activeTab === "Cart" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
                "Cart tab"
            )}

            {renderTabItem(
                "/incoming",
                "Orders",
                activeTab === "Orders",
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="receipt-long"
                        size={22}
                        color={activeTab === "Orders" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
                "Orders tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="person"
                        size={24}
                        color={activeTab === "Profile" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
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
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="home"
                        size={24}
                        color={activeTab === "Home" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
                "Home tab"
            )}

            {renderTabItem(
                "/incoming",
                "Incoming",
                activeTab === "Incoming",
                <StyledView className="items-center justify-center relative">
                    <MaterialIcons
                        name="notifications-active"
                        size={22}
                        color={activeTab === "Incoming" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                    {/* Notification pulse effect for active state */}
                    {activeTab === "Incoming" && (
                        <StyledView
                            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                            style={{
                                shadowColor: "#ef4444",
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.6,
                                shadowRadius: 4,
                                elevation: 2,
                            }}
                        />
                    )}
                </StyledView>,
                "Incoming tab"
            )}

            {renderTabItem(
                "/orders",
                "Orders",
                activeTab === "Orders",
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="assignment"
                        size={22}
                        color={activeTab === "Orders" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
                "Orders tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="person"
                        size={24}
                        color={activeTab === "Profile" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
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
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="storefront"
                        size={22}
                        color={activeTab === "Home" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
                "Home tab"
            )}

            {renderTabItem(
                "/shop/add-item",
                "Add Items",
                activeTab === "AddItems",
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="add-business"
                        size={22}
                        color={activeTab === "AddItems" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
                "Add Items tab"
            )}

            {renderTabItem(
                "/shop/items",
                "Items",
                activeTab === "Items",
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="inventory"
                        size={22}
                        color={activeTab === "Items" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
                "Items tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <StyledView className="items-center justify-center">
                    <MaterialIcons
                        name="person"
                        size={24}
                        color={activeTab === "Profile" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                </StyledView>,
                "Profile tab"
            )}
        </>
    );

    return (
        <StyledView
            className="bg-[#BC4A4D] pt-2 pb-4 px-3 rounded-t-[24px]"
            style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 15,
            }}
        >
            {/* Beautiful gradient overlay */}
            <LinearGradient
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    opacity: 0.2
                }}
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Main navigation container */}
            <StyledView className="flex-row justify-around items-center relative z-10">
                {accountType === 'dasher'
                    ? renderDasherTabs()
                    : accountType === 'shop'
                        ? renderShopTabs()
                        : renderRegularUserTabs()
                }
            </StyledView>
        </StyledView>
    )
}

export default BottomNavigation;