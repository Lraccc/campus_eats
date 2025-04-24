import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

interface RestrictionModalProps {
  visible: boolean;
  message: string;
}

export default function RestrictionModal({ visible, message }: RestrictionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}} // Disable back button/gesture
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Access Restricted</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#b33a3a',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
});