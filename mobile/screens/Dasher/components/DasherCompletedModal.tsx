import React, { useEffect, useState } from "react";
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from "react-native";
import { styled } from "nativewind";
import axios from "axios";
import { API_URL } from "../../../config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from "../../../config";
import DasherNoShowModal from "./DasherNoShowModal";

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

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
            
            // Set up polling to check for customer confirmation
            const intervalId = setInterval(checkOrderConfirmation, 5000);
            setPollingInterval(intervalId);
            
            // Set up auto-complete timeout (1 minute = 60000 ms)
            const timeoutId = setTimeout(autoCompleteOrder, 60000);
            setAutoCompleteTimeout(timeoutId);
            
            console.log('Order will auto-complete in 1 minute if customer does not rate');
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
                <StyledView className="flex-1 bg-black/70 justify-center items-center">
                    <StyledView className="bg-white w-[90%] max-w-sm p-5 rounded-lg">
                        <StyledTouchableOpacity className="absolute right-2.5 top-2.5 p-1.5" onPress={closeModal}>
                            <StyledText className="text-xl text-gray-600">✖</StyledText>
                        </StyledTouchableOpacity>
                        
                        <StyledText className="text-2xl font-bold text-black mb-2.5 text-center">Order Completion</StyledText>
                        <StyledView className="h-px bg-gray-300 my-2.5" />
                        
                        <StyledView className="mb-5 items-center">
                            <StyledText className="text-base text-black text-center mb-2.5">Payment has been completed.</StyledText>
                            {checkingConfirmation && (
                                <StyledText className="text-sm text-blue-600 text-center">Waiting for user confirmation...</StyledText>
                            )}
                        </StyledView>

                        <StyledTouchableOpacity 
                            className={`py-3 px-6 rounded-lg items-center mb-2.5 ${checkingConfirmation ? 'bg-gray-300 opacity-50' : 'bg-green-600'}`}
                            onPress={confirmAccept}
                            disabled={checkingConfirmation}
                        >
                            <StyledText className="text-white text-base font-bold">Confirm</StyledText>
                        </StyledTouchableOpacity>

                        <StyledView className="h-px bg-gray-300 my-2.5" />
                        
                        <StyledTouchableOpacity onPress={handleNoShowClick}>
                            <StyledText className="text-red-600 text-center underline">
                                Customer did not show? Click Here
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
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

export default DasherCompletedModal; 