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
} from 'react-native';
import { router } from 'expo-router';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    router.replace('/(tabs)');
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
          <Text style={styles.title}>Login</Text>
          <Text style={styles.subtitle}>Welcome back</Text>
        </View>

        <View style={styles.form}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.inputWrapper}>
            <TextInput
                style={styles.input}
                placeholder="Username/Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
            />
            <TouchableOpacity
                style={styles.forgotText}
                onPress={() => router.push('/forgot-username')}
            >
              <Text style={styles.forgotLink}>Forgot Username?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrapper}>
            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
            />
            <TouchableOpacity
                style={styles.forgotText}
                onPress={() => router.push('/forgot-password')}
            >
              <Text style={styles.forgotLink}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>

          <Text style={styles.orText}>Or login in with</Text>

          <View style={styles.socialButtons}>
            <TouchableOpacity style={[styles.socialButton, styles.googleButton]}>
              <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1600783245891-d27a4ebd6655?w=800&auto=format&fit=crop&q=80' }}
                  style={styles.socialIcon}
              />
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.socialButton, styles.facebookButton]}>
              <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1600783245891-d27a4ebd6655?w=800&auto=format&fit=crop&q=80' }}
                  style={styles.socialIcon}
              />
              <Text style={[styles.socialButtonText, styles.facebookText]}>Facebook</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/signup')}>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </View>

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
    backgroundColor: '#FFF5F5',
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
  inputWrapper: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  forgotText: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  forgotLink: {
    color: '#666',
    fontSize: 12,
  },
  loginButton: {
    backgroundColor: '#8B4513',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 0.48,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  socialIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  facebookText: {
    color: '#FFFFFF',
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