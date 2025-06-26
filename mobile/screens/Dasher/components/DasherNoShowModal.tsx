import React, { useState } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, ScrollView } from "react-native";
import axios from "axios";
import { API_URL } from "../../../config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from "../../../config";
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface DasherNoShowModalProps {
    isOpen: boolean;
    closeModal: () => void;
    orderData: any;
    onOrderCompleted: () => void;
}

const DasherNoShowModal: React.FC<DasherNoShowModalProps> = ({
    isOpen,
    closeModal,
    orderData,
    onOrderCompleted
}) => {
    const [proofImage, setProofImage] = useState<string | null>(null);
    const [locationProofImage, setLocationProofImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    if (!isOpen) return null;

    const postOffenses = async () => {
        if (orderData && orderData.dasherId !== null) {
            try {
                const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
                if (!token) return;

                const response = await axios.post(
                    `${API_URL}/api/users/${orderData.uid}/offenses`,
                    {},
                    { headers: { 'Authorization': token } }
                );
                if (response.status !== 200) {
                    throw new Error("Failed to post offenses");
                }
                console.log(response.data);
            } catch (error) {
                console.error("Error posting offenses:", error);
            }
        }
    };

    const pickImage = async (imageType: 'noShow' | 'location' | 'gcashQr') => {
        try {
            // Request permission to access the photo library
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'We need camera roll permissions to upload an image');
                return;
            }

            // Launch the image picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                switch(imageType) {
                    case 'noShow':
                        setProofImage(result.assets[0].uri);
                        break;
                    case 'location':
                        setLocationProofImage(result.assets[0].uri);
                        break;/*
                    case 'gcashQr':
                        setGcashQrImage(result.assets[0].uri);
                        break;*/
                }
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to select image');
        }
    };

    const takePhoto = async (imageType: 'noShow' | 'location' | 'gcashQr') => {
        try {
            // Request permission to access the camera
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'We need camera permissions to take a photo');
                return;
            }

            // Launch the camera
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                switch(imageType) {
                    case 'noShow':
                        setProofImage(result.assets[0].uri);
                        break;
                    case 'location':
                        setLocationProofImage(result.assets[0].uri);
                        break;/*
                    case 'gcashQr':
                        setGcashQrImage(result.assets[0].uri);
                        break;*/
                }
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo');
        }
    };

    const removeImage = (imageType: 'noShow' | 'location' | 'gcashQr') => {
        switch(imageType) {
            case 'noShow':
                setProofImage(null);
                break;
            case 'location':
                setLocationProofImage(null);
                break;
        }
    };

    const confirm = async () => {
        if (!proofImage) {
            Alert.alert('Image Required', 'Please upload or take a photo as proof of no-show');
            return;
        }

        if (!orderData || !orderData.id) {
            Alert.alert('Error', 'Order information is missing');
            return;
        }

        try {
            setIsUploading(true);
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            // Create form data to send the images
            const formData = new FormData();
            formData.append('orderId', orderData.id);
            formData.append('status', 'no_show');

            // Log current order ID
            console.log('Submitting no-show form for Order ID:', orderData.id);

            // Append the primary proof image (required)
            formData.append('proofImage', {
                uri: proofImage,
                type: 'image/jpeg',
                name: 'proof.jpg',
            } as any);

            // Append optional location proof
            if (locationProofImage) {
                console.log('Adding location proof image');
                formData.append('locationProofImage', {
                    uri: locationProofImage,
                    type: 'image/jpeg',
                    name: 'location_proof.jpg',
                } as any);
            }
            // GCash QR image has been removed from the form

            console.log('Submitting order with ID:', orderData.id);
            console.log('Form data contains:', formData);

            // Send the request with the form data
            const updateResponse = await axios.post(
                `${API_URL}/api/orders/update-order-status-with-proof`,
                formData,
                {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'multipart/form-data',
                    }
                }
            );

            console.log('Response from server:', updateResponse.data);

            if (updateResponse.status === 200) {
                await postOffenses();
                await axios.put(
                    `${API_URL}/api/dashers/update/${orderData.dasherId}/status`,
                    null,
                    {
                        params: { status: 'active' },
                        headers: { 'Authorization': token }
                    }
                );
                closeModal();
                onOrderCompleted();
            }
        } catch (error) {
            console.error('Error updating order status:', error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Modal
            visible={isOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={closeModal}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                        <Text style={styles.closeButtonText}>✖</Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>Marked Order as No Show</Text>
                    <Text style={styles.orderId}>Order ID: {orderData?.id || 'N/A'}</Text>
                    <View style={styles.divider} />

                    <ScrollView
                        style={styles.scrollContainer}
                        contentContainerStyle={styles.scrollContentContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.contentContainer}>
                        <Text style={styles.message}>
                            The customer failed to show up for the delivery.
                        </Text>

                        {/* No Show Proof Image Section */}
                        <Text style={[styles.sectionTitle, {marginTop: 15}]}>
                            No-Show Proof Image <Text style={{color: 'red'}}>*</Text>
                        </Text>
                        <Text style={styles.subMessage}>
                            Please upload an image as proof of the no-show
                        </Text>

                        {proofImage ? (
                            <View style={styles.imagePreviewContainer}>
                                <Image
                                    source={{ uri: proofImage }}
                                    style={styles.imagePreview}
                                />
                                <TouchableOpacity
                                    style={styles.removeImageButton}
                                    onPress={() => removeImage('noShow')}
                                >
                                    <Ionicons name="close-circle" size={24} color="red" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.imagePickerContainer}>
                                <TouchableOpacity
                                    style={styles.imagePickerButton}
                                    onPress={() => pickImage('noShow')}
                                >
                                    <Ionicons name="images" size={28} color="#FFD700" />
                                    <Text style={styles.imagePickerText}>Choose from Gallery</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.imagePickerButton}
                                    onPress={() => takePhoto('noShow')}
                                >
                                    <Ionicons name="camera" size={28} color="#FFD700" />
                                    <Text style={styles.imagePickerText}>Take a Photo</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Location Proof Image Section */}
                        <Text style={[styles.sectionTitle, {marginTop: 20}]}>
                            Location Proof Image
                        </Text>
                        <Text style={styles.subMessage}>
                            Upload an image showing your location
                        </Text>

                        {locationProofImage ? (
                            <View style={styles.imagePreviewContainer}>
                                <Image
                                    source={{ uri: locationProofImage }}
                                    style={styles.imagePreview}
                                />
                                <TouchableOpacity
                                    style={styles.removeImageButton}
                                    onPress={() => removeImage('location')}
                                >
                                    <Ionicons name="close-circle" size={24} color="red" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.imagePickerContainer}>
                                <TouchableOpacity
                                    style={styles.imagePickerButton}
                                    onPress={() => pickImage('location')}
                                >
                                    <Ionicons name="images" size={28} color="#FFD700" />
                                    <Text style={styles.imagePickerText}>Choose from Gallery</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.imagePickerButton}
                                    onPress={() => takePhoto('location')}
                                >
                                    <Ionicons name="camera" size={28} color="#FFD700" />
                                    <Text style={styles.imagePickerText}>Take a Photo</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* GCash QR Code section has been removed */}
                        </View>
                    </ScrollView>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.confirmButton, isUploading && styles.disabledButton]}
                            onPress={confirm}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <Text style={styles.buttonText}>Confirm</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={closeModal}
                        >
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        width: '90%',
        maxWidth: 400,
        padding: 20,
        borderRadius: 8,
        maxHeight: '85%',
    },
    scrollContainer: {
        flexGrow: 0,
        maxHeight: 400,
    },
    scrollContentContainer: {
        paddingBottom: 10,
    },
    closeButton: {
        position: 'absolute',
        right: 10,
        top: 10,
        padding: 5,
    },
    closeButtonText: {
        fontSize: 20,
        color: '#666',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 5,
        textAlign: 'center',
    },
    orderId: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
        textAlign: 'center',
        fontFamily: 'monospace',
    },
    divider: {
        height: 1,
        backgroundColor: '#ccc',
        marginVertical: 10,
    },
    contentContainer: {
        alignItems: 'center',
        paddingBottom: 10,
    },
    message: {
        fontSize: 16,
        color: '#000',
        textAlign: 'center',
    },
    subMessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
        textAlign: 'center',
        marginBottom: 5,
    },
    imagePickerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 15,
    },
    imagePickerButton: {
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FFD700',
        borderRadius: 8,
        width: '45%',
        backgroundColor: '#FFFAED',
    },
    imagePickerText: {
        marginTop: 5,
        fontSize: 12,
        color: '#000',
        textAlign: 'center',
    },
    imagePreviewContainer: {
        position: 'relative',
        marginTop: 15,
        width: '100%',
        height: 200,
        borderRadius: 8,
        overflow: 'hidden',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeImageButton: {
        position: 'absolute',
        right: 10,
        top: 10,
        backgroundColor: 'white',
        borderRadius: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    confirmButton: {
        backgroundColor: '#FFD700',
    },
    cancelButton: {
        backgroundColor: '#ccc',
    },
    disabledButton: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default DasherNoShowModal;