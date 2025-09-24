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

            {/* Enhanced Header Section */}
            <StyledView
                className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 mb-6 items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.12,
                  shadowRadius: 16,
                  elevation: 8,
                  backgroundColor: 'white',
                }}
            >
              <StyledView className="relative mb-4">
                <StyledView 
                    className="w-24 h-24 rounded-full bg-gradient-to-br from-[#BC4A4D] to-[#A03D40] items-center justify-center p-1"
                    style={{
                      shadowColor: "#BC4A4D",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                >
                  <StyledView className="w-full h-full rounded-full bg-white items-center justify-center">
                    <StyledImage
                        source={require('../../assets/images/logo.png')}
                        className="w-16 h-16 rounded-full"
                        style={{ resizeMode: 'contain' }}
                    />
                  </StyledView>
                </StyledView>
                
                {/* Online/Offline indicator */}
                <StyledView 
                    className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-white ${
                        isDelivering ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                    style={{
                      shadowColor: isDelivering ? "#10b981" : "#6b7280",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.4,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                />
              </StyledView>
              
              <StyledText className="text-3xl font-black mb-2">
                <StyledText className="text-[#BC4A4D]">Campus</StyledText>
                <StyledText className="text-[#DAA520]">Eats</StyledText>
              </StyledText>
              
              <StyledView className="bg-[#BC4A4D]/10 px-4 py-2 rounded-full">
                <StyledText className="text-sm font-semibold text-[#BC4A4D]">
                  🚚 Dasher Dashboard
                </StyledText>
              </StyledView>
            </StyledView>

            {/* Enhanced Welcome Card */}
            <StyledView
                className="bg-gradient-to-r from-[#BC4A4D] to-[#A03D40] rounded-2xl p-6 mb-6"
                style={{
                  shadowColor: "#BC4A4D",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 8,
                  backgroundColor: '#BC4A4D',
                }}
            >
              <StyledView className="flex-row items-center justify-between mb-4">
                <StyledView className="flex-1">
                  <StyledText className="text-xl font-bold text-white mb-1">
                    {getGreeting()}, {userName}! 👋
                  </StyledText>
                  <StyledText className="text-white/80 text-sm">
                    Ready to make some deliveries today?
                  </StyledText>
                </StyledView>
                <StyledView className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
                  <StyledText className="text-2xl">🌟</StyledText>
                </StyledView>
              </StyledView>
              
              <StyledView className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <StyledView className="items-center">
                  <StyledText className="text-3xl font-black text-white mb-1">
                    {currentTime}
                  </StyledText>
                  <StyledText className="text-white/90 text-base font-medium">
                    {currentDate}
                  </StyledText>
                </StyledView>
              </StyledView>
              
              <StyledView className="flex-row justify-center mt-4">
                <StyledView className="flex-row items-center bg-white/20 px-3 py-1 rounded-full">
                  <StyledView className={`w-2 h-2 rounded-full mr-2 ${isDelivering ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <StyledText className="text-white/90 text-xs font-medium">
                    {isDelivering ? 'Active Dasher' : 'Inactive'}
                  </StyledText>
                </StyledView>
              </StyledView>
            </StyledView>

            {/* Enhanced Status Card */}
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
              <StyledView className="flex-row items-center justify-between mb-6">
                <StyledView>
                  <StyledText className="text-lg font-bold text-gray-900 mb-1">Delivery Status</StyledText>
                  <StyledText className="text-sm text-gray-500">
                    {isDelivering ? 'Ready to accept orders' : 'Currently offline'}
                  </StyledText>
                </StyledView>
                <StyledView 
                    className={`px-4 py-2 rounded-full flex-row items-center ${
                        isDelivering ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'
                    }`}
                >
                  <StyledView 
                      className={`w-2 h-2 rounded-full mr-2 ${
                          isDelivering ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                      style={{
                        shadowColor: isDelivering ? "#10b981" : "#6b7280",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: isDelivering ? 0.6 : 0,
                        shadowRadius: 4,
                      }}
                  />
                  <StyledText className={`text-sm font-semibold ${
                      isDelivering ? 'text-emerald-700' : 'text-gray-600'
                  }`}>
                    {isDelivering ? 'Online' : 'Offline'}
                  </StyledText>
                </StyledView>
              </StyledView>

              <StyledTouchableOpacity
                  className={`py-4 px-6 rounded-xl items-center flex-row justify-center ${
                      isDelivering ? 'bg-red-500' : 'bg-gradient-to-r from-[#BC4A4D] to-[#A03D40]'
                  }`}
                  onPress={isDelivering ? handleStopDelivering : handleStartDelivering}
                  style={{
                    shadowColor: isDelivering ? "#ef4444" : "#BC4A4D",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                    backgroundColor: isDelivering ? '#ef4444' : '#BC4A4D',
                  }}
              >
                <StyledView className="mr-3">
                  <StyledText className="text-white text-xl">
                    {isDelivering ? '⏹️' : '🚀'}
                  </StyledText>
                </StyledView>
                <StyledText className="text-white text-lg font-bold">
                  {isDelivering ? 'Stop Delivering' : 'Start Delivering'}
                </StyledText>
              </StyledTouchableOpacity>
              
              {!isDelivering && (
                <StyledView className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <StyledView className="flex-row items-center">
                    <StyledText className="text-amber-600 text-lg mr-2">💡</StyledText>
                    <StyledText className="text-amber-700 text-sm font-medium flex-1">
                      Go online to start receiving delivery requests and earn money!
                    </StyledText>
                  </StyledView>
                </StyledView>
              )}
            </StyledView>

            {/* Enhanced Top Dashers Card */}
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
              <StyledView className="flex-row items-center mb-6">
                <StyledView className="flex-1">
                  <StyledText className="text-lg font-bold text-gray-900 mb-1">Top Dashers</StyledText>
                  <StyledText className="text-sm text-gray-500">This week's best performers</StyledText>
                </StyledView>
                <StyledView className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full items-center justify-center">
                  <StyledText className="text-2xl">🏆</StyledText>
                </StyledView>
              </StyledView>

              <StyledView className="space-y-1">
                {topDashers.map((dasher, index) => (
                    <StyledView 
                        key={index} 
                        className={`flex-row items-center py-3 px-4 rounded-xl ${
                            index < 3 ? 'bg-gradient-to-r from-gray-50 to-gray-25' : 'bg-gray-25'
                        }`}
                        style={{
                          backgroundColor: index === 0 ? '#fef3c7' : index === 1 ? '#f3f4f6' : index === 2 ? '#fed7aa' : '#f9fafb',
                          ...(index < 3 && {
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                          })
                        }}
                    >
                      <StyledView
                          className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${
                              index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500' : 
                              index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' : 
                              index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500' : 
                              'bg-gradient-to-br from-gray-200 to-gray-300'
                          }`}
                          style={{
                            shadowColor: index === 0 ? "#f59e0b" : index === 1 ? "#6b7280" : index === 2 ? "#f97316" : "#9ca3af",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.3,
                            shadowRadius: 3,
                            elevation: 2,
                          }}
                      >
                        <StyledText className={`text-sm font-bold ${
                            index < 3 ? 'text-white' : 'text-gray-700'
                        }`}>
                          {index + 1}
                        </StyledText>
                      </StyledView>
                      
                      <StyledView className="flex-1">
                        <StyledText className="text-base font-semibold text-gray-900">
                          {dasher.name}
                        </StyledText>
                        <StyledText className="text-xs text-gray-500 mt-0.5">
                          {index === 0 ? '⭐ Top Performer' : index === 1 ? '🥈 Great Job' : index === 2 ? '🥉 Keep It Up' : 'Rising Star'}
                        </StyledText>
                      </StyledView>
                      
                      {index < 3 && (
                          <StyledView className="ml-2">
                            <StyledText className="text-xl">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </StyledText>
                          </StyledView>
                      )}
                      
                      {index >= 3 && (
                          <StyledView className="ml-2 bg-blue-100 px-2 py-1 rounded-full">
                            <StyledText className="text-blue-600 text-xs font-medium">
                              Rising
                            </StyledText>
                          </StyledView>
                      )}
                    </StyledView>
                ))}
              </StyledView>
              
              <StyledView className="mt-4 pt-4 border-t border-gray-100">
                <StyledText className="text-center text-sm text-gray-500">
                  Keep delivering to climb the leaderboard! 🚀
                </StyledText>
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