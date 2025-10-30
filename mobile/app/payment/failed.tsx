import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

export default function PaymentFailed() {
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Show alert about payment failure, then redirect to cart
    console.log('❌ Payment failed callback - showing alert');
    
    // Small delay to ensure the app is in foreground
    setTimeout(() => {
      Alert.alert(
        'Payment Failed',
        'Your payment was not successful. Please try again or choose a different payment method.',
        [
          {
            text: 'OK',
            onPress: () => {
              setRedirecting(true);
              // Redirect to cart so user can try again
              setTimeout(() => {
                router.replace('/cart');
              }, 300);
            }
          }
        ]
      );
    }, 500);
  }, []);

  return (
    <StyledView className="flex-1 bg-[#DFD6C5] justify-center items-center">
      <ActivityIndicator size="large" color="#BC4A4D" />
      <StyledText className="text-[#8B4513] mt-4 text-base">
        {redirecting ? 'Redirecting...' : 'Processing...'}
      </StyledText>
    </StyledView>
  );
}
