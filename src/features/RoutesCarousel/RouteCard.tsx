import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Button } from "@/components/ui";

interface Terminal {
  id: string;
  name: string;
}

interface RouteCardProps {
  title: string;
  terminals: Terminal[];
}

export const RouteCard = ({ title, terminals }: RouteCardProps) => {
  const router = useRouter();

  const handleTerminalPress = (terminalId: string) => {
    // Navigate to map with terminal selected (implementation detail to be decided)
    // For now just navigate to map
    router.push("/(tabs)/map" as any);
  };

  const handleAllTerminalsPress = () => {
    router.push("/(tabs)/map" as any);
  };

  return (
    <View className="overflow-hidden h-full bg-white rounded-3xl border border-gray-100 shadow-sm">
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          flexGrow: 1,
          justifyContent: "space-between",
        }}
      >
        <View>
          <View className="justify-center items-center mb-6 h-40 bg-gray-200 rounded-xl">
            <Text className="text-gray-400">Photo Placeholder</Text>
          </View>
          <Text className="mb-6 text-2xl font-bold leading-tight text-center text-slate-900">
            {title}
          </Text>
        </View>

        <View className="gap-3 pb-4">
          {terminals.map((terminal) => (
            <Button
              key={terminal.id}
              variant="secondary"
              onPress={() => handleTerminalPress(terminal.id)}
              className="w-full"
            >
              <Text>{terminal.name}</Text>
            </Button>
          ))}
          <Button onPress={handleAllTerminalsPress} className="mt-2 w-full">
            <Text>All Terminals</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};
