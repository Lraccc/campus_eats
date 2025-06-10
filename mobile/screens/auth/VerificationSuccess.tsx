import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);

const { width } = Dimensions.get('window');

export default function VerificationSuccess() {
  return (
      <StyledView className="flex-1 bg-[#DFD6C5]">
        <Stack.Screen options={{ headerShown: false }} />

        {/* Main Content Container */}
        <StyledView className="flex-1 justify-center px-6">

          {/* Logo Section */}
          <StyledView className="items-center mb-8">
            <StyledImage
                source={require('../../assets/images/logo.png')}
                className="w-20 h-20 mb-3"
            />
            <StyledText className="text-2xl font-bold">
              <StyledText className="text-[#BC4A4DFF]">Campus</StyledText>
              <StyledText className="text-[#DAA520]">Eats</StyledText>
            </StyledText>
          </StyledView>

          {/* Success Card */}
          <StyledView className="bg-white/90 rounded-3xl p-8 mx-4 shadow-lg items-center">

            {/* Success Icon */}
            <StyledView className="mb-6">
              <StyledView
                  className="w-24 h-24 rounded-full bg-green-50 items-center justify-center mb-4"
                  style={{ elevation: 3 }}
              >
                <AntDesign name="checkcircle" size={60} color="#4CAF50" />
              </StyledView>
            </StyledView>

            {/* Success Message */}
            <StyledView className="items-center mb-8">
              <StyledText className="text-2xl font-bold text-[#333] mb-3 text-center">
                Verification Successful!
              </StyledText>
              <StyledText className="text-base text-[#666] text-center leading-6">
                Your email has been verified successfully.{'\n'}
                Welcome to CampusEats!
              </StyledText>
            </StyledView>

            {/* Continue Button */}
            <StyledTouchableOpacity
                className="bg-[#BC4A4D] py-4 px-8 rounded-xl w-full items-center"
                onPress={() => router.replace("/")}
                style={{
                  elevation: 2,
                  shadowColor: '#BC4A4D',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                }}
            >
              <StyledText className="text-white text-lg font-bold">
                Continue to Login
              </StyledText>
            </StyledTouchableOpacity>

          </StyledView>

          {/* Bottom Spacing */}
          <StyledView className="h-16" />

        </StyledView>
      </StyledView>
  );
}