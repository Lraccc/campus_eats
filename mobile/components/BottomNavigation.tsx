import React, { memo } from "react"
import { View, Text, TouchableOpacity, Animated } from "react-native"
import { styled } from "nativewind"
import { router } from "expo-router"
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState, useEffect, useRef } from "react"
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
    // Initialize with cached value or default to 'regular' - never start with null
    const [accountType, setAccountType] = useState<string>(getCachedAccountType() || 'regular');
    const slideAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        let mounted = true;

        const getAccountType = async () => {
            try {
                // Always read from AsyncStorage to catch account changes (login/logout)
                const type = await AsyncStorage.getItem('accountType');
                const resolvedType = type || 'regular';
                
                // Update cache
                setCachedAccountType(resolvedType);
                
                // Only update state if the value actually changed
                if (mounted && resolvedType !== accountType) {
                    setAccountType(resolvedType);
                }
            } catch (error) {
                console.error('Error getting account type:', error);
                const fallbackType = 'regular';
                setCachedAccountType(fallbackType);
                
                if (mounted && fallbackType !== accountType) {
                    setAccountType(fallbackType);
                }
            }
        };

        getAccountType();

        return () => {
            mounted = false;
        };
    }, [accountType]);

    const navigateTo = async (path: RoutePath) => {
        // Trigger slide animation
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ])
        ]).start(() => {
            slideAnim.setValue(0);
        });
        
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
                case "/shop/orders":
                    router.push('/shop/orders')
                    break
                case "/orders":
                    if (accountType === 'shop') {
                        router.push('/shop/incoming-orders')
                    } else if (accountType === 'dasher') {
                        router.push('/dasher/orders')
                    } else {
                        // Open the cart preview which lists per-shop carts; tapping a preview opens the shop-specific cart
                        router.push('/cart-preview')
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
            className="flex-1 items-center justify-center"
            onPress={() => navigateTo(path)}
            accessibilityLabel={accessibilityLabel}
            activeOpacity={0.7}
        >
            {/* Large floating icon for active tab */}
            <Animated.View 
                style={[
                    {
                        width: isActive ? 64 : 40,
                        height: isActive ? 64 : 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 999,
                        backgroundColor: isActive ? '#fff' : 'transparent',
                        marginTop: isActive ? -32 : 0,
                    },
                    isActive ? {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 6,
                    } : {},
                    {
                        transform: [
                            {
                                scale: isActive ? scaleAnim : 1,
                            },
                            {
                                translateY: isActive ? slideAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -4],
                                }) : 0,
                            }
                        ],
                    }
                ]}
            >
                {icon}
            </Animated.View>
            {/* Label below active icon */}
            {isActive && (
                <StyledText className="text-[10px] font-medium text-white mt-1">
                    {label}
                </StyledText>
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
                    size={activeTab === "Home" ? 32 : 24}
                    color={activeTab === "Home" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
                />,
                "Home tab"
            )}

            {renderTabItem(
                "/orders",
                "Cart",
                activeTab === "Cart",
                <MaterialIcons
                    name="shopping-cart"
                    size={activeTab === "Cart" ? 30 : 22}
                    color={activeTab === "Cart" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
                />,
                "Cart tab"
            )}

            {renderTabItem(
                "/incoming",
                "Orders",
                activeTab === "Orders",
                <MaterialIcons
                    name="receipt-long"
                    size={activeTab === "Orders" ? 30 : 22}
                    color={activeTab === "Orders" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
                />,
                "Orders tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <MaterialIcons
                    name="person"
                    size={activeTab === "Profile" ? 32 : 24}
                    color={activeTab === "Profile" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
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
                    size={activeTab === "Home" ? 32 : 24}
                    color={activeTab === "Home" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
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
                        size={activeTab === "Incoming" ? 30 : 22}
                        color={activeTab === "Incoming" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
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
                    size={activeTab === "Orders" ? 30 : 22}
                    color={activeTab === "Orders" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
                />,
                "Orders tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <MaterialIcons
                    name="person"
                    size={activeTab === "Profile" ? 32 : 24}
                    color={activeTab === "Profile" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
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
                    size={activeTab === "Home" ? 30 : 22}
                    color={activeTab === "Home" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
                />,
                "Home tab"
            )}

            {renderTabItem(
                "/shop/orders",
                "Orders",
                activeTab === "Orders",
                <MaterialIcons
                    name="receipt-long"
                    size={activeTab === "Orders" ? 30 : 22}
                    color={activeTab === "Orders" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
                />,
                "Orders tab"
            )}

            {renderTabItem(
                "/shop/items",
                "Items",
                activeTab === "Items",
                <MaterialIcons
                    name="inventory"
                    size={activeTab === "Items" ? 30 : 22}
                    color={activeTab === "Items" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
                />,
                "Items tab"
            )}

            {renderTabItem(
                "/profile",
                "Profile",
                activeTab === "Profile",
                <MaterialIcons
                    name="person"
                    size={activeTab === "Profile" ? 32 : 24}
                    color={activeTab === "Profile" ? "#BC4A4D" : "rgba(200,200,200,0.7)"}
                />,
                "Profile tab"
            )}
        </>
    );

    return (
        <StyledView
            className="absolute bottom-0 left-0 right-0 bg-[#BC4A4D] px-6 pt-2 pb-5"
            style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 12,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                zIndex: 1000,
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
                    opacity: 0.2,
                }}
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Main navigation container */}
            <StyledView className="flex-row justify-around items-center relative z-10">
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

export default memo(BottomNavigation);