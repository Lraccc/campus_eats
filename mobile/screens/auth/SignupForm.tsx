import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Linking,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { styled } from 'nativewind';
import { router } from 'expo-router';
import { authService } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledImage = styled(Image);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledSafeAreaView = styled(SafeAreaView);

interface PasswordRequirementsProps {
  password: string;
}

const PasswordRequirements = ({ password }: PasswordRequirementsProps) => {
  const requirements = [
    {
      test: (pass: string) => pass.length >= 8,
      text: 'At least 8 characters'
    },
    {
      test: (pass: string) => /[A-Z]/.test(pass),
      text: 'Contains an uppercase letter'
    },
    {
      test: (pass: string) => /[0-9]/.test(pass),
      text: 'Contains a number'
    },
    {
      test: (pass: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pass),
      text: 'Contains a symbol'
    }
  ];

  return (
      <StyledView className="bg-[#DFD6C5]/30 rounded-xl p-3 mt-2 mb-4 border border-[#8B4513]/20">
        <StyledText className="text-sm font-semibold text-[#8B4513] mb-2">Password Requirements</StyledText>
        {requirements.map((req, index) => (
            <StyledView key={index} className="flex-row items-center my-1">
              <Ionicons
                  name={req.test(password) ? "checkmark-circle" : "ellipse-outline"}
                  size={16}
                  color={req.test(password) ? "#BC4A4D" : "#8B4513"}
                  style={{ marginRight: 8 }}
              />
              <StyledText className={`text-sm ${req.test(password) ? 'text-[#BC4A4D] font-medium' : 'text-[#8B4513]/70'}`}>
                {req.text}
              </StyledText>
            </StyledView>
        ))}
      </StyledView>
  );
};

