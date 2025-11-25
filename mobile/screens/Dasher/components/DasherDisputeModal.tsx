import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { API_URL } from '../../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../../services/authService';

interface DasherDisputeModalProps {
  visible: boolean;
  onClose: () => void;
  order: {
    id: string;
    customerNoShowProofImage?: string;
    customerNoShowGcashQr?: string;
    deliveryProofImage?: string;
    totalPrice: number;
    shopData?: {
      name: string;
    };
  };
  dasherId: string;
  onSuccess?: () => void;
}

export default function DasherDisputeModal({
  visible,
  onClose,
  order,
  dasherId,
  onSuccess,
}: DasherDisputeModalProps) {
  const [counterProofImage, setCounterProofImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomerProof, setShowCustomerProof] = useState(false);
  const [showGcashQr, setShowGcashQr] = useState(false);

  const hasAlreadySubmitted = order.deliveryProofImage != null;

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Camera permission is required to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCounterProofImage(result.assets[0].uri);
    }
  };

  const handleSelectPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCounterProofImage(result.assets[0].uri);
    }
  };

  const handleSubmitCounterProof = async () => {
    if (!counterProofImage) {
      Alert.alert('Error', 'Please provide proof of delivery');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const formData = new FormData();
      formData.append('orderId', order.id);
      formData.append('dasherId', dasherId);

      const filename = counterProofImage.split('/').pop() || 'counter_proof.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('counterProofImage', {
        uri: counterProofImage,
        name: filename,
        type,
      } as any);

      const response = await axios.post(
        `${API_URL}/api/orders/dasher-submit-counter-proof`,
        formData,
        {
          headers: {
            Authorization: token,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        Alert.alert(
          'Success',
          'Your proof has been submitted. Our team will review both submissions.',
          [
            {
              text: 'OK',
              onPress: () => {
                onSuccess?.();
                onClose();
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error submitting counter-proof:', error);
      const errorMessage = error.response?.data?.error || 'Failed to submit proof. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>No-Show Dispute</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Order Info */}
            <View style={styles.orderInfo}>
              <Text style={styles.orderTitle}>
                Order #{order.id.slice(-8)}
              </Text>
              <Text style={styles.shopName}>{order.shopData?.name || 'Shop'}</Text>
              <Text style={styles.orderAmount}>₱{order.totalPrice.toFixed(2)}</Text>
            </View>

            {/* Dispute Notice */}
            <View style={styles.noticeBox}>
              <Ionicons name="warning" size={24} color="#F59E0B" />
              <Text style={styles.noticeText}>
                A customer has reported that this order was not delivered. Please review their evidence and submit your proof of delivery.
              </Text>
            </View>

            {/* Customer's Evidence Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer's Evidence</Text>
              
              {/* Customer Proof Image */}
              {order.customerNoShowProofImage && (
                <View style={styles.evidenceItem}>
                  <TouchableOpacity
                    style={styles.viewEvidenceButton}
                    onPress={() => setShowCustomerProof(true)}
                  >
                    <Ionicons name="image" size={20} color="#BC4A4D" />
                    <Text style={styles.viewEvidenceText}>View No-Show Proof</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Customer GCash QR */}
              {order.customerNoShowGcashQr && (
                <View style={styles.evidenceItem}>
                  <TouchableOpacity
                    style={styles.viewEvidenceButton}
                    onPress={() => setShowGcashQr(true)}
                  >
                    <Ionicons name="qr-code" size={20} color="#BC4A4D" />
                    <Text style={styles.viewEvidenceText}>View GCash QR Code</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Your Counter-Proof Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Proof of Delivery</Text>

              {hasAlreadySubmitted ? (
                <View style={styles.submittedBox}>
                  <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                  <Text style={styles.submittedText}>
                    You have already submitted your proof of delivery. Our team is reviewing both submissions.
                  </Text>
                  {order.deliveryProofImage && (
                    <Image
                      source={{ uri: order.deliveryProofImage }}
                      style={styles.submittedImage}
                    />
                  )}
                </View>
              ) : (
                <>
                  {counterProofImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: counterProofImage }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.retakeButton}
                        onPress={() => setCounterProofImage(null)}
                      >
                        <Ionicons name="refresh" size={20} color="white" />
                        <Text style={styles.retakeText}>Retake</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.captureButtons}>
                      <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto}>
                        <Ionicons name="camera" size={24} color="white" />
                        <Text style={styles.captureButtonText}>Take Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.captureButton} onPress={handleSelectPhoto}>
                        <Ionicons name="images" size={24} color="white" />
                        <Text style={styles.captureButtonText}>Select Photo</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Submit Button */}
                  {counterProofImage && !hasAlreadySubmitted && (
                    <TouchableOpacity
                      style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                      onPress={handleSubmitCounterProof}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="white" />
                          <Text style={styles.submitButtonText}>Submit Proof</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Full Screen Image Modals */}
      <Modal visible={showCustomerProof} transparent={true} onRequestClose={() => setShowCustomerProof(false)}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity style={styles.imageModalClose} onPress={() => setShowCustomerProof(false)}>
            <Ionicons name="close-circle" size={40} color="white" />
          </TouchableOpacity>
          {order.customerNoShowProofImage && (
            <Image source={{ uri: order.customerNoShowProofImage }} style={styles.fullScreenImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      <Modal visible={showGcashQr} transparent={true} onRequestClose={() => setShowGcashQr(false)}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity style={styles.imageModalClose} onPress={() => setShowGcashQr(false)}>
            <Ionicons name="close-circle" size={40} color="white" />
          </TouchableOpacity>
          {order.customerNoShowGcashQr && (
            <Image source={{ uri: order.customerNoShowGcashQr }} style={styles.fullScreenImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#BC4A4D',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  orderInfo: {
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  shopName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#BC4A4D',
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  noticeText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  evidenceItem: {
    marginBottom: 8,
  },
  viewEvidenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BC4A4D',
  },
  viewEvidenceText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#BC4A4D',
  },
  captureButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  captureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BC4A4D',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  captureButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  retakeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
    gap: 4,
  },
  retakeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submittedBox: {
    backgroundColor: '#D1FAE5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submittedText: {
    fontSize: 14,
    color: '#065F46',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  submittedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
});
