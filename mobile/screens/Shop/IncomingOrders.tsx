import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthentication, clearStoredAuthState } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function IncomingOrders() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { signOut } = useAuthentication();

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // TODO: Implement order refresh logic
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  const handleLogout = async () => {
    try {
      console.log("Performing complete sign-out...");
      
      // Use the signOut method from authentication hook if available
      if (signOut) {
        await signOut();
      }
      
      // Also use the clearStoredAuthState function for additional safety
      await clearStoredAuthState();
      
      // Clear ALL app storage to ensure no user data remains
      await AsyncStorage.clear();
      console.log("⚠️ ALL AsyncStorage data has been cleared!");
      
      // Force navigation to root
      console.log("Sign-out complete, redirecting to login page");
      router.replace('/');
      
      // Add a double check to ensure navigation works
      setTimeout(() => {
        console.log("Double-checking navigation after logout...");
        router.replace('/');
      }, 500);
    } catch (error) {
      console.error("Error during sign-out:", error);
      // Even if there's an error, try to navigate away
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Incoming Orders</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => router.push('/shop/menu' as any)}
          >
            <Text style={styles.menuButtonText}>Menu</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* TODO: Implement order list */}
        <Text style={styles.noOrdersText}>No incoming orders at the moment</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fae9e0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  menuButton: {
    backgroundColor: '#ae4e4e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  menuButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#666',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  noOrdersText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 32,
  },
}); 