export default function SignupForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const [showRequirements, setShowRequirements] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigation = useNavigation();

  const validatePassword = (password: string) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;

    const issues = [];
    if (!hasUpperCase) issues.push('an uppercase letter');
    if (!hasNumber) issues.push('a number');
    if (!hasSymbol) issues.push('a symbol');
    if (!isLongEnough) issues.push('at least 8 characters');

    return {
      isValid: hasUpperCase && hasNumber && hasSymbol && isLongEnough,
      message: issues.length > 0 ? `Password must contain ${issues.join(', ')}` : '',
    };
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
    };

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
      isValid = false;
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
      isValid = false;
    }

    if (!email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
      isValid = false;
    }

    if (!username.trim()) {
      newErrors.username = 'Username is required';
      isValid = false;
    }

    const passwordValidation = validatePassword(password);
    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.message;
      isValid = false;
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    console.log('Signup button clicked');
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    setIsLoading(true);
    setErrors({
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
    });

    try {
      console.log('Attempting signup with data:', {
        firstName,
        lastName,
        email,
        username,
        password: '***',
      });

      const response = await authService.signup({
        firstName,
        lastName,
        email,
        username,
        password,
      });

      console.log('Signup response:', response);

      // Navigate to OTP verification screen
      console.log('Navigating to OTP verification screen');
      router.push({
        pathname: '/otp-verification',
        params: { email },
      });
    } catch (err) {
      console.error('Signup error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setErrors(prev => ({
        ...prev,
        email: errorMessage.includes('email') ? errorMessage : '',
        username: errorMessage.includes('username') ? errorMessage : '',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
        <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
        >
          <StyledScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
          >
            <StyledView className="flex-1 px-5 pt-10 pb-6">

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
                <StyledText className="text-[#8B4513]/70 text-base mt-1">Create your account</StyledText>
              </StyledView>

              {/* Signup Card */}
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
                {/* Signup Header */}
                <StyledText className="text-2xl font-bold text-center text-[#8B4513] mb-2">Create Account</StyledText>
                <StyledView className="flex-row justify-center mb-6">
                  <StyledText className="text-sm text-[#8B4513]/70 font-medium">Already have an account? </StyledText>
                  <StyledTouchableOpacity onPress={() => router.push('/')}>
                    <StyledText className="text-sm text-[#BC4A4D] font-bold">Sign In</StyledText>
                  </StyledTouchableOpacity>
                </StyledView>

                {/* Email Input */}
                <StyledView className="mb-4">
                  <StyledTextInput
                      className="h-14 bg-[#DFD6C5]/30 rounded-xl px-4 text-[#8B4513] font-medium"
                      placeholder="Email Address"
                      placeholderTextColor="#8B4513/50"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!isLoading}
                      style={{
                        borderWidth: 1,
                        borderColor: email ? '#BC4A4D' : 'rgba(139, 69, 19, 0.2)',
                      }}
                  />
                  {errors.email ? <StyledText className="text-xs text-red-500 mt-1 pl-1">{errors.email}</StyledText> : null}
                </StyledView>

                {/* Name Fields */}
                <StyledView className="flex-row justify-between mb-4">
                  <StyledView className="w-[48%]">
                    <StyledTextInput
                        className="h-14 bg-[#DFD6C5]/30 rounded-xl px-4 text-[#8B4513] font-medium"
                        placeholder="First Name"
                        placeholderTextColor="#8B4513/50"
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                        editable={!isLoading}
                        style={{
                          borderWidth: 1,
                          borderColor: firstName ? '#BC4A4D' : 'rgba(139, 69, 19, 0.2)',
                        }}
                    />
                    {errors.firstName ? <StyledText className="text-xs text-red-500 mt-1 pl-1">{errors.firstName}</StyledText> : null}
                  </StyledView>

                  <StyledView className="w-[48%]">
                    <StyledTextInput
                        className="h-14 bg-[#DFD6C5]/30 rounded-xl px-4 text-[#8B4513] font-medium"
                        placeholder="Last Name"
                        placeholderTextColor="#8B4513/50"
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                        editable={!isLoading}
                        style={{
                          borderWidth: 1,
                          borderColor: lastName ? '#BC4A4D' : 'rgba(139, 69, 19, 0.2)',
                        }}
                    />
                    {errors.lastName ? <StyledText className="text-xs text-red-500 mt-1 pl-1">{errors.lastName}</StyledText> : null}
                  </StyledView>
                </StyledView>

                {/* Username Input */}
                <StyledView className="mb-4">
                  <StyledTextInput
                      className="h-14 bg-[#DFD6C5]/30 rounded-xl px-4 text-[#8B4513] font-medium"
                      placeholder="Username"
                      placeholderTextColor="#8B4513/50"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      editable={!isLoading}
                      style={{
                        borderWidth: 1,
                        borderColor: username ? '#BC4A4D' : 'rgba(139, 69, 19, 0.2)',
                      }}
                  />
                  {errors.username ? <StyledText className="text-xs text-red-500 mt-1 pl-1">{errors.username}</StyledText> : null}
                </StyledView>

                {/* Password Input */}
                <StyledView className="mb-2 relative">
                  <StyledTextInput
                      className="h-14 bg-[#DFD6C5]/30 rounded-xl px-4 pr-12 text-[#8B4513] font-medium"
                      placeholder="Password"
                      placeholderTextColor="#8B4513/50"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!isLoading}
                      onFocus={() => setShowRequirements(true)}
                      onBlur={() => setShowRequirements(false)}
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
                {showRequirements && <PasswordRequirements password={password} />}
                {errors.password ? <StyledText className="text-xs text-red-500 mt-1 mb-3 pl-1">{errors.password}</StyledText> : null}

                {/* Confirm Password Input */}
                <StyledView className="mb-4 relative">
                  <StyledTextInput
                      className="h-14 bg-[#DFD6C5]/30 rounded-xl px-4 pr-12 text-[#8B4513] font-medium"
                      placeholder="Confirm Password"
                      placeholderTextColor="#8B4513/50"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      editable={!isLoading}
                      style={{
                        borderWidth: 1,
                        borderColor: confirmPassword ? '#BC4A4D' : 'rgba(139, 69, 19, 0.2)',
                      }}
                  />
                  <StyledTouchableOpacity
                      className="absolute right-4 top-4"
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                        name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                        size={22}
                        color="#8B4513"
                    />
                  </StyledTouchableOpacity>
                </StyledView>
                {errors.confirmPassword ? <StyledText className="text-xs text-red-500 -mt-3 mb-3 pl-1">{errors.confirmPassword}</StyledText> : null}

                {/* Sign Up Button */}
                <StyledTouchableOpacity
                    className={`h-14 rounded-xl items-center justify-center mb-4 ${isLoading ? 'opacity-70' : ''}`}
                    style={{ 
                      backgroundColor: '#BC4A4D',
                      shadowColor: "#BC4A4D",
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      elevation: 4,
                    }}
                    onPress={handleSubmit}
                    disabled={isLoading}
                >
                  {isLoading ? (
                      <ActivityIndicator color="#fff" />
                  ) : (
                      <StyledText className="text-white text-base font-bold">Create Account</StyledText>
                  )}
                </StyledTouchableOpacity>
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
      </StyledSafeAreaView>
  );
}