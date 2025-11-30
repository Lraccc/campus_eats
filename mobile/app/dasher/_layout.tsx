import { Stack } from 'expo-router';

export default function DasherLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="incoming-orders" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="cashout" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="topup" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="reimburse" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="orders" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="application" options={{ headerShown: false, animation: 'none' }} />
    </Stack>
  );
} 