import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from "axios";
import * as ImagePicker from 'expo-image-picker';
import { router } from "expo-router";
import { styled } from 'nativewind';
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from "react-native";
import BottomNavigation from '../../components/BottomNavigation';
import { API_URL, AUTH_TOKEN_KEY } from "../../config";
import { useAuthentication } from "../../services/authService";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledTextInput = styled(TextInput);
const StyledModal = styled(require("react-native").Modal);

interface DasherApplicationPayload {
  daysAvailable: string[];
  availableStartTime: string;
  availableEndTime: string;
  gcashName: string;
  gcashNumber: string;
  image?: string;
  userId: string;
}

interface DaysAvailability {
  MON: boolean;
  TUE: boolean;
  WED: boolean;
  THU: boolean;
  FRI: boolean;
  SAT: boolean;
  SUN: boolean;
}

interface ApplicationRequestPayload {
  gcashName: string;
  gcashNumber: string;
  dasherId: string;
  gcashQr: string | null;
}

const DasherUpdate = () => {
  const { authState } = useAuthentication();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<any>(null);
  const [availableStartTime, setAvailableStartTime] = useState("");
  const [availableEndTime, setAvailableEndTime] = useState("");
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashQr, setGcashQr] = useState<string | null>(null);
  const [days, setDays] = useState<DaysAvailability>({
    MON: false,
    TUE: false,
    WED: false,
    THU: false,
    FRI: false,
    SAT: false,
    SUN: false,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Hard-coded themed Alert modal state (like Order.tsx)
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string>('');
  const [alertMessage, setAlertMessage] = useState<string>('');

  useEffect(() => {
    const getUserData = async () => {
      try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (token) {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            const id = payload.sub || payload.oid || payload.userId || payload.id;
            setUserId(id);
          }
        }
      } catch (err) {
        console.error('Error getting user data:', err);
      }
    };
    getUserData();
  }, []);

  const fetchDasherData = async () => {
    if (!userId) return;
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) return;

      const response = await axios.get(`${API_URL}/api/dashers/${userId}`, {
        headers: { 'Authorization': token }
      });
      const data = response.data;
      setGcashName(data.gcashName || "");
      setGcashNumber(data.gcashNumber || "");
      setAvailableStartTime(data.availableStartTime);
      setAvailableEndTime(data.availableEndTime);
      setDays((prevDays) => {
        const updatedDays = { ...prevDays };
        data.daysAvailable.forEach((day: string) => {
          updatedDays[day as keyof typeof updatedDays] = true;
        });
        return updatedDays;
      });
      setUploadedImage(data.schoolId);
    } catch (error: any) {
      console.error("Error fetching dasher data:", error);
      setAlertTitle("Error");
      setAlertMessage("Failed to fetch dasher data.");
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchDasherData();
    }
  }, [userId]);

  const handleImagePick = async () => {
    try {
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
    } catch (error) {
      console.error('Error picking image:', error);
      setAlertTitle("Error");
      setAlertMessage("Failed to pick image. Please try again.");
      setAlertVisible(true);
    }
  };

  const handleDaySelect = (day: keyof DaysAvailability) => {
    setDays({
      ...days,
      [day]: !days[day],
    });
  };

  const handleSubmit = async () => {
    if (!userId) {
      setAlertTitle("Error");
      setAlertMessage("User ID not found. Please try logging in again.");
      setAlertVisible(true);
      return;
    }

    if (!gcashName || !gcashNumber || !imageFile) {
      setAlertTitle("Error");
      setAlertMessage("Please fill in all fields and upload GCash QR code.");
      setAlertVisible(true);
      return;
    }

    if (gcashNumber.length !== 10 || !gcashNumber.startsWith('9')) {
      setAlertTitle("Error");
      setAlertMessage("Please provide a valid GCASH Number.");
      setAlertVisible(true);
      return;
    }

    if (availableStartTime >= availableEndTime) {
      setAlertTitle("Error");
      setAlertMessage("Available end time must be later than start time.");
      setAlertVisible(true);
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) return;

      const formData = new FormData();
      const dasher: DasherApplicationPayload = {
        availableStartTime,
        availableEndTime,
        gcashName,
        gcashNumber,
        daysAvailable: Object.keys(days).filter(day => days[day as keyof typeof days]),
        userId,
      };

      formData.append('dasher', JSON.stringify(dasher));
      if (imageFile) {
        formData.append('image', {
          uri: imageFile.uri,
          type: 'image/jpeg',
          name: 'schoolId.jpg'
        } as any);
      }
      formData.append('userId', userId);

      const response = await axios.put(`${API_URL}/api/dashers/update/${userId}`, formData, {
        headers: {
          'Authorization': token,
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log("Application response: ", response);
      setAlertTitle("Success");
      setAlertMessage("Profile updated successfully!");
      setAlertVisible(true);
      router.push('/profile');
    } catch (error: any) {
      console.error("Error updating dasher:", error);
      setAlertTitle("Error");
      setAlertMessage(error.response?.data?.error || "Failed to update profile.");
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
      <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
      <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <StyledView className="flex-1 px-5 pt-12 pb-24">
          <StyledView className="mb-6">
            <StyledView className="bg-white px-6 py-8 border-b border-[#f0f0f0]">
              <StyledView className="items-center mb-4">
                <StyledView className="w-9 h-9 rounded-full bg-[#f8f8f8] justify-center items-center mb-4 border-2 border-[#f0f0f0]">
                  <Ionicons name="bicycle-outline" size={30} color="#BC4A4D" />
                </StyledView>
                <StyledText className="text-2xl font-bold text-[#8B4513] text-center">Update Dasher Information</StyledText>
              </StyledView>
            </StyledView>
          </StyledView>

          <StyledView
            className="bg-white rounded-2xl p-6 mb-6"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.08,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <StyledView className="mb-4">
              <StyledText className="text-base font-bold text-[#8B4513] mb-2">GCASH Name</StyledText>
              <StyledTextInput
                className="border border-gray-300 rounded-lg p-3 text-base"
                placeholder="GCASH Name"
                value={gcashName}
                onChangeText={setGcashName}
              />
            </StyledView>

            <StyledView className="mb-4">
              <StyledText className="text-base font-bold text-[#8B4513] mb-2">GCASH Number</StyledText>
              <StyledView className="flex-row items-center border border-gray-300 rounded-lg px-3">
                <StyledText className="text-base text-gray-700 mr-2">+63</StyledText>
                <StyledTextInput
                  className="flex-1 py-3 text-base"
                  placeholder="GCASH Number"
                  value={gcashNumber}
                  onChangeText={setGcashNumber}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </StyledView>
            </StyledView>

            <StyledView className="mb-4">
              <StyledText className="text-base font-bold text-[#8B4513] mb-2">Start of Available Time</StyledText>
              <StyledTextInput
                className="border border-gray-300 rounded-lg p-3 text-base"
                placeholder="HH:mm"
                value={availableStartTime}
                onChangeText={setAvailableStartTime}
              />
            </StyledView>

            <StyledView className="mb-4">
              <StyledText className="text-base font-bold text-[#8B4513] mb-2">End of Available Time</StyledText>
              <StyledTextInput
                className="border border-gray-300 rounded-lg p-3 text-base"
                placeholder="HH:mm"
                value={availableEndTime}
                onChangeText={setAvailableEndTime}
              />
            </StyledView>

            <StyledView className="mb-4">
              <StyledText className="text-base font-bold text-[#8B4513] mb-2">School ID</StyledText>
              <StyledTouchableOpacity
                className="bg-gray-100 py-3 rounded-lg items-center mb-3"
                onPress={handleImagePick}
              >
                <StyledText className="text-base text-gray-700">Upload School ID Image</StyledText>
              </StyledTouchableOpacity>
              {uploadedImage && (
                <StyledImage
                  source={{ uri: uploadedImage }}
                  className="w-24 h-24 self-center"
                  resizeMode="contain"
                />
              )}
            </StyledView>

            <StyledView className="mb-4">
              <StyledText className="text-base font-bold text-gray-900 mb-2">Days Available</StyledText>
              <StyledView className="flex-row flex-wrap justify-center">
                {Object.keys(days).map((day) => (
                  <StyledTouchableOpacity
                    key={day}
                    className={`py-2.5 px-4 rounded-full m-1.5 border ${
                      days[day as keyof DaysAvailability]
                        ? 'bg-[#BC4A4D] border-[#BC4A4D]'
                        : 'border-gray-300'
                    }`}
                    onPress={() => handleDaySelect(day as keyof DaysAvailability)}
                  >
                    <StyledText
                      className={`text-sm ${
                        days[day as keyof DaysAvailability]
                          ? 'text-white'
                          : 'text-gray-700'
                      }`}
                    >
                      {day}
                    </StyledText>
                  </StyledTouchableOpacity>
                ))}
              </StyledView>
            </StyledView>

            <StyledTouchableOpacity
              className="bg-[#BC4A4D] py-4 rounded-xl items-center mt-6"
              onPress={handleSubmit}
              disabled={loading}
              style={{
                shadowColor: "#BC4A4D",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <StyledText className="text-white text-lg font-bold">
                  Submit Application
                </StyledText>
              )}
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>
      </StyledScrollView>

      {/* Global Themed Alert Modal (hard-coded, like in Order.tsx) */}
      <StyledModal
        animationType="fade"
        transparent={true}
        visible={alertVisible}
        onRequestClose={() => setAlertVisible(false)}
        statusBarTranslucent={true}
      >
        <StyledView className="flex-1 bg-black/50 justify-center items-center px-4">
          <StyledView
            className="bg-white rounded-3xl p-8 w-[90%] max-w-[400px]"
            style={{
              shadowColor: "#8B4513",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <StyledView className="items-center mb-4">
              <StyledView
                className="w-16 h-16 rounded-full justify-center items-center mb-2"
                style={{ backgroundColor: '#DFD6C5' }}
              >
                <Ionicons name="alert-circle" size={42} color="#BC4A4D" />
              </StyledView>
              <StyledText className="text-xl font-bold text-[#8B4513] mt-1">
                {alertTitle || 'Notice'}
              </StyledText>
              <StyledText className="text-sm text-[#8B4513]/70 text-center mt-2">
                {alertMessage}
              </StyledText>
            </StyledView>

            <StyledTouchableOpacity
              className="bg-[#BC4A4D] py-4 px-6 rounded-2xl mt-2"
              style={{
                shadowColor: "#BC4A4D",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              onPress={() => setAlertVisible(false)}
            >
              <StyledText className="text-base font-bold text-white text-center">
                OK
              </StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>
      </StyledModal>

      <BottomNavigation activeTab="Profile" />
    </StyledSafeAreaView>
  );
};

export default DasherUpdate;