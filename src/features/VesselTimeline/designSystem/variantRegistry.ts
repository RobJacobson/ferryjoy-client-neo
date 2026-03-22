/**
 * Registry lookup for authored `VesselTimeline` design variants.
 */

import type { VesselTimelineDesignVariant } from "./types";
import {
  DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID,
  VESSEL_TIMELINE_VARIANT_DEFINITIONS,
} from "./variantDefinitions";

/**
 * All design variants in registration order (for pickers and fallbacks).
 */
export const VESSEL_TIMELINE_DESIGN_VARIANTS: readonly VesselTimelineDesignVariant[] =
  VESSEL_TIMELINE_VARIANT_DEFINITIONS;

/**
 * Resolves a variant by id with default and first-entry fallbacks.
 *
 * @param variantId - Optional id from settings or navigation
 * @returns Matching variant, else default id, else the first definition
 */
export const getVesselTimelineDesignVariant = (variantId?: string) =>
  VESSEL_TIMELINE_DESIGN_VARIANTS.find((variant) => variant.id === variantId) ??
  VESSEL_TIMELINE_DESIGN_VARIANTS.find(
    (variant) => variant.id === DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID
  ) ??
  VESSEL_TIMELINE_DESIGN_VARIANTS[0];
