import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, ActivityIndicator, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useAuthentication, getAuthToken } from "../../services/authService"
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

const EditProfile = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    // Form fields
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [phone, setPhone] = useState('');
    const [courseYear, setCourseYear] = useState('');
    const [schoolIdNum, setSchoolIdNum] = useState('');
    const [username, setUsername] = useState('');
    
    // Get authentication methods from the auth service
    const { getAccessToken } = useAuthentication();

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            // Try to get OAuth token first
            let token = await getAccessToken();
            
            // If no OAuth token, try traditional token
            if (!token) {
                token = await getAuthToken();
                console.log("Using traditional auth token for edit profile");
            }
            
            if (!token) {
                throw new Error("Authentication required");
            }

            const userId = await AsyncStorage.getItem('userId');
            console.log("Fetching user data for ID:", userId);
            
            if (!userId) {
                throw new Error("User ID not found");
            }
            
            const response = await axios.get(`${API_URL}/api/users/${userId}`, {
                headers: { 
                    Authorization: token,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            const userData = response.data;
            console.log("Edit profile user data:", userData);
            setUser(userData);
            
            // Set form fields
            setFirstname(userData.firstname);
            setLastname(userData.lastname);
            setPhone(userData.phone || '');
            setCourseYear(userData.courseYear || '');
            setSchoolIdNum(userData.schoolIdNum || '');
            setUsername(userData.username);
            
        } catch (error: any) {
            console.error("Error fetching user data:", error);
            setError(error?.response?.data?.message || error?.message || "Failed to load user profile");
            
            // If authentication error, redirect to login
            if (error.message === "Authentication required") {
                Alert.alert(
                    "Session Expired",
                    "Please log in again to continue.",
                    [{ text: "OK", onPress: () => router.replace('/') }]
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        
        try {
            // Try to get OAuth token first
            let token = await getAccessToken();
            
            // If no OAuth token, try traditional token
            if (!token) {
                token = await getAuthToken();
            }
            
            if (!token) {
                throw new Error("Authentication required");
            }
            
            const response = await axios.put(`${API_URL}/api/users/update/${user.id}`, {
                firstname,
                lastname,
                phone,
                courseYear,
                schoolIdNum,
                username
            }, {
                headers: { 
                    Authorization: token,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (response.status === 200) {
                Alert.alert(
                    "Success",
                    "Profile updated successfully",
                    [{ text: "OK", onPress: () => router.back() }]
                );
            }
        } catch (error: any) {
            console.error("Error updating profile:", error);
            Alert.alert(
                "Error",
                error?.response?.data?.message || "Failed to update profile"
            );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#BC4A4D" />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity 
                        style={styles.retryButton} 
                        onPress={fetchUserData}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>First Name</Text>
                        <TextInput
                            style={styles.input}
                            value={firstname}
                            onChangeText={setFirstname}
                            placeholder="Enter first name"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Last Name</Text>
                        <TextInput
                            style={styles.input}
                            value={lastname}
                            onChangeText={setLastname}
                            placeholder="Enter last name"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="Enter username"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="Enter phone number"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Course & Year</Text>
                        <TextInput
                            style={styles.input}
                            value={courseYear}
                            onChangeText={setCourseYear}
                            placeholder="e.g. BSIT-2"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>School ID</Text>
                        <TextInput
                            style={styles.input}
                            value={schoolIdNum}
                            onChangeText={setSchoolIdNum}
                            placeholder="Enter school ID"
                        />
                    </View>

                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#DFD6C5",
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: "#FFFAF1",
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
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
    formContainer: {
        flex: 1,
        padding: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: "#666",
        marginBottom: 8,
    },
    input: {
        backgroundColor: "#FFFAF1",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    saveButton: {
        backgroundColor: "#BC4A4D",
        padding: 16,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 24,
        marginBottom: 32,
    },
    saveButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
});

export default EditProfile; 