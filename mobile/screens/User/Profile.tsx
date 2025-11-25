import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert, Animated, Image } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import BottomNavigation from "../../components/BottomNavigation"
import ProfilePictureModal from "../../components/ProfilePictureModal"
import { useEffect, useState, useRef } from "react"
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { clearStoredAuthState, useAuthentication, getAuthToken, AUTH_TOKEN_KEY } from "../../services/authService"
import axios from "axios"
import { API_URL } from "../../config"
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { styled } from "nativewind"
import { useCallback } from 'react';
import { webSocketService } from "../../services/webSocketService";
import { walletService } from "../../services/walletService";
import { clearCachedAccountType } from "../../utils/accountCache";
import { useProtectedRoute } from "../../hooks/useNavigationSecurity";

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)
const StyledSafeAreaView = styled(SafeAreaView)
const StyledImage = styled(Image)

export const unstable_settings = { headerShown: false };

type RootStackParamList = {
    EditProfile: undefined;
    // ... other screens
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface User {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    username: string;
    phone: string;
    courseYear: string;
    schoolIdNum: string;
    accountType: string;
    wallet?: number;
    acceptGCASH?: boolean;
    profilePictureUrl?: string;
}

const Profile = () => {
    // 🔒 SECURITY: Protect this route from unauthorized access
    const { isAuthenticated, isLoading: authLoading } = useProtectedRoute();
    
    // Animation values for loading
    const spinValue = useRef(new Animated.Value(0)).current;
    const circleValue = useRef(new Animated.Value(0)).current;

    const [user, setUser] = useState<User | null>(null);
    const [initialData, setInitialData] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [profilePictureModalVisible, setProfilePictureModalVisible] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const { getAccessToken, signOut, isLoggedIn, authState } = useAuthentication();
    const navigation = useNavigation<NavigationProp>();

    // WebSocket and wallet service integration
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        
        if (user && user.accountType && (user.accountType === 'dasher' || user.accountType === 'shop')) {
            console.log('Initializing WebSocket and wallet service for user:', user.id, user.accountType);
            
            // Connect to WebSocket for real-time updates
            webSocketService.connect(user.id, user.accountType);
            
            // Subscribe to wallet changes
            unsubscribe = walletService.onWalletChange((walletData) => {
                console.log('Wallet change detected:', walletData);
                if (walletData.userId === user.id && walletData.accountType === user.accountType) {
                    // Update user state with new wallet balance
                    setUser(prevUser => prevUser ? { ...prevUser, wallet: walletData.wallet } : null);
                }
            });
        }

        // Cleanup function - only disconnect if not logging out
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
            // Don't disconnect WebSocket here during logout - it's handled in handleLogout
            // Only disconnect if component is unmounting for other reasons
            if (!isLoggingOut && user?.id) {
                webSocketService.disconnect();
            }
        };
    }, [user?.id, user?.accountType, isLoggingOut]);

    // Cleanup WebSocket on unmount - removed duplicate cleanup
    // WebSocket cleanup is now handled in the main effect above

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

    // This effect will run whenever auth state changes or when component mounts
    useEffect(() => {
        const checkUserChange = async () => {
            // Always clear existing user data when auth state changes
            setUser(null);
            setInitialData(null);

            // First check if we have OAuth user data stored
            const oauthUserData = await AsyncStorage.getItem('@CampusEats:UserData');

            // Get current stored user ID
            let storedUserId = await AsyncStorage.getItem('userId');
            console.log("Current stored userId:", storedUserId);
            console.log("Previous userId in state:", currentUserId);

            // If we have OAuth user data but no userId, try to extract it
            if (oauthUserData && (!storedUserId || storedUserId === 'null')) {
                try {
                    const userData = JSON.parse(oauthUserData);
                    if (userData && userData.id) {
                        console.log("Found userId in stored OAuth user data:", userData.id);
                        storedUserId = userData.id;
                        await AsyncStorage.setItem('userId', userData.id);
                    }
                } catch (error) {
                    console.error("Error parsing OAuth user data:", error);
                }
            }

            // If user ID changed or we're logged in but have no user data, fetch new data
            if (storedUserId !== currentUserId || (isLoggedIn && !user)) {
                console.log("User ID changed or new login detected, refreshing profile data");
                setCurrentUserId(storedUserId);
                fetchUserData(true); // force refresh
            }
        };

        checkUserChange();
    }, [isLoggedIn, authState]);

    // Refresh user data when screen comes into focus (e.g., returning from topup screen)
    useFocusEffect(
        useCallback(() => {
            // Refresh data every time the screen comes into focus
            // This ensures we always have the latest wallet balance
            if (isLoggedIn) {
                console.log('Profile screen focused, fetching latest user data...');
                // Clear any cached user data to force a complete refresh
                setUser(null);
                setInitialData(null);
                fetchUserData(true); // Force refresh to get the absolute latest data
            }
        }, [isLoggedIn])
    );

    // Show loading while auth is being determined
    if (authLoading) {
        return (
            <StyledView className="flex-1 justify-center items-center" style={{ backgroundColor: '#DFD6C5' }}>
                <StyledText className="text-[#BC4A4D] text-base font-semibold">
                    Loading...
                </StyledText>
            </StyledView>
        );
    }

    // Early return if not authenticated - show loading while redirecting
    if (!isAuthenticated) {
        return (
            <StyledView className="flex-1 justify-center items-center" style={{ backgroundColor: '#DFD6C5' }}>
                <StyledText className="text-[#BC4A4D] text-base font-semibold">
                    Redirecting to login...
                </StyledText>
            </StyledView>
        );
    }

    const fetchUserData = async (forceRefresh = false) => {
        setIsLoading(true);
        setError(null);

        try {
            // Try to get OAuth token first
            let token = await getAccessToken();

            // If no OAuth token, try traditional token
            if (!token) {
                token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
                console.log("Using traditional auth token for profile");
            }

            if (!token) {
                console.error("AUTH_TOKEN_MISSING: No token found for fetching user profile.");
                setError("Authentication token missing. Please log in again.");
                setIsLoading(false);
                return;
            }

            // Try to get the userId from various sources
            let userId = null;

            // First check directly from AsyncStorage
            userId = await AsyncStorage.getItem('userId');
            console.log("Initial userId from storage:", userId);

            // Clear the stored userId if we're forcing a refresh
            if (forceRefresh && userId) {
                console.log("Force refresh requested, clearing stored user ID cache");
                await AsyncStorage.removeItem('userId');
                userId = null;
            }

            // If no userId, check for stored OAuth user data
            if (!userId || userId === 'null') {
                const oauthUserData = await AsyncStorage.getItem('@CampusEats:UserData');
                if (oauthUserData) {
                    try {
                        const userData = JSON.parse(oauthUserData);
                        if (userData && userData.id) {
                            userId = userData.id;
                            console.log("Found userId in stored OAuth user data:", userId);
                            await AsyncStorage.setItem('userId', userId);
                        }
                    } catch (error) {
                        console.error("Error parsing OAuth user data:", error);
                    }
                }
            }

            // If still no userId, try to extract it from the token
            if (!userId || userId === 'null') {
                try {
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1]));
                        // Try multiple fields where the ID might be stored
                        userId = payload.sub || payload.oid || payload.userId || payload.id;

                        if (userId) {
                            console.log("Extracted userId from token:", userId);
                            await AsyncStorage.setItem('userId', userId);
                        } else {
                            console.warn("No userId found in token payload");
                        }
                    }
                } catch (error) {
                    console.error("Failed to extract userId from token:", error);
                }
            }

            // If still no userId, try a direct API call to get user info
            if (!userId || userId === 'null') {
                try {
                    console.log("Attempting to fetch user information from /me endpoint");
                    const meResponse = await axios.get(`${API_URL}/api/users/me`, {
                        headers: { Authorization: token }
                    });

                    if (meResponse.data && meResponse.data.id) {
                        userId = meResponse.data.id;
                        console.log("Fetched userId from /me endpoint:", userId);
                        await AsyncStorage.setItem('userId', userId);
                    }
                } catch (error) {
                    console.error("Failed to get user information from /me endpoint:", error);
                }
            }

            // Final check if we have a userId
            if (!userId || userId === 'null') {
                throw new Error("Unable to determine user ID from any source");
            }

            // Debug token format to verify it's properly formatted
            console.log(`Token format check: ${token.substring(0, 10)}... (length: ${token.length})`);

            // Make API request to get user profile
            // Add cache-busting parameter to prevent browser/axios caching
            const cacheParam = `_nocache=${new Date().getTime()}`;
            const response = await axios.get(`${API_URL}/api/users/${userId}?${cacheParam}`, {
                headers: {
                    Authorization: token,
                    // Add headers to prevent caching
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            let userData = response.data;
            console.log("User data fetched successfully:", userData);
            console.log("User ID from API:", userData.id);

            // If user is a dasher, fetch additional dasher data including wallet
            if (userData.accountType === 'dasher') {
                try {
                    const dasherCacheParam = `_nocache=${new Date().getTime()}`;
                    const dasherResponse = await axios.get(`${API_URL}/api/dashers/${userId}?${dasherCacheParam}`, {
                        headers: {
                            Authorization: token,
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        }
                    });

                    if (dasherResponse.data && dasherResponse.data.wallet !== undefined) {
                        // Update the wallet value in the user data
                        userData = {
                            ...userData,
                            wallet: dasherResponse.data.wallet
                        };
                        console.log("Dasher wallet updated to latest:", userData.wallet);
                    }
                } catch (dasherError) {
                    console.error("Error fetching dasher wallet information:", dasherError);
                }
            }

            // If user is a shop, fetch additional shop data including wallet and acceptGCASH status
            if (userData.accountType === 'shop') {
                try {
                    console.log("Fetching additional shop information...");
                    const shopCacheParam = `_nocache=${new Date().getTime()}`;
                    const shopResponse = await axios.get(`${API_URL}/api/shops/${userId}?${shopCacheParam}`, {
                        headers: {
                            Authorization: token,
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        }
                    });

                    console.log("Shop data received:", shopResponse.data);

                    if (shopResponse.data) {
                        // Update the wallet and acceptGCASH in the user data
                        userData = {
                            ...userData,
                            wallet: shopResponse.data.wallet !== undefined ? shopResponse.data.wallet : userData.wallet,
                            acceptGCASH: shopResponse.data.acceptGCASH !== undefined ? shopResponse.data.acceptGCASH : userData.acceptGCASH
                        };
                        console.log("Shop wallet updated to latest:", userData.wallet);
                        console.log("Shop acceptGCASH status:", userData.acceptGCASH);
                    }
                } catch (shopError) {
                    console.error("Error fetching shop information:", shopError);
                }
            }

            // Update current user ID
            setCurrentUserId(userData.id);

            // Store the user ID in AsyncStorage to ensure consistency
            await AsyncStorage.setItem('userId', userData.id);

            // Update state with new user data
            setUser(userData);
            setInitialData(userData);
        } catch (error: any) {
            console.error("ERROR_FETCHING_USER: Failed to fetch user profile.", error);
            setError(error?.response?.data?.message || error?.message || "Failed to load user profile");

            // If we get a 401 or 403, the token might be invalid
            if (error?.response?.status === 401 || error?.response?.status === 403) {
                Alert.alert(
                    "Authentication Error",
                    "Your session has expired. Please log in again.",
                    [{ text: "OK", onPress: () => handleLogout() }]
                );
            } else if (error.message === "Unable to determine user ID from any source") {
                // Special handling for user ID issues
                Alert.alert(
                    "Profile Error",
                    "Unable to determine your user information. Would you like to try logging out and back in?",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Log Out", onPress: () => handleLogout() }
                    ]
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleProfilePictureSuccess = (newProfilePictureUrl: string) => {
        // Update user state with new profile picture
        if (user) {
            setUser({ ...user, profilePictureUrl: newProfilePictureUrl });
        }
    };

    const handleLogout = async () => {
        try {
            console.log("🚪 Performing secure logout...");
            setIsLoggingOut(true);

            // Disconnect WebSocket FIRST to prevent reconnection attempts
            webSocketService.disconnect();

            // Clear user state immediately
            setUser(null);
            setInitialData(null);
            setCurrentUserId(null);

            // Clear account type cache
            clearCachedAccountType();
            
            // Use the secure signOut function from auth service
            // This will handle storage clearing, credential restoration, and navigation
            await signOut();
            
            console.log("🔒 Secure logout complete");
        } catch (error) {
            console.error("❌ Error during logout:", error);
            // Even if there's an error, force navigation
            try {
                router.replace('/');
            } catch (navErr) {
                console.warn('Navigation after logout failed', navErr);
            }
        } finally {
            setIsLoggingOut(false);
        }
    };

    if (isLoading) {
        return (
            <StyledView className="flex-1 justify-center items-center" style={{ backgroundColor: '#DFD6C5' }}>
                <StyledView className="items-center">
                    {/* Spinning Logo Container */}
                    <StyledView className="relative mb-6">
                        {/* Outer rotating circle */}
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
                        
                        {/* Logo container */}
                        <StyledView className="w-16 h-16 rounded-full bg-[#BC4A4D]/10 items-center justify-center mx-2 my-2">
                            <Animated.View
                                style={{
                                    transform: [{ rotate: spin }],
                                }}
                            >
                                <StyledImage
                                    source={require('../../assets/images/logo.png')}
                                    className="w-10 h-10 rounded-full"
                                    style={{ resizeMode: 'contain' }}
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
        )
    }

    return (
        <StyledSafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
            <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Simple Header */}
                <StyledView 
                    className="px-6 pt-4 pb-6"
                    style={{
                        backgroundColor: 'white',
                        borderBottomLeftRadius: 16,
                        borderBottomRightRadius: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                        elevation: 2,
                    }}
                >
                    <StyledView className="items-center">
                        <StyledText className="text-2xl font-bold mb-1">
                            <StyledText className="text-[#BC4A4D]">Campus</StyledText>
                            <StyledText className="text-[#DAA520]">Eats</StyledText>
                        </StyledText>
                        <StyledText className="text-base text-[#666] font-medium">My Profile</StyledText>
                    </StyledView>
                </StyledView>

                {/* Enhanced Error Message */}
                {error && !isLoading && (
                    <StyledView 
                        className="mx-6 mb-6 p-6 rounded-3xl border-2"
                        style={{
                            backgroundColor: '#FEF2F2',
                            borderColor: '#FECACA',
                            shadowColor: '#EF4444',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 2,
                        }}
                    >
                        <StyledView className="items-center mb-4">
                            <StyledView 
                                className="w-16 h-16 rounded-full items-center justify-center mb-3"
                                style={{ backgroundColor: '#FEE2E2' }}
                            >
                                <Ionicons name="alert-circle" size={32} color="#EF4444" />
                            </StyledView>
                            <StyledText className="text-lg font-bold text-center text-[#DC2626] mb-2">
                                Connection Error
                            </StyledText>
                            <StyledText className="text-sm text-[#EF4444] text-center leading-5">
                                {error}
                            </StyledText>
                        </StyledView>
                        <StyledTouchableOpacity
                            className="py-4 px-6 rounded-2xl self-center flex-row items-center"
                            style={{
                                backgroundColor: '#EF4444',
                                shadowColor: '#EF4444',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3,
                                shadowRadius: 4,
                                elevation: 3,
                            }}
                            onPress={() => fetchUserData(true)}
                        >
                            <Ionicons name="refresh" size={18} color="white" style={{ marginRight: 8 }} />
                            <StyledText className="text-white text-base font-bold">Try Again</StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                )}

                {/* Simple Profile Header Card */}
                <StyledView 
                    className="mx-6 mb-4 rounded-xl overflow-hidden"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                    }}
                >
                    {/* Header Background */}
                    <StyledView 
                        className="p-6 items-center"
                        style={{
                            backgroundColor: '#BC4A4D',
                        }}
                    >
                            <TouchableOpacity 
                                onPress={() => setProfilePictureModalVisible(true)}
                                activeOpacity={0.7}
                            >
                                <StyledView 
                                    className="w-28 h-28 rounded-full justify-center items-center mb-4"
                                    style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                        borderWidth: 3,
                                        borderColor: 'rgba(255, 255, 255, 0.3)',
                                    }}
                                >
                                    {user?.profilePictureUrl ? (
                                        <Image 
                                            source={{ uri: user.profilePictureUrl }}
                                            style={{ width: '100%', height: '100%', borderRadius: 999 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Ionicons name="person" size={48} color="white" />
                                    )}
                                </StyledView>
                                <StyledView 
                                    style={{
                                        position: 'absolute',
                                        bottom: 4,
                                        right: 4,
                                        backgroundColor: '#BC4A4D',
                                        borderRadius: 17,
                                        width: 34,
                                        height: 34,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderWidth: 2,
                                        borderColor: 'white',
                                    }}
                                >
                                    <Ionicons name="camera" size={16} color="white" />
                                </StyledView>
                            </TouchableOpacity>
                        <StyledText className="text-xl font-bold text-white text-center mb-1">
                            {user ? `${user.firstname} ${user.lastname}` : 'Loading...'}
                        </StyledText>
                        <StyledView 
                            className="px-4 py-1 rounded-full"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                        >
                            <StyledText className="text-sm text-white font-medium">
                                @{user?.username || 'Loading...'}
                            </StyledText>
                        </StyledView>
                    </StyledView>

                    {/* Simple User Details */}
                    <StyledView 
                        className="bg-white p-4"
                        style={{
                            borderTopLeftRadius: 0,
                            borderTopRightRadius: 0,
                        }}
                    >
                        {/* User Details */}
                        <StyledView className="space-y-3">
                            {user?.courseYear && (
                                <StyledView 
                                    className="flex-row items-center p-3 rounded-lg"
                                    style={{
                                        backgroundColor: '#F8F9FA',
                                        borderLeftWidth: 3,
                                        borderLeftColor: '#DAA520',
                                    }}
                                >
                                    <StyledView 
                                        className="w-8 h-8 rounded-full justify-center items-center mr-3"
                                        style={{ backgroundColor: '#DAA520' }}
                                    >
                                        <Ionicons name="school-outline" size={16} color="white" />
                                    </StyledView>
                                    <StyledView className="flex-1">
                                        <StyledText className="text-xs text-[#8B4513] font-medium">
                                            Academic Year
                                        </StyledText>
                                        <StyledText className="text-sm text-[#8B4513] font-semibold">
                                            Year {user.courseYear}
                                        </StyledText>
                                    </StyledView>
                                </StyledView>
                            )}
                            
                            {user?.schoolIdNum && (
                                <StyledView 
                                    className="flex-row items-center p-3 rounded-lg"
                                    style={{
                                        backgroundColor: '#F8F9FA',
                                        borderLeftWidth: 3,
                                        borderLeftColor: '#10B981',
                                    }}
                                >
                                    <StyledView 
                                        className="w-8 h-8 rounded-full justify-center items-center mr-3"
                                        style={{ backgroundColor: '#10B981' }}
                                    >
                                        <Ionicons name="card-outline" size={16} color="white" />
                                    </StyledView>
                                    <StyledView className="flex-1">
                                        <StyledText className="text-xs text-[#8B4513] font-medium">
                                            Student ID
                                        </StyledText>
                                        <StyledText className="text-sm text-[#8B4513] font-semibold">
                                            {user.schoolIdNum}
                                        </StyledText>
                                    </StyledView>
                                </StyledView>
                            )}
                            
                            {user?.accountType && (
                                <StyledView 
                                    className="flex-row items-center p-3 rounded-lg"
                                    style={{
                                        backgroundColor: '#F8F9FA',
                                        borderLeftWidth: 3,
                                        borderLeftColor: '#BC4A4D',
                                    }}
                                >
                                    <StyledView 
                                        className="w-8 h-8 rounded-full justify-center items-center mr-3"
                                        style={{ backgroundColor: '#BC4A4D' }}
                                    >
                                        <Ionicons name="shield-outline" size={16} color="white" />
                                    </StyledView>
                                    <StyledView className="flex-1">
                                        <StyledText className="text-xs text-[#8B4513] font-medium">
                                            Account Type
                                        </StyledText>
                                        <StyledText className="text-sm text-[#8B4513] font-semibold capitalize">
                                            {user.accountType} Account
                                        </StyledText>
                                    </StyledView>
                                </StyledView>
                            )}
                        </StyledView>

                        {/* Simple Edit Profile Button */}
                        <StyledTouchableOpacity
                            className="mt-4 py-3 px-4 rounded-xl"
                            style={{
                                backgroundColor: '#BC4A4D',
                                shadowColor: '#BC4A4D',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.2,
                                shadowRadius: 4,
                                elevation: 3,
                            }}
                            onPress={() => router.push('/edit-profile' as any)}
                        >
                            <StyledView className="flex-row items-center justify-center">
                                <Ionicons name="create-outline" size={20} color="white" />
                                <StyledText className="text-base text-white font-semibold ml-3">Edit Profile</StyledText>
                            </StyledView>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>

                {/* Simple Wallet Card */}
                {(user?.accountType === 'dasher' || user?.accountType === 'shop') && (
                    <StyledView 
                        className="mx-6 mb-4 rounded-xl overflow-hidden"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 3,
                        }}
                    >
                        <StyledView 
                                    className="p-5"
                            style={{
                                backgroundColor: '#10B981',
                            }}
                        >
                            <StyledView className="flex-row items-center justify-between">
                                <StyledView className="flex-row items-center">
                                    <StyledView 
                                        className="w-10 h-10 rounded-full justify-center items-center mr-3"
                                        style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                        }}
                                    >
                                        <Ionicons name="wallet-outline" size={20} color="white" />
                                    </StyledView>
                                    <StyledView>
                                        <StyledText className="text-sm text-white font-medium opacity-90">
                                            Wallet Balance
                                        </StyledText>
                                        <StyledText className="text-xs text-white opacity-75">
                                            Available funds
                                        </StyledText>
                                    </StyledView>
                                </StyledView>
                                <StyledView className="items-end">
                                    {user?.accountType === 'dasher' ? (
                                        <StyledText className="text-2xl font-bold text-white">
                                            ₱{user?.wallet ? user.wallet.toFixed(2) : '0.00'}
                                        </StyledText>
                                    ) : user?.accountType === 'shop' && (
                                        user?.acceptGCASH ? (
                                            <StyledText className="text-xl font-bold text-white">
                                                ₱{user?.wallet ? user.wallet.toFixed(2) : '0.00'}
                                            </StyledText>
                                        ) : (
                                            <StyledView 
                                                className="px-2 py-1 rounded-full"
                                                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                                            >
                                                <StyledText className="text-xs text-white font-medium">
                                                    Edit shop to activate
                                                </StyledText>
                                            </StyledView>
                                        )
                                    )}
                                </StyledView>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                )}

                {/* Simple Quick Actions for Dashers */}
                {user?.accountType === 'DASHER' && (
                    <StyledView className="mx-6 mb-4">
                        <StyledView className="flex-row items-center mb-3">
                            <StyledView 
                                className="w-1 h-4 rounded-full mr-2"
                                style={{ backgroundColor: '#BC4A4D' }}
                            />
                            <StyledText className="text-base font-bold text-[#8B4513]">Quick Actions</StyledText>
                        </StyledView>
                        
                        <StyledView className="space-y-3">
                            <StyledTouchableOpacity
                                className="p-3 rounded-xl"
                                style={{
                                    backgroundColor: '#BC4A4D',
                                    shadowColor: '#BC4A4D',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 4,
                                    elevation: 3,
                                }}
                                onPress={() => router.push('/dasher/application' as any)}
                            >
                                <StyledView className="flex-row items-center justify-center">
                                    <Ionicons name="document-text-outline" size={18} color="white" />
                                    <StyledText className="text-white text-sm font-semibold ml-2">Dasher Application</StyledText>
                                </StyledView>
                            </StyledTouchableOpacity>
                            
                            <StyledView className="flex-row space-x-3">
                                <StyledTouchableOpacity
                                    className="flex-1 p-3 rounded-lg"
                                    style={{
                                        backgroundColor: '#DAA520',
                                        shadowColor: '#DAA520',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 3,
                                        elevation: 2,
                                    }}
                                    onPress={() => router.push('/dasher/topup' as any)}
                                >
                                    <StyledView className="flex-row items-center justify-center">
                                        <Ionicons name="add-circle-outline" size={16} color="white" />
                                        <StyledText className="text-white text-xs font-semibold ml-1">Top Up</StyledText>
                                    </StyledView>
                                </StyledTouchableOpacity>
                                
                                <StyledTouchableOpacity
                                    className="flex-1 p-3 rounded-lg"
                                    style={{
                                        backgroundColor: '#10B981',
                                        shadowColor: '#10B981',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 3,
                                        elevation: 2,
                                    }}
                                    onPress={() => router.push('/dasher/reimburse' as any)}
                                >
                                    <StyledView className="flex-row items-center justify-center">
                                        <Ionicons name="receipt-outline" size={16} color="white" />
                                        <StyledText className="text-white text-xs font-semibold ml-1">Reimburse</StyledText>
                                    </StyledView>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                )}

                {/* Simple Menu Options */}
                <StyledView 
                    className="mx-6 mb-4 rounded-xl overflow-hidden"
                    style={{
                        backgroundColor: 'white',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                        elevation: 2,
                    }}
                >
                    {user?.accountType === 'regular' ? (
                        <>
                            <StyledTouchableOpacity
                                className="flex-row items-center p-4"
                                style={{
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#f5f5f5',
                                }}
                                onPress={() => router.push('/dasher/application' as any)}
                            >
                                <StyledView 
                                    className="w-9 h-9 rounded-full justify-center items-center mr-3"
                                    style={{
                                        backgroundColor: '#FF9800',
                                    }}
                                >
                                    <Ionicons name="bicycle-outline" size={18} color="white" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-sm font-semibold text-[#8B4513]">Become a Dasher</StyledText>
                                    <StyledText className="text-xs text-[#8B4513]">Start earning by delivering orders</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={18} color="#BC4A4D" />
                            </StyledTouchableOpacity>

                            <StyledTouchableOpacity
                                className="flex-row items-center p-4"
                                style={{
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#f5f5f5',
                                }}
                                onPress={() => router.push('/apply-shop' as any)}
                            >
                                <StyledView 
                                    className="w-9 h-9 rounded-full justify-center items-center mr-3"
                                    style={{
                                        backgroundColor: '#10B981',
                                    }}
                                >
                                    <Ionicons name="storefront-outline" size={18} color="white" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-sm font-semibold text-[#8B4513]">Add Your Shop</StyledText>
                                    <StyledText className="text-xs text-[#8B4513]">Register your business</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={18} color="#BC4A4D" />
                            </StyledTouchableOpacity>

                            <StyledTouchableOpacity
                                className="flex-row items-center p-4"
                                onPress={() => router.push('/history-order' as any)}
                            >
                                <StyledView 
                                    className="w-9 h-9 rounded-full justify-center items-center mr-3"
                                    style={{
                                        backgroundColor: '#DAA520',
                                    }}
                                >
                                    <Ionicons name="time-outline" size={18} color="white" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-sm font-semibold text-[#8B4513]">Order History</StyledText>
                                    <StyledText className="text-xs text-[#8B4513]">View your past orders</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={18} color="#BC4A4D" />
                            </StyledTouchableOpacity>
                        </>
                    ) : user?.accountType === 'dasher' ? (
                        <>
                            <StyledTouchableOpacity
                                className="flex-row items-center p-5 border-b border-[#f5f5f5]"
                                onPress={() => router.push('/dasher/cashout' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#e8f5e8] justify-center items-center mr-4">
                                    <Ionicons name="cash-outline" size={20} color="#4CAF50" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#8B4513]">Cash Out</StyledText>
                                    <StyledText className="text-sm text-[#8B4513]">Withdraw your earnings</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>

                            <StyledTouchableOpacity
                                className="flex-row items-center p-5 border-b border-[#f5f5f5]"
                                onPress={() => router.push('/dasher/topup' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#e3f2fd] justify-center items-center mr-4">
                                    <Ionicons name="wallet-outline" size={20} color="#2196F3" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#8B4513]">Top Up Wallet</StyledText>
                                    <StyledText className="text-sm text-[#8B4513]">Add funds to your wallet</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>

                            {/*<StyledTouchableOpacity
                                className="flex-row items-center p-5 border-b border-[#f5f5f5]"
                                onPress={() => router.push('/dasher/reimburse' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#fff3e0] justify-center items-center mr-4">
                                    <Ionicons name="receipt-outline" size={20} color="#FF9800" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#333]">Request Reimbursement</StyledText>
                                    <StyledText className="text-sm text-[#666]">Submit expense claims</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>*/}

                            <StyledTouchableOpacity
                                className="flex-row items-center p-5"
                                onPress={() => router.push('/dasher/update' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#f3e5f5] justify-center items-center mr-4">
                                    <Ionicons name="create-outline" size={20} color="#9C27B0" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#8B4513]">Edit Dasher Profile</StyledText>
                                    <StyledText className="text-sm text-[#8B4513]">Update your information</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>
                        </>
                    ) : user?.accountType === 'shop' ? (
                        <>
                            <StyledTouchableOpacity
                                className="flex-row items-center p-5 border-b border-[#f5f5f5]"
                                onPress={() => router.push('/shop/cashout' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#e8f5e8] justify-center items-center mr-4">
                                    <Ionicons name="cash-outline" size={20} color="#4CAF50" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#8B4513]">Cash Out</StyledText>
                                    <StyledText className="text-sm text-[#8B4513]">Withdraw your earnings</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>

                            <StyledTouchableOpacity
                                className="flex-row items-center p-5 border-b border-[#f5f5f5]"
                                onPress={() => router.push('/shop/order-complete' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#e3f2fd] justify-center items-center mr-4">
                                    <Ionicons name="checkmark-circle-outline" size={20} color="#2196F3" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#8B4513]">Completed Orders</StyledText>
                                    <StyledText className="text-sm text-[#8B4513]">View your completed orders</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>

                            <StyledTouchableOpacity
                                className="flex-row items-center p-5"
                                onPress={() => router.push('/shop/update' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#f3e5f5] justify-center items-center mr-4">
                                    <Ionicons name="create-outline" size={20} color="#9C27B0" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#8B4513]">Edit Shop</StyledText>
                                    <StyledText className="text-sm text-[#8B4513]">Update shop information</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>
                        </>
                    ) : null}
                </StyledView>

                {/* Simple Logout Section */}
                <StyledView className="mx-6 mb-6">
                    <StyledTouchableOpacity
                        className="rounded-xl p-4"
                        style={{
                            backgroundColor: 'white',
                            borderWidth: 1,
                            borderColor: '#BC4A4D',
                            shadowColor: '#BC4A4D',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 2,
                        }}
                        onPress={handleLogout}
                        disabled={isLoggingOut}
                    >
                        <StyledView className="flex-row items-center justify-center">
                            <StyledView 
                                className="w-8 h-8 rounded-full justify-center items-center mr-2"
                                style={{ backgroundColor: '#BC4A4D' }}
                            >
                                <Ionicons name="log-out-outline" size={16} color="white" />
                            </StyledView>
                            <StyledText className="text-base font-semibold text-[#BC4A4D]" style={{ opacity: isLoggingOut ? 0.6 : 1 }}>Log Out</StyledText>
                        </StyledView>
                    </StyledTouchableOpacity>
                </StyledView>

                {/* Logging out overlay */}
                {isLoggingOut && (
                    <StyledView
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.4)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 9999,
                        }}
                    >
                        <StyledView
                            style={{
                                backgroundColor: 'white',
                                padding: 20,
                                borderRadius: 12,
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.1,
                                shadowRadius: 8,
                                elevation: 6,
                            }}
                        >
                            <ActivityIndicator size="large" color="#BC4A4D" />
                            <StyledText className="text-[#8B4513] font-semibold mt-3">Logging out...</StyledText>
                        </StyledView>
                    </StyledView>
                )}
            </StyledScrollView>

            {/* Profile Picture Modal */}
            {user && (
                <ProfilePictureModal
                    visible={profilePictureModalVisible}
                    onClose={() => setProfilePictureModalVisible(false)}
                    currentProfilePicture={user.profilePictureUrl}
                    userId={user.id}
                    onSuccess={handleProfilePictureSuccess}
                />
            )}

            {/* Only show BottomNavigation if not logging out */}
            {!isLoggingOut && <BottomNavigation activeTab="Profile" />}
        </StyledSafeAreaView>
    )
}

export default Profile;