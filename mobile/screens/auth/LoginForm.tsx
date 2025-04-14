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

// Import the authentication hook (corrected relative path)
import { useAuthentication } from '../../src/services/AuthService.js';

export default function LoginForm() {
  // Comment out state for username/password form
  // const [usernameOrEmail, setUsernameOrEmail] = useState('');
  // const [password, setPassword] = useState('');
  // const [error, setError] = useState('');
  // const [isLoading, setIsLoading] = useState(false); // Now using isLoading from hook

  // Use the authentication hook
  const { 
    signIn, 
    isLoggedIn, 
    isLoading, // Use isLoading from the hook
    authState, // Can be used to check details later
    getAccessToken, // Added getAccessToken function
  } = useAuthentication();

  // State for potential UI errors (optional, hook logs errors)
  const [uiError, setUiError] = useState(''); 

  // Effect to handle navigation after successful login
  useEffect(() => {
    if (isLoggedIn) {
      console.log("Login successful, navigating to home...");
      // Clear any previous UI errors on successful login
      setUiError(''); 
      // Navigate to the main app area
      router.replace('/home'); 
    }
  }, [isLoggedIn]); // Dependency array: run effect when isLoggedIn changes


  // Comment out the original handleLogin function
  /*
  const handleLogin = async () => {
    if (!usernameOrEmail || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authService.login({
        usernameOrEmail,
        password
      });

      // Store the token in AsyncStorage
      if (response.token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);
      }

      // Navigate to the main app
      router.replace('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  */

  // Function to initiate Microsoft Sign In
  const handleMicrosoftSignIn = async () => {
    setUiError(''); // Clear previous errors
    try {
      // The promptAsync logic is now handled within the hook's signIn function
      await signIn(); 
    } catch (error) {
      console.error("Microsoft Sign In initiation failed:", error);
      setUiError('Microsoft Sign In failed. Please try again.'); // Show UI error
    }
    // isLoading state is managed by the hook
  };


  // Show loading indicator based on the hook's state while auth process is running
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
          {/* Subtitle can remain or be updated */}
          <Text style={styles.subtitle}>Welcome back</Text> 
        </View>

        <View style={styles.form}>
          {/* Display UI Error if any */}
          {uiError ? <Text style={styles.error}>{uiError}</Text> : null}

          {/* Commented out Username/Password Fields */}
          {/* 
          <View style={styles.inputWrapper}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username or Email</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Enter your username or email"
                  value={usernameOrEmail}
                  onChangeText={setUsernameOrEmail}
                  autoCapitalize="none"
                  editable={!isLoading}
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
                  editable={!isLoading}
              />
            </View>

            <View style={styles.forgotPasswordContainer}>
              <TouchableOpacity onPress={() => router.push('/forgot-username')}>
                <Text style={styles.forgotPasswordText}>Forgot Username?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          </View> 
          */}

          {/* Original Login Button - Commented Out */}
          {/*
          <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
          >
            {isLoading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>
          */}

          {/* --- Microsoft Sign In Button --- */}
          <TouchableOpacity
              style={[styles.socialButton, styles.microsoftButton, isLoading && styles.buttonDisabled]} // Added microsoftButton style, disable if loading
              onPress={handleMicrosoftSignIn}
              disabled={isLoading} // Disable button while loading
          >
            {/* You might want to add a Microsoft icon here */}
            <Text style={styles.socialButtonText}>Sign In with Microsoft</Text>
          </TouchableOpacity>
          {/* --- End Microsoft Sign In Button --- */}


          {/* "Or login in with" and other social buttons - Keep or remove as needed */}
          {/* 
          <Text style={styles.orText}>Or login in with</Text>

          <View style={styles.socialButtons}>
            <TouchableOpacity style={[styles.socialButton, styles.googleButton]}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.socialButton, styles.facebookButton]}>
              <Text style={styles.facebookIcon}>f</Text>
              <Text style={[styles.socialButtonText, styles.facebookText]}>Facebook</Text>
            </TouchableOpacity>
          </View> 
          */}

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/signup')} disabled={isLoading}>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
              style={styles.helpCenter}
              onPress={() => router.push('/help' as any)} // Cast route to satisfy type checker for now
              disabled={isLoading}
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
    paddingTop: Platform.OS === 'android' ? 25 : 40, // Adjust padding for Android status bar
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
    flex: 1, // Allow form to take remaining space if needed
  },
  error: {
    color: '#ff3b30',
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 14,
  },
  // Commented out input styles if not needed
  /*
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
  */
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
  loginButtonDisabled: { // Style for disabled state (if needed)
    backgroundColor: '#cccccc', 
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 16,
  },
  socialButtons: {
    // Adjust layout if only Microsoft button remains
    // flexDirection: 'row', 
    // justifyContent: 'space-between', 
    marginBottom: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 12, // Add margin between social buttons
  },
  // Add style for Microsoft Button
  microsoftButton: {
    backgroundColor: '#0078D4', // Microsoft Blue
    borderColor: '#0078D4',
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  socialButtonText: {
    color: '#fff', // Default white text for colored buttons
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  googleIcon: {
    // Replace with an actual icon component if possible
    color: '#DB4437', 
    fontWeight: 'bold',
    fontSize: 18,
  },
  facebookIcon: {
    // Replace with an actual icon component if possible
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  facebookText: {
    color: '#fff',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  registerText: {
    color: '#666',
  },
  registerLink: {
    color: '#ae4e4e',
    fontWeight: '600',
    marginLeft: 4,
  },
  helpCenter: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30, // Add some bottom margin
  },
  helpText: {
    color: '#666',
  },
  helpLink: {
    color: '#ae4e4e',
    fontWeight: '600',
  },
  // Style for loading container
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fae9e0', // Match background
  },
   // Style for generic disabled button state
   buttonDisabled: {
     backgroundColor: '#cccccc',
     borderColor: '#cccccc',
   },
});