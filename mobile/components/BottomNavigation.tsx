import type React from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { styled } from "nativewind"
import { router } from "expo-router"
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState, useEffect } from "react"
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { getCachedAccountType, setCachedAccountType, hasCachedAccountType } from '../utils/accountCache'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface BottomNavigationProps {
    activeTab?: string
}

type RoutePath = string;

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab = "Home" }) => {
    const [accountType, setAccountType] = useState<string | null>(getCachedAccountType());
    const [isLoading, setIsLoading] = useState(!hasCachedAccountType());

    useEffect(() => {
        let mounted = true;

        const getAccountType = async () => {
            try {
                // Always read from AsyncStorage to catch account changes (login/logout)
                const type = await AsyncStorage.getItem('accountType');
                const resolvedType = type || 'regular';
                
                // Update cache
                setCachedAccountType(resolvedType);
                
                if (mounted) {
                    setAccountType(resolvedType);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error getting account type:', error);
                const fallbackType = 'regular';
                setCachedAccountType(fallbackType);
                
                if (mounted) {
                    setAccountType(fallbackType);
                    setIsLoading(false);
                }
            }
        };

        getAccountType();

        return () => {
            mounted = false;
        };
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
            className="flex-1 items-center justify-center py-2"
            onPress={() => navigateTo(path)}
            accessibilityLabel={accessibilityLabel}
            activeOpacity={0.8}
        >
            {/* Modern icon container with subtle animation effect */}
            <StyledView className={`w-10 h-10 items-center justify-center rounded-xl mb-1 ${
                isActive
                    ? 'bg-white shadow-lg'
                    : 'bg-transparent'
            }`}>
                {icon}
            </StyledView>

            {/* Clean label */}
            <StyledText className={`text-xs font-medium text-center ${
                isActive
                    ? 'text-white'
                    : 'text-white/60'
            }`}>
                {label}
            </StyledText>

            {/* Modern active indicator */}
            {isActive && (
                <StyledView className="absolute bottom-0 w-6 h-0.5 bg-white rounded-full" />
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
                    size={24}
                    color={activeTab === "Home" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
                />,
                "Home tab"
            )}

            {renderTabItem(
                "/orders",
                "Cart",
                activeTab === "Cart",
                <MaterialIcons
                    name="shopping-cart"
                    size={22}
                    color={activeTab === "Cart" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
                />,
                "Cart tab"
            )}

            {renderTabItem(
                "/incoming",
                "Orders",
                activeTab === "Orders",
                <MaterialIcons
                    name="receipt-long"
                    size={22}
                    color={activeTab === "Orders" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
                />,
                "Orders tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <MaterialIcons
                    name="person"
                    size={24}
                    color={activeTab === "Profile" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
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
                    size={24}
                    color={activeTab === "Home" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
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
                        size={22}
                        color={activeTab === "Incoming" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
                    />
                    {/* Modern notification indicator */}
                    {activeTab === "Incoming" && (
                        <StyledView className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
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
                    size={22}
                    color={activeTab === "Orders" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
                />,
                "Orders tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <MaterialIcons
                    name="person"
                    size={24}
                    color={activeTab === "Profile" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
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
                    size={22}
                    color={activeTab === "Home" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
                />,
                "Home tab"
            )}

            {renderTabItem(
                "/shop/add-item",
                "Add Items",
                activeTab === "AddItems",
                <MaterialIcons
                    name="add-business"
                    size={22}
                    color={activeTab === "AddItems" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
                />,
                "Add Items tab"
            )}

            {renderTabItem(
                "/shop/items",
                "Items",
                activeTab === "Items",
                <MaterialIcons
                    name="inventory"
                    size={22}
                    color={activeTab === "Items" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
                />,
                "Items tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <MaterialIcons
                    name="person"
                    size={24}
                    color={activeTab === "Profile" ? "#BC4A4D" : "rgba(255,255,255,0.8)"}
                />,
                "Profile tab"
            )}
        </>
    );

    // Don't render until account type is loaded to prevent flickering
    if (isLoading) {
        return (
            <StyledView
                className="bg-[#BC4A4D] pt-3 pb-4 px-4"
                style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 12,
                    elevation: 12,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    height: 90, // Fixed height to prevent layout shift
                }}
            >
                {/* Loading skeleton to maintain layout */}
                <StyledView className="flex-row justify-around items-center mt-1">
                    {[1, 2, 3, 4].map((_, index) => (
                        <StyledView key={index} className="flex-1 items-center justify-center py-2">
                            <StyledView className="w-10 h-10 bg-white/20 rounded-xl mb-1" />
                            <StyledView className="w-8 h-3 bg-white/20 rounded" />
                        </StyledView>
                    ))}
                </StyledView>
            </StyledView>
        );
    }

    return (
        <StyledView
            className="bg-[#BC4A4D] pt-3 pb-4 px-4"
            style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 12,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
            }}
        >
            {/* Enhanced gradient overlay */}
            <LinearGradient
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    opacity: 0.15,
                }}
                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Top accent line */}
            <StyledView className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-white/30 rounded-full" />

            {/* Main navigation container */}
            <StyledView className="flex-row justify-around items-center relative z-10 mt-1">
                {(() => {
                    switch (accountType) {
                        case 'dasher':
                            return renderDasherTabs();
                        case 'shop':
                            return renderShopTabs();
                        default:
                            return renderRegularUserTabs();
                    }
                })()}
            </StyledView>
        </StyledView>
    )
}

export default BottomNavigation;