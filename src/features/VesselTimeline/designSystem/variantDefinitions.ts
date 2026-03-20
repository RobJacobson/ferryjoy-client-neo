import type {
  VesselTimelineVariantDefinition,
  VesselTimelineVariantDefinitionInput,
  VesselTimelineVariantPalette,
} from "./types";

/**
 * Baseline authoring template for future themes.
 *
 * New variants should usually override this palette rather than rebuilding the
 * entire design contract from scratch.
 */
export const DEFAULT_VESSEL_TIMELINE_VARIANT_PALETTE: VesselTimelineVariantPalette =
  {
    canvas: "hsla(34, 50%, 94%, 1)",
    atmosphere: [
      "hsla(173, 42%, 73%, 1)",
      "hsla(27, 100%, 89%, 1)",
      "hsla(207, 100%, 88%, 1)",
      "hsla(317, 64%, 89%, 1)",
    ],
    text: {
      terminalName: "hsla(229, 57%, 63%, 1)",
      row: "hsla(210, 47%, 23%, 1)",
      indicatorLabel: "hsla(210, 47%, 23%, 1)",
      indicatorBadge: "hsla(158, 64%, 52%, 1)",
    },
    accent: {
      primary: "hsla(158, 64%, 52%, 1)",
      trackGlow: "hsla(158, 64%, 52%, 0.2)",
      trackRemaining: "hsla(158, 64%, 52%, 0.3)",
      indicatorBorder: "hsla(158, 64%, 52%, 0.82)",
      indicatorGlow: "hsla(158, 64%, 52%, 0.24)",
    },
    marker: {
      past: {
        stroke: "hsla(0, 0%, 100%, 0.9)",
        fill: "hsla(158, 64%, 52%, 1)",
        icon: "hsla(0, 0%, 100%, 0.9)",
      },
      future: {
        stroke: "hsla(158, 64%, 52%, 1)",
        fill: "hsla(0, 0%, 100%, 0.9)",
        icon: "hsla(158, 64%, 52%, 1)",
      },
    },
  };

export const defineVesselTimelineVariant = ({
  id,
  label,
  description,
  palette,
}: VesselTimelineVariantDefinitionInput): VesselTimelineVariantDefinition => ({
  id,
  label,
  description,
  palette: {
    ...DEFAULT_VESSEL_TIMELINE_VARIANT_PALETTE,
    ...palette,
    text: {
      ...DEFAULT_VESSEL_TIMELINE_VARIANT_PALETTE.text,
      ...palette?.text,
    },
    accent: {
      ...DEFAULT_VESSEL_TIMELINE_VARIANT_PALETTE.accent,
      ...palette?.accent,
    },
    marker: {
      past: {
        ...DEFAULT_VESSEL_TIMELINE_VARIANT_PALETTE.marker.past,
        ...palette?.marker?.past,
      },
      future: {
        ...DEFAULT_VESSEL_TIMELINE_VARIANT_PALETTE.marker.future,
        ...palette?.marker?.future,
      },
    },
  },
});

export const VESSEL_TIMELINE_VARIANT_DEFINITIONS: readonly VesselTimelineVariantDefinition[] =
  [
    defineVesselTimelineVariant({
      id: "baseline-harbor",
      label: "Baseline Harbor",
      description:
        "Default vessel timeline theme and authoring template for future variants.",
    }),
  ];

export const DEFAULT_VESSEL_TIMELINE_DESIGN_VARIANT_ID = "baseline-harbor";
