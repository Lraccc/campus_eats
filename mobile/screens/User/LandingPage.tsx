import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Dimensions,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';
import { styled } from 'nativewind';

const { width, height } = Dimensions.get('window');

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);
const StyledScrollView = styled(ScrollView);

const LandPage = () => {
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
                if (token) {
                    router.replace('/home');
                }
            } catch (error) {
                console.error('Error checking auth:', error);
            }
        };

        checkAuth();
    }, []);

    const handleGetStarted = () => {
        setIsLoading(true);
        setTimeout(() => {
            router.push('/');
            setIsLoading(false);
        }, 500);
    };

    const handleSignIn = () => {
        router.push('/');
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-[#f0e6d2]"
        >
            <SafeAreaView className="flex-1 bg-[#f0e6d2]">
                <StatusBar barStyle="dark-content" backgroundColor="#f0e6d2" />

                <StyledScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1 }}
                >
                    {/* Header */}
                    <StyledView className="px-6 pt-4 pb-2">
                        <StyledView className="flex-row items-center justify-between">
                            <StyledView>
                                <StyledView className="flex-row items-center">
                                    <StyledText className="text-3xl font-black text-[#8B4513]">Campus</StyledText>
                                    <StyledText className="text-3xl font-black text-[#BC4A4D]">Eats</StyledText>
                                </StyledView>
                                <StyledText className="text-sm text-[#8B4513]/70 mt-1">
                                    CIT University
                                </StyledText>
                            </StyledView>

                            <StyledTouchableOpacity
                                className="bg-white/80 px-4 py-2 rounded-2xl"
                                onPress={handleSignIn}
                                style={{
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 4,
                                    elevation: 2,
                                }}
                            >
                                <StyledText className="text-[#8B4513] font-bold text-sm">Sign In</StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>

                    {/* Hero Section */}
                    <StyledView className="flex-1 px-6 pt-8">
                        {/* Main Content */}
                        <StyledView className="mb-12">
                            <StyledText className="text-4xl font-black text-[#8B4513] leading-[48px] mb-4">
                                Delicious Food{'\n'}
                                <StyledText className="text-[#BC4A4D]">Delivered Fast</StyledText>
                            </StyledText>

                            <StyledText className="text-lg text-[#8B4513]/70 leading-7 mb-8">
                                Get your favorite campus meals delivered right to your dorm or classroom in minutes!
                            </StyledText>

                            {/* Features */}
                            <StyledView className="mb-8">
                                <StyledView className="flex-row items-center mb-4">
                                    <StyledView className="w-12 h-12 bg-[#BC4A4D]/10 rounded-2xl items-center justify-center mr-4">
                                        <StyledText className="text-2xl">🚀</StyledText>
                                    </StyledView>
                                    <StyledView className="flex-1">
                                        <StyledText className="text-lg font-bold text-[#8B4513] mb-1">Fast Delivery</StyledText>
                                        <StyledText className="text-[#8B4513]/60">15-30 minutes to your location</StyledText>
                                    </StyledView>
                                </StyledView>

                                <StyledView className="flex-row items-center mb-4">
                                    <StyledView className="w-12 h-12 bg-[#BC4A4D]/10 rounded-2xl items-center justify-center mr-4">
                                        <StyledText className="text-2xl">🍽️</StyledText>
                                    </StyledView>
                                    <StyledView className="flex-1">
                                        <StyledText className="text-lg font-bold text-[#8B4513] mb-1">Campus Favorites</StyledText>
                                        <StyledText className="text-[#8B4513]/60">All your favorite campus restaurants</StyledText>
                                    </StyledView>
                                </StyledView>

                                <StyledView className="flex-row items-center">
                                    <StyledView className="w-12 h-12 bg-[#BC4A4D]/10 rounded-2xl items-center justify-center mr-4">
                                        <StyledText className="text-2xl">💳</StyledText>
                                    </StyledView>
                                    <StyledView className="flex-1">
                                        <StyledText className="text-lg font-bold text-[#8B4513] mb-1">Easy Payment</StyledText>
                                        <StyledText className="text-[#8B4513]/60">Secure and convenient checkout</StyledText>
                                    </StyledView>
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        {/* Food Illustration */}
                        <StyledView className="items-center mb-8">
                            <StyledView
                                className="w-64 h-64 bg-white rounded-full items-center justify-center"
                                style={{
                                    shadowColor: '#BC4A4D',
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 20,
                                    elevation: 8,
                                }}
                            >
                                {/* Food Bowl */}
                                <StyledView
                                    className="w-32 h-20 bg-[#BC4A4D] rounded-t-full mb-2"
                                    style={{
                                        shadowColor: '#8B4513',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.2,
                                        shadowRadius: 8,
                                        elevation: 4,
                                    }}
                                />

                                {/* Food Items */}
                                <StyledView className="absolute top-16 flex-row">
                                    <StyledView className="w-6 h-6 bg-[#ffc107] rounded-full mr-2" />
                                    <StyledView className="w-6 h-6 bg-[#ff6b6b] rounded-full mr-2" />
                                    <StyledView className="w-6 h-6 bg-[#4ecdc4] rounded-full" />
                                </StyledView>

                                {/* Steam Lines */}
                                <StyledView className="absolute top-8">
                                    <StyledView className="w-1 h-8 bg-[#8B4513]/20 rounded-full mx-1" />
                                </StyledView>
                                <StyledView className="absolute top-6 left-2">
                                    <StyledView className="w-1 h-6 bg-[#8B4513]/20 rounded-full mx-1" />
                                </StyledView>
                                <StyledView className="absolute top-6 right-2">
                                    <StyledView className="w-1 h-6 bg-[#8B4513]/20 rounded-full mx-1" />
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        {/* Action Buttons */}
                        <StyledView className="pb-8">
                            <StyledTouchableOpacity
                                className="bg-[#BC4A4D] py-4 rounded-3xl items-center mb-4"
                                onPress={handleGetStarted}
                                disabled={isLoading}
                                style={{
                                    shadowColor: '#BC4A4D',
                                    shadowOffset: { width: 0, height: 6 },
                                    shadowOpacity: 0.4,
                                    shadowRadius: 12,
                                    elevation: 8,
                                }}
                            >
                                {isLoading ? (
                                    <StyledView className="flex-row items-center">
                                        <ActivityIndicator size="small" color="white" />
                                        <StyledText className="text-white font-black text-xl ml-3">
                                            Getting Started...
                                        </StyledText>
                                    </StyledView>
                                ) : (
                                    <StyledText className="text-white font-black text-xl">
                                        🚀 Get Started
                                    </StyledText>
                                )}
                            </StyledTouchableOpacity>

                            <StyledView className="flex-row items-center justify-center">
                                <StyledText className="text-[#8B4513]/60 text-sm">
                                    Already have an account?
                                </StyledText>
                                <StyledTouchableOpacity onPress={handleSignIn} className="ml-1">
                                    <StyledText className="text-[#BC4A4D] font-bold text-sm">
                                        Sign In
                                    </StyledText>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>
                    </StyledView>

                    {/* Background Decorative Elements */}
                    <StyledView className="absolute top-32 right-8 w-16 h-16 bg-[#BC4A4D]/10 rounded-full" />
                    <StyledView className="absolute top-64 left-8 w-12 h-12 bg-[#ffc107]/20 rounded-full" />
                    <StyledView className="absolute bottom-32 right-12 w-20 h-20 bg-[#8B4513]/10 rounded-full" />

                    {/* Floating Elements */}
                    <StyledView
                        className="absolute top-48 right-4 w-8 h-8 bg-[#ffc107] rounded-full"
                        style={{
                            shadowColor: '#ffc107',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4,
                        }}
                    />
                    <StyledView
                        className="absolute top-80 left-4 w-6 h-6 bg-[#BC4A4D] rounded-full"
                        style={{
                            shadowColor: '#BC4A4D',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4,
                        }}
                    />
                </StyledScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

export default LandPage;