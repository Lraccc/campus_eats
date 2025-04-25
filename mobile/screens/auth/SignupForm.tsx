import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import { router } from 'expo-router';
import { authService } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';
import { useNavigation } from '@react-navigation/native';

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
    <View style={styles.requirementsContainer}>
      <Text style={styles.requirementsTitle}>Password Requirements</Text>
      {requirements.map((req, index) => (
        <View key={index} style={styles.requirementRow}>
          <Text style={[styles.requirementDot, { color: req.test(password) ? '#4CAF50' : '#FF5252' }]}>
            {req.test(password) ? '●' : '○'}
          </Text>
          <Text style={[styles.requirementText, { color: req.test(password) ? '#4CAF50' : '#666' }]}>
            {req.text}
          </Text>
        </View>
      ))}
    </View>
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo and Header Section */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
          />
          <Text style={styles.brandName}>CampusEats</Text>
          <Text style={styles.title}>Get Started</Text>
          <Text style={styles.subtitle}>already have an account? <Text style={styles.signInLink} onPress={() => router.push('/')}>Sign In</Text></Text>
        </View>

        {/* Form Section */}
        <View style={styles.form}>
          {/* Email Input */}
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />
          {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

          {/* Name Fields */}
          <View style={styles.nameContainer}>
            <View style={styles.nameInput}>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                editable={!isLoading}
              />
              {errors.firstName ? <Text style={styles.error}>{errors.firstName}</Text> : null}
            </View>

            <View style={styles.nameInput}>
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                editable={!isLoading}
              />
              {errors.lastName ? <Text style={styles.error}>{errors.lastName}</Text> : null}
            </View>
          </View>

          {/* Username Input */}
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!isLoading}
          />
          {errors.username ? <Text style={styles.error}>{errors.username}</Text> : null}

          {/* Password Input */}
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
            onFocus={() => setShowRequirements(true)}
            onBlur={() => setShowRequirements(false)}
          />
          {showRequirements && <PasswordRequirements password={password} />}
          {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

          {/* Confirm Password Input */}
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!isLoading}
          />
          {errors.confirmPassword ? <Text style={styles.error}>{errors.confirmPassword}</Text> : null}

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          {/* Help Center Link */}
          <TouchableOpacity
            style={styles.helpCenter}
            onPress={() => router.push('/help' as any)}
          >
            <Text style={styles.helpText}>
              Need help? Visit our <Text style={styles.helpLink}>help center</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  brandName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  signInLink: {
    color: '#8B4513',
    fontWeight: 'bold',
  },
  form: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  nameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nameInput: {
    flex: 0.48,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 16,
  },
  error: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
    paddingLeft: 4,
  },
  button: {
    backgroundColor: '#ae4e4e',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpCenter: {
    alignItems: 'center',
  },
  helpText: {
    color: '#666',
    fontSize: 12,
  },
  helpLink: {
    color: '#8B4513',
    textDecorationLine: 'underline',
  },
  requirementsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  requirementDot: {
    fontSize: 16,
    marginRight: 8,
  },
  requirementText: {
    fontSize: 14,
    color: '#666',
  },
} as const);