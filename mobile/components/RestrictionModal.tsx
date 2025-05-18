import React from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

interface Props {
  visible: boolean
  message: string
  onRetry?: () => void
}

export default function RestrictionModal({ visible, message, onRetry }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Access Restricted</Text>
          <Text style={styles.message}>{message}</Text>
          {onRetry && (
            <Pressable style={styles.button} onPress={onRetry}>
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center'
  },
  container: {
    width: '80%', padding: 20,
    backgroundColor: 'white', borderRadius: 8
  },
  title: {
    fontSize: 18, fontWeight: 'bold', marginBottom: 10
  },
  message: {
    fontSize: 16, marginBottom: 20
  },
  button: {
    alignSelf: 'center',
    paddingVertical: 10, paddingHorizontal: 20,
    backgroundColor: '#007AFF', borderRadius: 4
  },
  buttonText: {
    color: 'white', fontWeight: '600'
  }
})