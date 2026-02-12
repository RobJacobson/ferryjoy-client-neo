/**
 * Layout and animation configuration for the routes carousel.
 * Single place to tune slot size, parallax inset, and scale values.
 */

import { Dimensions } from "react-native";

// ============================================================================
// Sizing constants
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/** Width of each carousel slot (full screen). */
export const SLOT_WIDTH = SCREEN_WIDTH;

/** Height of each carousel slot. */
export const SLOT_HEIGHT = SCREEN_HEIGHT * 0.9;

/** Horizontal offset for parallax so adjacent cards sit slightly inset. */
export const PARALLAX_OFFSET = 200;

/** Scale when card is centered. */
export const SCALE_CENTER = 0.9;

/** Scale when card is one slot left or right. */
export const SCALE_SIDES = 0.6;
