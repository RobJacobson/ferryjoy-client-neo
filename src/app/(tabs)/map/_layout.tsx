import { Stack } from "expo-router";

export default function MapLayout() {
  return (
    <Stack
      screenOptions={{
        // Use the Tabs navigator header so Map matches other tabs.
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[slug]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[from]/[dest]"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
