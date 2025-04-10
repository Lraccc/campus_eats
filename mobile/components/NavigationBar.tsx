import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface NavigationBarProps {
  title: string;
  onBack?: () => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ title, onBack }) => {
  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 24,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default NavigationBar; 