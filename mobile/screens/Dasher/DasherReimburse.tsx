import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from "axios";
import * as ImagePicker from 'expo-image-picker';
import { router } from "expo-router";
import { styled } from "nativewind";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import BottomNavigation from "../../components/BottomNavigation";
import { API_URL } from "../../config";
import { useAuthentication } from "../../services/authService";

export const unstable_settings = { headerShown: false };

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledTextInput = styled(TextInput);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledModal = styled(require("react-native").Modal);

interface NoShowOrder {
  id: string;
  totalPrice: number;
  createdAt: string;
}

interface ReimburseRequestPayload {
  gcashName: string;
  gcashNumber: string;
  amount: number;
  orderId: string;
  dasherId: string;
  gcashQr: string | null;
  locationProof: string | null;
  noShowProof: string | null;
}

const DasherReimburse = () => {
  const { authState } = useAuthentication();
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [noShowOrders, setNoShowOrders] = useState<NoShowOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<NoShowOrder | null>(null);
  const [amountToReceive, setAmountToReceive] = useState(0);
  const [gcashQr, setGcashQr] = useState<string | null>(null);
  const [locationProof, setLocationProof] = useState<string | null>(null);
  const [noShowProof, setNoShowProof] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [imageBase64s, setImageBase64s] = useState<{
    gcashQr: string | null;
    locationProof: string | null;
    noShowProof: string | null;
  }>({
    gcashQr: null,
    locationProof: null,
    noShowProof: null
  });

  // Hard-coded themed Alert modal (like Order.tsx)
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string>('');
  const [alertMessage, setAlertMessage] = useState<string>('');

  useEffect(() => {
    const loadUserId = async () => {
      const storedUserId = await AsyncStorage.getItem('userId');
      setUserId(storedUserId);
    };
    loadUserId();
  }, []);

  const openAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const fetchDasherData = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API_URL}/api/dashers/${userId}`);
      const data = response.data;
      setGcashName(data.gcashName || "");
      setGcashNumber(data.gcashNumber || "");
    } catch (error: any) {
      console.error("Error fetching dasher data:", error);
      openAlert("Error", "Failed to fetch dasher data.");
    }
  };

  const fetchNoShowOrders = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API_URL}/api/orders/dasher/no-show-orders/${userId}`);
      const data: NoShowOrder[] = response.data;
      setNoShowOrders(data);
    } catch (error: any) {
      console.error("Error fetching no-show orders:", error);
      openAlert("Error", "Failed to fetch no-show orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchDasherData();
      fetchNoShowOrders();
    }
  }, [userId]);

  const handleOrderChange = (orderId: string) => {
    const selected = noShowOrders.find(order => order.id === orderId);
    setSelectedOrder(selected || null);
    setAmountToReceive(selected ? selected.totalPrice + 5 : 0);
  };

  const handleImagePick = async (type: 'gcashQr' | 'locationProof' | 'noShowProof') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        openAlert('Permission Required', 'Please grant permission to access your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (type === 'gcashQr') {
          setGcashQr(asset.uri);
          setImageBase64s(prev => ({ ...prev, gcashQr: asset.base64 || null }));
        } else if (type === 'locationProof') {
          setLocationProof(asset.uri);
          setImageBase64s(prev => ({ ...prev, locationProof: asset.base64 || null }));
        } else {
          setNoShowProof(asset.uri);
          setImageBase64s(prev => ({ ...prev, noShowProof: asset.base64 || null }));
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      openAlert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!userId) {
      openAlert("Error", "User ID not found. Please try logging in again.");
      return;
    }

    if (!selectedOrder) {
      openAlert("Action Needed", "Please select an order.");
      return;
    }

    if (!gcashName || !gcashNumber || !imageBase64s.gcashQr || !imageBase64s.locationProof || !imageBase64s.noShowProof) {
      openAlert("Action Needed", "Please fill in all fields and upload all required images.");
      return;
    }

    const reimburse: ReimburseRequestPayload = {
      gcashName,
      gcashNumber,
      amount: selectedOrder.totalPrice,
      orderId: selectedOrder.id,
      dasherId: userId!,
      gcashQr: imageBase64s.gcashQr,
      locationProof: imageBase64s.locationProof,
      noShowProof: imageBase64s.noShowProof,
    };

    try {
      const response = await axios.post(`${API_URL}/api/reimburses/create`, reimburse);
      console.log("Reimburse response:", response.status);
      openAlert("Success", "Reimbursement request submitted successfully!");
      router.back();
    } catch (error: any) {
      console.error("Error submitting reimbursement:", error);
      openAlert("Error", error.response?.data?.message || "Failed to submit reimbursement request.");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
      <StyledScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <StyledView className="bg-[#FFFAF1] rounded-lg p-4 mb-4" style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}>
          <StyledView className="mb-4 items-center">
            <StyledText className="text-lg font-bold text-center text-[#8B4513]">Request for Reimbursement</StyledText>
            <StyledText className="text-sm text-[#8B4513] text-center mt-1">
              It may take up to 3-5 business days for the amount to be reflected in your GCASH account.
            </StyledText>
          </StyledView>

          {loading ? (
            <ActivityIndicator size="large" color="#BC4A4D" style={{ marginTop: 50 }} />
          ) : (
            <StyledView className="mt-2">
              <StyledView className="mb-3">
                <StyledText className="text-[15px] font-bold mb-1 text-[#8B4513]">Select Order</StyledText>
                {/* TODO: Replace with Picker */}
                {noShowOrders.length > 0 ? (
                  <StyledText className="text-[#8B4513]/70">Picker Placeholder - {noShowOrders.length} orders available</StyledText>
                ) : (
                  <StyledText className="text-[#8B4513]/70">No no-show orders available for reimbursement.</StyledText>
                )}
              </StyledView>

              <StyledView className="mb-3">
                <StyledText className="text-[15px] font-bold mb-1 text-[#8B4513]">Amount to receive</StyledText>
                <StyledTextInput
                  className="border border-[#ccc] rounded-md p-2 text-base bg-white"
                  value={`₱${amountToReceive.toFixed(2)} + ₱5 (Inconvenience Fee)`}
                  editable={false}
                />
              </StyledView>

              <StyledView className="mb-3">
                <StyledText className="text-[15px] font-bold mb-1 text-[#8B4513]">Proof of Location Arrival</StyledText>
                <StyledTouchableOpacity className="bg-white p-2 rounded-lg items-center mb-2 border border-[#ddd] border-dashed" onPress={() => handleImagePick('locationProof')}>
                  <StyledText className="text-base text-[#666]">Upload Image</StyledText>
                </StyledTouchableOpacity>
                {locationProof && (
                  <StyledImage source={{ uri: locationProof }} style={{ width: 100, height: 100, alignSelf: 'center', borderRadius: 8 }} resizeMode="contain" />
                )}
              </StyledView>

              <StyledView className="mb-3">
                <StyledText className="text-[15px] font-bold mb-1 text-[#8B4513]">Proof of Attempt</StyledText>
                <StyledTouchableOpacity className="bg-white p-2 rounded-lg items-center mb-2 border border-[#ddd] border-dashed" onPress={() => handleImagePick('noShowProof')}>
                  <StyledText className="text-base text-[#666]">Upload Image</StyledText>
                </StyledTouchableOpacity>
                {noShowProof && (
                  <StyledImage source={{ uri: noShowProof }} style={{ width: 100, height: 100, alignSelf: 'center', borderRadius: 8 }} resizeMode="contain" />
                )}
              </StyledView>

              <StyledView className="mb-3">
                <StyledText className="text-[15px] font-bold mb-1 text-[#8B4513]">GCASH Name</StyledText>
                <StyledTextInput
                  className="border border-[#ccc] rounded-md p-2 text-base bg-white"
                  placeholder="GCASH Name"
                  value={gcashName}
                  onChangeText={setGcashName}
                />
              </StyledView>

              <StyledView className="mb-3">
                <StyledText className="text-[15px] font-bold mb-1 text-[#8B4513]">GCASH Number</StyledText>
                <StyledView className="flex-row items-center border border-[#ccc] rounded-md mb-3 px-2 bg-white">
                  <StyledText className="text-base text-[#8B4513] mr-1">+63</StyledText>
                  <StyledTextInput
                    className="flex-1 py-2 text-base"
                    placeholder="GCASH Number"
                    value={gcashNumber}
                    onChangeText={setGcashNumber}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </StyledView>
              </StyledView>

              <StyledView className="mb-3">
                <StyledText className="text-[15px] font-bold mb-1 text-[#8B4513]">GCASH Personal QR Code</StyledText>
                <StyledTouchableOpacity className="bg-white p-2 rounded-lg items-center mb-2 border border-[#ddd] border-dashed" onPress={() => handleImagePick('gcashQr')}>
                  <StyledText className="text-base text-[#666]">Upload Image</StyledText>
                </StyledTouchableOpacity>
                {gcashQr && (
                  <StyledImage source={{ uri: gcashQr }} style={{ width: 100, height: 100, alignSelf: 'center', borderRadius: 8 }} resizeMode="contain" />
                )}
              </StyledView>

              <StyledTouchableOpacity
                className="bg-[#BC4A4D] py-4 px-6 rounded-xl self-center mt-4"
                style={{
                  shadowColor: "#BC4A4D",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
                onPress={handleSubmit}
              >
                <StyledText className="text-white text-lg font-bold">Submit Reimbursement Request</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          )}
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

export default DasherReimburse;