import React from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

export interface AlertModalProps {
    visible: boolean;
    title: string;
    message: string;
    showConfirmButton?: boolean;
    showCancelButton?: boolean;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    type?: 'success' | 'error' | 'warning' | 'info';
}

const AlertModal: React.FC<AlertModalProps> = ({
    visible,
    title,
    message,
    showConfirmButton = true,
    showCancelButton = false,
    confirmText = 'OK',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    type = 'info'
}) => {
    const getIconAndColor = () => {
        switch (type) {
            case 'success':
                return { icon: 'checkmark-circle', color: '#10B981', bgColor: '#D1FAE5' };
            case 'error':
                return { icon: 'close-circle', color: '#EF4444', bgColor: '#FEE2E2' };
            case 'warning':
                return { icon: 'warning', color: '#F59E0B', bgColor: '#FEF3C7' };
            default:
                return { icon: 'information-circle', color: '#3B82F6', bgColor: '#DBEAFE' };
        }
    };

    const { icon, color, bgColor } = getIconAndColor();

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onCancel || (() => {})}
        >
            <StyledView className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                <StyledView 
                    className="mx-6 rounded-2xl overflow-hidden"
                    style={{
                        backgroundColor: 'white',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: 8,
                        minWidth: 280,
                        maxWidth: '90%'
                    }}
                >
                    {/* Header */}
                    <StyledView className="items-center pt-6 pb-4 px-6">
                        <StyledView 
                            className="w-16 h-16 rounded-full items-center justify-center mb-4"
                            style={{ backgroundColor: bgColor }}
                        >
                            <Ionicons name={icon as any} size={32} color={color} />
                        </StyledView>
                        
                        <StyledText className="text-xl font-bold text-center mb-2" style={{ color: '#1F2937' }}>
                            {title}
                        </StyledText>
                        
                        <StyledText className="text-base text-center leading-6" style={{ color: '#6B7280' }}>
                            {message}
                        </StyledText>
                    </StyledView>

                    {/* Buttons */}
                    <StyledView className="px-6 pb-6">
                        {showCancelButton && showConfirmButton ? (
                            <StyledView className="flex-row space-x-3">
                                <StyledTouchableOpacity
                                    className="flex-1 py-3 px-4 rounded-xl border"
                                    style={{
                                        borderColor: '#D1D5DB',
                                        backgroundColor: 'white'
                                    }}
                                    onPress={onCancel}
                                >
                                    <StyledText className="text-center text-base font-semibold" style={{ color: '#6B7280' }}>
                                        {cancelText}
                                    </StyledText>
                                </StyledTouchableOpacity>
                                
                                <StyledTouchableOpacity
                                    className="flex-1 py-3 px-4 rounded-xl"
                                    style={{ backgroundColor: color }}
                                    onPress={onConfirm}
                                >
                                    <StyledText className="text-center text-base font-semibold text-white">
                                        {confirmText}
                                    </StyledText>
                                </StyledTouchableOpacity>
                            </StyledView>
                        ) : showConfirmButton ? (
                            <StyledTouchableOpacity
                                className="py-3 px-4 rounded-xl"
                                style={{ backgroundColor: color }}
                                onPress={onConfirm}
                            >
                                <StyledText className="text-center text-base font-semibold text-white">
                                    {confirmText}
                                </StyledText>
                            </StyledTouchableOpacity>
                        ) : showCancelButton ? (
                            <StyledTouchableOpacity
                                className="py-3 px-4 rounded-xl border"
                                style={{
                                    borderColor: '#D1D5DB',
                                    backgroundColor: 'white'
                                }}
                                onPress={onCancel}
                            >
                                <StyledText className="text-center text-base font-semibold" style={{ color: '#6B7280' }}>
                                    {cancelText}
                                </StyledText>
                            </StyledTouchableOpacity>
                        ) : null}
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
};

export default AlertModal;