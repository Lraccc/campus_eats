import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from '../../components/BottomNavigation';
import axios from 'axios';
import { API_URL, AUTH_TOKEN_KEY } from '../../config';

interface TopDasher {
  name: string;
}

export default function DasherHome() {
  const [userName, setUserName] = useState('Dasher');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [topDashers] = useState<TopDasher[]>([
    { name: 'Clint Montemayor' },
    { name: 'Vanessa Capuras' },
    { name: 'Joe Schwarz' },
    { name: 'Brian Pila' },
    { name: 'Carl Tampus' },
    { name: 'John Gadiano' },
  ]);
  const [isDelivering, setIsDelivering] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    // Set time and date
    const updateDateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      setCurrentTime(`${formattedHours}:${formattedMinutes} ${ampm}`);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const dayName = days[now.getDay()];
      const monthName = months[now.getMonth()];
      const date = now.getDate();
      setCurrentDate(`${dayName}, ${monthName} ${date}`);
    };
    updateDateTime();
    const intervalId = setInterval(updateDateTime, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Get user data and status from AsyncStorage
    const getUserData = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          if (userData.firstname && userData.lastname) {
            setUserName(`${userData.firstname} ${userData.lastname}`);
          }
        }

        const storedStatus = await AsyncStorage.getItem('dasherStatus'); // Get stored status
        if (storedStatus !== null) {
            setIsDelivering(storedStatus === 'active');
        }

        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (token) {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            const id = payload.sub || payload.oid || payload.userId || payload.id;
            setUserId(id);
          }
        }
      } catch (err) {
        console.error('Error getting user data or stored status:', err);
      }
    };
    getUserData();
  }, []); // Run only once on mount to get user ID and data

  useFocusEffect(
    useCallback(() => {
      const fetchDasherStatus = async () => {
        if (!userId) {
          console.log('User ID not available, skipping status fetch on focus.');
          setIsDelivering(false); // Ensure status is false if ID is missing
          return; // Only proceed if userId is available
        }

        try {
          const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
          if (!token) {
              console.log('Auth token not found, cannot fetch status on focus.');
              setIsDelivering(false); // Ensure status is false if token is missing
              return;
          }

          console.log('Fetching dasher data for user ID on focus:', userId); // Updated logging
          // Fetch dasher data instead of just status
          const response = await axios.get(`${API_URL}/api/dashers/${userId}`, {
            headers: { 'Authorization': token }
          });
          
          // Assuming the response structure is similar to the web version
          if (response.data && response.data.status) {
              setIsDelivering(response.data.status === 'active');
              await AsyncStorage.setItem('dasherStatus', response.data.status); // Store fetched status
          } else {
              console.error('Dasher status not found in response:', response.data);
              setIsDelivering(false); // Assume offline if status is missing
              await AsyncStorage.setItem('dasherStatus', 'offline'); // Store offline status
          }

        } catch (err) {
          console.error('Error fetching dasher status on focus:', err);
          setIsDelivering(false); // Assume offline on error
        }
      };

      fetchDasherStatus();

    }, [userId]) // Rerun when userId changes
  );

  const handleStartDelivering = async () => {
     try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token || !userId) return;
      await axios.put(`${API_URL}/api/dashers/update/${userId}/status`, null, {
        headers: { 'Authorization': token },
        params: { status: 'active' }
      });
      setIsDelivering(true);
      router.push('/dasher/incoming-orders');
    } catch (error) {
      console.error('Error starting delivery:', error);
      Alert.alert('Error', 'Failed to start delivering. Please try again.');
    }
  };

  const handleStopDelivering = () => {
    setModalVisible(true);
  };

  const confirmStopDelivering = async () => {
    setModalVisible(false);
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token || !userId) return;
      await axios.put(`${API_URL}/api/dashers/update/${userId}/status`, null, {
        headers: { 'Authorization': token },
        params: { status: 'inactive' }
      });
      setIsDelivering(false);
    } catch (error) {
      console.error('Error stopping delivery:', error);
      Alert.alert('Error', 'Failed to stop delivering. Please try again.');
    }
  };

  const cancelStopDelivering = () => {
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Map View with Status */}
        <View style={styles.mapContainer}>
          <Image
            source={require('../../assets/images/sample.jpg')}
            style={styles.mapImage}
            resizeMode="cover"
          />
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{isDelivering ? 'Active' : 'Offline'}</Text>
          </View>
        </View>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Welcome {userName}!</Text>
          <Text style={styles.timeText}>{currentTime}</Text>
          <Text style={styles.dateText}>{currentDate}</Text>
        </View>
        {/* Top Dasher Section */}
        <View style={styles.topDasherSection}>
          <Text style={styles.sectionTitle}>Top Dasher</Text>
          {topDashers.map((dasher, index) => (
            <Text key={index} style={styles.dasherName}>{dasher.name}</Text>
          ))}
        </View>
        {/* Delivering Button */}
        <TouchableOpacity
          style={isDelivering ? styles.stopButton : styles.startButton}
          onPress={isDelivering ? handleStopDelivering : handleStartDelivering}
        >
          <Text style={styles.startButtonText}>{isDelivering ? 'Stop Delivering' : 'Start Delivering'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Are you sure you want to stop delivering?</Text>
            <View style={styles.modalButtonContainer}>
              <Pressable
                style={[styles.modalButton, styles.buttonConfirm]}
                onPress={confirmStopDelivering}
              >
                <Text style={styles.textStyle}>Yes, Stop</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.buttonCancel]}
                onPress={cancelStopDelivering}
              >
                <Text style={styles.textStyle}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavigation activeTab="Home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    padding: 16,
    paddingBottom: 80,
  },
  mapContainer: {
    width: '100%',
    height: 250,
    position: 'relative',
    backgroundColor: '#fae9e0',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 14,
  },
  welcomeSection: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fae9e0',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  timeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  topDasherSection: {
    padding: 20,
    backgroundColor: '#fae9e0',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  dasherName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#e74c3c',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
   stopButton: {
    backgroundColor: '#3498db',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center"
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  buttonConfirm: {
    backgroundColor: "#BC4A4D",
  },
  buttonCancel: {
    backgroundColor: "#cccccc",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  }
}); 