import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';
import { styled } from 'nativewind';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { API_URL, AUTH_TOKEN_KEY } from '../../config';
import { authService, useAuthentication } from '../../services/authService';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledScrollView = styled(ScrollView);

export default function LoginForm() {
  // Traditional login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoadingTraditional, setIsLoadingTraditional] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const REMEMBER_ME_KEY = '@remember_me';
  const SAVED_EMAIL_KEY = '@CampusEats:UserEmail';
  const SAVED_PASSWORD_KEY = '@CampusEats:UserPassword';

  // OAuth login state and functionality
  const {
    signIn,
    isLoggedIn,
    isLoading: isLoadingOAuth,
    authState
  } = useAuthentication();

  // Effect to handle navigation after successful OAuth login
  useEffect(() => {
    if (isLoggedIn && authState?.idToken) {
      try {
        // Get accountType from AsyncStorage
        AsyncStorage.getItem('accountType').then(accountType => {
          console.log('OAuth accountType:', accountType);

          if (accountType === 'shop') {
            console.log('OAuth User is a shop, redirecting to shop home');
            router.replace('/shop' as any);
          } else {
            console.log('OAuth User is a regular user, redirecting to home');
            router.replace('/home');
          }
        }).catch(error => {
          console.error('Error getting accountType:', error);
          router.replace('/home');
        });
      } catch (error) {
        console.error('Error processing OAuth login:', error);
        router.replace('/home');
      }
    }
  }, [isLoggedIn, authState]);

  // Load saved credentials on component mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        console.log('Loading saved credentials...');
        const [savedRememberMe, savedEmail, savedPassword] = await Promise.all([
          AsyncStorage.getItem(REMEMBER_ME_KEY),
          AsyncStorage.getItem(SAVED_EMAIL_KEY),
          AsyncStorage.getItem(SAVED_PASSWORD_KEY)
        ]);
        
        console.log('Loaded credentials:', { savedRememberMe, hasEmail: !!savedEmail, hasPassword: !!savedPassword });
        
        if (savedRememberMe === 'true' && savedEmail && savedPassword) {
          console.log('Setting saved credentials to form');
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);
        } else if (savedRememberMe === 'true') {
          console.log('Remember me was checked but no credentials found, unchecking');
          await AsyncStorage.setItem(REMEMBER_ME_KEY, 'false');
          setRememberMe(false);
        }
      } catch (error) {
        console.error('Error loading saved credentials:', error);
      }
    };

    loadSavedCredentials();
  }, []);

  // Save or clear credentials based on rememberMe state
  useEffect(() => {
    const handleRememberMeChange = async () => {
      try {
        if (rememberMe) {
          console.log('Saving credentials to storage');
          await Promise.all([
            AsyncStorage.setItem(REMEMBER_ME_KEY, 'true'),
            AsyncStorage.setItem(SAVED_EMAIL_KEY, email),
            AsyncStorage.setItem(SAVED_PASSWORD_KEY, password)
          ]);
          console.log('Credentials saved successfully');
        } else {
          console.log('Clearing saved credentials');
          await Promise.all([
            AsyncStorage.setItem(REMEMBER_ME_KEY, 'false'),
            AsyncStorage.removeItem(SAVED_EMAIL_KEY),
            AsyncStorage.removeItem(SAVED_PASSWORD_KEY)
          ]);
          console.log('Credentials cleared successfully');
        }
      } catch (error) {
        console.error('Error updating remember me state:', error);
      }
    };

    // Only run this effect when rememberMe changes, not on every email/password change
    if (email && password) {
      handleRememberMeChange();
    }
  }, [rememberMe]);

  // Traditional login handler
  const handleTraditionalLogin = async () => {
    // Form validation
    if (!email) {
      setError('Please enter your username or email');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoadingTraditional(true);
    setError('');

    try {
      // Save credentials if remember me is checked
      if (rememberMe) {
        console.log('Saving credentials after successful login');
        await Promise.all([
          AsyncStorage.setItem(REMEMBER_ME_KEY, 'true'),
          AsyncStorage.setItem(SAVED_EMAIL_KEY, email),
          AsyncStorage.setItem(SAVED_PASSWORD_KEY, password)
        ]);
        console.log('Credentials saved successfully after login');
      } else {
        // Make sure to clear any existing credentials if remember me is not checked
        console.log('Clearing any previously saved credentials');
        await Promise.all([
          AsyncStorage.setItem(REMEMBER_ME_KEY, 'false'),
          AsyncStorage.removeItem(SAVED_EMAIL_KEY),
          AsyncStorage.removeItem(SAVED_PASSWORD_KEY)
        ]);
      }

      // Proceed with login
      const response = await authService.login({
        email,
        password
      });

      // Store the token in AsyncStorage
      if (response.token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);

        // Get userId from token
        const tokenParts = response.token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const userId = payload.sub || payload.oid || payload.userId || payload.id;

          if (userId) {
            console.log('Attempting to fetch user data for userId:', userId);
            try {
              // Fetch user data to get accountType using axios
              const userResponse = await axios.get(`${API_URL}/api/users/${userId}`, {
                headers: {
                  'Authorization': response.token,
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                }
              });

              console.log('User data response:', userResponse.data);

              // Store accountType
              if (userResponse.data.accountType) {
                await AsyncStorage.setItem('accountType', userResponse.data.accountType);
                console.log('Stored accountType:', userResponse.data.accountType);

                // Route based on accountType
                switch (userResponse.data.accountType.toLowerCase()) {
                  case 'shop':
                    console.log('User is a shop, redirecting to shop home');
                    router.replace('/shop' as any);
                    break;
                  case 'dasher':
                    console.log('User is a dasher, redirecting to dasher orders');
                    router.replace('/dasher/orders' as any);
                    break;
                  case 'admin':
                    console.log('User is an admin, redirecting to admin dashboard');
                    router.replace('/admin/dashboard' as any);
                    break;
                  default:
                    console.log('User is a regular user, redirecting to home');
                    router.replace('/home');
                }
              } else {
                console.log('No accountType in user data:', userResponse.data);
                router.replace('/home');
              }
            } catch (error: any) {
              // Changed from console.error to console.log for NOBRIDGE message
              console.log('NOBRIDGE: User data fetch failed');
              router.replace('/home');
            }
          } else {
            // Changed from console.log to console.log with NOBRIDGE prefix
            console.log('NOBRIDGE: No user ID in token');
            router.replace('/home');
          }
        } else {
          // Changed from console.log to console.log with NOBRIDGE prefix
          console.log('NOBRIDGE: Invalid token format');
          router.replace('/home');
        }
      } else {
        setError('Login successful but no token received');
      }
    } catch (err) {
      // Parse the error message to provide user-friendly feedback
      if (err instanceof Error) {
        // Changed from detailed error logging to a simplified NOBRIDGE log
        console.log(`NOBRIDGE: Login error occurred`);
        
        // Check for specific error messages and provide user-friendly feedback
        const errorMsg = err.message.toLowerCase();
        
        // Check for "User not found" specific error
        if (errorMsg.includes('not found') || errorMsg.includes('user does not exist')) {
          setError('Account not found. Please check your username/email or create a new account.');
        } else if (errorMsg.includes('invalid credential') || errorMsg.includes('incorrect password')) {
          setError('Incorrect password. Please try again.');
        } else if (errorMsg.includes('unauthorized') || errorMsg.includes('invalid username')) {
          setError('Invalid login credentials. Please check and try again.');
        } else if (errorMsg.includes('too many') || errorMsg.includes('rate limit')) {
          setError('Too many login attempts. Please try again later.');
        } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError('Login failed. Please check your credentials and try again.');
        }
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoadingTraditional(false);
    }
  };

  // Microsoft Sign In handler
  const handleMicrosoftSignIn = async () => {
    setError(''); // Clear previous errors
    try {
      await signIn();
    } catch (err) {
      setError('Microsoft Sign In failed. Please try again.');
    }
  };

  // Google Sign In handler (placeholder)
  const handleGoogleSignIn = () => {
    setError('Google Sign In not yet implemented');
  };

  // Determine if any loading state is active
  const isLoading = isLoadingTraditional || isLoadingOAuth;

  // Show loading indicator while either authentication process is running
  if (isLoading) {
    return (
        <StyledView className="flex-1 justify-center items-center" style={{ backgroundColor: '#DFD6C5' }}>
          <ActivityIndicator size="large" color="#BC4A4D" />
          <StyledText className="mt-3 text-gray-600">Signing in...</StyledText>
        </StyledView>
    );
  }

  return (
      <StyledSafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
        >
          <StyledScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              showsVerticalScrollIndicator={false}
          >
            <StyledView className="flex-1 px-6 pt-15 pb-6 justify-center">

              {/* Logo and Brand - Outside the card like in your original */}
              <StyledView className="items-center mb-6">
                <StyledImage
                    source={require('../../assets/images/logo.png')}
                    className="w-[60px] h-[60px] mb-2 rounded-full"
                />
                <StyledText className="text-2xl font-bold">
                  <StyledText className="text-[#BC4A4DFF]">Campus</StyledText>
                  <StyledText className="text-[#DAA520]">Eats</StyledText>
                </StyledText>
              </StyledView>

              {/* Login Card */}
              <StyledView className="bg-white rounded-3xl p-6 shadow-sm">
                {/* Login Header */}
                <StyledText className="text-2xl font-bold text-center text-gray-900 mb-2">Login</StyledText>
                <StyledText className="text-sm text-center text-gray-500 mb-6">
                  Enter your email and password to log in
                </StyledText>

                {/* Error Message */}
                {error ? (
                    <StyledView className="mb-4 p-4 bg-red-50 rounded-xl flex-row items-center">
                      <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                      <StyledText className="text-red-600 flex-1">{error}</StyledText>
                    </StyledView>
                ) : null}

                {/* Email Input */}
                <StyledView className="mb-4">
                  <StyledTextInput
                      className="h-12 bg-gray-50 rounded-xl px-4 text-gray-800"
                      placeholder="Username/Email"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                  />
                </StyledView>

                {/* Password Input */}
                <StyledView className="mb-2 relative">
                  <StyledTextInput
                      className="h-12 bg-gray-50 rounded-xl px-4 pr-10 text-gray-800"
                      placeholder="Password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                  />
                  <StyledTouchableOpacity
                      className="absolute right-3 top-3"
                      onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#666"
                    />
                  </StyledTouchableOpacity>
                </StyledView>

                {/* Remember Me & Forgot Password */}
                <StyledView className="flex-row justify-between items-center mb-6">
                  <StyledTouchableOpacity
                      className="flex-row items-center"
                      onPress={() => setRememberMe(!rememberMe)}
                  >
                    <StyledView className={`w-5 h-5 rounded border ${rememberMe ? 'bg-[#BC4A4D] border-[#BC4A4D]' : 'border-gray-300'} mr-2 items-center justify-center`}>
                      {rememberMe && <Ionicons name="checkmark" size={14} color="white" />}
                    </StyledView>
                    <StyledText className="text-sm text-gray-600">Remember me</StyledText>
                  </StyledTouchableOpacity>

                  <StyledTouchableOpacity onPress={() => router.push('/forgot-password' as any)}>
                    <StyledText className="text-sm text-[#BC4A4D] font-medium">Forgot Password?</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>

                {/* Login Button */}
                <StyledTouchableOpacity
                    className="h-12 rounded-xl justify-center items-center mb-6"
                    style={{ backgroundColor: '#BC4A4D' }}
                    onPress={handleTraditionalLogin}
                >
                  <StyledText className="text-white text-base font-semibold">Login</StyledText>
                </StyledTouchableOpacity>

                {/* Social Login Section */}
                <StyledView className="items-center mb-6">
                  <StyledText className="text-sm text-gray-500 mb-4">Or sign with</StyledText>

                  <StyledView className="flex-row justify-center space-x-4">

                    {/* Microsoft Button */}
                    <StyledTouchableOpacity
                        className="w-12 h-12 rounded-full bg-white border border-gray-200 items-center justify-center"
                        onPress={handleMicrosoftSignIn}
                    >
                      <StyledText className="text-[#0078D4] text-xl font-bold">M</StyledText>
                    </StyledTouchableOpacity>
                  </StyledView>
                </StyledView>

                {/* Register Section */}
                <StyledView className="flex-row justify-center">
                  <StyledText className="text-sm text-gray-600">Don't have an account? </StyledText>
                  <StyledTouchableOpacity onPress={() => router.push('/signup' as any)}>
                    <StyledText className="text-sm text-[#BC4A4D] font-semibold">Register</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>
              </StyledView>

              {/* Help Section - Outside the card */}
              <StyledView className="items-center mt-4">
                <StyledView className="flex-row items-center justify-center">
                  <StyledText className="text-xs text-gray-600 mr-1">Need help?</StyledText>
                  <StyledTouchableOpacity onPress={() => Linking.openURL('mailto:campuseatsv2@gmail.com?subject=Campus%20Eats%20Support%20Request')}>
                    <StyledText className="text-xs text-[#BC4A4D] underline">Contact us</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>
              </StyledView>

            </StyledView>
          </StyledScrollView>
        </KeyboardAvoidingView>
      </StyledSafeAreaView>
  );
}