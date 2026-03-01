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
import type { PaperTextureSource } from "../types";
import { useWaveOscillation } from "./useWaveOscillation";
import { WaveSvg } from "./WaveSvg";

// ============================================================================
// Types
// ============================================================================

/**
 * Static wave visual properties (shape, color, size, position).
 * Used by both grass and ocean waves.
 */
export type WaveStaticProps = {
  /** Wave amplitude in pixels (height from center to peak/trough) */
  amplitude: number;
  /** Wave period in pixels (width of one complete cycle) */
  period: number;
  /** Color of the wave fill */
  fillColor: string;
  /** Vertical position of wave centerline as percentage (0-100) */
  height?: number;
  /** Opacity of the wave fill (0-1) */
  fillOpacity?: number;
  /** Static horizontal offset for the wave rail in pixels */
  xOffsetPx?: number;
  /** Paper texture source (null for no texture) */
  paperTextureUrl?: PaperTextureSource;
};

/**
 * Animation properties for oscillating waves (ocean only).
 * Grass waves use static positioning without animation.
 */
export type WaveAnimationProps = {
  /** Animation duration in milliseconds (enables oscillation if > 0) */
  animationDuration?: number;
  /** Delay before animation starts in milliseconds */
  animationDelay?: number;
  /** Maximum expected horizontal shift magnitude in pixels */
  maxXShiftPx?: number;
  /** Phase offset for the wave oscillation in radians */
  phaseOffset?: number;
};

/**
 * Props for wave content configuration (amplitude, period, fill, etc.).
 * Combines static visual properties with optional animation properties.
 */
export type WaveLayerContentProps = WaveStaticProps & WaveAnimationProps;

/**
 * Layout configuration for a wave layer container.
 * Groups dimension-related properties needed for rendering.
 */
export type WaveLayerLayout = {
  /** Width of the layer container in pixels */
  containerWidthPx: number;
  /** Height of the layer container in pixels */
  containerHeightPx: number;
};

/**
 * Props for rendering a wave layer.
 */
export type WaveLayerViewProps = {
  /** Complete wave content configuration */
  waveProps: WaveLayerContentProps;
  /** Layout dimensions for the wave layer container */
  layout: WaveLayerLayout;
};

// ============================================================================
// WaveLayerView
// ============================================================================

/**
 * Renders one wave layer into an overscanned rail and (optionally) oscillates
 * it horizontally. Overscan is done with layout (left + width) to guarantee
 * SVG edges never enter the visible viewport.
 *
 * @param waveProps - Complete wave content configuration
 * @param layout - Layout dimensions for the wave layer container
 * @returns Wave layer with optional oscillation
 */
export const WaveLayerView = ({ waveProps, layout }: WaveLayerViewProps) => {
  const { containerWidthPx, containerHeightPx } = layout;
  const offsetPx = waveProps.xOffsetPx ?? 0;
  const { animatedOscillationStyle, overscanPx } =
    useWaveOscillation(waveProps);

  const railWidthPx = containerWidthPx + 2 * overscanPx;

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
        <WaveSvg
          amplitude={waveProps.amplitude}
          period={waveProps.period}
          fillColor={waveProps.fillColor}
          fillOpacity={waveProps.fillOpacity}
          height={waveProps.height}
          paperTextureUrl={waveProps.paperTextureUrl}
          renderWidthPx={railWidthPx}
          renderHeightPx={containerHeightPx}
        />
      </Animated.View>
    </View>
  );
};
