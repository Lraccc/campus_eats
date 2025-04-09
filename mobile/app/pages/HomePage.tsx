import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NavigationBar from '../components/NavigationBar';

const HomePage = () => {
  return (
    <View style={styles.container}>
      <NavigationBar title="Campus Eats" />
      <View style={styles.content}>
        <Text style={styles.welcomeText}>Welcome to Campus Eats</Text>
        <Text style={styles.description}>
          Your one-stop solution for campus food delivery
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
});

export default HomePage; 