import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, TextInput, ActivityIndicator, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { router } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useAuthentication, getAuthToken } from "../../services/authService"
import axios from "axios"
import { API_URL } from "../../config"
import { styled } from "nativewind"

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)
const StyledSafeAreaView = styled(SafeAreaView)
const StyledTextInput = styled(TextInput)

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
    const [isSaving, setIsSaving] = useState<boolean>(false);
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

        // Basic validation
        if (!firstname.trim() || !lastname.trim() || !username.trim()) {
            Alert.alert("Validation Error", "Please fill in all required fields (First Name, Last Name, Username)");
            return;
        }

        setIsSaving(true);
        
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
                firstname: firstname.trim(),
                lastname: lastname.trim(),
                phone: phone.trim(),
                courseYear: courseYear.trim(),
                schoolIdNum: schoolIdNum.trim(),
                username: username.trim()
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
        } finally {
            setIsSaving(false);
        }
    };

    const renderFormField = (
        label: string,
        value: string,
        onChangeText: (text: string) => void,
        placeholder: string,
        icon: string,
        keyboardType: any = "default",
        required: boolean = false
    ) => (
        <StyledView className="mb-6">
            <StyledView className="flex-row items-center mb-3">
                <Ionicons name={icon as any} size={18} color="#666" />
                <StyledText className="text-base font-semibold text-[#333] ml-2">
                    {label}
                    {required && <StyledText className="text-[#BC4A4D]"> *</StyledText>}
                </StyledText>
            </StyledView>
            <StyledTextInput
                className="bg-white rounded-2xl px-4 py-4 text-base border border-[#e5e5e5] focus:border-[#BC4A4D]"
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#999"
                keyboardType={keyboardType}
                style={{ fontSize: 16 }}
            />
        </StyledView>
    );

    if (isLoading) {
        return (
            <StyledSafeAreaView className="flex-1 bg-[#fae9e0]">
                <StyledView className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#BC4A4D" />
                    <StyledText className="mt-4 text-base text-[#666]">Loading profile...</StyledText>
                </StyledView>
            </StyledSafeAreaView>
        );
    }

    return (
        <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
            {/* Header */}
            <StyledView className="bg-white px-6 py-4 border-b border-[#f0f0f0]">
                <StyledView className="flex-row items-center justify-between">
                    <StyledView className="flex-row items-center">
                        <StyledTouchableOpacity
                            onPress={() => router.back()}
                            className="mr-4 p-2 -ml-2"
                        >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                        </StyledTouchableOpacity>
                        <StyledText className="text-xl font-bold text-[#333]">Edit Profile</StyledText>
                    </StyledView>
                    <StyledView className="w-10 h-10 rounded-full bg-[#f8f8f8] justify-center items-center">
                        <Ionicons name="create-outline" size={20} color="#BC4A4D" />
                    </StyledView>
                </StyledView>
            </StyledView>

            {error ? (
                <StyledView className="flex-1 justify-center items-center px-6">
                    <StyledView className="bg-red-50 rounded-3xl p-6 border border-red-100 w-full max-w-sm">
                        <StyledView className="items-center mb-4">
                            <Ionicons name="alert-circle-outline" size={48} color="#ff3b30" />
                        </StyledView>
                        <StyledText className="text-base text-[#ff3b30] text-center mb-6">{error}</StyledText>
                        <StyledTouchableOpacity
                            className="bg-[#BC4A4D] py-3 px-6 rounded-2xl"
                        onPress={fetchUserData}
                    >
                            <StyledText className="text-white text-base font-semibold text-center">Try Again</StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            ) : (
                <StyledScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    {/* Profile Header */}
                    <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                        <StyledView className="items-center">
                            <StyledView className="w-20 h-20 rounded-full bg-[#f8f8f8] justify-center items-center mb-4 border-2 border-[#f0f0f0]">
                                <Ionicons name="person-outline" size={32} color="#BC4A4D" />
                            </StyledView>
                            <StyledText className="text-lg font-bold text-[#333] text-center">
                                Update Your Information
                            </StyledText>
                            <StyledText className="text-sm text-[#666] text-center mt-1">
                                Keep your profile up to date
                            </StyledText>
                        </StyledView>
                    </StyledView>

                    {/* Form Fields */}
                    <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                        <StyledText className="text-lg font-bold text-[#333] mb-6">Personal Information</StyledText>

                        {renderFormField(
                            "First Name",
                            firstname,
                            setFirstname,
                            "Enter your first name",
                            "person-outline",
                            "default",
                            true
                        )}

                        {renderFormField(
                            "Last Name",
                            lastname,
                            setLastname,
                            "Enter your last name",
                            "person-outline",
                            "default",
                            true
                        )}

                        {renderFormField(
                            "Username",
                            username,
                            setUsername,
                            "Choose a unique username",
                            "at-outline",
                            "default",
                            true
                        )}

                        {renderFormField(
                            "Phone Number",
                            phone,
                            setPhone,
                            "Enter your phone number",
                            "call-outline",
                            "phone-pad"
                        )}
                    </StyledView>

                    {/* Academic Information */}
                    <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                        <StyledText className="text-lg font-bold text-[#333] mb-6">Academic Information</StyledText>

                        {renderFormField(
                            "Course & Year",
                            courseYear,
                            setCourseYear,
                            "e.g. BSIT-2, BSCS-3",
                            "school-outline"
                        )}

                        {renderFormField(
                            "School ID Number",
                            schoolIdNum,
                            setSchoolIdNum,
                            "Enter your student ID",
                            "card-outline"
                        )}
                    </StyledView>

                    {/* Save Button */}
                    <StyledView className="mx-6 mt-8">
                        <StyledTouchableOpacity
                            className={`${isSaving ? 'bg-[#BC4A4D]/50' : 'bg-[#BC4A4D]'} p-5 rounded-3xl shadow-sm`}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            <StyledView className="flex-row items-center justify-center">
                                {isSaving ? (
                                    <>
                                        <ActivityIndicator size="small" color="white" />
                                        <StyledText className="text-white text-base font-bold ml-2">Saving...</StyledText>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                                        <StyledText className="text-white text-base font-bold ml-2">Save Changes</StyledText>
                                    </>
                                )}
                            </StyledView>
                        </StyledTouchableOpacity>
                    </StyledView>

                    {/* Help Text */}
                    <StyledView className="mx-6 mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <StyledView className="flex-row items-start">
                            <Ionicons name="information-circle-outline" size={20} color="#2196F3" />
                            <StyledView className="flex-1 ml-3">
                                <StyledText className="text-sm text-blue-700 font-semibold mb-1">
                                    Profile Tips
                                </StyledText>
                                <StyledText className="text-sm text-blue-600 leading-5">
                                    • Use your real name for verification purposes{'\n'}
                                    • Keep your phone number updated for delivery notifications{'\n'}
                                    • Your username should be unique and easy to remember
                                </StyledText>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </StyledScrollView>
            )}
        </StyledSafeAreaView>
    );
};

export default EditProfile; 