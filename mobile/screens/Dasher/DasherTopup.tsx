import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image } from "react-native";
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
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please try logging in again.");
      return;
    }

    if (!gcashName || !gcashNumber || !amount || !imageBase64) {
      Alert.alert("Error", "Please fill in all fields and upload GCash QR code.");
      return;
    }

    const topup: TopupRequestPayload = {
      gcashName,
      gcashNumber,
      amount: parseFloat(amount),
      dasherId: userId,
      gcashQr: imageBase64,
    };

    try {
      const response = await axios.post(`${API_URL}/api/topups/create`, topup);
      console.log("Topup response: ", response);
      Alert.alert("Success", "Topup request submitted successfully!");
      router.back();
    } catch (error: any) {
      console.error("Error submitting topup:", error);
      Alert.alert("Error", error.response?.data?.message || "Failed to submit topup request.");
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
                  value={topupAmount.toString()}
                  onChangeText={(text) => setTopupAmount(parseFloat(text) || 0)}
                  // max={dasherData?.wallet < 0 ? Math.abs(dasherData.wallet) : undefined} // Max for negative wallet
                />
              </View>

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
});

export default DasherTopup; 