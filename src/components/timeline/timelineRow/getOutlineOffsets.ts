/**
 * Pixel offsets for timeline outlined text/icon: duplicate layers shifted in a
 * square ring around the center to approximate an outline (React Native has no
 * text stroke on all platforms).
 */

export type OutlinePixelOffset = { x: number; y: number };

/**
 * Returns every integer (x, y) offset from -outlineWidth..outlineWidth except
 * (0, 0), for stacking outline copies around the main content.
 *
 * @param outlineWidth - Half-size of the offset square (inclusive); must be >= 0
 * @returns List of offsets suitable for absolute left/top positioning
 */
export const getOutlineOffsets = (
  outlineWidth: number
): OutlinePixelOffset[] => {
  const offsets: OutlinePixelOffset[] = [];

  for (let x = -outlineWidth; x <= outlineWidth; x += 1) {
    for (let y = -outlineWidth; y <= outlineWidth; y += 1) {
      if (x === 0 && y === 0) {
        continue;
      }

      offsets.push({ x, y });
    }
  }

  return offsets;
};
