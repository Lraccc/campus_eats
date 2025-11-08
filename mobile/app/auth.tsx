import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';

/**
 * OAuth Callback Handler Route
 * 
 * This route exists solely to handle OAuth deep link callbacks (campuseats://auth)
 * When Microsoft/Google OAuth redirects back to the app, it hits this route.
 * expo-auth-session automatically handles the token exchange in the background.
 * 
 * This component just shows a brief loading state while the OAuth flow completes,
 * then the useAuthentication hook in LoginForm will handle navigation.
 */
export default function AuthCallback() {
  useEffect(() => {
    // Small delay to allow expo-auth-session to process the callback
    const timer = setTimeout(() => {
      // If we're still on this screen after 2 seconds, something went wrong
      // Navigate back to login as a safety measure
      router.replace('/login');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: '#DFD6C5' 
    }}>
      <ActivityIndicator size="large" color="#BC4A4D" />
      <Text style={{ 
        marginTop: 16, 
        fontSize: 16, 
        color: '#8B4513',
        fontWeight: '500'
      }}>
        Completing sign in...
      </Text>
    </View>
  );
}
