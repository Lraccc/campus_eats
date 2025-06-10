import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Modal,
  Pressable,
  Alert,
  StatusBar,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from '../../components/BottomNavigation';
import axios from 'axios';
import { API_URL, AUTH_TOKEN_KEY } from '../../config';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledModal = styled(Modal);
const StyledPressable = styled(Pressable);

interface TopDasher {
  name: string;
}

export default function DasherHome() {
  const [userName, setUserName] = useState('Dasher');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [topDashers] = useState<TopDasher[]>([
    { name: 'Clint Montemayor' },
    { name: 'Vanessa Capuras' },
    { name: 'Joe Schwarz' },
    { name: 'Brian Pila' },
    { name: 'Carl Tampus' },
    { name: 'John Gadiano' },
  ]);
  const [isDelivering, setIsDelivering] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    // Set time and date
    const updateDateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      setCurrentTime(`${formattedHours}:${formattedMinutes} ${ampm}`);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const dayName = days[now.getDay()];
      const monthName = months[now.getMonth()];
      const date = now.getDate();
      setCurrentDate(`${dayName}, ${monthName} ${date}`);
    };
    updateDateTime();
    const intervalId = setInterval(updateDateTime, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Get user data and status from AsyncStorage
    const getUserData = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          if (userData.firstname && userData.lastname) {
            setUserName(`${userData.firstname} ${userData.lastname}`);
          }
        }

        const storedStatus = await AsyncStorage.getItem('dasherStatus'); // Get stored status
        if (storedStatus !== null) {
          setIsDelivering(storedStatus === 'active');
        }

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
        console.error('Error getting user data or stored status:', err);
      }
    };
    getUserData();
  }, []); // Run only once on mount to get user ID and data

  useFocusEffect(
      useCallback(() => {
        const fetchDasherStatus = async () => {
          if (!userId) {
            console.log('User ID not available, skipping status fetch on focus.');
            setIsDelivering(false); // Ensure status is false if ID is missing
            return; // Only proceed if userId is available
          }

          try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) {
              console.log('Auth token not found, cannot fetch status on focus.');
              setIsDelivering(false); // Ensure status is false if token is missing
              return;
            }

            console.log('Fetching dasher data for user ID on focus:', userId); // Updated logging
            // Fetch dasher data instead of just status
            const response = await axios.get(`${API_URL}/api/dashers/${userId}`, {
              headers: { 'Authorization': token }
            });

            // Assuming the response structure is similar to the web version
            if (response.data && response.data.status) {
              setIsDelivering(response.data.status === 'active');
              await AsyncStorage.setItem('dasherStatus', response.data.status); // Store fetched status
            } else {
              console.error('Dasher status not found in response:', response.data);
              setIsDelivering(false); // Assume offline if status is missing
              await AsyncStorage.setItem('dasherStatus', 'offline'); // Store offline status
            }

          } catch (err) {
            console.error('Error fetching dasher status on focus:', err);
            setIsDelivering(false); // Assume offline on error
          }
        };

        fetchDasherStatus();

      }, [userId]) // Rerun when userId changes
  );

  const handleStartDelivering = async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token || !userId) return;
      await axios.put(`${API_URL}/api/dashers/update/${userId}/status`, null, {
        headers: { 'Authorization': token },
        params: { status: 'active' }
      });
      setIsDelivering(true);
      router.push('/dasher/incoming-orders');
    } catch (error) {
      console.error('Error starting delivery:', error);
      Alert.alert('Error', 'Failed to start delivering. Please try again.');
    }
  };

  const handleStopDelivering = () => {
    setModalVisible(true);
  };

  const confirmStopDelivering = async () => {
    setModalVisible(false);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token || !userId) return;
      await axios.put(`${API_URL}/api/dashers/update/${userId}/status`, null, {
        headers: { 'Authorization': token },
        params: { status: 'inactive' }
      });
      setIsDelivering(false);
    } catch (error) {
      console.error('Error stopping delivery:', error);
      Alert.alert('Error', 'Failed to stop delivering. Please try again.');
    }
  };

  const cancelStopDelivering = () => {
    setModalVisible(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return "Good Midnight";
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  return (
      <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
        <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <StyledView className="flex-1 px-5 pt-12 pb-24">

            {/* Header Section */}
            <StyledView
                className="bg-white rounded-3xl p-6 mb-6 items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 5,
                }}
            >
              <StyledImage
                  source={require('../../assets/images/logo.png')}
                  className="w-20 h-20 mb-4 rounded-full"
              />
              <StyledText className="text-3xl font-black mb-2">
                <StyledText className="text-gray-900">Campus</StyledText>
                <StyledText className="text-[#BC4A4D]">Eats</StyledText>
              </StyledText>
              <StyledText className="text-sm text-gray-600">Dasher Dashboard</StyledText>
            </StyledView>

            {/* Welcome Card */}
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
              <StyledText className="text-lg font-bold text-gray-900 mb-2">
                {getGreeting()}, {userName}! 👋
              </StyledText>
              <StyledView className="items-center mt-4">
                <StyledText className="text-4xl font-black text-gray-900 mb-1">{currentTime}</StyledText>
                <StyledText className="text-base text-gray-600">{currentDate}</StyledText>
              </StyledView>
            </StyledView>

            {/* Status Card */}
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
              <StyledView className="flex-row items-center justify-between mb-4">
                <StyledText className="text-lg font-bold text-gray-900">Delivery Status</StyledText>
                <StyledView className={`px-3 py-1 rounded-full ${isDelivering ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <StyledText className={`text-sm font-bold ${isDelivering ? 'text-green-700' : 'text-gray-600'}`}>
                    {isDelivering ? '🟢 Online' : '🔴 Offline'}
                  </StyledText>
                </StyledView>
              </StyledView>

              <StyledTouchableOpacity
                  className={`py-4 rounded-xl items-center ${isDelivering ? 'bg-red-500' : 'bg-[#BC4A4D]'}`}
                  onPress={isDelivering ? handleStopDelivering : handleStartDelivering}
                  style={{
                    shadowColor: isDelivering ? "#ef4444" : "#BC4A4D",
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.2,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
              >
                <StyledText className="text-white text-lg font-bold">
                  {isDelivering ? 'Stop Delivering' : 'Start Delivering'}
                </StyledText>
              </StyledTouchableOpacity>
            </StyledView>

            {/* Top Dashers Card */}
            <StyledView
                className="bg-white rounded-2xl p-6"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.08,
                  shadowRadius: 10,
                  elevation: 4,
                }}
            >
              <StyledView className="flex-row items-center mb-4">
                <StyledText className="text-lg font-bold text-gray-900 flex-1">Top Dashers</StyledText>
                <StyledText className="text-2xl">🏆</StyledText>
              </StyledView>

              <StyledView className="space-y-3">
                {topDashers.map((dasher, index) => (
                    <StyledView key={index} className="flex-row items-center py-2">
                      <StyledView
                          className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                              index === 0 ? 'bg-yellow-100' : index === 1 ? 'bg-gray-100' : index === 2 ? 'bg-orange-100' : 'bg-gray-50'
                          }`}
                      >
                        <StyledText className={`text-sm font-bold ${
                            index === 0 ? 'text-yellow-600' : index === 1 ? 'text-gray-600' : index === 2 ? 'text-orange-600' : 'text-gray-500'
                        }`}>
                          {index + 1}
                        </StyledText>
                      </StyledView>
                      <StyledText className="text-base font-medium text-gray-900 flex-1">
                        {dasher.name}
                      </StyledText>
                      {index < 3 && (
                          <StyledText className="text-lg">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </StyledText>
                      )}
                    </StyledView>
                ))}
              </StyledView>
            </StyledView>
          </StyledView>
        </StyledScrollView>

        {/* Enhanced Confirmation Modal */}
        <StyledModal
            animationType="fade"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
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
                  <StyledText className="text-3xl">⚠️</StyledText>
                </StyledView>
                <StyledText className="text-xl font-bold text-gray-900 mb-2 text-center">
                  Stop Delivering?
                </StyledText>
                <StyledText className="text-base text-gray-600 text-center leading-5">
                  Are you sure you want to go offline? You won't receive any new delivery requests.
                </StyledText>
              </StyledView>

              <StyledView className="flex-row gap-3">
                <StyledPressable
                    className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
                    onPress={cancelStopDelivering}
                >
                  <StyledText className="text-gray-700 font-bold text-base">Cancel</StyledText>
                </StyledPressable>
                <StyledPressable
                    className="flex-1 bg-[#BC4A4D] rounded-xl py-3 items-center"
                    onPress={confirmStopDelivering}
                    style={{
                      shadowColor: "#BC4A4D",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                >
                  <StyledText className="text-white font-bold text-base">Yes, Stop</StyledText>
                </StyledPressable>
              </StyledView>
            </StyledView>
          </StyledView>
        </StyledModal>

        <BottomNavigation activeTab="Home" />
      </StyledSafeAreaView>
  );
}