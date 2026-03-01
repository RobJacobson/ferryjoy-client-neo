// ============================================================================
// WaveLayerView
// ============================================================================
// A single wave layer renderer that:
// - Always renders WaveSvg into a "rail" view sized in pixels
// - Optionally applies horizontal oscillation (ocean) via CSS keyframes
// - Uses left+width overscan so SVG edges never appear in viewport
// ============================================================================

import type { ViewStyle } from "react-native";
import { View } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import {
  useWaveOscillation,
  type WaveOscillationProps,
} from "./useWaveOscillation";
import { WaveSvg, type WaveSvgProps } from "./WaveSvg";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for rendering a wave layer.
 */
export type WaveLayerViewProps = {
  /** Complete wave SVG rendering configuration */
  svgProps: WaveSvgProps;
  /** Optional oscillation configuration (ocean waves only) */
  oscillationProps?: WaveOscillationProps;
};

// ============================================================================
// WaveLayerView
// ============================================================================

/**
 * Renders one wave layer into an overscanned rail and (optionally) oscillates
 * it horizontally. Overscan is done with layout (left + width) to guarantee
 * SVG edges never enter the visible viewport.
 *
 * @param svgProps - Complete wave SVG rendering configuration
 * @param oscillationProps - Optional oscillation configuration (ocean waves only)
 * @returns Wave layer with optional oscillation
 */
export const WaveLayerView = ({
  svgProps,
  oscillationProps,
}: WaveLayerViewProps) => {
  const offsetPx = svgProps.xOffsetPx ?? 0;
  const { animatedOscillationStyle, overscanPx } = useWaveOscillation({
    oscillationProps,
  });

  const railWidthPx = svgProps.renderWidthPx + 2 * overscanPx;

  return (
    <View className="absolute inset-0 overflow-visible">
      <Animated.View
        style={
          [
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              left: -overscanPx + offsetPx,
              width: railWidthPx,
            },
            animatedOscillationStyle,
          ] as (ViewStyle | AnimatedStyle<ViewStyle>)[]
        }
      >
        <WaveSvg {...svgProps} />
      </Animated.View>
    </View>
  );
};
