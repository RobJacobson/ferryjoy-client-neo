// ============================================================================
// Animated Wave Component
// ============================================================================
// Generates an animated wave using cubic Bezier curves pattern from CSS reference
// The wave is centered at y=0 and repeated across the SVG bounding box
// ============================================================================

import type React from "react";
import Svg, {
  Defs,
  FeGaussianBlur,
  Filter,
  Mask,
  Path,
  Rect,
} from "react-native-svg";

/**
 * SVG dimensions constants for wave generation.
 */
const SVG_WIDTH = 2000;
const SVG_HEIGHT = 500;

/**
 * Props for the AnimatedWave component.
 */
export interface AnimatedWaveProps {
  /**
   * Wave amplitude in SVG units (height from center to peak/trough)
   */
  amplitude: number;

  /**
   * Wave period in SVG units (width of one complete cycle)
   */
  period: number;

  /**
   * Horizontal phase offset in SVG units (for animation)
   */
  phaseOffset?: number;

  /**
   * Opacity of the wave fill (0-1)
   */
  fillOpacity?: number;

  /**
   * Color of the wave fill
   */
  fillColor: string;

  /**
   * Vertical position of the wave centerline as a percentage (0-100).
   * 0 = bottom, 50 = middle, 100 = top
   */
  height?: number;

  /**
   * Color of the wave stroke (border)
   */
  strokeColor?: string;

  /**
   * Width of the wave stroke in SVG units
   */
  strokeWidth?: number;

  /**
   * Opacity of the wave stroke (0-1)
   */
  strokeOpacity?: number;

  /**
   * Glow color that creates an inset glow effect inside the wave at the top.
   * When provided, the wave fill is solid fillColor, with an inset glow
   * at the top edge that follows the wave curve using this color.
   */
  glowColor?: string;

  /**
   * Controls how deep the inset glow effect extends downward from the top.
   * Higher values create a deeper, more prominent inset glow.
   * Defaults to 10 if glowColor is provided, otherwise defaults to no glow.
   */
  glowIntensity?: number;

  /**
   * Opacity of the inset glow effect (0-1).
   * Higher values make the glow brighter and more visible.
   * Defaults to 1.0 if glowColor is provided, otherwise defaults to no glow.
   * This is independent from fillOpacity, allowing you to have a dark solid fill
   * with a bright visible glow.
   */
  glowOpacity?: number;

  /**
   * Width of the glow stroke in SVG units before blur is applied.
   * Higher values create a thicker, more visible glow that can handle
   * higher highlightIntensity values. Defaults to 3.
   * Note: This is the stroke width BEFORE blur, so a value of 10 with
   * highlightIntensity=20 will create a soft, diffuse glow.
   */
  glowStrokeWidth?: number;
}

/**
 * Generates an SVG path data string for a single wave.
 *
 * The wave uses cubic Bezier curves with both control points at the same Y level
 * (either peak or trough) to create a smooth, sine-like pattern.
 * Each period consists of two curves: one for the peak, one for the trough.
 *
 * Based on the CSS reference pattern:
 * - First curve: both control points at peakY (centerY - amplitude)
 * - Second curve: both control points at troughY (centerY + amplitude)
 * - Control points are at 1/3 and 2/3 of the half-period
 *
 * @param amplitude - Wave amplitude in SVG units (height from center to peak)
 * @param period - Wave period in SVG units (width of one complete cycle)
 * @param phaseOffset - Horizontal phase offset in SVG units (for animation)
 * @param centerY - Vertical center position of the wave in SVG units
 * @returns SVG path data string
 */
