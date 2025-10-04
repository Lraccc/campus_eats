import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';
import LoadingSplash from '../../components/SplashScreen';

const { width, height } = Dimensions.get('window');

const FirstLaunchScreen = () => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (token) router.replace('/home');
      } catch (error) {
        console.error('Error checking auth:', error);
      }
    };
    checkAuth();

    // Auto-redirect after 4 seconds to give users time to appreciate the design
    const timer = setTimeout(() => {
      setIsLoading(true);
      setTimeout(() => {
        // Redirect to login (index route)
        router.replace('/');
      }, 1000);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  // Show loading screen during transition
  if (isLoading) {
    return (
      <LoadingSplash message="Taking you to login..." />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#f0e6d2] relative overflow-hidden"
    >
      <SafeAreaView className="flex-1 bg-[#f0e6d2]">
        <StatusBar barStyle="dark-content" backgroundColor="#f0e6d2" />

        {/* Header */}
        <View className="px-5 pt-5">
          <View className="flex-row">
            <Text className="text-2xl font-bold text-[#b33a3a]">Campus</Text>
            <Text className="text-2xl font-bold text-[#ffc107]">Eats</Text>
          </View>
          <Text className="text-xs text-gray-600 mt-1">
            Cebu Institute of Technology - University
          </Text>
        </View>

        {/* Main Content */}
        <View className="flex-1 px-5 justify-between pt-10">
          {/* Text Section */}
          <View className="w-full max-w-[400px] z-20">
            <Text className="text-[32px] font-bold text-[#b33a3a] leading-[42px]">
              Enjoy your favorite food,
            </Text>

            <View className="flex-row items-center">
              <Text className="text-[32px] font-bold text-[#b33a3a] leading-[42px]">
                delivered{' '}
              </Text>
              <View className="w-10 h-10 rounded-full bg-[#ffc107]" />
              <Text className="text-[32px] font-bold text-[#b33a3a] leading-[42px]">
                {' '}straight
              </Text>
            </View>

            <Text className="text-[32px] font-bold text-[#b33a3a] leading-[42px]">
              to you
            </Text>
          </View>

          {/* Illustration Section - Duck Delivery Character */}
          <View
            className="absolute right-5 bottom-20 z-10"
            style={{ width: 250, height: 280 }}
          >
            <View className="relative w-full h-full">
              {/* Umbrella Top */}
              <View
                className="absolute bg-[#fdcb6e]"
                style={{
                  top: 0,
                  left: 60,
                  width: 140,
                  height: 70,
                  borderTopLeftRadius: 70,
                  borderTopRightRadius: 70,
                }}
              />
              
              {/* Duck Head */}
              <View
                className="absolute bg-[#ffc107] rounded-full"
                style={{
                  top: 80,
                  left: 120,
                  width: 50,
                  height: 50,
                  zIndex: 3,
                }}
              />
              
              {/* Duck Eye */}
              <View
                className="absolute bg-black rounded-full"
                style={{
                  top: 92,
                  left: 140,
                  width: 8,
                  height: 8,
                  zIndex: 4,
                }}
              />
              
              {/* Duck Beak */}
              <View
                className="absolute bg-[#ff9f43]"
                style={{
                  top: 100,
                  left: 165,
                  width: 25,
                  height: 12,
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 6,
                  zIndex: 4,
                }}
              />
              
              {/* Duck Body */}
              <View
                className="absolute bg-[#ffc107]"
                style={{
                  top: 120,
                  left: 90,
                  width: 120,
                  height: 90,
                  borderTopLeftRadius: 60,
                  borderTopRightRadius: 60,
                  borderBottomLeftRadius: 50,
                  borderBottomRightRadius: 50,
                  transform: [{ rotate: '-10deg' }],
                  zIndex: 2,
                }}
              />
              
              {/* Package Box in Duck's hands */}
              <View
                className="absolute bg-[#ff9f43] border-2 border-[#e17055]"
                style={{
                  top: 140,
                  left: 150,
                  width: 70,
                  height: 70,
                  borderRadius: 8,
                  transform: [{ rotate: '12deg' }],
                  zIndex: 5,
                }}
              >
                {/* Package Tape */}
                <View
                  className="absolute bg-[#e17055]"
                  style={{
                    top: 30,
                    left: 0,
                    right: 0,
                    height: 4,
                  }}
                />
                <View
                  className="absolute bg-[#e17055]"
                  style={{
                    top: 0,
                    bottom: 0,
                    left: 32,
                    width: 4,
                  }}
                />
              </View>
              
              {/* Duck Wing */}
              <View
                className="absolute bg-[#ffc107] rounded-full"
                style={{
                  top: 140,
                  left: 85,
                  width: 40,
                  height: 60,
                  transform: [{ rotate: '20deg' }],
                  zIndex: 1,
                }}
              />
              
              {/* Duck Feet */}
              <View
                className="absolute bg-[#ff9f43]"
                style={{
                  bottom: 10,
                  left: 100,
                  width: 30,
                  height: 15,
                  borderBottomLeftRadius: 15,
                  borderBottomRightRadius: 8,
                  zIndex: 1,
                }}
              />
              <View
                className="absolute bg-[#ff9f43]"
                style={{
                  bottom: 10,
                  left: 140,
                  width: 30,
                  height: 15,
                  borderBottomLeftRadius: 8,
                  borderBottomRightRadius: 15,
                  zIndex: 1,
                }}
              />
            </View>
          </View>
        </View>

        {/* Decorative Circles */}
        <View
          className="absolute bg-[#b33a3a] opacity-80 rounded-full z-0"
          style={{
            top: height * 0.7,
            left: width * 0.2,
            width: 80,
            height: 80,
          }}
        />
        <View
          className="absolute bg-[#b33a3a] opacity-80 rounded-full z-0"
          style={{
            top: height * 0.8,
            right: width * 0.1,
            width: 80,
            height: 80,
          }}
        />
        <View
          className="absolute bg-[#ffc107] opacity-80 rounded-full z-0"
          style={{
            top: height * 0.5,
            right: width * 0.15,
            width: 50,
            height: 50,
          }}
        />

        {/* Clouds */}
        <View
          className="absolute bg-white opacity-70 rounded-full z-0"
          style={{
            top: height * 0.2,
            right: width * 0.1,
            width: 100,
            height: 60,
          }}
        />
        <View
          className="absolute bg-white opacity-70 rounded-full z-0"
          style={{
            top: height * 0.35,
            right: width * 0.3,
            width: 100,
            height: 60,
          }}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default FirstLaunchScreen;