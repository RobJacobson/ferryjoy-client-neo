import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { HeaderBackCircleButton } from "@/components/navigation/HeaderBackCircleButton";
import { TerminalSelectionHeader } from "@/components/navigation/TerminalSelectionHeader";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#007AFF",
        headerShown: true,
        headerTitleAlign: "center",
        headerTitle: () => <TerminalSelectionHeader />,
        headerLeft: () => <HeaderBackCircleButton />,
        headerTitleContainerStyle: { paddingBottom: 2 },
        headerLeftContainerStyle: { paddingBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="terminals"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vessels"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="boat-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedules"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
