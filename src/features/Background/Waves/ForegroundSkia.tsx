// ============================================================================
// Foreground Skia (grass layer)
// ============================================================================
// Top static grass layer using AnimatedWaveSkia.
// ============================================================================

import type { SkImage } from "@shopify/react-native-skia";
import { View } from "react-native";
import { createColorGenerator } from "@/shared/utils";
import AnimatedWaveSkia from "./AnimatedWaveSkia";

const BASE_COLOR = "#5c5";
export const grassColor = createColorGenerator(BASE_COLOR);

export type ForegroundSkiaProps = {
  /** Skia Image for the paper texture. */
  paperTexture?: SkImage | null;
};

/**
 * ForegroundSkia component that renders the top grass layer using Skia.
 *
 * @param props - Optional paper texture
 */
const ForegroundSkia = ({ paperTexture }: ForegroundSkiaProps) => {
  return (
    <>
      <View
        className="absolute inset-0"
        style={{ zIndex: 100, marginBottom: 0 }}
      >
        <AnimatedWaveSkia
          paperTexture={paperTexture}
          amplitude={5}
          period={400}
          fillColor={grassColor(450)}
          height={12}
          animationDuration={0}
          waveDisplacement={0}
          animationDelay={0}
        />
      </View>
      <View
        className="absolute inset-0"
        style={{ zIndex: 100, marginBottom: -10 }}
      >
        <AnimatedWaveSkia
          paperTexture={paperTexture}
          amplitude={10}
          period={700}
          fillColor={grassColor(400)}
          height={8}
          animationDuration={0}
          waveDisplacement={20}
          animationDelay={0}
        />
      </View>
    </>
  );
};

ForegroundSkia.displayName = "ForegroundSkia";

export default ForegroundSkia;
