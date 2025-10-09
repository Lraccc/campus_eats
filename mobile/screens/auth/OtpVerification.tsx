import React, { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
} from "react-native"
import { Stack, router } from "expo-router"
import axiosConfig from "../../services/axiosConfig"
import { styled } from "nativewind"

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledImage = styled(Image)

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

interface OtpVerificationProps {
  email: string
  onVerificationSuccess?: () => void
}

export default function OtpVerification({ email, onVerificationSuccess }: OtpVerificationProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState(600) // 10 minutes in seconds
  const [canResend, setCanResend] = useState(false)
  const [codeExpired, setCodeExpired] = useState(false)
  const [alert, setAlert] = useState({ visible: false, title: '', message: '' })

  const inputRefs = useRef<(TextInput | null)[]>([])

  const setRef = (index: number) => (ref: TextInput | null) => {
    inputRefs.current[index] = ref
  }

  // Function to check verification code status
  const checkCodeStatus = async () => {
    try {
      const response = await axiosConfig.get('/api/users/verificationCodeStatus', {
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

  useEffect(() => {
    // Check initial code status when component mounts
    checkCodeStatus();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout
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
      }, 1000)
    } else {
      setCanResend(true);
      setCodeExpired(true);
    }
    return () => clearInterval(timer)
  }, [countdown])

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyPress = (e: any, index: number) => {
    // Move to previous input on backspace if current input is empty
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const otpValue = otp.join("")
    if (otpValue.length !== 6) {
      setAlert({
        visible: true,
        title: 'Invalid Input',
        message: 'Please enter a valid 6-digit code.'
      })
      return
    }

    if (codeExpired) {
      setAlert({
        visible: true,
        title: 'Code Expired',
        message: 'Verification code has expired. Please request a new one.'
      })
      return
    }

    setIsLoading(true)

    try {
      console.log("Verifying OTP:", { email, otp: otpValue })

      const response = await axiosConfig.post('/api/users/verify', null, {
        params: {
          email,
          code: otpValue
        }
      });

      console.log('Verification response:', response.data);

      if (response.data === 'User verified successfully') {
        console.log("Navigating to success screen...");
        router.push("/verification-success");
      } else {
        setAlert({
          visible: true,
          title: 'Invalid Code',
          message: 'The verification code you entered is incorrect. Please try again.'
        })
      }
    } catch (err: any) {
      console.error("Verification error:", err)
      const errorMessage = err.response?.data || "Failed to verify code. Please try again."
      
      // If the error indicates code expiration, update the state
      if (errorMessage.includes("expired")) {
        setCodeExpired(true);
        setCanResend(true);
        setCountdown(0);
        setAlert({
          visible: true,
          title: 'Code Expired',
          message: 'Your verification code has expired. Please request a new one.'
        })
      } else {
        setAlert({
          visible: true,
          title: 'Verification Failed',
          message: errorMessage
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!canResend) return

    setIsLoading(true)
    setCodeExpired(false)

    try {
      console.log('Resending verification code for:', email);
      const response = await axiosConfig.post('/api/users/sendVerificationCode', null, {
        params: {
          email,
          isMobile: true
        }
      });

      console.log('Resend response:', response.data);

      if (response.data) {
        // Reset the countdown to 10 minutes (600 seconds)
        setCountdown(600)
        setCanResend(false)
        setCodeExpired(false)
        // Clear the OTP input fields
        setOtp(["", "", "", "", "", ""])
        setAlert({
          visible: true,
          title: 'Success',
          message: 'Verification code has been resent to your email.'
        })
      }
    } catch (err) {
      console.error("Resend error:", err)
      setAlert({
        visible: true,
        title: 'Resend Failed',
        message: 'Failed to resend code. Please try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const { width } = Dimensions.get("window")
  const inputWidth = (width - 80) / 6 - 8

  return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-[#DFD6C5]">
        <Stack.Screen options={{ headerShown: false }} />
        <StyledView className="flex-1 px-6 justify-center">
          {/* Logo and Header Section */}
          <StyledView className="items-center mb-10">
            <StyledImage
                source={require('../../assets/images/logo.png')}
                className="w-24 h-24 mb-4"
            />
            <StyledText className="text-2xl font-bold">
              <StyledText className="text-[#BC4A4DFF]">Campus</StyledText>
              <StyledText className="text-[#DAA520]">Eats</StyledText>
            </StyledText>
          </StyledView>

          {/* Verification Section */}
          <StyledView className="bg-white/80 rounded-2xl p-6 shadow-md">
            <StyledText className="text-xl font-bold mb-2 text-center text-[#333]">Email Verification</StyledText>
            <StyledText className="text-sm text-[#555] mb-6 text-center">
              We've sent a 6-digit code to{"\n"}
              <StyledText className="font-medium">{email}</StyledText>
            </StyledText>

            {/* OTP Input Fields */}
            <StyledView className="flex-row justify-between mb-6">
              {otp.map((digit, index) => (
                  <StyledTextInput
                      key={index}
                      ref={setRef(index)}
                      style={{
                        width: inputWidth,
                        height: 50,
                        borderRadius: 8,
                        textAlign: 'center',
                        fontSize: 20,
                        fontWeight: 'bold',
                        backgroundColor: '#F8F8F8',
                        borderWidth: 1,
                        borderColor: digit ? '#BC4A4D' : '#E0E0E0',
                      }}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={1}
                      editable={!isLoading && !codeExpired}
                      selectTextOnFocus
                  />
              ))}
            </StyledView>


            {/* Code Expiration Warning */}
            {codeExpired && (
                <StyledView className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <StyledText className="text-red-600 text-center text-sm font-medium">
                    Verification code has expired
                  </StyledText>
                </StyledView>
            )}

            {/* Verify Button */}
            <StyledTouchableOpacity
                className={`bg-[#BC4A4D] p-4 rounded-lg items-center mb-4 ${isLoading ? 'opacity-70' : ''}`}
                onPress={handleVerify}
                disabled={isLoading}
                style={{ elevation: 2 }}
            >
              {isLoading ? (
                  <ActivityIndicator color="#fff" />
              ) : (
                  <StyledText className="text-white text-base font-bold">Verify Code</StyledText>
              )}
            </StyledTouchableOpacity>

            {/* Resend Code */}
            <StyledView className="items-center mt-2">
              <StyledText className="text-[#666] text-sm mb-1">
                {codeExpired ? "Code expired?" : "Didn't receive the code?"}
              </StyledText>
              <StyledTouchableOpacity
                  className={`p-2 ${(!canResend || isLoading) ? 'opacity-50' : ''}`}
                  onPress={handleResendCode}
                  disabled={!canResend || isLoading}
              >
                <StyledText className="text-[#BC4A4D] font-medium">
                  {canResend
                      ? "Resend Code"
                      : `Resend in ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, "0")}`}
                </StyledText>
              </StyledTouchableOpacity>
              {!codeExpired && countdown > 0 && (
                <StyledText className="text-[#888] text-xs mt-1">
                  Code expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                </StyledText>
              )}
            </StyledView>
          </StyledView>
        </StyledView>
        <CustomAlert
          visible={alert.visible}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert({ ...alert, visible: false })}
        />
      </KeyboardAvoidingView>
  )
}