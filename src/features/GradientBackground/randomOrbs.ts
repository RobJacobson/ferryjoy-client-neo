/**
 * Random orb generation for the gradient background.
 *
 * These helpers synthesize a visually varied field of orbs that begin at
 * random viewport positions, then derive an orbit center within one orb radius
 * of that starting point so the subsequent rotation animation feels organic.
 */

import {
  GRADIENT_BACKGROUND_COLORS,
  GRADIENT_BACKGROUND_DELAY_RANGE_MS,
  GRADIENT_BACKGROUND_DURATION_RANGE_MS,
  GRADIENT_BACKGROUND_RADIUS_RANGE,
  GRADIENT_BACKGROUND_SCALE_RANGE,
  type GradientOrbConfig,
} from "./config";

type CreateRandomGradientOrbsParams = {
  width: number;
  height: number;
  maxDimension: number;
  colors?: readonly string[];
};

/**
 * Returns a random number within an inclusive-exclusive numeric range.
 *
 * @param min - Lower bound for the random value
 * @param max - Upper bound for the random value
 * @returns Random floating-point number between min and max
 */
const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

/**
 * Creates a randomized set of gradient orbs for the current viewport.
 *
 * Each orb starts with a random visible center position, then chooses an orbit
 * center by subtracting a random polar offset whose radius is capped at the
 * orb radius. That preserves the requirement that the midpoint sits within one
 * orb radius of the starting position.
 *
 * @param params - Viewport dimensions and optional color palette
 * @param params.width - Viewport width in device pixels
 * @param params.height - Viewport height in device pixels
 * @param params.maxDimension - Larger viewport dimension used to scale orb sizes
 * @param params.colors - Optional palette to use instead of the default colors
 * @returns Randomized orb definitions sized for the viewport
 */
export const createRandomGradientOrbs = ({
  width,
  height,
  maxDimension,
  colors = GRADIENT_BACKGROUND_COLORS,
}: CreateRandomGradientOrbsParams): GradientOrbConfig[] =>
  colors.map((color, index) => {
    const orbRadiusPx =
      maxDimension *
      randomBetween(
        GRADIENT_BACKGROUND_RADIUS_RANGE.min,
        GRADIENT_BACKGROUND_RADIUS_RANGE.max
      );
    const startX = randomBetween(0, width);
    const startY = randomBetween(0, height);
    const initialThetaRad = randomBetween(0, Math.PI * 2);
    const orbitRadiusPx = randomBetween(0, orbRadiusPx);

    // The orbit center is chosen by backing away from the visible starting
    // point using a random polar offset capped at one orb radius.
    const orbitCenterX = startX - Math.cos(initialThetaRad) * orbitRadiusPx;
    const orbitCenterY = startY - Math.sin(initialThetaRad) * orbitRadiusPx;
    const scaleA = randomBetween(GRADIENT_BACKGROUND_SCALE_RANGE.min, 1);
    const scaleB = randomBetween(1, GRADIENT_BACKGROUND_SCALE_RANGE.max);

    return {
      id: `orb-${index}-${color.replace("#", "").toLowerCase()}`,
      color,
      orbRadiusPx,
      orbitCenterX,
      orbitCenterY,
      orbitRadiusPx,
      initialThetaDeg: (initialThetaRad * 180) / Math.PI,
      durationMs: randomBetween(
        GRADIENT_BACKGROUND_DURATION_RANGE_MS.min,
        GRADIENT_BACKGROUND_DURATION_RANGE_MS.max
      ),
      delayMs: randomBetween(
        GRADIENT_BACKGROUND_DELAY_RANGE_MS.min,
        GRADIENT_BACKGROUND_DELAY_RANGE_MS.max
      ),
      scaleFrom: scaleA,
      scaleTo: scaleB,
    };
  });
