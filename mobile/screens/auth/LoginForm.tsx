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
} from 'react-native';
import { router } from 'expo-router';
import { authService } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';

// Import the authentication hook for OAuth login
import { useAuthentication } from '../../services/authService';

export default function LoginForm() {
  // Traditional login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoadingTraditional, setIsLoadingTraditional] = useState(false);

  // OAuth login state and functionality
  const {
    signIn,
    isLoggedIn,
    isLoading: isLoadingOAuth,
    authState
  } = useAuthentication();

  // Effect to handle navigation after successful OAuth login
  useEffect(() => {
    if (isLoggedIn) {
      // Navigate to the main app area after OAuth login
      router.replace('/home');
    }
  }, [isLoggedIn]);

  // Traditional login handler
  const handleTraditionalLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoadingTraditional(true);
    setError('');

    try {
      const response = await authService.login({
        email,
        password
      });

      // Store the token in AsyncStorage
      if (response.token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);
        // Navigate to the main app
        router.replace('/home');
      } else {
        setError('Login successful but no token received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ae4e4e" />
          <Text>Signing in...</Text>
        </View>
    );
  }

  return (
      <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
      >
        <View style={styles.content}>
          {/* Logo and Brand */}
          <View style={styles.logoContainer}>
            <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logo}
            />
            <Text style={styles.brandName}>
              <Text style={styles.brandNameBrown}>Campus</Text>
              <Text style={styles.brandNameYellow}>Eats</Text>
            </Text>
          </View>

          {/* Login Header */}
          <Text style={styles.title}>Login</Text>
          <Text style={styles.subtitle}>Welcome back</Text>

          {/* Error Message */}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Login Form */}
          <View style={styles.formContainer}>
            {/* Username/Email Input */}
            <View style={styles.inputContainer}>
              <TextInput
                  style={styles.input}
                  placeholder="Username/Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
              />
              <TouchableOpacity
                  style={styles.forgotLink}
                  onPress={() => router.push('/forgot-username' as any)}
              >
                <Text style={styles.forgotText}>Forgot Username?</Text>
              </TouchableOpacity>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
              />
              <TouchableOpacity
                  style={styles.forgotLink}
                  onPress={() => router.push('/forgot-password' as any)}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
                style={styles.loginButton}
                onPress={handleTraditionalLogin}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>

            {/* Social Login Section */}
            <View style={styles.socialContainer}>
              <Text style={styles.socialText}>Or login in with</Text>
              <View style={styles.socialButtonsRow}>
                {/* Google Button */}
                <TouchableOpacity
                    style={styles.socialButton}
                    onPress={handleGoogleSignIn}
                >
                  <Text style={styles.socialButtonIcon}>G</Text>
                  <Text style={styles.socialButtonText}>Google</Text>
                </TouchableOpacity>

                {/* Microsoft Button */}
                <TouchableOpacity
                    style={[styles.socialButton, styles.microsoftButton]}
                    onPress={handleMicrosoftSignIn}
                >
                  <Text style={styles.socialButtonIcon}>M</Text>
                  <Text style={styles.socialButtonText}>Microsoft</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Register Section */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/signup' as any)}>
                <Text style={styles.registerLink}>Register</Text>
              </TouchableOpacity>
            </View>

            {/* Help Section */}
            <View style={styles.helpContainer}>
              <Text style={styles.helpText}>
                Need help? Visit our
                <TouchableOpacity onPress={() => router.push('/help' as any)}>
                  <Text style={styles.helpLink}> help center</Text>
                </TouchableOpacity>
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fae9e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 8,
    borderRadius: 30,
  },
  brandName: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  brandNameBrown: {
    color: '#8B4513',
  },
  brandNameYellow: {
    color: '#FFD700',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  error: {
    color: '#ff3b30',
    marginBottom: 16,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  forgotText: {
    color: '#666',
    fontSize: 12,
  },
  loginButton: {
    height: 50,
    backgroundColor: '#ae4e4e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  socialContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  socialText: {
    color: '#666',
    marginBottom: 16,
  },
  socialButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4', // Google blue
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    marginHorizontal: 4,
  },
  microsoftButton: {
    backgroundColor: '#0078D4', // Microsoft blue
  },
  socialButtonIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  socialButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  registerText: {
    color: '#666',
    fontSize: 14,
  },
  registerLink: {
    color: '#8B4513',
    fontSize: 14,
    fontWeight: 'bold',
  },
  helpContainer: {
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
});