// ============================================================================
// COLOR GENERATOR UTILITY
// ============================================================================
// Provides color scale generation using chroma-js for perceptually uniform
// color ramps. Supports arbitrary shade values (50-950) similar to Tailwind CSS.
// ============================================================================

import chroma from "chroma-js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Function that returns a hex color for a given shade value.
 */
export type ColorGenerator = (shade: number) => string;

// ============================================================================
// COLOR GENERATION
// ============================================================================

/**
 * Creates a color generator function for a base color using chroma-js.
 * The generator produces a perceptually uniform color scale from white to black,
 * with the base color positioned at shade 500.
 *
 * The scale uses Lab/Lch color space for better interpolation than RGB,
 * producing smooth transitions that match human color perception.
 *
 * @param baseColor - Base color in hex format (equivalent to shade 500)
 * @returns Function that accepts a shade number (50-950) and returns hex color
 *
 * @example
 * ```tsx
 * const blue = createColorGenerator('#3b82f6');
 * blue(50).hex();   // Returns lightest shade
 * blue(500).hex();  // Returns base color (#3b82f6)
 * blue(950).hex();  // Returns darkest shade
 * blue(150).hex();  // Returns intermediate shade
 * ```
 */
export const createColorGenerator = (baseColor: string): ColorGenerator => {
  // Create scale: white → baseColor → black
  // Using 'lch' mode for perceptually uniform interpolation
  const scale = chroma.scale(["white", baseColor, "black"]).mode("lch");

  /**
   * Get hex color for a specific shade.
   *
   * @param shade - Shade value from 50 to 950
   * @returns Hex color string
   */
  return (shade: number): string => {
    // Map 50-950 range to 0-1 chroma scale
    const t = (shade - 50) / 900;

    // Clamp to valid range to prevent edge cases
    const clampedT = Math.max(0, Math.min(1, t));

    return scale(clampedT).hex();
  };
};

/**
 * Generates a full palette array from a base color.
 * Creates all Tailwind-standard shades (50, 100, 150, ..., 950).
 *
 * @param baseColor - Base color in hex format (equivalent to shade 500)
 * @returns Array of hex colors indexed by shade position (0=50, 1=100, etc.)
 *
 * @example
 * ```tsx
 * const bluePalette = generatePalette('#3b82f6');
 * bluePalette[0]; // blue-50
 * bluePalette[9]; // blue-950
 * ```
 */
export const generatePalette = (baseColor: string): readonly string[] => {
  const generator = createColorGenerator(baseColor);
  const palette: string[] = [];

  // Generate shades from 50 to 950 in increments of 50
  for (let shade = 50; shade <= 950; shade += 50) {
    palette.push(generator(shade));
  }

  return palette;
};

/**
 * Validates if a color string is a valid chroma-js color.
 *
 * @param color - Color string to validate (hex, named color, etc.)
 * @returns True if color is valid, false otherwise
 */
export const isValidColor = (color: string): boolean => {
  return chroma.valid(color);
};
