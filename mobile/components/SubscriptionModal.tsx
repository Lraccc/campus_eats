import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styled } from 'nativewind';
import axios from '../services/axiosConfig';
import { API_URL, AUTH_TOKEN_KEY } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  shopId: string;
  onSubscriptionSuccess: () => void;
}

const SUBSCRIPTION_AMOUNT = 199; // Lifetime subscription price

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  visible,
  onClose,
  shopId,
  onSubscriptionSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please login again.');
        return;
      }

      // Create payment via Xendit
      const paymentResponse = await axios.post(
        `${API_URL}/api/payments/create-gcash-payment`,
        {
          amount: SUBSCRIPTION_AMOUNT,
          description: `Analytics Subscription - Shop ${shopId}`,
          orderId: `sub_${shopId}_${Date.now()}`,
          platform: 'mobile'
        },
        {
          headers: { Authorization: token }
        }
      );

      const { checkout_url, id: paymentId, reference_number } = paymentResponse.data;
      
      console.log('Payment created:', { paymentId, reference_number });

      // Open payment URL
      const supported = await Linking.canOpenURL(checkout_url);
      if (supported) {
        // Start polling before opening the browser
        setPaymentProcessing(true);
        pollPaymentStatus(paymentId, reference_number, token);
        
        // Open payment URL in browser
        await Linking.openURL(checkout_url);
        
        Alert.alert(
          'Payment in Progress',
          'Complete the payment in your browser. The app will automatically detect when payment is successful.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Unable to open payment page');
        setPaymentProcessing(false);
      }

    } catch (error: any) {
      console.error('Error creating subscription payment:', error);
      Alert.alert(
        'Payment Error',
        error.response?.data?.error || 'Failed to create payment. Please try again.'
      );
      setPaymentProcessing(false);
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (
    paymentId: string,
    referenceNumber: string,
    token: string
  ) => {
    const maxAttempts = 60; // Poll for 10 minutes (60 * 10 seconds)
    let attempts = 0;
    let pollInterval: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        console.log(`Checking payment status (attempt ${attempts + 1}/${maxAttempts})`);
        console.log('Using payment ID:', paymentId);
        
        // Use the payment ID (ewc_...) to verify e-wallet payment status
        const statusResponse = await axios.get(
          `${API_URL}/api/payments/verify-payment-status/${paymentId}`,
          {
            headers: { Authorization: token }
          }
        );

        console.log('Payment status response:', statusResponse.data);
        const status = statusResponse.data.status;

        if (status === 'SUCCEEDED' || status === 'PAID' || status === 'COMPLETED') {
          // Payment successful, update subscription status
          clearInterval(pollInterval);
          await updateSubscriptionStatus(token);
          return true;
        } else if (status === 'FAILED' || status === 'EXPIRED' || status === 'CANCELLED') {
          clearInterval(pollInterval);
          Alert.alert('Payment Failed', 'The payment was not successful. Please try again.');
          setPaymentProcessing(false);
          return true;
        } else if (status === 'PENDING' || status === 'AWAITING_PAYMENT') {
          console.log('Payment still pending...');
          return false;
        }

        return false;
      } catch (error: any) {
        console.error('Error checking payment status:', error);
        
        // If we get 404, the payment might not be registered yet, continue polling
        if (error.response?.status === 404) {
          console.log('Payment not found yet, will retry...');
          return false;
        }
        
        // For other errors, log but continue polling
        console.log('Error during status check, will retry...');
        return false;
      }
    };

    pollInterval = setInterval(async () => {
      attempts++;
      
      const isDone = await checkStatus();
      
      if (isDone || attempts >= maxAttempts) {
        clearInterval(pollInterval);
        if (attempts >= maxAttempts && !isDone) {
          Alert.alert(
            'Payment Verification Timeout',
            'We are still processing your payment. Please check your subscription status in a few minutes or contact support if the issue persists.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setPaymentProcessing(false);
                  onClose();
                }
              }
            ]
          );
        }
      }
    }, 10000); // Check every 10 seconds
    
    // Do an immediate first check
    setTimeout(() => checkStatus(), 2000);
  };

  const updateSubscriptionStatus = async (token: string) => {
    try {
      await axios.put(
        `${API_URL}/api/shops/${shopId}/subscription-status`,
        { subscriptionStatus: true },
        {
          headers: { Authorization: token }
        }
      );

      setPaymentProcessing(false);
      Alert.alert(
        'Subscription Activated! 🎉',
        'You now have lifetime access to Shop Analytics.',
        [
          {
            text: 'OK',
            onPress: () => {
              onSubscriptionSuccess();
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error updating subscription status:', error);
      Alert.alert(
        'Error',
        'Payment was successful but failed to activate subscription. Please contact support.'
      );
      setPaymentProcessing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={paymentProcessing ? undefined : onClose}
    >
      <StyledView className="flex-1 justify-center items-center bg-black/50 px-6">
        <StyledView className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
          {/* Header */}
          <StyledView className="items-center mb-6">
            <StyledView className="bg-[#BC4A4D] rounded-full p-4 mb-4">
              <Ionicons name="analytics" size={40} color="white" />
            </StyledView>
            <StyledText className="text-2xl font-bold text-[#8B4513] text-center">
              Unlock Shop Analytics
            </StyledText>
          </StyledView>

          {/* Features List */}
          <StyledView className="mb-6">
            <StyledText className="text-base text-gray-700 mb-4 text-center">
              Get lifetime access to powerful analytics features:
            </StyledText>
            
            <StyledView className="space-y-3">
              <StyledView className="flex-row items-start">
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <StyledText className="text-sm text-gray-700 ml-3 flex-1">
                  Track orders and revenue over time
                </StyledText>
              </StyledView>
              
              <StyledView className="flex-row items-start mt-3">
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <StyledText className="text-sm text-gray-700 ml-3 flex-1">
                  Monitor success rates and performance
                </StyledText>
              </StyledView>
              
              <StyledView className="flex-row items-start mt-3">
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <StyledText className="text-sm text-gray-700 ml-3 flex-1">
                  View detailed order statistics
                </StyledText>
              </StyledView>
              
              <StyledView className="flex-row items-start mt-3">
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <StyledText className="text-sm text-gray-700 ml-3 flex-1">
                  Analyze trends with visual charts
                </StyledText>
              </StyledView>
            </StyledView>
          </StyledView>

          {/* Price */}
          <StyledView className="bg-[#FFFAF1] rounded-2xl p-4 mb-6 border-2 border-[#BC4A4D]">
            <StyledText className="text-center text-gray-600 text-sm">
              One-time payment
            </StyledText>
            <StyledText className="text-center text-4xl font-bold text-[#BC4A4D] my-2">
              ₱{SUBSCRIPTION_AMOUNT}
            </StyledText>
            <StyledText className="text-center text-gray-600 text-sm">
              Lifetime Access • No Recurring Fees
            </StyledText>
          </StyledView>

          {/* Payment Processing State */}
          {paymentProcessing && (
            <StyledView className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
              <StyledView className="flex-row items-center justify-center mb-3">
                <ActivityIndicator size="small" color="#3b82f6" />
                <StyledText className="text-blue-700 font-semibold ml-3">
                  Waiting for payment confirmation...
                </StyledText>
              </StyledView>
              <StyledText className="text-blue-600 text-xs text-center mb-3">
                Complete the payment in your browser. We'll automatically detect when it's done.
              </StyledText>
              <StyledTouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Payment Status',
                    'If you have completed the payment and it\'s not being detected, please wait a few moments. The system checks automatically every 10 seconds.',
                    [{ text: 'OK' }]
                  );
                }}
                className="bg-blue-100 rounded-lg py-2 px-4"
              >
                <StyledText className="text-blue-700 text-center text-sm font-semibold">
                  Payment Status Info
                </StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          )}

          {/* Buttons */}
          <StyledView className="space-y-3">
            <StyledTouchableOpacity
              onPress={handleSubscribe}
              disabled={loading || paymentProcessing}
              className={`rounded-xl py-4 ${
                loading || paymentProcessing ? 'bg-gray-400' : 'bg-[#BC4A4D]'
              }`}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5
              }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <StyledText className="text-white text-center text-lg font-bold">
                  Subscribe Now
                </StyledText>
              )}
            </StyledTouchableOpacity>

            {!paymentProcessing ? (
              <StyledTouchableOpacity
                onPress={onClose}
                disabled={loading}
                className="rounded-xl py-4 border-2 border-gray-300"
              >
                <StyledText className="text-gray-700 text-center text-base font-semibold">
                  Maybe Later
                </StyledText>
              </StyledTouchableOpacity>
            ) : (
              <StyledTouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Cancel Payment Verification?',
                    'Your payment may still be processing. If you paid, please wait or check back later to confirm your subscription.',
                    [
                      { text: 'Keep Waiting', style: 'cancel' },
                      { 
                        text: 'Close', 
                        style: 'destructive',
                        onPress: () => {
                          setPaymentProcessing(false);
                          onClose();
                        }
                      }
                    ]
                  );
                }}
                className="rounded-xl py-4 border-2 border-gray-300"
              >
                <StyledText className="text-gray-700 text-center text-base font-semibold">
                  Close
                </StyledText>
              </StyledTouchableOpacity>
            )}
          </StyledView>

          {/* Security Note */}
          <StyledView className="mt-4 flex-row items-center justify-center">
            <Ionicons name="shield-checkmark" size={16} color="#8B4513" />
            <StyledText className="text-xs text-gray-500 ml-2">
              Secure payment powered by Xendit
            </StyledText>
          </StyledView>
        </StyledView>
      </StyledView>
    </Modal>
  );
};

export default SubscriptionModal;
