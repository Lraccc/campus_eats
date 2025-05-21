import React, { useEffect, useState } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import axios from "axios";
import { API_URL } from "../../../../config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from "../../../../config";
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

    useEffect(() => {
        if (pollingInterval) {
            return () => clearInterval(pollingInterval);
        }
    }, [pollingInterval]);

    if (!isOpen) return null;

    const checkOrderConfirmation = async () => {
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            const response = await axios.get(`${API_URL}/api/orders/${orderData.id}`, {
                headers: { 'Authorization': token }
            });
            const updatedOrder = response.data;

            if (updatedOrder.status === "completed") {
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                }
                setCheckingConfirmation(false);
                proceedWithCompletion();
            }
        } catch (error) {
            console.error("Error checking order status:", error);
        }
    };

    const confirmAccept = async () => {
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            await axios.post(`${API_URL}/api/orders/update-order-status`, {
                orderId: orderData.id,
                status: "active_waiting_for_confirmation"
            }, {
                headers: { 'Authorization': token }
            });

            setCheckingConfirmation(true);
            const intervalId = setInterval(checkOrderConfirmation, 5000);
            setPollingInterval(intervalId);
        } catch (error) {
            console.error("Error confirming order completion:", error);
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
                            {checkingConfirmation && (
                                <Text style={styles.waitingText}>Waiting for user confirmation...</Text>
                            )}
                        </View>

                        <TouchableOpacity 
                            style={[styles.confirmButton, checkingConfirmation && styles.disabledButton]} 
                            onPress={confirmAccept}
                            disabled={checkingConfirmation}
                        >
                            <Text style={styles.confirmButtonText}>Confirm</Text>
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
});

export default DasherCompletedModal; 