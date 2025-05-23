import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Image, Alert, FlatList } from "react-native";
import { router } from "expo-router"; // Using expo-router for navigation
import { useAuthentication } from "../../services/authService";
import axios from "axios";
import { API_URL } from "../../config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from "../../components/BottomNavigation";
// import DasherCashoutModal from "./components/DasherCashoutModal"; // Re-add if modal is needed and adapted for RN
// No direct equivalent for Tooltip and CSS import in pure React Native, will use basic styles
// import Tooltip from '@mui/material/Tooltip';
// import "../css/ShopApplication.css";

export const unstable_settings = { headerShown: false };

interface CashoutRequest {
    id: string;
    gcashName: string;
    gcashNumber: string;
    amount: number;
    gcashQr: string; // Assuming this will be a URI in RN
    status: string;
    createdAt: string;
}

interface DasherData {
    id: string;
    wallet: number;
    gcashName: string;
    gcashNumber: string;
    // Add other dasher properties as needed
}

interface ShopData {
     id: string;
     wallet: number;
     gcashName: string; // Assuming shops might also have gcash info for cashout
     gcashNumber: string;
     // Add other shop properties as needed
}

// interface DasherCashoutModalProps { // Update or remove if modal is not used
//     isOpen: boolean;
//     onClose: () => void;
//     accountType: string;
//     dasherData: DasherData | null;
//     shopData: ShopData | null;
//     isEditMode: boolean;
//     editData: CashoutRequest | null;
//     currentUser: any; // Remove this if not used by modal
//     wallet: number;
//     gcashName?: string;
//     gcashNumber?: string;
// }

