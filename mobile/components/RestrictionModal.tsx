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
      <StyledView className="flex-1 bg-black/50 justify-center items-center">
        <StyledView className="w-4/5 p-5 bg-white rounded-lg">
          <StyledText className="text-lg font-bold mb-3">Access Restricted</StyledText>
          <StyledText className="text-base mb-5">{message}</StyledText>
          {onRetry && (
            <StyledPressable className="self-center py-2.5 px-5 bg-blue-600 rounded" onPress={onRetry}>
              <StyledText className="text-white font-semibold">Retry</StyledText>
            </StyledPressable>
          )}
        </StyledView>
      </StyledView>
    </Modal>
  )
}