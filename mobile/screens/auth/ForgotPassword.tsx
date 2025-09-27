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
        <StyledView className="flex-1 justify-center items-center bg-black/50 px-5">
            <StyledView 
              className="bg-white rounded-2xl p-6 w-full max-w-sm"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
                <StyledText className="text-lg font-bold text-center text-[#8B4513] mb-3">{title}</StyledText>
                <StyledText className="text-sm text-center text-[#8B4513]/70 mb-5 leading-5">{message}</StyledText>
                <StyledTouchableOpacity
                    className="h-12 rounded-xl justify-center items-center"
                    style={{ 
                      backgroundColor: '#BC4A4D',
                      shadowColor: "#BC4A4D",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                    onPress={onClose}
                >
                    <StyledText className="text-white text-base font-bold">OK</StyledText>
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
        <StyledSafeAreaView className="flex-1 bg-[#DFD6C5]">
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
                    <StyledView className="flex-1 px-5 pt-12 pb-6 justify-center">
                        <StyledView 
                          className="bg-white rounded-2xl p-6"
                          style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 12,
                            elevation: 6,
                          }}
                        >
                            <StyledText className="text-2xl font-bold text-center text-[#8B4513] mb-2">
                                Forgot Password
                            </StyledText>
                            <StyledText className="text-sm text-center text-[#8B4513]/60 mb-6">
                                Enter your email to reset your password
                            </StyledText>

                            {error ? (
                                <StyledView className="mb-4 p-4 bg-red-50 rounded-xl">
                                    <StyledText className="text-red-600 text-sm text-center">{error}</StyledText>
                                </StyledView>
                            ) : null}

                            <StyledView className="space-y-4">
                                <StyledView>
                                    <StyledTextInput
                                        className="h-14 bg-[#DFD6C5]/30 rounded-xl px-4 text-[#8B4513] font-medium"
                                        placeholder="Email Address"
                                        placeholderTextColor="#8B4513/50"
                                        value={email}
                                        onChangeText={setEmail}
                                        editable={!loading && !codeSent}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        style={{
                                          borderWidth: 1,
                                          borderColor: email ? '#BC4A4D' : 'rgba(139, 69, 19, 0.2)',
                                        }}
                                    />
                                </StyledView>

                                {codeSent && (
                                    <>
                                        <StyledView>
                                            <StyledTextInput
                                                className={`h-14 bg-[#DFD6C5]/30 rounded-xl px-4 text-[#8B4513] font-medium ${codeExpired ? 'opacity-50' : ''}`}
                                                placeholder="Verification Code"
                                                placeholderTextColor="#8B4513/50"
                                                value={code}
                                                onChangeText={setCode}
                                                editable={!loading && !codeExpired}
                                                keyboardType="number-pad"
                                                style={{
                                                  borderWidth: 1,
                                                  borderColor: code ? '#BC4A4D' : 'rgba(139, 69, 19, 0.2)',
                                                }}
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
                                            <StyledText className="text-[#8B4513]/70 text-sm mb-1 font-medium">
                                                {codeExpired ? "Code expired?" : "Didn't receive the code?"}
                                            </StyledText>
                                            <StyledTouchableOpacity
                                                className={`p-2 ${(!canResend || loading) ? 'opacity-50' : ''}`}
                                                onPress={handleResendCode}
                                                disabled={!canResend || loading}
                                            >
                                                <StyledText className="text-[#BC4A4D] font-bold">
                                                    {canResend
                                                        ? "Resend Code"
                                                        : `Resend in ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, "0")}`}
                                                </StyledText>
                                            </StyledTouchableOpacity>
                                            {!codeExpired && countdown > 0 && (
                                                <StyledText className="text-[#8B4513]/60 text-xs mt-1">
                                                    Code expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                                                </StyledText>
                                            )}
                                        </StyledView>
                                    </>
                                )}

                                <StyledTouchableOpacity
                                    className={`h-14 rounded-xl justify-center items-center ${loading ? 'opacity-50' : ''}`}
                                    style={{ 
                                      backgroundColor: '#BC4A4D',
                                      shadowColor: "#BC4A4D",
                                      shadowOffset: { width: 0, height: 3 },
                                      shadowOpacity: 0.3,
                                      shadowRadius: 6,
                                      elevation: 4,
                                    }}
                                    onPress={handleSubmit}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <StyledText className="text-white text-base font-bold">
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