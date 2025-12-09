import React, { useEffect, useRef, useState } from 'react'
import { Modal, Text, View, ActivityIndicator, Animated, TouchableOpacity } from 'react-native'
import { styled } from 'nativewind'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { useAuthentication } from '../services/authService'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface Props {
  visible: boolean
  message: string
  onRetry?: () => void
  isChecking?: boolean // Add this prop to handle loading state
}

export default function RestrictionModal({ visible, message, onRetry, isChecking = false }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { signOut } = useAuthentication();

  // Pulse animation for the loading indicator
  useEffect(() => {
    if (visible && !isChecking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [visible, isChecking, pulseAnim]);

  // Automatic retry mechanism
  useEffect(() => {
    if (visible && onRetry && !isChecking) {
      // Clear any existing interval
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }

      // Initial retry after 3 seconds
      const initialTimeout = setTimeout(() => {
        onRetry();
      }, 3000);

      // Then retry every 6 seconds (slightly more than the 5s throttle)
      retryIntervalRef.current = setInterval(() => {
        onRetry();
      }, 6000);

      return () => {
        clearTimeout(initialTimeout);
        if (retryIntervalRef.current) {
          clearInterval(retryIntervalRef.current);
        }
      };
    }
  }, [visible, onRetry, isChecking]);

  // Don't show modal if we're still checking GPS status
  if (isChecking) {
    return null;
  }

  const handleLogout = async () => {
    try {
      console.log("🚪 Performing logout from restriction modal...");
      setIsLoggingOut(true);

      // Save Remember me state and credentials before clearing storage
      const rememberMe = await AsyncStorage.getItem('@remember_me');
      const savedEmail = rememberMe === 'true' ? await AsyncStorage.getItem('@CampusEats:UserEmail') : null;
      const savedPassword = rememberMe === 'true' ? await AsyncStorage.getItem('@CampusEats:UserPassword') : null;

      // Use the secure signOut function from auth service
      await signOut();

      // Clear all AsyncStorage except Remember me credentials
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => 
        key !== '@remember_me' && 
        key !== '@CampusEats:UserEmail' && 
        key !== '@CampusEats:UserPassword'
      );

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
      console.log("✅ Cleared all storage except Remember me credentials");

      // Restore Remember me credentials if they existed
      if (rememberMe === 'true' && savedEmail && savedPassword) {
        await Promise.all([
          AsyncStorage.setItem('@remember_me', 'true'),
          AsyncStorage.setItem('@CampusEats:UserEmail', savedEmail),
          AsyncStorage.setItem('@CampusEats:UserPassword', savedPassword)
        ]);
        console.log("✅ Restored Remember me credentials after logout");
      }
      console.log("🔒 Secure logout complete");

      // Navigate to sign-in / landing page after logout
      router.replace('/');
    } catch (error) {
      console.error("❌ Error during logout:", error);
      // Even if there's an error, force navigation
      router.replace('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <StyledView className="flex-1 bg-black/60 justify-center items-center px-6">
        <StyledView className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
          {/* Header Section */}
          <StyledView className="items-center mb-6">
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <StyledView className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4">
                <StyledView className="w-8 h-8 bg-red-500 rounded-full items-center justify-center">
                  <StyledText className="text-white font-bold text-lg">!</StyledText>
                </StyledView>
              </StyledView>
            </Animated.View>
            <StyledText className="text-xl font-bold text-gray-800 text-center">Access Restricted</StyledText>
          </StyledView>

          {/* Message Section */}
          <StyledView className="mb-6">
            <StyledText className="text-base text-gray-600 text-center leading-6">{message}</StyledText>
          </StyledView>

          {/* Checking Status Section */}
          <StyledView className="items-center mb-4">
            <ActivityIndicator size="large" color="#3B82F6" />
            <StyledText className="text-sm text-gray-500 text-center mt-3">
              Checking automatically...
            </StyledText>
          </StyledView>

          {/* Logout Button */}
          <StyledTouchableOpacity
            className="mt-2 py-3 px-6 rounded-xl"
            style={{
              backgroundColor: '#DC2626',
              shadowColor: '#DC2626',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3,
              opacity: isLoggingOut ? 0.6 : 1,
            }}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            <StyledView className="flex-row items-center justify-center">
              <Ionicons name="log-out-outline" size={18} color="white" />
              <StyledText className="text-white font-semibold text-base ml-2">
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </StyledText>
            </StyledView>
          </StyledTouchableOpacity>
        </StyledView>
      </StyledView>
    </Modal>
  )
}