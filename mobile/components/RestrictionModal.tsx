import React from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { styled } from 'nativewind'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledPressable = styled(Pressable)

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
      <StyledView className="flex-1 bg-black/60 justify-center items-center px-6">
        <StyledView className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
          {/* Header Section */}
          <StyledView className="items-center mb-6">
            <StyledView className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4">
              <StyledView className="w-8 h-8 bg-red-500 rounded-full items-center justify-center">
                <StyledText className="text-white font-bold text-lg">!</StyledText>
              </StyledView>
            </StyledView>
            <StyledText className="text-xl font-bold text-gray-800 text-center">Access Restricted</StyledText>
          </StyledView>

          {/* Message Section */}
          <StyledView className="mb-6">
            <StyledText className="text-base text-gray-600 text-center leading-6">{message}</StyledText>
          </StyledView>

          {/* Action Section */}
          {onRetry && (
            <StyledView className="items-center">
              <StyledPressable 
                className="bg-blue-500 py-3 px-8 rounded-xl shadow-lg active:bg-blue-600 active:scale-95 min-w-32" 
                onPress={onRetry}
              >
                <StyledText className="text-white font-semibold text-base text-center">Retry</StyledText>
              </StyledPressable>
            </StyledView>
          )}
        </StyledView>
      </StyledView>
    </Modal>
  )
}