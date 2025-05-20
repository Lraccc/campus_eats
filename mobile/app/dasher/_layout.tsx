import { Stack } from 'expo-router';

export default function DasherLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="incoming-orders" options={{ headerShown: false }} />
      {/* Add other dasher routes here as needed */}
    </Stack>
  );
} 