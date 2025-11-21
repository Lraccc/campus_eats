import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, StatusBar, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import LiveStreamViewer from '../../components/LiveStreamViewer';

export default function ViewLiveStreamScreen() {
  const params = useLocalSearchParams();
  const shopId = params.shopId as string;
  const shopName = params.shopName as string;

  const handleCloseLiveStream = () => {
    // Navigate back to shop details
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={{ flex: 1 }}>
        {shopId && (
          <LiveStreamViewer 
            shopId={shopId} 
            onClose={handleCloseLiveStream}
            shopName={shopName || 'Shop'}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
