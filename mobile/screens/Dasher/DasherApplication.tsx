import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Image,
    Alert,
    Platform,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthentication } from '../../services/authService';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledTextInput = styled(TextInput);

type DayType = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type DaysState = Record<DayType, boolean>;

const DasherApplication = () => {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [availableStartTime, setAvailableStartTime] = useState('');
    const [availableEndTime, setAvailableEndTime] = useState('');
    const [startTimePeriod, setStartTimePeriod] = useState<'AM' | 'PM'>('AM');
    const [endTimePeriod, setEndTimePeriod] = useState<'AM' | 'PM'>('AM');
    const [GCASHName, setGCASHName] = useState('');
    const [GCASHNumber, setGCASHNumber] = useState('');
    const [days, setDays] = useState<DaysState>({
        MON: false,
        TUE: false,
        WED: false,
        THU: false,
        FRI: false,
        SAT: false,
        SUN: false,
    });
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        title: '',
        message: '',
        type: 'error' as 'error' | 'success',
    });

    const { getAccessToken } = useAuthentication();

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant permission to access your photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setUploadedImage(result.assets[0].uri);
            setImageFile(result.assets[0]);
        }
    };

    const handleCategoryChange = (day: DayType) => {
        setDays({
            ...days,
            [day]: !days[day],
        });
    };

    const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
        setAlertConfig({ title, message, type });
        setAlertVisible(true);
    };

    const handleSubmit = async () => {
        const hasCategorySelected = Object.values(days).some(selected => selected);

        if (!hasCategorySelected) {
            showAlert('Selection Required', 'Please select at least one day.');
            return;
        }

        if (!uploadedImage) {
            showAlert('Image Required', 'Please upload a school ID image.');
            return;
        }

        if (!GCASHNumber.startsWith('9') || GCASHNumber.length !== 10) {
            showAlert('Invalid Number', 'Please enter a valid GCASH number.');
            return;
        }

        if (availableStartTime >= availableEndTime) {
            showAlert('Invalid Time', 'Available end time must be later than start time.');
            return;
        }

        try {
            const token = await getAccessToken();
            if (!token) {
                showAlert('Error', 'Authentication token missing. Please log in again.');
                return;
            }

            const selectedDays = Object.keys(days).filter(day => days[day as DayType]) as DayType[];
            const dasher = {
                daysAvailable: selectedDays,
                availableStartTime,
                availableEndTime,
                gcashName: GCASHName,
                gcashNumber: GCASHNumber
            };

            const formData = new FormData();
            formData.append("dasher", JSON.stringify(dasher));

            if (uploadedImage) {
                const imageUri = uploadedImage;
                const imageName = imageUri.split('/').pop() || 'image.jpg';
                const match = /\.(\w+)$/.exec(imageName);
                const imageType = match ? `image/${match[1]}` : 'image/jpeg';

                formData.append("image", {
                    uri: imageUri,
                    name: imageName,
                    type: imageType
                } as any);
            }

            const userId = await AsyncStorage.getItem('userId');
            if (userId) {
                formData.append("userId", userId);
            }

            const response = await axios.post(`${API_URL}/api/dashers/apply`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': token
                }
            });

            if (response.status === 200 || response.status === 201) {
                showAlert(
                    'Success',
                    'Dasher Application Submitted Successfully',
                    'success'
                );
                setTimeout(() => {
                    router.replace('/profile');
                }, 1500);
            }
        } catch (error: any) {
            console.error('Error submitting form:', error);
            showAlert(
                'Error',
                error.response?.data || 'Error submitting form. Please try again.'
            );
        }
    };

    return (
        <>
            <StyledScrollView className="flex-1 bg-[#DFD6C5]">
                {/* Header */}
                <StyledView className="bg-white px-6 py-8 border-b border-[#f0f0f0]">
                    <StyledView className="items-center mb-4">
                        <StyledView className="w-9 h-9 rounded-full bg-[#f8f8f8] justify-center items-center mb-4 border-2 border-[#f0f0f0]">
                            <Ionicons name="bicycle-outline" size={30} color="#BC4A4D" />
                        </StyledView>
                        <StyledText className="text-2xl font-bold text-[#333] text-center">Dasher Application</StyledText>
                        <StyledText className="text-base text-[#666] text-center mt-2 leading-6">
                            Partner with CampusEats to help drive growth and take your business to the next level.
                        </StyledText>
                    </StyledView>
                </StyledView>

                {/* Content */}
                <StyledView className="p-5">

                    {/* Form Container */}
                    <StyledView className="bg-white rounded-xl p-6 shadow-md mb-6">
                        {/* GCASH Name */}
                        <StyledView className="mb-6">
                            <StyledText className="text-base font-bold text-[#333] mb-2">GCASH Name</StyledText>
                            <StyledTextInput
                                className="bg-[#F8F5F0] rounded-xl p-4 border border-[#E8E0D8]"
                                value={GCASHName}
                                onChangeText={setGCASHName}
                                placeholder="Enter your GCASH name"
                                placeholderTextColor="#999"
                            />
                        </StyledView>

                        {/* GCASH Number */}
                        <StyledView className="mb-6">
                            <StyledText className="text-base font-bold text-[#333] mb-2">GCASH Number</StyledText>
                            <StyledView className="flex-row items-center bg-[#F8F5F0] rounded-xl border border-[#E8E0D8]">
                                <StyledText className="p-4 text-[#555] font-medium">+63 </StyledText>
                                <StyledTextInput
                                    className="flex-1 p-4"
                                    value={GCASHNumber}
                                    onChangeText={setGCASHNumber}
                                    placeholder="Enter GCASH number"
                                    placeholderTextColor="#999"
                                    keyboardType="numeric"
                                    maxLength={10}
                                />
                            </StyledView>
                        </StyledView>

                        {/* Available Time */}
                        <StyledView className="mb-6">
                            <StyledText className="text-base font-bold text-[#333] mb-2">Available Time</StyledText>
                            <StyledView className="flex-row justify-between space-x-4">
                                <StyledView className="flex-1">
                                    <StyledText className="text-sm text-[#555] mb-2 font-medium">Start Time</StyledText>
                                    <StyledTextInput
                                        className="bg-[#F8F5F0] rounded-xl p-4 border border-[#E8E0D8]"
                                        value={availableStartTime}
                                        onChangeText={setAvailableStartTime}
                                        placeholder="HH:MM"
                                        placeholderTextColor="#999"
                                        keyboardType="numbers-and-punctuation"
                                    />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <StyledText className="text-sm text-[#555] mb-2 font-medium">End Time</StyledText>
                                    <StyledTextInput
                                        className="bg-[#F8F5F0] rounded-xl p-4 border border-[#E8E0D8]"
                                        value={availableEndTime}
                                        onChangeText={setAvailableEndTime}
                                        placeholder="HH:MM"
                                        placeholderTextColor="#999"
                                        keyboardType="numbers-and-punctuation"
                                    />
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        {/* School ID */}
                        <StyledView className="mb-6">
                            <StyledText className="text-base font-bold text-[#333] mb-2">School ID</StyledText>
                            <StyledTouchableOpacity
                                className="border-2 border-dashed border-[#E8E0D8] rounded-xl h-[170px] justify-center items-center bg-[#F8F5F0]"
                                onPress={pickImage}
                            >
                                {uploadedImage ? (
                                    <StyledImage source={{ uri: uploadedImage }} className="w-full h-full rounded-xl" />
                                ) : (
                                    <StyledView className="items-center">
                                        <Ionicons name="cloud-upload-outline" size={40} color="#BC4A4D" />
                                        <StyledText className="mt-3 text-[#555] font-medium">Upload School ID</StyledText>
                                    </StyledView>
                                )}
                            </StyledTouchableOpacity>
                        </StyledView>

                        {/* Days Available */}
                        <StyledView className="mb-6">
                            <StyledText className="text-base font-bold text-[#333] mb-3">Days Available</StyledText>
                            <StyledView className="flex-row flex-wrap -mx-1">
                                {(Object.keys(days) as DayType[]).map((day) => (
                                    <StyledTouchableOpacity
                                        key={day}
                                        className={`px-5 py-3 rounded-full m-1 border ${
                                            days[day] ? 'bg-[#BC4A4D] border-[#BC4A4D]' : 'bg-[#F8F5F0] border-[#E8E0D8]'
                                        }`}
                                        onPress={() => handleCategoryChange(day)}
                                    >
                                        <StyledText
                                            className={`${
                                                days[day] ? 'text-white font-bold' : 'text-[#555] font-medium'
                                            }`}
                                        >
                                            {day}
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                ))}
                            </StyledView>
                        </StyledView>

                        {/* Buttons */}
                        <StyledView className="flex-row justify-between mt-8 space-x-4">
                            <StyledTouchableOpacity
                                className="flex-1 py-4 rounded-xl bg-white border border-[#E8E0D8] items-center shadow-sm"
                                onPress={() => router.back()}
                            >
                                <StyledView className="flex-row items-center justify-center">
                                    <Ionicons name="arrow-back-outline" size={20} color="#666" />
                                    <StyledText className="text-[#666] text-base font-semibold ml-2">Cancel</StyledText>
                                </StyledView>
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity
                                className="flex-1 py-4 rounded-xl bg-[#BC4A4D] items-center shadow-md"
                                onPress={handleSubmit}
                            >
                                <StyledText className="text-white text-base font-bold">Submit</StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </StyledScrollView>

            {/* Custom Alert Modal */}
            <Modal
                visible={alertVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setAlertVisible(false)}
            >
                <StyledView className="flex-1 justify-center items-center bg-black/50">
                    <StyledView className="bg-white w-[85%] rounded-2xl overflow-hidden">
                        {/* Alert Header */}
                        <StyledView 
                            className={`p-4 items-center ${
                                alertConfig.type === 'success' ? 'bg-[#4CAF50]' : 'bg-[#BC4A4D]'
                            }`}
                        >
                            <StyledView className="w-12 h-12 rounded-full bg-white/20 justify-center items-center mb-2">
                                <Ionicons 
                                    name={alertConfig.type === 'success' ? 'checkmark' : 'alert-circle'} 
                                    size={28} 
                                    color="white" 
                                />
                            </StyledView>
                            <StyledText className="text-white text-xl font-bold">
                                {alertConfig.title}
                            </StyledText>
                        </StyledView>

                        {/* Alert Message */}
                        <StyledView className="p-6">
                            <StyledText className="text-[#333] text-base text-center mb-6">
                                {alertConfig.message}
                            </StyledText>

                            {/* Alert Button */}
                            <StyledTouchableOpacity
                                className={`py-3 rounded-xl ${
                                    alertConfig.type === 'success' ? 'bg-[#4CAF50]' : 'bg-[#BC4A4D]'
                                }`}
                                onPress={() => {
                                    setAlertVisible(false);
                                    if (alertConfig.type === 'success') {
                                        router.replace('/profile');
                                    }
                                }}
                            >
                                <StyledText className="text-white text-base font-semibold text-center">
                                    {alertConfig.type === 'success' ? 'Continue' : 'Try Again'}
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </Modal>
        </>
    );
};

export default DasherApplication;