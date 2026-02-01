/**
 * Type definition for easing functions
 * All easing functions take a value t in the range [0, 1] and return an eased value
 */
export type EasingFunction = (t: number) => number;

/**
 * Linear interpolation function
 * Maps a value from one range to another with optional easing
 *
 * @param value - The input value to interpolate
 * @param inputStart - The start of input range
 * @param inputEnd - The end of input range
 * @param outputStart - The start of output range
 * @param outputEnd - The end of output range
 * @param easingFn - Optional easing function to apply to the interpolation
 * @returns The interpolated value in the output range
 *
 * @example
 * ```typescript
 * // Basic linear interpolation
 * lerp(5, 0, 10, 0, 100); // returns 50
 *
 * // With easing function
 * lerp(5, 0, 10, 0, 100, EasingFunctions.easeOutCubic); // returns eased value
 * ```
 */
export function lerp(
  value: number,
  inputStart: number,
  inputEnd: number,
  outputStart: number,
  outputEnd: number,
  easingFn?: EasingFunction
): number {
  "worklet";
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

/**
 * Collection of common easing functions for use with lerp
 * All functions take a value t in the range [0, 1] and return an eased value
 */
export const EasingFunctions = {
  // Linear easing (no change)
  linear: (t: number): number => t,

  // Quadratic easing
  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Cubic easing
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => --t * t * t + 1,
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Quartic easing
  easeInQuart: (t: number): number => t * t * t * t,
  easeOutQuart: (t: number): number => 1 - --t * t * t * t,
  easeInOutQuart: (t: number): number =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,

  // Quintic easing
  easeInQuint: (t: number): number => t * t * t * t * t,
  easeOutQuint: (t: number): number => 1 + --t * t * t * t * t,
  easeInOutQuint: (t: number): number =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,

  // Sine easing
  easeInSine: (t: number): number => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number): number => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,

  // Exponential easing
  easeInExpo: (t: number): number => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  easeOutExpo: (t: number): number => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  easeInOutExpo: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return 2 ** (20 * t - 10) / 2;
    return (2 - 2 ** (-20 * t + 10)) / 2;
  },

  // Circular easing
  easeInCirc: (t: number): number => 1 - Math.sqrt(1 - t ** 2),
  easeOutCirc: (t: number): number => Math.sqrt(1 - (t - 1) ** 2),
  easeInOutCirc: (t: number): number => {
    if (t < 0.5) return (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2;
    return (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2;
  },

  // Back easing
  easeInBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  easeInOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2
      : ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // Elastic easing
  easeInElastic: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return (
      -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3))
    );
  },
  easeOutElastic: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  easeInOutElastic: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5
      ? -(
          2 ** (20 * t - 10) *
          Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))
        ) / 2
      : (2 ** (-20 * t + 10) *
          Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) /
          2 +
          1;
  },

  // Bounce easing
  easeOutBounce: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      const adjustedT = t - 1.5 / d1;
      return n1 * adjustedT * adjustedT + 0.75;
    } else if (t < 2.5 / d1) {
      const adjustedT = t - 2.25 / d1;
      return n1 * adjustedT * adjustedT + 0.9375;
    } else {
      const adjustedT = t - 2.625 / d1;
      return n1 * adjustedT * adjustedT + 0.984375;
    }
  },
  easeInBounce: (t: number): number => 1 - EasingFunctions.easeOutBounce(1 - t),
  easeInOutBounce: (t: number): number =>
    t < 0.5
      ? (1 - EasingFunctions.easeOutBounce(1 - 2 * t)) / 2
      : (1 + EasingFunctions.easeOutBounce(2 * t - 1)) / 2,
};
