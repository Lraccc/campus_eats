import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import { styled } from "nativewind";
import axios from "axios";
import { API_URL } from "../../../config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from "../../../config";

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

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
            <StyledView className="flex-1 bg-black/70 justify-center items-center">
                <StyledView className="bg-white w-[90%] max-w-sm p-5 rounded-lg">
                    <StyledTouchableOpacity className="absolute right-2.5 top-2.5 p-1.5" onPress={closeModal}>
                        <StyledText className="text-xl text-gray-600">✖</StyledText>
                    </StyledTouchableOpacity>
                    
                    <StyledText className="text-2xl font-bold text-black mb-2.5 text-center">Cancel Order</StyledText>
                    <StyledView className="h-px bg-gray-300 my-2.5" />
                    
                    <StyledView className="mb-5 items-center">
                        <StyledText className="text-base text-black text-center mb-2.5">
                            Are you sure you want to cancel this order?
                        </StyledText>
                        <StyledText className="text-sm text-red-600 text-center">
                            This action cannot be undone.
                        </StyledText>
                    </StyledView>

                    <StyledView className="flex-row justify-center gap-2.5">
                        <StyledTouchableOpacity 
                            className="py-2.5 px-5 rounded-lg min-w-24 items-center bg-red-600" 
                            onPress={confirm}
                        >
                            <StyledText className="text-black text-base font-bold">Confirm</StyledText>
                        </StyledTouchableOpacity>
                        
                        <StyledTouchableOpacity 
                            className="py-2.5 px-5 rounded-lg min-w-24 items-center bg-gray-300" 
                            onPress={closeModal}
                        >
                            <StyledText className="text-black text-base font-bold">Back</StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
};

export default DasherCancelModal; 