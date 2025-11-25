import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, StatusBar, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LiveStreamBroadcaster from '../../components/LiveStreamBroadcaster';

export default function LiveStreamScreen() {
  const params = useLocalSearchParams();
  const [shopId, setShopId] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');

  useEffect(() => {
    const loadShopData = async () => {
      try {
        // Get from params or AsyncStorage
        const id = (params.shopId as string) || await AsyncStorage.getItem('userId') || '';
        const name = (params.shopName as string) || '';
        
        setShopId(id);
        setShopName(name);
      } catch (error) {
        console.error('Error loading shop data:', error);
      }
    };

    loadShopData();
  }, [params]);

  const handleEndStream = () => {
    // Navigate back to shop home
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={{ flex: 1 }}>
        {shopId && (
          <LiveStreamBroadcaster 
            shopId={shopId} 
            onEndStream={handleEndStream}
            shopName={shopName}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
