import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
// Assuming axiosConfig path relative to mobile
import axios from "../../../../frontend/src/utils/axiosConfig";
// Assuming AlertModal is a custom component or using built-in Alert
// import AlertModal from '../AlertModal';

// Importing FontAwesomeIcon if you have react-native-vector-icons/fontawesome
// Make sure to install and link the library: https://github.com/oblador/react-native-vector-icons
// import Icon from 'react-native-vector-icons/FontAwesome';
// const faUpload = 'upload'; // Placeholder if using vector-icons

// For image picking, you'll likely need a library like expo-image-picker
// import * as ImagePicker from 'expo-image-picker';

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
    // Implement image picking logic using a library like expo-image-picker
    Alert.alert("Image Picker", "Implement image picking logic using a library.");
  };

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

    const cashoutData: any = { // Define a specific type for this payload
      gcashName: gcashName,
      gcashNumber: gcashNumber,
      amount: cashoutAmount,
      status: 'pending', // Assuming new requests are always pending
      userId: currentUser.id
    };

    if (uploadedImage) {
        // In a real implementation, handle image upload (e.g., convert to base64 or Blob)
        // For now, just adding the URI/base64 placeholder to the data
        cashoutData.gcashQr = uploadedImage; // Placeholder
    }

    try {
      const url = isEditMode ? `/cashouts/update/${editData.id}` : "/cashouts/create";
      const method = isEditMode ? 'put' : 'post';

      const response = await axios({
        method: method,
        url: url,
        data: cashoutData,
      });

      if (response.status === 200 || response.status === 201) {
        Alert.alert('Success', isEditMode ? "Cashout request updated successfully." : "Cashout request submitted successfully.");
        onClose(); // Close modal and refresh data in parent
      } else {
        Alert.alert('Error', "Failed to submit cashout request.");
      }
    } catch (error: any) {
      console.error("Error submitting cashout request:", error);
      Alert.alert('Error', "An error occurred while submitting the cashout request.");
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
                {/* Placeholder for icon */}
                {/* <Icon name={faUpload} size={20} color="#BC4A4D" /> */}
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
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.buttonText}>{isEditMode ? "Update" : "Submit"}</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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