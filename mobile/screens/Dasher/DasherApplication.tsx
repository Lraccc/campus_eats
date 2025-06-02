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
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthentication } from '../../services/authService';
import { styled } from "nativewind";

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)
const StyledTextInput = styled(TextInput)

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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [days, setDays] = useState<DaysState>({
        MON: false,
        TUE: false,
        WED: false,
        THU: false,
        FRI: false,
        SAT: false,
        SUN: false,
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

    const handleSubmit = async () => {
        const hasCategorySelected = Object.values(days).some(selected => selected);

        if (!hasCategorySelected) {
            Alert.alert('Selection Required', 'Please select at least one day.');
            return;
        }

        if (!uploadedImage) {
            Alert.alert('Image Required', 'Please upload a school ID image.');
            return;
        }

        if (!GCASHNumber.startsWith('9') || GCASHNumber.length !== 10) {
            Alert.alert('Invalid Number', 'Please enter a valid GCASH number.');
            return;
        }

        // Convert times to 24-hour format for comparison
        const startHour = parseInt(availableStartTime.split(':')[0]);
        const endHour = parseInt(availableEndTime.split(':')[0]);

        const startTime24 = startTimePeriod === 'PM' && startHour !== 12 ? startHour + 12 : startHour;
        const endTime24 = endTimePeriod === 'PM' && endHour !== 12 ? endHour + 12 : endHour;

        if (startTime24 > endTime24 || (startTime24 === endTime24 && availableStartTime >= availableEndTime)) {
            Alert.alert('Invalid Time', 'Available end time must be later than start time.');
            return;
        }

        setIsSubmitting(true);

        try {
            const token = await getAccessToken();
            if (!token) {
                Alert.alert('Error', 'Authentication token missing. Please log in again.');
                return;
            }

            const selectedDays = Object.keys(days).filter(day => days[day as DayType]) as DayType[];
            const dasher = {
                daysAvailable: selectedDays,
                availableStartTime: `${availableStartTime} ${startTimePeriod}`,
                availableEndTime: `${availableEndTime} ${endTimePeriod}`,
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
                Alert.alert(
                    'Success',
                    'Dasher Application Submitted Successfully',
                    [{ text: 'OK', onPress: () => router.replace('/profile') }]
                );
            }
        } catch (error: any) {
            console.error('Error submitting form:', error);
            Alert.alert(
                'Error',
                error.response?.data || 'Error submitting form. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const dayLabels: Record<DayType, string> = {
        MON: 'Monday',
        TUE: 'Tuesday',
        WED: 'Wednesday',
        THU: 'Thursday',
        FRI: 'Friday',
        SAT: 'Saturday',
        SUN: 'Sunday'
    };

    return (
        <StyledView className="flex-1 bg-[#fae9e0]">
            <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
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
                            <StyledText className="text-xl font-bold text-[#333]">Dasher Application</StyledText>
                        </StyledView>
                        <StyledView className="w-10 h-10 rounded-full bg-[#f8f8f8] justify-center items-center">
                            <Ionicons name="bicycle-outline" size={20} color="#BC4A4D" />
                        </StyledView>
                    </StyledView>
                </StyledView>

                {/* Welcome Section */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="items-center">
                        <StyledView className="w-16 h-16 rounded-full bg-[#f8f8f8] justify-center items-center mb-4 border-2 border-[#f0f0f0]">
                            <Ionicons name="bicycle-outline" size={28} color="#BC4A4D" />
                        </StyledView>
                        <StyledText className="text-lg font-bold text-[#333] text-center">Join Our Delivery Team</StyledText>
                        <StyledText className="text-sm text-[#666] text-center mt-2 leading-6">
                            Partner with CampusEats to help drive growth and take your business to the next level.
                        </StyledText>
                    </StyledView>
                </StyledView>

                {/* Payment Information */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="card-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Payment Information</StyledText>
                    </StyledView>

                    <StyledView className="mb-6">
                        <StyledText className="text-base font-semibold text-[#333] mb-3">GCASH Account Name</StyledText>
                        <StyledTextInput
                            className="bg-[#f8f8f8] rounded-2xl px-4 py-4 text-base border border-[#e5e5e5]"
                            value={GCASHName}
                            onChangeText={setGCASHName}
                            placeholder="Enter your GCASH registered name"
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
                                keyboardType="numeric"
                                maxLength={10}
                                style={{ fontSize: 16 }}
                            />
                        </StyledView>
                    </StyledView>
                </StyledView>

                {/* Availability */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="time-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Availability</StyledText>
                    </StyledView>

                    <StyledText className="text-base font-semibold text-[#333] mb-4">Available Hours</StyledText>
                    <StyledView className="space-y-4">
                        {/* Start Time */}
                        <StyledView>
                            <StyledText className="text-sm font-semibold text-[#666] mb-3">Start Time</StyledText>
                            <StyledView className="flex-row items-center space-x-3">
                                <StyledTextInput
                                    className="flex-1 bg-[#f8f8f8] rounded-2xl px-4 py-4 text-base border border-[#e5e5e5]"
                                    value={availableStartTime}
                                    onChangeText={setAvailableStartTime}
                                    placeholder="08:00"
                                    placeholderTextColor="#999"
                                    style={{ fontSize: 16 }}
                                />
                                <StyledView className="flex-row bg-[#f8f8f8] rounded-2xl p-1 border border-[#e5e5e5]">
                                    <StyledTouchableOpacity
                                        className={`px-4 py-3 rounded-xl ${startTimePeriod === 'AM' ? 'bg-[#BC4A4D]' : ''}`}
                                        onPress={() => setStartTimePeriod('AM')}
                                    >
                                        <StyledText className={`font-semibold ${startTimePeriod === 'AM' ? 'text-white' : 'text-[#666]'}`}>
                                            AM
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                    <StyledTouchableOpacity
                                        className={`px-4 py-3 rounded-xl ${startTimePeriod === 'PM' ? 'bg-[#BC4A4D]' : ''}`}
                                        onPress={() => setStartTimePeriod('PM')}
                                    >
                                        <StyledText className={`font-semibold ${startTimePeriod === 'PM' ? 'text-white' : 'text-[#666]'}`}>
                                            PM
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        {/* End Time */}
                        <StyledView>
                            <StyledText className="text-sm font-semibold text-[#666] mb-3">End Time</StyledText>
                            <StyledView className="flex-row items-center space-x-3">
                                <StyledTextInput
                                    className="flex-1 bg-[#f8f8f8] rounded-2xl px-4 py-4 text-base border border-[#e5e5e5]"
                                    value={availableEndTime}
                                    onChangeText={setAvailableEndTime}
                                    placeholder="18:00"
                                    placeholderTextColor="#999"
                                    style={{ fontSize: 16 }}
                                />
                                <StyledView className="flex-row bg-[#f8f8f8] rounded-2xl p-1 border border-[#e5e5e5]">
                                    <StyledTouchableOpacity
                                        className={`px-4 py-3 rounded-xl ${endTimePeriod === 'AM' ? 'bg-[#BC4A4D]' : ''}`}
                                        onPress={() => setEndTimePeriod('AM')}
                                    >
                                        <StyledText className={`font-semibold ${endTimePeriod === 'AM' ? 'text-white' : 'text-[#666]'}`}>
                                            AM
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                    <StyledTouchableOpacity
                                        className={`px-4 py-3 rounded-xl ${endTimePeriod === 'PM' ? 'bg-[#BC4A4D]' : ''}`}
                                        onPress={() => setEndTimePeriod('PM')}
                                    >
                                        <StyledText className={`font-semibold ${endTimePeriod === 'PM' ? 'text-white' : 'text-[#666]'}`}>
                                            PM
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                </StyledView>
                            </StyledView>
                        </StyledView>
                    </StyledView>

                    {/* Days Available */}
                    <StyledView className="mt-6">
                        <StyledText className="text-base font-semibold text-[#333] mb-4">Days Available</StyledText>
                        <StyledView className="space-y-3">
                            {(Object.keys(days) as DayType[]).map((day) => (
                                <StyledTouchableOpacity
                                    key={day}
                                    className={`flex-row items-center justify-between p-4 rounded-2xl border ${
                                        days[day]
                                            ? 'bg-[#BC4A4D] border-[#BC4A4D]'
                                            : 'bg-[#f8f8f8] border-[#e5e5e5]'
                                    }`}
                                    onPress={() => handleCategoryChange(day)}
                                >
                                    <StyledText
                                        className={`text-base font-semibold ${
                                            days[day] ? 'text-white' : 'text-[#333]'
                                        }`}
                                    >
                                        {dayLabels[day]}
                                    </StyledText>
                                    <Ionicons
                                        name={days[day] ? "checkmark-circle" : "ellipse-outline"}
                                        size={20}
                                        color={days[day] ? "white" : "#666"}
                                    />
                                </StyledTouchableOpacity>
                            ))}
                        </StyledView>
                    </StyledView>
                </StyledView>

                {/* School ID Verification */}
                <StyledView className="bg-white mx-6 mt-6 rounded-3xl p-6 shadow-sm">
                    <StyledView className="flex-row items-center mb-6">
                        <Ionicons name="shield-checkmark-outline" size={18} color="#666" />
                        <StyledText className="text-lg font-bold text-[#333] ml-2">Identity Verification</StyledText>
                    </StyledView>

                    <StyledText className="text-base font-semibold text-[#333] mb-4">School ID</StyledText>
                    <StyledTouchableOpacity
                        className="h-48 bg-[#f8f8f8] rounded-3xl border-2 border-dashed border-[#e5e5e5] overflow-hidden"
                        onPress={pickImage}
                    >
                        {uploadedImage ? (
                            <Image source={{ uri: uploadedImage }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                            <StyledView className="flex-1 justify-center items-center">
                                <Ionicons name="cloud-upload-outline" size={48} color="#BC4A4D" />
                                <StyledText className="mt-3 text-[#666] font-semibold">Upload School ID</StyledText>
                                <StyledText className="mt-1 text-sm text-[#999]">Clear photo of your student ID</StyledText>
                            </StyledView>
                        )}
                    </StyledTouchableOpacity>
                </StyledView>

                {/* Action Buttons */}
                <StyledView className="mx-6 mt-8 mb-8 space-y-4">
                    <StyledTouchableOpacity
                        className={`${isSubmitting ? 'bg-[#BC4A4D]/50' : 'bg-[#BC4A4D]'} p-5 rounded-3xl shadow-sm`}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                    >
                        <StyledView className="flex-row items-center justify-center">
                            {isSubmitting ? (
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

                {/* Help Section */}
                <StyledView className="mx-6 mb-8 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <StyledView className="flex-row items-start">
                        <Ionicons name="information-circle-outline" size={20} color="#2196F3" />
                        <StyledView className="flex-1 ml-3">
                            <StyledText className="text-sm text-blue-700 font-semibold mb-1">
                                Application Tips
                            </StyledText>
                            <StyledText className="text-sm text-blue-600 leading-5">
                                • Ensure your GCASH account is verified and active{'\n'}
                                • Upload a clear, readable photo of your school ID{'\n'}
                                • Select realistic availability hours{'\n'}
                                • Applications are reviewed within 24-48 hours
                            </StyledText>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </StyledScrollView>
        </StyledView>
    );
};

export default DasherApplication;