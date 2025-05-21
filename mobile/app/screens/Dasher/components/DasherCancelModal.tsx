import React from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";
import axios from "axios";
import { API_URL } from "../../../../config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from "../../../../config";

interface DasherCancelModalProps {
    isOpen: boolean;
    closeModal: () => void;
    orderData: any;
    onOrderCompleted: () => void;
}

const DasherCancelModal: React.FC<DasherCancelModalProps> = ({
    isOpen,
    closeModal,
    orderData,
    onOrderCompleted
}) => {
    if (!isOpen) return null;

    const confirm = async () => {
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            const updateResponse = await axios.post(
                `${API_URL}/api/orders/update-order-status`,
                {
                    orderId: orderData.id,
                    status: "cancelled_by_dasher"
                },
                { headers: { 'Authorization': token } }
            );

            if (updateResponse.status === 200) {
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
            console.error('Error cancelling order:', error);
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
                    
                    <Text style={styles.title}>Cancel Order</Text>
                    <View style={styles.divider} />
                    
                    <View style={styles.contentContainer}>
                        <Text style={styles.message}>
                            Are you sure you want to cancel this order?
                        </Text>
                        <Text style={styles.warningText}>
                            This action cannot be undone.
                        </Text>
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity 
                            style={[styles.button, styles.confirmButton]} 
                            onPress={confirm}
                        >
                            <Text style={styles.buttonText}>Confirm</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.button, styles.cancelButton]} 
                            onPress={closeModal}
                        >
                            <Text style={styles.buttonText}>Back</Text>
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
        textAlign: 'center',
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
        fontSize: 16,
        color: '#000',
        textAlign: 'center',
        marginBottom: 10,
    },
    warningText: {
        fontSize: 14,
        color: '#FF0000',
        textAlign: 'center',
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
        backgroundColor: '#FF0000',
    },
    cancelButton: {
        backgroundColor: '#ccc',
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default DasherCancelModal; 