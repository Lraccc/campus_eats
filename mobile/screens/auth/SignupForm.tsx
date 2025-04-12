import React, { useState } from 'react';
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
} from 'react-native';

import { router } from 'expo-router';
import { authService } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';

export default function SignupForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    terms: '',
  });

  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      terms: '',
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

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    if (!agreeToTerms) {
      newErrors.terms = 'You must agree to the terms and conditions';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
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
      terms: '',
    });

    try {
      const response = await authService.signup({
        firstName,
        lastName,
        email,
        username,
        password,
      });

      // Store the token in AsyncStorage
      if (response.token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);
      }

      // Navigate to login page after successful signup
      router.replace('/');
    } catch (err) {
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
        <View style={styles.header}>
          <Image
              source={{ uri: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&auto=format&fit=crop&q=80' }}
              style={styles.logo}
          />
          <Text style={styles.brandName}>CampusEats</Text>
          <Text style={styles.title}>Get Started</Text>
          <View style={styles.loginPrompt}>
            <Text style={styles.loginText}>already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.form}>
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

          <View style={styles.nameContainer}>
            <View style={styles.nameInput}>
              <TextInput
                  style={styles.input}
                  placeholder="LastName"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  editable={!isLoading}
              />
              {errors.lastName ? <Text style={styles.error}>{errors.lastName}</Text> : null}
            </View>

            <View style={styles.nameInput}>
              <TextInput
                  style={styles.input}
                  placeholder="FirstName"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  editable={!isLoading}
              />
              {errors.firstName ? <Text style={styles.error}>{errors.firstName}</Text> : null}
            </View>
          </View>

          <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!isLoading}
          />
          {errors.username ? <Text style={styles.error}>{errors.username}</Text> : null}

          <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
          />
          {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

          <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!isLoading}
          />
          {errors.confirmPassword ? <Text style={styles.error}>{errors.confirmPassword}</Text> : null}

          <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setAgreeToTerms(!agreeToTerms)}
              disabled={isLoading}
          >
            <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]} />
            <Text style={styles.termsText}>I agree with the terms and conditions</Text>
          </TouchableOpacity>
          {errors.terms ? <Text style={styles.error}>{errors.terms}</Text> : null}

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

          <TouchableOpacity
              style={styles.helpCenter}
              onPress={() => router.push('/help')}
          >
            <Text style={styles.helpText}>
              Need help? Visit our <Text style={styles.helpLink}>help center</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  logo: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#8B4513',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#8B4513',
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    paddingHorizontal: 24,
  },
  nameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#8B4513',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#ae4e4e',
  },
  termsText: {
    color: '#666',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#ae4e4e',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  buttonDisabled: {
    opacity: 0.7,
  },
});