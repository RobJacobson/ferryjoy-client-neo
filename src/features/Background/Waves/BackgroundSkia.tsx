// ============================================================================
// Background Skia (grass layer)
// ============================================================================
// Bottom static grass layer using AnimatedWaveSkia.
// ============================================================================

import type { SkImage } from "@shopify/react-native-skia";
import { View } from "react-native";
import AnimatedWaveSkia from "./AnimatedWaveSkia";
import { grassColor } from "./ForegroundSkia";

export type BackgroundSkiaProps = {
  /** Skia Image for the paper texture. */
  paperTexture?: SkImage | null;
};

/**
 * BackgroundSkia component that renders the bottom grass layer using Skia.
 *
 * @param props - Optional paper texture
 */
const BackgroundSkia = ({ paperTexture }: BackgroundSkiaProps) => {
  return (
    <>
      <View className="absolute inset-0">
        <AnimatedWaveSkia
          paperTexture={paperTexture}
          amplitude={18}
          period={200}
          fillColor={"#DEF"}
          height={49}
          animationDuration={0}
          waveDisplacement={50}
          animationDelay={0}
        />
      </View>
      <View className="absolute inset-0">
        <AnimatedWaveSkia
          paperTexture={paperTexture}
          amplitude={18}
          period={300}
          fillColor={grassColor(600)}
          height={48}
          animationDuration={0}
          waveDisplacement={0}
          animationDelay={0}
        />
      </View>
      <View className="absolute inset-0">
        <AnimatedWaveSkia
          paperTexture={paperTexture}
          amplitude={16}
          period={450}
          fillColor={grassColor(550)}
          height={47}
          animationDuration={0}
          waveDisplacement={200}
          animationDelay={0}
        />
      </View>
      <View className="absolute inset-0">
        <AnimatedWaveSkia
          paperTexture={paperTexture}
          amplitude={12}
          period={450}
          fillColor={grassColor(500)}
          height={46}
          animationDuration={0}
          waveDisplacement={0}
          animationDelay={0}
        />
      </View>
      <View className="absolute inset-0">
        <AnimatedWaveSkia
          paperTexture={paperTexture}
          amplitude={10}
          period={400}
          fillColor={grassColor(450)}
          height={45}
          animationDuration={0}
          waveDisplacement={0}
          animationDelay={0}
        />
      </View>
      <View className="absolute inset-0">
        <AnimatedWaveSkia
          paperTexture={paperTexture}
          amplitude={2}
          period={300}
          fillColor={grassColor(400)}
          height={42}
          animationDuration={0}
          waveDisplacement={50}
          animationDelay={0}
        />
      </View>
    </>
  );
};

BackgroundSkia.displayName = "BackgroundSkia";

export default BackgroundSkia;
