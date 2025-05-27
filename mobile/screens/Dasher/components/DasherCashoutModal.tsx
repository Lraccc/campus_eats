import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { API_URL } from '../../../config';
import { Ionicons } from '@expo/vector-icons';

// Define prop types
interface DasherCashoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountType: string;
  dasherData: any; // Define more specific type if possible
  shopData: any; // Define more specific type if possible
  isEditMode: boolean;
  editData: any; // Define more specific type if possible
  currentUser: any; // Define more specific type if possible
  wallet: number;
  gcashName?: string;
  gcashNumber?: string;
}

const DasherCashoutModal: React.FC<DasherCashoutModalProps> = ({
                                                                 isOpen,
                                                                 onClose,
                                                                 accountType,
                                                                 dasherData,
                                                                 shopData,
                                                                 isEditMode,
                                                                 editData,
                                                                 currentUser,
                                                                 wallet,
                                                                 gcashName: initialGcashName,
                                                                 gcashNumber: initialGcashNumber,
                                                               }) => {
  const [gcashName, setGcashName] = useState(initialGcashName || "");
  const [gcashNumber, setGcashNumber] = useState(initialGcashNumber || "");
  const [cashoutAmount, setCashoutAmount] = useState(editData ? editData.amount : 0);
  const [uploadedImage, setUploadedImage] = useState(editData ? editData.gcashQr : null); // Will be a URI or base64

  useEffect(() => {
    if (editData) {
      setGcashName(editData.gcashName);
      setGcashNumber(editData.gcashNumber);
      setCashoutAmount(editData.amount);
      setUploadedImage(editData.gcashQr);
    } else {
      // Reset for new request
      setGcashName(initialGcashName || "");
      setGcashNumber(initialGcashNumber || "");
      setCashoutAmount(0);
      setUploadedImage(null);
    }
  }, [editData, initialGcashName, initialGcashNumber]);

  const handleImagePick = async () => {
    try {
      // Request permission first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions to upload an image.');
        return;
      }

      // Launch the image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setUploadedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!uploadedImage) {
      Alert.alert('Image Required', 'Please upload a GCASH QR image.');
      return;
    }

    if (!gcashNumber.startsWith('9') || gcashNumber.length !== 10) {
      Alert.alert('Invalid GCASH Number', 'Please provide a valid GCASH Number.');
      return;
    }
    if (cashoutAmount < 100) {
      Alert.alert('Invalid Cashout Amount', 'Minimum cashout amount is ₱100.');
      return;
    }

    if (cashoutAmount > wallet) {
      Alert.alert('Invalid Amount', 'Cashout amount cannot exceed your wallet balance.');
      return;
    }

    try {
      setSubmitting(true);

      // Create form data for multipart request
      const formData = new FormData();

      // Convert the cashout data to a JSON string and append to form data
      const cashoutData = {
        gcashName: gcashName,
        gcashNumber: gcashNumber,
        amount: cashoutAmount,
        status: 'pending'
      };

      formData.append('cashout', JSON.stringify(cashoutData));

      // Append the image
      const imageUriParts = uploadedImage.split('/');
      const imageFileName = imageUriParts[imageUriParts.length - 1];
      const imageType = 'image/jpeg'; // Assuming JPEG, adjust if needed

      formData.append('image', {
        uri: uploadedImage,
        name: imageFileName,
        type: imageType,
      } as any);

      // Append the user ID
      formData.append('userId', currentUser.id);

      // Make the API request
      const url = isEditMode ?
          `${API_URL}/api/cashouts/update/${editData.id}` :
          `${API_URL}/api/cashouts/create`;

      const response = await axios({
        method: isEditMode ? 'put' : 'post',
        url: url,
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200 || response.status === 201) {
        Alert.alert(
            'Success',
            isEditMode ? 'Cashout request updated successfully.' : 'Cashout request submitted successfully.',
            [{ text: 'OK', onPress: onClose }]
        );
      } else {
        throw new Error('Failed to process request');
      }
    } catch (error: any) {
      console.error('Error submitting cashout request:', error);
      Alert.alert(
          'Error',
          `Failed to ${isEditMode ? 'update' : 'submit'} request: ${error.response?.data || error.message}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
      <Modal
          visible={isOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{isEditMode ? "Edit Cashout Request" : "Withdraw Wallet"}</Text>
              <Text style={styles.modalSubtitle}>
                It may take up to 3-5 business days for the amount to be reflected in your GCASH account.
              </Text>

              <TextInput
                  style={styles.input}
                  placeholder="GCASH Name"
                  value={gcashName}
                  onChangeText={setGcashName}
              />

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

              <TouchableOpacity style={styles.uploadButton} onPress={handleImagePick}>
                <Ionicons name="cloud-upload-outline" size={24} color="#BC4A4D" />
                <Text style={styles.uploadButtonText}>Upload GCASH Personal QR Code</Text>
              </TouchableOpacity>
              {uploadedImage && (
                  <Image
                      source={{ uri: uploadedImage }} // Assuming uploadedImage is a URI
                      style={styles.qrPreview}
                      resizeMode="contain"
                  />
              )}

              <Text style={styles.walletText}>Wallet: ₱{wallet?.toFixed(2) || '0.00'}</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Cashout Amount"
                  value={cashoutAmount.toString()}
                  onChangeText={(text) => setCashoutAmount(parseFloat(text) || 0)}
                  keyboardType="number-pad"
              />

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.submitButton, submitting && styles.disabledButton]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                  {submitting ? (
                      <ActivityIndicator color="#fff" size="small" />
                  ) : (
                      <Text style={styles.buttonText}>{isEditMode ? "Update" : "Submit"}</Text>
                  )}
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </View>
      </Modal>
  );
};

const styles = StyleSheet.create({
  disabledButton: {
    backgroundColor: '#cccccc',
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '90%',
  },
  modalContent: {},
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
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
    marginBottom: 15,
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#333',
  },
  qrPreview: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  walletText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#ccc',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  submitButton: {
    backgroundColor: '#BC4A4D',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DasherCashoutModal; 