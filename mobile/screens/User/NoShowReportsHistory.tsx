import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken, AUTH_TOKEN_KEY } from '../../services/authService';
import axios from 'axios';
import { API_URL } from '../../config';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledSafeAreaView = styled(SafeAreaView);

interface NoShowReport {
    id: string;
    totalPrice: number;
    createdAt: string;
    status: string;
    customerNoShowProofImage?: string;
    customerNoShowGcashQr?: string;
}

const NoShowReportsHistory = () => {
    const [reports, setReports] = useState<NoShowReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchNoShowReports();
    }, []);

    const fetchNoShowReports = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const userId = await AsyncStorage.getItem('userId');
            let token = await getAuthToken();
            if (!token) {
                token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            }
            
            if (!userId || !token) {
                setError('Authentication required');
                return;
            }

            const response = await axios.get(`${API_URL}/api/orders/user/${userId}`, {
                headers: { Authorization: token }
            });

            const allOrders = [...(response.data.orders || []), ...(response.data.activeOrders || [])];
            const dasherNoShowOrders = allOrders.filter((order: any) => order.status === 'dasher-no-show');
            
            // Sort by date descending (newest first)
            dasherNoShowOrders.sort((a: any, b: any) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            
            setReports(dasherNoShowOrders);
        } catch (err: any) {
            console.error('Error fetching no-show reports:', err);
            setError(err.response?.data?.message || 'Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    return (
        <StyledSafeAreaView className="flex-1" style={{ backgroundColor: '#DFD6C5' }}>
            {/* Header */}
            <StyledView 
                className="px-6 pt-4 pb-6"
                style={{
                    backgroundColor: 'white',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                }}
            >
                <StyledView className="flex-row items-center mb-2">
                    <StyledTouchableOpacity 
                        onPress={() => router.back()}
                        className="mr-3"
                    >
                        <Ionicons name="arrow-back" size={24} color="#BC4A4D" />
                    </StyledTouchableOpacity>
                    <StyledText className="text-xl font-bold text-[#8B4513] flex-1">
                        No-Show Reports
                    </StyledText>
                </StyledView>
                <StyledText className="text-sm text-[#8B4513]/70 ml-9">
                    Track your submitted dasher no-show reports
                </StyledText>
            </StyledView>

            {loading ? (
                <StyledView className="flex-1 justify-center items-center py-20">
                    <ActivityIndicator size="large" color="#ea580c" />
                    <StyledText className="text-sm text-[#8B4513]/70 mt-4">Loading reports...</StyledText>
                </StyledView>
            ) : error ? (
                <StyledView className="flex-1 justify-center items-center px-6">
                    <StyledView 
                        className="w-16 h-16 rounded-full justify-center items-center mb-4"
                        style={{ backgroundColor: '#FEE2E2' }}
                    >
                        <Ionicons name="alert-circle" size={32} color="#EF4444" />
                    </StyledView>
                    <StyledText className="text-base font-semibold text-[#8B4513] mb-2">Error Loading Reports</StyledText>
                    <StyledText className="text-sm text-[#8B4513]/70 text-center mb-4">{error}</StyledText>
                    <StyledTouchableOpacity
                        className="px-6 py-3 rounded-xl"
                        style={{ backgroundColor: '#BC4A4D' }}
                        onPress={fetchNoShowReports}
                    >
                        <StyledText className="text-white font-semibold">Try Again</StyledText>
                    </StyledTouchableOpacity>
                </StyledView>
            ) : reports.length === 0 ? (
                <StyledView className="flex-1 justify-center items-center px-6">
                    <StyledView 
                        className="w-20 h-20 rounded-full justify-center items-center mb-4"
                        style={{ backgroundColor: '#FFF7ED' }}
                    >
                        <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                    </StyledView>
                    <StyledText className="text-lg font-bold text-[#8B4513] mb-2">No Reports Found</StyledText>
                    <StyledText className="text-sm text-[#8B4513]/70 text-center mb-6">
                        You haven't submitted any dasher no-show reports yet
                    </StyledText>
                    <StyledTouchableOpacity
                        className="px-6 py-3 rounded-xl flex-row items-center"
                        style={{ backgroundColor: '#BC4A4D' }}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={18} color="white" />
                        <StyledText className="text-white font-semibold ml-2">Go Back</StyledText>
                    </StyledTouchableOpacity>
                </StyledView>
            ) : (
                <StyledScrollView 
                    className="flex-1"
                    contentContainerStyle={{ padding: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Summary Card */}
                    <StyledView 
                        className="mb-4 rounded-xl p-5"
                        style={{
                            backgroundColor: '#FFF7ED',
                            borderWidth: 1,
                            borderColor: '#FFEDD5',
                        }}
                    >
                        <StyledView className="flex-row items-center justify-between">
                            <StyledView>
                                <StyledText className="text-2xl font-bold text-orange-700 mb-1">
                                    {reports.length}
                                </StyledText>
                                <StyledText className="text-sm text-[#8B4513]/70">
                                    Total {reports.length === 1 ? 'Report' : 'Reports'} Submitted
                                </StyledText>
                            </StyledView>
                            <StyledView 
                                className="w-12 h-12 rounded-full justify-center items-center"
                                style={{ backgroundColor: '#ea580c' }}
                            >
                                <Ionicons name="warning" size={24} color="white" />
                            </StyledView>
                        </StyledView>
                    </StyledView>

                    {/* Reports List */}
                    {reports.map((report, index) => (
                        <StyledView 
                            key={report.id}
                            className="mb-3 rounded-xl overflow-hidden"
                            style={{
                                backgroundColor: 'white',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.05,
                                shadowRadius: 4,
                                elevation: 2,
                            }}
                        >
                            {/* Report Header */}
                            <StyledView 
                                className="p-4"
                                style={{
                                    backgroundColor: '#FFF7ED',
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#FFEDD5',
                                }}
                            >
                                <StyledView className="flex-row items-center justify-between mb-2">
                                    <StyledView className="flex-row items-center">
                                        <StyledView 
                                            className="w-8 h-8 rounded-full justify-center items-center mr-2"
                                            style={{ backgroundColor: '#ea580c' }}
                                        >
                                            <StyledText className="text-white font-bold text-xs">
                                                {index + 1}
                                            </StyledText>
                                        </StyledView>
                                        <StyledView>
                                            <StyledText className="text-sm font-bold text-[#8B4513]">
                                                Order #{report.id}
                                            </StyledText>
                                            <StyledText className="text-xs text-[#8B4513]/70">
                                                {new Date(report.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </StyledText>
                                        </StyledView>
                                    </StyledView>
                                    <StyledView 
                                        className="px-3 py-1 rounded-full"
                                        style={{ backgroundColor: '#FEF3C7' }}
                                    >
                                        <StyledText className="text-xs font-semibold text-orange-700">
                                            Under Review
                                        </StyledText>
                                    </StyledView>
                                </StyledView>
                            </StyledView>

                            {/* Report Details */}
                            <StyledView className="p-4">
                                <StyledView className="flex-row items-center justify-between mb-3">
                                    <StyledView className="flex-row items-center">
                                        <Ionicons name="cash-outline" size={18} color="#10B981" />
                                        <StyledText className="text-sm text-[#8B4513]/70 ml-2">Order Amount</StyledText>
                                    </StyledView>
                                    <StyledText className="text-base font-bold text-[#8B4513]">
                                        ₱{report.totalPrice.toFixed(2)}
                                    </StyledText>
                                </StyledView>

                                <StyledView className="flex-row items-center justify-between mb-3">
                                    <StyledView className="flex-row items-center">
                                        <Ionicons name="time-outline" size={18} color="#BC4A4D" />
                                        <StyledText className="text-sm text-[#8B4513]/70 ml-2">Submitted</StyledText>
                                    </StyledView>
                                    <StyledText className="text-sm text-[#8B4513]">
                                        {new Date(report.createdAt).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </StyledText>
                                </StyledView>

                                {/* Proof Status */}
                                <StyledView 
                                    className="mt-2 p-3 rounded-lg"
                                    style={{ backgroundColor: '#F0FDF4' }}
                                >
                                    <StyledView className="flex-row items-center justify-between mb-2">
                                        <StyledView className="flex-row items-center">
                                            <Ionicons name="camera" size={16} color="#10B981" />
                                            <StyledText className="text-xs font-semibold text-[#8B4513] ml-2">
                                                Evidence Submitted
                                            </StyledText>
                                        </StyledView>
                                    </StyledView>
                                    <StyledView className="flex-row items-center">
                                        {report.customerNoShowProofImage && (
                                            <StyledView className="flex-row items-center mr-3">
                                                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                                <StyledText className="text-xs text-[#10B981] ml-1">Proof Image</StyledText>
                                            </StyledView>
                                        )}
                                        {report.customerNoShowGcashQr && (
                                            <StyledView className="flex-row items-center">
                                                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                                <StyledText className="text-xs text-[#10B981] ml-1">GCash QR</StyledText>
                                            </StyledView>
                                        )}
                                    </StyledView>
                                </StyledView>
                            </StyledView>
                        </StyledView>
                    ))}

                    {/* Info Footer */}
                    <StyledView 
                        className="mt-4 p-4 rounded-xl"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.6)' }}
                    >
                        <StyledView className="flex-row items-start">
                            <Ionicons name="information-circle" size={20} color="#BC4A4D" style={{ marginTop: 2 }} />
                            <StyledView className="flex-1 ml-3">
                                <StyledText className="text-xs text-[#8B4513] leading-5">
                                    Our team is reviewing your reports. Refunds will be processed to your GCash account within 3-5 business days after verification.
                                </StyledText>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </StyledScrollView>
            )}
        </StyledSafeAreaView>
    );
};

export default NoShowReportsHistory;
