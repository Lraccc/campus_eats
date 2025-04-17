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

  // Track which login type is being shown
  const [loginType, setLoginType] = useState('traditional'); // 'traditional' or 'oauth'

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
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&auto=format&fit=crop&q=80' }}
          style={styles.logo}
        />
        <Text style={styles.brandName}>
          <Text style={styles.brandNameBrown}>Campus</Text>
          <Text style={styles.brandNameYellow}>Eats</Text>
        </Text>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>Welcome back</Text>
      </View>

      <View style={styles.form}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Login Type Toggle */}
        <View style={styles.loginTypeToggle}>
          <TouchableOpacity 
            style={[
              styles.toggleButton, 
              loginType === 'traditional' && styles.activeToggleButton
            ]}
            onPress={() => setLoginType('traditional')}
          >
            <Text style={[
              styles.toggleButtonText,
              loginType === 'traditional' && styles.activeToggleButtonText
            ]}>
              Email/Username
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.toggleButton, 
              loginType === 'oauth' && styles.activeToggleButton
            ]}
            onPress={() => setLoginType('oauth')}
          >
            <Text style={[
              styles.toggleButtonText,
              loginType === 'oauth' && styles.activeToggleButtonText
            ]}>
              Microsoft
            </Text>
          </TouchableOpacity>
        </View>

        {loginType === 'traditional' ? (
          <>
            <View style={styles.inputWrapper}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email or Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email or username"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.forgotPasswordContainer}>
                <TouchableOpacity onPress={() => router.push('/forgot-username' as any)}>
                  <Text style={styles.forgotPasswordText}>Forgot Username?</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/forgot-password' as any)}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleTraditionalLogin}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.loginButton, styles.microsoftButton]}
            onPress={handleMicrosoftSignIn}
          >
            <Text style={styles.loginButtonText}>Sign in with Microsoft</Text>
          </TouchableOpacity>
        )}

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/signup' as any)}>
            <Text style={styles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.helpCenter}
          onPress={() => router.push('/help' as any)}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fae9e0',
    justifyContent: 'center',
    alignItems: 'center',
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
    borderRadius: 25,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
  },
  brandNameBrown: {
    color: '#8B4513',
  },
  brandNameYellow: {
    color: '#FFD700',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  form: {
    paddingHorizontal: 24,
  },
  error: {
    color: '#ff3b30',
    marginBottom: 10,
    textAlign: 'center',
  },
  loginTypeToggle: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: '#f0dfd3',
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeToggleButton: {
    backgroundColor: '#ae4e4e',
  },
  toggleButtonText: {
    fontWeight: '500',
    color: '#666',
  },
  activeToggleButtonText: {
    color: '#fff',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
    paddingLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  forgotPasswordContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  forgotPasswordText: {
    color: '#666',
    fontSize: 12,
  },
  loginButton: {
    backgroundColor: '#ae4e4e',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  microsoftButton: {
    backgroundColor: '#0078d4',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  registerText: {
    color: '#666',
    fontSize: 14,
  },
  registerLink: {
    color: '#8B4513',
    fontSize: 14,
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
});