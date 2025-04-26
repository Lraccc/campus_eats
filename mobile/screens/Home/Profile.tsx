import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert } from "react-native"
import { Ionicons, Feather, AntDesign } from "@expo/vector-icons"
import BottomNavigation from "../../components/BottomNavigation"
import { useEffect, useState } from "react"
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { clearStoredAuthState, useAuthentication, getAuthToken, AUTH_TOKEN_KEY } from "../../services/authService"
import axios from "axios"
import { API_URL } from "../../config"

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
}

const Profile = () => {
    const [user, setUser] = useState<User | null>(null);
    const [initialData, setInitialData] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    
    // Get authentication methods from the auth service
    const { getAccessToken, signOut, isLoggedIn, authState } = useAuthentication();

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
            
            const userData = response.data;
            console.log("User data fetched successfully:", userData);
            console.log("User ID from API:", userData.id);
            
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

    return (
        <SafeAreaView style={styles.container}>
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
                        <TouchableOpacity>
                            <Text style={styles.viewProfile}>View profile {">"}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            <Ionicons name="person-outline" size={24} color="#999" />
                        </View>
                    </View>
                </View>
            </View>

            {/* Menu Icons */}
            <View style={styles.menuIcons}>
                <View style={styles.menuIconItem}>
                    <View style={styles.iconCircle}>
                        <AntDesign name="heart" size={20} color="#666" />
                    </View>
                    <Text style={styles.iconText}>Likes</Text>
                </View>
                <View style={styles.menuIconItem}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="notifications-outline" size={20} color="#666" />
                    </View>
                    <Text style={styles.iconText}>Notifications</Text>
                </View>
                <View style={styles.menuIconItem}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="settings-outline" size={20} color="#666" />
                    </View>
                    <Text style={styles.iconText}>Settings</Text>
                </View>
                <View style={styles.menuIconItem}>
                    <View style={styles.iconCircle}>
                        <AntDesign name="creditcard" size={20} color="#666" />
                    </View>
                    <Text style={styles.iconText}>Payment</Text>
                </View>
            </View>

            {/* Menu List */}
            <ScrollView style={styles.menuList}>
                <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuItemLeft}>
                        <Feather name="calendar" size={20} color="#666" />
                        <Text style={styles.menuItemText}>Your Cart</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/order' as any)}>
                    <View style={styles.menuItemLeft}>
                        <Feather name="list" size={20} color="#666" />
                        <Text style={styles.menuItemText}>Your order</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/order' as any)}>
                    <View style={styles.menuItemLeft}>
                        <Feather name="clock" size={20} color="#666" />
                        <Text style={styles.menuItemText}>Your order history</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                    <View style={styles.menuItemLeft}>
                        <Feather name="log-out" size={20} color="#666" />
                        <Text style={styles.menuItemText}>Log out</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
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
        backgroundColor: "#DFD6C5",
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
        backgroundColor: "#FFFAF1",
        borderRadius: 8,
        marginHorizontal: 16,
        padding: 16,
        marginBottom: 16,
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
        backgroundColor: "#FFFAF1",
        borderRadius: 8,
        marginHorizontal: 16,
        padding: 16,
        marginBottom: 16,
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
        backgroundColor: "#FFFAF1",
        borderRadius: 8,
        marginHorizontal: 16,
        marginBottom: 80, // Space for bottom nav
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    menuItemLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    menuItemText: {
        marginLeft: 16,
        fontSize: 14,
        color: "#333",
    },
    profileDetails: {
        fontSize: 12,
        color: "#666",
        marginTop: 4,
    },
})

export default Profile
