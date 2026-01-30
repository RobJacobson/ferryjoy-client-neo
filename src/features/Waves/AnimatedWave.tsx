// ============================================================================
// Animated Wave Component
// ============================================================================
// Generates an animated wave using cubic Bezier curves pattern from CSS reference
// The wave is centered at y=0 and repeated across the SVG bounding box
// ============================================================================

import type React from "react";
import Svg, { Defs, Path } from "react-native-svg";

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
  centerY: number = SVG_HEIGHT / 2,
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
 *   phaseOffset={0}
 *   height={50}
 * />
 * ```
 */
export const AnimatedWave: React.FC<AnimatedWaveProps> = ({
  amplitude,
  period,
  phaseOffset = 0,
  fillOpacity = 1,
  fillColor,
  height = 50,
  strokeColor = "white",
  strokeWidth = 1,
  strokeOpacity = 0.5,
}) => {
  // Calculate centerY based on height percentage (0 = bottom, 100 = top)
  const centerY = SVG_HEIGHT - (SVG_HEIGHT * height) / 100;

  // Generate the wave path
  const wavePath = generateWavePath(amplitude, period, phaseOffset, centerY);

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Defs />
      {/* Main wave fill */}
      <Path
        d={wavePath}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
      />
    </Svg>
  );
};
