// Profile.tsx

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

    const { getAccessToken, signOut, isLoggedIn, authState } = useAuthentication();

    useEffect(() => {
        const checkUserChange = async () => {
            setUser(null);
            setInitialData(null);
            
            const oauthUserData = await AsyncStorage.getItem('@CampusEats:UserData');
            let storedUserId = await AsyncStorage.getItem('userId');
            
            if (oauthUserData && (!storedUserId || storedUserId === 'null')) {
                try {
                    const userData = JSON.parse(oauthUserData);
                    if (userData?.id) {
                        storedUserId = userData.id;
                        await AsyncStorage.setItem('userId', storedUserId);
                    }
                } catch (err) {
                    console.error("Error parsing OAuth user data:", err);
                }
            }

            if (storedUserId !== currentUserId || (isLoggedIn && !user)) {
                setCurrentUserId(storedUserId);
                fetchUserData(true);
            }
        };

        checkUserChange();
    }, [isLoggedIn, authState]);

    const fetchUserData = async (forceRefresh = false) => {
        setIsLoading(true);
        setError(null);

        try {
            let token = await getAccessToken();
            if (!token) {
                token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            }

            if (!token) {
                setError("Authentication token missing. Please log in again.");
                setIsLoading(false);
                return;
            }

            let userId = await AsyncStorage.getItem('userId');
            if (forceRefresh && userId) {
                await AsyncStorage.removeItem('userId');
                userId = null;
            }

            if (!userId || userId === 'null') {
                const oauthUserData = await AsyncStorage.getItem('@CampusEats:UserData');
                if (oauthUserData) {
                    try {
                        const userData = JSON.parse(oauthUserData);
                        if (userData?.id) {
                            userId = userData.id;
                            await AsyncStorage.setItem('userId', userId);
                        }
                    } catch (error) {
                        console.error("Error parsing OAuth user data:", error);
                    }
                }
            }

            if (!userId || userId === 'null') {
                try {
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1]));
                        userId = payload.sub || payload.oid || payload.userId || payload.id;
                        if (userId) {
                            await AsyncStorage.setItem('userId', userId);
                        }
                    }
                } catch (error) {
                    console.error("Failed to extract userId from token:", error);
                }
            }

            if (!userId || userId === 'null') {
                try {
                    const meResponse = await axios.get(`${API_URL}/api/users/me`, {
                        headers: { Authorization: token }
                    });

                    if (meResponse.data?.id) {
                        userId = meResponse.data.id;
                        await AsyncStorage.setItem('userId', userId);
                    }
                } catch (error) {
                    console.error("Failed to get user from /me endpoint:", error);
                }
            }

            if (!userId || userId === 'null') {
                throw new Error("Unable to determine user ID from any source");
            }

            const cacheParam = `_nocache=${new Date().getTime()}`;
            const response = await axios.get(`${API_URL}/api/users/${userId}?${cacheParam}`, {
                headers: {
                    Authorization: token,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            const userData = response.data;
            setCurrentUserId(userData.id);
            await AsyncStorage.setItem('userId', userData.id);
            setUser(userData);
            setInitialData(userData);
        } catch (error: any) {
            console.error("ERROR_FETCHING_USER:", error);
            setError(error?.response?.data?.message || error?.message || "Failed to load user profile");

            if (error?.response?.status === 401 || error?.response?.status === 403) {
                Alert.alert(
                    "Authentication Error",
                    "Your session has expired. Please log in again.",
                    [{ text: "OK", onPress: () => handleLogout() }]
                );
            } else if (error.message === "Unable to determine user ID from any source") {
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
            setUser(null);
            setInitialData(null);
            setCurrentUserId(null);
            await AsyncStorage.removeItem('userId');
            if (signOut) await signOut();
            await clearStoredAuthState();
            await AsyncStorage.clear();
            router.replace('/');
            setTimeout(() => router.replace('/'), 500);
        } catch (error) {
            console.error("Error during sign-out:", error);
            router.replace('/');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Profile</Text>
            </View>

            {isLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#BC4A4D" />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            )}

            {error && !isLoading && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => fetchUserData(true)}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* You can render user info here if desired */}

            <BottomNavigation />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: { padding: 16, borderBottomWidth: 1, borderColor: "#ccc" },
    headerTitle: { fontSize: 20, fontWeight: "bold" },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: { marginTop: 10, fontSize: 16 },
    errorContainer: { padding: 20, alignItems: "center" },
    errorText: { color: "red", marginBottom: 10, fontSize: 16 },
    retryButton: { backgroundColor: "#BC4A4D", padding: 10, borderRadius: 5 },
    retryButtonText: { color: "#fff", fontWeight: "bold" },
});

export default Profile;
