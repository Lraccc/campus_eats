import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, StatusBar } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import LiveStreamBroadcaster from '../../components/LiveStreamBroadcaster';
import BottomNavigation from '../../components/BottomNavigation';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LiveStreamScreen() {
  const params = useLocalSearchParams();
  const [shopId, setShopId] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');

  useEffect(() => {
    loadShopData();
  }, []);

  const loadShopData = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setShopId(userId);
      }
      
      // Get shop name from params or storage
      if (params.shopName && typeof params.shopName === 'string') {
        setShopName(params.shopName);
      }
    } catch (error) {
      console.error('Error loading shop data:', error);
    }
  };

  const handleEndStream = () => {
    // Navigate back to incoming orders
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={{ flex: 1 }}>
        {shopId ? (
          <LiveStreamBroadcaster 
            shopId={shopId} 
            onEndStream={handleEndStream}
            shopName={shopName || 'Shop'}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>Loading...</Text>
          </View>
        )}
      </View>
      <BottomNavigation activeTab="Home" />
    </SafeAreaView>
  );
}