const DasherCashOut = () => {
  const { authState } = useAuthentication();
  const [cashout, setCashout] = useState<CashoutRequest | null>(null);
  const [cashoutHistory, setCashoutHistory] = useState<CashoutRequest[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false); // This might need a different modal implementation for RN
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [GCASHName, setGCASHName] = useState("");
  const [GCASHNumber, setGCASHNumber] = useState("");
  const [cashoutAmount, setCashoutAmount] = useState(0);
  const [uploadedImage, setUploadedImage] = useState(null); // This will likely be a local URI or base64 string
  const [imageFile, setImageFile] = useState(null); // Not directly applicable in RN file system context, will handle image data differently
  const [wallet, setWallet] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState<CashoutRequest | null>(null);
  const [dasherData, setDasherData] = useState<DasherData | null>(null);
  const [accountType, setAccountType] = useState('');
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUserId = async () => {
      const storedUserId = await AsyncStorage.getItem('userId');
      setUserId(storedUserId);
    };
    loadUserId();
  }, []);

  // React Native AlertModal might be different or use built-in Alert
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    showConfirmButton: true,
  });

  // const navigate = useNavigate(); // Use expo-router's router object

  const handleImageClick = (imageSrc: string) => {
    setSelectedImage(imageSrc);
    // Need a React Native image modal implementation
    // setImageModalOpen(true);
    Alert.alert("GCASH QR Code", "Implement image display logic here.");
  };

  const closeModal = () => {
    setImageModalOpen(false); // Close the modal
    setSelectedImage(null); // Changed from "" to null
    setIsModalOpen(false);
    setEditData(null); // Clear edit data on modal close
    if (userId) {
        fetchCashoutData(userId); // Refresh data after modal closes
    }
  };

  const fetchCashoutData = async (userId: string) => {
    try {
      setLoading(true);
      // Fetch pending cashout
      const response = await axios.get(`${API_URL}/api/cashouts/${userId}`);
      const cashoutData: CashoutRequest | null = response.data;
      if (cashoutData && cashoutData.status !== 'paid' && cashoutData.status !== 'declined') {
        setCashout(cashoutData);
      } else {
        setCashout(null);
      }

      // Fetch cashout history using the pending-lists endpoint
      try {
        const historyResponse = await axios.get(`${API_URL}/api/cashouts/pending-lists`);
        const nonPendingCashouts = historyResponse.data.nonPendingCashouts || [];
        // Filter cashouts for the current user
        const userCashouts = nonPendingCashouts.filter((cashout: CashoutRequest) => cashout.id === userId);
        setCashoutHistory(userCashouts);
      } catch (error) {
        // If there's an error fetching history, just set empty array instead of showing error
        console.log("No cashout history found");
        setCashoutHistory([]);
      }
    } catch (error: any) {
      console.error("Error fetching cashout data:", error);
      // Only show error for pending cashout fetch, not for history
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
      setDasherData(response.data);
    } catch (error: any) {
      console.error("Error fetching dasher data:", error);
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

  const fetchUserAccountType = async (userId: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/users/${userId}/accountType`);
      const type = response.data;
      setAccountType(type);
      console.log("Account type: ", type);

      if (type === 'dasher') {
        fetchDasherData(userId);
      } else if (type === 'shop') {
        fetchShopData(userId);
      } else {
          // Handle other account types or cases where type is not dasher/shop
          setDasherData(null);
          setShopData(null);
      }
    } catch (error: any) {
      console.error('Error fetching user account type:', error);
        setDasherData(null);
        setShopData(null);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchCashoutData(userId);
      fetchUserAccountType(userId);
    }
  }, [userId]);

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
              console.log("Delete response:", response);

              if (response.status !== 200) {
                throw new Error(response.data?.error || "Failed to delete cashout request");
              }

              setCashout(null); // Clear the pending cashout request state

              Alert.alert('Success', 'Cashout request deleted successfully.');
              if (userId) {
                  fetchCashoutData(userId); // Refresh data after modal closes
              }

            } catch (error: any) {
              console.error("Error deleting cashout request:", error);
              Alert.alert('Error', 'There was an error. Please try again. ' + (error.response?.data?.error || error.message));
            }
          },
        },
      ]
    );
  };

  const handleEditClick = (cashoutData: CashoutRequest) => {
    setEditData(cashoutData);
    setIsModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  };

  const openModal = () => {
    setEditData(null); // Clear edit data for new request
    setIsModalOpen(true);
  };

  // Determine wallet and GCASH info based on account type
  const currentWallet = accountType === 'dasher' ? dasherData?.wallet : shopData?.wallet;
  const currentGCASHName = accountType === 'dasher' ? dasherData?.gcashName : shopData?.gcashName;
  const currentGCASHNumber = accountType === 'dasher' ? dasherData?.gcashNumber : shopData?.gcashNumber;

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
      {/* Alert Modal Placeholder (using built-in Alert for simplicity) */}
      {/* You would replace this with a custom modal component if needed */}

      <ScrollView style={styles.scrollView}>
        <View style={styles.card}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>
              {loading ? "Loading..." : (cashout === null ? "You have no pending cashout request" : "You have a pending cashout request")}
            </Text>
          </View>

          {!loading && cashout && (
              <View style={styles.cashoutDetailsContainer}>
                  <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Timestamp:</Text>
                      <Text style={styles.detailValue}>{formatDate(cashout.createdAt)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>GCASH Name:</Text>
                      <Text style={styles.detailValue}>{cashout.gcashName}</Text>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>GCASH Number:</Text>
                      <Text style={styles.detailValue}>{cashout.gcashNumber}</Text>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Amount:</Text>
                      <Text style={styles.detailValue}>₱{cashout.amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>GCASH QR:</Text>
                      <TouchableOpacity onPress={() => handleImageClick(cashout.gcashQr)}>
                          <Text style={styles.linkText}>View QR</Text>
                      </TouchableOpacity>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <Text style={styles.detailValue}>{cashout.status}</Text>
                  </View>
                  {cashout.status === 'pending' && (
                      <View style={styles.actionButtons}>
                          {/* Edit Button */}
                          <TouchableOpacity 
                              style={[styles.actionButton, styles.editButton]}
                              onPress={() => handleEditClick(cashout)}
                          >
                              <Text style={styles.actionButtonText}>Edit</Text>
                          </TouchableOpacity>

                          {/* Delete Button */}
                          <TouchableOpacity 
                              style={[styles.actionButton, styles.deleteButton]}
                              onPress={() => handleDeleteClick(cashout.id)}
                          >
                              <Text style={styles.actionButtonText}>Delete</Text>
                          </TouchableOpacity>
                      </View>
                  )}

              </View>
          )}

          {!loading && cashout === null && (
              <View style={styles.noRequestContainer}>
                   <Text style={styles.noRequestText}>You can request a cashout if your wallet balance is ₱100 or more.</Text>
                   {/* Display current wallet balance */}
                   {currentWallet !== undefined && (
                        <Text style={styles.currentWalletText}>Current Wallet: ₱{currentWallet.toFixed(2)}</Text>
                   )}
                  {/* Add button to open cashout modal if wallet is >= 100 */}
                  {(currentWallet !== undefined && currentWallet >= 100) && (
                      <TouchableOpacity style={styles.requestButton} onPress={openModal}>
                          <Text style={styles.requestButtonText}>Request Cashout</Text>
                      </TouchableOpacity>
                  )}
              </View>
          )}

          {/* Cashout History Section */}
          <View style={[styles.card, styles.historyCard]}>
            <Text style={styles.sectionTitle}>Cashout History</Text>
            {loading ? (
              <ActivityIndicator size="large" color="#BC4A4D" style={styles.loadingIndicator} />
            ) : cashoutHistory.length > 0 ? (
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
      <BottomNavigation activeTab="Profile" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
});

export default DasherCashOut; 