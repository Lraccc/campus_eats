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
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { authService } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY, API_URL } from '../../config';
import axios from 'axios';

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
    // Only run this effect when login is successful
    if (isLoggedIn && authState?.idToken) {
      const navigateBasedOnAccountType = async () => {
        try {
          // Get accountType from AsyncStorage
          const accountType = await AsyncStorage.getItem('accountType');
          console.log('OAuth accountType:', accountType);
          
          if (accountType === 'shop') {
            console.log('OAuth User is a shop, redirecting to shop home');
            router.replace('/shop' as any);
          } else {
            console.log('OAuth User is a regular user, redirecting to home');
            router.replace('/home');
          }
        } catch (error) {
          console.error('Error processing OAuth login:', error);
          router.replace('/home');
        }
      };
      
      // Execute the navigation function
      navigateBasedOnAccountType();
    }
  }, [isLoggedIn, authState?.idToken]); // Only depend on idToken, not the entire authState

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
              console.error('Error fetching user data:', error.response?.data || error.message);
              if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response headers:', error.response.headers);
              }
              router.replace('/home');
            }
          } else {
            console.log('No userId in token payload:', payload);
            router.replace('/home');
          }
        } else {
          console.log('Invalid token format');
          router.replace('/home');
        }
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
                  editable={!isLoading}
                  autoCorrect={false}
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
                  editable={!isLoading}
                  autoCorrect={false}
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
                style={[styles.loginButton, isLoading ? styles.disabledButton : null]}
                onPress={handleTraditionalLogin}
                disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
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
              <View style={styles.helpInnerContainer}>
                <Text style={styles.helpText}>Need help?</Text>
                <TouchableOpacity onPress={() => Linking.openURL('mailto:campuseatsv2@gmail.com?subject=Campus%20Eats%20Support%20Request')}>
                  <Text style={styles.helpLink}>Contact us</Text>
                </TouchableOpacity>
              </View>
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
  disabledButton: {
    backgroundColor: '#d3a0a0',
    opacity: 0.7,
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
  helpInnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: {
    color: '#666',
    fontSize: 12,
    marginRight: 5,
  },
  helpLink: {
    color: '#8B4513',
    textDecorationLine: 'underline',
    fontSize: 12,
  },
});