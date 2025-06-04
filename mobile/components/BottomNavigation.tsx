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
            className={`flex-1 items-center justify-center py-2 px-1 mx-0.5 rounded-xl relative min-h-[50px] ${
                isActive
                    ? 'bg-white/20'
                    : 'bg-transparent'
            }`}
            onPress={() => navigateTo(path)}
            accessibilityLabel={accessibilityLabel}
            activeOpacity={0.7}
        >
            {/* Icon container - more compact */}
            <StyledView className={`w-7 h-7 items-center justify-center mb-1 rounded-lg ${
                isActive
                    ? 'bg-white shadow-sm'
                    : 'bg-white/15'
            }`}>
                {icon}
            </StyledView>

            {/* Label with smaller font */}
            <StyledText className={`text-[9px] text-center font-semibold leading-tight ${
                isActive
                    ? 'text-white'
                    : 'text-white/75'
            }`}>
                {label}
            </StyledText>

            {/* Active indicator - smaller */}
            {isActive && (
                <StyledView className="absolute bottom-1 w-1 h-1 bg-white rounded-full opacity-80" />
            )}
        </StyledTouchableOpacity>
    );

    const renderRegularUserTabs = () => (
        <>
            {renderTabItem(
                "/home",
                "Home",
                activeTab === "Home",
                <MaterialIcons
                    name="home"
                    size={18}
                    color={activeTab === "Home" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
                "Home tab"
            )}

            {renderTabItem(
                "/orders",
                "Cart",
                activeTab === "Cart",
                <MaterialIcons
                    name="shopping-cart"
                    size={16}
                    color={activeTab === "Cart" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
                "Cart tab"
            )}

            {renderTabItem(
                "/incoming",
                "Orders",
                activeTab === "Orders",
                <MaterialIcons
                    name="receipt-long"
                    size={16}
                    color={activeTab === "Orders" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
                "Orders tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <MaterialIcons
                    name="person"
                    size={18}
                    color={activeTab === "Profile" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
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
                <MaterialIcons
                    name="home"
                    size={18}
                    color={activeTab === "Home" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
                "Home tab"
            )}

            {renderTabItem(
                "/incoming",
                "Incoming",
                activeTab === "Incoming",
                <StyledView className="items-center justify-center relative">
                    <MaterialIcons
                        name="notifications-active"
                        size={16}
                        color={activeTab === "Incoming" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                    />
                    {/* Smaller notification indicator */}
                    {activeTab === "Incoming" && (
                        <StyledView className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                </StyledView>,
                "Incoming tab"
            )}

            {renderTabItem(
                "/orders",
                "Orders",
                activeTab === "Orders",
                <MaterialIcons
                    name="assignment"
                    size={16}
                    color={activeTab === "Orders" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
                "Orders tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <MaterialIcons
                    name="person"
                    size={18}
                    color={activeTab === "Profile" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
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
                <MaterialIcons
                    name="storefront"
                    size={16}
                    color={activeTab === "Home" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
                "Home tab"
            )}

            {renderTabItem(
                "/shop/add-item",
                "Add Items",
                activeTab === "AddItems",
                <MaterialIcons
                    name="add-business"
                    size={16}
                    color={activeTab === "AddItems" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
                "Add Items tab"
            )}

            {renderTabItem(
                "/shop/items",
                "Items",
                activeTab === "Items",
                <MaterialIcons
                    name="inventory"
                    size={16}
                    color={activeTab === "Items" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
                "Items tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <MaterialIcons
                    name="person"
                    size={18}
                    color={activeTab === "Profile" ? "#BC4A4D" : "rgba(255,255,255,0.9)"}
                />,
                "Profile tab"
            )}
        </>
    );

    return (
        <StyledView
            className="bg-[#BC4A4D] pt-1 pb-1 px-2 rounded-t-[16px]"
            style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
                elevation: 8,
            }}
        >
            {/* Simplified gradient overlay */}
            <LinearGradient
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    opacity: 0.1,
                }}
                colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Main navigation container - more compact */}
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