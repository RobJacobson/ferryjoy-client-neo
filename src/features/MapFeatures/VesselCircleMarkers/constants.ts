/**
 * Shared identifiers for the VesselCircleMarkers feature
 *
 * Centralizes the source and layer IDs so other features (e.g. vessel lines)
 * can refer to the circle layers without hard-coding strings.
 */
export const CIRCLE_SOURCE_IDS = {
  outOfService: "vessel-circles-source-out-of-service",
  atDock: "vessel-circles-source-at-dock",
  atSea: "vessel-circles-source-at-sea",
} as const;

export const CIRCLE_LAYER_IDS = {
  outOfService: "vessel-circles-out-of-service",
  atDock: "vessel-circles-at-dock",
  atSea: "vessel-circles-at-sea",
} as const;
