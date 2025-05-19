import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../config';
import BottomNavigation from '../../components/BottomNavigation';

interface TopDasher {
  name: string;
}

export default function DasherIncomingOrder() {
  const [userName, setUserName] = useState('Mr. Tampus');
  const [isOnline, setIsOnline] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [topDashers, setTopDashers] = useState<TopDasher[]>([
    { name: 'Clint Montemayor' },
    { name: 'Vanessa Capuras' },
    { name: 'Joe Schwarz' },
    { name: 'Brian Pila' },
    { name: 'Carl Tampus' },
    { name: 'John Gadiano' },
  ]);

  useEffect(() => {
    // Update time and date
    const updateDateTime = () => {
      const now = new Date();

      // Format time (01:00 PM)
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      const timeString = `${formattedHours}:${formattedMinutes} ${ampm}`;

      // Format date (Mon, March 23)
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const dayName = days[now.getDay()];
      const monthName = months[now.getMonth()];
      const date = now.getDate();
      const dateString = `${dayName}, ${monthName} ${date}`;

      setCurrentTime(timeString);
      setCurrentDate(dateString);
    };

    updateDateTime();
    const intervalId = setInterval(updateDateTime, 60000); // Update every minute

    // Fetch user data
    const fetchUserData = async () => {
      try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (token) {
          const response = await axios.get(`${API_URL}/api/dasher/profile`, {
            headers: { 'Authorization': token }
          });
          if (response.data && response.data.name) {
            setUserName(response.data.name);
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };

    fetchUserData();

    return () => clearInterval(intervalId);
  }, []);

  const handleStartDelivering = async () => {
    try {
      setIsOnline(true);
      // Navigate to orders page or update status on backend
      router.push('/dasher/orders' as any);
    } catch (err) {
      console.error('Error starting delivery:', err);
    }
  };

  return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {/* Map View with Status */}
          <View style={styles.mapContainer}>
            <Image
                source={{ uri: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-qX38vpk9uIvY0lnFDc0lHUVLpnMkSI.png' }}
                style={styles.mapImage}
                resizeMode="cover"
            />
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Offline</Text>
            </View>
          </View>

          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome {userName}!</Text>

            {/* Time and Date */}
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

          {/* Start Delivering Button */}
          <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartDelivering}
          >
            <Text style={styles.startButtonText}>Start Delivering</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Using the imported BottomNavigation component */}
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
    flex: 1,
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
    alignItems: 'center', // Center the content horizontally
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center', // Center the text horizontally
  },
  dasherName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    textAlign: 'center', // Center the text horizontally
  },
  startButton: {
    backgroundColor: '#e74c3c',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  }
});