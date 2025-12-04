import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Image,
    Alert,
    ActivityIndicator,
    Platform,
    Linking,
    Modal,
    Animated,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthentication } from '../../services/authService';
import BottomNavigation from '@/components/BottomNavigation';
import { styled } from "nativewind";

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)
const StyledTextInput = styled(TextInput)

// Generate hours for 12-hour format
const HOURS_12 = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

interface Category {
    [key: string]: boolean;
}

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    buttons?: {
        text: string;
        onPress: () => void;
        style?: 'default' | 'cancel';
    }[];
    onClose: () => void;
}

const CustomAlert: React.FC<CustomAlertProps> = ({ visible, title, message, buttons = [], onClose }) => {
    if (!buttons.length) {
        buttons = [{ text: 'OK', onPress: onClose }];
    }

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <StyledView className="flex-1 justify-center items-center bg-black/50 px-6">
                <StyledView className="w-full max-w-sm bg-[#DFD6C5] rounded-3xl shadow-2xl">
                    {/* Header */}
                    <StyledView className="p-6 pb-4">
                        <StyledView className="items-center mb-4">
                            <StyledView className="w-16 h-16 bg-[#BC4A4D]/10 rounded-full items-center justify-center mb-3">
                                <Ionicons name="information-circle" size={32} color="#BC4A4D" />
                            </StyledView>
                            <StyledText className="text-xl font-bold text-[#8B4513] text-center">{title}</StyledText>
                        </StyledView>
                        <StyledText className="text-base text-[#8B4513] text-center leading-6">{message}</StyledText>
                    </StyledView>

                    {/* Buttons */}
                    <StyledView className="p-6 pt-2">
                        <StyledView className={`${buttons.length > 1 ? 'flex-row space-x-3' : ''}`}>
                            {buttons.map((button, index) => (
                                <StyledTouchableOpacity
                                    key={index}
                                    className={`py-4 px-6 rounded-2xl ${buttons.length > 1 ? 'flex-1' : 'w-full'} ${
                                        button.style === 'cancel' 
                                            ? 'bg-white border-2 border-[#8B4513]/20' 
                                            : 'bg-[#BC4A4D] shadow-sm'
                                    }`}
                                    onPress={button.onPress}
                                >
                                    <StyledText className={`text-center font-bold text-base ${
                                        button.style === 'cancel' ? 'text-[#8B4513]' : 'text-white'
                                    }`}>
                                        {button.text}
                                    </StyledText>
                                </StyledTouchableOpacity>
                            ))}
                        </StyledView>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
};

