import React, { useState } from 'react';
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

interface Category {
    [key: string]: boolean;
}

const ShopApplication = () => {
    const { getAccessToken } = useAuthentication();
    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState<string | null>(null);
    const [shopName, setShopName] = useState('');
    const [shopDesc, setShopDesc] = useState('');
    const [shopAddress, setShopAddress] = useState('');
    const [googleLink, setGoogleLink] = useState('');
    const [shopOpen, setShopOpen] = useState('');
    const [shopClose, setShopClose] = useState('');
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

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant permission to access your photos');
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
                Alert.alert('Action Needed', 'Please select at least one category.');
                return;
            }

            if (!image) {
                Alert.alert('Action Needed', 'Please upload a shop image.');
                return;
            }

            if (!googleLink) {
                Alert.alert('Action Needed', 'Please provide a valid Google Maps address link.');
                return;
            }

            if (shopOpen >= shopClose) {
                Alert.alert('Invalid Time', 'Shop close time must be later than shop open time.');
                return;
            }

            if (acceptGCASH && (!GCASHNumber.startsWith('9') || GCASHNumber.length !== 10)) {
                Alert.alert('Invalid Number', 'Please provide a valid GCASH Number.');
                return;
            }

            // Get user ID and token
            const userId = await AsyncStorage.getItem('userId');
            let token = await getAccessToken();
            if (!token) {
                token = await AsyncStorage.getItem('@CampusEats:AuthToken');
            }

            if (!userId || !token) {
                Alert.alert('Error', 'Authentication required. Please log in again.');
                return;
            }

            // Prepare shop data
            const selectedCategories = Object.keys(categories).filter(category => categories[category]);
            const shop = {
                gcashName: GCASHName,
                gcashNumber: GCASHNumber,
                categories: selectedCategories,
                deliveryFee: 0,
                googleLink,
                address: shopAddress,
                name: shopName,
                desc: shopDesc,
                timeOpen: shopOpen,
                timeClose: shopClose,
                acceptGCASH,
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
                Alert.alert(
                    'Success',
                    'Shop application submitted successfully! Please wait for admin approval.',
                    [{ text: 'OK', onPress: () => router.replace('/profile') }]
                );
            }
        } catch (error: any) {
            console.error('Error submitting form:', error);
            Alert.alert(
                'Error',
                error.response?.data || 'Failed to submit shop application. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const getCurrentLocation = async () => {
        try {
            setLocationLoading(true);
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
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

            Alert.alert(
                'Location Updated',
                'Your current location has been set.'
            );
        } catch (error) {
            console.error('Error getting location:', error);
            Alert.alert('Error', 'Failed to get your current location. Please try again.');
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
                <StyledText className="text-base font-semibold text-[#333] ml-2">{label}</StyledText>
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
            />
        </StyledView>
    );

    return (
        <StyledView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
            <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <StyledView className="bg-white px-6 py-8 border-b border-[#f0f0f0]">
                    <StyledView className="items-center mb-4">
                        <StyledView className="w-9 h-9 rounded-full bg-[#f8f8f8] justify-center items-center mb-4 border-2 border-[#f0f0f0]">
                            <Ionicons name="storefront-outline" size={28} color="#BC4A4D" />
                        </StyledView>
                        <StyledText className="text-2xl font-bold text-[#333] text-center">Shop Application</StyledText>
                        <StyledText className="text-base text-[#666] text-center mt-2 leading-6">
                            Partner with CampusEats to help drive growth and take your business to the next level.
                        </StyledText>
                    </StyledView>
                </StyledView>

                {/* Basic Information */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledText className="text-lg font-bold text-[#333] mb-6">Basic Information</StyledText>

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
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Location</StyledText>
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
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Operating Hours</StyledText>
                    </StyledView>

                    <StyledView className="flex-row space-x-4">
                        <StyledView className="flex-1">
                            <StyledText className="text-sm font-semibold text-[#666] mb-3">Opening Time</StyledText>
                            <StyledTextInput
                                className="bg-[#f8f8f8] rounded-2xl px-4 py-4 text-base border border-[#e5e5e5]"
                                value={shopOpen}
                                onChangeText={setShopOpen}
                                placeholder="08:00"
                                placeholderTextColor="#999"
                                style={{ fontSize: 16 }}
                            />
                        </StyledView>
                        <StyledView className="flex-1">
                            <StyledText className="text-sm font-semibold text-[#666] mb-3">Closing Time</StyledText>
                            <StyledTextInput
                                className="bg-[#f8f8f8] rounded-2xl px-4 py-4 text-base border border-[#e5e5e5]"
                                value={shopClose}
                                onChangeText={setShopClose}
                                placeholder="22:00"
                                placeholderTextColor="#999"
                                style={{ fontSize: 16 }}
                            />
                        </StyledView>
                    </StyledView>
                </StyledView>

                {/* Shop Image */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="image-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Shop Logo/Banner</StyledText>
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
                                <StyledText className="mt-3 text-[#666] font-semibold">Tap to upload image</StyledText>
                                <StyledText className="mt-1 text-sm text-[#999]">Recommended: 16:9 aspect ratio</StyledText>
                            </StyledView>
                        )}
                    </StyledTouchableOpacity>
                </StyledView>

                {/* Payment Method */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="card-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Payment Method</StyledText>
                    </StyledView>

                    <StyledText className="text-base font-semibold text-[#333] mb-4">Accept GCASH Payment</StyledText>
                    <StyledView className="flex-row bg-[#f8f8f8] rounded-2xl p-1 mb-6">
                        <StyledTouchableOpacity
                            className={`flex-1 py-3 rounded-xl ${acceptGCASH ? 'bg-[#BC4A4D]' : ''}`}
                            onPress={() => setAcceptGCASH(true)}
                        >
                            <StyledText className={`text-center font-semibold ${acceptGCASH ? 'text-white' : 'text-[#666]'}`}>
                                Yes
                            </StyledText>
                        </StyledTouchableOpacity>
                        <StyledTouchableOpacity
                            className={`flex-1 py-3 rounded-xl ${!acceptGCASH ? 'bg-[#BC4A4D]' : ''}`}
                            onPress={() => setAcceptGCASH(false)}
                        >
                            <StyledText className={`text-center font-semibold ${!acceptGCASH ? 'text-white' : 'text-[#666]'}`}>
                                No
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>

                    {acceptGCASH && (
                        <StyledView className="space-y-4">
                            <StyledView>
                                <StyledText className="text-base font-semibold text-[#333] mb-3">GCASH Account Name</StyledText>
                                <StyledTextInput
                                    className="bg-[#f8f8f8] rounded-2xl px-4 py-4 text-base border border-[#e5e5e5]"
                                    value={GCASHName}
                                    onChangeText={setGCASHName}
                                    placeholder="Enter GCASH registered name"
                                    placeholderTextColor="#999"
                                    style={{ fontSize: 16 }}
                                />
                            </StyledView>

                            <StyledView>
                                <StyledText className="text-base font-semibold text-[#333] mb-3">GCASH Number</StyledText>
                                <StyledView className="flex-row items-center bg-[#f8f8f8] rounded-2xl border border-[#e5e5e5]">
                                    <StyledText className="px-4 py-4 text-[#666] font-semibold">+63</StyledText>
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
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Shop Categories</StyledText>
                    </StyledView>

                    <StyledText className="text-sm text-[#666] mb-4">Select all categories that apply to your shop</StyledText>
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
            <BottomNavigation activeTab="Profile" />
        </StyledView>
    );
};

export default ShopApplication;