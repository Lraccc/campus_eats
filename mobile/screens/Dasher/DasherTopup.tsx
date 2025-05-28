import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image, Linking } from "react-native";
import { router } from "expo-router";
import { useAuthentication } from "../../services/authService";
import axios from "axios";
import { API_URL } from "../../config";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from "../../components/BottomNavigation";
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

  useEffect(() => {
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
      } catch (error: any) {
        console.error("Error fetching dasher data:", error);
        Alert.alert("Error", "Failed to fetch dasher data.");
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchDasherData();
    }

    // Cleanup interval on component unmount
    return () => { clearInterval(pollInterval); };
  }, [userId]);

  const pollPaymentStatus = async (linkId: string) => {
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
      console.log("Payment status:", paymentStatus);
      if (paymentStatus === 'paid') {
        setWaitingForPayment(false);
        clearInterval(pollInterval);
        // Update dasher wallet after successful payment
        if (dasherData?.id) { // Ensure dasherData and its id exist
             await axios.put(`${API_URL}/api/dashers/update/${dasherData.id}/wallet`, null, { params: { amountPaid: -(topupAmount) } });
             Alert.alert('Success', 'Payment successful!');
            // Navigate to profile or refresh data
            // router.push("/dasher/profile"); // Adjust route as needed
        }
      }
    } catch (error: any) {
      console.error("Error checking payment status:", error);
      Alert.alert("Error", "Failed to check payment status.");
      setWaitingForPayment(false); // Stop waiting on error
      clearInterval(pollInterval); // Stop polling on error
    }
  };

  const handleSubmit = async () => {
    // Debug values before validation
    console.log('Submit pressed with values:', {
      userId,
      amount
    });

    if (!userId) {
      console.error('Missing userId');
      Alert.alert("Error", "User ID not found. Please try logging in again.");
      return;
    }

    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      console.error('Missing or invalid amount');
      Alert.alert("Error", "Please enter a valid amount to top up.");
      return;
    }

    try {
      // Prepare the payload for the payment API
      const paymentPayload = {
        amount: parseFloat(amount),
        description: `Wallet top-up for dasher`
      };
      
      // Create the payment
      console.log("Creating payment with payload:", paymentPayload);
      const paymentResponse = await axios.post(`${API_URL}/api/payments/create-gcash-payment/topup`, paymentPayload);
      console.log("Payment response:", paymentResponse.data);
      
      if (paymentResponse.status === 200 || paymentResponse.status === 201) {
        // Check if there's a checkout URL in the response
        // The API returns checkout_url with underscore, not camelCase
        const checkoutUrl = paymentResponse.data?.checkout_url;
        console.log("Checkout URL from response:", checkoutUrl);
        
        if (checkoutUrl) {
          // Open the Paymongo checkout URL in the device's browser
          Linking.openURL(checkoutUrl);
          
          // Show a message to the user
          Alert.alert(
            "Redirecting to Payment", 
            "You will now be redirected to complete your payment. After payment, your wallet will be updated automatically."
          );
        } else {
          console.error("Response data:", JSON.stringify(paymentResponse.data));
          throw new Error("No checkout URL provided in the response");
        }
      } else {
        throw new Error("Payment creation failed");
      }
    } catch (error: any) {
      console.error("Error submitting topup:", error.message, error.response?.status, error.response?.data);
      Alert.alert("Error", error.response?.data?.message || "Failed to submit topup request. Please check your connection and try again.");
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
            <ActivityIndicator size="large" color="#BC4A4D" style={styles.loadingIndicator} />
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Top Up Amount (Wallet: ₱{dasherData?.wallet.toFixed(2) || '0.00'})</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={amount || topupAmount.toString()}
                  onChangeText={(text) => {
                    setAmount(text);
                    setTopupAmount(parseFloat(text) || 0);
                  }}
                  placeholder="Enter amount to top up"
                />
              </View>
              
              <Text style={styles.noteText}>
                After submitting, you will be directed to Paymongo to complete your payment.
              </Text>

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
  qrUploadContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  qrPreviewContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  qrPreview: {
    width: 150,
    height: 150,
    borderRadius: 5,
    marginBottom: 10,
  },
  changeQrButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  changeQrButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  uploadButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 5,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 15,
    fontStyle: 'italic',
  },
});

export default DasherTopup; 