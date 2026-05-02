import { Stack } from 'expo-router';

export default function BusinessLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="create-announcement" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
