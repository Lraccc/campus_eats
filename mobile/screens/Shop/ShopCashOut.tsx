import React, { useState, useEffect, useRef } from 'react';
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
  TextInput,
  Image,
  Platform,
  Animated,
  Modal
} from 'react-native';
import { router } from 'expo-router';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import axios from 'axios';
import { API_URL } from '../../config';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { styled } from 'nativewind';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledTextInput = styled(TextInput);

interface Transaction {
  id: string;
  amount: number;
  status: string; // pending, accepted, declined
  createdAt: string;
  paidAt?: string;
  referenceNumber?: string;
  gcashName: string;
  gcashNumber: string;
}

export default function ShopCashOut() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [processingCashout, setProcessingCashout] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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

  useEffect(() => {
    fetchShopInfo();
    fetchTransactions();
    requestPermissions();
  }, []);
  
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload your GCash QR code!');
      }
    }
  };

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
      return response.data;
    } catch (error) {
      console.error('Error fetching shop info:', error);
      Alert.alert('Error', 'Failed to load shop information');
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      
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
      
      // Fetch all cashouts related to this shop user
      const response = await axios.get(`${API_URL}/api/cashouts/user/${userId}`, config);
      
      if (response.data && Array.isArray(response.data)) {
        // Sort transactions by date (newest first)
        const sortedTransactions = response.data.sort((a: Transaction, b: Transaction) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        setTransactions(sortedTransactions);
        return sortedTransactions;
      } else {
        setTransactions([]);
        return [];
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchShopInfo(), fetchTransactions()])
      .finally(() => setRefreshing(false));
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        setQrImage(selectedAsset.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };
  
  const handleCashout = async () => {
    if (!cashoutAmount || parseFloat(cashoutAmount) <= 0) {
      setErrorMessage('Please enter a valid amount to cash out');
      setShowErrorModal(true);
      return;
    }

    const amount = parseFloat(cashoutAmount);
    if (shopInfo && amount > shopInfo.wallet) {
      setErrorMessage('The amount exceeds your available balance');
      setShowErrorModal(true);
      return;
    }

    // Validate GCash information
    if (!shopInfo.gcashName || !shopInfo.gcashNumber) {
      setErrorMessage('Please update your shop profile with complete GCash details before cashing out.');
      setShowErrorModal(true);
      return;
    }

    if (!shopInfo.gcashNumber.startsWith('9') || shopInfo.gcashNumber.length !== 10) {
      setErrorMessage('Your shop profile has an invalid GCash number format. Please update your shop profile first.');
      setShowErrorModal(true);
      return;
    }
    
    // Require QR code image upload
    if (!qrImage) {
      setErrorMessage('Please upload your GCash QR code image before cashing out.');
      setShowErrorModal(true);
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

      // Create cashout data object
      const cashout = {
        gcashName: shopInfo.gcashName,
        gcashNumber: shopInfo.gcashNumber,
        amount: amount,
        status: 'pending'
      };

      // Prepare the QR image file
      const fileInfo = await FileSystem.getInfoAsync(qrImage);
      if (!fileInfo.exists) {
        Alert.alert('Error', 'Image file does not exist');
        setProcessingCashout(false);
        return;
      }
      
      // Create form data for multipart request
      const formData = new FormData();
      formData.append('cashout', JSON.stringify(cashout));
      
      // Add the image file to the form data
      const fileName = qrImage.split('/').pop() || 'qr_image.jpg';
      const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
      
      // @ts-ignore - FormData typing issue in React Native
      formData.append('image', {
        uri: qrImage,
        name: fileName,
        type: mimeType,
      });
      
      formData.append('userId', userId);

      const config = { 
        headers: { 
          Authorization: token,
          'Content-Type': 'multipart/form-data'
        } 
      };

      // Use the correct cashout endpoint
      const response = await axios.post(`${API_URL}/api/cashouts/create`, formData, config);
      
      // After successful cashout request, refresh transactions
      await fetchTransactions();

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error processing cashout:', error);
      setErrorMessage('Failed to process cashout request. Please make sure your shop has a valid GCash QR code set up.');
      setShowErrorModal(true);
    } finally {
      setProcessingCashout(false);
    }
  };

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
          <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
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
                    <Image
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
            
            {/* QR Code Image Upload */}
            <StyledText className="text-sm font-medium text-gray-700 mb-2">GCash QR Code</StyledText>
            <StyledTouchableOpacity 
              onPress={pickImage}
              disabled={processingCashout}
              className="border-2 border-dashed border-gray-300 rounded-xl p-4 mb-5 items-center justify-center"
              style={{
                minHeight: 150,
                backgroundColor: qrImage ? 'transparent' : '#f9fafb'
              }}
            >
              {qrImage ? (
                <Image 
                  source={{ uri: qrImage }} 
                  className="rounded-xl" 
                  style={{ width: '100%', height: 200 }} 
                  resizeMode="contain"
                />
              ) : (
                <StyledView className="items-center">
                  <Ionicons name="qr-code-outline" size={48} color="#9CA3AF" />
                  <StyledText className="text-gray-500 mt-2 text-center">
                    Tap to upload your GCash QR code image
                  </StyledText>
                </StyledView>
              )}
            </StyledTouchableOpacity>

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
              <StyledTouchableOpacity onPress={fetchTransactions} disabled={loadingTransactions}>
                {loadingTransactions ? (
                  <ActivityIndicator size="small" color="#BC4A4D" />
                ) : (
                  <StyledText className="text-sm font-medium text-[#BC4A4D]">Refresh</StyledText>
                )}
              </StyledTouchableOpacity>
            </StyledView>

            {transactions.length > 0 ? (
              <StyledView>
                {transactions.slice(0, 5).map((transaction, index) => (
                  <StyledView 
                    key={transaction.id || index}
                    className="bg-white rounded-xl p-4 mb-3"
                    style={{
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 6,
                      elevation: 2,
                    }}
                  >
                    <StyledView className="flex-row justify-between items-center mb-2">
                      <StyledView className="flex-row items-center">
                        <StyledView 
                          className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                            transaction.status === 'pending' ? 'bg-amber-100' : 
                            transaction.status === 'accepted' ? 'bg-green-100' : 'bg-red-100'
                          }`}
                        >
                          <MaterialIcons 
                            name={transaction.status === 'pending' ? 'hourglass-empty' : 
                                  transaction.status === 'accepted' ? 'check-circle' : 'cancel'} 
                            size={20} 
                            color={transaction.status === 'pending' ? '#D97706' : 
                                  transaction.status === 'accepted' ? '#059669' : '#DC2626'} 
                          />
                        </StyledView>
                        <StyledView>
                          <StyledText className="text-base font-bold text-gray-800">
                            Cash Out {transaction.status === 'accepted' ? '(Completed)' : 
                                    transaction.status === 'pending' ? '(Pending)' : '(Declined)'}
                          </StyledText>
                          <StyledText className="text-xs text-gray-500">
                            {new Date(transaction.createdAt).toLocaleString()}
                          </StyledText>
                        </StyledView>
                      </StyledView>
                      <StyledText 
                        className={`text-base font-bold ${transaction.status === 'accepted' ? 'text-green-600' : 'text-red-600'}`}
                      >
                        -₱{transaction.amount.toFixed(2)}
                      </StyledText>
                    </StyledView>
                    
                    {transaction.status === 'accepted' && transaction.referenceNumber && (
                      <StyledView className="bg-gray-50 rounded-lg p-3 mt-1">
                        <StyledText className="text-xs text-gray-500">
                          Ref: {transaction.referenceNumber}
                        </StyledText>
                        {transaction.paidAt && (
                          <StyledText className="text-xs text-gray-500">
                            Paid: {new Date(transaction.paidAt).toLocaleString()}
                          </StyledText>
                        )}
                      </StyledView>
                    )}
                  </StyledView>
                ))}
                
                {transactions.length > 5 && (
                  <StyledTouchableOpacity 
                    className="py-3 items-center"
                    onPress={() => Alert.alert('Coming Soon', 'Full transaction history will be available in a future update.')}
                  >
                    <StyledText className="text-sm font-medium text-[#BC4A4D]">
                      View All ({transactions.length}) Transactions
                    </StyledText>
                  </StyledTouchableOpacity>
                )}
              </StyledView>
            ) : (
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
                {loadingTransactions ? (
                  <ActivityIndicator size="large" color="#BC4A4D" />
                ) : (
                  <>
                    <StyledView className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
                      <MaterialIcons name="receipt-long" size={28} color="#999" />
                    </StyledView>
                    <StyledText className="text-base font-medium text-gray-800 mb-1">No transactions yet</StyledText>
                    <StyledText className="text-sm text-gray-500 text-center">
                      Your transaction history will appear here once you make a cash out request
                    </StyledText>
                  </>
                )}
              </StyledView>
            )}
          </StyledView>
        </StyledScrollView>

        {/* Success Modal */}
        <Modal
          visible={showSuccessModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowSuccessModal(false);
            setCashoutAmount('');
            setQrImage(null);
            fetchShopInfo();
          }}
        >
          <StyledView className="flex-1 justify-center items-center bg-black/50 px-5">
            <StyledView
              className="bg-white rounded-3xl p-6 w-full max-w-sm"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <StyledView className="items-center mb-6">
                <StyledView className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
                  <Ionicons name="checkmark-circle" size={48} color="#059669" />
                </StyledView>
                <StyledText className="text-xl font-bold text-gray-900 mb-2 text-center">
                  Cashout Requested
                </StyledText>
                <StyledText className="text-base text-gray-600 text-center leading-5">
                  Your cashout request has been submitted successfully. Please allow 1-3 business days for processing.
                </StyledText>
              </StyledView>

              <StyledTouchableOpacity
                className="bg-[#BC4A4D] rounded-xl py-4 items-center"
                onPress={() => {
                  setShowSuccessModal(false);
                  setCashoutAmount('');
                  setQrImage(null);
                  fetchShopInfo();
                }}
                style={{
                  shadowColor: "#BC4A4D",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <StyledText className="text-white font-bold text-base">Got it</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          </StyledView>
        </Modal>

        {/* Error Modal */}
        <Modal
          visible={showErrorModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowErrorModal(false)}
        >
          <StyledView className="flex-1 justify-center items-center bg-black/50 px-5">
            <StyledView
              className="bg-white rounded-3xl p-6 w-full max-w-sm"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <StyledView className="items-center mb-6">
                <StyledView className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4">
                  <Ionicons name="alert-circle" size={48} color="#DC2626" />
                </StyledView>
                <StyledText className="text-xl font-bold text-gray-900 mb-2 text-center">
                  Error
                </StyledText>
                <StyledText className="text-base text-gray-600 text-center leading-5">
                  {errorMessage}
                </StyledText>
              </StyledView>

              <StyledTouchableOpacity
                className="bg-[#BC4A4D] rounded-xl py-4 items-center"
                onPress={() => setShowErrorModal(false)}
                style={{
                  shadowColor: "#BC4A4D",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <StyledText className="text-white font-bold text-base">Close</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          </StyledView>
        </Modal>
      </StyledSafeAreaView>
  );
}