import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Image, Alert, FlatList, Modal } from "react-native";
import { router } from "expo-router";
import { useAuthentication } from "../../services/authService";
import axios from "axios";
import { API_URL } from "../../config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from "../../components/BottomNavigation";
import DasherCashoutModal from "./components/DasherCashoutModal";
import { Ionicons } from '@expo/vector-icons';

export const unstable_settings = { headerShown: false };

interface CashoutRequest {
    id: string;
    userId: string;
    gcashName: string;
    gcashNumber: string;
    amount: number;
    gcashQr: string;
    status: string;
    createdAt: string;
}

interface DasherData {
    id: string;
    wallet: number;
    gcashName: string;
    gcashNumber: string;
}

interface ShopData {
    id: string;
    wallet: number;
    gcashName: string;
    gcashNumber: string;
}

const DasherCashOut = () => {
    const { authState } = useAuthentication();
    const [cashout, setCashout] = useState<CashoutRequest | null>(null);
    const [cashoutHistory, setCashoutHistory] = useState<CashoutRequest[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [wallet, setWallet] = useState(0);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editData, setEditData] = useState<CashoutRequest | null>(null);
    const [dasherData, setDasherData] = useState<DasherData | null>(null);
    const [shopData, setShopData] = useState<ShopData | null>(null);
    const [accountType, setAccountType] = useState('dasher');
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const loadUserId = async () => {
            try {
                const storedUserId = await AsyncStorage.getItem('userId');
                if (storedUserId) {
                    setUserId(storedUserId);
                    const userDataString = await AsyncStorage.getItem('userData');
                    if (userDataString) {
                        const userData = JSON.parse(userDataString);
                        setCurrentUser(userData);
                    }
                    await fetchDasherData(storedUserId);
                    await fetchCashoutData(storedUserId);
                }
            } catch (error) {
                console.error('Error loading user data:', error);
                Alert.alert('Error', 'Failed to load user data. Please try again.');
            }
        };
        loadUserId();
    }, []);

    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: true,
    });

    const handleImageClick = (imageSrc: string) => {
        setSelectedImage(imageSrc);
        setImageModalOpen(true);
    };

    const closeModal = () => {
        setImageModalOpen(false);
        setSelectedImage(null);
        setIsModalOpen(false);
        setEditData(null);
        if (userId) {
            fetchCashoutData(userId);
        }
    };

    const handleEditClick = (cashoutData: CashoutRequest) => {
        setEditData(cashoutData);
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (id: string) => {
        Alert.alert(
            "Confirm Delete",
            "Are you sure you want to delete this cashout request?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const response = await axios.delete(`${API_URL}/api/cashouts/delete/${id}`);

                            if (response.status === 200) {
                                setCashout(null);
                                Alert.alert('Success', 'Cashout request deleted successfully.');
                                if (userId) {
                                    fetchCashoutData(userId);
                                }
                            } else {
                                throw new Error('Failed to delete cashout request');
                            }
                        } catch (error: any) {
                            console.error("Error deleting cashout request:", error);
                            Alert.alert('Error', `Failed to delete cashout request: ${error.message}`);
                        }
                    },
                },
            ]
        );
    };

    const fetchCashoutData = async (userId: string) => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/api/cashouts/${userId}`);
            const cashoutData: CashoutRequest | null = response.data;
            if (cashoutData && cashoutData.status !== 'paid' && cashoutData.status !== 'declined') {
                setCashout(cashoutData);
            } else {
                setCashout(null);
            }

            try {
                const historyResponse = await axios.get(`${API_URL}/api/cashouts/pending-lists`);
                if (historyResponse.data) {
                    const pendingCashouts = historyResponse.data.pendingCashouts || [];
                    const nonPendingCashouts = historyResponse.data.nonPendingCashouts || [];

                    const userCashouts = [...pendingCashouts, ...nonPendingCashouts].filter(
                        (cashout: CashoutRequest) => cashout.userId === userId
                    );

                    setCashoutHistory(userCashouts);
                }
            } catch (error) {
                console.log("No cashout history found");
                setCashoutHistory([]);
            }
        } catch (error: any) {
            console.error("Error fetching cashout data:", error);
            if (error.response?.status !== 404) {
                Alert.alert("Error", "Failed to fetch cashout data.");
            }
            setCashout(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchDasherData = async (userId: string) => {
        try {
            const response = await axios.get(`${API_URL}/api/dashers/${userId}`);
            const dasherData: DasherData = response.data;
            setDasherData(dasherData);
            setWallet(dasherData.wallet || 0);
            return dasherData;
        } catch (error) {
            console.error("Error fetching dasher data:", error);
            Alert.alert('Error', 'Failed to fetch your dasher profile. Please try again.');
            return null;
        }
    };

    const fetchShopData = async (userId: string) => {
        try {
            const response = await axios.get(`${API_URL}/api/shops/${userId}`);
            setShopData(response.data);
        } catch (error: any) {
            console.error("Error fetching shop data:", error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const options: Intl.DateTimeFormatOptions = { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
        return new Intl.DateTimeFormat('en-US', options).format(date);
    };

    const openModal = () => {
        if (dasherData) {
            setIsEditMode(false);
            setEditData(null);
            setIsModalOpen(true);
        } else {
            Alert.alert('Error', 'Unable to load your profile data. Please try again.');
        }
    };

    const currentWallet = accountType === 'dasher' ? dasherData?.wallet : 0;
    const currentGCASHName = accountType === 'dasher' ? dasherData?.gcashName : '';
    const currentGCASHNumber = accountType === 'dasher' ? dasherData?.gcashNumber : '';

    const renderCashoutHistoryItem = ({ item }: { item: CashoutRequest }) => (
        <View style={styles.historyRow}>
            <View style={[styles.historyCell, { flex: 2 }]}>
                <Text style={styles.historyCellText}>{formatDate(item.createdAt)}</Text>
            </View>
            <View style={styles.historyCell}>
                <Text style={styles.historyCellText}>₱{item.amount.toFixed(2)}</Text>
            </View>
            <View style={styles.historyCell}>
                <Text style={[
                    styles.historyCellText,
                    styles.statusText,
                    item.status === 'paid' ? styles.paidStatus :
                        item.status === 'declined' ? styles.declinedStatus :
                            styles.pendingStatus
                ]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
            </View>
            <View style={styles.historyCell}>
                <Text style={styles.historyCellText}>{item.gcashNumber}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                <View style={styles.card}>
                    <View style={styles.sectionTitleContainer}>
                        <Text style={styles.sectionTitle}>Cashout</Text>
                        <Text style={styles.subtitle}>Request a cashout from your wallet</Text>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#BC4A4D" style={styles.loadingIndicator} />
                    ) : (
                        <>
                            {cashout ? (
                                <View style={styles.cashoutDetailsContainer}>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Status:</Text>
                                        <Text style={[styles.detailValue, styles.statusText,
                                            cashout.status === 'paid' ? styles.paidStatus :
                                                cashout.status === 'declined' ? styles.declinedStatus :
                                                    styles.pendingStatus]}>
                                            {cashout.status.charAt(0).toUpperCase() + cashout.status.slice(1)}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Amount:</Text>
                                        <Text style={styles.detailValue}>₱{cashout.amount.toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Date Requested:</Text>
                                        <Text style={styles.detailValue}>{formatDate(cashout.createdAt)}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>GCASH QR:</Text>
                                        <TouchableOpacity onPress={() => handleImageClick(cashout.gcashQr)}>
                                            <Text style={styles.linkText}>View Image</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.editButton]}
                                            onPress={() => handleEditClick(cashout)}
                                        >
                                            <Ionicons name="pencil" size={16} color="#fff" />
                                            <Text style={styles.actionButtonText}> Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.deleteButton]}
                                            onPress={() => handleDeleteClick(cashout.id)}
                                        >
                                            <Ionicons name="trash" size={16} color="#fff" />
                                            <Text style={styles.actionButtonText}> Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.noRequestContainer}>
                                    <Text style={styles.noRequestText}>You don't have any pending cashout request.</Text>
                                    <Text style={styles.currentWalletText}>Current Wallet: ₱{wallet.toFixed(2)}</Text>
                                    <TouchableOpacity style={styles.requestButton} onPress={openModal}>
                                        <Text style={styles.requestButtonText}>Request Cashout</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}

                    {/* Cashout History Section */}
                    <View style={styles.historyCard}>
                        <View style={styles.sectionTitleContainer}>
                            <Text style={styles.sectionTitle}>Cashout History</Text>
                        </View>

                        {cashoutHistory && cashoutHistory.length > 0 ? (
                            <View style={styles.historyTable}>
                                {/* Table Header */}
                                <View style={styles.historyHeader}>
                                    <View style={[styles.historyCell, { flex: 2 }]}>
                                        <Text style={styles.historyHeaderText}>Date</Text>
                                    </View>
                                    <View style={styles.historyCell}>
                                        <Text style={styles.historyHeaderText}>Amount</Text>
                                    </View>
                                    <View style={styles.historyCell}>
                                        <Text style={styles.historyHeaderText}>Status</Text>
                                    </View>
                                    <View style={styles.historyCell}>
                                        <Text style={styles.historyHeaderText}>GCASH</Text>
                                    </View>
                                </View>
                                {/* Table Body */}
                                <FlatList
                                    data={cashoutHistory}
                                    renderItem={renderCashoutHistoryItem}
                                    keyExtractor={(item) => item.id}
                                    scrollEnabled={false}
                                    style={styles.historyList}
                                />
                            </View>
                        ) : (
                            <Text style={styles.noHistoryText}>No cashout history available</Text>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Image Preview Modal */}
            <Modal
                visible={imageModalOpen}
                transparent={true}
                onRequestClose={() => setImageModalOpen(false)}
            >
                <View style={styles.imageModalContainer}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setImageModalOpen(false)}
                    >
                        <Ionicons name="close-circle" size={32} color="#fff" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image
                            source={{ uri: selectedImage }}
                            style={styles.fullImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>

            {/* Cashout Modal */}
            {isModalOpen && (
                <DasherCashoutModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        if (userId) fetchCashoutData(userId);
                    }}
                    accountType={accountType}
                    dasherData={dasherData}
                    shopData={null}
                    isEditMode={isEditMode}
                    editData={editData}
                    currentUser={currentUser}
                    wallet={wallet}
                    gcashName={dasherData?.gcashName || ''}
                    gcashNumber={dasherData?.gcashNumber || ''}
                />
            )}

            <BottomNavigation activeTab="Profile" />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    imageThumbnail: {
        width: 50,
        height: 50,
        borderRadius: 4,
    },
    container: {
        flex: 1,
        backgroundColor: '#DFD6C5',
    },
    scrollView: {
        flex: 1,
        padding: 16,
    },
    card: {
        backgroundColor: '#FFFAF1',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    historyCard: {
        marginTop: 20,
    },
    sectionTitleContainer: {
        marginBottom: 15,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#333',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 5,
    },
    loadingIndicator: {
        marginTop: 50,
    },
    cashoutDetailsContainer: {
        marginTop: 10,
        padding: 10,
        // Removed border and border radius to integrate with card
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    detailLabel: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#555',
    },
    detailValue: {
        fontSize: 16,
    },
    linkText: {
        fontSize: 16,
        color: '#BC4A4D',
        textDecorationLine: 'underline',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 15,
    },
    actionButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
    },
    editButton: {
        backgroundColor: '#007BFF',
    },
    deleteButton: {
        backgroundColor: '#DC3545',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    noRequestContainer: {
        marginTop: 20,
        alignItems: 'center',
    },
    noRequestText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 10,
    },
    currentWalletText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    requestButton: {
        backgroundColor: '#28A745',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    requestButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    historyTable: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        overflow: 'hidden',
    },
    historyHeader: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    historyHeaderText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    historyRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        backgroundColor: '#fff',
    },
    historyCell: {
        flex: 1,
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    historyCellText: {
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
    },
    historyList: {
        maxHeight: 400, // Limit the height of the history list
    },
    statusText: {
        fontWeight: 'bold',
    },
    paidStatus: {
        color: '#28a745',
    },
    declinedStatus: {
        color: '#dc3545',
    },
    pendingStatus: {
        color: '#ffc107',
    },
    noHistoryText: {
        textAlign: 'center',
        color: '#666',
        fontSize: 16,
        marginTop: 20,
    },
    imageModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: '90%',
        height: '80%',
        borderRadius: 8,
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 1,
    },
});

export default DasherCashOut;