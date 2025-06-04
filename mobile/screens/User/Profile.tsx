import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import BottomNavigation from "../../components/BottomNavigation"
import { useEffect, useState } from "react"
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { clearStoredAuthState, useAuthentication, getAuthToken, AUTH_TOKEN_KEY } from "../../services/authService"
import axios from "axios"
import { API_URL } from "../../config"
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { styled } from "nativewind"

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)
const StyledSafeAreaView = styled(SafeAreaView)

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
}

const Profile = () => {
    const [user, setUser] = useState<User | null>(null);
    const [initialData, setInitialData] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const { getAccessToken, signOut, isLoggedIn, authState } = useAuthentication();
    const navigation = useNavigation<NavigationProp>();

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
                    const dasherResponse = await axios.get(`${API_URL}/api/dashers/${userId}`, {
                        headers: { Authorization: token }
                    });

                    if (dasherResponse.data && dasherResponse.data.wallet !== undefined) {
                        // Update the wallet value in the user data
                        userData = {
                            ...userData,
                            wallet: dasherResponse.data.wallet
                        };
                        console.log("Dasher wallet updated:", userData.wallet);
                    }
                } catch (dasherError) {
                    console.error("Error fetching dasher wallet information:", dasherError);
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

    const handleLogout = async () => {
        try {
            console.log("Performing complete sign-out...");

            // Clear user state immediately
            setUser(null);
            setInitialData(null);
            setCurrentUserId(null);

            // Explicitly remove userId from storage
            await AsyncStorage.removeItem('userId');

            // Use the signOut method from authentication hook if available
            if (signOut) {
                await signOut();
            }

            // Also use the clearStoredAuthState function for additional safety
            await clearStoredAuthState();

            // Clear ALL app storage to ensure no user data remains
            await AsyncStorage.clear();
            console.log("⚠️ ALL AsyncStorage data has been cleared!");

            // Force navigation to root
            console.log("Sign-out complete, redirecting to login page");
            router.replace('/');

            // Add a double check to ensure navigation works
            setTimeout(() => {
                console.log("Double-checking navigation after logout...");
                router.replace('/');
            }, 500);
        } catch (error) {
            console.error("Error during sign-out:", error);
            // Even if there's an error, try to navigate away
            router.replace('/');
        }
    };

    if (isLoading) {
        return (
            <StyledView className="flex-1 bg-[#fae9e0]">
                <StyledView className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#BC4A4D" />
                    <StyledText className="mt-4 text-base text-[#666]">Loading profile...</StyledText>
                </StyledView>
                <BottomNavigation activeTab="Profile" />
            </StyledView>
        )
    }

    return (
        <StyledSafeAreaView className="flex-1 bg-[#fae9e0]">
            <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <StyledView className="px-6 pt-4 pb-6">
                    <StyledText className="text-3xl font-bold text-center text-[#333]">Profile</StyledText>
                </StyledView>

                {/* Error Message */}
                {error && !isLoading && (
                    <StyledView className="mx-6 mb-4 p-4 bg-red-50 rounded-2xl border border-red-100">
                        <StyledText className="text-sm text-[#ff3b30] text-center mb-3">{error}</StyledText>
                        <StyledTouchableOpacity
                            className="bg-[#BC4A4D] py-3 px-6 rounded-xl self-center"
                            onPress={() => fetchUserData(true)}
                        >
                            <StyledText className="text-white text-sm font-semibold">Retry</StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                )}

                {/* Profile Header Card */}
                <StyledView className="bg-white rounded-3xl mx-6 p-6 mb-6 shadow-sm">
                    <StyledView className="items-center mb-4">
                        <StyledView className="w-20 h-20 rounded-full bg-[#f8f8f8] justify-center items-center mb-4 border-2 border-[#f0f0f0]">
                            <Ionicons name="person-outline" size={32} color="#BC4A4D" />
                        </StyledView>
                        <StyledText className="text-xl font-bold text-[#333] text-center">
                            {user ? `${user.firstname} ${user.lastname}` : 'Loading...'}
                        </StyledText>
                        <StyledText className="text-base text-[#666] mt-1">@{user?.username || 'Loading...'}</StyledText>
                    </StyledView>

                    {/* User Details */}
                    <StyledView className="space-y-3">
                        {user?.courseYear && (
                            <StyledView className="flex-row items-center">
                                <Ionicons name="school-outline" size={16} color="#666" />
                                <StyledText className="text-sm text-[#666] ml-2">Year {user.courseYear}</StyledText>
                            </StyledView>
                        )}
                        {user?.schoolIdNum && (
                            <StyledView className="flex-row items-center">
                                <Ionicons name="card-outline" size={16} color="#666" />
                                <StyledText className="text-sm text-[#666] ml-2">ID: {user.schoolIdNum}</StyledText>
                            </StyledView>
                        )}
                        {user?.accountType && (
                            <StyledView className="flex-row items-center">
                                <Ionicons name="shield-outline" size={16} color="#666" />
                                <StyledText className="text-sm text-[#666] ml-2 capitalize">{user.accountType} Account</StyledText>
                            </StyledView>
                        )}
                    </StyledView>

                    {/* Edit Profile Button */}
                    <StyledTouchableOpacity
                        className="mt-6 bg-[#f8f8f8] py-3 px-4 rounded-xl"
                        onPress={() => router.push('/(tabs)/edit-profile' as any)}
                    >
                        <StyledView className="flex-row items-center justify-center">
                            <Ionicons name="create-outline" size={18} color="#BC4A4D" />
                            <StyledText className="text-sm text-[#BC4A4D] font-semibold ml-2">Edit Profile</StyledText>
                        </StyledView>
                    </StyledTouchableOpacity>
                </StyledView>

                {/* Wallet Card */}
                {(user?.accountType === 'dasher' || user?.accountType === 'shop') && (
                    <StyledView className="bg-white rounded-3xl mx-6 p-6 mb-6 shadow-sm">
                        <StyledView className="flex-row items-center justify-between">
                            <StyledView className="flex-row items-center">
                                <StyledView className="w-12 h-12 rounded-full bg-[#f0f8f0] justify-center items-center mr-4">
                                    <Ionicons name="wallet-outline" size={24} color="#4CAF50" />
                                </StyledView>
                                <StyledView>
                                    <StyledText className="text-lg font-bold text-[#333]">Wallet Balance</StyledText>
                                    <StyledText className="text-sm text-[#666]">Available funds</StyledText>
                                </StyledView>
                            </StyledView>
                            <StyledView className="items-end">
                                {user?.accountType === 'dasher' ? (
                                    <StyledText className="text-2xl font-bold text-[#4CAF50]">
                                        ₱{user?.wallet ? user.wallet.toFixed(2) : '0.00'}
                                    </StyledText>
                                ) : user?.accountType === 'shop' && (
                                    user?.acceptGCASH ? (
                                        <StyledText className="text-2xl font-bold text-[#4CAF50]">
                                            ₱{user?.wallet ? user.wallet.toFixed(2) : '0.00'}
                                        </StyledText>
                                    ) : (
                                        <StyledText className="text-sm text-[#666] text-right">Edit shop to activate</StyledText>
                                    )
                                )}
                            </StyledView>
                        </StyledView>
                    </StyledView>
                )}

                {/* Quick Actions for Dashers */}
                {user?.accountType === 'DASHER' && (
                    <StyledView className="mx-6 mb-6">
                        <StyledText className="text-lg font-bold text-[#333] mb-4">Quick Actions</StyledText>
                        <StyledView className="space-y-3">
                            <StyledTouchableOpacity
                                className="bg-[#BC4A4D] p-4 rounded-2xl"
                                onPress={() => router.push('/dasher/application' as any)}
                            >
                                <StyledView className="flex-row items-center justify-center">
                                    <Ionicons name="document-text-outline" size={20} color="white" />
                                    <StyledText className="text-white text-base font-semibold ml-2">Dasher Application</StyledText>
                                </StyledView>
                            </StyledTouchableOpacity>
                            <StyledView className="flex-row space-x-3">
                                <StyledTouchableOpacity
                                    className="flex-1 bg-[#BC4A4D] p-4 rounded-2xl"
                                    onPress={() => router.push('/dasher/topup' as any)}
                                >
                                    <StyledView className="flex-row items-center justify-center">
                                        <Ionicons name="add-circle-outline" size={18} color="white" />
                                        <StyledText className="text-white text-sm font-semibold ml-1">Top Up</StyledText>
                                    </StyledView>
                                </StyledTouchableOpacity>
                                <StyledTouchableOpacity
                                    className="flex-1 bg-[#BC4A4D] p-4 rounded-2xl"
                                    onPress={() => router.push('/dasher/reimburse' as any)}
                                >
                                    <StyledView className="flex-row items-center justify-center">
                                        <Ionicons name="receipt-outline" size={18} color="white" />
                                        <StyledText className="text-white text-sm font-semibold ml-1">Reimburse</StyledText>
                                    </StyledView>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                )}

                {/* Menu Options */}
                <StyledView className="bg-white rounded-3xl mx-6 mb-6 shadow-sm overflow-hidden">
                    {user?.accountType === 'regular' ? (
                        <>
                            <StyledTouchableOpacity
                                className="flex-row items-center p-5 border-b border-[#f5f5f5]"
                                onPress={() => router.push('/dasher/application' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#fff3e0] justify-center items-center mr-4">
                                    <Ionicons name="bicycle-outline" size={20} color="#FF9800" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#333]">Become a Dasher</StyledText>
                                    <StyledText className="text-sm text-[#666]">Start earning by delivering orders</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>

                            <StyledTouchableOpacity
                                className="flex-row items-center p-5 border-b border-[#f5f5f5]"
                                onPress={() => router.push('/apply-shop' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#e8f5e8] justify-center items-center mr-4">
                                    <Ionicons name="storefront-outline" size={20} color="#4CAF50" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#333]">Add Your Shop</StyledText>
                                    <StyledText className="text-sm text-[#666]">Register your business</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>

                            <StyledTouchableOpacity
                                className="flex-row items-center p-5"
                                onPress={() => router.push('/history-order' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#f3e5f5] justify-center items-center mr-4">
                                    <Ionicons name="time-outline" size={20} color="#9C27B0" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#333]">Order History</StyledText>
                                    <StyledText className="text-sm text-[#666]">View your past orders</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
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
                                    <StyledText className="text-base font-semibold text-[#333]">Cash Out</StyledText>
                                    <StyledText className="text-sm text-[#666]">Withdraw your earnings</StyledText>
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
                                    <StyledText className="text-base font-semibold text-[#333]">Top Up Wallet</StyledText>
                                    <StyledText className="text-sm text-[#666]">Add funds to your wallet</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>

                            <StyledTouchableOpacity
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
                            </StyledTouchableOpacity>

                            <StyledTouchableOpacity
                                className="flex-row items-center p-5"
                                onPress={() => router.push('/dasher/update' as any)}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-[#f3e5f5] justify-center items-center mr-4">
                                    <Ionicons name="create-outline" size={20} color="#9C27B0" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-base font-semibold text-[#333]">Edit Dasher Profile</StyledText>
                                    <StyledText className="text-sm text-[#666]">Update your information</StyledText>
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
                                    <StyledText className="text-base font-semibold text-[#333]">Cash Out</StyledText>
                                    <StyledText className="text-sm text-[#666]">Withdraw your earnings</StyledText>
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
                                    <StyledText className="text-base font-semibold text-[#333]">Edit Shop</StyledText>
                                    <StyledText className="text-sm text-[#666]">Update shop information</StyledText>
                                </StyledView>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </StyledTouchableOpacity>
                        </>
                    ) : null}
                </StyledView>

                {/* Logout Section */}
                <StyledView className="mx-6 mb-8">
                    <StyledTouchableOpacity
                        className="bg-white rounded-3xl p-5 shadow-sm border border-red-100"
                        onPress={handleLogout}
                    >
                        <StyledView className="flex-row items-center justify-center">
                            <Ionicons name="log-out-outline" size={20} color="#BC4A4D" />
                            <StyledText className="text-base font-semibold text-[#BC4A4D] ml-2">Log Out</StyledText>
                        </StyledView>
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledScrollView>

            <BottomNavigation activeTab="Profile" />
        </StyledSafeAreaView>
    )
}

export default Profile;