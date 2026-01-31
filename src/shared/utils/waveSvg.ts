// ============================================================================
// Wave SVG Generator
// ============================================================================

/**
 * SVG dimensions constants for wave generation.
 */
export const WAVE_SVG_WIDTH = 2000;
export const WAVE_SVG_HEIGHT = 500;

/**
 * Generates an SVG path data string for a single animated wave.
 *
 * The wave uses cubic Bezier curves to create a smooth, sine-like pattern.
 * Each period consists of two control points that create the peak and trough.
 *
 * @param amplitude - Wave amplitude in SVG units (height from center to peak)
 * @param period - Wave period in SVG units (width of one complete cycle)
 * @param phaseOffset - Horizontal phase offset in SVG units (for animation)
 * @param fillOpacity - Opacity of the wave fill (0-1)
 * @param fillColor - Color of the wave fill
 * @returns SVG path element as a string with all attributes
 */
export function generateWavePath(
  amplitude: number,
  period: number,
  phaseOffset: number = 0,
  fillOpacity: number = 0.85,
  fillColor: string = "#3b82f6"
): string {
  const centerY = WAVE_SVG_HEIGHT / 2;
  const controlPointX = period / 4;
  const numPeriods = Math.ceil(WAVE_SVG_WIDTH / period) + 1;

  // Start at the beginning, accounting for phase offset
  let pathData = `M0,${centerY}`;

  // Generate wave curves across the width
  for (let i = 0; i < numPeriods; i++) {
    const xStart = i * period;
    const xPeak1 = xStart + controlPointX;
    const xPeak2 = xStart + controlPointX * 2;
    const xEnd = xStart + period;

    // Calculate Y positions with phase offset applied to create the wave motion
    const yCenter = centerY;
    const yPeak = centerY - amplitude;
    const yTrough = centerY + amplitude;

    // Apply phase offset to shift the wave shape
    // This creates the animation effect when phaseOffset changes over time
    const normalizedPhase = (phaseOffset % period) / period;

    // First curve (peak phase)
    pathData += ` C${xPeak1},${yPeak} ${xPeak2},${yPeak} ${xEnd},${yCenter}`;

    // Second curve (trough phase) - inverted for the second half of period
    const xTrough1 = xEnd + controlPointX;
    const xTrough2 = xEnd + controlPointX * 2;
    const xNextEnd = xEnd + period;

    pathData += ` C${xTrough1},${yTrough} ${xTrough2},${yTrough} ${xNextEnd},${yCenter}`;
  }

  // Close the path to fill the bottom
  pathData += ` L${WAVE_SVG_WIDTH} ${WAVE_SVG_HEIGHT} L0 ${WAVE_SVG_HEIGHT}`;

  return `<path fill-opacity="${fillOpacity}" d="${pathData}" fill="${fillColor}" />`;
}

/**
 * Generates a complete SVG element containing one or more waves.
 *
 * @param waves - Array of wave configurations
 * @returns Complete SVG element as a string
 */
export function generateWaveSvg(
  waves: Array<{
    amplitude: number;
    period: number;
    phaseOffset?: number;
    fillOpacity?: number;
    fillColor?: string;
  }>
): string {
  const wavePaths = waves
    .map((wave) =>
      generateWavePath(
        wave.amplitude,
        wave.period,
        wave.phaseOffset,
        wave.fillOpacity,
        wave.fillColor
      )
    )
    .join("\n      ");

  return `<svg viewBox="0 0 ${WAVE_SVG_WIDTH} ${WAVE_SVG_HEIGHT}">
      ${wavePaths}
    </svg>`;
}