const ShopApplication = () => {
    const { getAccessToken, signOut } = useAuthentication();
    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState<string | null>(null);
    const [shopName, setShopName] = useState('');
    const [shopDesc, setShopDesc] = useState('');
    const [shopAddress, setShopAddress] = useState('');
    const [googleLink, setGoogleLink] = useState('');
    const [shopOpen, setShopOpen] = useState('');
    const [shopClose, setShopClose] = useState('');
    const [openHour, setOpenHour] = useState('08');
    const [openMinute, setOpenMinute] = useState('00');
    const [openPeriod, setOpenPeriod] = useState('AM');
    const [closeHour, setCloseHour] = useState('10');
    const [closeMinute, setCloseMinute] = useState('00');
    const [closePeriod, setClosePeriod] = useState('PM');
    const [showOpenTimePicker, setShowOpenTimePicker] = useState(false);
    const [showCloseTimePicker, setShowCloseTimePicker] = useState(false);
    const [GCASHName, setGCASHName] = useState('');
    const [GCASHNumber, setGCASHNumber] = useState('');
    const [acceptGCASH, setAcceptGCASH] = useState(false);
    const [categories, setCategories] = useState<Category>({
        food: false,
        drinks: false,
        clothing: false,
        electronics: false,
        chicken: false,
        sisig: false,
        samgyupsal: false,
        'burger steak': false,
        pork: false,
        bbq: false,
        'street food': false,
        desserts: false,
        'milk tea': false,
        coffee: false,
        snacks: false,
        breakfast: false,
    });
    const [locationLoading, setLocationLoading] = useState(false);

    // Animation values for loading state
    const spinValue = useRef(new Animated.Value(0)).current;
    const circleValue = useRef(new Animated.Value(0)).current;

    // Custom alert state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [alertButtons, setAlertButtons] = useState<{text: string; onPress: () => void; style?: 'default' | 'cancel'}[]>([]);

    // Animation setup for loading state
    useEffect(() => {
        const startAnimation = () => {
            // Logo spin animation
            Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ).start();

            // Circle line animation
            Animated.loop(
                Animated.timing(circleValue, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ).start();
        };

        startAnimation();
    }, []);

    // Custom alert function
    const showCustomAlert = (
        title: string,
        message: string,
        buttons?: {text: string; onPress: () => void; style?: 'default' | 'cancel'}[]
    ) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertButtons(buttons || [{ text: 'OK', onPress: () => setAlertVisible(false) }]);
        setAlertVisible(true);
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            showCustomAlert('Permission needed', 'Please grant permission to access your photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleCategoryToggle = (category: string) => {
        setCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);

            // Validation checks
            const hasCategorySelected = Object.values(categories).some(selected => selected);
            if (!hasCategorySelected) {
                showCustomAlert('Action Needed', 'Please select at least one category.');
                setLoading(false);
                return;
            }

            if (!image) {
                showCustomAlert('Action Needed', 'Please upload a shop image.');
                setLoading(false);
                return;
            }

            if (!googleLink) {
                showCustomAlert('Action Needed', 'Please provide a valid Google Maps address link.');
                setLoading(false);
                return;
            }

            // Convert to 24-hour format for validation
            const convertTo24Hour = (hour: string, minute: string, period: string) => {
                let hours = parseInt(hour);
                if (period === 'PM' && hours !== 12) {
                    hours += 12;
                } else if (period === 'AM' && hours === 12) {
                    hours = 0;
                }
                return `${hours.toString().padStart(2, '0')}:${minute}`;
            };

            const openTime24 = convertTo24Hour(openHour, openMinute, openPeriod);
            const closeTime24 = convertTo24Hour(closeHour, closeMinute, closePeriod);

            if (openTime24 >= closeTime24) {
                showCustomAlert('Invalid Time', 'Shop close time must be later than shop open time.');
                setLoading(false);
                return;
            }

            setShopOpen(openTime24);
            setShopClose(closeTime24);

            if (acceptGCASH) {
                if (!GCASHName.trim()) {
                    showCustomAlert('Missing Information', 'Please enter your GCash account name.');
                    setLoading(false);
                    return;
                }
                
                if (!GCASHNumber.trim()) {
                    showCustomAlert('Missing Information', 'Please enter your GCash account number.');
                    setLoading(false);
                    return;
                }
                
                if (!GCASHNumber.startsWith('9') || GCASHNumber.length !== 10) {
                    showCustomAlert('Invalid Number', 'Please provide a valid GCash Number starting with 9 and containing 10 digits.');
                    setLoading(false);
                    return;
                }
            }

            // Get user ID and token
            const userId = await AsyncStorage.getItem('userId');
            let token = await getAccessToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }

            if (!userId || !token) {
                showCustomAlert('Error', 'Authentication required. Please log in again.');
                setLoading(false);
                return;
            }

            // Prepare shop data
            const selectedCategories = Object.keys(categories).filter(category => categories[category]);
            const shop = {
                // Only include GCash fields if accepting GCash and all fields are provided
                gcashName: acceptGCASH && GCASHName.trim() ? GCASHName.trim() : '',
                gcashNumber: acceptGCASH && GCASHNumber.trim() ? GCASHNumber.trim() : '',
                categories: selectedCategories,
                deliveryFee: 0,
                googleLink,
                address: shopAddress,
                name: shopName,
                desc: shopDesc,
                timeOpen: shopOpen,
                timeClose: shopClose,
                // Only set acceptGCASH to true if all GCash info is provided
                acceptGCASH: acceptGCASH && GCASHName.trim() && GCASHNumber.trim() ? true : false,
            };

            // Create form data
            const formData = new FormData();
            formData.append('shop', JSON.stringify(shop));
            formData.append('userId', userId);

            // Add image
            const imageUri = image;
            const imageName = imageUri.split('/').pop();
            const match = /\.(\w+)$/.exec(imageName || '');
            const imageType = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('image', {
                uri: imageUri,
                name: imageName,
                type: imageType,
            } as any);

            // Submit application
            const response = await axios.post(`${API_URL}/api/shops/apply`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: token,
                },
            });

            if (response.status === 200 || response.status === 201) {
                setLoading(false);
                showCustomAlert(
                    'Application Submitted! 🎉',
                    'Your shop application has been submitted successfully! Please log out and log back in after admin approval to access your shop dashboard.',
                    [{ 
                        text: 'Logout Now', 
                        onPress: async () => {
                            try {
                                setAlertVisible(false);
                                // Small delay to ensure modal closes before logout
                                await new Promise(resolve => setTimeout(resolve, 100));
                                // Use the secure signOut function - it handles everything
                                await signOut();
                            } catch (error) {
                                console.error('Logout error:', error);
                                router.replace('/');
                            }
                        }
                    },
                    { 
                        text: 'Later', 
                        style: 'cancel',
                        onPress: () => {
                            setAlertVisible(false);
                            router.replace('/profile');
                        }
                    }]
                );
            }
        } catch (error: any) {
            console.error('Error submitting form:', error);
            setLoading(false);
            showCustomAlert(
                'Error',
                error.response?.data || 'Failed to submit shop application. Please try again.'
            );
        }
    };

    const getCurrentLocation = async () => {
        try {
            setLocationLoading(true);
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                showCustomAlert('Permission Denied', 'Location permission is required to use this feature.');
                return;
            }

            // Get current location with high accuracy
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High, // Use high accuracy for better results
            });
            const { latitude, longitude } = location.coords;

            // Format the coordinates as a Google Maps link
            const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

            // Set the Google Maps link directly in the input field
            setGoogleLink(googleMapsLink);

            showCustomAlert(
                'Location Updated',
                'Your current location has been set.'
            );
        } catch (error) {
            console.error('Error getting location:', error);
            showCustomAlert('Error', 'Failed to get your current location. Please try again.');
        } finally {
            setLocationLoading(false);
        }
    };

    const renderFormField = (
        label: string,
        value: string,
        onChangeText: (text: string) => void,
        placeholder: string,
        icon: string,
        multiline: boolean = false,
        keyboardType: any = "default"
    ) => (
        <StyledView className="mb-6">
            <StyledView className="flex-row items-center mb-3">
                <Ionicons name={icon as any} size={18} color="#666" />
                <StyledText className="text-base font-semibold text-[#8B4513] ml-2">{label}</StyledText>
            </StyledView>
            <StyledTextInput
                className={`bg-white rounded-2xl px-4 py-4 text-base border border-[#e5e5e5] ${multiline ? 'h-24' : ''}`}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#999"
                multiline={multiline}
                numberOfLines={multiline ? 4 : 1}
                keyboardType={keyboardType}
                style={{ fontSize: 16 }}
                maxLength={multiline ? 500 : 100}
            />
        </StyledView>
    );

    return (
        <StyledView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
            {loading && (
                <Modal
                    transparent={true}
                    visible={loading}
                    animationType="fade"
                >
                    <StyledView className="flex-1 justify-center items-center bg-black/50">
                        <StyledView className="relative">
                            {/* Circular loading line */}
                            <Animated.View
                                style={{
                                    transform: [{ rotate: circleValue.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0deg', '360deg'],
                                    }) }],
                                    width: 120,
                                    height: 120,
                                    borderRadius: 60,
                                    borderWidth: 3,
                                    borderColor: 'transparent',
                                    borderTopColor: '#BC4A4D',
                                    borderRightColor: '#DAA520',
                                }}
                            />
                            
                            {/* Spinning Campus Eats logo */}
                            <Animated.View
                                style={{
                                    transform: [{ rotate: spinValue.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0deg', '360deg'],
                                    }) }],
                                    position: 'absolute',
                                    top: 20,
                                    left: 20,
                                    width: 80,
                                    height: 80,
                                    borderRadius: 40,
                                    backgroundColor: 'white',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    shadowColor: '#000',
                                    shadowOffset: {
                                        width: 0,
                                        height: 2,
                                    },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 4,
                                    elevation: 5,
                                }}
                            >
                                <Image
                                    source={require('../../assets/images/logo.png')}
                                    style={{ width: 50, height: 50 }}
                                    resizeMode="contain"
                                />
                            </Animated.View>
                        </StyledView>
                        
                        <StyledText className="text-lg font-bold text-white mt-6 mb-2">Campus Eats</StyledText>
                        <StyledText className="text-base text-center text-white/80">Submitting application...</StyledText>
                    </StyledView>
                </Modal>
            )}
            
            <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Header */}
                <StyledView className="bg-white px-6 py-8 border-b border-[#f0f0f0]">
                    <StyledView className="items-center mb-4">
                        <StyledView className="w-16 h-16 rounded-full bg-[#f8f8f8] justify-center items-center mb-4 border-2 border-[#f0f0f0]">
                            <Ionicons name="storefront-outline" size={32} color="#BC4A4D" />
                        </StyledView>
                        <StyledText className="text-2xl font-bold text-[#BC4A4D] text-center">Shop Application</StyledText>
                        <StyledText className="text-base text-[#8B4513] text-center mt-2 leading-6">
                            Partner with CampusEats to help drive growth and take your business to the next level.
                        </StyledText>
                    </StyledView>
                </StyledView>

                {/* Basic Information */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledText className="text-lg font-bold text-[#BC4A4D] mb-6">Basic Information</StyledText>

                    {renderFormField(
                        "Shop Name",
                        shopName,
                        setShopName,
                        "Enter your shop name",
                        "storefront-outline"
                    )}

                    {renderFormField(
                        "Shop Description",
                        shopDesc,
                        setShopDesc,
                        "Describe your shop and what makes it special",
                        "document-text-outline",
                        true
                    )}

                    {renderFormField(
                        "Shop Address",
                        shopAddress,
                        setShopAddress,
                        "Enter your complete shop address",
                        "location-outline"
                    )}
                </StyledView>

                {/* Location */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="map-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#BC4A4D] ml-2">Location</StyledText>
                    </StyledView>

                    <StyledView className="flex-row items-end space-x-3">
                        <StyledView className="flex-1">
                            <StyledTextInput
                                className="bg-[#f8f8f8] rounded-2xl px-4 py-4 text-base border border-[#e5e5e5]"
                                value={googleLink}
                                onChangeText={setGoogleLink}
                                placeholder="Google Maps link"
                                placeholderTextColor="#999"
                                style={{ fontSize: 16 }}
                                maxLength={500}
                            />
                        </StyledView>
                        <StyledTouchableOpacity
                            className={`bg-[#BC4A4D] px-6 py-4 rounded-2xl ${locationLoading ? 'opacity-70' : ''}`}
                            onPress={getCurrentLocation}
                            disabled={locationLoading}
                        >
                            {locationLoading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <StyledView className="flex-row items-center">
                                    <Ionicons name="navigate-outline" size={18} color="white" />
                                    <StyledText className="text-white font-semibold ml-1">Pin</StyledText>
                                </StyledView>
                            )}
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>

                {/* Operating Hours */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="time-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#BC4A4D] ml-2">Operating Hours</StyledText>
                    </StyledView>

                    <StyledView className="mb-4" style={{ width: '100%' }}>
                        <StyledText className="text-sm font-semibold text-[#8B4513] mb-3">Opening Time</StyledText>
                        <StyledTouchableOpacity
                            className="bg-[#f8f8f8] rounded-2xl px-4 py-4 border border-[#e5e5e5]"
                            onPress={() => setShowOpenTimePicker(true)}
                        >
                            <StyledText className="text-[#333] text-base text-center">
                                {openHour && openMinute ? `${openHour}:${openMinute} ${openPeriod}` : 'Select time'}
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>

                    <StyledView style={{ width: '100%' }}>
                        <StyledText className="text-sm font-semibold text-[#8B4513] mb-3">Closing Time</StyledText>
                        <StyledTouchableOpacity
                            className="bg-[#f8f8f8] rounded-2xl px-4 py-4 border border-[#e5e5e5]"
                            onPress={() => setShowCloseTimePicker(true)}
                        >
                            <StyledText className="text-[#333] text-base text-center">
                                {closeHour && closeMinute ? `${closeHour}:${closeMinute} ${closePeriod}` : 'Select time'}
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>

                {/* Shop Image */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="image-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#BC4A4D] ml-2">Shop Logo/Banner</StyledText>
                    </StyledView>

                    <StyledTouchableOpacity
                        className="h-48 bg-[#f8f8f8] rounded-3xl border-2 border-dashed border-[#e5e5e5] overflow-hidden"
                        onPress={pickImage}
                    >
                        {image ? (
                            <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                            <StyledView className="flex-1 justify-center items-center">
                                <Ionicons name="cloud-upload-outline" size={48} color="#BC4A4D" />
                                <StyledText className="mt-3 text-[#8B4513] font-semibold">Tap to upload image</StyledText>
                                <StyledText className="mt-1 text-sm text-[#999]">Recommended: 16:9 aspect ratio</StyledText>
                            </StyledView>
                        )}
                    </StyledTouchableOpacity>
                </StyledView>

                {/* Payment Method */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="card-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#BC4A4D] ml-2">Payment Method</StyledText>
                    </StyledView>

                    <StyledText className="text-base font-semibold text-[#8B4513] mb-4">Accept GCASH Payment</StyledText>
                    <StyledView className="flex-row bg-[#f8f8f8] rounded-2xl p-1 mb-6">
                        <StyledTouchableOpacity
                            className={`flex-1 py-3 rounded-xl ${acceptGCASH ? 'bg-[#BC4A4D]' : ''}`}
                            onPress={() => setAcceptGCASH(true)}
                        >
                            <StyledText className={`text-center font-semibold ${acceptGCASH ? 'text-white' : 'text-[#8B4513]'}`}>
                                Yes
                            </StyledText>
                        </StyledTouchableOpacity>
                        <StyledTouchableOpacity
                            className={`flex-1 py-3 rounded-xl ${!acceptGCASH ? 'bg-[#BC4A4D]' : ''}`}
                            onPress={() => setAcceptGCASH(false)}
                        >
                            <StyledText className={`text-center font-semibold ${!acceptGCASH ? 'text-white' : 'text-[#8B4513]'}`}>
                                No
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>

                    {acceptGCASH && (
                        <StyledView className="space-y-4">
                            <StyledView>
                                <StyledText className="text-base font-semibold text-[#8B4513] mb-3">GCASH Account Name</StyledText>
                                <StyledTextInput
                                    className="bg-[#f8f8f8] rounded-2xl px-4 py-4 text-base border border-[#e5e5e5]"
                                    value={GCASHName}
                                    onChangeText={setGCASHName}
                                    placeholder="Enter GCASH registered name"
                                    placeholderTextColor="#999"
                                    style={{ fontSize: 16 }}
                                    maxLength={100}
                                />
                            </StyledView>

                            <StyledView>
                                <StyledText className="text-base font-semibold text-[#8B4513] mb-3">GCASH Number</StyledText>
                                <StyledView className="flex-row items-center bg-[#f8f8f8] rounded-2xl border border-[#e5e5e5]">
                                    <StyledText className="px-4 py-4 text-[#8B4513] font-semibold">+63</StyledText>
                                    <StyledTextInput
                                        className="flex-1 py-4 pr-4 text-base"
                                        value={GCASHNumber}
                                        onChangeText={setGCASHNumber}
                                        placeholder="9XX XXX XXXX"
                                        placeholderTextColor="#999"
                                        keyboardType="phone-pad"
                                        maxLength={10}
                                        style={{ fontSize: 16 }}
                                    />
                                </StyledView>
                            </StyledView>
                        </StyledView>
                    )}
                </StyledView>

                {/* Categories */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="grid-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#BC4A4D] ml-2">Shop Categories</StyledText>
                    </StyledView>

                    <StyledText className="text-sm text-[#8B4513] mb-4">Select all categories that apply to your shop</StyledText>
                    <StyledView className="flex-row flex-wrap -mx-1">
                        {Object.keys(categories).map((category) => (
                            <StyledTouchableOpacity
                                key={category}
                                className={`m-1 px-4 py-3 rounded-2xl border ${
                                    categories[category]
                                        ? 'bg-[#BC4A4D] border-[#BC4A4D]'
                                        : 'bg-[#f8f8f8] border-[#e5e5e5]'
                                }`}
                                onPress={() => handleCategoryToggle(category)}
                            >
                                <StyledText
                                    className={`text-sm font-semibold capitalize ${
                                        categories[category] ? 'text-white' : 'text-[#666]'
                                    }`}
                                >
                                    {category}
                                </StyledText>
                            </StyledTouchableOpacity>
                        ))}
                    </StyledView>
                </StyledView>

                {/* Action Buttons */}
                <StyledView className="mx-6 mt-8 mb-8 space-y-4">
                    <StyledTouchableOpacity
                        className={`${loading ? 'bg-[#BC4A4D]/50' : 'bg-[#BC4A4D]'} p-5 rounded-3xl shadow-sm`}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <StyledView className="flex-row items-center justify-center">
                            {loading ? (
                                <>
                                    <ActivityIndicator color="white" size="small" />
                                    <StyledText className="text-white text-base font-bold ml-2">Submitting...</StyledText>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                                    <StyledText className="text-white text-base font-bold ml-2">Submit Application</StyledText>
                                </>
                            )}
                        </StyledView>
                    </StyledTouchableOpacity>

                    <StyledTouchableOpacity
                        className="bg-white p-5 rounded-3xl border border-[#e5e5e5]"
                        onPress={() => router.back()}
                    >
                        <StyledView className="flex-row items-center justify-center">
                            <Ionicons name="arrow-back-outline" size={20} color="#666" />
                            <StyledText className="text-[#666] text-base font-semibold ml-2">Cancel</StyledText>
                        </StyledView>
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledScrollView>

            {/* Custom Alert Component */}
            <CustomAlert
                visible={alertVisible}
                title={alertTitle}
                message={alertMessage}
                buttons={alertButtons}
                onClose={() => setAlertVisible(false)}
            />

            {/* Opening Time Picker Modal */}
            <Modal
                visible={showOpenTimePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowOpenTimePicker(false)}
            >
                <StyledView className="flex-1 justify-end bg-black/50">
                    <StyledView className="bg-white rounded-t-3xl p-6">
                        <StyledView className="flex-row justify-between items-center mb-4">
                            <StyledText className="text-xl font-bold text-gray-800">Opening Time</StyledText>
                            <StyledTouchableOpacity onPress={() => setShowOpenTimePicker(false)}>
                                <Ionicons name="close" size={24} color="#BC4A4D" />
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="flex-row justify-between mb-6">
                            {/* Hour Picker */}
                            <StyledView className="flex-1 mr-2">
                                <StyledText className="text-sm font-semibold text-gray-700 mb-2 text-center">Hour</StyledText>
                                <ScrollView className="max-h-40 bg-gray-50 rounded-xl border border-gray-200">
                                    {HOURS_12.map((hour) => (
                                        <StyledTouchableOpacity
                                            key={hour}
                                            className={`py-3 ${openHour === hour ? 'bg-[#BC4A4D]' : ''}`}
                                            onPress={() => setOpenHour(hour)}
                                        >
                                            <StyledText className={`text-center text-base font-medium ${openHour === hour ? 'text-white' : 'text-gray-800'}`}>
                                                {hour}
                                            </StyledText>
                                        </StyledTouchableOpacity>
                                    ))}
                                </ScrollView>
                            </StyledView>

                            {/* Minute Picker */}
                            <StyledView className="flex-1 mx-2">
                                <StyledText className="text-sm font-semibold text-gray-700 mb-2 text-center">Minute</StyledText>
                                <ScrollView className="max-h-40 bg-gray-50 rounded-xl border border-gray-200">
                                    {MINUTES.map((minute) => (
                                        <StyledTouchableOpacity
                                            key={minute}
                                            className={`py-3 ${openMinute === minute ? 'bg-[#BC4A4D]' : ''}`}
                                            onPress={() => setOpenMinute(minute)}
                                        >
                                            <StyledText className={`text-center text-base font-medium ${openMinute === minute ? 'text-white' : 'text-gray-800'}`}>
                                                {minute}
                                            </StyledText>
                                        </StyledTouchableOpacity>
                                    ))}
                                </ScrollView>
                            </StyledView>

                            {/* Period Picker */}
                            <StyledView className="flex-1 ml-2">
                                <StyledText className="text-sm font-semibold text-gray-700 mb-2 text-center">Period</StyledText>
                                <StyledView className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                    {['AM', 'PM'].map((period) => (
                                        <StyledTouchableOpacity
                                            key={period}
                                            className={`py-3 ${openPeriod === period ? 'bg-[#BC4A4D]' : ''}`}
                                            onPress={() => setOpenPeriod(period)}
                                        >
                                            <StyledText className={`text-center text-base font-medium ${openPeriod === period ? 'text-white' : 'text-gray-800'}`}>
                                                {period}
                                            </StyledText>
                                        </StyledTouchableOpacity>
                                    ))}
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        <StyledTouchableOpacity
                            className="bg-[#BC4A4D] py-4 rounded-xl"
                            onPress={() => setShowOpenTimePicker(false)}
                        >
                            <StyledText className="text-white text-center font-bold text-base">Done</StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </Modal>

            {/* Closing Time Picker Modal */}
            <Modal
                visible={showCloseTimePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCloseTimePicker(false)}
            >
                <StyledView className="flex-1 justify-end bg-black/50">
                    <StyledView className="bg-white rounded-t-3xl p-6">
                        <StyledView className="flex-row justify-between items-center mb-4">
                            <StyledText className="text-xl font-bold text-gray-800">Closing Time</StyledText>
                            <StyledTouchableOpacity onPress={() => setShowCloseTimePicker(false)}>
                                <Ionicons name="close" size={24} color="#BC4A4D" />
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="flex-row justify-between mb-6">
                            {/* Hour Picker */}
                            <StyledView className="flex-1 mr-2">
                                <StyledText className="text-sm font-semibold text-gray-700 mb-2 text-center">Hour</StyledText>
                                <ScrollView className="max-h-40 bg-gray-50 rounded-xl border border-gray-200">
                                    {HOURS_12.map((hour) => (
                                        <StyledTouchableOpacity
                                            key={hour}
                                            className={`py-3 ${closeHour === hour ? 'bg-[#BC4A4D]' : ''}`}
                                            onPress={() => setCloseHour(hour)}
                                        >
                                            <StyledText className={`text-center text-base font-medium ${closeHour === hour ? 'text-white' : 'text-gray-800'}`}>
                                                {hour}
                                            </StyledText>
                                        </StyledTouchableOpacity>
                                    ))}
                                </ScrollView>
                            </StyledView>

                            {/* Minute Picker */}
                            <StyledView className="flex-1 mx-2">
                                <StyledText className="text-sm font-semibold text-gray-700 mb-2 text-center">Minute</StyledText>
                                <ScrollView className="max-h-40 bg-gray-50 rounded-xl border border-gray-200">
                                    {MINUTES.map((minute) => (
                                        <StyledTouchableOpacity
                                            key={minute}
                                            className={`py-3 ${closeMinute === minute ? 'bg-[#BC4A4D]' : ''}`}
                                            onPress={() => setCloseMinute(minute)}
                                        >
                                            <StyledText className={`text-center text-base font-medium ${closeMinute === minute ? 'text-white' : 'text-gray-800'}`}>
                                                {minute}
                                            </StyledText>
                                        </StyledTouchableOpacity>
                                    ))}
                                </ScrollView>
                            </StyledView>

                            {/* Period Picker */}
                            <StyledView className="flex-1 ml-2">
                                <StyledText className="text-sm font-semibold text-gray-700 mb-2 text-center">Period</StyledText>
                                <StyledView className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                    {['AM', 'PM'].map((period) => (
                                        <StyledTouchableOpacity
                                            key={period}
                                            className={`py-3 ${closePeriod === period ? 'bg-[#BC4A4D]' : ''}`}
                                            onPress={() => setClosePeriod(period)}
                                        >
                                            <StyledText className={`text-center text-base font-medium ${closePeriod === period ? 'text-white' : 'text-gray-800'}`}>
                                                {period}
                                            </StyledText>
                                        </StyledTouchableOpacity>
                                    ))}
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        <StyledTouchableOpacity
                            className="bg-[#BC4A4D] py-4 rounded-xl"
                            onPress={() => setShowCloseTimePicker(false)}
                        >
                            <StyledText className="text-white text-center font-bold text-base">Done</StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </Modal>

            <BottomNavigation activeTab="Profile" />
        </StyledView>
    );
};

export default ShopApplication;