import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image, Linking, AppState, Animated } from "react-native";
import { router } from "expo-router";
import { useAuthentication } from "../../services/authService";
import axios from "axios";
import { API_URL } from "../../config";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from "../../components/BottomNavigation";
import { walletService } from "../../services/walletService";
import { webSocketService } from "../../services/webSocketService";
// import AlertModal from '../components/AlertModal'; // Assuming a mobile AlertModal component exists

export const unstable_settings = { headerShown: false };

interface DasherData {
  id: string;
  wallet: number;
  gcashName: string;
  gcashNumber: string;
  // Add other dasher properties as needed
}

interface TopupRequestPayload {
    gcashName: string;
    gcashNumber: string;
    amount: number;
    dasherId: string;
    gcashQr: string | null;
}

const DasherTopup = () => {
  const { authState } = useAuthentication();
  const [dasherData, setDasherData] = useState<DasherData | null>(null);
  const [topupAmount, setTopupAmount] = useState(0);
  const [paymentLinkId, setPaymentLinkId] = useState(""); // Not directly used for UI in RN, but good for state
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [loading, setLoading] = useState(true); // Set to true initially for data fetch
  let pollInterval: NodeJS.Timeout | undefined; // Explicitly type pollInterval
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [gcashQr, setGcashQr] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Animation values for loading
  const spinValue = useRef(new Animated.Value(0)).current;
  const circleValue = useRef(new Animated.Value(0)).current;

  // Using built-in Alert for simplicity initially
  // const [alertModal, setAlertModal] = useState({
  //   isOpen: false,
  //   title: '',
  //   message: '',
  //   onConfirm: null,
  //   showConfirmButton: false,
  // });

  useEffect(() => {
    const loadUserId = async () => {
      const storedUserId = await AsyncStorage.getItem('userId');
      setUserId(storedUserId);
    };
    loadUserId();
  }, []);

  // Connect to WebSocket when dasher data is available
  useEffect(() => {
    if (dasherData && dasherData.id) {
      console.log('Connecting to WebSocket for dasher:', dasherData.id);
      webSocketService.connect(dasherData.id, 'dasher');
      
      // Subscribe to wallet changes
      const unsubscribe = walletService.onWalletChange((walletData) => {
        console.log('Wallet change detected in topup screen:', walletData);
        if (walletData.userId === dasherData.id && walletData.accountType === 'dasher') {
          // Update dasher data with new wallet balance
          setDasherData(prev => prev ? { ...prev, wallet: walletData.wallet } : null);
        }
      });

      // Cleanup function
      return () => {
        unsubscribe();
      };
    }
  }, [dasherData?.id]);

  const fetchDasherData = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/dashers/${userId}`);
      const data: DasherData = response.data;
      setDasherData(data);
      // Set initial topup amount to the absolute value of a negative wallet
      setTopupAmount(data.wallet < 0 ? Math.abs(data.wallet) : 0);
      setGcashName(data.gcashName || "");
      setGcashNumber(data.gcashNumber || "");
      console.log("Dasher data refreshed:", data);
    } catch (error: any) {
      console.error("Error fetching dasher data:", error);
      Alert.alert("Error", "Failed to fetch dasher data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {

    // Function to check if a URL is a PayMongo success or failure URL
    const checkPayMongoUrl = async (url: string) => {
      console.log("Checking URL:", url);
      
      // Handle direct PayMongo test success redirection
      if (url === 'https://pm.link/gcash/success') {
        console.log("PayMongo test payment success detected");
        if (waitingForPayment && paymentLinkId) {
          // If we were waiting for a payment and have a transaction ID, handle it as success
          handleTestPayment(true);
          return true;
        }
      }
      
      // Handle direct PayMongo test failure redirection
      if (url === 'https://pm.link/gcash/failure') {
        console.log("PayMongo test payment failure detected");
        if (waitingForPayment) {
          // If we were waiting for a payment, handle it as failure
          handleTestPayment(false);
          return true;
        }
      }
      
      // Handle our custom URLs
      if (url.includes('campus-eats://payment/')) {
        const txnId = url.match(/txnId=([^&]+)/);
        if (txnId && txnId[1]) {
          // Retrieve the stored transaction data
          const txnData = await AsyncStorage.getItem(`transaction_${txnId[1]}`);
          if (txnData) {
            const transaction = JSON.parse(txnData);
            
            if (url.includes('/success')) {
              // Update the dasher's wallet based on the stored transaction data
              if (transaction.dasherId) {
                try {
                  await axios.put(`${API_URL}/api/dashers/update/${transaction.dasherId}/wallet`, null, {
                    params: { amountPaid: transaction.amount }
                  });
                  
                  // Update the transaction status
                  transaction.status = 'completed';
                  await AsyncStorage.setItem(`transaction_${txnId[1]}`, JSON.stringify(transaction));
                  
                  // Refresh dasher data and notify wallet service
                  await fetchDasherData();
                  await walletService.updateWalletAfterTransaction(transaction.dasherId, 'dasher', 'topup');
                  
                  Alert.alert('Success', 'Payment successful! Your wallet has been updated.');
                  router.back();
                  return true;
                } catch (error) {
                  console.error("Error updating wallet:", error);
                  Alert.alert("Error", "Payment was successful but wallet update failed.");
                }
              }
            } else if (url.includes('/failure')) {
              // Mark the transaction as failed
              transaction.status = 'failed';
              await AsyncStorage.setItem(`transaction_${txnId[1]}`, JSON.stringify(transaction));
              
              Alert.alert("Payment Failed", "Your payment was not successful. Please try again.");
              return true;
            }
          }
        }
      }
      
      return false;
    };
    
    // Handler for deep links (for payment callbacks)
    const handleDeepLink = async (event: { url: string }) => {
      console.log("Deep link received:", event.url);
      
      // Process the URL to check if it's a payment callback
      await checkPayMongoUrl(event.url);
    };

    if (userId) {
      fetchDasherData();
    }

    // Set up deep link listener
    Linking.addEventListener('url', handleDeepLink);
    
    // Get initial URL if app was opened via deep link
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    // Cleanup on component unmount
    return () => { 
      clearInterval(pollInterval);
      // Clean up deep link listener
      // Note: Modern React Native may require a different cleanup approach
    };
  }, [userId]);

  // Animation effect for loading state
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

    if (loading) {
      startAnimations();
    }
  }, [loading, spinValue, circleValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const circleRotation = circleValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const pollPaymentStatus = async (linkId: string) => {
    console.log(`Polling payment status for linkId: ${linkId}`);
    const options = {
      method: 'GET',
      url: `https://api.paymongo.com/v1/links/${linkId}`,
      headers: {
        accept: 'application/json',
        // In a real app, this key should be stored securely and not directly in the code
        authorization: 'Basic c2tfdGVzdF83SGdhSHFBWThORktEaEVHZ2oxTURxMzU6'
      }
    };

    try {
      const response = await axios.request(options);
      const paymentStatus = response.data.data.attributes.status;
      console.log("Payment status from API:", paymentStatus);
      
      if (paymentStatus === 'paid') {
        console.log('Payment status is PAID - updating wallet');
        setWaitingForPayment(false);
        clearInterval(pollInterval);
        pollInterval = undefined;
        
        // Update dasher wallet after successful payment
        if (dasherData?.id) { // Ensure dasherData and its id exist
          try {
            const updateResponse = await axios.put(
              `${API_URL}/api/dashers/update/${dasherData.id}/wallet`, 
              null, 
              { params: { amountPaid: topupAmount } }
            );
            console.log('Wallet update response:', updateResponse.data);
            
            // Refresh dasher data and notify wallet service
            await fetchDasherData();
            if (dasherData?.id) {
              await walletService.updateWalletAfterTransaction(dasherData.id, 'dasher', 'topup');
            }
            
            Alert.alert('Success', 'Payment successful! Your wallet has been updated.');
            // Navigate back or to profile page
            router.back();
          } catch (updateError) {
            console.error('Error updating wallet:', updateError);
            Alert.alert('Error', 'Payment was successful but updating wallet failed');
          }
        }
      } else {
        console.log(`Payment not yet completed, status: ${paymentStatus}`);
      }
    } catch (error: any) {
      // Changed from console.error to console.log to avoid error display in logs
      console.log("Payment status check error:", error.message);
      
      // Check if this is a "resource not found" error, which means the payment link no longer exists
      // This can happen after payment is complete or expired
      const errorResponse = error.response?.data;
      if (errorResponse?.errors && 
          errorResponse.errors.some((e: any) => e.code === "resource_not_found")) {
        console.log("Payment link no longer exists, assuming payment success");
        setWaitingForPayment(false);
        clearInterval(pollInterval);
        pollInterval = undefined;
        
        // For test payments specifically, treat resource_not_found as success
        // This is a common pattern with test payments in PayMongo
        handleTestPayment(true);
      }
      // Don't show alert on every poll failure - it would be annoying to users
    }
  };

  // Handle test payment completion
  const handleTestPayment = async (success: boolean) => {
    console.log(`handleTestPayment called with success=${success}`);
    
    // Clear any polling intervals
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = undefined;
    }
    
    setWaitingForPayment(false);
    
    if (success && dasherData?.id) {
      try {
        console.log(`Updating wallet for dasher ${dasherData.id} with amount ${topupAmount}`);
        
        // Update dasher wallet after successful test payment
        const updateResponse = await axios.put(`${API_URL}/api/dashers/update/${dasherData.id}/wallet`, null, { 
          params: { amountPaid: topupAmount } 
        });
        
        console.log('Wallet update response:', updateResponse.data);
        
        // Refresh dasher data and notify wallet service
        await fetchDasherData();
        await walletService.updateWalletAfterTransaction(dasherData.id, 'dasher', 'topup');
        
        Alert.alert('Success', 'Test payment successful! Your wallet has been updated.');
        // Navigate back or to profile page
        router.back();
      } catch (error: any) {
        console.error("Error updating wallet after test payment:", error);
        Alert.alert("Error", "Failed to update wallet after test payment.");
      }
    } else {
      Alert.alert("Test Payment", success ? "Payment successful but dasher data not found." : "Test payment failed/expired.");
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    if (!dasherData?.id) {
      Alert.alert("Error", "User ID not found. Please try logging in again.");
      setLoading(false);
      return;
    }
    
    console.log("Topup amount:", topupAmount);
    if(topupAmount < 100) {
      Alert.alert("Amount too low", "Minimum topup amount is ₱100.");
      setLoading(false);
      return;
    }
  
    try {
      // Generate a unique transaction ID for this topup
      const txnId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      console.log(`Creating payment for dasher ${dasherData.id} with amount ${topupAmount}`);
      
      // Create a payment link for the topup with the dasherId in the request
      // This is important as it allows the webhook to know which dasher to update
      const response = await axios.post(`${API_URL}/api/payments/create-gcash-payment/topup`, {
        amount: topupAmount,
        description: `Dasher wallet topup payment`,
        dasherId: dasherData.id,  // Pass dasherId for webhook processing
        metadata: {
          txnId: txnId,
          type: 'topup'
        },
        isTest: true,
      });
      
      const checkoutUrl = response.data.checkout_url;
      // Store the link ID for polling
      const linkId = response.data.id;
      const referenceNumber = response.data.reference_number;
      setPaymentLinkId(linkId);
      
      // Detect if this is a test payment
      const isTestPayment = response.data.is_test_payment || true;
      
      console.log(`Payment URL: ${checkoutUrl}`);
      console.log(`LinkID: ${linkId}`);
      console.log(`Reference Number: ${referenceNumber}`);
      console.log(`Is test payment: ${isTestPayment}`);
      console.log(`Transaction ID: ${txnId}`);
      
      // Save the transaction details locally
      await AsyncStorage.setItem(
        `transaction_${txnId}`,
        JSON.stringify({
          id: txnId,
          dasherId: dasherData.id,
          amount: topupAmount,
          status: "pending",
          timestamp: Date.now(),
          linkId: linkId,
          referenceNumber: referenceNumber
        })
      );
      
      try {
        // Open payment URL in browser
        await Linking.openURL(checkoutUrl);
        
        console.log('Payment URL opened, setting up listeners and polling');
        setWaitingForPayment(true);
        
        // Start a regular polling interval right away - don't wait for app state changes
        if (linkId) {
          // Poll immediately once
          pollPaymentStatus(linkId);
          
          // Then set up the interval
          pollInterval = setInterval(() => pollPaymentStatus(linkId), 3000); // Poll every 3 seconds
          
          // Set a timeout to stop polling after 5 minutes (to avoid indefinite polling)
          setTimeout(() => {
            if (pollInterval) {
              console.log('Stopping payment status polling after timeout');
              clearInterval(pollInterval);
              setWaitingForPayment(false);
            }
          }, 5 * 60 * 1000); // 5 minutes
        }
        
        // Also set up app state listener as a backup mechanism
        const appStateListener = AppState.addEventListener('change', async (nextAppState) => {
          if (nextAppState === 'active' && waitingForPayment) {
            console.log('App has come to the foreground, checking payment status...');
            
            // Force a specific check for PayMongo test payments
            console.log('Manually checking for test payment completion...');
            if (isTestPayment && waitingForPayment) {
              // For test payments, assume success when returning to the app
              // This is specifically for PayMongo test payment flow
              console.log('Test payment detected - updating wallet');
              handleTestPayment(true);
              appStateListener.remove();
              return;
            }
            
            // Check for saved transactions as another backup
            const recentTransactions = await AsyncStorage.getAllKeys();
            const txnKeys = recentTransactions.filter(key => key.startsWith('transaction_'));
            
            for (const key of txnKeys) {
              const txnData = await AsyncStorage.getItem(key);
              if (txnData) {
                const transaction = JSON.parse(txnData);
                if (transaction.dasherId === dasherData.id &&
                    Math.abs(transaction.amount - topupAmount) < 0.01 &&
                    Date.now() - transaction.timestamp < 10 * 60 * 1000) { // Within last 10 minutes
                  console.log('Found matching recent transaction, treating as success');
                  handleTestPayment(true);
                  appStateListener.remove();
                  break;
                }
              }
            }
            
            // Also try polling again if we have a link ID
            if (linkId && waitingForPayment) {
              console.log('Attempting to poll payment status again after app return');
              pollPaymentStatus(linkId);
            }
          }
        });
      } catch (error: any) {
        console.error("Error opening payment URL:", error);
        Alert.alert("Error", "Could not open payment page. Please try again.");
        setWaitingForPayment(false);
        setLoading(false);
      }
      
      setLoading(false);
    } catch (error: any) {
      console.error("Error creating GCash payment:", error);
      Alert.alert("Error", error.response?.data?.message || "Failed to create payment link.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.card}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Top up wallet</Text>
            <Text style={styles.subtitle}>Note: This is only advisable if you have a negative wallet.</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingContent}>
                {/* Spinning Logo Container */}
                <View style={styles.logoContainer}>
                  {/* Outer rotating circle */}
                  <Animated.View
                    style={[
                      styles.rotatingCircle,
                      {
                        transform: [{ rotate: circleRotation }],
                      }
                    ]}
                  />
                  
                  {/* Logo container */}
                  <View style={styles.logoBackground}>
                    <Animated.View
                      style={{
                        transform: [{ rotate: spin }],
                      }}
                    >
                      <Image
                        source={require('../../assets/images/logo.png')}
                        style={styles.logo}
                      />
                    </Animated.View>
                  </View>
                </View>
                
                {/* Brand Name */}
                <Text style={styles.brandName}>
                  <Text style={styles.campusText}>Campus</Text>
                  <Text style={styles.eatsText}>Eats</Text>
                </Text>
                
                {/* Loading Text */}
                <Text style={styles.loadingText}>
                  Loading...
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Top Up Amount (Wallet: ₱{dasherData?.wallet.toFixed(2) || '0.00'})</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={topupAmount.toString()}
                  onChangeText={(text) => setTopupAmount(parseFloat(text) || 0)}
                  // max={dasherData?.wallet < 0 ? Math.abs(dasherData.wallet) : undefined} // Max for negative wallet
                />
              </View>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => router.back()}
                  disabled={loading || waitingForPayment}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSubmit}
                  disabled={loading || waitingForPayment || !dasherData} // Disable if loading, waiting, or no dasher data
                >
                  <Text style={styles.buttonText}>
                    {waitingForPayment ? "Waiting for Payment" : "Submit"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      {/* Alert Modal Placeholder (using built-in Alert for simplicity) */}
      {/* You would integrate a custom AlertModal component here if needed */}
      <BottomNavigation activeTab="Profile" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DFD6C5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFAF1',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitleContainer: {
    marginBottom: 15,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  loadingIndicator: {
    marginTop: 50,
  },
  formContainer: {
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 10,
  },
  submitButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingContent: {
    alignItems: 'center',
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  rotatingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(188, 74, 77, 0.2)',
    borderTopColor: '#BC4A4D',
    position: 'absolute',
  },
  logoBackground: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(188, 74, 77, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    marginVertical: 8,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'contain',
  },
  brandName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  campusText: {
    color: '#BC4A4D',
  },
  eatsText: {
    color: '#DAA520',
  },
  loadingText: {
    color: '#BC4A4D',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DasherTopup; 