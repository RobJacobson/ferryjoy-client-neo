/**
 * Linear interpolation function
 * Maps a value from one range to another with optional easing
 */
export function lerp(
  value: number,
  inputStart: number,
  inputEnd: number,
  outputStart: number,
  outputEnd: number,
  easingFn?: (t: number) => number
): number {
  // Normalize input value to 0-1 range
  const t = (value - inputStart) / (inputEnd - inputStart);
  if (t < 0) {
    return outputStart;
  }
  if (t > 1) {
    return outputEnd;
  }

  // Apply easing function if provided, otherwise use linear
  const easedT = easingFn ? easingFn(t) : t;

  // Interpolate to output range
  return outputStart + (outputEnd - outputStart) * easedT;
}
