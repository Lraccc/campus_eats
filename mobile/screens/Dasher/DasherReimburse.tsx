import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image } from "react-native";
import { router } from "expo-router";
import { useAuthentication } from "../../services/authService";
import axios from "axios";
import { API_URL } from "../../config";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
// For dropdown, you might need a library like @react-native-picker/picker
// import { Picker } from '@react-native-picker/picker';

interface NoShowOrder {
    id: string;
    totalPrice: number;
    createdAt: string;
    // Add other order properties as needed
}

interface ReimburseRequestPayload {
    gcashName: string;
    gcashNumber: string;
    amount: number;
    orderId: string;
    dasherId: string;
    gcashQr: string | null;
    locationProof: string | null;
    noShowProof: string | null;
}

const DasherReimburse = () => {
  const { authState } = useAuthentication();
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [noShowOrders, setNoShowOrders] = useState<NoShowOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<NoShowOrder | null>(null);
  const [amountToReceive, setAmountToReceive] = useState(0); // Includes inconvenience fee
  const [gcashQr, setGcashQr] = useState<string | null>(null);
  const [locationProof, setLocationProof] = useState<string | null>(null);
  const [noShowProof, setNoShowProof] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Set to true initially
  const [userId, setUserId] = useState<string | null>(null);
  const [imageBase64s, setImageBase64s] = useState<{
    gcashQr: string | null;
    locationProof: string | null;
    noShowProof: string | null;
  }>({
    gcashQr: null,
    locationProof: null,
    noShowProof: null
  });

  useEffect(() => {
    const loadUserId = async () => {
      const storedUserId = await AsyncStorage.getItem('userId');
      setUserId(storedUserId);
    };
    loadUserId();
  }, []);

  const fetchDasherData = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API_URL}/api/dashers/${userId}`);
      const data = response.data;
      setGcashName(data.gcashName || "");
      setGcashNumber(data.gcashNumber || "");
    } catch (error: any) {
      console.error("Error fetching dasher data:", error);
      Alert.alert("Error", "Failed to fetch dasher data.");
    }
  };

  const fetchNoShowOrders = async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API_URL}/api/orders/dasher/no-show-orders/${userId}`);
      const data: NoShowOrder[] = response.data;
      setNoShowOrders(data);
      console.log("No show orders: ", data);
    } catch (error: any) {
      console.error("Error fetching no-show orders:", error);
      Alert.alert("Error", "Failed to fetch no-show orders.");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchDasherData();
      fetchNoShowOrders();
    }
  }, [userId]);

  const handleOrderChange = (orderId: string) => {
    const selected = noShowOrders.find(order => order.id === orderId);
    setSelectedOrder(selected || null);
    if (selected) {
      setAmountToReceive(selected.totalPrice + 5); // Add ₱5 inconvenience fee
    } else {
        setAmountToReceive(0);
    }
  };

  const handleImagePick = async (type: 'gcashQr' | 'locationProof' | 'noShowProof') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        switch (type) {
          case 'gcashQr':
            setGcashQr(result.assets[0].uri);
            setImageBase64s(prev => ({ ...prev, gcashQr: result.assets[0].base64 || null }));
            break;
          case 'locationProof':
            setLocationProof(result.assets[0].uri);
            setImageBase64s(prev => ({ ...prev, locationProof: result.assets[0].base64 || null }));
            break;
          case 'noShowProof':
            setNoShowProof(result.assets[0].uri);
            setImageBase64s(prev => ({ ...prev, noShowProof: result.assets[0].base64 || null }));
            break;
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please try logging in again.");
      return;
    }

    if (!selectedOrder) {
      Alert.alert("Error", "Please select an order.");
      return;
    }

    if (!gcashName || !gcashNumber || !imageBase64s.gcashQr || !imageBase64s.locationProof || !imageBase64s.noShowProof) {
      Alert.alert("Error", "Please fill in all fields and upload all required images.");
      return;
    }

    const reimburse: ReimburseRequestPayload = {
      gcashName,
      gcashNumber,
      amount: selectedOrder.totalPrice,
      orderId: selectedOrder.id,
      dasherId: userId,
      gcashQr: imageBase64s.gcashQr,
      locationProof: imageBase64s.locationProof,
      noShowProof: imageBase64s.noShowProof,
    };

    try {
      const response = await axios.post(`${API_URL}/api/reimburses/create`, reimburse);
      console.log("Reimburse response: ", response);
      Alert.alert("Success", "Reimbursement request submitted successfully!");
      router.back();
    } catch (error: any) {
      console.error("Error submitting reimbursement:", error);
      Alert.alert("Error", error.response?.data?.message || "Failed to submit reimbursement request.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>Request for Reimbursement</Text>
          <Text style={styles.subtitle}>
            It may take up to 3-5 business days for the amount to be reflected in your GCASH account.
          </Text>
        </View>

        {loading ? (
            <ActivityIndicator size="large" color="#BC4A4D" style={styles.loadingIndicator} />
        ) : (
            <View style={styles.formContainer}>
                 <View style={styles.inputGroup}>
                      <Text style={styles.label}>Select Order</Text>
                      {/* Implement a Picker for selecting order */}
                      <Text>Dropdown Placeholder</Text>
                      {/* Example using @react-native-picker/picker:
                       <Picker
                           selectedValue={selectedOrder?.id || ''}
                           onValueChange={(itemValue, itemIndex) => handleOrderChange(itemValue)}
                           style={styles.picker}
                       >
                           <Picker.Item label="-- Select Order --" value="" />
                           {noShowOrders.map((order) => (
                               <Picker.Item key={order.id} label={`Order #${order.id} (${formatDate(order.createdAt)})`} value={order.id} />
                           ))}
                       </Picker>
                      */}
                  </View>

                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>Amount to receive</Text>
                      <TextInput
                          style={styles.input}
                          value={`₱${amountToReceive.toFixed(2)} + ₱5 (Inconvenience Fee)`}
                          editable={false} // Amount is calculated, not input
                      />
                  </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Proof of Location Arrival</Text>
                    <TouchableOpacity style={styles.uploadButton} onPress={() => handleImagePick('locationProof')}>
                         <Text style={styles.uploadButtonText}>Upload Image</Text>
                    </TouchableOpacity>
                    {locationProof && (
                        <Image source={{ uri: locationProof }} style={styles.uploadedImage} resizeMode="contain" />
                    )}
                </View>

                 <View style={styles.inputGroup}>
                    <Text style={styles.label}>Proof of Attempt</Text>
                    <TouchableOpacity style={styles.uploadButton} onPress={() => handleImagePick('noShowProof')}>
                         <Text style={styles.uploadButtonText}>Upload Image</Text>
                    </TouchableOpacity>
                    {noShowProof && (
                        <Image source={{ uri: noShowProof }} style={styles.uploadedImage} resizeMode="contain" />
                    )}
                </View>

                 <View style={styles.inputGroup}>
                    <Text style={styles.label}>GCASH Name</Text>
                     <TextInput
                          style={styles.input}
                          placeholder="GCASH Name"
                          value={gcashName}
                          onChangeText={setGcashName}
                      />
                </View>

                 <View style={styles.inputGroup}>
                     <Text style={styles.label}>GCASH Number</Text>
                      <View style={styles.inputContainerWithPrefix}>
                          <Text style={styles.prefix}>+63 </Text>
                          <TextInput
                              style={styles.inputWithPrefix}
                              placeholder="GCASH Number"
                              value={gcashNumber}
                              onChangeText={setGcashNumber}
                              keyboardType="number-pad"
                              maxLength={10}
                          />
                      </View>
                 </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>GCASH Personal QR Code</Text>
                     <TouchableOpacity style={styles.uploadButton} onPress={() => handleImagePick('gcashQr')}>
                         <Text style={styles.uploadButtonText}>Upload Image</Text>
                    </TouchableOpacity>
                     {gcashQr && (
                        <Image source={{ uri: gcashQr }} style={styles.uploadedImage} resizeMode="contain" />
                    )}
                </View>


              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.buttonText}>Submit Reimbursement Request</Text>
              </TouchableOpacity>
            </View>
        )}

      </ScrollView>
      {/* Alert Modal Placeholder (using built-in Alert for simplicity) */}
      {/* You would integrate a custom AlertModal component here if needed */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  scrollView: {
    // Add padding if needed
  },
  sectionTitleContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
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
      marginTop: 20,
  },
  inputGroup: {
      marginBottom: 15,
  },
  label: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  inputContainerWithPrefix: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 5,
      marginBottom: 15,
      paddingHorizontal: 10,
  },
   prefix: {
      fontSize: 16,
      marginRight: 5,
      color: '#333',
   },
  inputWithPrefix: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 16,
  },
   uploadButton: {
    backgroundColor: '#eee',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#333',
  },
  uploadedImage: {
      width: 100, // Adjust as needed
      height: 100, // Adjust as needed
      marginTop: 10,
      alignSelf: 'center',
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

export default DasherReimburse; 