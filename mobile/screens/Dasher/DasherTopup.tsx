import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image, Linking, AppState, Animated, Modal } from "react-native";
import { router } from "expo-router";
import { useAuthentication } from "../../services/authService";
import axios from "axios";
import { API_URL } from "../../config";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from "../../components/BottomNavigation";
import { walletService } from "../../services/walletService";
import { webSocketService } from "../../services/webSocketService";
import { Ionicons } from '@expo/vector-icons';

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

  // Custom alert modal state
  const [alertModal, setAlertModal] = useState({
    visible: false,
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
    onConfirm: (() => {}) as (() => void) | null,
    showCancelButton: false,
    onCancel: (() => {}) as (() => void) | null,
  });

  const showAlert = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    onConfirm?: () => void,
    showCancelButton?: boolean,
    onCancel?: () => void
  ) => {
    setAlertModal({
      visible: true,
      type,
      title,
      message,
      onConfirm: onConfirm || null,
      showCancelButton: showCancelButton || false,
      onCancel: onCancel || null,
    });
  };

  const closeAlert = () => {
    setAlertModal({
      ...alertModal,
      visible: false,
    });
  };

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
      showAlert('error', 'Error', 'Failed to fetch dasher data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {

    // Function to check if a URL is a Xendit success or failure URL
    const checkXenditUrl = async (url: string) => {
      console.log("Checking URL:", url);
      
      // Handle campus-eats://payment/success or campus-eats://payment/failed
      if (url.includes('campus-eats://payment/')) {
        console.log("Payment redirect URL detected");
        
        if (url.includes('/success')) {
          console.log("✅ Payment success redirect detected");
          
          // If we were waiting for payment, handle it as success
          if (waitingForPayment && dasherData?.id) {
            try {
              console.log(`Updating wallet for dasher ${dasherData.id} with amount ${topupAmount}`);
              
              // Update dasher wallet after successful payment
              const updateResponse = await axios.put(
                `${API_URL}/api/dashers/update/${dasherData.id}/wallet`,
                null,
                { params: { amountPaid: topupAmount } }
              );
              
              console.log('Wallet update response:', updateResponse.data);
              
              // Clear waiting state
              setWaitingForPayment(false);
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = undefined;
              }
              
              // Refresh dasher data and notify wallet service
              await fetchDasherData();
              await walletService.updateWalletAfterTransaction(dasherData.id, 'dasher', 'topup');
              
              showAlert('success', 'Success', 'Payment successful! Your wallet has been updated.', () => {
                closeAlert();
                router.back();
              });
              return true;
            } catch (error) {
              console.error("Error updating wallet:", error);
              showAlert('error', 'Error', 'Payment was successful but wallet update failed. Please contact support.');
              setWaitingForPayment(false);
              return true;
            }
          }
        } else if (url.includes('/failed')) {
          console.log("❌ Payment failure redirect detected");
          
          // Clear waiting state
          setWaitingForPayment(false);
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = undefined;
          }
          
          showAlert('error', 'Payment Failed', 'Your payment was not successful. Please try again.');
          return true;
        }
      }
      
      // Handle Xendit test success redirection (fallback)
      if (url.includes('xendit') && url.includes('success')) {
        console.log("Xendit test payment success detected (direct URL)");
        if (waitingForPayment && dasherData?.id) {
          handleTestPayment(true);
          return true;
        }
      }
      
      // Handle Xendit test failure redirection (fallback)
      if (url.includes('xendit') && url.includes('fail')) {
        console.log("Xendit test payment failure detected (direct URL)");
        if (waitingForPayment) {
          handleTestPayment(false);
          return true;
        }
      }
      
      return false;
    };
    
    // Handler for deep links (for payment callbacks)
    const handleDeepLink = async (event: { url: string }) => {
      console.log("Deep link received:", event.url);
      
      // Process the URL to check if it's a payment callback
      await checkXenditUrl(event.url);
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
    console.log(`Polling payment status for charge ID: ${linkId}`);
    
    try {
      // Call backend verification endpoint
      console.log(`Making request to: ${API_URL}/api/payments/verify-payment-status/${linkId}`);
      const response = await axios.get(`${API_URL}/api/payments/verify-payment-status/${linkId}`);
      console.log("Full response from API:", JSON.stringify(response.data, null, 2));
      
      const paymentStatus = response.data.status;
      console.log("Payment status from API:", paymentStatus);
      
      if (paymentStatus === 'SUCCEEDED') {
        console.log('✅ Payment status is SUCCEEDED - updating wallet');
        setWaitingForPayment(false);
        clearInterval(pollInterval);
        pollInterval = undefined;
        
        // Update dasher wallet after successful payment
        if (dasherData?.id) {
          try {
            console.log(`Updating wallet for dasher ${dasherData.id} with amount ${topupAmount}`);
            const updateResponse = await axios.put(
              `${API_URL}/api/dashers/update/${dasherData.id}/wallet`, 
              null, 
              { params: { amountPaid: topupAmount } }
            );
            console.log('✅ Wallet update response:', updateResponse.data);
            
            // Refresh dasher data and notify wallet service
            await fetchDasherData();
            await walletService.updateWalletAfterTransaction(dasherData.id, 'dasher', 'topup');
            
            showAlert('success', 'Success', 'Payment successful! Your wallet has been updated.', () => {
              closeAlert();
              router.back();
            });
          } catch (updateError) {
            console.error('❌ Error updating wallet:', updateError);
            showAlert('error', 'Error', 'Payment was successful but updating wallet failed. Please contact support.');
          }
        }
      } else if (paymentStatus === 'FAILED' || paymentStatus === 'EXPIRED') {
        console.log(`❌ Payment ${paymentStatus.toLowerCase()}`);
        setWaitingForPayment(false);
        clearInterval(pollInterval);
        pollInterval = undefined;
        showAlert('error', 'Payment Failed', `Your payment ${paymentStatus.toLowerCase()}. Please try again.`);
      } else {
        console.log(`⏳ Payment not yet completed, status: ${paymentStatus}`);
      }
    } catch (error: any) {
      console.error("❌ Payment status check error - Full error:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      
      // Check if this is a 404 or "resource not found" error
      if (error.response?.status === 404) {
        console.log("⚠️ Payment charge not found - may have been completed already");
        // Don't treat as error, just log it
      } else if (error.response?.status >= 500) {
        console.error("🔴 Server error when checking payment status");
      }
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
        
        showAlert('success', 'Success', 'Test payment successful! Your wallet has been updated.', () => {
          closeAlert();
          router.back();
        });
      } catch (error: any) {
        console.error("Error updating wallet after test payment:", error);
        showAlert('error', 'Error', 'Failed to update wallet after test payment.');
      }
    } else {
      showAlert('warning', 'Test Payment', success ? 'Payment successful but dasher data not found.' : 'Test payment failed/expired.');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    if (!dasherData?.id) {
      showAlert('error', 'Error', 'User ID not found. Please try logging in again.');
      setLoading(false);
      return;
    }
    
    console.log("Topup amount:", topupAmount);
    if(topupAmount < 100) {
      showAlert('warning', 'Amount Too Low', 'Minimum topup amount is ₱100.');
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
        platform: 'mobile',  // Specify mobile platform for deep link redirects
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
            
            // Force a specific check for Xendit test payments
            console.log('Manually checking for test payment completion...');
            if (isTestPayment && waitingForPayment) {
              // For test payments, assume success when returning to the app
              // This is specifically for Xendit test payment flow
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
        showAlert('error', 'Error', 'Could not open payment page. Please try again.');
        setWaitingForPayment(false);
        setLoading(false);
      }
      
      setLoading(false);
    } catch (error: any) {
      console.error("Error creating GCash payment:", error);
      showAlert('error', 'Error', error.response?.data?.message || 'Failed to create payment link.');
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
              
              {/* Manual completion button for when auto-detection fails */}
              {waitingForPayment && (
                <View style={styles.manualCompleteContainer}>
                  <Text style={styles.manualCompleteText}>
                    Already completed payment in GCash?
                  </Text>
                  <TouchableOpacity
                    style={styles.manualCompleteButton}
                    onPress={() => handleTestPayment(true)}
                  >
                    <Text style={styles.manualCompleteButtonText}>
                      ✓ I've Completed Payment
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.warningText}>
                    ⚠️ Only click this if you've successfully paid in GCash
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Custom Alert Modal */}
      <Modal
        visible={alertModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeAlert}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            {/* Icon */}
            <View style={[
              styles.alertIconContainer,
              alertModal.type === 'success' && styles.successIconBg,
              alertModal.type === 'error' && styles.errorIconBg,
              alertModal.type === 'warning' && styles.warningIconBg,
              alertModal.type === 'info' && styles.infoIconBg,
            ]}>
              <Ionicons 
                name={
                  alertModal.type === 'success' ? 'checkmark-circle' :
                  alertModal.type === 'error' ? 'close-circle' :
                  alertModal.type === 'warning' ? 'warning' :
                  'information-circle'
                }
                size={64} 
                color={
                  alertModal.type === 'success' ? '#4CAF50' :
                  alertModal.type === 'error' ? '#F44336' :
                  alertModal.type === 'warning' ? '#FF9800' :
                  '#2196F3'
                }
              />
            </View>

            {/* Title */}
            <Text style={styles.alertTitle}>{alertModal.title}</Text>

            {/* Message */}
            <Text style={styles.alertMessage}>{alertModal.message}</Text>

            {/* Buttons */}
            <View style={styles.alertButtons}>
              {alertModal.showCancelButton && (
                <TouchableOpacity
                  style={[styles.alertButton, styles.alertCancelButton]}
                  onPress={() => {
                    if (alertModal.onCancel) {
                      alertModal.onCancel();
                    }
                    closeAlert();
                  }}
                >
                  <Text style={styles.alertCancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[
                  styles.alertButton, 
                  styles.alertConfirmButton,
                  alertModal.showCancelButton && { flex: 1 }
                ]}
                onPress={() => {
                  if (alertModal.onConfirm) {
                    alertModal.onConfirm();
                  } else {
                    closeAlert();
                  }
                }}
              >
                <Text style={styles.alertConfirmText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    color: '#8B4513',
  },
  subtitle: {
    fontSize: 14,
    color: '#8B4513',
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
    color: '#8B4513',
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
  manualCompleteContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  manualCompleteText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    marginBottom: 10,
  },
  manualCompleteButton: {
    backgroundColor: '#28A745',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  manualCompleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  alertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconBg: {
    backgroundColor: '#E8F5E9',
  },
  errorIconBg: {
    backgroundColor: '#FFEBEE',
  },
  warningIconBg: {
    backgroundColor: '#FFF3E0',
  },
  infoIconBg: {
    backgroundColor: '#E3F2FD',
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  alertButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  alertButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  alertCancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    flex: 1,
  },
  alertConfirmButton: {
    backgroundColor: '#BC4A4D',
    flex: 1,
  },
  alertCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  alertConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default DasherTopup; 