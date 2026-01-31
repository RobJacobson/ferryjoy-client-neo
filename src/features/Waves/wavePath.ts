// ============================================================================
// Wave Path Generation
// ============================================================================
// Pure functions for generating SVG wave paths using cubic Bezier curves.
// No React dependencies - fully testable and reusable.
// ============================================================================

/** Width of the SVG canvas. Wider width allows oscillation without visible edges. */
const SVG_WIDTH = 2000;

/** Height of the SVG canvas. */
const SVG_HEIGHT = 500;

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
 * @param centerY - Vertical center position of the wave in SVG units
 * @param svgWidth - Total SVG width in units
 * @param svgHeight - Total SVG height in units
 * @returns SVG path data string
 */
export const generateWavePath = (
  amplitude: number,
  period: number,
  centerY: number = SVG_HEIGHT / 2,
  svgWidth: number = SVG_WIDTH,
  svgHeight: number = SVG_HEIGHT
): string => {
  const peakY = centerY - amplitude;
  const troughY = centerY + amplitude;
  const halfPeriod = period / 2;
  const numPeriods = Math.ceil(svgWidth / period) + 1;

  // Start at the left edge
  let pathData = `M0,${centerY}`;

  // Generate wave curves across the width
  for (let i = 0; i < numPeriods; i++) {
    const periodStartX = i * period;

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
  pathData += ` L${svgWidth} ${svgHeight} L0 ${svgHeight}`;

  return pathData;
};
