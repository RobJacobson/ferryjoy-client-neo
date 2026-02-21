/**
 * Animation configuration for carousel items (RouteCard, etc.).
 * Used by useCarouselItemAnimatedStyle when incorporating RouteCards.
 */

// ============================================================================
// Animation constants
// ============================================================================

/** Horizontal offset for parallax so adjacent cards sit slightly inset. */
export const PARALLAX_OFFSET = 200;

/** Scale when card is centered. */
export const SCALE_CENTER = 1.0;

/** Scale when card is one slot left or right. */
export const SCALE_SIDES = 0.6;

/** Rotation when card is one slot left or right. */
export const ROTATION_SIDES = 30;

/** z-index so carousel sits above Background (foreground grass = 100). */
export const CAROUSEL_Z_INDEX = 200;
