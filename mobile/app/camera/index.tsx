import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { Stack } from 'expo-router';
import CameraView from '../../components/CameraView';
import BottomNavigation from '../../components/BottomNavigation';

export default function CameraScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Camera Monitoring',
          headerStyle: {
            backgroundColor: '#FFFAF1',
          },
          headerTintColor: '#BC4A4D',
          headerShadowVisible: false,
        }}
      />
      
      <View style={styles.content}>
        <CameraView showControls={true} showSettings={true} />
      </View>
      
      <BottomNavigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFAF1',
  },
  content: {
    flex: 1,
  },
});
