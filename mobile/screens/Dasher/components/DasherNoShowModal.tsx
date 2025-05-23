import React from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";
import axios from "axios";
import { API_URL } from "../../../config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from "../../../config";

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

    const confirm = async () => {
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) return;

            const updateResponse = await axios.post(
                `${API_URL}/api/orders/update-order-status`,
                {
                    orderId: orderData.id,
                    status: "no-show"
                },
                { headers: { 'Authorization': token } }
            );

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
                    <View style={styles.divider} />
                    
                    <View style={styles.contentContainer}>
                        <Text style={styles.message}>
                            The customer failed to show up for the delivery.
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
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default DasherNoShowModal; 