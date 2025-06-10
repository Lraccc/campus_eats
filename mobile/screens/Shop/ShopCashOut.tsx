import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  SafeAreaView,
  StatusBar,
  TextInput
} from 'react-native';
import { router } from 'expo-router';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import axios from 'axios';
import { API_URL } from '../../config';
import { MaterialIcons } from '@expo/vector-icons';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledTextInput = styled(TextInput);

export default function ShopCashOut() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [processingCashout, setProcessingCashout] = useState(false);
  const { getAccessToken } = useAuthentication();

  useEffect(() => {
    fetchShopInfo();
  }, []);

  const fetchShopInfo = async () => {
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        return;
      }

      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error("No user ID available");
        return;
      }

      const config = { headers: { Authorization: token } };
      const response = await axios.get(`${API_URL}/api/shops/${userId}`, config);

      setShopInfo(response.data);
    } catch (error) {
      console.error('Error fetching shop info:', error);
      Alert.alert('Error', 'Failed to load shop information');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchShopInfo();
  }, []);

  const handleCashout = async () => {
    if (!cashoutAmount || parseFloat(cashoutAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to cash out');
      return;
    }

    const amount = parseFloat(cashoutAmount);
    if (shopInfo && amount > shopInfo.wallet) {
      Alert.alert('Insufficient Balance', 'The amount exceeds your available balance');
      return;
    }

    try {
      setProcessingCashout(true);

      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        return;
      }

      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error("No user ID available");
        return;
      }

      const config = { headers: { Authorization: token } };

      await axios.post(`${API_URL}/api/shops/cashout`, {
        shopId: userId,
        amount: amount
      }, config);

      Alert.alert(
          'Cashout Requested',
          'Your cashout request has been submitted successfully. Please allow 1-3 business days for processing.',
          [{ text: 'OK', onPress: () => {
              setCashoutAmount('');
              fetchShopInfo();
            }}]
      );
    } catch (error) {
      console.error('Error processing cashout:', error);
      Alert.alert('Error', 'Failed to process cashout request');
    } finally {
      setProcessingCashout(false);
    }
  };

  if (isLoading) {
    return (
        <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
          <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
          <StyledView className="flex-1 justify-center items-center p-6">
            <StyledView
                className="bg-white p-8 rounded-3xl items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 5,
                }}
            >
              <ActivityIndicator size="large" color="#BC4A4D" />
              <StyledText className="mt-4 text-base font-medium text-gray-800">Loading shop information...</StyledText>
            </StyledView>
          </StyledView>
        </StyledSafeAreaView>
    );
  }

  return (
      <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />

        {/* Header */}
        <StyledView
            className="bg-white py-4 px-6"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 3,
            }}
        >
          <StyledView className="flex-row items-center">
            <StyledTouchableOpacity
                onPress={() => router.back()}
                className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
            >
              <MaterialIcons name="arrow-back" size={22} color="#333" />
            </StyledTouchableOpacity>
            <StyledText className="text-xl font-bold text-gray-900">Cash Out</StyledText>
          </StyledView>
        </StyledView>

        <StyledScrollView
            className="flex-1 px-5 pt-6"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#BC4A4D"]} />
            }
        >
          {/* Balance Card */}
          <StyledView
              className="bg-white rounded-2xl p-6 mb-6 items-center"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.08,
                shadowRadius: 10,
                elevation: 4,
              }}
          >
            <StyledText className="text-base text-gray-600 mb-2">Available Balance</StyledText>
            <StyledText className="text-4xl font-bold text-[#BC4A4D] mb-1">
              ₱{shopInfo?.wallet?.toFixed(2) || '0.00'}
            </StyledText>
            <StyledText className="text-xs text-gray-500">Updated {new Date().toLocaleDateString()}</StyledText>
          </StyledView>

          {/* Cashout Form */}
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
            <StyledText className="text-lg font-bold text-gray-900 mb-4">Request Cash Out</StyledText>

            <StyledText className="text-sm font-medium text-gray-700 mb-2">Amount</StyledText>
            <StyledView className="flex-row items-center border border-gray-200 rounded-xl bg-gray-50 mb-5 overflow-hidden">
              <StyledView className="bg-gray-100 px-4 py-3.5">
                <StyledText className="text-lg font-bold text-gray-800">₱</StyledText>
              </StyledView>
              <StyledTextInput
                  className="flex-1 px-4 py-3.5 text-lg text-gray-800"
                  value={cashoutAmount}
                  onChangeText={setCashoutAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  editable={!processingCashout}
              />
            </StyledView>

            <StyledTouchableOpacity
                className={`bg-[#BC4A4D] rounded-xl py-4 items-center ${processingCashout ? 'opacity-70' : ''}`}
                onPress={handleCashout}
                disabled={processingCashout}
                style={{
                  shadowColor: "#BC4A4D",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.2,
                  shadowRadius: 6,
                  elevation: 3,
                }}
            >
              {processingCashout ? (
                  <ActivityIndicator size="small" color="#FFF" />
              ) : (
                  <StyledText className="text-white text-base font-bold">Request Cash Out</StyledText>
              )}
            </StyledTouchableOpacity>
          </StyledView>

          {/* Info Card */}
          <StyledView
              className="bg-white rounded-2xl p-5 mb-6 flex-row items-start"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
          >
            <StyledView className="w-10 h-10 rounded-full bg-[#BC4A4D]/10 items-center justify-center mr-3">
              <MaterialIcons name="info-outline" size={20} color="#BC4A4D" />
            </StyledView>
            <StyledView className="flex-1">
              <StyledText className="text-base font-bold text-gray-900 mb-1">Processing Time</StyledText>
              <StyledText className="text-sm leading-5 text-gray-600">
                Cash out requests are processed within 1-3 business days. The amount will be transferred to your registered bank account or mobile wallet.
              </StyledText>
            </StyledView>
          </StyledView>

          {/* Transaction History */}
          <StyledView className="mb-8">
            <StyledView className="flex-row justify-between items-center mb-4">
              <StyledText className="text-lg font-bold text-gray-900">Transaction History</StyledText>
              <StyledTouchableOpacity>
                <StyledText className="text-sm font-medium text-[#BC4A4D]">See All</StyledText>
              </StyledTouchableOpacity>
            </StyledView>

            <StyledView
                className="bg-white rounded-2xl p-6 items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                }}
            >
              <StyledView className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
                <MaterialIcons name="receipt-long" size={28} color="#999" />
              </StyledView>
              <StyledText className="text-base font-medium text-gray-800 mb-1">No transactions yet</StyledText>
              <StyledText className="text-sm text-gray-500 text-center">
                Your transaction history will appear here once you make a cash out request
              </StyledText>
            </StyledView>
          </StyledView>
        </StyledScrollView>
      </StyledSafeAreaView>
  );
}