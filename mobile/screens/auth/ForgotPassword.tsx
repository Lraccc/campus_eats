import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import { styled } from 'nativewind';

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

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [alert, setAlert] = useState({ visible: false, title: '', message: '' });

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        if (!email) {
            setLoading(false);
            return setError('Please enter your email');
        }

        if (!codeSent) {
            try {
                const emailCheckResponse = await axios.get(`${API_URL}/api/users/by-email/${email}`);
                if (!emailCheckResponse.data) {
                    setLoading(false);
                    return setError("Email address doesn't exist");
                }

                const sendCodeResponse = await axios.post(`${API_URL}/api/users/sendVerificationCode`, null, {
                    params: { email, isMobile: true }
                });

                if (sendCodeResponse.status === 200) {
                    setCodeSent(true);
                    setAlert({
                        visible: true,
                        title: 'Success',
                        message: 'Check your inbox for the code. Enter the code to reset your password.'
                    });
                } else {
                    setError('Failed to send verification code. Please try again.');
                }
            } catch (error: any) {
                const errorMessage = error.response?.data?.message || error.message;
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        } else {
            if (!code) {
                setLoading(false);
                return setError('Please enter the code sent to your email');
            }

            try {
                const verifyCodeResponse = await axios.post(`${API_URL}/api/users/verifyCode`, null, {
                    params: { email, enteredCode: code }
                });

                if (verifyCodeResponse.status === 200 && verifyCodeResponse.data === 'success') {
                    setAlert({
                        visible: true,
                        title: 'Success',
                        message: 'Your password has been reset successfully. You may now log in with your new password.'
                    });
                    router.push({
                        pathname: '/reset-password',
                        params: { email }
                    });
                } else {
                    setError("Incorrect verification code. Please try again.");
                }
            } catch (error: any) {
                const errorMessage = error.response?.data?.message || error.message;
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
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
                                Forgot Password
                            </StyledText>
                            <StyledText className="text-sm text-center text-gray-500 mb-6">
                                Enter your email to reset your password
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
                                        placeholder="Email"
                                        value={email}
                                        onChangeText={setEmail}
                                        editable={!loading && !codeSent}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </StyledView>

                                {codeSent && (
                                    <StyledView>
                                        <StyledTextInput
                                            className="h-12 bg-gray-50 rounded-xl px-4 text-gray-800"
                                            placeholder="Verification Code"
                                            value={code}
                                            onChangeText={setCode}
                                            editable={!loading}
                                            keyboardType="number-pad"
                                        />
                                    </StyledView>
                                )}

                                <StyledTouchableOpacity
                                    className={`h-12 rounded-xl justify-center items-center ${loading ? 'opacity-50' : ''}`}
                                    style={{ backgroundColor: '#BC4A4D' }}
                                    onPress={handleSubmit}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <StyledText className="text-white text-base font-semibold">
                                            {codeSent ? "Reset Password" : "Send Code"}
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
                onClose={() => setAlert({ ...alert, visible: false })}
            />
        </StyledSafeAreaView>
    );
};

export default ForgotPassword; 