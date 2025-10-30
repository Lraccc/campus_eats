import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

export default function PaymentSuccess() {
  useEffect(() => {
    // Redirect back to checkout which will verify payment and handle order creation
    console.log('✅ Payment success callback - redirecting to checkout for verification');
    
    // Small delay to ensure the app is in foreground
    setTimeout(() => {
      // Go back to checkout which will automatically verify payment and redirect to order screen
      router.replace('/checkout');
    }, 500);
  }, []);

  return (
    <StyledView className="flex-1 bg-[#DFD6C5] justify-center items-center">
      <ActivityIndicator size="large" color="#BC4A4D" />
      <StyledText className="text-[#8B4513] mt-4 text-base">
        Verifying payment...
      </StyledText>
    </StyledView>
  );
}
