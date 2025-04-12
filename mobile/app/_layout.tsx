import { Stack, Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to landing page on initial load
    router.replace('/landing');
  }, []);

  return (
    <Stack>
      <Stack.Screen
        name="landing"
        options={{
          headerShown: false,
          animation: 'none'
        }}
      />
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          animation: 'none'
        }}
      />
      <Stack.Screen
        name="home"
        options={{
          headerShown: false,
          animation: 'none'
        }}
      />
    </Stack>
  );
} 