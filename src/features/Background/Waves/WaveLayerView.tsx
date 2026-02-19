// ============================================================================
// WaveLayerView
// ============================================================================
// A single wave layer renderer that:
// - Always renders WaveSvg into a "rail" view sized in pixels
// - Optionally applies horizontal oscillation (ocean) via CSS keyframes
// - Uses left+width overscan so SVG edges never appear in the viewport
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
 * Pixel sizing for a wave layer container.
 */
type WaveLayerContainerSize = {
  /**
   * Width of the layer container in pixels (the parallax-provisioned width).
   */
  containerWidthPx: number;

  /**
   * Height of the layer container in pixels.
   */
  containerHeightPx: number;
};

/**
 * Props for rendering a wave layer.
 */
type WaveLayerContentProps = {
  /**
   * Wave amplitude in pixels (height from center to peak/trough).
   */
  amplitude: number;

  /**
   * Wave period in pixels (width of one complete cycle).
   */
  period: number;

  /**
   * Animation duration in milliseconds.
   * When provided (and maxXShiftPx > 0), oscillation is enabled.
   */
  animationDuration?: number;

  /**
   * Delay before animation starts in milliseconds.
   */
  animationDelay?: number;

  /**
   * Static horizontal offset for the wave rail in pixels.
   * Used to de-sync static layers (e.g., grass) so they don't align perfectly.
   */
  xOffsetPx?: number;

  /**
   * Maximum expected horizontal shift magnitude in pixels.
   * This is used only for rail overscan sizing (to keep SVG edges offscreen).
   * It should be a stable per-group maximum (e.g., ocean oscillation distance,
   * or max |xOffsetPx| across all grass layers), not computed per-layer.
   *
   * When animationDuration is provided, this also becomes the oscillation
   * distance (translateX runs between -maxXShiftPx and +maxXShiftPx).
   */
  maxXShiftPx?: number;

  /**
   * Phase offset for the wave oscillation in radians.
   */
  phaseOffset?: number;

  /**
   * Opacity of the wave fill (0-1).
   */
  fillOpacity?: number;

  /**
   * Color of the wave fill.
   */
  fillColor: string;

  /**
   * Vertical position of the wave centerline as a percentage (0-100).
   * 0 = bottom, 50 = middle, 100 = top.
   */
  height?: number;

  /**
   * Paper texture source. When null, SVG does not render the texture overlay.
   */
  paperTextureUrl?: PaperTextureSource;
};

/**
 * Full props for WaveLayerView, including container sizing.
 */
export type WaveLayerViewProps = WaveLayerContentProps & WaveLayerContainerSize;

// ============================================================================
// Constants
// ============================================================================

const ABSOLUTE_FILL: ViewStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  overflow: "visible",
};

const SEAM_MARGIN_PX = 16;

// ============================================================================
// WaveLayerView
// ============================================================================

/**
 * Renders one wave layer into an overscanned rail and (optionally) oscillates
 * it horizontally. Overscan is done with layout (left + width) to guarantee
 * SVG edges never enter the visible viewport.
 *
 * @param props - Wave rendering params plus container pixel size
 */
export const WaveLayerView = ({
  containerWidthPx,
  containerHeightPx,
  amplitude,
  period,
  animationDuration,
  animationDelay,
  xOffsetPx,
  maxXShiftPx,
  phaseOffset,
  fillOpacity,
  fillColor,
  height,
  paperTextureUrl,
}: WaveLayerViewProps) => {
  const offsetPx = xOffsetPx ?? 0;
  const xShiftPx = Math.max(0, maxXShiftPx ?? 0);
  const shouldOscillate = (animationDuration ?? 0) > 0 && xShiftPx > 0;
  const overscanPx = xShiftPx + SEAM_MARGIN_PX;
  const railWidthPx = containerWidthPx + 2 * overscanPx;

  const { animatedOscillationStyle } = useWaveOscillation({
    animationDuration: shouldOscillate ? animationDuration : undefined,
    animationDelay: animationDelay ?? 0,
    maxXShiftPx: xShiftPx,
    phaseOffset: phaseOffset ?? 0,
  });

  return (
    <View style={ABSOLUTE_FILL}>
      <View style={ABSOLUTE_FILL}>
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
            amplitude={amplitude}
            period={period}
            fillColor={fillColor}
            fillOpacity={fillOpacity}
            height={height}
            paperTextureUrl={paperTextureUrl}
            renderWidthPx={railWidthPx}
            renderHeightPx={containerHeightPx}
          />
        </Animated.View>
      </View>
    </View>
  );
};
