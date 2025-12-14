import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function MapLayout() {
  const router = useRouter();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[slug]"
        options={{
          headerShown: true,
          title: "Map",
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/");
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="chevron-back" size={22} color="#007AFF" />
                <Text style={{ color: "#007AFF", fontSize: 17 }}>Home</Text>
              </View>
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
