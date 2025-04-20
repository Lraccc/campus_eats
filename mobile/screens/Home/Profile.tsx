import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from "react-native"
import { Ionicons, Feather, AntDesign } from "@expo/vector-icons"
import BottomNavigation from "../../components/BottomNavigation"
import { useEffect, useState } from "react"
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"

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

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const userId = await AsyncStorage.getItem('userId');
            
            if (!token || !userId) {
                console.error('No token or userId found');
                return;
            }

            const response = await fetch(`http://192.168.1.20:8080/api/users/${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            
            if (response.ok) {
                const userData = await response.json();
                console.log('User data:', userData);
                setUser(userData);
                setInitialData(userData);
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch user data:', errorData);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    };

    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('userId');
            router.replace('/');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header with back button */}
            <View style={styles.header}>

            </View>

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
                        <Feather name="list" size={20} color="#666" />
                        <Text style={styles.menuItemText}>Your order</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuItemLeft}>
                        <Feather name="calendar" size={20} color="#666" />
                        <Text style={styles.menuItemText}>Your booking</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
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
