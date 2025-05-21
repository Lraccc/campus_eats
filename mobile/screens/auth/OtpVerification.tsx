"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
} from "react-native"
import { Stack, router } from "expo-router"
import axiosConfig from "../../config/axiosConfig"

interface OtpVerificationProps {
  email: string
  onVerificationSuccess?: () => void
}

export default function OtpVerification({ email, onVerificationSuccess }: OtpVerificationProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(120)
  const [canResend, setCanResend] = useState(false)

  const inputRefs = useRef<Array<TextInput | null>>([])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1)
      }, 1000)
    } else {
      setCanResend(true)
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
      setError("Please enter a valid 6-digit code")
      return
    }

    setIsLoading(true)
    setError("")

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
        setError("Invalid verification code")
      }
    } catch (err) {
      console.error("Verification error:", err)
      setError("Failed to verify code. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!canResend) return

    setIsLoading(true)
    setError("")

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
        setCountdown(120)
        setCanResend(false)
        Alert.alert("Success", "Verification code has been resent to your email.")
      }
    } catch (err) {
      console.error("Resend error:", err)
      setError("Failed to resend code. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
        />
        <Text style={styles.brandName}>CampusEats</Text>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>We've sent a 6-digit code to {email}</Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={styles.otpInput}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              editable={!isLoading}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, (!canResend || isLoading) && styles.buttonDisabled]}
          onPress={handleResendCode}
          disabled={!canResend || isLoading}
        >
          <Text style={styles.resendText}>
            {canResend
              ? "Resend Code"
              : `Resend in ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, "0")}`}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const { width } = Dimensions.get("window")
const inputWidth = (width - 80) / 6 - 8

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fae9e0",
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: "flex-start",
    paddingTop: 60,
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 10,
    marginTop: 40,
  },
  brandName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#c94c4c',
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  otpInput: {
    width: inputWidth,
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    backgroundColor: "white",
  },
  button: {
    backgroundColor: "#c94c4c",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  resendButton: {
    padding: 15,
    alignItems: "center",
  },
  resendText: {
    color: "#c94c4c",
    fontSize: 16,
  },
  error: {
    color: "red",
    marginBottom: 15,
    textAlign: "center",
  },
})
