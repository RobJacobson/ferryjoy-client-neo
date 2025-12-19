/** biome-ignore-all lint/suspicious/noArrayIndexKey: Keys are needed for the Wave component */
import { View } from "react-native";
import { Text } from "@/components/ui";
import { Wave } from "../components/Wave2";

const colors = [
  "hsla(205, 80%, 82%, 1)",
  "hsla(212, 100%, 76%, 1)",
  "hsla(215, 97%, 62%, 1)",
  "hsla(222, 100%, 57%, 1)",
  "hsla(247, 67%, 48%, 1)",
];

export default function WavesScreen2() {
  return (
    <View className="overflow-hidden flex-1">
      <Text>Hello</Text>
      <Wave
        height={15}
        width={1000}
        period={150}
        color={colors[0]}
        offsetX={0}
        offsetY={100}
        showPaperGrains={true}
        showLine={true}
      />
      <Wave
        height={20}
        width={1000}
        period={200}
        color={colors[1]}
        offsetX={50}
        offsetY={125}
        showPaperGrains={true}
        showLine={true}
      />
      <Wave
        height={30}
        width={1000}
        period={250}
        color={colors[2]}
        offsetX={25}
        offsetY={150}
        showPaperGrains={true}
        showLine={true}
      />
      <Wave
        height={40}
        width={1000}
        period={300}
        color={colors[3]}
        offsetX={100}
        offsetY={175}
        showPaperGrains={true}
        showLine={true}
      />
      <Wave
        height={50}
        width={1000}
        period={350}
        color={colors[4]}
        offsetX={0}
        offsetY={200}
        showPaperGrains={true}
        showLine={true}
      />
    </View>
  );
}