const generateWavePath = (
  amplitude: number,
  period: number,
  phaseOffset: number = 0,
  centerY: number = SVG_HEIGHT / 2
): string => {
  const peakY = centerY - amplitude;
  const troughY = centerY + amplitude;
  const halfPeriod = period / 2;
  const numPeriods = Math.ceil(SVG_WIDTH / period) + 1;

  // Start at the left edge, accounting for phase offset
  const startX = -phaseOffset;
  let pathData = `M${startX},${centerY}`;

  // Generate wave curves across the width
  for (let i = 0; i < numPeriods; i++) {
    const periodStartX = startX + i * period;

    // First curve: from center to peak and back to center
    // Both control points are at peakY for smooth, rounded sine-like shape
    const curve1EndX = periodStartX + halfPeriod;
    const cp1X = periodStartX + halfPeriod / 3;
    const cp2X = periodStartX + (halfPeriod * 2) / 3;

    pathData += ` C${cp1X},${peakY} ${cp2X},${peakY} ${curve1EndX},${centerY}`;

    // Second curve: from center to trough and back to center
    // Both control points are at troughY for smooth, rounded sine-like shape
    const curve2EndX = curve1EndX + halfPeriod;
    const cp3X = curve1EndX + halfPeriod / 3;
    const cp4X = curve1EndX + (halfPeriod * 2) / 3;

    pathData += ` C${cp3X},${troughY} ${cp4X},${troughY} ${curve2EndX},${centerY}`;
  }

  // Close the path to fill the bottom
  pathData += ` L${SVG_WIDTH} ${SVG_HEIGHT} L${startX} ${SVG_HEIGHT}`;

  return pathData;
};

/**
 * AnimatedWave component that renders a single animated wave.
 *
 * The wave is rendered as an SVG path with a cubic Bezier curve pattern.
 * The wave can be animated by updating the phaseOffset prop.
 *
 * @example
 * ```tsx
 * <AnimatedWave
 *   amplitude={92}
 *   period={660}
 *   fillColor="#3b82f6"
 *   fillOpacity={0.85}
 *   phaseOffset={0}
 *   height={50}
 * />
 * ```
 *
 * @example
 * ```tsx
 * <AnimatedWave
 *   amplitude={92}
 *   period={660}
 *   fillColor="#3b82f6"
 *   glowColor="#60a5fa"
 *   glowIntensity={15}
 *   glowOpacity={0.8}
 *   glowStrokeWidth={5}
 *   strokeColor="#1d4ed8"
 *   strokeWidth={2}
 *   height={50}
 * />
 * ```
 */
export const AnimatedWave: React.FC<AnimatedWaveProps> = ({
  amplitude,
  period,
  phaseOffset = 0,
  fillOpacity = 0.85,
  fillColor,
  height = 50,
  strokeColor,
  strokeWidth,
  strokeOpacity,
  glowColor,
  glowIntensity,
  glowOpacity,
  glowStrokeWidth = 3,
}) => {
  // Calculate centerY based on height percentage (0 = bottom, 100 = top)
  const centerY = SVG_HEIGHT - (SVG_HEIGHT * height) / 100;

  // Generate the wave path
  const wavePath = generateWavePath(amplitude, period, phaseOffset, centerY);

  // Generate unique IDs
  const waveMaskId = `wave-mask-${fillColor.replace(/[^a-zA-Z0-9]/g, "")}-${glowColor || "none"}`;
  const waveFilterId = `wave-blur-filter-${fillColor.replace(/[^a-zA-Z0-9]/g, "")}-${glowColor || "none"}`;
  const glowStrokeId = `wave-glow-stroke-${fillColor.replace(/[^a-zA-Z0-9]/g, "")}-${glowColor || "none"}`;

  const highlightColor = glowColor || fillColor;
  const hasHighlight =
    glowColor !== undefined ||
    (glowIntensity !== undefined && glowIntensity > 0);

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Defs>
        {hasHighlight && (
          <>
            <Mask id={waveMaskId}>
              {/* White areas are visible, black areas are masked out */}
              <Rect
                x="0"
                y="0"
                width={SVG_WIDTH}
                height={SVG_HEIGHT}
                fill="black"
              />
              <Path d={wavePath} fill="white" />
            </Mask>
            <Filter id={waveFilterId}>
              <FeGaussianBlur stdDeviation={glowIntensity || 10} />
            </Filter>
          </>
        )}
      </Defs>

      {/* Main wave fill */}
      <Path
        d={wavePath}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
      />

      {/* Inset glow that follows the wave curve from inside */}
      {hasHighlight && (
        <Path
          id={glowStrokeId}
          d={wavePath}
          fill="none"
          stroke={highlightColor}
          strokeWidth={glowStrokeWidth}
          filter={`url(#${waveFilterId})`}
          mask={`url(#${waveMaskId})`}
          opacity={
            glowOpacity !== undefined ? glowOpacity : glowColor ? 1.0 : 0.6
          }
        />
      )}
    </Svg>
  );
};
