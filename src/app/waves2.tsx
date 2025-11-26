/** biome-ignore-all lint/suspicious/noArrayIndexKey: Keys are needed for the Wave component */
import { View } from "react-native";
import { Wave } from "../components/Wave";

const colors = ["add7f6", "87bfff", "3f8efc", "2667ff", "3b28cc"];

export default function WavesScreen2() {
  return (
    <View className="flex-1" style={{ overflow: "visible" }}>
      {colors.map((c, i) => (
        <Wave
          height={80}
          period={2}
          color={"#1e3a5f"}
          offsetY={0 + i * 50}
          phase={0.5 + i * 0.5}
          key={i}
        />
      ))}
      {/* <Wave height={80} period={2} color="#1e3a5f" offsetY={0} />
      <Wave height={80} period={1.8} color="#2b5797" offsetY={40} phase={1.0} />
      <Wave height={80} period={2.2} color="#5fa3d0" offsetY={80} phase={0.6} />
      <Wave height={80} period={2} color="#87ceeb" offsetY={120} phase={0.1} /> */}
    </View>
  );
}
