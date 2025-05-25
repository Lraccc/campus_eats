import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  SafeAreaView,
  StatusBar,
  TextInput
} from 'react-native';
import { router } from 'expo-router';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import axios from 'axios';
import { API_URL } from '../../config';
import { MaterialIcons } from '@expo/vector-icons';

export default function ShopCashOut() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [processingCashout, setProcessingCashout] = useState(false);
  const { getAccessToken } = useAuthentication();

  useEffect(() => {
    fetchShopInfo();
  }, []);

  const fetchShopInfo = async () => {
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        return;
      }

      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error("No user ID available");
        return;
      }

      const config = { headers: { Authorization: token } };
      const response = await axios.get(`${API_URL}/api/shops/${userId}`, config);

      setShopInfo(response.data);
    } catch (error) {
      console.error('Error fetching shop info:', error);
      Alert.alert('Error', 'Failed to load shop information');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchShopInfo();
  }, []);

  const handleCashout = async () => {
    if (!cashoutAmount || parseFloat(cashoutAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to cash out');
      return;
    }

    const amount = parseFloat(cashoutAmount);
    if (shopInfo && amount > shopInfo.wallet) {
      Alert.alert('Insufficient Balance', 'The amount exceeds your available balance');
      return;
    }

    try {
      setProcessingCashout(true);

      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        return;
      }

      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error("No user ID available");
        return;
      }

      const config = { headers: { Authorization: token } };

      // This is a placeholder for the actual cashout API endpoint
      // You'll need to replace this with the actual endpoint
      await axios.post(`${API_URL}/api/shops/cashout`, {
        shopId: userId,
        amount: amount
      }, config);

      Alert.alert(
          'Cashout Requested',
          'Your cashout request has been submitted successfully. Please allow 1-3 business days for processing.',
          [{ text: 'OK', onPress: () => {
              setCashoutAmount('');
              fetchShopInfo();
            }}]
      );
    } catch (error) {
      console.error('Error processing cashout:', error);
      Alert.alert('Error', 'Failed to process cashout request');
    } finally {
      setProcessingCashout(false);
    }
  };

  if (isLoading) {
    return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" backgroundColor="#fae9e0" />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#BC4A4D" />
            <Text style={styles.loadingText}>Loading shop information...</Text>
          </View>
        </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fae9e0" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cash Out</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView 
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>₱{shopInfo?.wallet?.toFixed(2) || '0.00'}</Text>
          </View>
          
          <View style={styles.cashoutForm}>
            <Text style={styles.formLabel}>Amount to Cash Out</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₱</Text>
              <TextInput
                style={styles.amountInput}
                value={cashoutAmount}
                onChangeText={setCashoutAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#999"
                editable={!processingCashout}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.cashoutButton, processingCashout && styles.disabledButton]}
              onPress={handleCashout}
              disabled={processingCashout}
            >
              {processingCashout ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.cashoutButtonText}>Request Cash Out</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.infoCard}>
            <MaterialIcons name="info-outline" size={24} color="#666" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Cash out requests are processed within 1-3 business days. The amount will be transferred to your registered bank account or mobile wallet.
            </Text>
          </View>
          
          <View style={styles.transactionHistorySection}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            {/* This would be populated with actual transaction history in a future update */}
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>No transaction history available yet.</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#BC4A4D',
  },
  cashoutForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 18,
    color: '#666',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 12,
    color: '#333',
  },
  cashoutButton: {
    backgroundColor: '#BC4A4D',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cashoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  infoCard: {
    backgroundColor: '#FFF0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  transactionHistorySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyStateContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});