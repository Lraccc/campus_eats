import React, { useEffect, useState } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import axios from "axios";
import { API_URL } from "../../../config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from "../../../config";
import DasherNoShowModal from "./DasherNoShowModal";

interface DasherCompletedModalProps {
    isOpen: boolean;
    closeModal: () => void;
    shopData: any;
    orderData: any;
    onOrderCompleted: () => void;
}

const DasherCompletedModal: React.FC<DasherCompletedModalProps> = ({ 
    isOpen, 
    closeModal, 
    shopData, 
    orderData,
    onOrderCompleted 
}) => {
    const [checkingConfirmation, setCheckingConfirmation] = useState(false);
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
    const [isNoShowModalOpen, setIsNoShowModalOpen] = useState(false);
    const [autoCompleteTimeout, setAutoCompleteTimeout] = useState<NodeJS.Timeout | null>(null);
    const [proofOfDeliveryImage, setProofOfDeliveryImage] = useState<string | null>(null);
    const [isUploadingProof, setIsUploadingProof] = useState(false);

    useEffect(() => {
        if (pollingInterval) {
            return () => clearInterval(pollingInterval);
        }
    }, [pollingInterval]);
    
    useEffect(() => {
        if (autoCompleteTimeout) {
            return () => clearTimeout(autoCompleteTimeout);
        }
    }, [autoCompleteTimeout]);

    if (!isOpen) return null;

    const handleTakeProofPhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant camera permission to take proof of delivery photo.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setProofOfDeliveryImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo. Please try again.');
        }
    };

    const handleSelectProofPhoto = async () => {
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
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setProofOfDeliveryImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error selecting photo:', error);
            Alert.alert('Error', 'Failed to select photo. Please try again.');
        }
    };

    const checkOrderConfirmation = async () => {
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            const response = await axios.get(`${API_URL}/api/orders/${orderData.id}`, {
                headers: { 'Authorization': token }
            });
            const updatedOrder = response.data;

            if (updatedOrder.status === "completed") {
                // Clear both interval and timeout
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    setPollingInterval(null);
                }
                if (autoCompleteTimeout) {
                    clearTimeout(autoCompleteTimeout);
                    setAutoCompleteTimeout(null);
                }
                setCheckingConfirmation(false);
                proceedWithCompletion();
            }
        } catch (error) {
            console.error("Error checking order status:", error);
        }
    };

    const autoCompleteOrder = async () => {
        console.log('Auto-completing order after timeout...');
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            // Update order status directly to completed
            await axios.post(`${API_URL}/api/orders/update-order-status`, {
                orderId: orderData.id,
                status: "completed"
            }, {
                headers: { 'Authorization': token }
            });

            // Clear any existing intervals
            if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
            }
            setCheckingConfirmation(false);
            
            // Proceed with completion process
            proceedWithCompletion();
        } catch (error) {
            console.error("Error auto-completing order:", error);
        }
    };

    const confirmAccept = async () => {
        if (!proofOfDeliveryImage) {
            Alert.alert("Proof Required", "Please take or upload a proof of delivery photo before confirming.");
            return;
        }

        try {
            setIsUploadingProof(true);
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            // Upload proof of delivery image
            const formData = new FormData();
            formData.append('orderId', orderData.id);
            
            const filename = proofOfDeliveryImage.split('/').pop() || 'proof.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('proofImage', {
                uri: proofOfDeliveryImage,
                name: filename,
                type: type,
            } as any);

            await axios.post(`${API_URL}/api/orders/upload-delivery-proof`, formData, {
                headers: {
                    Authorization: token,
                    'Content-Type': 'multipart/form-data',
                }
            });

            await axios.post(`${API_URL}/api/orders/update-order-status`, {
                orderId: orderData.id,
                status: "active_waiting_for_confirmation"
            }, {
                headers: { 'Authorization': token }
            });

            setIsUploadingProof(false);
            setCheckingConfirmation(true);
            
            // Set up polling to check for customer confirmation
            const intervalId = setInterval(checkOrderConfirmation, 5000);
            setPollingInterval(intervalId);
            
            // Set up auto-complete timeout (1 minute = 60000 ms)
            const timeoutId = setTimeout(autoCompleteOrder, 60000);
            setAutoCompleteTimeout(timeoutId);
            
            console.log('Order will auto-complete in 1 minute if customer does not rate');
        } catch (error) {
            console.error("Error confirming order completion:", error);
            setIsUploadingProof(false);
            Alert.alert("Error", "Failed to upload proof of delivery. Please try again.");
        }
    };

    const proceedWithCompletion = async () => {
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            // Fetch shop data if not available
            let shopDataToUse = shopData;
            if (!shopDataToUse) {
                const shopResponse = await axios.get(`${API_URL}/api/shops/${orderData.shopId}`, {
                    headers: { 'Authorization': token }
                });
                shopDataToUse = shopResponse.data;
            }

            const completedOrder = {
                orderId: orderData.id,
                dasherId: orderData.dasherId,
                shopId: orderData.shopId,
                userId: orderData.uid,
                paymentMethod: orderData.paymentMethod,
                deliveryFee: shopDataToUse?.deliveryFee || 0,
                totalPrice: orderData.totalPrice,
                items: orderData.items
            };

            const response = await axios.post(`${API_URL}/api/payments/confirm-order-completion`, completedOrder, {
                headers: { 'Authorization': token }
            });

            if (response.status === 200) {
                await axios.put(`${API_URL}/api/dashers/update/${orderData.dasherId}/status`, null, {
                    params: { status: 'active' },
                    headers: { 'Authorization': token }
                });
                closeModal();
                onOrderCompleted();
            }
        } catch (error) {
            console.error('Error completing the order:', error);
        }
    };

    const handleNoShowClick = () => {
        setIsNoShowModalOpen(true);
    };

    return (
        <>
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
                        
                        <Text style={styles.title}>Order Completion</Text>
                        <View style={styles.divider} />
                        
                        <View style={styles.contentContainer}>
                            <Text style={styles.message}>Payment has been completed.</Text>
                            
                            {!checkingConfirmation && (
                                <>
                                    <Text style={styles.proofLabel}>Proof of Delivery</Text>
                                    
                                    {proofOfDeliveryImage ? (
                                        <View style={styles.proofImageContainer}>
                                            <Image 
                                                source={{ uri: proofOfDeliveryImage }}
                                                style={styles.proofImage}
                                                resizeMode="cover"
                                            />
                                            <TouchableOpacity 
                                                style={styles.changePhotoButton}
                                                onPress={handleTakeProofPhoto}
                                            >
                                                <Ionicons name="camera" size={16} color="#fff" />
                                                <Text style={styles.changePhotoText}>Retake</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.proofButtonsContainer}>
                                            <TouchableOpacity 
                                                style={styles.proofButton}
                                                onPress={handleTakeProofPhoto}
                                            >
                                                <Ionicons name="camera" size={24} color="#BC4A4D" />
                                                <Text style={styles.proofButtonText}>Take Photo</Text>
                                            </TouchableOpacity>
                                            
                                            <TouchableOpacity 
                                                style={styles.proofButton}
                                                onPress={handleSelectProofPhoto}
                                            >
                                                <Ionicons name="images" size={24} color="#BC4A4D" />
                                                <Text style={styles.proofButtonText}>Select Photo</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </>
                            )}
                            
                            {checkingConfirmation && (
                                <Text style={styles.waitingText}>Waiting for user confirmation...</Text>
                            )}
                        </View>

                        <TouchableOpacity 
                            style={[styles.confirmButton, (checkingConfirmation || isUploadingProof) && styles.disabledButton]} 
                            onPress={confirmAccept}
                            disabled={checkingConfirmation || isUploadingProof}
                        >
                            {isUploadingProof ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.confirmButtonText}>Confirm</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.divider} />
                        
                        <TouchableOpacity onPress={handleNoShowClick}>
                            <Text style={styles.noShowText}>
                                Customer did not show? Click Here
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <DasherNoShowModal
                isOpen={isNoShowModalOpen}
                closeModal={() => setIsNoShowModalOpen(false)}
                orderData={orderData}
                onOrderCompleted={onOrderCompleted}
            />
        </>
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
        marginBottom: 10,
    },
    divider: {
        height: 1,
        backgroundColor: '#ccc',
        marginVertical: 10,
    },
    contentContainer: {
        marginBottom: 20,
        alignItems: 'center',
    },
    message: {
        fontSize: 18,
        color: '#000',
        textAlign: 'center',
        marginBottom: 10,
    },
    waitingText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    confirmButton: {
        backgroundColor: '#FFD700',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    disabledButton: {
        opacity: 0.7,
    },
    confirmButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    noShowText: {
        color: '#FF0000',
        fontSize: 12,
        textAlign: 'center',
        textDecorationLine: 'underline',
        marginTop: 10,
    },
    proofLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
        marginTop: 16,
        marginBottom: 12,
        textAlign: 'center',
    },
    proofButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 16,
    },
    proofButton: {
        backgroundColor: '#FFF',
        borderWidth: 2,
        borderColor: '#BC4A4D',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        width: '45%',
    },
    proofButtonText: {
        color: '#BC4A4D',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
    proofImageContainer: {
        width: '100%',
        marginBottom: 16,
        position: 'relative',
    },
    proofImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#10B981',
    },
    changePhotoButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: '#BC4A4D',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    changePhotoText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
    },
});

export default DasherCompletedModal; 