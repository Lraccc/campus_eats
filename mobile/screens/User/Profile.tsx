import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert } from "react-native"
import { Ionicons, Feather, AntDesign } from "@expo/vector-icons"
import BottomNavigation from "../../components/BottomNavigation"
import { useEffect, useState } from "react"
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { clearStoredAuthState, useAuthentication, getAuthToken, AUTH_TOKEN_KEY } from "../../services/authService"
import axios from "axios"
import { API_URL } from "../../config"
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
    
    // Get authentication methods from the auth service
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

    const renderDasherButtons = () => {
        if (user?.accountType !== 'DASHER') return null;

        return (
            <View style={styles.dasherSection}>
                <Text style={styles.sectionTitle}>Dasher Options</Text>
                <TouchableOpacity 
                    style={styles.dasherButton}
                    onPress={() => router.push('/dasher/application' as any)}
                >
                    <Text style={styles.dasherButtonText}>Dasher Application</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.dasherButton}
                    onPress={() => router.push('/dasher/topup' as any)}
                >
                    <Text style={styles.dasherButtonText}>Top Up Wallet</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.dasherButton}
                    onPress={() => router.push('/dasher/reimburse' as any)}
                >
                    <Text style={styles.dasherButtonText}>Request Reimbursement</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // Profile options are set via the unstable_settings export at the top

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                {/* Header with title */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>My Profile</Text>
                </View>

                {/* Show loading indicator if data is loading */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#BC4A4D" />
                        <Text style={styles.loadingText}>Loading profile...</Text>
                    </View>
                )}

                {/* Show error message if there was an error */}
                {error && !isLoading && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity 
                            style={styles.retryButton} 
                            onPress={() => fetchUserData(true)}
                        >
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Profile Info */}
                <View style={styles.profileCard}>
                    <View style={styles.profileInfo}>
                        <View>
                            <Text style={styles.profileName}>
                                {user ? `${user.firstname} ${user.lastname}` : 'Loading...'}
                            </Text>
                            <Text style={styles.profileUsername}>{user?.username || 'Loading...'}</Text>
                            <Text style={styles.profileDetails}>
                                {user?.courseYear ? `Year ${user.courseYear}` : ''}
                            </Text>
                            <Text style={styles.profileDetails}>
                                {user?.schoolIdNum ? `ID: ${user.schoolIdNum}` : ''}
                            </Text>
                            <Text style={styles.profileDetails}>
                                {user?.accountType ? `Account Type: ${user.accountType}` : ''}
                            </Text>
                            <TouchableOpacity onPress={() => router.push('/(tabs)/edit-profile' as any)}>
                                <Text style={styles.viewProfile}>Edit Profile {">"}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatar}>
                                <Ionicons name="person-outline" size={24} color="#999" />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Wallet Card */}
                {(user?.accountType === 'dasher' || user?.accountType === 'shop') && (
                    <View style={styles.walletCard}>
                        <View style={styles.walletContent}>
                            <Text style={styles.walletTitle}>Wallet</Text>
                            {user?.accountType === 'dasher' ? (
                                <Text style={styles.walletAmount}>
                                    ₱{user?.wallet ? user.wallet.toFixed(2) : '0.00'}
                                </Text>
                            ) : user?.accountType === 'shop' && (
                                user?.acceptGCASH ? (
                                    <Text style={styles.walletAmount}>
                                        ₱{user?.wallet ? user.wallet.toFixed(2) : '0.00'}
                                    </Text>
                                ) : (
                                    <Text style={styles.walletAmount}>Edit shop to activate</Text>
                                )
                            )}
                        </View>
                    </View>
                )}

                {renderDasherButtons()}

                {/* Menu List */}
                <View style={styles.menuList}>
                    {user?.accountType === 'regular' ? (
                        <>
                            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/dasher/application' as any)}>
                                <View style={styles.menuItemLeft}>
                                    <Ionicons name="bicycle-outline" size={20} color="#666" />
                                    <Text style={styles.menuItemText}>Be a Dasher</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/apply-shop' as any)}>
                                <View style={styles.menuItemLeft}>
                                    <Ionicons name="storefront-outline" size={20} color="#666" />
                                    <Text style={styles.menuItemText}>Add a Shop</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                            </TouchableOpacity>
                        </>
                    ) : user?.accountType === 'dasher' ? (
                        <>
                            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/dasher/cashout' as any)}>
                                <View style={styles.menuItemLeft}>
                                    <Ionicons name="cash-outline" size={20} color="#666" />
                                    <Text style={styles.menuItemText}>Cash Out</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/dasher/topup' as any)}>
                                <View style={styles.menuItemLeft}>
                                    <Ionicons name="wallet-outline" size={20} color="#666" />
                                    <Text style={styles.menuItemText}>Top Up</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/dasher/reimburse' as any)}>
                                <View style={styles.menuItemLeft}>
                                    <Ionicons name="receipt-outline" size={20} color="#666" />
                                    <Text style={styles.menuItemText}>Reimbursement</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/dasher/update' as any)}>
                                <View style={styles.menuItemLeft}>
                                    <Ionicons name="create-outline" size={20} color="#666" />
                                    <Text style={styles.menuItemText}>Edit Dasher Profile</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                            </TouchableOpacity>
                        </>
                    ) : user?.accountType === 'shop' ? (
                        <>
                            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/shop/cashout' as any)}>
                                <View style={styles.menuItemLeft}>
                                    <Ionicons name="cash-outline" size={20} color="#666" />
                                    <Text style={styles.menuItemText}>Cash Out</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/shop/update' as any)}>
                                <View style={styles.menuItemLeft}>
                                    <Ionicons name="create-outline" size={20} color="#666" />
                                    <Text style={styles.menuItemText}>Edit Shop</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#666" />
                            </TouchableOpacity>
                        </>
                    ) : null}

                    {/* Logout button for all account types */}
                    <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
                        <View style={styles.menuItemLeft}>
                            <Ionicons name="log-out-outline" size={20} color="#BC4A4D" />
                            <Text style={[styles.menuItemText, styles.logoutText]}>Log out</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#BC4A4D" />
                    </TouchableOpacity>
                </View>


            </ScrollView>

            {/* Bottom Navigation */}
            <BottomNavigation activeTab="Profile" />
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    headerTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
        textAlign: "center",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: "#666",
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: "#ff3b30",
        textAlign: "center",
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: "#BC4A4D",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    retryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    container: {
        flex: 1,
        backgroundColor: "#fae9e0",
    },
    header: {
        padding: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: "center",
    },
    profileCard: {
        backgroundColor: "#fff",
        borderRadius: 12,
        marginHorizontal: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    profileInfo: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    profileName: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
    },
    profileUsername: {
        fontSize: 14,
        color: "#666",
        marginTop: 4,
    },
    viewProfile: {
        fontSize: 12,
        color: "#BC4A4D",
        marginTop: 8,
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "#f0f0f0",
        justifyContent: "center",
        alignItems: "center",
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "#f0f0f0",
        justifyContent: "center",
        alignItems: "center",
    },
    menuIcons: {
        flexDirection: "row",
        justifyContent: "space-between",
        backgroundColor: "#fff",
        borderRadius: 12,
        marginHorizontal: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    menuIconItem: {
        alignItems: "center",
        width: "22%",
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#f0f0f0",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
    },
    iconText: {
        fontSize: 12,
        color: "#666",
    },
    menuList: {
        backgroundColor: "#fff",
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    menuItemLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    menuItemText: {
        marginLeft: 12,
        fontSize: 14,
        color: "#333",
    },
    profileDetails: {
        fontSize: 12,
        color: "#666",
        marginTop: 4,
    },
    walletCard: {
        backgroundColor: "#fff",
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    walletContent: {
        alignItems: 'center',
    },
    walletTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 8,
    },
    walletAmount: {
        fontSize: 18,
        color: "#666",
    },
    logoutItem: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    logoutText: {
        color: '#BC4A4D',
    },
    scrollView: {
        flex: 1,
        backgroundColor: "#fae9e0",
    },
    dasherSection: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    dasherButton: {
        backgroundColor: '#BC4A4D',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        alignItems: 'center',
    },
    dasherButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
})

export default Profile
