import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image } from "react-native";
import { router } from "expo-router";
import { useAuthentication } from "../../services/authService";
import axios from "axios";
import { API_URL } from "../../config";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
// For time input, consider a library or native date picker module if needed, TextInput type='time' is not standard in RN

interface DasherApplicationPayload {
  daysAvailable: string[];
  availableStartTime: string; // Consider using Date or number for better type safety
  availableEndTime: string; // Consider using Date or number for better type safety
  gcashName: string;
  gcashNumber: string;
  image?: string; // Base64 or URI of the school ID
  userId: string;
}

interface DaysAvailability {
    MON: boolean;
    TUE: boolean;
    WED: boolean;
    THU: boolean;
    FRI: boolean;
    SAT: boolean;
    SUN: boolean;
}

interface ApplicationRequestPayload {
    gcashName: string;
    gcashNumber: string;
    dasherId: string;
    gcashQr: string | null;
}

const DasherApplication = () => {
  const { authState } = useAuthentication();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [availableStartTime, setAvailableStartTime] = useState("");
  const [availableEndTime, setAvailableEndTime] = useState("");
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashQr, setGcashQr] = useState<string | null>(null);
  const [days, setDays] = useState<DaysAvailability>({
    MON: false,
    TUE: false,
    WED: false,
    THU: false,
    FRI: false,
    SAT: false,
    SUN: false,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchDasherData();
    }
  }, [userId]);

  const handleImagePick = async () => {
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
        setGcashQr(result.assets[0].uri);
        setImageBase64(result.assets[0].base64 || null);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleDaySelect = (day: keyof DaysAvailability) => {
    setDays({
      ...days,
      [day]: !days[day],
    });
  };

  const handleSubmit = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please try logging in again.");
      return;
    }

    if (!gcashName || !gcashNumber || !imageBase64) {
      Alert.alert("Error", "Please fill in all fields and upload GCash QR code.");
      return;
    }

    const application: ApplicationRequestPayload = {
      gcashName,
      gcashNumber,
      dasherId: userId,
      gcashQr: imageBase64,
    };

    try {
      const response = await axios.post(`${API_URL}/api/dashers/apply`, application);
      console.log("Application response: ", response);
      Alert.alert("Success", "Application submitted successfully!");
      router.back();
    } catch (error: any) {
      console.error("Error submitting application:", error);
      Alert.alert("Error", error.response?.data?.message || "Failed to submit application.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>Dasher Application</Text>
          <Text style={styles.subtitle}>
            Partner with CampusEats to help drive growth and take your business to the next level.
          </Text>
        </View>

        <View style={styles.formContainer}>
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
                 <Text style={styles.label}>Start of Available Time</Text>
                 {/* Time input can be a simple TextInput for now, but consider a native picker */}
                  <TextInput
                      style={styles.input}
                      placeholder="HH:mm"
                      value={availableStartTime}
                      onChangeText={setAvailableStartTime}
                  />
             </View>

              <View style={styles.inputGroup}>
                 <Text style={styles.label}>End of Available Time</Text>
                 {/* Time input can be a simple TextInput for now, but consider a native picker */}
                  <TextInput
                      style={styles.input}
                       placeholder="HH:mm"
                      value={availableEndTime}
                      onChangeText={setAvailableEndTime}
                  />
             </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>School ID</Text>
                <TouchableOpacity style={styles.uploadButton} onPress={handleImagePick}>
                     <Text style={styles.uploadButtonText}>Upload School ID Image</Text>
                </TouchableOpacity>
                 {uploadedImage && (
                    <Image source={{ uri: uploadedImage }} style={styles.uploadedImage} resizeMode="contain" />
                )}
            </View>

            <View style={styles.inputGroup}>
                 <Text style={styles.label}>Days Available</Text>
                 <View style={styles.daysContainer}>
                     {Object.keys(days).map((day) => (
                         <TouchableOpacity
                             key={day}
                             style={[styles.dayButton, days[day as keyof DaysAvailability] && styles.selectedDayButton]}
                             onPress={() => handleDaySelect(day as keyof DaysAvailability)}
                         >
                             <Text style={[styles.dayButtonText, days[day as keyof DaysAvailability] && styles.selectedDayButtonText]}>{day}</Text>
                         </TouchableOpacity>
                     ))}
                 </View>
            </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading} // Disable button while loading
          >
            {loading ? (
                <ActivityIndicator size="small" color="#fff" />
            ) : (
                 <Text style={styles.buttonText}>Submit Application</Text>
            )}
          </TouchableOpacity>
        </View>

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
   daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dayButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    margin: 5,
  },
  selectedDayButton: {
    backgroundColor: '#BC4A4D',
    borderColor: '#BC4A4D',
  },
  dayButtonText: {
    fontSize: 14,
    color: '#333',
  },
  selectedDayButtonText: {
    color: 'white',
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

export default DasherApplication; 