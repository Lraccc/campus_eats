import { Stack } from "expo-router";

export default function RootLayout() {
  // Use Expo Router's Stack navigator
  return <Stack screenOptions={{ headerShown: false }} />;
}
