import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import { styled } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledScrollView = styled(ScrollView);

const CustomAlert = ({ visible, title, message, onClose }: { visible: boolean; title: string; message: string; onClose: () => void }) => (
    <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={onClose}
    >
        <StyledView className="flex-1 justify-center items-center bg-black/50">
            <StyledView className="bg-white rounded-3xl p-6 w-[80%] max-w-[400px]">
                <StyledText className="text-xl font-bold text-center text-gray-900 mb-2">{title}</StyledText>
                <StyledText className="text-base text-center text-gray-600 mb-6">{message}</StyledText>
                <StyledTouchableOpacity
                    className="h-12 rounded-xl justify-center items-center"
                    style={{ backgroundColor: '#BC4A4D' }}
                    onPress={onClose}
                >
                    <StyledText className="text-white text-base font-semibold">OK</StyledText>
                </StyledTouchableOpacity>
            </StyledView>
        </StyledView>
    </Modal>
);

interface PasswordRequirementsProps {
    password: string;
}

const PasswordRequirements = ({ password }: PasswordRequirementsProps) => {
    const requirements = [
        {
            test: (pass: string) => pass.length >= 8,
            text: 'At least 8 characters'
        },
        {
            test: (pass: string) => /[A-Z]/.test(pass),
            text: 'Contains an uppercase letter'
        },
        {
            test: (pass: string) => /[0-9]/.test(pass),
            text: 'Contains a number'
        },
        {
            test: (pass: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pass),
            text: 'Contains a symbol'
        }
    ];

    return (
        <StyledView className="bg-gray-50 rounded-xl p-3 mt-2 mb-4 border border-gray-100">
            <StyledText className="text-sm font-semibold text-gray-800 mb-2">Password Requirements</StyledText>
            {requirements.map((req, index) => (
                <StyledView key={index} className="flex-row items-center my-1">
                    <Ionicons
                        name={req.test(password) ? "checkmark-circle" : "ellipse-outline"}
                        size={16}
                        color={req.test(password) ? "#4CAF50" : "#9CA3AF"}
                        style={{ marginRight: 8 }}
                    />
                    <StyledText className={`text-sm ${req.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
                        {req.text}
                    </StyledText>
                </StyledView>
            ))}
        </StyledView>
    );
};

// Updated regex to match all the password requirements including special characters
const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

const ResetPassword = () => {
    const [userId, setUserId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [alert, setAlert] = useState({ visible: false, title: '', message: '', onConfirm: null as (() => void) | null });

    const { email } = useLocalSearchParams<{ email: string }>();

    useEffect(() => {
        if (email) {
            axios.get(`${API_URL}/api/users/by-email/${email}`)
                .then((response) => {
                    const fetchedUser = response.data;
                    if (fetchedUser && fetchedUser.id) {
                        setUserId(fetchedUser.id);
                    } else {
                        console.error('Email not found or userid not retrieved');
                    }
                })
                .catch((error) => {
                    console.error('Error fetching userid:', error);
                });
        }
    }, [email]);

    if (!email) {
        return (
            <StyledSafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
                <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
                <StyledView className="flex-1 justify-center items-center p-4">
                    <StyledText className="text-gray-600 text-center">
                        This page is for admin-only access. You don't have the necessary privileges to view this content.
                    </StyledText>
                </StyledView>
            </StyledSafeAreaView>
        );
    }

    const handleSubmit = async () => {
        setError('');

        const v1 = PWD_REGEX.test(newPassword);
        if (!v1) {
            setError("Password must be at least 8 characters and contain uppercase, number, and special character.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        const updatedUserData = {
            id: userId,
            password: newPassword
        };

        try {
            const response = await axios.put(`${API_URL}/api/users/update/${userId}`, updatedUserData);

            if (response.status === 200) {
                setAlert({
                    visible: true,
                    title: 'Success',
                    message: 'Password updated successfully. You may now log in with your new password.',
                    onConfirm: () => router.replace('/login')
                });
            } else {
                setError('Error updating user data');
            }
        } catch (error: any) {
            console.error('Error during update:', error.message);
            setError('Error updating user data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <StyledSafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
            <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <StyledScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                    showsVerticalScrollIndicator={false}
                >
                    <StyledView className="flex-1 px-6 pt-15 pb-6 justify-center">
                        <StyledView className="bg-white rounded-3xl p-6 shadow-sm">
                            <StyledText className="text-2xl font-bold text-center text-gray-900 mb-2">
                                Reset Password
                            </StyledText>
                            <StyledText className="text-sm text-center text-gray-500 mb-6">
                                Enter your new password
                            </StyledText>

                            {error ? (
                                <StyledView className="mb-4 p-3 bg-red-50 rounded-xl">
                                    <StyledText className="text-red-500 text-sm text-center">{error}</StyledText>
                                </StyledView>
                            ) : null}

                            <StyledView className="space-y-4">
                                <StyledView>
                                    <StyledTextInput
                                        className="h-12 bg-gray-50 rounded-xl px-4 text-gray-800"
                                        placeholder="New Password"
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        secureTextEntry
                                        editable={!loading}
                                    />
                                    <PasswordRequirements password={newPassword} />
                                </StyledView>

                                <StyledView>
                                    <StyledTextInput
                                        className="h-12 bg-gray-50 rounded-xl px-4 text-gray-800"
                                        placeholder="Confirm New Password"
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                        editable={!loading}
                                    />
                                </StyledView>

                                <StyledTouchableOpacity
                                    className={`h-12 rounded-xl justify-center items-center ${loading ? 'opacity-50' : ''}`}
                                    style={{ backgroundColor: '#BC4A4D' }}
                                    onPress={handleSubmit}
                                    disabled={loading || !confirmPassword}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <StyledText className="text-white text-base font-semibold">
                                            Submit
                                        </StyledText>
                                    )}
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </StyledScrollView>
            </KeyboardAvoidingView>
            <CustomAlert
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                onClose={() => {
                    setAlert({ ...alert, visible: false });
                    if (alert.onConfirm) {
                        alert.onConfirm();
                    }
                }}
            />
        </StyledSafeAreaView>
    );
};

export default ResetPassword; 