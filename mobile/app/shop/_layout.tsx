import { Stack } from 'expo-router';

export default function ShopLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="add-item" />
      <Stack.Screen name="cashout" />
      <Stack.Screen name="incoming-orders" />
      <Stack.Screen name="items" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="order-complete" />
      <Stack.Screen name="update" />
      <Stack.Screen name="edit-item/[id]" />
    </Stack>
  );
}