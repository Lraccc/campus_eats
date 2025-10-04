import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Image,
    Animated,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);

interface SplashScreenProps {
    message?: string;
    showMessage?: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ 
    message = 'Campus Eats', 
    showMessage = true 
}) => {
    // Animation values
    const spinValue = useRef(new Animated.Value(0)).current;
    const circleValue = useRef(new Animated.Value(0)).current;
    const fadeValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Start animations
        const startAnimations = () => {
            // Logo spin animation
            Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ).start();

            // Circle line animation
            Animated.loop(
                Animated.timing(circleValue, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ).start();

            // Fade in animation for text
            Animated.timing(fadeValue, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }).start();
        };

        startAnimations();
    }, []);

    // Create interpolations for animations
    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const circleRotation = circleValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <SafeAreaView className="flex-1 bg-[#f0e6d2]">
            <StatusBar barStyle="dark-content" backgroundColor="#f0e6d2" />
            <StyledView className="flex-1 justify-center items-center px-8">
                <StyledView className="relative">
                    {/* Circular loading line */}
                    <Animated.View
                        style={{
                            transform: [{ rotate: circleRotation }],
                            width: 120,
                            height: 120,
                            borderRadius: 60,
                            borderWidth: 3,
                            borderColor: 'transparent',
                            borderTopColor: '#BC4A4D',
                            borderRightColor: '#DAA520',
                        }}
                    />
                    
                    {/* Spinning Campus Eats logo */}
                    <Animated.View
                        style={{
                            transform: [{ rotate: spin }],
                            position: 'absolute',
                            top: 20,
                            left: 20,
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: 'white',
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2,
                            },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 5,
                        }}
                    >
                        <StyledImage
                            source={require('../assets/images/logo.png')}
                            style={{ width: 50, height: 50 }}
                            resizeMode="contain"
                        />
                    </Animated.View>
                </StyledView>
                
                {showMessage && (
                    <Animated.View style={{ opacity: fadeValue }}>
                        <StyledText className="text-lg font-bold text-[#BC4A4D] mt-6 mb-2">
                            Campus Eats
                        </StyledText>
                        <StyledText className="text-base text-center text-[#8B4513]/70">
                            {message}
                        </StyledText>
                    </Animated.View>
                )}

                {/* Brand Colors Accent */}
                <StyledView className="absolute bottom-16 flex-row items-center">
                    <StyledView className="w-3 h-3 bg-[#BC4A4D] rounded-full mr-2" />
                    <StyledView className="w-3 h-3 bg-[#DAA520] rounded-full mr-2" />
                    <StyledView className="w-3 h-3 bg-[#8B4513] rounded-full" />
                </StyledView>
            </StyledView>
        </SafeAreaView>
    );
};

export default SplashScreen;