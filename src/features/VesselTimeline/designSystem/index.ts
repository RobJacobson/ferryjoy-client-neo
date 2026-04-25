/**
 * Public exports for VesselTimeline design variants and theme helpers.
 */

export type {
  VesselTimelineDesignVariant,
  VesselTimelineVariantDefinitionInput,
} from "./types";
export {
  DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT,
  DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID,
  defineVesselTimelineVariant,
  VESSEL_TIMELINE_VARIANT_DEFINITIONS,
} from "./variantDefinitions";
export {
  getVesselTimelineDesignVariant,
  VESSEL_TIMELINE_DESIGN_VARIANTS,
} from "./variantRegistry";
