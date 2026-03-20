import type { VesselTimelineDesignVariant } from "./types";
import {
  DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID,
  VESSEL_TIMELINE_VARIANT_DEFINITIONS,
} from "./variantDefinitions";

export const VESSEL_TIMELINE_DESIGN_VARIANTS: readonly VesselTimelineDesignVariant[] =
  VESSEL_TIMELINE_VARIANT_DEFINITIONS;

export const getVesselTimelineDesignVariant = (variantId?: string) =>
  VESSEL_TIMELINE_DESIGN_VARIANTS.find((variant) => variant.id === variantId) ??
  VESSEL_TIMELINE_DESIGN_VARIANTS.find(
    (variant) => variant.id === DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID
  ) ??
  VESSEL_TIMELINE_DESIGN_VARIANTS[0];
