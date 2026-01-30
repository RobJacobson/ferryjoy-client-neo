import { ScrollView, View } from "react-native";
import { AnimatedWave } from "@/features/Waves";

// ============================================================================
// COLOR PALETTES
// ============================================================================

/**
 * Tailwind CSS blue shades (blue-100 to blue-900) as hex strings.
 */
const BLUE_PALETTE = [
  "#dbeafe", // blue-100
  "#bfdbfe", // blue-200
  "#93c5fd", // blue-300
  "#60a5fa", // blue-400
  "#3b82f6", // blue-500
  "#2563eb", // blue-600
  "#1d4ed8", // blue-700
  "#1e40af", // blue-800
  "#1e3a8a", // blue-900
] as const;

/**
 * Tailwind CSS green shades (green-100 to green-900) as hex strings.
 */
const GREEN_PALETTE = [
  "#dcfce7", // green-100
  "#bbf7d0", // green-200
  "#86efac", // green-300
  "#4ade80", // green-400
  "#22c55e", // green-500
  "#16a34a", // green-600
  "#15803d", // green-700
  "#166534", // green-800
  "#14532d", // green-900
] as const;

export default function ChatScreen() {
  return (
    <ScrollView
      className="flex-1 bg-white"
      horizontal
      contentContainerClassName="h-full"
      showsHorizontalScrollIndicator={false}
    >
      <View
        style={{
          width: 2400,
          marginLeft: -200,
          marginRight: -200,
          bottom: -10,
        }}
      >
        {/* Foreground grass */}
        <View className="absolute inset-0">
          <AnimatedWave
            amplitude={10}
            period={660}
            strokeColor="black"
            strokeWidth={1}
            strokeOpacity={0.5}
            fillColor={GREEN_PALETTE[0]}
            fillOpacity={1}
            glowColor="white"
            glowIntensity={20}
            glowOpacity={1}
            glowStrokeWidth={10}
            height={50}
          />
        </View>
        {/* Wave 1 - absolutely positioned */}
        <View className="absolute inset-0">
          <AnimatedWave
            amplitude={25}
            period={660}
            strokeColor="black"
            strokeWidth={1}
            strokeOpacity={0.5}
            fillColor="blue"
            fillOpacity={1}
            glowColor="white"
            glowIntensity={20}
            glowOpacity={1}
            glowStrokeWidth={10}
            height={50}
          />
        </View>

        {/* Wave 2 - absolutely positioned on top of Wave 1 */}
        <View className="absolute inset-0">
          <AnimatedWave
            amplitude={50}
            period={600}
            strokeColor="black"
            strokeWidth={1}
            strokeOpacity={0.5}
            fillColor="#60a5fa"
            glowColor="white"
            glowIntensity={25}
            glowOpacity={0.5}
            fillOpacity={0.5}
            glowStrokeWidth={10}
            height={30}
          />
        </View>
      </View>
    </ScrollView>
  );
}
