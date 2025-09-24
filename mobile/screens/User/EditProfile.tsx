import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, TextInput, ActivityIndicator, Alert, Animated, Image } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState, useRef } from "react"
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
const StyledImage = styled(Image)

interface User {
    id: string;
    firstname: string;
    middlename?: string;
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
    const [middlename, setMiddlename] = useState('');
    const [lastname, setLastname] = useState('');
    const [phone, setPhone] = useState('');
    const [courseYear, setCourseYear] = useState('');
    const [schoolIdNum, setSchoolIdNum] = useState('');
    const [username, setUsername] = useState('');
    
    // Get authentication methods from the auth service
    const { getAccessToken } = useAuthentication();

    // Animation values for loading state
    const spinValue = useRef(new Animated.Value(0)).current;
    const circleValue = useRef(new Animated.Value(0)).current;

    // Start animations when loading begins
    useEffect(() => {
        if (isLoading) {
            // Spinning logo animation
            const spinAnimation = Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                })
            );

            // Circle loading animation
            const circleAnimation = Animated.loop(
                Animated.timing(circleValue, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                })
            );

            spinAnimation.start();
            circleAnimation.start();

            return () => {
                spinAnimation.stop();
                circleAnimation.stop();
            };
        }
    }, [isLoading, spinValue, circleValue]);

    // Function to parse name from existing data
    const parseName = (fullName: string) => {
        const nameParts = fullName.trim().split(' ');
        if (nameParts.length === 1) {
            return { first: nameParts[0], middle: '', last: '' };
        } else if (nameParts.length === 2) {
            return { first: nameParts[0], middle: '', last: nameParts[1] };
        } else if (nameParts.length === 3) {
            return { first: nameParts[0], middle: nameParts[1], last: nameParts[2] };
        } else {
            // For 4+ parts, first is first name, last is last name, everything in between is middle name
            return { 
                first: nameParts[0], 
                middle: nameParts.slice(1, -1).join(' '), 
                last: nameParts[nameParts.length - 1] 
            };
        }
    };

    // Validation functions
    const validatePhoneNumber = (phone: string): boolean => {
        // Philippine phone number format: 09XX-XXX-XXXX
        const phoneRegex = /^09\d{2}-\d{3}-\d{4}$/;
        return phoneRegex.test(phone);
    };

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validateSchoolId = (schoolId: string): boolean => {
        // Format: XX-XXXX-XXX (e.g., 12-3456-789)
        const schoolIdRegex = /^\d{2}-\d{4}-\d{3}$/;
        return schoolIdRegex.test(schoolId);
    };

    const formatPhoneNumber = (text: string): string => {
        // Remove all non-digits
        const digits = text.replace(/\D/g, '');
        
        // Format as 09XX-XXX-XXXX
        if (digits.length <= 4) {
            return digits;
        } else if (digits.length <= 7) {
            return `${digits.slice(0, 4)}-${digits.slice(4)}`;
        } else if (digits.length <= 11) {
            return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
        } else {
            // Limit to 11 digits
            return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
        }
    };

    const formatSchoolId = (text: string): string => {
        // Remove all non-digits
        const digits = text.replace(/\D/g, '');
        
        // Format as XX-XXXX-XXX
        if (digits.length <= 2) {
            return digits;
        } else if (digits.length <= 6) {
            return `${digits.slice(0, 2)}-${digits.slice(2)}`;
        } else if (digits.length <= 9) {
            return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
        } else {
            // Limit to 9 digits
            return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 9)}`;
        }
    };

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
            
            // Parse existing name data
            const parsedFirst = parseName(userData.firstname || '');
            const parsedLast = parseName(userData.lastname || '');
            
            // Set form fields
            setFirstname(parsedFirst.first);
            setMiddlename(parsedFirst.middle || parsedLast.middle || userData.middlename || '');
            setLastname(parsedLast.last || parsedFirst.last);
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
                    [{ text: "OK", style: "default", onPress: () => router.replace('/') }],
                    { cancelable: true }
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;

        // Basic validation
        if (!firstname.trim() || !lastname.trim() || !username.trim() || !user.email?.trim()) {
            Alert.alert(
                "Validation Error", 
                "Please fill in all required fields (First Name, Last Name, Username, Email)",
                [{ text: "OK", style: "default" }],
                { cancelable: true }
            );
            return;
        }

        // Phone number validation
        if (phone.trim() && !validatePhoneNumber(phone.trim())) {
            Alert.alert(
                "Invalid Phone Number",
                "Please enter a valid Philippine phone number (e.g., 0912-345-6789)",
                [{ text: "OK", style: "default" }],
                { cancelable: true }
            );
            return;
        }

        // Email validation
        if (user.email && !validateEmail(user.email)) {
            Alert.alert(
                "Invalid Email",
                "Please enter a valid email address",
                [{ text: "OK", style: "default" }],
                { cancelable: true }
            );
            return;
        }

        // School ID validation
        if (schoolIdNum.trim() && !validateSchoolId(schoolIdNum.trim())) {
            Alert.alert(
                "Invalid School ID",
                "Please enter a valid school ID in the format XX-XXXX-XXX (e.g., 12-3456-789)",
                [{ text: "OK", style: "default" }],
                { cancelable: true }
            );
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
                middlename: middlename.trim(),
                lastname: lastname.trim(),
                email: user.email?.trim(),
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
                    [{ text: "OK", style: "default", onPress: () => router.back() }],
                    { cancelable: true }
                );
            }
        } catch (error: any) {
            console.error("Error updating profile:", error);
            Alert.alert(
                "Error",
                error?.response?.data?.message || "Failed to update profile",
                [{ text: "OK", style: "default" }],
                { cancelable: true }
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
        required: boolean = false,
        formatFunction?: (text: string) => string
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
                onChangeText={(text) => {
                    const formattedText = formatFunction ? formatFunction(text) : text;
                    onChangeText(formattedText);
                }}
                placeholder={placeholder}
                placeholderTextColor="#999"
                keyboardType={keyboardType}
                style={{ fontSize: 16 }}
            />
        </StyledView>
    );

    if (isLoading) {
        const spin = spinValue.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
        });

        const circleRotation = circleValue.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
        });

        return (
            <StyledSafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
                <StyledView className="flex-1 justify-center items-center px-6">
                    <StyledView className="items-center">
                        {/* Spinning Logo Container */}
                        <StyledView className="relative mb-6">
                            {/* Outer rotating circle */}
                            <Animated.View
                                style={{
                                    transform: [{ rotate: circleRotation }],
                                }}
                                className="absolute w-20 h-20 border-2 border-[#BC4A4D]/20 border-t-[#BC4A4D] rounded-full"
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
                        <StyledText className="text-[#BC4A4D] text-base font-semibold">Loading...</StyledText>
                    </StyledView>
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
                            "Middle Name",
                            middlename,
                            setMiddlename,
                            "Enter your middle name (optional)",
                            "person-outline",
                            "default",
                            false
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
                            "Email Address",
                            user?.email || '',
                            (text) => {
                                if (user) {
                                    setUser({ ...user, email: text });
                                }
                            },
                            "Enter your email address",
                            "mail-outline",
                            "email-address",
                            true
                        )}

                        {renderFormField(
                            "Phone Number",
                            phone,
                            setPhone,
                            "0912-345-6789",
                            "call-outline",
                            "phone-pad",
                            false,
                            formatPhoneNumber
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
                            "12-3456-789",
                            "card-outline",
                            "numeric",
                            false,
                            formatSchoolId
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