import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Dimensions,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';

const { width, height } = Dimensions.get('window');

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

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#f0e6d2" />

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoTextRed}>Campus</Text>
                        <Text style={styles.logoTextYellow}>Eats</Text>
                    </View>
                    <Text style={styles.subTitle}>Cebu Institute of Technology - University</Text>
                </View>

                {/* Main Content */}
                <View style={styles.contentContainer}>
                    <View style={styles.textContainer}>
                        <Text style={styles.mainHeading}>
                            Enjoy your favorite food,
                        </Text>
                        <View style={styles.headingRow}>
                            <Text style={styles.mainHeading}>delivered </Text>
                            <View style={styles.yellowCircle} />
                            <Text style={styles.mainHeading}> straight</Text>
                        </View>
                        <Text style={styles.mainHeading}>to you</Text>
                    </View>

                    <View style={styles.illustrationContainer}>
                        <View style={styles.duckIllustrationPlaceholder}>
                            <View style={styles.packageBox} />
                            <View style={styles.umbrellaShape} />
                            <View style={styles.duckBody} />
                            <View style={styles.duckHead} />
                            <View style={styles.duckBeak} />
                        </View>
                    </View>
                </View>

                {/* Background Elements */}
                <View style={[styles.circleDecoration, { top: height * 0.7, left: width * 0.2 }]} />
                <View style={[styles.circleDecoration, { top: height * 0.8, right: width * 0.1 }]} />
                <View style={[styles.yellowCircleSmall, { top: height * 0.5, right: width * 0.15 }]} />

                {/* Cloud Elements */}
                <View style={[styles.cloudShape, { top: height * 0.2, right: width * 0.1 }]} />
                <View style={[styles.cloudShape, { top: height * 0.35, right: width * 0.3 }]} />
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0e6d2',
        position: 'relative',
        overflow: 'hidden',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    logoContainer: {
        flexDirection: 'row',
    },
    logoTextRed: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#b33a3a',
    },
    logoTextYellow: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffc107',
    },
    subTitle: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
        paddingTop: 40,
    },
    textContainer: {
        width: '100%',
        maxWidth: 400,
        zIndex: 2,
    },
    mainHeading: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#b33a3a',
        lineHeight: 42,
    },
    headingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    yellowCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ffc107',
    },
    illustrationContainer: {
        position: 'absolute',
        right: 0,
        bottom: 20,
        width: width * 0.6,
        height: height * 0.4,
        zIndex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    duckIllustrationPlaceholder: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    packageBox: {
        position: 'absolute',
        bottom: 50,
        right: 70,
        width: 80,
        height: 80,
        backgroundColor: '#ff9f43',
        borderRadius: 10,
        transform: [{ rotate: '15deg' }],
        borderWidth: 2,
        borderColor: '#e17055',
    },
    umbrellaShape: {
        position: 'absolute',
        top: 20,
        right: 50,
        width: 120,
        height: 60,
        borderTopLeftRadius: 60,
        borderTopRightRadius: 60,
        backgroundColor: '#fdcb6e',
        transform: [{ scaleX: 1.5 }],
    },
    duckBody: {
        position: 'absolute',
        bottom: 30,
        right: 40,
        width: 100,
        height: 60,
        backgroundColor: '#ffc107',
        borderRadius: 30,
        transform: [{ rotate: '-15deg' }],
    },
    duckHead: {
        position: 'absolute',
        bottom: 60,
        right: 20,
        width: 40,
        height: 40,
        backgroundColor: '#ffc107',
        borderRadius: 20,
    },
    duckBeak: {
        position: 'absolute',
        bottom: 70,
        right: 0,
        width: 20,
        height: 10,
        backgroundColor: '#ff9f43',
        borderRadius: 5,
        transform: [{ rotate: '15deg' }],
    },
    circleDecoration: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#b33a3a',
        opacity: 0.8,
        zIndex: 0,
    },
    yellowCircleSmall: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#ffc107',
        opacity: 0.8,
        zIndex: 0,
    },
    cloudShape: {
        position: 'absolute',
        width: 100,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'white',
        opacity: 0.7,
        zIndex: 0,
    },
});

export default LandPage;