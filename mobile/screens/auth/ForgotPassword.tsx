import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
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
    const [countdown, setCountdown] = useState(120); // 2 minutes in seconds (matching backend)
    const [canResend, setCanResend] = useState(false);
    const [codeExpired, setCodeExpired] = useState(false);

    // Function to check verification code status
    const checkCodeStatus = async () => {
        if (!email || !codeSent) return;
        
        try {
            const response = await axios.get(`${API_URL}/api/users/verificationCodeStatus`, {
                params: { email }
            });
            
            if (response.data.expired) {
                setCodeExpired(true);
                setCanResend(true);
                setCountdown(0);
            } else {
                setCodeExpired(false);
                setCountdown(response.data.remainingTime);
                setCanResend(response.data.remainingTime <= 0);
            }
        } catch (err) {
            console.error("Error checking code status:", err);
        }
    };

    // Countdown timer effect
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => {
                    const newCountdown = prev - 1;
                    if (newCountdown <= 0) {
                        setCanResend(true);
                        setCodeExpired(true);
                    }
                    return newCountdown;
                });
            }, 1000);
        } else {
            setCanResend(true);
            setCodeExpired(true);
        }
        return () => clearInterval(timer);
    }, [countdown]);

    // Check code status when code is sent
    useEffect(() => {
        if (codeSent) {
            checkCodeStatus();
        }
    }, [codeSent, email]);

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

            if (codeExpired) {
                setLoading(false);
                return setError('Verification code has expired. Please request a new one.');
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
                const errorMessage = error.response?.data || error.message;
                setError(errorMessage);
                
                // If the error indicates code expiration, update the state
                if (errorMessage.includes("expired")) {
                    setCodeExpired(true);
                    setCanResend(true);
                    setCountdown(0);
                }
            } finally {
                setLoading(false);
            }
        }
    };

    const handleResendCode = async () => {
        if (!canResend) return;

        setLoading(true);
        setError('');
        setCodeExpired(false);

        try {
            console.log('Resending verification code for:', email);
            const response = await axios.post(`${API_URL}/api/users/sendVerificationCode`, null, {
                params: {
                    email,
                    isMobile: true
                }
            });

            console.log('Resend response:', response.data);

            if (response.data) {
                // Reset the countdown to 2 minutes (120 seconds)
                setCountdown(120);
                setCanResend(false);
                setCodeExpired(false);
                setCode(''); // Clear the code input
                setAlert({
                    visible: true,
                    title: 'Success',
                    message: 'Verification code has been resent to your email.'
                });
            }
        } catch (err) {
            console.error("Resend error:", err);
            setError("Failed to resend code. Please try again.");
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
                                    <>
                                        <StyledView>
                                            <StyledTextInput
                                                className={`h-12 bg-gray-50 rounded-xl px-4 text-gray-800 ${codeExpired ? 'opacity-50' : ''}`}
                                                placeholder="Verification Code"
                                                value={code}
                                                onChangeText={setCode}
                                                editable={!loading && !codeExpired}
                                                keyboardType="number-pad"
                                            />
                                        </StyledView>

                                        {/* Code Expiration Warning */}
                                        {codeExpired && (
                                            <StyledView className="p-3 bg-red-50 rounded-xl border border-red-200">
                                                <StyledText className="text-red-600 text-center text-sm font-medium">
                                                    Verification code has expired
                                                </StyledText>
                                            </StyledView>
                                        )}

                                        {/* Resend Code Section */}
                                        <StyledView className="items-center mt-2">
                                            <StyledText className="text-gray-600 text-sm mb-1">
                                                {codeExpired ? "Code expired?" : "Didn't receive the code?"}
                                            </StyledText>
                                            <StyledTouchableOpacity
                                                className={`p-2 ${(!canResend || loading) ? 'opacity-50' : ''}`}
                                                onPress={handleResendCode}
                                                disabled={!canResend || loading}
                                            >
                                                <StyledText className="text-[#BC4A4D] font-medium">
                                                    {canResend
                                                        ? "Resend Code"
                                                        : `Resend in ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, "0")}`}
                                                </StyledText>
                                            </StyledTouchableOpacity>
                                            {!codeExpired && countdown > 0 && (
                                                <StyledText className="text-gray-500 text-xs mt-1">
                                                    Code expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                                                </StyledText>
                                            )}
                                        </StyledView>
                                    </>
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