import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';
import { styled } from 'nativewind';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { authService, useAuthentication, UserBannedError } from '../../services/authService';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledScrollView = styled(ScrollView);

export default function LoginForm() {
  // Animation values for loading state
  const spinValue = useRef(new Animated.Value(0)).current;
  const circleValue = useRef(new Animated.Value(0)).current;

  // Traditional login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoadingTraditional, setIsLoadingTraditional] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const REMEMBER_ME_KEY = '@remember_me';
  const SAVED_EMAIL_KEY = '@CampusEats:UserEmail';
  const SAVED_PASSWORD_KEY = '@CampusEats:UserPassword';

  // OAuth login state and functionality
  const {
    signIn,
    isLoggedIn,
    isLoading: isLoadingOAuth,
    authState,
    authError,
    clearAuthError
  } = useAuthentication();

  // Effect to handle navigation after successful OAuth login
  useEffect(() => {
    if (isLoggedIn && authState?.idToken) {
      try {
        // Check if we have valid auth state (more reliable than token check for OAuth)
        if (!authState?.accessToken) {
          console.log('OAuth navigation cancelled - no auth state (likely authentication failed)');
          return;
        }
        
        console.log('OAuth navigation proceeding - valid auth state found');
        
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

  // Handle OAuth authentication errors (including banned users)
  useEffect(() => {
    // Only process if there's actually an error (not null)
    if (authError) {
      console.log('LoginForm: Auth error detected:', authError.name);
      if (authError instanceof UserBannedError) {
        console.log('LoginForm: Detected UserBannedError, showing ban modal');
        setErrorModalMessage('Your account has been banned. Please contact the administrator for more information.');
        setShowErrorModal(true);
      } else {
        console.log('LoginForm: Detected other auth error, showing generic modal');
        setErrorModalMessage('Microsoft Sign In failed. Please try again.');
        setShowErrorModal(true);
      }
      clearAuthError(); // Clear the error after handling it
    }
  }, [authError, clearAuthError]);

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
  // Use a ref to track if this is the first render to avoid clearing on initial load
  const isInitialMount = useRef(true);
  
  useEffect(() => {
    // Skip the effect on initial mount (when loading saved credentials)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const handleRememberMeChange = async () => {
      try {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');
        
        if (!rememberMe) {
          // Clear saved credentials when remember me is unchecked
          console.log('Clearing saved credentials');
          await Promise.all([
            AsyncStorage.removeItem(SAVED_EMAIL_KEY),
            AsyncStorage.removeItem(SAVED_PASSWORD_KEY)
          ]);
          console.log('Credentials cleared successfully');
        }
      } catch (error) {
        console.error('Error updating remember me state:', error);
      }
    };

    handleRememberMeChange();
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
      // Proceed with login
      const response = await authService.login({
        email,
        password
      });

      // Store the token in AsyncStorage
      if (response.token) {
        // Save credentials ONLY after successful login if remember me is checked
        if (rememberMe) {
          console.log('Saving credentials after successful login');
          await Promise.all([
            AsyncStorage.setItem(SAVED_EMAIL_KEY, email),
            AsyncStorage.setItem(SAVED_PASSWORD_KEY, password)
          ]);
          console.log('Credentials saved successfully after login');
        }
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

              // Check if user is banned using the fetched user data
              const userData = userResponse.data;
              if (userData.banned || userData.isBanned || (userData.offenses && userData.offenses >= 3)) {
                console.log('User is banned, preventing login');
                setErrorModalMessage('Your account has been banned. Please contact the administrator for more information.');
                setShowErrorModal(true);
                // Clear any stored tokens
                await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
                return;
              } else if (userData.offenses) {
                console.log('User has', userData.offenses, 'offenses');
              }

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
        // Check for specific error messages and provide user-friendly feedback
        const errorMsg = err.message.toLowerCase();
        
        // Check for "User not found" specific error
        if (errorMsg.includes('banned')) {
          setErrorModalMessage('Your account has been banned. Please contact the administrator for more information.');
        } else if (errorMsg.includes('not found') || errorMsg.includes('user does not exist')) {
          setErrorModalMessage('Account not found. Please check your username/email or create a new account.');
        } else if (errorMsg.includes('invalid credential') || errorMsg.includes('incorrect password')) {
          setErrorModalMessage('Wrong username or password. Please try again.');
        } else if (errorMsg.includes('unauthorized') || errorMsg.includes('invalid username')) {
          setErrorModalMessage('Wrong username or password. Please try again.');
        } else if (errorMsg.includes('too many') || errorMsg.includes('rate limit')) {
          setErrorModalMessage('Too many login attempts. Please try again later.');
        } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
          setErrorModalMessage('Network error. Please check your connection and try again.');
        } else {
          setErrorModalMessage('Wrong username or password. Please try again.');
        }
      } else {
        setErrorModalMessage('Wrong username or password. Please try again.');
      }
      
      // Show the error modal
      setShowErrorModal(true);
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
      // OAuth errors (including banned users) are now handled by useEffect watching authError
      setErrorModalMessage('Microsoft Sign In failed. Please try again.');
      setShowErrorModal(true);
    }
  };

  // Google Sign In handler (placeholder)
  const handleGoogleSignIn = () => {
    setErrorModalMessage('Google Sign In not yet implemented');
    setShowErrorModal(true);
  };

  // Determine if any loading state is active
  const isLoading = isLoadingTraditional || isLoadingOAuth;

  // Spinning logo animation
  useEffect(() => {
    const startAnimations = () => {
      spinValue.setValue(0);
      circleValue.setValue(0);
      
      // Start spinning logo
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ).start();

      // Start circular loading line
      Animated.loop(
        Animated.timing(circleValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ).start();
    };

    if (isLoading) {
      startAnimations();
    }
  }, [isLoading, spinValue, circleValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const circleRotation = circleValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Show loading indicator while either authentication process is running
  if (isLoading) {
    return (
        <StyledView className="flex-1 justify-center items-center bg-[#DFD6C5]">
          <StyledView className="items-center">
            {/* Spinning Logo Container */}
            <StyledView className="relative mb-6">
              {/* Outer rotating circle */}
              <Animated.View
                style={{
                  transform: [{ rotate: circleRotation }],
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 2,
                  borderColor: 'rgba(188, 74, 77, 0.2)',
                  borderTopColor: '#BC4A4D',
                  position: 'absolute',
                }}
              />
              
              {/* Logo container */}
              <StyledView className="w-16 h-16 rounded-full bg-[#BC4A4D]/10 items-center justify-center mx-2 my-2">
                <Animated.View
                  style={{
                    transform: [{ rotate: spin }],
                  }}
                >
                  <StyledImage
                    source={require('../../assets/images/logo.png')}
                    style={{ width: 40, height: 40 }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </StyledView>
            </StyledView>
            
            {/* Brand Name */}
            <StyledText className="text-lg font-bold mb-4">
              <StyledText className="text-[#BC4A4DFF]">Campus</StyledText>
              <StyledText className="text-[#DAA520]">Eats</StyledText>
            </StyledText>
            
            {/* Loading Text */}
            <StyledText className="text-[#BC4A4D] text-base font-semibold">
              Loading...
            </StyledText>
          </StyledView>
        </StyledView>
    );
  }

  return (
      <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
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
            <StyledView className="flex-1 px-5 pt-12 pb-6 justify-center">

              {/* Logo and Brand */}
              <StyledView className="items-center mb-8">
                <StyledView 
                  className="w-20 h-20 rounded-full bg-white items-center justify-center mb-4"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <StyledImage
                      source={require('../../assets/images/logo.png')}
                      className="w-12 h-12"
                      resizeMode="contain"
                  />
                </StyledView>
                <StyledText className="text-3xl font-bold">
                  <StyledText className="text-[#BC4A4D]">Campus</StyledText>
                  <StyledText className="text-[#DAA520]">Eats</StyledText>
                </StyledText>
                <StyledText className="text-[#8B4513]/70 text-base mt-1">Welcome back!</StyledText>
              </StyledView>

              {/* Login Card */}
              <StyledView 
                className="bg-white rounded-2xl p-6"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                {/* Login Header */}
                <StyledText className="text-2xl font-bold text-center text-[#8B4513] mb-2">Sign In</StyledText>
                <StyledText className="text-sm text-center text-[#8B4513]/60 mb-6">
                  Enter your credentials to continue
                </StyledText>

                {/* Error Message */}
                {error ? (
                    <StyledView className="mb-4 p-4 bg-red-50 rounded-xl flex-row items-center">
                      <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                      <StyledText className="text-red-600 flex-1 text-sm">{error}</StyledText>
                    </StyledView>
                ) : null}

                {/* Email Input */}
                <StyledView className="mb-4">
                  <StyledTextInput
                      className="h-14 bg-[#DFD6C5]/30 rounded-xl px-4 text-[#8B4513] font-medium"
                      placeholder="Username/Email"
                      placeholderTextColor="#8B4513/50"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={{
                        borderWidth: 1,
                        borderColor: email ? '#BC4A4D' : 'rgba(139, 69, 19, 0.2)',
                      }}
                  />
                </StyledView>

                {/* Password Input */}
                <StyledView className="mb-4 relative">
                  <StyledTextInput
                      className="h-14 bg-[#DFD6C5]/30 rounded-xl px-4 pr-12 text-[#8B4513] font-medium"
                      placeholder="Password"
                      placeholderTextColor="#8B4513/50"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      style={{
                        borderWidth: 1,
                        borderColor: password ? '#BC4A4D' : 'rgba(139, 69, 19, 0.2)',
                      }}
                  />
                  <StyledTouchableOpacity
                      className="absolute right-4 top-4"
                      onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={22}
                        color="#8B4513"
                    />
                  </StyledTouchableOpacity>
                </StyledView>

                {/* Remember Me & Forgot Password */}
                <StyledView className="flex-row justify-between items-center mb-6">
                  <StyledTouchableOpacity
                      className="flex-row items-center"
                      onPress={() => setRememberMe(!rememberMe)}
                  >
                    <StyledView className={`w-5 h-5 rounded-md border-2 ${rememberMe ? 'bg-[#BC4A4D] border-[#BC4A4D]' : 'border-[#8B4513]/30'} mr-3 items-center justify-center`}>
                      {rememberMe && <Ionicons name="checkmark" size={14} color="white" />}
                    </StyledView>
                    <StyledText className="text-sm text-[#8B4513] font-medium">Remember me</StyledText>
                  </StyledTouchableOpacity>

                  <StyledTouchableOpacity onPress={() => router.push('/forgot-password' as any)}>
                    <StyledText className="text-sm text-[#BC4A4D] font-semibold">Forgot Password?</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>

                {/* Login Button */}
                <StyledTouchableOpacity
                    className="h-14 rounded-xl justify-center items-center mb-6"
                    style={{ 
                      backgroundColor: '#BC4A4D',
                      shadowColor: "#BC4A4D",
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      elevation: 4,
                    }}
                    onPress={handleTraditionalLogin}
                >
                  <StyledText className="text-white text-base font-bold">Sign In</StyledText>
                </StyledTouchableOpacity>

                {/* Divider */}
                <StyledView className="flex-row items-center mb-6">
                  <StyledView className="flex-1 h-px bg-[#8B4513]/20" />
                  <StyledText className="text-sm text-[#8B4513]/60 mx-4 font-medium">or continue with</StyledText>
                  <StyledView className="flex-1 h-px bg-[#8B4513]/20" />
                </StyledView>

                {/* Social Login Section */}
                <StyledView className="items-center mb-6">
                  <StyledView className="flex-row justify-center">
                    {/* Microsoft Button */}
                    <StyledTouchableOpacity
                        className="w-14 h-14 rounded-2xl bg-[#DFD6C5]/30 border border-[#8B4513]/20 items-center justify-center"
                        onPress={handleMicrosoftSignIn}
                        style={{
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 2,
                        }}
                    >
                      {/* Microsoft Logo - 4 colored squares */}
                      <StyledView className="w-6 h-6">
                        <StyledView className="flex-row">
                          <StyledView className="w-2.5 h-2.5 bg-[#F25022] mr-0.5" />
                          <StyledView className="w-2.5 h-2.5 bg-[#7FBA00]" />
                        </StyledView>
                        <StyledView className="flex-row mt-0.5">
                          <StyledView className="w-2.5 h-2.5 bg-[#00A4EF] mr-0.5" />
                          <StyledView className="w-2.5 h-2.5 bg-[#FFB900]" />
                        </StyledView>
                      </StyledView>
                    </StyledTouchableOpacity>
                  </StyledView>
                </StyledView>

                {/* Register Section */}
                <StyledView className="flex-row justify-center">
                  <StyledText className="text-sm text-[#8B4513]/70 font-medium">Don't have an account? </StyledText>
                  <StyledTouchableOpacity onPress={() => router.push('/signup' as any)}>
                    <StyledText className="text-sm text-[#BC4A4D] font-bold">Sign Up</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>
              </StyledView>

              {/* Help Section */}
              <StyledView className="items-center mt-6">
                <StyledView className="flex-row items-center justify-center">
                  <StyledText className="text-xs text-[#8B4513]/60 mr-1">Need help?</StyledText>
                  <StyledTouchableOpacity onPress={() => Linking.openURL('mailto:campuseatsv2@gmail.com?subject=Campus%20Eats%20Support%20Request')}>
                    <StyledText className="text-xs text-[#BC4A4D] font-semibold underline">Contact Support</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>
              </StyledView>

            </StyledView>
          </StyledScrollView>
        </KeyboardAvoidingView>

        {/* Login Error Modal */}
        {showErrorModal && (
          <Modal
            visible={showErrorModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowErrorModal(false)}
          >
            <StyledView className="flex-1 justify-center items-center bg-black/50 p-6">
              <StyledView className="bg-white rounded-3xl w-full max-w-[350px] overflow-hidden">
                <StyledView className="p-8">
                  {/* Error Icon */}
                  <StyledView className="items-center mb-6">
                    <StyledView className="w-20 h-20 rounded-full bg-red-100 items-center justify-center mb-4">
                      <Ionicons name="alert-circle" size={50} color="#EF4444" />
                    </StyledView>
                    <StyledView className="items-center">
                      <StyledText className="text-2xl font-bold text-gray-900 mb-2">
                        Login Failed
                      </StyledText>
                      <StyledText className="text-base text-gray-600 text-center leading-6">
                        {errorModalMessage}
                      </StyledText>
                    </StyledView>
                  </StyledView>

                  {/* Decorative Security Icon */}
                

                  {/* Contact Support Link for Banned Users */}
                  {errorModalMessage.toLowerCase().includes('banned') && (
                    <StyledView className="items-center mb-4">
                      <StyledTouchableOpacity 
                        onPress={() => Linking.openURL('mailto:campuseatsv2@gmail.com?subject=Campus%20Eats%20Banned%20Account%20Appeal')}
                        className="flex-row items-center"
                      >
                        <Ionicons name="mail" size={16} color="#BC4A4D" />
                        <StyledText className="text-sm text-[#BC4A4D] font-semibold underline ml-1">
                          Contact Support
                        </StyledText>
                      </StyledTouchableOpacity>
                    </StyledView>
                  )}

                  {/* Action Buttons */}
                  <StyledView className="space-y-3">
                    <StyledTouchableOpacity
                      className="bg-[#BC4A4D] p-4 rounded-2xl"
                      onPress={() => {
                        setShowErrorModal(false);
                        setError(''); // Clear any existing error text
                      }}
                    >
                      <StyledView className="flex-row items-center justify-center">
                        <Ionicons name="refresh" size={20} color="white" />
                        <StyledText className="text-white text-base font-bold ml-2">
                          Try Again
                        </StyledText>
                      </StyledView>
                    </StyledTouchableOpacity>

                  </StyledView>
                </StyledView>
              </StyledView>
            </StyledView>
          </Modal>
        )}

      </StyledSafeAreaView>
  );
}