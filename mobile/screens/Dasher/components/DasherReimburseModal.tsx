import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { API_URL } from '../../../config';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

interface NoShowOrder {
  id: string;
  totalPrice: number;
  createdAt: string;
  orderNumber?: string;
}

interface DasherReimburseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  noShowOrders: NoShowOrder[];
  gcashName?: string;
  gcashNumber?: string;
  isEditMode?: boolean;
  editData?: any;
}

const DasherReimburseModal: React.FC<DasherReimburseModalProps> = ({
  isOpen,
  onClose,
  userId,
  noShowOrders,
  gcashName: initialGcashName,
  gcashNumber: initialGcashNumber,
  isEditMode = false,
  editData = null,
}) => {
  const [gcashName, setGcashName] = useState(initialGcashName || '');
  const [gcashNumber, setGcashNumber] = useState(initialGcashNumber || '');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [amount, setAmount] = useState(0);
  const [gcashQrImage, setGcashQrImage] = useState<string | null>(null);
  const [locationProofImage, setLocationProofImage] = useState<string | null>(null);
  const [noShowProofImage, setNoShowProofImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEditMode && editData) {
      setGcashName(editData.gcashName || '');
      setGcashNumber(editData.gcashNumber || '');
      setSelectedOrderId(editData.orderId || '');
      setAmount(editData.amount || 0);
      setGcashQrImage(editData.gcashQr || null);
      setLocationProofImage(editData.locationProof || null);
      setNoShowProofImage(editData.noShowProof || null);
    } else {
      setGcashName(initialGcashName || '');
      setGcashNumber(initialGcashNumber || '');
      setSelectedOrderId('');
      setAmount(0);
      setGcashQrImage(null);
      setLocationProofImage(null);
      setNoShowProofImage(null);
    }
  }, [isEditMode, editData, initialGcashName, initialGcashNumber]);

  // Handler for when order selection changes
  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (orderId) {
      const selectedOrder = noShowOrders.find(order => order.id === orderId);
      if (selectedOrder) {
        // Add ₱5 convenience fee
        setAmount(selectedOrder.totalPrice + 5);
      }
    } else {
      setAmount(0);
    }
  };

  const handleImagePick = async (type: 'gcashQr' | 'locationProof' | 'noShowProof') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions to upload an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        
        switch (type) {
          case 'gcashQr':
            setGcashQrImage(imageUri);
            break;
          case 'locationProof':
            setLocationProofImage(imageUri);
            break;
          case 'noShowProof':
            setNoShowProofImage(imageUri);
            break;
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const validateForm = () => {
    if (!gcashName.trim()) {
      Alert.alert('Missing Information', 'Please enter your GCash name.');
      return false;
    }

    if (!gcashNumber || !gcashNumber.startsWith('9') || gcashNumber.length !== 10) {
      Alert.alert('Invalid GCash Number', 'Please enter a valid 10-digit GCash number starting with 9.');
      return false;
    }

    if (!selectedOrderId) {
      Alert.alert('Missing Information', 'Please select an order.');
      return false;
    }

    if (!gcashQrImage) {
      Alert.alert('Missing Image', 'Please upload your GCash QR code.');
      return false;
    }

    if (!locationProofImage) {
      Alert.alert('Missing Image', 'Please upload proof of your location.');
      return false;
    }

    if (!noShowProofImage) {
      Alert.alert('Missing Image', 'Please upload proof that the customer did not show up.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      // Create form data
      const formData = new FormData();

      // Create the reimburse data object
      const reimburseData = {
        gcashName,
        gcashNumber,
        amount,
        orderId: selectedOrderId,
        status: 'pending'
      };

      // Add the JSON data
      formData.append('reimburse', JSON.stringify(reimburseData));

      // Add the images
      if (gcashQrImage) {
        const gcashQrUriParts = gcashQrImage.split('/');
        const gcashQrFileName = gcashQrUriParts[gcashQrUriParts.length - 1];
        
        formData.append('gcashQr', {
          uri: gcashQrImage,
          name: gcashQrFileName,
          type: 'image/jpeg',
        } as any);
      }

      if (locationProofImage) {
        const locationProofUriParts = locationProofImage.split('/');
        const locationProofFileName = locationProofUriParts[locationProofUriParts.length - 1];
        
        formData.append('locationProof', {
          uri: locationProofImage,
          name: locationProofFileName,
          type: 'image/jpeg',
        } as any);
      }

      if (noShowProofImage) {
        const noShowProofUriParts = noShowProofImage.split('/');
        const noShowProofFileName = noShowProofUriParts[noShowProofUriParts.length - 1];
        
        formData.append('noShowProof', {
          uri: noShowProofImage,
          name: noShowProofFileName,
          type: 'image/jpeg',
        } as any);
      }

      // Add user ID
      formData.append('userId', userId);

      // Send the request
      const url = `${API_URL}/api/reimburses/create`;
      const response = await axios({
        method: 'post',
        url,
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 201) {
        Alert.alert(
          'Success',
          'Reimbursement request submitted successfully. You will be notified once it is processed.',
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        throw new Error('Failed to submit reimbursement request');
      }
    } catch (error: any) {
      console.error('Error submitting reimbursement request:', error);
      Alert.alert(
        'Error',
        `Failed to submit request: ${error.response?.data || error.message}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderImagePreview = (imageUri: string | null, type: string) => {
    if (!imageUri) return null;
    
    return (
      <View style={styles.imagePreviewContainer}>
        <Image source={{ uri: imageUri }} style={styles.imagePreview} />
        <TouchableOpacity 
          style={styles.removeImageButton}
          onPress={() => {
            switch (type) {
              case 'gcashQr':
                setGcashQrImage(null);
                break;
              case 'locationProof':
                setLocationProofImage(null);
                break;
              case 'noShowProof':
                setNoShowProofImage(null);
                break;
            }
          }}
        >
          <Ionicons name="close-circle" size={24} color="#DC3545" />
        </TouchableOpacity>
      </View>
    );
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
          <ScrollView style={styles.scrollView}>
            <Text style={styles.modalTitle}>
              {isEditMode ? 'Edit Reimbursement Request' : 'Submit Reimbursement Request'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Please provide all the required information and proof to process your reimbursement.
            </Text>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>GCash Information</Text>
              
              <TextInput
                style={styles.input}
                placeholder="GCash Name"
                value={gcashName}
                onChangeText={setGcashName}
              />

              <View style={styles.inputContainerWithPrefix}>
                <Text style={styles.prefix}>+63 </Text>
                <TextInput
                  style={styles.inputWithPrefix}
                  placeholder="GCash Number"
                  value={gcashNumber}
                  onChangeText={setGcashNumber}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Order Information</Text>
              
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedOrderId}
                  onValueChange={(itemValue) => handleOrderChange(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Select an order" value="" />
                  {noShowOrders.map(order => (
                    <Picker.Item 
                      key={order.id} 
                      label={`Order #${order.orderNumber || order.id.substring(0, 8)} - ₱${order.totalPrice.toFixed(2)}`} 
                      value={order.id} 
                    />
                  ))}
                </Picker>
              </View>

              {amount > 0 && (
                <View style={styles.amountContainer}>
                  <Text style={styles.amountLabel}>Amount to Reimburse:</Text>
                  <Text style={styles.amountValue}>₱{amount.toFixed(2)}</Text>
                  <Text style={styles.amountNote}>
                    (Includes ₱5.00 inconvenience fee)
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Required Proof</Text>
              
              <View style={styles.proofItem}>
                <Text style={styles.proofLabel}>1. GCash QR Code:</Text>
                <TouchableOpacity 
                  style={styles.uploadButton} 
                  onPress={() => handleImagePick('gcashQr')}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color="#555" />
                  <Text style={styles.uploadButtonText}>Upload Image</Text>
                </TouchableOpacity>
                {renderImagePreview(gcashQrImage, 'gcashQr')}
              </View>

              <View style={styles.proofItem}>
                <Text style={styles.proofLabel}>2. Location Proof:</Text>
                <Text style={styles.proofDescription}>
                  Upload a screenshot showing you were at the designated pickup location.
                </Text>
                <TouchableOpacity 
                  style={styles.uploadButton} 
                  onPress={() => handleImagePick('locationProof')}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color="#555" />
                  <Text style={styles.uploadButtonText}>Upload Image</Text>
                </TouchableOpacity>
                {renderImagePreview(locationProofImage, 'locationProof')}
              </View>

              <View style={styles.proofItem}>
                <Text style={styles.proofLabel}>3. No-Show Proof:</Text>
                <Text style={styles.proofDescription}>
                  Upload proof that you tried to contact the customer (screenshot of calls/messages).
                </Text>
                <TouchableOpacity 
                  style={styles.uploadButton} 
                  onPress={() => handleImagePick('noShowProof')}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color="#555" />
                  <Text style={styles.uploadButtonText}>Upload Image</Text>
                </TouchableOpacity>
                {renderImagePreview(noShowProofImage, 'noShowProof')}
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={onClose}
                disabled={submitting}
              >
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
                  <Text style={styles.buttonText}>
                    {isEditMode ? 'Update Request' : 'Submit Request'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '90%',
    maxHeight: '90%',
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  formSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#BC4A4D',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputContainerWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 15,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  prefix: {
    fontSize: 16,
    marginRight: 5,
    color: '#333',
  },
  inputWithPrefix: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  amountContainer: {
    backgroundColor: '#E9F7EF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginVertical: 5,
  },
  amountNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#555',
  },
  proofItem: {
    marginBottom: 15,
  },
  proofLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  proofDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#555',
  },
  imagePreviewContainer: {
    marginTop: 10,
    position: 'relative',
    alignItems: 'center',
  },
  imagePreview: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: 70,
    backgroundColor: '#fff',
    borderRadius: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    padding: 15,
    borderRadius: 5,
    marginRight: 10,
    alignItems: 'center',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#BC4A4D',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#d9a3a4',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DasherReimburseModal;
