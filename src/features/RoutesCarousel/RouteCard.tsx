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
    <View className="bg-white rounded-3xl h-full shadow-sm border border-gray-100 overflow-hidden">
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          flexGrow: 1,
          justifyContent: "space-between",
        }}
      >
        <View>
          <View className="h-40 bg-gray-200 rounded-xl mb-6 items-center justify-center">
            <Text className="text-gray-400">Photo Placeholder</Text>
          </View>
          <Text className="text-2xl font-bold text-slate-900 mb-6 text-center leading-tight">
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
          <Button onPress={handleAllTerminalsPress} className="w-full mt-2">
            <Text>All Terminals</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};
