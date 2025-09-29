import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface NavigationBarProps {
  title: string;
  onBack?: () => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ title, onBack }) => {
  return (
      <StyledView className="h-16 bg-white flex-row items-center px-4 border-b border-gray-300">
        {onBack && (
            <StyledTouchableOpacity className="mr-4" onPress={onBack}>
              <StyledText className="text-2xl text-blue-600">←</StyledText>
            </StyledTouchableOpacity>
        )}
        <StyledText className="text-lg font-bold">{title}</StyledText>
      </StyledView>
  );
};

export default NavigationBar; 