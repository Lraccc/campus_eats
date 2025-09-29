import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

export default function AuthCallback() {
  const params = useLocalSearchParams();

  useEffect(() => {
    // This route is hit when the OAuth flow redirects back to the app
    // The actual auth handling is done in the authService hook
    console.log('Auth callback received with params:', params);
    
    // Redirect to landing page where the auth hook will handle the OAuth response
    router.replace('/landing');
  }, [params]);

  return (
    <StyledView className="flex-1 justify-center items-center bg-[#DFD6C5]">
      <ActivityIndicator size="large" color="#BC4A4D" />
      <StyledText className="mt-4 text-[#BC4A4D] text-lg font-semibold">
        Completing sign in...
      </StyledText>
    </StyledView>
  );
}